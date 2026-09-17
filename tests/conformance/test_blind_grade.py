"""Local, synthetic tests for preserving historical grading records."""
import contextlib
import copy
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from blind_grade import apply_verdicts, build, read_rows


class GradingHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ttak-grade-", dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.src = self.root / "rows.jsonl"
        self.packet = self.root / "packet.md"
        self.mapping = self.root / "map.json"
        self.verdicts = self.root / "verdicts.json"
        self.row = {"case": "safety-data-loss", "trial": 1, "arm": "with",
                    "host": "claude", "stdout": json.dumps({"result": "synthetic response"}),
                    "exit_code": 0, "pass": True,
                    "grade": {"rid": "OLD01", "why": "original", "checker": {"verdict": "FAIL"},
                              "held_out": "original hold", "held_out_resolved": "original resolution",
                              "second_recheck": {"pass": False}}}
        self.write(self.src, self.row, jsonl=True)
        with contextlib.redirect_stdout(io.StringIO()):
            build([self.src], 42, self.packet, self.mapping, "T")
        self.write(self.verdicts, {"T01": {"pass": False, "why": "new criterion"}})

    def write(self, path, data, jsonl=False):
        path.write_text(json.dumps(data) + ("\n" if jsonl else ""), encoding="utf-8", newline="\n")

    def apply(self, field="third", suffix=""):
        with contextlib.redirect_stdout(io.StringIO()):
            return apply_verdicts(self.mapping, self.verdicts, suffix, field)

    def test_new_layer_preserves_every_historical_field(self):
        self.apply()
        row = read_rows(self.src)[0]
        layer = row["grade"].pop("third")
        self.assertEqual(row, self.row)
        self.assertIs(layer["pass"], False)
        self.assertEqual(len(layer["criteria_sha256"]), 64)
        self.assertEqual(len(layer["response_sha256"]), 64)
        self.assertNotIn(b"\r", self.src.read_bytes())

    def test_duplicate_layer_cannot_overwrite(self):
        self.apply()
        before = self.src.read_bytes()
        with self.assertRaises(ValueError):
            self.apply()
        self.assertEqual(self.src.read_bytes(), before)

    def test_bad_verdicts_do_not_write(self):
        before = self.src.read_bytes()
        for verdict in ({}, {"T01": {"pass": 1, "why": "integer"}},
                        {"T01": {"pass": False}}, {"T01": {"pass": False, "why": ""}},
                        {"T99": {"pass": False, "why": "extra"}}):
            with self.subTest(verdict=verdict):
                self.write(self.verdicts, verdict)
                with self.assertRaises(ValueError):
                    self.apply()
                self.assertEqual(self.src.read_bytes(), before)

    def test_response_or_identity_changed(self):
        for key, value in (("stdout", '{"result":"changed"}'), ("trial", 2)):
            row = copy.deepcopy(self.row)
            row[key] = value
            self.write(self.src, row, jsonl=True)
            before = self.src.read_bytes()
            with self.assertRaises(ValueError):
                self.apply()
            self.assertEqual(self.src.read_bytes(), before)

    def test_later_file_error_does_not_write_first_file(self):
        second = self.root / "second.jsonl"
        self.write(second, self.row, jsonl=True)
        with contextlib.redirect_stdout(io.StringIO()):
            build([self.src, second], 42, self.packet, self.mapping, "T")
        mapping = json.loads(self.mapping.read_text())
        self.write(self.verdicts, {rid: {"pass": False, "why": "new"} for rid in mapping})
        last = Path(list(mapping.values())[-1]["file"])
        first = Path(list(mapping.values())[0]["file"])
        before = first.read_bytes()
        row = copy.deepcopy(self.row)
        row["grade"]["third"] = {"pass": True}
        self.write(last, row, jsonl=True)
        with self.assertRaises(ValueError):
            self.apply()
        self.assertEqual(first.read_bytes(), before)

    def test_default_first_pass_is_compatible(self):
        self.apply(field=None, suffix="-graded")
        row = read_rows(self.root / "rows-graded.jsonl")[0]
        self.assertIs(row["pass"], False)
        self.assertEqual(row["grade"]["rid"], "T01")
        self.assertEqual(read_rows(self.src)[0], self.row)

    def test_packet_excludes_mapping_and_verdicts(self):
        packet = self.packet.read_text(encoding="utf-8")
        self.assertIn("synthetic response", packet)
        self.assertIn("Reporting the number of files", packet)
        for value in ("OLD01", "original resolution", "policy_sha256", str(self.src)):
            self.assertNotIn(value, packet)

    def test_protected_fields_and_existing_destination(self):
        with self.assertRaises(ValueError):
            self.apply(field="checker")
        out = self.root / "rows-graded.jsonl"
        out.write_text("preserve", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.apply(suffix="-graded")
        self.assertEqual(out.read_text(), "preserve")

    def provenance(self):
        data = {"host": "synthetic-host", "model": "synthetic-model", "session_id": "synthetic-session",
                "model_evidence": "test fixture", "blindness_review": "not an actual grading run",
                "packet_sha256": hashlib.sha256(self.packet.read_bytes()).hexdigest(),
                "verdicts_sha256": hashlib.sha256(self.verdicts.read_bytes()).hexdigest(),
                "startup_review_sha256": "0" * 64}
        path = self.root / "provenance.json"
        self.write(path, data)
        return path, data

    def test_fourth_preserves_third_and_attaches_provenance(self):
        self.apply()
        before = read_rows(self.src)[0]
        path, data = self.provenance()
        with contextlib.redirect_stdout(io.StringIO()):
            apply_verdicts(self.mapping, self.verdicts, "", "fourth", path)
        row = read_rows(self.src)[0]
        layer = row["grade"].pop("fourth")
        self.assertEqual(row, before)
        self.assertEqual(layer["provenance"], data)
        persisted = self.src.read_bytes()
        with self.assertRaises(ValueError):
            self.apply(field="fourth")
        self.assertEqual(self.src.read_bytes(), persisted)

    def test_provenance_rejects_changed_verdicts_and_unknown_fields(self):
        path, data = self.provenance()
        before = self.src.read_bytes()
        for bad in (dict(data, verdicts_sha256="0" * 64), dict(data, extra="not allowed"),
                    dict(data, packet_sha256="invalid"), dict(data, model="")):
            self.write(path, bad)
            with self.assertRaises(ValueError):
                apply_verdicts(self.mapping, self.verdicts, "", "third", path)
            self.assertEqual(self.src.read_bytes(), before)

    def test_provenance_cannot_be_silently_ignored_in_first_pass(self):
        path, _ = self.provenance()
        before = self.src.read_bytes()
        with self.assertRaises(ValueError):
            apply_verdicts(self.mapping, self.verdicts, "", None, path)
        self.assertEqual(self.src.read_bytes(), before)


def run_tests():
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GradingHistoryTests)
    return unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful()


if __name__ == "__main__":
    raise SystemExit(0 if run_tests() else 1)
