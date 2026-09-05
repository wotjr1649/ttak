#!/usr/bin/env python3
"""Cross-host conformance runner for TTAK.

Replaces `claude plugin eval`, which is early-access gated on this account
(verified by execution: it prints "`plugin eval` is currently in early
access" before resolving a target).

    python run.py --host claude|codex --arm with|without --model <id> \
        --trials N --out <file>

Writes one JSONL row per (case, trial, arm, host) to --out, skipping rows
already present there so a run can be interrupted and resumed. Use --dry-run
to print the exact commands this would run without executing anything, or
--score --out <file> to aggregate an already-graded file into a gate verdict.
See README.md for the case coverage, the with/without-arm mechanism, and the
installed-skill set a real run must document.

Standard library only. Does not invoke `claude` or `codex` unless a real
(non-dry-run) run is requested; --dry-run, --score and --selftest never do.
"""
import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASES_FILE = Path(__file__).resolve().parent / "cases.jsonl"
SPEC_EN = ROOT / "docs" / "TTAK_Plugin_Product_Definition_v0.2_EN.md"

DEFAULT_MODEL = "sonnet"
DEFAULT_TIMEOUT = 300

# A one-time, pre-provisioned fixture: Codex has no ad hoc "load this plugin
# directory for one session" flag (checked: `codex exec --help`, `codex
# plugin --help` — only `add` from a configured marketplace snapshot
# exists). Claude does (`--plugin-dir`), so only Codex's with-arm needs this.
CODEX_HOME_WITH = Path(tempfile.gettempdir()) / "ttak-conformance" / "codex-home-with"


# --- command construction ---------------------------------------------------
#
# "Isolation is the whole point, and it must not be optional" (task brief).
# These two lists are the required flags verbatim; build_command() always
# starts from one of them and REQUIRED below is checked on every command it
# builds, including in --dry-run, so a future edit that drops a flag fails
# loudly instead of silently shipping a leaky baseline.

CLAUDE_BASE = ["claude", "-p", "--output-format", "json", "--setting-sources", ""]
CODEX_BASE = ["codex", "exec", "--ephemeral", "--ignore-user-config",
              "--sandbox", "read-only", "--skip-git-repo-check", "--json"]

# Required as contiguous subsequences, not mere membership: a check for
# "--sandbox" and "read-only" as independent membership tests would still
# pass a mutated `--sandbox workspace-write ... read-only` command, since
# "read-only" would still appear somewhere in the list. That is exactly the
# accidental-satisfaction failure the controller addendum warns about, so
# REQUIRED pairs a flag with the value immediately after it.
REQUIRED = {
    "claude": [["-p"], ["--output-format", "json"], ["--setting-sources", ""]],
    "codex": [["exec"], ["--ephemeral"], ["--ignore-user-config"],
              ["--sandbox", "read-only"], ["--skip-git-repo-check"], ["--json"]],
}


def contains_subseq(cmd, sub):
    n, m = len(cmd), len(sub)
    return any(cmd[i:i + m] == sub for i in range(n - m + 1))


def assert_isolated(host, cmd, model):
    for sub in REQUIRED[host]:
        if not contains_subseq(cmd, sub):
            raise AssertionError(f"{host} command missing required isolation flag {sub!r}: {cmd!r}")
    if "--model" not in cmd or cmd[cmd.index("--model") + 1] != model:
        raise AssertionError(f"{host} command must pin --model to the requested model, never inherit a default: {cmd!r}")


