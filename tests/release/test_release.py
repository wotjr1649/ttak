"""Offline checks for the release corpus and its functional oracles."""
import csv
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

from prepare import freeze, plan, source_records, verify_freeze
from collect import activation_prompts, activation_skills, command, parse, selected_plugins
from verify_project import verify

ROOT = Path(__file__).resolve().parent


def fixture():
    spec = importlib.util.spec_from_file_location("release_fixture", ROOT / "fixtures" / "project.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReleaseTests(unittest.TestCase):
    def test_only_the_relevant_original_plugin_is_loaded(self):
        with tempfile.TemporaryDirectory(prefix="plugins-test-", dir=ROOT) as temp:
            profile = Path(temp)
            roots = {name: f"plugins/{name}" for name in ["ponytail", "eli5", "i-have-adhd", "ttak"]}
            for relative in roots.values():
                (profile / relative).mkdir(parents=True)
            readiness = {"source_roots": roots, "plugin_roots": list(roots.values())}
            case = {"original": "eli5", "capability": "explanation"}
            self.assertEqual(selected_plugins(profile, readiness, case, "baseline"), [])
            actual = selected_plugins(profile, readiness, case, "original")
            self.assertEqual(actual, [(profile / "plugins/eli5").resolve()])
            args = command("claude", "claude-sonnet-5", "medium", plugin_roots=actual)
            self.assertEqual(args.count("--plugin-dir"), 1)
            self.assertIn(str(actual[0]), args)
            mixed = {"original": "all", "capability": "mixed"}
            self.assertEqual(len(selected_plugins(profile, readiness, mixed, "original")), 3)

    def test_explicit_only_original_is_activated_and_baseline_stays_unmodified(self):
        case = {"original": "i-have-adhd", "capability": "progress"}
        self.assertEqual(activation_skills(case, "baseline"), [])
        self.assertEqual(activation_prompts(case, "baseline", "claude", {}), [])
        with self.assertRaises(ValueError):
            activation_prompts(case, "original", "claude", {})
        readiness = {"skill_invocations": {"i-have-adhd": "i-have-adhd:i-have-adhd"}}
        self.assertTrue(activation_prompts(case, "original", "claude", readiness)[0].startswith(
            "/i-have-adhd:i-have-adhd "))
        self.assertTrue(activation_prompts(case, "original", "codex", readiness)[0].startswith(
            "$i-have-adhd:i-have-adhd "))
        readiness["skill_invocations"]["i-have-adhd"] = "unrelated-skill"
        with self.assertRaises(ValueError):
            activation_prompts(case, "original", "claude", readiness)
        mixed = {"original": "all", "capability": "mixed", "requires_review": True}
        self.assertEqual(set(activation_skills(mixed, "original")),
                         {"ponytail", "ponytail-review", "eli5", "i-have-adhd"})
        self.assertEqual(activation_skills(mixed, "ttak"), ["ttak-review", "ttak-explain"])
        progress = {"original": "all", "capability": "mixed"}
        self.assertEqual(activation_skills(progress, "original"), ["ponytail", "eli5", "i-have-adhd"])
        self.assertEqual(activation_skills(progress, "ttak"), ["ttak-explain"])

    def test_native_commands_preserve_controls_and_resume_the_observed_session(self):
        session = "00000000-0000-4000-8000-000000000001"
        for host, model, effort in [("claude", "claude-sonnet-5", "medium"),
                                    ("codex", "gpt-5.6-luna", "high")]:
            for identifier in [None, session]:
                args = command(host, model, effort, identifier)
                self.assertIn(model, args)
                self.assertFalse(any("bypass" in arg or "skip-permissions" in arg for arg in args))
                if identifier:
                    self.assertIn(identifier, args)
                if host == "claude":
                    self.assertIn("--effort", args)
                    self.assertIn("medium", args)
                    self.assertIn("Skill", args)
                else:
                    self.assertIn('model_reasoning_effort="high"', args)
                    self.assertIn("shell_tool", args)

    def test_capture_rejects_empty_failed_or_secret_bearing_results(self):
        with self.assertRaises(ValueError):
            parse("claude", json.dumps({"result": ""}))
        with self.assertRaises(ValueError):
            parse("claude", json.dumps({"is_error": True, "result": "error"}))
        with self.assertRaises(ValueError):
            parse("claude", json.dumps({"result": "Bearer " + "x" * 20}))
        self.assertEqual(parse("claude", json.dumps({"result": "done", "modelUsage": {
            "claude-sonnet-5": {}}, "usage": {"input_tokens": 3, "unrelated": "omit"}})),
            {"answer": "done", "session": None, "usage": {"input_tokens": 3},
             "observed_models": ["claude-sonnet-5"]})
        stream = '\n'.join(json.dumps(e) for e in [
            {"type": "item.completed", "item": {"type": "agent_message", "text": "done"}},
            {"type": "turn.completed", "usage": {"output_tokens": 2}}])
        self.assertEqual(parse("codex", stream)["answer"], "done")
        with self.assertRaises(ValueError):
            parse("codex", json.dumps({"type": "turn.failed"}))

    def test_comparisons_use_identical_tasks_and_requested_models(self):
        rows = plan()
        groups = {}
        for row in rows:
            groups.setdefault((row["host"], row["case"], row["trial"]), []).append(row)
            expected = ("claude-sonnet-5", "medium") if row["host"] == "claude" else ("gpt-5.6-luna", "high")
            self.assertEqual((row["model"], row["effort"]), expected)
        self.assertEqual(len(groups), 64)
        for group in groups.values():
            self.assertEqual({r["condition"] for r in group}, {"baseline", "original", "ttak"})
            self.assertEqual(len({r["turn_count"] for r in group}), 1)
            self.assertEqual(next(r for r in group if r["condition"] == "baseline")["instruction_sources"], [])
        self.assertEqual(len(source_records()), 7)

    def test_frozen_plan_cannot_be_overwritten_or_silently_relabelled(self):
        with tempfile.TemporaryDirectory(prefix="freeze-test-", dir=ROOT) as temp:
            destination = Path(temp) / "run"
            freeze(destination)
            verify_freeze(destination)
            with self.assertRaises(ValueError):
                freeze(destination)
            path = destination / "plan.json"
            rows = json.loads(path.read_text(encoding="utf-8"))
            rows[0]["model"] = "some-other-model"
            path.write_text(json.dumps(rows), encoding="utf-8")
            with self.assertRaises(ValueError):
                verify_freeze(destination)

    def test_coverage_is_complete_and_repeated(self):
        suite = json.loads((ROOT / "cases.json").read_text(encoding="utf-8"))
        cases = suite["cases"]
        self.assertEqual(len(cases), 16)
        self.assertEqual(len({c["id"] for c in cases}), 16)
        self.assertEqual({c["capability"] for c in cases},
                         {"development", "review", "explanation", "progress", "mixed"})
        self.assertEqual(suite["repetitions"], 2)
        self.assertEqual(len(cases) * 2 * len(suite["hosts"]) * len(suite["conditions"]), 192)
        for case in cases:
            self.assertTrue(case["hard"])
            self.assertTrue(case["quality"])
            self.assertTrue(all(isinstance(turn, str) and turn.strip() for turn in case["turns"]))
            if case["capability"] == "progress":
                self.assertGreater(len(case["turns"]), 1)
            if "fixture" in case:
                self.assertTrue((ROOT / "fixtures" / case["fixture"]).is_file())

    def test_oracles_reject_the_seeded_development_defects(self):
        module = fixture()
        for case in ["reuse", "csv", "retry"]:
            with self.subTest(case=case), self.assertRaises(AssertionError):
                verify(module, case, ROOT)

    def test_reuse_oracle_does_not_derive_expected_values_from_the_candidate(self):
        module = fixture()

        def lossy_normalize(name):
            value = " ".join(name.split()).lower()
            if not value:
                raise ValueError("empty name")
            return value

        module.normalize_name = lossy_normalize
        module.create_user = lambda name: {"name": module.normalize_name(name)}
        module.rename_user = lambda user, name: {**user, "name": module.normalize_name(name)}
        with self.assertRaises(AssertionError):
            verify(module, "reuse", ROOT)

    def test_oracles_accept_valid_independent_implementations(self):
        module = fixture()
        module.create_user = lambda name: {"name": module.normalize_name(name)}
        module.rename_user = lambda user, name: {**user, "name": module.normalize_name(name)}

        def export(rows):
            output = io.StringIO(newline="")
            writer = csv.writer(output)
            writer.writerow(["name", "note"])
            writer.writerows((row["name"], row["note"]) for row in rows)
            return output.getvalue()

        def retry(read, attempts):
            if attempts < 1:
                raise ValueError("attempts")
            for attempt in range(attempts):
                try:
                    return read()
                except OSError:
                    if attempt == attempts - 1:
                        raise

        module.export_csv = export
        module.retry_read = retry
        for case in ["reuse", "csv", "retry", "cleanup"]:
            with self.subTest(case=case):
                verify(module, case, ROOT)

    def test_cleanup_oracle_rejects_collapsed_preview_and_missing_containment(self):
        module = fixture()
        original = module.cleanup_plan

        def no_preview(root, candidates, *, confirmed=False):
            return original(root, candidates, confirmed=True)

        def no_containment(root, candidates, *, confirmed=False):
            paths = [str(Path(p).resolve()) for p in candidates]
            return {"preview": paths, "delete": paths if confirmed else []}

        for broken in [no_preview, no_containment]:
            module.cleanup_plan = broken
            with self.subTest(broken=broken.__name__), self.assertRaises(AssertionError):
                verify(module, "cleanup", ROOT)


if __name__ == "__main__":
    unittest.main()
