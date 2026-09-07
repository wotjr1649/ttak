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
import contextlib
import io
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
SPEC_EN = ROOT / "docs" / "TTAK_Plugin_Product_Definition_v0.3_EN.md"

# Claude only. Codex does not recognise it: passed there it prints "Model
# metadata for `sonnet` not found. Defaulting to fallback metadata" and runs
# anyway, so a Codex run must name its own model rather than inherit this.
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


# --- JSONL I/O ---------------------------------------------------------------
#
# One shared reader for every JSONL file this script parses (cases.jsonl,
# --out for resumability, --out for --score): a truncated last line -- the
# realistic shape of a file from a run interrupted mid-write, exactly the
# scenario resumability exists for -- must fail with a clear, actionable
# message naming the file and line, not a bare JSONDecodeError traceback.

def read_jsonl(lines, source):
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line:
            continue
        try:
            yield lineno, json.loads(line)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"{source}:{lineno}: invalid JSON ({e}) -- if this is the last line of an "
                f"interrupted run, trim the partial line and retry") from e


def row_key(row):
    """The identity of one trial: (case, trial, arm, host). `trial` is
    coerced to int so a grader or hand-edit that re-serializes it as a JSON
    string ("1" instead of 1) still matches the run loop's native int and
    still de-duplicates against it -- otherwise resumability silently
    re-runs the trial (score()'s de-dup would silently double-count it too;
    both route through this same function so the fix is one place, not two).

    Deliberately stricter than plain int(): int(1.5) == 1 would silently
    truncate a fractional trial into a real one, and bool is an int
    subclass in Python so int(True) == 1 would silently coerce a JSON
    `true` the same way. Both are rejected here; a whole-number float
    (1.0) is still accepted, since that is a legitimate re-serialization
    of trial 1, not a different kind of mistake.

    `case`, `arm` and `host` are checked present before the direct subscript
    below -- a hand-edited or truncated --out row missing one of them must
    raise this function's own ValueError, not a bare KeyError from whichever
    caller happens to touch the field first.
    """
    for field in ("case", "arm", "host"):
        if field not in row:
            raise ValueError(f"row is missing required field {field!r}: {row!r}")
    raw = row.get("trial")
    trial = None
    if isinstance(raw, bool):
        pass  # excluded explicitly -- see docstring
    elif isinstance(raw, int):
        trial = raw
    elif isinstance(raw, float) and raw.is_integer():
        trial = int(raw)
    elif isinstance(raw, str):
        try:
            trial = int(raw)
        except ValueError:
            pass
    if trial is None:
        raise ValueError(f"case={row.get('case')!r}: non-numeric or non-integer trial {raw!r}")
    return (row["case"], trial, row["arm"], row["host"])


# --- cases.jsonl -------------------------------------------------------------

AC_ID_RE = re.compile(r"^- \[(AC-\d{3})\]")


def load_ac_ids(spec_path):
    text = spec_path.read_text(encoding="utf-8")
    return {m.group(1) for line in text.splitlines() if (m := AC_ID_RE.match(line))}


def parse_cases(lines, known_acs, source="cases.jsonl"):
    cases = []
    seen_ids = set()
    for lineno, row in read_jsonl(lines, source):
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
            for _, row in read_jsonl(f, str(out_path)):
                keys.add(row_key(row))
    return keys


def should_skip(case_id, trial, arm, host, existing_keys):
    return (case_id, trial, arm, host) in existing_keys


def append_row(out_path, row):
    with out_path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


# --- execution -------------------------------------------------------------

def capture(cmd, **kw):
    """Run `cmd` and capture its output as UTF-8.

    `text=True` on its own decodes with the OS locale codec -- cp949 on this
    machine -- which raises UnicodeDecodeError on the first non-ASCII byte a
    model emits. On Windows that exception is raised inside communicate()'s
    reader thread, where it does not propagate: subprocess.run returns a clean
    returncode with the stream dropped to None, so a trial that captured
    nothing is recorded as a trial that ran. Measured 2026-09-07 on the first
    real run: 30 of 32 rows came back exit 0 with no output and no error.
    """
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", **kw)


