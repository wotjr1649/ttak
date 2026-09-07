#!/usr/bin/env python3
"""Verify, from the host's own session transcript, what each trial was given.

    python verify_injection.py --in <run.jsonl> [--projects <dir>] [--codex-fixtures <dir>]

`run.py` records `policy_sha256`: which policy text a trial *pointed at*. That
is not the same claim as the host having injected it, and the runner is the
wrong place to assert it -- a runner that checks its own work reports its
intent, not the outcome. This reads the transcript the host wrote and compares
the bytes it actually attached.

For every `with`-arm row: exactly one `hook_additional_context` attachment,
and its content hashing to the row's `policy_sha256`. For every `without`-arm
row: no injection at all, which is the claim that makes the baseline a
baseline. Exit 1 if any row fails either way, or if a transcript is missing.

**No rate from a run is reportable before this passes.** A `with` arm that
silently failed to inject is indistinguishable, in the rows alone, from one
that injected and had no effect -- and those two produce the same number with
opposite meanings.

Transcripts are located by session id, which is a uuid and unique across
projects, rather than by re-deriving the host's directory-naming rule from the
trial's cwd. The rule is the host's business and it is not this tool's to
mirror; the cwd is recorded in the row for a reader who wants to look by hand.

The two hosts record it differently and neither is this tool's choice:

  claude  ~/.claude/projects/<per-cwd dir>/<session id>.jsonl, and the
          injection is an attachment of type `hook_additional_context`.
  codex   <CODEX_HOME>/sessions/<Y>/<M>/<D>/rollout-<ts>-<thread id>.jsonl,
          and the injection is an ordinary `response_item` string. Codex
          does not label it as hook output, so it is found by its first
          heading -- `# Precedence`, the first file of SCOPES.main. That is
          a narrower test than Claude's and it is stated rather than hidden:
          a policy whose first file changed name would read as absent here.
          Codex also writes nothing at all under `--ephemeral`, which is why
          `run.py` no longer passes it.

Standard library only. Invokes nothing.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

DEFAULT_PROJECTS = Path.home() / ".claude" / "projects"
ATTACHMENT_TYPE = "hook_additional_context"


def read_rows(path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{lineno}: invalid JSON ({e})") from e
    return rows


POLICY_FIRST_HEADING = "# Precedence"


def session_id(row):
    """The host's own id for the turn. Claude puts one JSON object on stdout;
    Codex streams JSONL and announces the thread in its first event."""
    stdout = row.get("stdout") or ""
    if row.get("host") == "codex":
        for line in stdout.splitlines():
            line = line.strip()
            if not line or "thread.started" not in line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("type") == "thread.started" and rec.get("thread_id"):
                return rec["thread_id"]
        return None
    try:
        return json.loads(stdout)["session_id"]
    except (ValueError, KeyError, TypeError):
        return None


def find_transcript(row, sid, projects, codex_fixtures):
    if row.get("host") == "codex":
        if codex_fixtures is None:
            return None
        return next(iter(sorted(Path(codex_fixtures).glob(f"*/sessions/**/*{sid}.jsonl"))), None)
    return next(iter(sorted(projects.glob(f"*/{sid}.jsonl"))), None)


def codex_injections(transcript):
    """Codex records the injected text as an ordinary response item, with no
    marker saying a hook produced it. Found by its first heading; see the
    module docstring for what that costs."""
    out = []
    seen = set()

    def walk(node):
        if isinstance(node, str):
            text = node.strip()
            if text.startswith(POLICY_FIRST_HEADING) and text not in seen:
                seen.add(text)
                data = text.encode("utf-8")
                out.append(("(codex response_item)", len(data),
                            hashlib.sha256(data).hexdigest()))
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    with transcript.open("r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or POLICY_FIRST_HEADING not in line:
                continue
            try:
                walk(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def injections(transcript):
    """Every hook-injected context attachment in the transcript, as
    (hook name, bytes, sha256)."""
    out = []
    with transcript.open("r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or ATTACHMENT_TYPE not in line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            att = rec.get("attachment")
            if not isinstance(att, dict) or att.get("type") != ATTACHMENT_TYPE:
                continue
            content = att.get("content")
            if isinstance(content, list):
                text = "".join(x for x in content if isinstance(x, str))
            elif isinstance(content, str):
                text = content
            else:
                continue
            data = text.encode("utf-8")
            out.append((att.get("hookName"), len(data), hashlib.sha256(data).hexdigest()))
    return out


def check_row(row, projects, codex_fixtures=None):
    sid = session_id(row)
    if sid is None:
        return False, "no session id in stdout"
    transcript = find_transcript(row, sid, projects, codex_fixtures)
    if transcript is None:
        where = codex_fixtures if row.get("host") == "codex" else projects
        if where is None:
            return False, "no --codex-fixtures given, so the rollout cannot be located"
        return False, f"no transcript for session {sid} under {where}"
    found = (codex_injections(transcript) if row.get("host") == "codex"
             else injections(transcript))
    expected = row.get("policy_sha256")

    if expected is None:
        if found:
            names = ", ".join(str(h) for h, _, _ in found)
            return False, f"baseline row carries {len(found)} injection(s) ({names})"
        return True, "no injection, as the baseline requires"

    if len(found) != 1:
        return False, f"expected exactly one injection, found {len(found)}"
    hook, nbytes, sha = found[0]
    if sha != expected:
        return False, (f"injected {nbytes} bytes sha256 {sha[:12]}..., "
                       f"but the row names {expected[:12]}...")
    return True, f"{nbytes} bytes, sha256 {sha[:12]}... matches, hook {hook}"


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--in", dest="in_path", type=Path, required=True, action="append",
                   help="a run file; repeat for several")
    p.add_argument("--projects", type=Path, default=DEFAULT_PROJECTS,
                   help="where Claude Code keeps its per-cwd transcript directories")
    p.add_argument("--codex-fixtures", type=Path, default=None,
                   help="the directory holding the two Codex homes, whose sessions/ trees "
                        "carry the rollouts")
    args = p.parse_args(argv)

    failures = 0
    total = 0
    try:
        for path in args.in_path:
            print(f"### {path.name}")
            for row in read_rows(path):
                total += 1
                ok, why = check_row(row, args.projects, args.codex_fixtures)
                failures += 0 if ok else 1
                print("  {arm:<7} trial={t:<3} policy={pol:<8} {mark} {why}".format(
                    arm=row.get("arm"), t=row.get("trial"),
                    pol=(row.get("policy_sha256") or "none")[:8],
                    mark="OK  " if ok else "FAIL", why=why))
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    print(f"\n{total - failures}/{total} row(s) verified against the host's own transcript")
    if failures:
        print("NOT VERIFIED -- no rate from these rows is reportable")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
