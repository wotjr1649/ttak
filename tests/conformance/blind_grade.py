#!/usr/bin/env python3
"""Build a condition-blind grading packet, then apply the verdicts back.

    python blind_grade.py --build --seed N --packet <md> --map <json> --in <run.jsonl> ...
    python blind_grade.py --apply --map <json> --verdicts <json> --suffix -graded
    python blind_grade.py --apply --map <json> --verdicts <json> --field third --suffix ""
    python blind_grade.py --selftest

The judge must not know which condition produced a response. `--build`
shuffles every row of every input file together under a recorded seed, gives
each an opaque id, and writes a packet carrying the case, its `criteria` and
`forbidden` lists, and the response text -- and nothing else. Not the arm, not
the policy hash, not the constructed command, which names the variant
directory in plain text.

`--apply` reads the verdicts back, opens the mapping, and writes each input
file beside itself with `grade.rid`, `grade.why` and `pass` filled in, so a
later reader can disagree with a specific row rather than with a number.

With --field third, fourth or adjudicated, only that new grade field is written.
Existing layers cannot be overwritten. The packet mapping pins the criteria
and response hashes; pass, rid, why and held-out history stay unchanged.
--provenance attaches reviewed model/session information and artifact hashes
to that layer. It records the manager's evidence, not a new isolation test.

The default first-pass mode also prints every place the human verdict and `check_guards.py` disagree.
**Those rows are held out of their condition's number until re-read.** A
disagreement log that cannot act is decoration.

Standard library only. Invokes nothing.
"""
import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import load_ac_ids, load_cases, CASES_FILE, SPEC_EN, ROOT, response_text  # noqa: E402


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


def response_sha256(row):
    return hashlib.sha256(json.dumps(response_of(row), ensure_ascii=False).encode("utf-8")).hexdigest()


def build(in_paths, seed, packet_path, map_path, prefix="R", only_ungraded=False):
    cases = {c["id"]: c for c in load_cases(CASES_FILE, load_ac_ids(SPEC_EN))}
    criteria_sha = hashlib.sha256(CASES_FILE.read_bytes()).hexdigest()
    items = []
    for path in in_paths:
        for row in read_rows(path):
            # Re-grading includes historical rows unless explicitly filtered;
            # a new judge must receive only the packet, never this mapping.
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
                        "arm": row.get("arm"), "policy_sha256": row.get("policy_sha256"),
                        "criteria_sha256": criteria_sha, "response_sha256": response_sha256(row)}
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


def load_provenance(path, verdicts_path):
    data = json.loads(path.read_text(encoding="utf-8"))
    required = {"host", "model", "session_id", "model_evidence", "blindness_review",
                "packet_sha256", "verdicts_sha256", "startup_review_sha256"}
    if not isinstance(data, dict) or not required <= data.keys() or data.keys() - required - {"protocol_deviation"}:
        raise ValueError("provenance must contain the required evidence fields and no unknown fields")
    if any(not isinstance(v, str) or not v.strip() or len(v) > 4000 for v in data.values()):
        raise ValueError("provenance values must be nonempty bounded strings")
    for key in ("packet_sha256", "verdicts_sha256", "startup_review_sha256"):
        if len(data[key]) != 64 or any(c not in "0123456789abcdef" for c in data[key]):
            raise ValueError(f"invalid provenance {key}")
    if data["verdicts_sha256"] != hashlib.sha256(verdicts_path.read_bytes()).hexdigest():
        raise ValueError("verdicts changed since provenance review")
    return data


