"""Collect a complete frozen comparison conversation using installed plugins.

Collection never grades answers or executes generated code. The caller verifies
the campaign catalogue, freeze and active TTAK state before selecting a trial.
"""
import json
from pathlib import Path

from prepare import ROOT, activation_skills
from normal_profile import profile_selection
from normal_turn import local_directory, run_turn, write_new

ACTIVATION = ('Load this skill for the upcoming task. No task artifact is supplied yet; '
              'do not invent one or claim work is complete.')


def conversation(case, condition):
    steps = [dict(phase='activation_turns', skill=name, prompt=ACTIVATION)
             for name in activation_skills(case, condition)]
    for index, prompt in enumerate(case['turns']):
        if index == 0 and 'fixture' in case:
            if case['fixture'] != 'project.py':
                raise ValueError('unreviewed trial fixture')
            fixture = (ROOT / 'tests/release/fixtures/project.py').read_text(encoding='utf-8')
            prompt += '\n\nSupplied project.py:\n```python\n' + fixture + '\n```'
        steps.append(dict(phase='turns', skill=None, prompt=prompt))
    return steps


def selected_packages(case, condition):
    if condition == 'baseline':
        return []
    if condition == 'ttak':
        return ['ttak']
    if condition == 'original':
        return sorted({'ponytail' if name == 'ponytail-review' else name
                       for name in activation_skills(case, condition)})
    raise ValueError('unknown comparison condition')


def validate_selection(host, condition, selection, catalogue):
    if host != 'codex':
        return
    if condition == 'ttak':
        from hook_review import validate_hooks
        installed = Path(catalogue['ttak']['root'])
        definitions = json.loads((installed / 'hooks/hooks.json').read_text(encoding='utf-8'))['hooks']
        validate_hooks(selection['hooks'], definitions, installed, catalogue['ttak']['identifier'])
        if any(hook.get('trustStatus') != 'trusted' or hook.get('enabled') is not True for hook in selection['hooks']):
            raise ValueError('candidate hook approval is not established')
    elif selection['hooks']:
        raise ValueError('comparison has unexpected native hooks')


def run_conversation(*, row, case, catalogue, profile, saved, destination,
                     management_directory, management_ceiling, timeout):
    destination = Path(destination).absolute()
    local_directory(destination.parent)
    if destination.exists() or destination.is_symlink():
        raise ValueError('trial already has state; never repeat a model unit')
    host, condition = row['host'], row['condition']
    steps = conversation(case, condition)
    if len(steps) != row['turn_count'] + len(row['activation_skills']):
        raise ValueError('conversation differs from the frozen request count')
    selected = [catalogue[name]['identifier'] for name in selected_packages(case, condition)]
    destination.mkdir()
    work = destination / 'work'
    work.mkdir()
    turns = destination / 'collections'
    turns.mkdir()
    record = dict(trial=row, turns=[], activation_turns=[], delivery_verified=False,
                  actual_model_verified=False, release_qualified=False)
    write_new(destination / 'reservation.json', dict(trial=row, native_starts_reserved=len(steps),
        timeout_seconds=timeout, automatic_retries=0, internal_verifiers_per_task_turn=11 if condition=='ttak' else 0))
    session = None
    try:
        with profile_selection(host=host, profile=profile, saved=saved, selected_ids=selected,
                allowed_ids=[value['identifier'] for value in catalogue.values()],
                management_directory=management_directory, reservation_prefix=row['id'],
                management_ceiling=management_ceiling) as selection:
            validate_selection(host, condition, selection, catalogue)
            for index, step in enumerate(steps):
                skills = []
                if step['skill']:
                    name = step['skill']
                    package = 'ttak' if condition == 'ttak' else 'ponytail' if name == 'ponytail-review' else name
                    selected_skill = catalogue[package]['skills'][name]
                    skills = [dict(name=name, package=package)] if host == 'claude' else [dict(name=name, **selected_skill)]
                result = run_turn(host=host, prompt=step['prompt'], profile=profile, work=work,
                    record_directory=turns / f'{index+1:02d}', skills=skills,
                    ttak_root=catalogue['ttak']['root'] if condition == 'ttak' else None,
                    session=session, timeout=timeout, parent_turn_limit=20,
                    internal_verifier_limit=11 if condition == 'ttak' and step['phase']=='turns' else 0)
                session = result['session']
                record[step['phase']].append(dict(result, collection=f'collections/{index+1:02d}',
                                                requested_skill=step['skill']))
        record['selection'] = selection
        record['actual_model_verified'] = True
        record['status'] = 'collected; native delivery, functional checks and blind grading pending'
        write_new(destination / 'result.json', record)
        return record
    except Exception as error:
        record['status'] = 'stopped; inspect retained evidence before any further model work'
        record['error_type'] = type(error).__name__
        if not (destination / 'result.json').exists():
            write_new(destination / 'result.json', record)
        raise
