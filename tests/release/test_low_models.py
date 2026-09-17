"""Low-model command isolation and unchanged comparison coverage; no native calls."""
import unittest
from pathlib import Path

import low_models
import prepare


class LowModelsTest(unittest.TestCase):
    def test_haiku_has_fixed_thinking_without_unsupported_effort(self):
        args = low_models.command("claude")
        self.assertNotIn("--effort", args)
        self.assertNotIn(None, args)
        self.assertEqual(args[args.index("--model") + 1], "claude-haiku-4-5-20251001")
        self.assertEqual(args[args.index("--settings") + 1], '{"alwaysThinkingEnabled":true}')
        self.assertEqual(args[args.index("--tools") + 1], "Skill")
        self.assertIn("--strict-mcp-config", args)
        self.assertNotIn("--fallback-model", args)

    def test_parent_model_billing_and_thinking_settings_do_not_leak(self):
        parent = {"PATH": "test-path", "ANTHROPIC_API_KEY": "synthetic-api-value",
                  "ANTHROPIC_BASE_URL": "https://invalid.example", "OPENAI_API_KEY": "synthetic",
                  "CLAUDE_CODE_EFFORT_LEVEL": "max", "MAX_THINKING_TOKENS": "99999",
                  "CLAUDE_CODE_OAUTH_TOKEN": "synthetic-native-value"}
        env = low_models.native_environment("claude", Path("synthetic-profile"), parent)
        self.assertEqual(env["MAX_THINKING_TOKENS"], "8192")
        self.assertEqual(env["ANTHROPIC_DEFAULT_HAIKU_MODEL"], "claude-haiku-4-5-20251001")
        self.assertEqual(env["CLAUDE_CODE_OAUTH_TOKEN"], parent["CLAUDE_CODE_OAUTH_TOKEN"])
        for key in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_EFFORT_LEVEL"):
            self.assertNotIn(key, env)
        codex = low_models.native_environment("codex", Path("synthetic-profile"), parent)
        self.assertNotIn("CLAUDE_CODE_OAUTH_TOKEN", codex)
        self.assertNotIn("MAX_THINKING_TOKENS", codex)

    def test_luna_keeps_high_and_native_restrictions(self):
        args = low_models.command("codex")
        self.assertIn('model_reasoning_effort="high"', args)
        self.assertEqual(args[args.index("--sandbox") + 1], "read-only")
        self.assertIn('web_search="disabled"', args)
        self.assertIn("shell_tool", args)

    def test_resume_requires_actual_uuid(self):
        for host in low_models.HOSTS:
            with self.subTest(host=host), self.assertRaises(ValueError):
                low_models.command(host, session="not-a-native-session")

    def test_historical_plan_is_not_mutated_and_all_tasks_survive(self):
        historical = prepare.plan()
        rows = low_models.plan()
        self.assertEqual(historical, prepare.plan())
        self.assertEqual(len(rows), 192)
        self.assertEqual(len({r["id"] for r in rows}), 192)
        for old, new in zip(historical, rows):
            for key in ("case", "capability", "condition", "trial", "turn_count",
                        "activation_skills", "instruction_sources"):
                self.assertEqual(old[key], new[key])
            self.assertNotEqual(old["id"], new["id"])
        self.assertEqual(low_models.budget(rows), {
            "subject_and_activation": {"baseline": 88, "original": 172, "ttak": 128},
            "grading": 128, "total": 516})

    def test_unknown_host_and_mutable_return_cannot_change_pin(self):
        with self.assertRaises(ValueError):
            low_models.settings("opus")
        selected = low_models.settings("claude")
        selected["model"] = "claude-sonnet-5"
        self.assertEqual(low_models.settings("claude")["model"], "claude-haiku-4-5-20251001")


if __name__ == "__main__":
    unittest.main()
