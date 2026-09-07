#!/usr/bin/env python3
"""Verify, from the host's own session transcript, what each trial was given.

    python verify_injection.py --in <run.jsonl> [--projects <dir>]

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


def session_id(row):
    try:
        return json.loads(row.get("stdout") or "")["session_id"]
    except (ValueError, KeyError, TypeError):
        return None


def find_transcript(projects, sid):
    return next(iter(sorted(projects.glob(f"*/{sid}.jsonl"))), None)


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


def check_row(row, projects):
    sid = session_id(row)
    if sid is None:
        return False, "no session_id in stdout"
    transcript = find_transcript(projects, sid)
    if transcript is None:
        return False, f"no transcript for session {sid} under {projects}"
    found = injections(transcript)
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
    p.add_argument("--projects", type=Path, default=DEFAULT_PROJECTS)
    args = p.parse_args(argv)

    failures = 0
    total = 0
    try:
        for path in args.in_path:
            print(f"### {path.name}")
            for row in read_rows(path):
                total += 1
                ok, why = check_row(row, args.projects)
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