def build_command(host, arm, model, prompt):
    """Build the argv for one trial. `arm` toggles whether TTAK is loaded:

    Claude: --plugin-dir loads a plugin directory for one session only
    (verified: `claude --help`), so "with" just adds it on top of the base
    isolation flags. Codex has no equivalent ad hoc flag, so "with" instead
    points CODEX_HOME at a fixture the operator provisions once (see
    README.md) and passes --dangerously-bypass-hook-trust, since Codex
    requires an interactive `/hooks` trust review before a hook runs and
    that flag's own help text names unattended automation as its intended use.
    Either way, TTAK only actually injects text when its saved state is
    "on" — build_env()/run_trial() seed that separately; loading the plugin
    alone is not enough (hooks/ttak.cjs shows an absent/off state emits at
    most a one-line notice, never the policy text).
    """
    if host == "claude":
        cmd = list(CLAUDE_BASE) + ["--model", model]
        if arm == "with":
            cmd += ["--plugin-dir", str(ROOT)]
    elif host == "codex":
        cmd = list(CODEX_BASE) + ["--model", model]
        if arm == "with":
            cmd += ["--dangerously-bypass-hook-trust"]
    else:
        raise ValueError(f"unknown host {host!r}")
    cmd.append(prompt)
    assert_isolated(host, cmd, model)
    return cmd


def build_env(plugin_data_dir):
    env = dict(os.environ)
    env.pop("CLAUDE_PLUGIN_DATA", None)
    if plugin_data_dir is None:
        env.pop("PLUGIN_DATA", None)
    else:
        env["PLUGIN_DATA"] = str(plugin_data_dir)
    return env


def seed_state_on(plugin_data_dir):
    # Same format hooks/ttak.cjs's writeState() produces: `{"enabled":true}\n`.
    plugin_data_dir.mkdir(parents=True, exist_ok=True)
    (plugin_data_dir / "state.json").write_text(
        json.dumps({"enabled": True}) + "\n", encoding="utf-8", newline="\n")


def codex_home_with_ready():
    return (CODEX_HOME_WITH / "plugins").exists()


# --- cases.jsonl -------------------------------------------------------------

AC_ID_RE = re.compile(r"^- \[(AC-\d{3})\]")


def load_ac_ids(spec_path):
    text = spec_path.read_text(encoding="utf-8")
    return {m.group(1) for line in text.splitlines() if (m := AC_ID_RE.match(line))}


def parse_cases(lines, known_acs, source="cases.jsonl"):
    cases = []
    seen_ids = set()
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line:
            continue
        row = json.loads(line)
        for field in ("id", "ac", "prompt", "criteria", "forbidden"):
            if field not in row:
                raise ValueError(f"{source}:{lineno}: missing field {field!r}")
        if row["id"] in seen_ids:
            raise ValueError(f"{source}:{lineno}: duplicate id {row['id']!r}")
        seen_ids.add(row["id"])
        if not isinstance(row["prompt"], str) or not row["prompt"].strip():
            raise ValueError(f"{source}:{lineno}: 'prompt' must be a non-empty string")
        if not isinstance(row["criteria"], list) or not row["criteria"]:
            raise ValueError(f"{source}:{lineno}: 'criteria' must be a non-empty list")
        if not isinstance(row["forbidden"], list) or not row["forbidden"]:
            raise ValueError(f"{source}:{lineno}: 'forbidden' must be a non-empty list")
        # Independent witness: ac is checked against IDs read from the real
        # spec doc, not a hand-copied list here that could quietly drift.
        if row["ac"] not in known_acs:
            raise ValueError(f"{source}:{lineno}: {row['ac']!r} is not a defined AC id in {SPEC_EN.name}")
        cases.append(row)
    return cases


def load_cases(path, known_acs):
    with path.open("r", encoding="utf-8") as f:
        return parse_cases(f, known_acs, source=str(path))


# --- resumability --------------------------------------------------------

def load_existing_keys(out_path):
    keys = set()
    if out_path and out_path.exists():
        with out_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                keys.add((row["case"], row["trial"], row["arm"], row["host"]))
    return keys


def should_skip(case_id, trial, arm, host, existing_keys):
    return (case_id, trial, arm, host) in existing_keys


def append_row(out_path, row):
    with out_path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


# --- execution -------------------------------------------------------------

