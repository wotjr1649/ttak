import copy
import json
from pathlib import Path
import unittest
from hook_review import EVENTS, validate_hooks

ROOT = Path(__file__).resolve().parents[2]
DEFINITIONS = json.loads((ROOT / 'hooks/hooks.json').read_text())['hooks']


class HookReviewTests(unittest.TestCase):
    def rows(self):
        return [{'pluginId': 'fixture', 'key': f'fixture:hooks/hooks.json:{suffix}:{group_index}:{handler_index}', 'eventName': name,
                 'handlerType': 'command', 'command': definition['command'].replace('${CLAUDE_PLUGIN_ROOT}', str(ROOT)),
                 'timeoutSec': definition['timeout'], 'async': False, 'matcher': group.get('matcher'),
                 'source': 'plugin', 'isManaged': False, 'sourcePath': str(ROOT / 'hooks/hooks.json'),
                 'currentHash': 'sha256:' + 'a' * 64} for name, (event, suffix) in EVENTS.items()
                for group_index, group in enumerate(DEFINITIONS[event])
                for handler_index, definition in enumerate(group['hooks'])]

    def test_expanded_host_commands_match_reviewed_definitions(self):
        rows = self.rows()
        self.assertEqual(len(rows), 11)
        self.assertEqual(validate_hooks(rows, DEFINITIONS, ROOT, 'fixture'), rows)

    def test_missing_or_substituted_secondary_handler_is_rejected(self):
        for index in range(len(self.rows())):
            rows = self.rows()
            del rows[index]
            with self.assertRaises(ValueError):
                validate_hooks(rows, DEFINITIONS, ROOT, 'fixture')
        rows = self.rows()
        rows[1] = copy.deepcopy(rows[0])
        with self.assertRaises(ValueError):
            validate_hooks(rows, DEFINITIONS, ROOT, 'fixture')

    def test_changed_command_identity_matcher_hash_or_extra_hook_is_rejected(self):
        for key, value in [('command', 'node attacker.cjs'), ('pluginId', 'unrelated'),
                           ('key', 'other:stop:0:0'), ('matcher', 'different'), ('currentHash', 'trusted'),
                           ('timeoutSec', 900), ('async', True), ('sourcePath', str(ROOT / 'hooks/ttak.cjs'))]:
            rows = self.rows()
            rows[0][key] = value
            with self.assertRaises(ValueError):
                validate_hooks(rows, DEFINITIONS, ROOT, 'fixture')
        rows = self.rows()
        rows.append(copy.deepcopy(rows[0]))
        with self.assertRaises(ValueError):
            validate_hooks(rows, DEFINITIONS, ROOT, 'fixture')
