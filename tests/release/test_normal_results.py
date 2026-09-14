"""Parent/child and incomplete-run separation for the installed-plugin collector."""
import copy
import unittest
from normal_results import normal_result, control_result

SID = '00000000-0000-4000-8000-000000000001'
PROCESS = {'status': 'exited', 'exit_code': 0, 'cleanup_verified': True, 'active_processes': 0}


def codex():
    return {'session': SID, 'model': 'gpt-5.6-luna', 'effort': 'high', 'error': None,
            'collection': {'complete': True}, 'turns': [{'thread_id': SID, 'status': 'completed'}],
            'messages': [{'thread_id': SID, 'phase': 'final_answer', 'text': 'Earlier final'},
                         {'thread_id': SID, 'phase': 'final_answer', 'text': 'Corrected final'},
                         {'thread_id': SID, 'phase': 'commentary', 'text': 'Later commentary'},
                         {'thread_id': 'child', 'phase': 'final_answer', 'text': 'Child receipt'}]}


class NormalResultTests(unittest.TestCase):
    def test_local_claude_on_is_not_a_model_answer_and_other_hook_denials_still_fail(self):
        final=dict(session_id=SID,result='UserPromptSubmit operation blocked by hook:\nTTAK saved setting: ON.\n\nOriginal prompt: ttak on',
                   subtype='success',is_error=False,num_turns=0,modelUsage={},error_count=0,permission_denials_count=0,
                   usage=dict(input_tokens=0,output_tokens=0,cache_creation_input_tokens=0,cache_read_input_tokens=0))
        report=dict(collection={'complete':True},models=[],tools=[],messages=[],results=[final])
        value=control_result('claude',report,PROCESS,'on')
        self.assertTrue(value['local_control_completed'])
        self.assertEqual(value['observed_models'],[])
        with self.assertRaises(ValueError):normal_result('claude',report,PROCESS)
        for change in ({'result':'Permission denied'},{'num_turns':1},{'modelUsage':{'unexpected':{}}},
                       {'permission_denials_count':1},{'usage':dict(final['usage'],output_tokens=1)}):
            altered=copy.deepcopy(report);altered['results'][0].update(change)
            with self.assertRaises(ValueError):control_result('claude',altered,PROCESS,'on')
        with self.assertRaises(ValueError):control_result('claude',report,PROCESS,'off')

    def test_local_codex_control_requires_the_exact_hook_and_no_model_work(self):
        report=codex();report['messages']=[]
        report['hooks']=[dict(eventName='userPromptSubmit',thread_id=SID,status='blocked',
                            entries=[dict(kind='feedback',text='TTAK saved setting: OFF.')])]
        self.assertEqual(control_result('codex',report,PROCESS,'off')['model_responses'],0)
        with self.assertRaises(ValueError):normal_result('codex',report,PROCESS)
        for field,value in [('hooks',[]),('messages',[{'text':'Answer'}]),('usage',[{'total':1}]),
                            ('collection',{'complete':False}),('error','failure')]:
            altered=copy.deepcopy(report);altered[field]=value
            with self.assertRaises(ValueError):control_result('codex',altered,PROCESS,'off')

    def test_only_latest_completed_parent_final_is_selected(self):
        value = normal_result('codex', codex(), PROCESS)
        self.assertEqual(value['answer'], 'Corrected final')
        self.assertEqual(value['assistant_message_count'], 2)
        self.assertFalse(value['delivery_verified'])
        self.assertFalse(value['release_qualified'])

    def test_timeout_or_failed_final_cannot_salvage_earlier_text(self):
        for changed in ({'status': 'timeout'}, {'cleanup_verified': False}, {'active_processes': 1}):
            with self.assertRaises(ValueError):
                normal_result('codex', codex(), dict(PROCESS, **changed))
        for field, value in [('collection', {'complete': False}), ('error', 'failed'),
                             ('turns', [{'thread_id': SID, 'status': 'failed'}]), ('messages', []), ('effort', 'low')]:
            report = codex()
            report[field] = value
            with self.assertRaises(ValueError):
                normal_result('codex', report, PROCESS)

    def test_claude_errors_and_child_messages_are_not_parent_success(self):
        final = {'session_id': SID, 'result': 'Final explanation', 'subtype': 'success',
                 'is_error': False, 'error_count': 0, 'permission_denials_count': 0}
        report = {'collection': {'complete': True}, 'models': ['claude-haiku-4-5-20251001'],
                  'results': [final], 'messages': [{'parent_tool_use_id': None, 'text': 'Final explanation'},
                                                  {'parent_tool_use_id': 'agent', 'text': 'Receipt'}]}
        self.assertEqual(normal_result('claude', report, PROCESS)['assistant_message_count'], 1)
        for change in ({'is_error': True}, {'permission_denials_count': 1}, {'result': ''}):
            altered = copy.deepcopy(report)
            altered['results'][0].update(change)
            with self.assertRaises(ValueError):
                normal_result('claude', altered, PROCESS)