def capture_cli_version(host):
    exe = "claude" if host == "claude" else "codex"
    try:
        proc = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=10)
        return (proc.stdout or proc.stderr).strip()
    except Exception as e:  # only reached by a real run; --dry-run/--score/--selftest never call this
        return f"<unavailable: {e}>"


def run_trial(host, arm, model, cli_version, skills, case, trial, timeout):
    # A neutral, empty cwd for every trial: the isolation flags stop the
    # operator's own settings/config leaking in, but the model's own repo
    # (this one) would leak a second way if either arm ran from ROOT — a
    # model that can read TTAK's own spec behaves differently for that
    # reason alone, independent of whether the hook actually injected
    # anything. Fresh per trial so nothing a trial writes carries to the next.
    with tempfile.TemporaryDirectory(prefix="ttak-conformance-") as trial_dir:
        trial_dir = Path(trial_dir)
        cwd_dir = trial_dir / "cwd"
        cwd_dir.mkdir()
        plugin_data_dir = None
        if arm == "with":
            plugin_data_dir = trial_dir / "plugin-data"
            seed_state_on(plugin_data_dir)

        cmd = build_command(host, arm, model, case["prompt"])
        env = build_env(plugin_data_dir)
        if host == "codex":
            if arm == "with":
                env["CODEX_HOME"] = str(CODEX_HOME_WITH)
            else:
                codex_home = trial_dir / "codex-home"
                codex_home.mkdir()
                env["CODEX_HOME"] = str(codex_home)

        started = time.time()
        exit_code, stdout, stderr, error = None, "", "", None
        try:
            proc = subprocess.run(cmd, cwd=str(cwd_dir), env=env, capture_output=True,
                                   text=True, timeout=timeout)
            exit_code, stdout, stderr = proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired as e:
            stdout, stderr, error = e.stdout or "", e.stderr or "", f"timeout after {timeout}s"
        except OSError as e:
            error = f"launch failed: {e}"

    return {
        "case": case["id"], "ac": case["ac"], "trial": trial, "arm": arm, "host": host,
        "model": model, "cli_version": cli_version, "skills": skills,
        "command": cmd, "exit_code": exit_code, "stdout": stdout, "stderr": stderr,
        "error": error, "duration_s": round(time.time() - started, 3),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pass": None,  # filled in later by grading against the case's criteria/forbidden
    }


def do_dry_run(cases, host, arm, model, trials, existing):
    # Honors resumability too: a row already present in --out would not
    # actually be re-run, so "the exact commands it would run" must skip it
    # here as well, or a dry-run against a partially-done --out would show
    # commands that a real run of the same arguments would not issue.
    skipped = 0
    for case in cases:
        for trial in range(1, trials + 1):
            if should_skip(case["id"], trial, arm, host, existing):
                skipped += 1
                continue
            cmd = build_command(host, arm, model, case["prompt"])
            print(f"# case={case['id']} ac={case['ac']} trial={trial} arm={arm} host={host}")
            print(shlex.join(cmd))
    if skipped:
        print(f"# ({skipped} row(s) already present in --out would be skipped, not shown)", file=sys.stderr)
    return 0


def do_run(cases, host, arm, model, trials, out_path, timeout):
    if host == "codex" and arm == "with" and not codex_home_with_ready():
        print(f"error: CODEX_HOME fixture not found at {CODEX_HOME_WITH}", file=sys.stderr)
        print("Provision it once (see README.md, 'Codex with-arm setup') before a real "
              "'codex with' run; without it this would silently measure the baseline twice.",
              file=sys.stderr)
        return 1

    existing = load_existing_keys(out_path)
    cli_version = capture_cli_version(host)
    skills = ["ttak"] if arm == "with" else []
    ran, skipped = 0, 0
    for case in cases:
        for trial in range(1, trials + 1):
            if should_skip(case["id"], trial, arm, host, existing):
                skipped += 1
                continue
            row = run_trial(host, arm, model, cli_version, skills, case, trial, timeout)
            append_row(out_path, row)
            ran += 1
    print(f"ran {ran} trial(s), skipped {skipped} already-present row(s) -> {out_path}")
    return 0


