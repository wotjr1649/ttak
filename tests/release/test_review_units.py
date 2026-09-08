"""Adversarial checks for omission and fabricated evidence in review transport."""
import copy
import unittest

from review_units import MAX_CHARS, MAX_UNITS, parse_review, split_units, validate_review


class ReviewUnitTests(unittest.TestCase):
    def setUp(self):
        self.draft = "First claim.\n\nSecond claim."
        self.review = {"units": [
            {"id": "U001", "assessment": "no_issue_found", "issues": []},
            {"id": "U002", "assessment": "needs_review", "issues": [
                {"quote": "Second claim.", "kind": "not_established", "reason": "No source."}]}]}

    def test_offsets_preserve_unicode_crlf_and_code_content(self):
        draft = "\r\n한글 😀\r\nnext\r\n \t\r\n```python\r\nx = 1\r\n\r\ny = 2\r\n```"
        covered = [False] * len(draft)
        for unit in split_units(draft):
            self.assertEqual(draft[unit["start"]:unit["end"]], unit["text"])
            for index in range(unit["start"], unit["end"]):
                self.assertFalse(covered[index])
                covered[index] = True
        self.assertTrue(all(covered[i] or char.isspace() for i, char in enumerate(draft)))

    def test_identical_paragraphs_still_need_distinct_reviews(self):
        units = split_units("Same.\n\nSame.")
        self.assertEqual([u["id"] for u in units], ["U001", "U002"])
        with self.assertRaises(ValueError):
            validate_review("Same.\n\nSame.", {"units": [self.review["units"][0]]})

    def test_coverage_does_not_claim_factual_correctness(self):
        result = validate_review(self.draft, self.review)
        self.assertTrue(result["structural_coverage_valid"])
        self.assertEqual(result["flagged_units"], 1)
        self.assertFalse(result["factual_correctness_verified"])

    def test_missing_duplicate_and_unknown_ids_rejected(self):
        bad = [self.review["units"][:1], self.review["units"] + [self.review["units"][0]],
               [self.review["units"][0], self.review["units"][0]]]
        unknown = copy.deepcopy(self.review["units"])
        unknown[1]["id"] = "U999"
        bad.append(unknown)
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                validate_review(self.draft, {"units": rows})

    def test_quote_must_belong_to_the_assigned_unit(self):
        for quote in ("Invented claim.", "First claim.", " "):
            review = copy.deepcopy(self.review)
            review["units"][1]["issues"][0]["quote"] = quote
            with self.subTest(quote=quote), self.assertRaises(ValueError):
                validate_review(self.draft, review)

    def test_inconsistent_assessment_and_unexpected_fields_rejected(self):
        changes = [("assessment", "no_issue_found"), ("assessment", "passed"),
                   ("issues", []), ("extra", True), ("id", [])]
        for key, value in changes:
            review = copy.deepcopy(self.review)
            review["units"][1][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                validate_review(self.draft, review)

    def test_duplicate_json_keys_and_trailing_prose_rejected(self):
        for raw in ('{"units":[],"units":[]}', '{"units":[]} trailing',
                    '```json\n{"units":[]}\n```\nExtra prose'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_review(raw)
        self.assertEqual(parse_review('```json\n{"units":[]}\n```'), {"units": []})

    def test_limits_and_empty_inputs(self):
        for draft in ("", " \n\t", None, "x" * (MAX_CHARS + 1), "x\n\n" * (MAX_UNITS + 1)):
            with self.assertRaises(ValueError):
                split_units(draft)
        with self.assertRaises(ValueError):
            parse_review("x" * (MAX_CHARS + 1))


if __name__ == "__main__":
    unittest.main()
