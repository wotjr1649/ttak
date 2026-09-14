"""Normalize the observed installed-plugin reports, without claiming provenance or quality."""
import uuid


def control_result(host, report, process, control):
    """Recognize only a completed local ON/OFF hook command, never a model answer."""
    if control not in ('on', 'off') or (process.get('status'),process.get('exit_code'),
            process.get('cleanup_verified'),process.get('active_processes')) != ('exited',0,True,0):
        raise ValueError('local control execution is incomplete')
    if report.get('collection',{}).get('complete') is not True or report.get('messages'):
        raise ValueError('local control has incomplete collection or model output')
    expected='TTAK saved setting: '+control.upper()+'.'
    if host=='claude':
        finals=report.get('results',[])
        if len(finals)!=1 or report.get('models') or report.get('tools') or report.get('incomplete_tail'):
            raise ValueError('ambiguous local Claude control')
        final=finals[0]
        if (final.get('subtype')!='success' or final.get('is_error') is not False
                or final.get('num_turns')!=0 or final.get('modelUsage')!={}
                or final.get('error_count')!=0 or final.get('permission_denials_count')!=0
                or final.get('result')!='UserPromptSubmit operation blocked by hook:\n'+expected+'\n\nOriginal prompt: ttak '+control):
            raise ValueError('Claude hook did not confirm the exact local control')
        if any(final.get('usage',{}).get(key)!=0 for key in
               ('input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens')):
            raise ValueError('local control unexpectedly used model tokens')
        if any(hook.get('exit_code') not in (None,0) or hook.get('outcome') not in (None,'success') for hook in report.get('hooks',[])):
            raise ValueError('local Claude control has another failed hook')
        session=final['session_id']
    elif host=='codex':
        session=report.get('session')
        if report.get('error') is not None or report.get('model')!='gpt-5.6-luna' or report.get('effort')!='high':
            raise ValueError('Codex control transport failed')
        if any(report.get(key) for key in ('child_messages','tool_items','function_items','agent_items','usage','child_usage','child_turns')):
            raise ValueError('local Codex control unexpectedly invoked model work')
        turns=report.get('turns',[])
        if len(turns)!=1 or turns[0].get('thread_id')!=session or turns[0].get('status')!='completed':
            raise ValueError('local Codex control did not complete')
        blocked=[hook for hook in report.get('hooks',[]) if hook.get('status')=='blocked']
        if any(hook.get('status') not in ('completed','blocked') for hook in report.get('hooks',[])):
            raise ValueError('local Codex control has another failed hook')
        if len(blocked)!=1 or blocked[0].get('eventName')!='userPromptSubmit' or blocked[0].get('thread_id')!=session or blocked[0].get('entries')!=[{'kind':'feedback','text':expected}]:
            raise ValueError('Codex hook did not confirm the exact local control')
    else:
        raise ValueError('unknown native host')
    uuid.UUID(session)
    return dict(control=control,session=session,local_control_completed=True,model_responses=0,
                observed_models=[],answer=None,delivery_verified=False,release_qualified=False)


def normal_result(host, report, process):
    if (process.get('status') != 'exited' or process.get('exit_code') != 0
            or process.get('cleanup_verified') is not True or process.get('active_processes') != 0
            or report.get('collection', {}).get('complete') is not True):
        raise ValueError('native execution or collection is incomplete')
    if host == 'claude':
        results = report.get('results', [])
        if len(results) != 1:
            raise ValueError('ambiguous Claude completion')
        final = results[0]
        if (final.get('subtype') != 'success' or final.get('is_error') is not False
                or final.get('error_count') != 0 or final.get('permission_denials_count') != 0):
            raise ValueError('Claude completion failed')
        session, answer = final.get('session_id'), final.get('result')
        models = report.get('models', [])
        if len(models) != 1:
            raise ValueError('actual Claude model is ambiguous')
        model, effort = models[0], None
        messages = [m for m in report.get('messages', []) if m.get('parent_tool_use_id') is None]
    elif host == 'codex':
        session = report.get('session')
        if report.get('error') is not None:
            raise ValueError('Codex reported an execution error')
        turns = report.get('turns', [])
        if not turns or any(t.get('thread_id') != session or t.get('status') != 'completed' for t in turns):
            raise ValueError('Codex parent completion failed')
        messages = [m for m in report.get('messages', [])
                    if m.get('thread_id') == session and m.get('phase') == 'final_answer']
        if not messages:
            raise ValueError('no completed parent final answer')
        answer = messages[-1].get('text')
        model, effort = report.get('model'), report.get('effort')
        if not isinstance(model, str) or not model or effort != 'high':
            raise ValueError('actual Codex model/settings are missing')
    else:
        raise ValueError('unknown native host')
    uuid.UUID(session)
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError('empty native answer')
    return {'answer': answer, 'session': session, 'observed_models': [model], 'observed_effort': effort,
            'assistant_message_count': len(messages), 'delivery_verified': False,
            'hook_correction_verified': False, 'release_qualified': False}
