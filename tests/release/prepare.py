"""Prepare and freeze release comparisons offline; never invoke a model or execute a response.

Usage: python prepare.py --check
       python prepare.py --freeze <new task-local directory>
"""
import argparse
import hashlib
import json
from pathlib import Path
import random

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCES = HERE / "sources"
SUITE = HERE / "cases.json"
POLICY = ["policy/precedence.md", "policy/invariants.md", "policy/contract.md"]
SKILLS = ["skills/ttak-review/SKILL.md", "skills/ttak-explain/SKILL.md"]
ORIGINAL = {
    "ponytail": ["ponytail/skills/ponytail/skill-source.md"],
    "ponytail-review": ["ponytail/skills/ponytail-review/skill-source.md"],
    "eli5": ["eli5/skills/eli5/skill-source.md"],
    "i-have-adhd": ["i-have-adhd/skills/i-have-adhd/skill-source.md"],
}
ORIGINAL["all"] = [path for paths in ORIGINAL.values() for path in paths]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def protocol():
    text = (ROOT / "docs/RELEASE.md").read_text(encoding="utf-8")
    marker = "## Agreed outcome\n"
    if text.count(marker) != 1:
        raise ValueError("release protocol needs exactly one agreed-outcome section")
    return marker + text.split(marker, 1)[1]


def source_records():
    records = json.loads((SOURCES / "manifest.json").read_text(encoding="utf-8"))
    for record in records:
        path = (SOURCES / record["path"]).resolve(strict=True)
        if not path.is_relative_to(SOURCES.resolve()):
            raise ValueError("source path escaped the vendored directory")
        raw = path.read_bytes()
        if len(raw) != record["bytes"] or sha(raw) != record["sha256"]:
            raise ValueError(f"source bytes changed: {record['path']}")
    return records


def load_suite():
    suite = json.loads(SUITE.read_text(encoding="utf-8"))
    if suite["schema_version"] != 1 or suite["repetitions"] != 2:
        raise ValueError("unexpected release protocol")
    expected_hosts = {"claude": {"model": "claude-sonnet-5", "effort": "medium"},
                      "codex": {"model": "gpt-5.6-luna", "effort": "high"}}
    if suite["hosts"] != expected_hosts or suite["conditions"] != ["baseline", "original", "ttak"]:
        raise ValueError("host or comparison conditions differ from the agreed scope")
    cases = suite["cases"]
    if len(cases) != 16 or len({c["id"] for c in cases}) != 16:
        raise ValueError("expected sixteen unique scenarios")
    for case in cases:
        if case["original"] not in ORIGINAL or not case["hard"] or not case["quality"]:
            raise ValueError(f"incomplete case: {case['id']}")
        if not case["turns"] or not all(isinstance(t, str) and t.strip() for t in case["turns"]):
            raise ValueError(f"missing conversation: {case['id']}")
    source_records()
    return suite


def inputs(case, condition):
    if condition == "baseline":
        return []
    if condition == "original":
        return [SOURCES / rel for rel in ORIGINAL[case["original"]]]
    if condition == "ttak":
        return [ROOT / rel for rel in POLICY + SKILLS]
    raise ValueError(f"unknown condition: {condition}")


def activation_skills(case, condition):
    if condition == "baseline":
        return []
    if condition == "original":
        if case["original"] != "all":
            return [case["original"]]
        names = ["ponytail", "eli5", "i-have-adhd"]
        if case.get("requires_review", False):
            names.insert(1, "ponytail-review")
        return names
    if condition == "ttak":
        if case["capability"] == "mixed":
            return (["ttak-review"] if case.get("requires_review", False) else []) + ["ttak-explain"]
        return {"review": ["ttak-review"], "explanation": ["ttak-explain"]}.get(case["capability"], [])
    raise ValueError("unknown comparison condition")


def plan():
    suite = load_suite()
    rows = []
    for trial in range(1, suite["repetitions"] + 1):
        for case in suite["cases"]:
            for host, model in suite["hosts"].items():
                for condition in suite["conditions"]:
                    rows.append({"id": f"{host}.{case['id']}.{condition}.{trial}",
                                 "case": case["id"], "capability": case["capability"],
                                 "host": host, **model, "condition": condition, "trial": trial,
                                 "turn_count": len(case["turns"]),
                                 "activation_skills": activation_skills(case, condition),
                                 "instruction_sources": [
                                     {"path": p.relative_to(ROOT).as_posix(),
                                      "sha256": sha(p.read_bytes())} for p in inputs(case, condition)]})
    random.Random(20260908).shuffle(rows)
    return rows


def freeze(destination):
    destination = destination.resolve()
    if not destination.is_relative_to(ROOT.resolve()) or destination == ROOT.resolve():
        raise ValueError("freeze destination must be a new directory inside this worktree")
    if destination.exists():
        raise ValueError("freeze destination already exists; never overwrite an experiment")
    suite = load_suite()
    rows = plan()
    files = [SUITE, HERE / "fixtures/project.py", HERE / "verify_project.py", HERE / "prepare.py", HERE / "collect.py",
             SOURCES / "manifest.json"]
    files += [ROOT / p for p in POLICY + SKILLS]
    files += [SOURCES / r["path"] for r in source_records()]
    records = [{"path": p.relative_to(ROOT).as_posix(), "sha256": sha(p.read_bytes())} for p in files]
    protocol_text = protocol()
    manifest = {"schema_version": 1, "planned_trials": len(rows), "files": records,
                "protocol_sha256": sha(protocol_text.encode("utf-8")),
                "status": "prepared; no subject trials executed",
                "qualification": "Native host delivery, actual model/effort, subscription-only execution, "
                                 "functional checks and blind grading remain required. A prompt-text "
                                 "simulation alone does not qualify this plugin for release."}
    destination.mkdir(parents=True)
    with (destination / "protocol.md").open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(protocol_text)
    for name, value in [("manifest.json", manifest), ("plan.json", rows), ("cases.json", suite)]:
        with (destination / name).open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    print(f"Prepared {len(rows)} trials; manifest {sha((destination / 'manifest.json').read_bytes())}")


def verify_freeze(destination):
    manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
    protocol_text = (destination / "protocol.md").read_text(encoding="utf-8")
    if sha(protocol_text.encode("utf-8")) != manifest["protocol_sha256"] or protocol_text != protocol():
        raise ValueError("frozen release protocol changed")
    for record in manifest["files"]:
        path = (ROOT / record["path"]).resolve(strict=True)
        if not path.is_relative_to(ROOT.resolve()) or sha(path.read_bytes()) != record["sha256"]:
            raise ValueError(f"frozen input changed: {record['path']}")
    rows = json.loads((destination / "plan.json").read_text(encoding="utf-8"))
    if rows != plan():
        raise ValueError("frozen run plan does not match the verified inputs")
    if json.loads((destination / "cases.json").read_text(encoding="utf-8")) != load_suite():
        raise ValueError("frozen cases differ")
    print(f"Verified {len(rows)} planned trials; no execution or release claim")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--freeze", type=Path)
    mode.add_argument("--verify-freeze", type=Path)
    args = parser.parse_args()
    if args.check:
        rows = plan()
        print(f"OK: 16 scenarios, {len(rows)} trials, pinned sources and two requested model settings")
    elif args.freeze:
        freeze(args.freeze)
    else:
        verify_freeze(args.verify_freeze)


if __name__ == "__main__":
    main()