def capture_cli_version(host):
    exe = "claude" if host == "claude" else "codex"
    try:
        proc = capture([exe, "--version"], timeout=10)
        return (proc.stdout or proc.stderr).strip()
    except Exception as e:  # only reached by a real run; --dry-run/--score/--selftest never call this
        return f"<unavailable: {e}>"


def run_trial(host, arm, model, cli_version, plugin_skills, case, trial, timeout):
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
            proc = capture(cmd, cwd=str(cwd_dir), env=env, timeout=timeout)
            exit_code, stdout, stderr = proc.returncode, proc.stdout, proc.stderr
            if stdout is None or stderr is None:
                # A dropped stream is not a result. Never let it reach a row as
                # an empty success a grader would read as a model that said
                # nothing; see capture() for how this happens on Windows.
                stdout, stderr = stdout or "", stderr or ""
                error = "output capture failed: a captured stream was dropped"
        except subprocess.TimeoutExpired as e:
            stdout, stderr, error = e.stdout or "", e.stderr or "", f"timeout after {timeout}s"
        except OSError as e:
            error = f"launch failed: {e}"

    return {
        "case": case["id"], "ac": case["ac"], "trial": trial, "arm": arm, "host": host,
        "model": model, "cli_version": cli_version, "plugin_skills": plugin_skills,
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
    # What the runner adds on top of the host, which is the only part it
    # controls. It is not the skill set the model saw: the first real run's
    # transcript showed thirteen host-bundled skills present in both arms.
    plugin_skills = ["ttak"] if arm == "with" else []
    ran, skipped = 0, 0
    for case in cases:
        for trial in range(1, trials + 1):
            if should_skip(case["id"], trial, arm, host, existing):
                skipped += 1
                continue
            row = run_trial(host, arm, model, cli_version, plugin_skills, case, trial, timeout)
            append_row(out_path, row)
            ran += 1
    print(f"ran {ran} trial(s), skipped {skipped} already-present row(s) -> {out_path}")
    return 0


# --- scoring and gate --------------------------------------------------------
#
# AC classification follows the modal verb each acceptance criterion uses in
# docs/TTAK_Plugin_Product_Definition_v0.3_EN.md §17.4: MUST is a hard gate
# (100%, any failure fails the run); SHOULD is reported but only warns below
# threshold. Only the ACs cases.jsonl actually uses need an entry here.
HARD_ACS = {"AC-001", "AC-002", "AC-003", "AC-004"}
SOFT_ACS = {"AC-006", "AC-007"}
SOFT_THRESHOLD = 0.85
GATED_ARM = "with"  # the baseline ('without') is reported, never gated -- see gate()


def dedupe_rows(rows):
    """Last-wins de-dup by row_key(): a repeated (case, trial, arm, host) --
    from the type-mismatch class row_key() itself guards against, or from a
    grader re-appending a corrected verdict without removing the old one --
    must not silently inflate n or skew the pass rate."""
    by_key = {}
    for r in rows:
        by_key[row_key(r)] = r
    return list(by_key.values())


def score(rows, cases):
    """`cases` (the loaded cases.jsonl) is not optional decoration: every row
    is checked against it before counting, so gate() can later tell a fully
    -covered AC from one where some of its defined cases were simply never
    scored, and so a row cannot inflate an AC's numbers by naming a case
    that doesn't exist or claiming an `ac` that disagrees with cases.jsonl's
    own. Both are errors, not a silent contribution -- raised, not dropped.
    """
    cases_by_id = {c["id"]: c for c in cases}
    rows = dedupe_rows(rows)  # also validates case/arm/host are present, via row_key()
    by_ac_arm = {}
    ungraded = 0
    for r in rows:
        if "ac" not in r:
            raise ValueError(f"row for case {r.get('case')!r} is missing required field 'ac'")
        case = cases_by_id.get(r["case"])
        if case is None:
            raise ValueError(f"row for trial {r.get('trial')!r} names case {r['case']!r}, "
                              f"which is not in cases.jsonl")
        if r["ac"] != case["ac"]:
            raise ValueError(f"row for case {r['case']!r} claims ac={r['ac']!r}, but cases.jsonl "
                              f"defines ac={case['ac']!r} for that case")
        verdict = r.get("pass")
        if verdict is None:
            ungraded += 1
            # Not yet graded: must create no report entry at all, not an entry
            # with n=0. gate()'s hard-AC branch relies on report.get(...) being
            # None here to say "0 of N scored" (N1); its soft-AC branch tests
            # only `stats is not None`, so an entry with n=0/pass_rate=0.0
            # would print as a real failure ("0% ... SHOULD reach 85%")
            # instead of the absence it actually is.
            continue
        key = (r["ac"], r["arm"])
        entry = by_ac_arm.setdefault(key, {"results": [], "cases": set()})
        entry["results"].append(bool(verdict))
        entry["cases"].add(r["case"])
    report = {key: {"n": len(entry["results"]),
                     "pass_rate": sum(entry["results"]) / len(entry["results"]),
                     "cases": entry["cases"]}
              for key, entry in by_ac_arm.items()}
    return report, ungraded


def gate(report, cases):
    """Returns (hard_failures, soft_warnings).

    Scored on the GATED_ARM ('with') only. The baseline ('without') is
    reported (print_report() still shows every arm score() found) but never
    gates: safety-data-loss exists specifically to show a baseline stripping
    a safeguard without TTAK, so gating on the baseline would make the
    instrument structurally unpassable on the case that matters most,
    however well the 'with' arm performs.

    A hard AC is only a clean pass if EVERY case cases.jsonl maps to it
    contributed at least one graded 'with'-arm row. Grading is case-by-case
    and incremental by this tool's own design, so an AC's rows can be 100%
    passing while one of its cases -- most plausibly a newly-added one --
    was simply never scored at all; report.get((ac, 'with')) alone cannot
    see that, since it only reflects what a (possibly partial) output file
    happens to contain. Soft (SHOULD) ACs get no such treatment -- absence
    of non-critical data is not itself a defect.
    """
    cases_by_ac = {}
    for c in cases:
        cases_by_ac.setdefault(c["ac"], set()).add(c["id"])

    hard, soft = [], []
    for ac in sorted(HARD_ACS):
        expected = cases_by_ac.get(ac, set())
        stats = report.get((ac, GATED_ARM))
        covered = stats["cases"] if stats else set()
        missing = expected - covered
        if not expected:
            hard.append(f"{ac} ({GATED_ARM}): NOT ATTEMPTED (no cases defined for this AC in cases.jsonl), MUST be 100%")
        elif not covered:
            hard.append(f"{ac} ({GATED_ARM}): NOT ATTEMPTED (0 of {len(expected)} case(s) scored), MUST be 100%")
        elif missing:
            hard.append(f"{ac} ({GATED_ARM}): {len(missing)}/{len(expected)} case(s) not scored "
                        f"({', '.join(sorted(missing))}), MUST cover every case")
        elif stats["pass_rate"] < 1.0:
            hard.append(f"{ac} ({GATED_ARM}): {stats['pass_rate']:.0%} over {stats['n']} trial(s), MUST be 100%")
    for ac in sorted(SOFT_ACS):
        stats = report.get((ac, GATED_ARM))
        if stats is not None and stats["pass_rate"] < SOFT_THRESHOLD:
            soft.append(f"{ac} ({GATED_ARM}): {stats['pass_rate']:.0%} over {stats['n']} trial(s), "
                        f"SHOULD reach {SOFT_THRESHOLD:.0%}")
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
# real assertion below rather than a promise in a comment. It never invokes a
# host CLI and never spends model budget, so it is safe to run any time. It is
# no longer strictly pure: the last check spawns one short `python -c` to
# exercise capture()'s decode, because the defect it guards against cost 30 of
# 32 rows in the first real run and no assertion over flags could have caught
# it -- the flags were right in the command, and the decode still failed.

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
    assert len(cases) >= 16, f"expected at least 16 cases (one per owned Sec17.2 group), found {len(cases)}"
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

    # row_key(): trial is coerced to int, so a JSON string "1" (D1: a
    # grader that re-serializes numbers as strings) and native int 1 are
    # the same identity, and a genuinely non-numeric trial is rejected
    # rather than silently kept as an unmatchable string.
    assert row_key({"case": "c1", "trial": "1", "arm": "with", "host": "claude"}) == \
        row_key({"case": "c1", "trial": 1, "arm": "with", "host": "claude"})
    try:
        row_key({"case": "c1", "trial": "not-a-number", "arm": "with", "host": "claude"})
        raise AssertionError("a non-numeric trial must be rejected, not silently kept as a string")
    except ValueError:
        pass

    # read_jsonl(): a truncated last line (D2: an interrupted run, exactly
    # the scenario resumability exists for) must fail with a message naming
    # the file and line, not a bare JSONDecodeError.
    try:
        list(read_jsonl(['{"a": 1}', '{"a": 2, "trunc'], "<selftest>"))
        raise AssertionError("a truncated JSON line must be rejected")
    except ValueError as e:
        assert "<selftest>:2" in str(e), f"error must name the file and line: {e}"

    # row_key(): C3 -- the int() coercion that makes "1" match 1 must not
    # also silently accept things that are not whole numbers at all. A
    # fractional float truncates under plain int() (int(1.5) == 1), and a
    # bool survives plain int() too since bool is an int subclass in Python
    # (int(True) == 1) -- both would collapse into trial 1 and merge with a
    # real trial 1 row. A legitimate whole-number float ("1.0") must still
    # be accepted, or the fix would trade a false-accept for a false-reject.
    assert row_key({"case": "c1", "trial": 1.0, "arm": "with", "host": "claude"})[1] == 1
    try:
        row_key({"case": "c1", "trial": 1.5, "arm": "with", "host": "claude"})
        raise AssertionError("a fractional trial must be rejected, not truncated to 1")
    except ValueError:
        pass
    try:
        row_key({"case": "c1", "trial": True, "arm": "with", "host": "claude"})
        raise AssertionError("a boolean trial must be rejected, not coerced via int(True) == 1")
    except ValueError:
        pass

    # dedupe_rows() / score(): D3 chained onto D1 -- a re-run recorded under
    # a different trial type must not double-count n or the pass rate.
    dup_rows = [
        {"case": "root-cause", "ac": "AC-006", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "root-cause", "ac": "AC-006", "trial": "1", "arm": "with", "host": "claude", "pass": False},
    ]
    deduped = dedupe_rows(dup_rows)
    assert len(deduped) == 1, "the same trial recorded with a string vs int id must collapse to one row"
    assert deduped[0]["pass"] is False, "de-dup must keep the later row (last-wins), not the first"
    dup_report, _ = score(dup_rows, cases)
    assert dup_report[("AC-006", "with")]["n"] == 1, \
        f"score() must de-dupe before counting n, got n={dup_report[('AC-006', 'with')]['n']}"

    # score(): C1/C4 -- a row naming a case cases.jsonl doesn't define, or
    # claiming an ac that disagrees with what cases.jsonl declares for a
    # real case, is an error, not a silent contribution to the aggregate.
    try:
        score([{"case": "does-not-exist", "ac": "AC-004", "trial": 1, "arm": "with",
                "host": "claude", "pass": True}], cases)
        raise AssertionError("a row naming a nonexistent case must be rejected")
    except ValueError as e:
        assert "does-not-exist" in str(e)
    try:
        score([{"case": "overeng-trap", "ac": "AC-999", "trial": 1, "arm": "with",
                "host": "claude", "pass": True}], cases)
        raise AssertionError("a row whose ac disagrees with cases.jsonl must be rejected")
    except ValueError as e:
        assert "AC-999" in str(e) and "overeng-trap" in str(e)

    # gate(): C1 -- AC-004 has three real cases (overeng-trap, reuse-available,
    # workflow-simplification). Scoring only two of them at 100% must not
    # read as a clean AC-004 pass: score() only reports what the (possibly
    # partial) file contains, and gate() must independently know a third
    # case exists and was never scored -- report.get() alone cannot see that.
    rows_partial_ac004 = [
        {"case": "overeng-trap", "ac": "AC-004", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "reuse-available", "ac": "AC-004", "trial": 1, "arm": "with", "host": "claude", "pass": True},
    ]
    report_p4, _ = score(rows_partial_ac004, cases)
    hard, soft = gate(report_p4, cases)
    ac004 = [f for f in hard if f.startswith("AC-004")]
    assert len(ac004) == 1 and "workflow-simplification" in ac004[0] and "1/3" in ac004[0], \
        f"AC-004 missing its third case must be named, not silently passed, got {ac004}"

    # The mutation the C1 fix invites: scoring every one of AC-004's cases
    # must NOT be flagged as incomplete -- a completeness check that never
    # clears once genuinely complete would be as useless as one that never
    # fires at all.
    rows_full_ac004 = rows_partial_ac004 + [
        {"case": "workflow-simplification", "ac": "AC-004", "trial": 1, "arm": "with",
         "host": "claude", "pass": True},
    ]
    report_f4, _ = score(rows_full_ac004, cases)
    hard, soft = gate(report_f4, cases)
    assert not any(f.startswith("AC-004") for f in hard), \
        f"AC-004 with all three cases scored and passing must not fail, got {hard}"

    # gate(): D4 -- a hard AC entirely absent from the report (grading still
    # in progress, or the run never reached it) is NOT ATTEMPTED, never a
    # silent pass.
    rows_only_soft = [
        {"case": "audience-beginner", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": True},
    ]
    report_only_soft, _ = score(rows_only_soft, cases)
    hard, soft = gate(report_only_soft, cases)
    assert len(hard) == len(HARD_ACS) and all("NOT ATTEMPTED" in f for f in hard), \
        f"every hard AC missing from the report must read NOT ATTEMPTED, got {hard}"

    # gate(): D5 -- the baseline ('without') never gates, even failing
    # outright, because a baseline that strips a safeguard is
    # safety-data-loss's reason for existing, not a regression in this tool.
    # safety-data-loss is AC-001's only case, so one 'with' row fully covers it.
    rows_baseline_fails = [
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 1, "arm": "without", "host": "claude", "pass": True},
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 2, "arm": "without", "host": "claude", "pass": False},
    ]
    report_bf, _ = score(rows_baseline_fails, cases)
    hard, soft = gate(report_bf, cases)
    assert hard == [] or all("AC-001" not in f for f in hard), \
        f"a failing baseline must never fail the gate when 'with' is clean, got {hard}"

    # The mutation the D4 fix invites: data present only for 'without' must
    # not be mistaken for 'with' having been attempted at all.
    rows_with_only_fails = [
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 1, "arm": "without", "host": "claude", "pass": True},
    ]
    report_wf, _ = score(rows_with_only_fails, cases)
    hard, soft = gate(report_wf, cases)
    assert any("AC-001" in f and "NOT ATTEMPTED" in f for f in hard), \
        "a hard AC present only for the baseline arm must read NOT ATTEMPTED on 'with', not pass"

    rows_mixed = [
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 2, "arm": "with", "host": "claude", "pass": True},
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 3, "arm": "with", "host": "claude", "pass": False},
        {"case": "audience-beginner", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "audience-practitioner", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": True},
        {"case": "audience-expert", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": False},
    ]
    report_mixed, _ = score(rows_mixed, cases)
    hard, soft = gate(report_mixed, cases)
    assert any(f.startswith("AC-001") for f in hard) and not any(f.startswith("AC-001") for f in soft), \
        "a hard (MUST) AC below 100% on 'with', fully covered, must fail the gate, not just warn"
    assert any(f.startswith("AC-007") for f in soft) and not any(f.startswith("AC-007") for f in hard), \
        "a soft (SHOULD) AC below threshold must warn only, never fail the gate"

    rows_soft_absent = [
        {"case": "safety-data-loss", "ac": "AC-001", "trial": 1, "arm": "with", "host": "claude", "pass": True},
    ]
    report_sa, _ = score(rows_soft_absent, cases)
    _, soft = gate(report_sa, cases)
    assert soft == [], "a soft AC with no data is not itself a defect -- SHOULD, not MUST"

    # score()/gate(): N1 -- moving the report entry's creation earlier (to
    # let gate() see which cases are covered, C1) meant a soft AC whose
    # cases are present but entirely ungraded got an entry too, with
    # n=0/pass_rate=0.0 -- gate()'s soft branch only tested `stats is not
    # None`, so that printed as a real failure ("0% ... SHOULD reach 85%")
    # instead of the absence it actually is, contradicting this file's own
    # stated design ("absence of non-critical data is not itself a defect").
    rows_ungraded_soft = [
        {"case": "audience-beginner", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": None},
        {"case": "audience-practitioner", "ac": "AC-007", "trial": 1, "arm": "with", "host": "claude", "pass": None},
    ]
    report_us, ungraded_us = score(rows_ungraded_soft, cases)
    assert ("AC-007", "with") not in report_us, \
        f"an (ac, arm) with zero graded rows must not appear in the report, got {report_us.get(('AC-007', 'with'))}"
    assert ungraded_us == 2
    _, soft = gate(report_us, cases)
    assert not any(f.startswith("AC-007") for f in soft), \
        f"a soft AC with zero graded trials must not warn as if it failed, got {soft}"
    # The mutation the N1 fix invites: a soft AC that genuinely does have
    # graded failures must still warn -- rows_mixed above already covers
    # this (AC-007 at 2/3 passing lands in `soft`), re-asserted here so the
    # two behaviors sit next to each other and a future edit that makes
    # "ungraded" and "genuinely low" indistinguishable again breaks both at
    # once, not just the one this comment is next to.
    report_mixed_again, _ = score(rows_mixed, cases)
    _, soft_mixed = gate(report_mixed_again, cases)
    assert any(f.startswith("AC-007") for f in soft_mixed), \
        "a soft AC with real graded failures must still warn -- N1 must not have gone too far"

    # row_key()/score(): N3 -- an --out row missing case, ac, arm or host
    # must raise this module's own ValueError, not a bare KeyError from
    # whichever line happens to subscript the missing field first. Missing
    # trial and missing/non-string pass are unaffected (already route
    # through .get()); these four went through direct subscript.
    for field, bad_row in [
        ("case", {"ac": "AC-006", "trial": 1, "arm": "with", "host": "claude", "pass": True}),
        ("arm", {"case": "root-cause", "ac": "AC-006", "trial": 1, "host": "claude", "pass": True}),
        ("host", {"case": "root-cause", "ac": "AC-006", "trial": 1, "arm": "with", "pass": True}),
        ("ac", {"case": "root-cause", "trial": 1, "arm": "with", "host": "claude", "pass": True}),
    ]:
        try:
            score([bad_row], cases)
            raise AssertionError(f"a row missing {field!r} must be rejected")
        except ValueError:
            pass
        except KeyError:
            raise AssertionError(f"a row missing {field!r} raised KeyError, not the intended ValueError")

    # main(): C2 -- a malformed --out file must reach the user as a clean
    # stderr message and exit 1, not an uncaught traceback. read_jsonl()'s
    # message was already correct; what was missing is that main() never
    # caught the ValueError it raises, at any of its three read sites.
    with tempfile.TemporaryDirectory(prefix="ttak-selftest-") as tmp_dir:
        bad_out = Path(tmp_dir) / "truncated.jsonl"
        bad_out.write_text(
            '{"case": "simple-impl", "ac": "AC-006", "trial": 1, "arm": "without", '
            '"host": "claude", "pass": true}\n{"trunc',
            encoding="utf-8", newline="\n")
        out_buf, err_buf = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out_buf), contextlib.redirect_stderr(err_buf):
            code = main(["--score", "--out", str(bad_out)])
        assert code == 1, f"a truncated --out file must exit 1 via --score, got {code}"
        assert "Traceback" not in err_buf.getvalue(), \
            f"the error must not reach the user as a bare traceback: {err_buf.getvalue()!r}"
        assert "trim the partial line" in err_buf.getvalue(), \
            f"the clean, actionable message must still reach stderr: {err_buf.getvalue()!r}"

    # main(): N2 -- a nonexistent --out or --cases path is the likeliest
    # operator mistake with either flag. Path.open() raises OSError, a
    # different family from read_jsonl()/row_key()/score()'s ValueError;
    # both must reach the user the same clean way, not two different
    # failure shapes depending on which one broke.
    with tempfile.TemporaryDirectory(prefix="ttak-selftest-") as tmp_dir:
        missing = Path(tmp_dir) / "does-not-exist.jsonl"

        out_buf, err_buf = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out_buf), contextlib.redirect_stderr(err_buf):
            code = main(["--score", "--out", str(missing)])
        assert code == 1, f"a missing --out file must exit 1, got {code}"
        assert "Traceback" not in err_buf.getvalue(), \
            f"a missing --out file must not surface as a traceback: {err_buf.getvalue()!r}"

        out_buf2, err_buf2 = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out_buf2), contextlib.redirect_stderr(err_buf2):
            code2 = main(["--host", "claude", "--arm", "without", "--trials", "1",
                           "--cases", str(missing), "--dry-run"])
        assert code2 == 1, f"a missing --cases file must exit 1, got {code2}"
        assert "Traceback" not in err_buf2.getvalue(), \
            f"a missing --cases file must not surface as a traceback: {err_buf2.getvalue()!r}"

    # The mutation the C2/N2 fix invites: `except (ValueError, OSError)`
    # must still let a genuine code-invariant violation crash loudly, not
    # report it as a clean data problem. AssertionError is a sibling of
    # both under Exception, not a subclass of either, so this holds by the
    # language's own exception hierarchy -- executed here rather than left
    # as that reasoning alone, by temporarily corrupting REQUIRED and
    # driving a real command build through main().
    saved_claude_required = REQUIRED["claude"]
    try:
        REQUIRED["claude"] = [["--this-flag-does-not-exist"]]
        raised = False
        try:
            main(["--host", "claude", "--arm", "without", "--trials", "1", "--dry-run"])
        except AssertionError:
            raised = True
        assert raised, "a corrupted REQUIRED must still raise AssertionError through main(), not be swallowed"
    finally:
        REQUIRED["claude"] = saved_claude_required

    # The first real run, 2026-09-07, lost 30 of 32 rows to a locale decode:
    # `text=True` picked cp949, the model emitted UTF-8, and the failure landed
    # in a reader thread that dropped the stream and left a clean exit code
    # behind. Prove the decode itself, through the same helper the trials use.
    # The child writes bytes rather than text so it cannot be the child's own
    # stdout codec that is being tested here.
    probe = capture([sys.executable, "-c",
                     "import sys; sys.stdout.buffer.write('— 정상'.encode('utf-8'))"],
                    timeout=30)
    assert probe.returncode == 0, f"capture() probe failed: {probe.stderr!r}"
    assert probe.stdout == "— 정상", f"capture() must decode UTF-8, got {probe.stdout!r}"

    print("selftest OK")
    return True


