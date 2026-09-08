"""Adversarial checks for omission and fabricated evidence in review transport."""
import copy
import unittest

from review_units import (MAX_CHARS, MAX_UNITS, apply_patches, parse_review, split_units,
                          validate_assigned_review, validate_review)


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

    def test_assigned_review_retains_identity_and_only_partial_coverage(self):
        row = copy.deepcopy(self.review["units"][1])
        result = validate_assigned_review(self.draft, "U002", row)
        self.assertEqual(row, self.review["units"][1])
        self.assertEqual(result["unit_id"], "U002")
        self.assertTrue(result["assigned_unit_valid"])
        self.assertTrue(result["flagged"])
        self.assertFalse(result["whole_draft_coverage_valid"])
        self.assertFalse(result["factual_correctness_verified"])
        with self.assertRaises(ValueError):
            validate_review(self.draft, {"units": [row]})

    def test_assigned_review_rejects_other_worker_and_other_unit_quote(self):
        row = copy.deepcopy(self.review["units"][1])
        for identifier in ("U001", "U999", []):
            with self.subTest(identifier=identifier), self.assertRaises(ValueError):
                validate_assigned_review(self.draft, identifier, row)
        row["issues"][0]["quote"] = "First claim."
        with self.assertRaises(ValueError):
            validate_assigned_review(self.draft, "U002", row)

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

    def correction(self):
        review = copy.deepcopy(self.review)
        review["units"][1]["issues"][0]["kind"] = "contradicted"
        patch = {"unit_id": "U002", "quote": "Second claim.", "replacement": "Corrected claim."}
        return review, patch

    def test_patch_preserves_every_other_character(self):
        draft = "  First claim.\r\n\r\nSecond claim.\r\n"
        review, patch = self.correction()
        result = apply_patches(draft, review, [patch])
        self.assertEqual(result["text"], "  First claim.\r\n\r\nCorrected claim.\r\n")
        self.assertEqual(result["patch_count"], 1)
        self.assertFalse(result["factual_correctness_verified"])

    def test_unknown_claim_is_retained_not_silently_corrected(self):
        _, patch = self.correction()
        with self.assertRaises(ValueError):
            apply_patches(self.draft, self.review, [patch])
        result = apply_patches(self.draft, self.review, [])
        self.assertEqual(result["text"], self.draft)
        self.assertEqual(result["unresolved_issues"], 1)

    def test_error_patch_cannot_overwrite_an_overlapping_unknown_claim(self):
        review, patch = self.correction()
        review["units"][1]["issues"].append(
            {"quote": "Second", "kind": "not_established", "reason": "Still unresolved."})
        with self.assertRaises(ValueError):
            apply_patches(self.draft, review, [patch])

    def test_missing_duplicate_and_unreviewed_patches_rejected(self):
        review, patch = self.correction()
        wrong = {**patch, "unit_id": "U001", "quote": "First claim."}
        for patches in ([], [patch, patch], [wrong], [{**patch, "quote": []}]):
            with self.subTest(patches=patches), self.assertRaises(ValueError):
                apply_patches(self.draft, review, patches)

    def test_repeated_quote_requires_a_more_precise_location(self):
        review, patch = self.correction()
        with self.assertRaises(ValueError):
            apply_patches("First claim.\n\nSecond claim. Second claim.", review, [patch])

    def test_overlapping_error_quotes_rejected(self):
        review, patch = self.correction()
        review["units"][1]["issues"].append(
            {"quote": "claim.", "kind": "internal_inconsistency", "reason": "Overlaps."})
        patches = [patch, {"unit_id": "U002", "quote": "claim.", "replacement": "statement."}]
        with self.assertRaises(ValueError):
            apply_patches(self.draft, review, patches)

    def test_replacements_cannot_be_empty_unchanged_or_oversized(self):
        review, patch = self.correction()
        for replacement in ("", " ", patch["quote"], "x" * MAX_CHARS):
            with self.subTest(size=len(replacement)), self.assertRaises(ValueError):
                apply_patches(self.draft, review, [{**patch, "replacement": replacement}])

    def test_out_of_order_patches_use_original_offsets(self):
        review, second = self.correction()
        review["units"][0] = {"id": "U001", "assessment": "needs_review", "issues": [
            {"quote": "First", "kind": "contradicted", "reason": "Correct this word."}]}
        first = {"unit_id": "U001", "quote": "First", "replacement": "A much longer initial"}
        result = apply_patches(self.draft, review, [second, first])
        self.assertEqual(result["text"], "A much longer initial claim.\n\nCorrected claim.")

    def test_incomplete_review_cannot_authorize_a_patch(self):
        review, patch = self.correction()
        review["units"].pop(0)
        with self.assertRaises(ValueError):
            apply_patches(self.draft, review, [patch])


if __name__ == "__main__":
    unittest.main()
