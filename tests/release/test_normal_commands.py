"""Native command construction only; no CLI or model is launched."""
import json
import unittest
from unittest import mock
import normal_commands
from normal_commands import request

class NormalCommandsTests(unittest.TestCase):
    def setUp(self):
        # What is under test here is the argument vector, and the claude branch
        # resolves its executable off disk so the integrity ledger sees the bytes
        # it is actually about to run. That control has its own tests; requiring
        # an installed host here would only make these assertions unrunnable
        # anywhere but the collection machine.
        patch = mock.patch.object(normal_commands, 'native_binary',
                                  return_value='/reviewed/claude')
        patch.start(); self.addCleanup(patch.stop)

    def args(self,host='codex',**changes):
        values=dict(session=None,skills=[],ttak_root=None,
                    collection_id='00000000-0000-0000-0000-000000000001',
                    parent_turn_limit=20,internal_verifier_limit=0)
        values.update(changes)
        return request(host,'Describe the fictional register.',**values)

    def test_codex_preserves_explicit_request_and_resume_identity(self):
        session='00000000-0000-0000-0000-000000000002'
        args,raw=self.args(session=session)
        payload=json.loads(raw)
        self.assertEqual(payload['session'],session)
        self.assertEqual(payload['collection_id'],'00000000-0000-0000-0000-000000000001')
        self.assertEqual(payload['internal_verifier_limit'],0)
        self.assertTrue(args[1].endswith('normal-codex.cjs'))
        self.assertNotIn('--plugin-dir',args)

    def test_claude_normal_autoload_and_unique_native_session(self):
        args,prompt=self.args('claude',skills=[{'package':'eli5','name':'eli5'}])
        self.assertEqual(prompt,'/eli5:eli5 Describe the fictional register.')
        self.assertEqual(args[args.index('--session-id')+1],'00000000-0000-0000-0000-000000000001')
        self.assertNotIn('--mcp-config',args)
        self.assertNotIn('--plugin-dir',args)
        self.assertNotIn('Agent(ttak:ttak-fact-check)',args)
        self.assertEqual(args[args.index('--max-turns')+1],'20')

    def test_ttak_only_gets_reviewed_verifier_tools(self):
        args,_=self.args('claude',ttak_root='validated by caller',internal_verifier_limit=11)
        self.assertIn('Agent(ttak:ttak-fact-check)',args)
        self.assertIn('mcp__plugin_ttak_ttak_scenario__explanation_check_final',args)
        self.assertNotIn('--dangerously-skip-permissions',args)
        for changes in ({'parent_turn_limit':True},{'parent_turn_limit':21},
                        {'internal_verifier_limit':12},{'internal_verifier_limit':1},
                        {'collection_id':'../outside'},{'session':'invalid'}):
            with self.assertRaises((ValueError,TypeError,AttributeError)):
                self.args(**changes)

    def test_claude_cannot_smuggle_prompt_or_multiple_skill_commands(self):
        for skills in ([{'package':'eli5','name':'eli5 arbitrary prompt'}],
                       [{'package':'eli5','name':'eli5'}]*2,
                       [{'package':'eli5','name':'eli5','override':True}]):
            with self.assertRaises(ValueError):self.args('claude',skills=skills)

    def test_unicode_request_stays_utf8_without_ascii_escape_expansion(self):
        prompt='가'*10000
        _,raw=request('codex',prompt,session=None,skills=[],ttak_root=None,
                      collection_id='00000000-0000-0000-0000-000000000001',
                      parent_turn_limit=20,internal_verifier_limit=0)
        self.assertEqual(json.loads(raw)['prompt'],prompt)
        self.assertLess(len(raw.encode('utf-8')),32000)