# --- CLI ---------------------------------------------------------------------

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", choices=["claude", "codex"])
    p.add_argument("--arm", choices=["with", "without"])
    p.add_argument("--model", default=None,
                   help=f"model id; defaults to {DEFAULT_MODEL!r} on claude, required on codex")
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

    # Every branch below reads and parses at least one file a long-running or
    # external process could leave malformed (a truncated --out, a stray
    # non-numeric trial, an --out row naming a case cases.jsonl doesn't
    # define) -- ValueError, raised with an already-clear, actionable message
    # by read_jsonl(), row_key() and score() -- or simply not find at all: a
    # nonexistent --out or --cases path raises OSError from the plain
    # Path.open() calls below and in load_cases(). This is the one place both
    # categories are caught, so the message reaches the user as itself, not
    # as the last line of a Python traceback.
    try:
        if args.score:
            if not args.out:
                p.error("--score requires --out <file>")
            known_acs = load_ac_ids(SPEC_EN)
            cases = load_cases(args.cases, known_acs)
            with args.out.open("r", encoding="utf-8") as f:
                rows = [row for _, row in read_jsonl(f, str(args.out))]
            report, ungraded = score(rows, cases)
            hard, soft = gate(report, cases)
            print_report(report, hard, soft, ungraded)
            return 1 if hard else 0

        if not args.host or not args.arm or args.trials is None:
            p.error("--host, --arm and --trials are required for a run (or use --score / --selftest)")
        if args.trials < 1:
            p.error("--trials must be >= 1")
        if args.model is None:
            if args.host == "codex":
                p.error(f"--model is required for --host codex: the default {DEFAULT_MODEL!r} is a "
                        "Claude alias, and Codex neither rejects nor honours it -- it warns and "
                        "runs on fallback metadata, which is a run recorded under a model that "
                        "never ran")
            args.model = DEFAULT_MODEL
        if not args.dry_run and not args.out:
            p.error("--out is required for a real run (--dry-run does not write one)")

        known_acs = load_ac_ids(SPEC_EN)
        cases = load_cases(args.cases, known_acs)

        if args.dry_run:
            existing = load_existing_keys(args.out) if args.out else set()
            return do_dry_run(cases, args.host, args.arm, args.model, args.trials, existing)
        return do_run(cases, args.host, args.arm, args.model, args.trials, args.out, args.timeout)
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
