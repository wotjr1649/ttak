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


def validate_assigned_review(draft, unit_id, review):
    """Validate a single worker's assigned unit without granting whole-draft coverage."""
    units = {unit["id"]: unit for unit in split_units(draft)}
    if not isinstance(unit_id, str) or unit_id not in units:
        raise ValueError("unknown assigned unit")
    if not isinstance(review, dict) or review.get("id") != unit_id:
        raise ValueError("review does not match its assigned unit")
    # The existing validator numbers a standalone paragraph U001. Check the original
    # identity first, then normalize only this internal copy; retain all other checks.
    validate_review(units[unit_id]["text"], {"units": [{**review, "id": "U001"}]})
    return {"unit_id": unit_id, "assigned_unit_valid": True,
            "flagged": review["assessment"] == "needs_review",
            "whole_draft_coverage_valid": False, "factual_correctness_verified": False}


def apply_patches(draft, review, patches):
    """Replace only uniquely located, reviewed error quotes; preserve all other text.

    Unestablished claims are not automatically false and cannot be patched here.
    Replacement truth still needs independent verification.
    """
    validate_review(draft, review)
    units = {unit["id"]: unit for unit in split_units(draft)}
    eligible = {}
    protected = []
    unresolved = 0
    for row in review["units"]:
        unit = units[row["id"]]
        for issue in row["issues"]:
            if issue["kind"] == "not_established":
                unresolved += 1
                quote = issue["quote"]
                if unit["text"].find(quote, unit["text"].index(quote) + 1) < 0:
                    start = unit["start"] + unit["text"].index(quote)
                    protected.append((start, start + len(quote)))
                else:
                    protected.append((unit["start"], unit["end"]))
                continue
            quote = issue["quote"]
            key = (row["id"], quote)
            if key in eligible or unit["text"].find(quote, unit["text"].index(quote) + 1) >= 0:
                raise ValueError("ambiguous reviewed error location")
            start = unit["start"] + unit["text"].index(quote)
            eligible[key] = (start, start + len(quote))
    spans = sorted(eligible.values())
    if any(left[1] > right[0] for left, right in zip(spans, spans[1:])):
        raise ValueError("overlapping reviewed errors")
    if any(start < stop and begin < end for start, end in spans for begin, stop in protected):
        raise ValueError("patch overlaps an unresolved claim")
    if not isinstance(patches, list) or len(patches) != len(eligible):
        raise ValueError("incomplete patch coverage")
    seen = set()
    edits = []
    result_size = len(draft)
    for patch in patches:
        if not isinstance(patch, dict) or set(patch) != {"unit_id", "quote", "replacement"}:
            raise ValueError("invalid patch fields")
        if not all(isinstance(value, str) for value in patch.values()):
            raise ValueError("patch values must be text")
        key = (patch["unit_id"], patch["quote"])
        if key not in eligible or key in seen:
            raise ValueError("duplicate or unreviewed patch")
        seen.add(key)
        replacement = patch["replacement"]
        if not replacement.strip() or replacement == patch["quote"]:
            raise ValueError("patch must provide a nonempty changed replacement")
        start, end = eligible[key]
        result_size += len(replacement) - (end - start)
        edits.append((start, end, replacement))
    if result_size > MAX_CHARS:
        raise ValueError("corrected draft exceeds size limit")
    parts = []
    cursor = 0
    for start, end, replacement in sorted(edits):
        parts.extend((draft[cursor:start], replacement))
        cursor = end
    parts.append(draft[cursor:])
    return {"text": "".join(parts), "patch_count": len(edits),
            "unresolved_issues": unresolved, "factual_correctness_verified": False}
