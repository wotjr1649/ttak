"""Actual offline freezes with corrupted copies; no model or profile activity."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import low_study


class LowStudyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='low-study-test-', dir=low_study.ROOT / '.superpowers')
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.cleanup)
        self.destination = self.root / 'run'

    def cleanup(self):
        assert self.root.is_relative_to((low_study.ROOT / '.superpowers').resolve())
        self.temp.cleanup()

    def test_freeze_preserves_complete_comparison_and_new_model_protocol(self):
        manifest = low_study.freeze(self.destination)
        self.assertEqual(low_study.verify_freeze(self.destination), manifest)
        self.assertEqual(manifest['planned_trials'], 192)
        self.assertEqual(manifest['budget']['total'], 516)
        text = (self.destination / 'protocol.md').read_text(encoding='utf-8')
        self.assertNotIn('claude-sonnet-5', text)
        self.assertIn('claude-haiku-4-5-20251001', text)
        self.assertIn('실질적 개선', text)
        self.assertFalse(manifest['qualification'])
        self.assertTrue(manifest['experimental_review_integrated'])
        self.assertTrue(manifest['normal_plugin_collector_ready'])
        self.assertTrue(manifest['scenario_feedback_bundled'])

    def test_bundled_feedback_tampering_cannot_reuse_a_frozen_candidate(self):
        manifest = low_study.freeze(self.destination)
        paths = {record['path'] for record in manifest['files']}
        for relative in ['.claude-plugin/mcp.json', '.codex-plugin/plugin.json',
                         'hooks/scenario-stop.cjs', 'scripts/scenario-draft.cjs',
                         'scripts/scenario-feedback-mcp.cjs', 'scripts/finite-scenario.cjs',
                         'scripts/explanation-request-source.cjs', 'scripts/explanation-result-source.cjs', 'scripts/explanation-source-model.cjs', 'scripts/explanation-review-checks.cjs',
                         'scripts/finite-scenario-render.cjs', 'scripts/finite-scenario-mcp.cjs',
                         'scripts/review-mcp.cjs', 'scripts/review-session.cjs', 'scripts/review-repair.cjs']:
            self.assertIn(relative, paths)
            target = self.destination / 'inputs' / relative
            before = target.read_bytes()
            target.write_bytes(before + b'\nchanged candidate')
            with self.assertRaises(ValueError):
                low_study.verify_freeze(self.destination)
            target.write_bytes(before)

    def test_existing_or_outside_destination_is_refused(self):
        low_study.freeze(self.destination)
        with self.assertRaises(ValueError):
            low_study.freeze(self.destination)
        with self.assertRaises(ValueError):
            low_study.freeze(low_study.ROOT.parent / 'outside-study')

    def test_removed_manifest_record_cannot_hide_a_changed_snapshot(self):
        low_study.freeze(self.destination)
        path = self.destination / 'manifest.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        record = data['files'].pop()
        path.write_text(json.dumps(data), encoding='utf-8')
        (self.destination / 'inputs' / record['path']).write_bytes(b'corrupted fixture')
        with self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)

    def test_model_and_trial_count_tampering_are_rejected(self):
        low_study.freeze(self.destination)
        path = self.destination / 'plan.json'
        original = path.read_bytes()
        rows = json.loads(original)
        rows[0]['model'] = 'different-model'
        path.write_text(json.dumps(rows), encoding='utf-8')
        with self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)
        rows = json.loads(original)
        rows.pop()
        path.write_text(json.dumps(rows), encoding='utf-8')
        with self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)

    def test_source_copy_change_or_extra_instruction_file_is_rejected(self):
        low_study.freeze(self.destination)
        path = self.destination / 'inputs/skills/ttak-explain/SKILL.md'
        original = path.read_bytes()
        path.write_bytes(original + b'\nextra instruction')
        with self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)
        path.write_bytes(original)
        (self.destination / 'AGENTS.md').write_text('unexpected instructions', encoding='utf-8')
        with self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)

    def test_changed_current_source_is_not_certified_by_old_manifest(self):
        low_study.freeze(self.destination)
        files = low_study.source_files()
        files['hooks/ttak.cjs'] += b'\nchanged hook'
        with patch.object(low_study, 'source_files', return_value=files), self.assertRaises(ValueError):
            low_study.verify_freeze(self.destination)


if __name__ == '__main__':
    unittest.main()
