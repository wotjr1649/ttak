"""Offline review coverage checks, not a factual verifier or installed plugin workflow.

Untrusted text/JSON stays data. No code execution, file access or network access.
Offsets address the original Python string, including its original line endings.
"""
import json

MAX_CHARS = 100_000
MAX_UNITS = 512


def split_units(draft):
    if not isinstance(draft, str) or not draft.strip() or len(draft) > MAX_CHARS:
        raise ValueError("draft must be nonempty text within the size limit")
    units = []
    start = None
    offset = 0

    def append(end):
        if len(units) >= MAX_UNITS:
            raise ValueError("draft exceeds the unit limit")
        units.append({"id": f"U{len(units) + 1:03d}", "start": start,
                      "end": end, "text": draft[start:end]})

    for line in draft.splitlines(keepends=True):
        if line.strip():
            if start is None:
                start = offset
        elif start is not None:
            append(offset)
            start = None
        offset += len(line)
    if start is not None:
        append(offset)
    return units


def _unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def parse_review(raw):
    if not isinstance(raw, str) or len(raw) > MAX_CHARS:
        raise ValueError("review must be text within the size limit")
    payload = raw.strip()
    if payload.startswith("```json\n") and payload.endswith("\n```"):
        payload = payload[len("```json\n"):-len("\n```")]
    return json.loads(payload, object_pairs_hook=_unique_keys)


def validate_review(draft, review):
    """Require every unit once and ground issue quotes in that exact unit.

    Successful validation proves structural coverage only. A model can still miss
    a contradiction within a reviewed unit or misinterpret the supplied evidence.
    """
    expected = {unit["id"]: unit for unit in split_units(draft)}
    if not isinstance(review, dict) or set(review) != {"units"}:
        raise ValueError("review needs exactly the units field")
    rows = review["units"]
    if not isinstance(rows, list) or len(rows) != len(expected):
        raise ValueError("incomplete review coverage")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"id", "assessment", "issues"}:
            raise ValueError("invalid review unit fields")
        identifier = row["id"]
        if not isinstance(identifier, str) or identifier not in expected or identifier in seen:
            raise ValueError("duplicate or unknown review unit")
        seen.add(identifier)
        assessment = row["assessment"]
        issues = row["issues"]
        if assessment not in ("no_issue_found", "needs_review") or not isinstance(issues, list):
            raise ValueError("invalid assessment")
        if bool(issues) != (assessment == "needs_review"):
            raise ValueError("assessment and issues disagree")
        for issue in issues:
            if not isinstance(issue, dict) or set(issue) != {"quote", "kind", "reason"}:
                raise ValueError("invalid issue fields")
            if issue["kind"] not in ("contradicted", "not_established", "internal_inconsistency"):
                raise ValueError("invalid issue kind")
            if not all(isinstance(issue[key], str) and issue[key].strip()
                       for key in ("quote", "reason")):
                raise ValueError("issue needs a quote and reason")
            if issue["quote"] not in expected[identifier]["text"]:
                raise ValueError("issue quote does not occur in its unit")
    if seen != set(expected):
        raise ValueError("incomplete review coverage")
    return {"unit_count": len(expected), "structural_coverage_valid": True,
            "flagged_units": sum(row["assessment"] == "needs_review" for row in rows),
            "factual_correctness_verified": False}