def apply_verdicts(map_path, verdicts_path, suffix, field=None, provenance_path=None):
    if field not in (None, "third", "fourth", "adjudicated"):
        raise ValueError("--field must be third, fourth or adjudicated; historical fields are protected")
    if provenance_path is not None and field is None:
        raise ValueError("--provenance requires a separate --field")
    provenance = load_provenance(provenance_path, verdicts_path) if provenance_path is not None else None
    if any(c in suffix for c in ("/", "\\")):
        raise ValueError("--suffix must be a filename suffix, not a path")
    mapping = json.loads(map_path.read_text(encoding="utf-8"))
    verdicts = json.loads(verdicts_path.read_text(encoding="utf-8"))

    missing = sorted(set(mapping) - set(verdicts))
    if missing:
        raise ValueError(f"no verdict recorded for {len(missing)} row(s): {missing[:8]}")
    extra = sorted(set(verdicts) - set(mapping))
    if extra:
        raise ValueError(f"verdicts name rows the mapping does not: {extra[:8]}")
    for rid, v in verdicts.items():
        if not isinstance(v, dict) or "pass" not in v or (v["pass"] is not None and type(v["pass"]) is not bool):
            raise ValueError(f"{rid}: pass must be true, false or null")
        if not isinstance(v.get("why"), str) or not v["why"].strip():
            raise ValueError(f"{rid}: a nonempty why is required")

    by_file = {}
    for rid, m in mapping.items():
        keys = by_file.setdefault(m["file"], {})
        key = (m["case"], m["trial"], m["arm"], m.get("policy_sha256"))
        if key in keys:
            raise ValueError("mapping repeats a source row")
        keys[key] = rid

    disagreements = []
    written = []
    prepared = []
    for src, keys in by_file.items():
        src = Path(src)
        if field is not None and not src.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError("layer application requires a source inside this project")
        rows = read_rows(src)
        seen = set()
        for row in rows:
            # A file can hold rows this round did not grade -- an earlier round
            # already gave them a verdict, and --only-ungraded left them out of
            # the packet. Those rows are passed over, not re-written.
            rid = keys.get((row.get("case"), row.get("trial"), row.get("arm"), row.get("policy_sha256")))
            if rid is None:
                continue
            if rid in seen:
                raise ValueError(f"{rid}: source repeats a mapped row")
            seen.add(rid)
            v = verdicts[rid]
            grade = row.setdefault("grade", {})
            if field is not None:
                if field in grade:
                    raise ValueError(f"{rid}: grade.{field} already exists; refusing to overwrite it")
                meta = mapping[rid]
                if not meta.get("criteria_sha256") or meta.get("response_sha256") != response_sha256(row):
                    raise ValueError(f"{rid}: missing provenance or response changed since packet build")
                grade[field] = {"rid": rid, "pass": v["pass"], "why": v["why"],
                                "criteria_sha256": meta["criteria_sha256"],
                                "response_sha256": meta["response_sha256"]}
                if provenance is not None:
                    grade[field]["provenance"] = provenance
                continue
            row["pass"] = v["pass"]
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
        if seen != set(keys.values()):
            raise ValueError(f"{src.name}: mapped rows are missing from source")
        if field is not None and out_path != src and out_path.exists():
            raise ValueError(f"{out_path.name}: output already exists")
        prepared.append((out_path, rows))
    # Validate the complete batch before the first write, including later files.
    destinations = [p.resolve() for p, _ in prepared]
    if len(set(destinations)) != len(destinations):
        raise ValueError("output paths collide")
    for out_path, rows in prepared:
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
    elif field is None:
        print("\nno checker/judge disagreement")
    else:
        print(f"recorded grade.{field}; historical verdicts and held-out state preserved")
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
    p.add_argument("--field", choices=("third", "fourth", "adjudicated"),
                   help="write only this new grade field; preserve pass and all historical grading state")
    p.add_argument("--provenance", type=Path,
                   help="reviewed model/session and artifact-hash JSON, only with --apply --field")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--rid-prefix", default="R",
                   help="letter the opaque ids start with; each grading round needs its own "
                        "so two rounds' ids cannot collide in a row's history")
    p.add_argument("--only-ungraded", action="store_true",
                   help="skip rows that already carry a verdict")
    args = p.parse_args(argv)

    try:
        if args.provenance and (not (args.apply and args.field) or args.build or args.selftest):
            p.error("--provenance requires --apply --field and cannot be used with --build")
        if args.selftest:
            from test_blind_grade import run_tests
            return 0 if run_tests() else 1
        if args.build:
            if not (args.in_paths and args.seed is not None and args.packet and args.map_path):
                p.error("--build needs --in (repeatable), --seed, --packet and --map")
            return build(args.in_paths, args.seed, args.packet, args.map_path,
                         args.rid_prefix, args.only_ungraded)
        if args.apply:
            if not (args.map_path and args.verdicts):
                p.error("--apply needs --map and --verdicts")
            return apply_verdicts(args.map_path, args.verdicts, args.suffix, args.field, args.provenance)
        p.error("choose --build or --apply")
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