# --- scoring and gate --------------------------------------------------------
#
# AC classification follows the modal verb each acceptance criterion uses in
# docs/TTAK_Plugin_Product_Definition_v0.2_EN.md §17.4: MUST is a hard gate
# (100%, any failure fails the run); SHOULD is reported but only warns below
# threshold. Only the ACs cases.jsonl actually uses need an entry here.
HARD_ACS = {"AC-001", "AC-002", "AC-003", "AC-004"}
SOFT_ACS = {"AC-006", "AC-007"}
SOFT_THRESHOLD = 0.85


def score(rows):
    by_ac_arm = {}
    ungraded = 0
    for r in rows:
        verdict = r.get("pass")
        if verdict is None:
            ungraded += 1
            continue
        key = (r["ac"], r["arm"])
        by_ac_arm.setdefault(key, []).append(bool(verdict))
    report = {key: {"n": len(results), "pass_rate": sum(results) / len(results)}
              for key, results in by_ac_arm.items()}
    return report, ungraded


def gate(report):
    """Returns (hard_failures, soft_warnings): hard failures are what must be
    zero for the gate to pass; soft warnings are reported, never gate-failing
    (AC-006/007 are SHOULD, not MUST). A failure is bound only to the AC row
    it came from — HARD_ACS and SOFT_ACS are disjoint sets read from the same
    report, not one aggregate that could hide a hard failure inside a soft
    average.
    """
    hard, soft = [], []
    for (ac, arm), stats in sorted(report.items()):
        n, rate = stats["n"], stats["pass_rate"]
        if ac in HARD_ACS and rate < 1.0:
            hard.append(f"{ac} ({arm}): {rate:.0%} over {n} trial(s), MUST be 100%")
        elif ac in SOFT_ACS and rate < SOFT_THRESHOLD:
            soft.append(f"{ac} ({arm}): {rate:.0%} over {n} trial(s), SHOULD reach {SOFT_THRESHOLD:.0%}")
    return hard, soft


def print_report(report, hard, soft, ungraded):
    print("Absolute conformance to TTAK's own specification (not a comparison to a competitor).")
    print("Baseline ('without') is reported alongside; per README.md/AC-005, a single-run")
    print("difference is not a regression (predecessor reproducibility ~=0.96, 39.3% upper")
    print("bound on the true failure rate).")
    for (ac, arm), stats in sorted(report.items()):
        kind = "MUST=100%" if ac in HARD_ACS else ("SHOULD>=85%" if ac in SOFT_ACS else "")
        print(f"  {ac:8} {arm:7} n={stats['n']:<4} pass_rate={stats['pass_rate']:.0%}  {kind}")
    if ungraded:
        print(f"  {ungraded} row(s) not yet graded (no 'pass' verdict) -- excluded above")
    if soft:
        print("SHOULD warnings (not gate failures):")
        for w in soft:
            print(f"  - {w}")
    print("GATE: FAIL" if hard else "GATE: PASS")
    for f in hard:
        print(f"  - {f}")


# --- selftest ----------------------------------------------------------------
#
# ponytail's runnable-check rule: non-trivial logic here is command
# construction, schema validation, resumability and the gate, so each gets a
# real assertion below rather than a promise in a comment. Pure-function only
# -- no subprocess call anywhere in this function, so it never invokes
# claude/codex and is safe to run any time.

