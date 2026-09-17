"""Build reviewed normal installed-plugin requests. No native calls or profile changes."""
import hashlib
import json
from pathlib import Path
import uuid

from prepare import ROOT
from release_runtime import RUNTIME_BINARIES, native_binary

EXPLANATION_TOOLS = (
    'scenario_review', 'explanation_assess_request', 'explanation_notice_from_assessment',
    'explanation_decide', 'explanation_repair_notice', 'explanation_prepare', 'explanation_next',
    'explanation_check_final', 'explanation_revise_final', 'explanation_assessment_result',
    'explanation_fact_result', 'explanation_final_result', 'explanation_notice_result',
    'explanation_final_preview', 'explanation_packet', 'explanation_result',
)


def request(host, prompt, *, session, skills, ttak_root, collection_id,
            parent_turn_limit, internal_verifier_limit):
    if host not in ('claude', 'codex') or not isinstance(prompt, str) or not prompt.strip():
        raise ValueError('invalid normal native request')
    if len(prompt.encode('utf-8')) > 32000:
        raise ValueError('oversized native request')
    if type(parent_turn_limit) is not int or not 1 <= parent_turn_limit <= 20:
        raise ValueError('explicit parent turn budget required')
    if type(internal_verifier_limit) is not int or not 0 <= internal_verifier_limit <= 11:
        raise ValueError('explicit verifier budget required')
    if internal_verifier_limit and ttak_root is None:
        raise ValueError('only TTAK uses its reviewed verifier')
    collection_id = str(uuid.UUID(collection_id))
    session = str(uuid.UUID(session)) if session is not None else None
    if not isinstance(skills, list) or len(skills) > 4:
        raise ValueError('invalid explicit skills')
    if host == 'codex':
        # The worker independently checks exact skill hashes, ordinary cache paths,
        # profile destination, actual model and the exclusive collection identifier.
        payload = dict(prompt=prompt, session=session, skills=skills, ttak_root=ttak_root,
                       collection_id=collection_id, parent_turn_limit=parent_turn_limit,
                       internal_verifier_limit=internal_verifier_limit)
        return [str(RUNTIME_BINARIES['node']), str(ROOT / 'tests/release/normal-codex.cjs')], json.dumps(payload, ensure_ascii=False)
    if len(skills) > 1:
        raise ValueError('Claude activates one native skill per planned activation turn')
    for skill in skills:
        if set(skill) != {'name', 'package'} or not all(isinstance(v,str) and v and
                all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in v) for v in skill.values()):
            raise ValueError('invalid Claude native invocation')
    args = [native_binary('claude'), '-p', '--model', 'claude-haiku-4-5-20251001',
            '--settings', '{"alwaysThinkingEnabled":true}', '--output-format', 'stream-json',
            '--verbose', '--tools', 'Skill,Agent' if internal_verifier_limit else 'Skill',
            '--allowedTools', 'Skill']
    if internal_verifier_limit:
        args += ['Agent(ttak:ttak-fact-check)']
        args += ['mcp__plugin_ttak_ttak_scenario__' + name for name in EXPLANATION_TOOLS]
    args += ['--max-turns', str(parent_turn_limit), '--resume' if session else '--session-id',
             session or collection_id]
    if skills:
        prompt = '/' + skills[0]['package'] + ':' + skills[0]['name'] + ' ' + prompt
    return args, prompt
