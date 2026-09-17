"""Final-answer selection and strict bundled transport, no model calls."""
import json
from pathlib import Path
import tempfile
import unittest

import collect
import low_study
from release_runtime import reviewed_mcp, checked_timeout, native_binary


class ReleaseRuntimeTests(unittest.TestCase):
    def test_execution_budget_is_explicit_and_not_limited_to_five_minutes(self):
        for value in (None, True, 0, -1, 1.5, '600', float('inf'), 2147451):
            with self.assertRaises(ValueError):
                checked_timeout(value)
        self.assertEqual(checked_timeout(600), 600)
        self.assertEqual(checked_timeout(900), 900)
        with self.assertRaises(ValueError):
            native_binary('unknown')

    def test_final_answer_replaces_the_pre_correction_answer(self):
        events = [{'type': 'thread.started', 'thread_id': '00000000-0000-0000-0000-000000000001'},
                  {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'wrong initial answer'}},
                  {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'corrected final answer'}},
                  {'type': 'turn.completed', 'usage': {'input_tokens': 7, 'output_tokens': 4}}]
        parsed = collect.parse('codex', '\n'.join(map(json.dumps, events)))
        self.assertEqual(parsed['answer'], 'corrected final answer')
        self.assertEqual(parsed['assistant_message_count'], 2)
        self.assertEqual(parsed['native_turn_count'], 1)
        self.assertFalse(parsed['hook_correction_verified'])

    def test_failed_continuation_cannot_expose_an_earlier_answer_as_success(self):
        events = [{'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'initial'}},
                  {'type': 'turn.failed'}]
        with self.assertRaises(ValueError):
            collect.parse('codex', '\n'.join(map(json.dumps, events)))

    def test_only_exact_reviewed_candidate_can_supply_mcp(self):
        with self.assertRaises(ValueError):
            reviewed_mcp('claude', [], 'ttak')
        with tempfile.TemporaryDirectory(dir=low_study.ROOT / '.superpowers') as temp:
            root = Path(temp)
            for name, raw in low_study.source_files().items():
                if name.startswith(('scripts/', 'hooks/', 'policy/', 'skills/', 'agents/', '.claude-plugin/', '.codex-plugin/')):
                    p = root / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(raw)
            for host, relative in [('claude', '.claude-plugin/mcp.json'), ('codex', '.codex-plugin/plugin.json')]:
                self.assertEqual(reviewed_mcp(host, [root], 'ttak'), root / relative)
                with self.assertRaises(ValueError):
                    reviewed_mcp(host, [root], 'original')
            p = root / '.codex-plugin/plugin.json'
            original = p.read_bytes()
            altered = json.loads(original)
            altered['mcpServers'] = {'remote': {'url': 'https://invalid.example'}}
            p.write_text(json.dumps(altered), encoding='utf-8')
            with self.assertRaises(ValueError):
                reviewed_mcp('claude', [root], 'ttak')
            p.write_bytes(original)
            (root / 'scripts/scenario-draft.cjs').write_text('changed runtime', encoding='utf-8')
            with self.assertRaises(ValueError):
                reviewed_mcp('codex', [root], 'ttak')

    def test_haiku_collector_uses_supported_settings_and_bundled_tool(self):
        args = collect.command('claude', 'claude-haiku-4-5-20251001', None, mcp_config='reviewed-local.json')
        self.assertNotIn('--effort', args)
        self.assertNotIn(None, args)
        self.assertIn('mcp__ttak_scenario__scenario_review', args)
        self.assertEqual(args[args.index('--max-turns') + 1], '8')

    def test_changed_native_original_request_reader_is_not_an_exact_candidate(self):
        with tempfile.TemporaryDirectory(dir=low_study.ROOT / '.superpowers') as temp:
            root = Path(temp)
            files = low_study.source_files()
            relative = 'scripts/explanation-request-source.cjs'
            files[relative] = (low_study.ROOT / relative).read_bytes()
            for name, raw in files.items():
                if name.startswith(('scripts/', 'hooks/', 'policy/', 'skills/', 'agents/', '.claude-plugin/', '.codex-plugin/')):
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(raw)
            for host in ('claude', 'codex'):
                self.assertIsNotNone(reviewed_mcp(host, [root], 'ttak'))
            (root / relative).write_bytes(files[relative] + b'\nchanged reader')
            for host in ('claude', 'codex'):
                with self.assertRaises(ValueError):
                    reviewed_mcp(host, [root], 'ttak')

    def test_inline_mcp_field_changes_are_rejected_for_both_hosts(self):
        with tempfile.TemporaryDirectory(dir=low_study.ROOT / '.superpowers') as temp:
            root = Path(temp)
            for name, raw in low_study.source_files().items():
                if name.startswith(('scripts/', 'hooks/', 'policy/', 'skills/', 'agents/', '.claude-plugin/', '.codex-plugin/')):
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(raw)
            target = root / '.codex-plugin/plugin.json'
            original = target.read_bytes()
            changes = [
                {'command': 'other-node'},
                {'args': ['scripts/different.cjs', '--host', 'codex']},
                {'cwd': 'different'},
                {'env': {}},
            ]
            for fields in changes:
                altered = json.loads(original)
                altered['mcpServers']['ttak_scenario'].update(fields)
                target.write_text(json.dumps(altered), encoding='utf-8')
                for host in ('claude', 'codex'):
                    with self.assertRaises(ValueError):
                        reviewed_mcp(host, [root], 'ttak')
                target.write_bytes(original)
                for host in ('claude', 'codex'):
                    self.assertIsNotNone(reviewed_mcp(host, [root], 'ttak'))

    def test_duplicate_codex_companion_is_rejected_even_when_its_contents_match(self):
        with tempfile.TemporaryDirectory(dir=low_study.ROOT / '.superpowers') as temp:
            root = Path(temp)
            for name, raw in low_study.source_files().items():
                if name.startswith(('scripts/', 'hooks/', 'policy/', 'skills/', 'agents/', '.claude-plugin/', '.codex-plugin/')):
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(raw)
            manifest = json.loads((root / '.codex-plugin/plugin.json').read_text(encoding='utf-8'))
            (root / '.codex-plugin/mcp.json').write_text(
                json.dumps({'mcpServers': manifest['mcpServers']}), encoding='utf-8')
            for host in ('claude', 'codex'):
                with self.assertRaisesRegex(ValueError, 'duplicate'):
                    reviewed_mcp(host, [root], 'ttak')