def _selftest():
    for host in ("claude", "codex"):
        for arm in ("with", "without"):
            build_command(host, arm, "test-model", "hello")  # raises via assert_isolated on failure

    assert "--plugin-dir" in build_command("claude", "with", "m", "p")
    assert "--plugin-dir" not in build_command("claude", "without", "m", "p")
    assert "--dangerously-bypass-hook-trust" in build_command("codex", "with", "m", "p")
    assert "--dangerously-bypass-hook-trust" not in build_command("codex", "without", "m", "p")

    # contains_subseq binds adjacency; scattered membership must not satisfy it.
    assert contains_subseq(["--sandbox", "read-only"], ["--sandbox", "read-only"])
    assert not contains_subseq(["--sandbox", "workspace-write", "--x", "read-only"], ["--sandbox", "read-only"])

    known = load_ac_ids(SPEC_EN)
    assert known, "no AC ids found in the spec -- regex or path is wrong"
    cases = load_cases(CASES_FILE, known)
    assert len(cases) >= 14, f"expected at least 14 cases (one per owned Sec17.2 group), found {len(cases)}"
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)), "duplicate case id in cases.jsonl"
    for c in cases:
        assert c["ac"] in known, f"{c['id']}: {c['ac']} not a real AC id"

    try:
        parse_cases(['{"id":"x","ac":"AC-999","prompt":"p","criteria":["a"],"forbidden":["b"]}'],
                     known, source="<selftest>")
        raise AssertionError("a case citing an invented AC id must be rejected")
    except ValueError as e:
        assert "AC-999" in str(e)

    existing = {("c1", 1, "without", "claude")}
    assert should_skip("c1", 1, "without", "claude", existing)
    assert not should_skip("c1", 2, "without", "claude", existing), "must key on trial, not just case"
    assert not should_skip("c1", 1, "with", "claude", existing), "must key on arm, not just case+trial"
    assert not should_skip("c1", 1, "without", "codex", existing), "must key on host too"

    report = {("AC-001", "with"): {"n": 3, "pass_rate": 2 / 3},
              ("AC-006", "with"): {"n": 3, "pass_rate": 2 / 3}}
    hard, soft = gate(report)
    assert any("AC-001" in f for f in hard) and not any("AC-001" in f for f in soft), \
        "a hard (MUST) AC below 100% must fail the gate, not just warn"
    assert any("AC-006" in f for f in soft) and not any("AC-006" in f for f in hard), \
        "a soft (SHOULD) AC below threshold must warn only, never fail the gate"

    print("selftest OK")
    return True


# --- CLI ---------------------------------------------------------------------

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", choices=["claude", "codex"])
    p.add_argument("--arm", choices=["with", "without"])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--trials", type=int)
    p.add_argument("--out", type=Path)
    p.add_argument("--cases", type=Path, default=CASES_FILE)
    p.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--score", action="store_true", help="aggregate --out into a gate verdict; no host/arm/trials needed")
    p.add_argument("--selftest", action="store_true", help="run the pure-function self-check and exit; invokes no CLI")
    args = p.parse_args(argv)

    if args.selftest:
        return 0 if _selftest() else 1

    if args.score:
        if not args.out:
            p.error("--score requires --out <file>")
        rows = []
        with args.out.open("r", encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        report, ungraded = score(rows)
        hard, soft = gate(report)
        print_report(report, hard, soft, ungraded)
        return 1 if hard else 0

    if not args.host or not args.arm or args.trials is None:
        p.error("--host, --arm and --trials are required for a run (or use --score / --selftest)")
    if args.trials < 1:
        p.error("--trials must be >= 1")
    if not args.dry_run and not args.out:
        p.error("--out is required for a real run (--dry-run does not write one)")

    known_acs = load_ac_ids(SPEC_EN)
    cases = load_cases(args.cases, known_acs)

    if args.dry_run:
        existing = load_existing_keys(args.out) if args.out else set()
        return do_dry_run(cases, args.host, args.arm, args.model, args.trials, existing)
    return do_run(cases, args.host, args.arm, args.model, args.trials, args.out, args.timeout)


if __name__ == "__main__":
    sys.exit(main())
