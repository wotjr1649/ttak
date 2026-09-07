#!/usr/bin/env python3
"""Build a condition-blind grading packet, then apply the verdicts back.

    python blind_grade.py --build --seed N --packet <md> --map <json> --in <run.jsonl> ...
    python blind_grade.py --apply --map <json> --verdicts <json> --suffix -graded

The judge must not know which condition produced a response. `--build`
shuffles every row of every input file together under a recorded seed, gives
each an opaque id, and writes a packet carrying the case, its `criteria` and
`forbidden` lists, and the response text -- and nothing else. Not the arm, not
the policy hash, not the constructed command, which names the variant
directory in plain text.

`--apply` reads the verdicts back, opens the mapping, and writes each input
file beside itself with `grade.rid`, `grade.why` and `pass` filled in, so a
later reader can disagree with a specific row rather than with a number.

It also prints every place the human verdict and `check_guards.py` disagree.
**Those rows are held out of their condition's number until re-read.** A
disagreement log that cannot act is decoration.

Standard library only. Invokes nothing.
"""
import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import load_ac_ids, load_cases, CASES_FILE, SPEC_EN, response_text  # noqa: E402


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


def response_of(row):
    # One reader for both hosts, in run.py, because check_guards.py and
    # second_grade.py need the same answer and a second copy would drift.
    return response_text(row)


def build(in_paths, seed, packet_path, map_path, prefix="R", only_ungraded=False):
    cases = {c["id"]: c for c in load_cases(CASES_FILE, load_ac_ids(SPEC_EN))}
    items = []
    for path in in_paths:
        for row in read_rows(path):
            # A row already carrying a verdict is not re-graded. The first pass
            # stands, and re-reading it now -- after the conditions are known --
            # would not be a blind pass anyway.
            if only_ungraded and row.get("pass") is not None:
                continue
            items.append((str(path), row))
    if not items:
        raise ValueError("no rows to grade: every row in --in already carries a verdict")

    rng = random.Random(seed)
    rng.shuffle(items)

    mapping = {}
    out = [f"# Blind grading packet, seed {seed}, {len(items)} rows\n",
           "Grade each row against its case's criteria and forbidden list. "
           "Record a verdict and a one-line reason for every row before anything else is opened.\n"]
    seen_cases = []
    for i, (src, row) in enumerate(items, 1):
        rid = f"{prefix}{i:02d}"
        mapping[rid] = {"file": src, "case": row.get("case"), "trial": row.get("trial"),
                        "arm": row.get("arm"), "policy_sha256": row.get("policy_sha256")}
        case = cases.get(row.get("case"), {})
        if row.get("case") not in seen_cases:
            seen_cases.append(row.get("case"))
            out.append(f"\n## Case `{row.get('case')}` ({case.get('ac')})\n")
            for k in ("criteria", "forbidden"):
                out.append(f"**{k}**\n")
                for item in case.get(k, []):
                    out.append(f"- {item}")
                out.append("")
        text = response_of(row)
        out.append(f"\n---\n\n### {rid}  (case `{row.get('case')}`)\n")
        if text is None:
            out.append("*(no parseable response; this row cannot be graded)*")
        else:
            out.append("````\n" + text.strip() + "\n````")

    packet_path.write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    map_path.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8", newline="\n")
    print(f"{len(items)} row(s) -> {packet_path}")
    print(f"mapping -> {map_path}  (do not open it until every verdict is recorded)")
    return 0


def apply_verdicts(map_path, verdicts_path, suffix):
    mapping = json.loads(map_path.read_text(encoding="utf-8"))
    verdicts = json.loads(verdicts_path.read_text(encoding="utf-8"))

    missing = sorted(set(mapping) - set(verdicts))
    if missing:
        raise ValueError(f"no verdict recorded for {len(missing)} row(s): {missing[:8]}")
    extra = sorted(set(verdicts) - set(mapping))
    if extra:
        raise ValueError(f"verdicts name rows the mapping does not: {extra[:8]}")

    by_file = {}
    for rid, m in mapping.items():
        by_file.setdefault(m["file"], {})[(m["case"], m["trial"], m["arm"])] = rid

    disagreements = []
    written = []
    for src, keys in by_file.items():
        src = Path(src)
        rows = read_rows(src)
        for row in rows:
            # A file can hold rows this round did not grade -- an earlier round
            # already gave them a verdict, and --only-ungraded left them out of
            # the packet. Those rows are passed over, not re-written.
            rid = keys.get((row.get("case"), row.get("trial"), row.get("arm")))
            if rid is None:
                continue
            v = verdicts[rid]
            if v.get("pass") not in (True, False, None):
                raise ValueError(f"{rid}: pass must be true, false or null, got {v.get('pass')!r}")
            row["pass"] = v["pass"]
            grade = row.setdefault("grade", {})
            grade["rid"] = rid
            grade["why"] = v["why"]
            # checker2 is the repaired screener; checker is the pre-2026-09-08
            # verdict kept as the evidence for its two containment defects.
            checker = (grade.get("checker2") or grade.get("checker") or {}).get("verdict")
            if checker in ("PASS", "FAIL") and v["pass"] is not None:
                if (checker == "PASS") != v["pass"]:
                    grade["held_out"] = "checker/judge disagreement, not counted until re-read"
                    disagreements.append((rid, src.name, checker, v["pass"], v["why"]))
                else:
                    grade.pop("held_out", None)
        out_path = src.with_name(src.stem + suffix + src.suffix)
        with out_path.open("w", encoding="utf-8", newline="\n") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        written.append(out_path)

    for path in written:
        print(f"wrote {path}")
    if disagreements:
        print(f"\n{len(disagreements)} checker/judge disagreement(s), held out of the counts:")
        for rid, name, checker, verdict, why in disagreements:
            print(f"  {rid} {name}: checker={checker} judge={'pass' if verdict else 'fail'} -- {why}")
    else:
        print("\nno checker/judge disagreement")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--build", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--in", dest="in_paths", type=Path, action="append", default=[])
    p.add_argument("--seed", type=int)
    p.add_argument("--packet", type=Path)
    p.add_argument("--map", dest="map_path", type=Path)
    p.add_argument("--verdicts", type=Path)
    p.add_argument("--suffix", default="-graded")
    p.add_argument("--rid-prefix", default="R",
                   help="letter the opaque ids start with; each grading round needs its own "
                        "so two rounds' ids cannot collide in a row's history")
    p.add_argument("--only-ungraded", action="store_true",
                   help="skip rows that already carry a verdict")
    args = p.parse_args(argv)

    try:
        if args.build:
            if not (args.in_paths and args.seed is not None and args.packet and args.map_path):
                p.error("--build needs --in (repeatable), --seed, --packet and --map")
            return build(args.in_paths, args.seed, args.packet, args.map_path,
                         args.rid_prefix, args.only_ungraded)
        if args.apply:
            if not (args.map_path and args.verdicts):
                p.error("--apply needs --map and --verdicts")
            return apply_verdicts(args.map_path, args.verdicts, args.suffix)
        p.error("choose --build or --apply")
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
