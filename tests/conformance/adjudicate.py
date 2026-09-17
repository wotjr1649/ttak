#!/usr/bin/env python3
"""Build the seven-row owner adjudication packet; never supply a verdict.

    python adjudicate.py --out <packet.md>
    python adjudicate.py --selftest

The fixed source revision preserves the wording both graders actually saw.
Current wording is identified separately. Responses are quoted data, not code
to execute. This utility runs only a bounded, read-only git show.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from blind_grade import read_rows, response_of, response_sha256
from run import CASES_FILE, ROOT

CASES_REVISION = "08df7a6"
ROWS = {
    "2026-09-07-claude-t1b-graded.jsonl": ("B29", "B32", "B04", "B11", "B24"),
    "2026-09-07-codex-t1-graded.jsonl": ("X22", "X13"),
}


def quoted(text):
    fence = "`" * max(4, 1 + max((len(m[0]) for m in re.finditer(r"`+", text)), default=0))
    return f"{fence}text\n{text}\n{fence}"


def build_packet():
    historical = subprocess.run(
        ["git", "show", f"{CASES_REVISION}:tests/conformance/cases.jsonl"],
        cwd=ROOT, capture_output=True, check=True, timeout=15).stdout
    cases = {c["id"]: c for c in map(json.loads, historical.decode("utf-8").splitlines())}
    current = {c["id"]: c for c in map(json.loads, CASES_FILE.read_text(encoding="utf-8").splitlines())}
    mapping = {}
    out = ["# Owner adjudication packet: seven unresolved rows", "",
           "This packet is not blind: it includes both recorded verdicts and the arm.",
           "The generator makes no adjudication. Record the owner's decision separately as",
           "`grade.adjudicated`; preserve `pass` and every historical grading field.", "",
           f"Historical cases: `{CASES_REVISION}`, SHA256 `{hashlib.sha256(historical).hexdigest()}`.",
           f"Current cases SHA256: `{hashlib.sha256(CASES_FILE.read_bytes()).hexdigest()}`.", "",
           "X16 is excluded because the owner settled that a deletion-scope count is sufficient.",
           "Its two original grader records remain unchanged; this is a criterion settlement,",
           "not a new blind verdict. Seven other rows still require the owner's judgement.", ""]
    for filename, rids in ROWS.items():
        rows = read_rows(CASES_FILE.parent / "runs" / filename)
        for rid in rids:
            found = [r for r in rows if r.get("grade", {}).get("rid") == rid]
            if len(found) != 1:
                raise ValueError(f"{filename}/{rid}: expected exactly one row")
            row = found[0]
            mapping[rid] = {"file": str((CASES_FILE.parent / "runs" / filename).resolve()),
                            "case": row["case"], "trial": row["trial"], "arm": row["arm"],
                            "policy_sha256": row.get("policy_sha256"),
                            "criteria_sha256": hashlib.sha256(historical).hexdigest(),
                            "response_sha256": response_sha256(row)}
            grade = row["grade"]
            second = grade["second_recheck"]
            if row["pass"] == second["pass"]:
                raise ValueError(f"{rid}: no longer a disagreement")
            case = cases[row["case"]]
            out.extend([f"## {rid} — `{row['case']}` ({case['ac']}), arm `{row['arm']}`", "",
                        f"Source: `runs/{filename}`, trial {row['trial']}.", "",
                        "### Criteria and forbidden outcomes seen by both graders", ""])
            for key in ("criteria", "forbidden"):
                out.extend([f"**{key}**", "", quoted(json.dumps(case[key], ensure_ascii=False, indent=2)), ""])
            if any(case[k] != current[row["case"]][k] for k in ("criteria", "forbidden")):
                out.extend(["Current wording differs; historical wording above remains the comparison basis.", ""])
            out.extend(["### Recorded readings", "",
                        quoted(json.dumps({"first": {"pass": row["pass"], "why": grade["why"]},
                                           "second_recheck": second}, ensure_ascii=False, indent=2)), "",
                        "### Full response (quoted data)", "", quoted(response_of(row) or "[no readable response]"), ""])
    return "\n".join(out), mapping


def render():
    return build_packet()[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--map", type=Path, help="new private mapping for --apply --field adjudicated")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if not (args.out or args.selftest):
        parser.error("--out or --selftest is required")
    packet, mapping = build_packet()
    if args.selftest:
        assert len(re.findall(r"^## [BX]\d+ —", packet, re.M)) == 7
        assert "## X16" not in packet
        assert "first" in packet and "second_recheck" in packet
        assert quoted("````\nquoted").startswith("`````text\n")
        assert set(mapping) == {rid for rids in ROWS.values() for rid in rids}
        assert all(len(m["response_sha256"]) == 64 for m in mapping.values())
        print("selftest OK: seven rows, historical criteria, no generated verdict")
    if args.out:
        with args.out.open("x", encoding="utf-8", newline="\n") as f:
            f.write(packet)
        print(f"wrote seven rows -> {args.out}")
    if args.map:
        with args.map.open("x", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote mapping -> {args.map}")


if __name__ == "__main__":
    main()
