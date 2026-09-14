"""Run one reserved normal-plugin setup or subject from a frozen local campaign.

The campaign is a local test manifest, not permission to publish, change trust,
copy authentication or alter model settings. No automatic retry or grading.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

import low_study
from original_adapter import package_files
from prepare import ROOT
from normal_profile import profile_selection, read_selection
from normal_trial import run_conversation, validate_selection
from normal_turn import local_directory, run_turn, write_new


def read(path):
    ordinary(path)
    return json.loads(path.read_text(encoding='utf-8'))


def ordinary(path):
    stat = path.lstat()
    if (not path.is_file() or path.is_symlink() or stat.st_nlink != 1
            or path.resolve(strict=True) != path.absolute()):
        raise ValueError('campaign input is not an ordinary owned file')


def digest(path):
    ordinary(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preflight(campaign_file):
    campaign_file = Path(campaign_file).absolute()
    area = local_directory(campaign_file.parent)
    campaign = read(campaign_file)
    if campaign_file.name != 'campaign.json' or (area / 'closed.json').exists():
        raise ValueError('campaign is closed or not a planned campaign')
    freeze = local_directory(area / 'freeze')
    low_study.verify_freeze(freeze)
    if campaign['freeze_manifest_sha256'] != digest(freeze / 'manifest.json'):
        raise ValueError('campaign freeze changed')
    if campaign['limits'] != dict(subject_requests=388, setup_requests=2, grading_requests=128,
            parent_turns=20, internal_verifiers_per_task_turn=11, management_starts=1024,
            timeout_seconds={'claude':600,'codex':900}, concurrency=1, automatic_retries=0):
        raise ValueError('unreviewed campaign limits')
    for record in campaign['evidence']:
        file = Path(record['path'])
        if not file.is_relative_to(ROOT / '.superpowers') or digest(file) != record['sha256']:
            raise ValueError('prerequisite evidence changed')
    for host in ('claude','codex'):
        profile = local_directory(campaign['profiles'][host])
        if profile != (ROOT / '.superpowers/release-run-03/profiles' / (host+'-ttak')).resolve(strict=True):
            raise ValueError('campaign cannot use a different subscription profile')
        if read_selection(host,profile) != campaign['saved_selection'][host]:
            raise ValueError('saved profile selection changed')
        for name in ('normal-collection.lock','normal-management.lock','release-selection.lock'):
            if (profile / name).exists():
                raise ValueError('prior native work is active or cleanup is unverified')
        catalogue = campaign['catalogue'][host]
        if set(catalogue) != {'ttak','ponytail','eli5','i-have-adhd'}:
            raise ValueError('unexpected comparison catalogue')
        for package, installed in catalogue.items():
            root = local_directory(installed['root'])
            namespace = campaign['namespace'] if package=='ttak' else 'ttak-original-'+host+'-v4'
            if installed['identifier'] != package+'@'+namespace or not root.is_relative_to(profile/'plugins/cache'/namespace/package):
                raise ValueError('installed package escaped the reviewed catalogue')
            if set(installed['files']) != {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}:
                raise ValueError('installed package has missing or additional files')
            if package != 'ttak':
                original_files, _ = package_files(host,package)
                if installed['files'] != {name:hashlib.sha256(raw).hexdigest() for name,raw in original_files.items()}:
                    raise ValueError('original package differs from its pinned source adapter')
            for name, expected in installed['files'].items():
                if digest(root/name) != expected:
                    raise ValueError('installed plugin changed')
                if package=='ttak' and digest(freeze/'inputs'/name) != expected:
                    raise ValueError('installed candidate differs from frozen source')
            for name, skill in installed['skills'].items():
                if skill != dict(path=str(root/'skills'/name/'SKILL.md'),sha256=installed['files']['skills/'+name+'/SKILL.md']):
                    raise ValueError('explicit skill differs from its frozen package')
    return area,campaign


def state_file(campaign,host):
    return Path(campaign['profiles'][host])/'plugins/data'/('ttak-'+campaign['namespace'])/'state.json'


def activate(area,campaign,host):
    state = state_file(campaign,host)
    if state.exists() or state.is_symlink():
        raise ValueError('setup requires the reverified originally absent candidate state')
    destination = area/'setup'/host
    if destination.exists():
        raise ValueError('setup already has evidence; do not repeat it')
    work=area/'work'/('setup-'+host)
    work.mkdir()
    catalogue=campaign['catalogue'][host]
    with profile_selection(host=host,profile=Path(campaign['profiles'][host]),
            saved=campaign['saved_selection'][host],selected_ids=[catalogue['ttak']['identifier']],
            allowed_ids=[p['identifier'] for p in catalogue.values()],management_directory=area/'management',
            reservation_prefix='setup-'+host,management_ceiling=campaign['limits']['management_starts']) as selection:
        validate_selection(host,'ttak',selection,catalogue)
        result=run_turn(host=host,prompt='ttak on',profile=Path(campaign['profiles'][host]),work=work,
            record_directory=destination,skills=[],ttak_root=catalogue['ttak']['root'],session=None,
            timeout=campaign['limits']['timeout_seconds'][host],parent_turn_limit=20,internal_verifier_limit=0,control='on')
        if read(state) != {'enabled':True}:
            raise ValueError('normal activation did not establish candidate ON')
    write_new(destination/'selection.json',selection)
    return dict(host=host,status='activation collected; native policy audit pending',session=result['session'])


def subject(area,campaign,identifier):
    plan=read(area/'freeze/plan.json')
    matches=[row for row in plan if row['id']==identifier]
    if len(matches)!=1:
        raise ValueError('trial is not in the frozen 192-subject plan')
    row=matches[0]
    for host in ('claude','codex'):
        if read(area/'setup'/host/'review.json')['status']!='PASS' or read(state_file(campaign,host))!={'enabled':True}:
            raise ValueError('normal activation has not passed')
    trials=area/'trials'
    for previous in trials.iterdir():
        if read(previous/'collection-audit.json')['status']!='PASS':
            raise ValueError('prior trial native audit is unresolved')
        verdict=previous/'review.json'
        if verdict.exists() and read(verdict).get('candidate_hard_failure') is True:
            raise ValueError('candidate failure requires analysis before more subjects')
    used=sum(read(p)['native_starts_reserved'] for p in trials.glob('*/reservation.json'))
    if used+row['turn_count']+len(row['activation_skills'])>campaign['limits']['subject_requests']:
        raise ValueError('subject request allocation exhausted')
    cases=read(area/'freeze/cases.json')['cases']
    case=next(case for case in cases if case['id']==row['case'])
    result=run_conversation(row=row,case=case,catalogue=campaign['catalogue'][row['host']],
        profile=Path(campaign['profiles'][row['host']]),saved=campaign['saved_selection'][row['host']],
        destination=trials/identifier,management_directory=area/'management',
        management_ceiling=campaign['limits']['management_starts'],timeout=campaign['limits']['timeout_seconds'][row['host']])
    return dict(trial=identifier,status=result['status'],turns=len(result['turns']),activations=len(result['activation_turns']))


def run(campaign_file,identifier,setup=False):
    area,campaign=preflight(campaign_file)
    lock=area/'process.lock'
    fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    try:
        return activate(area,campaign,identifier) if setup else subject(area,campaign,identifier)
    finally:
        os.close(fd)
        stopped=all(not (Path(profile)/name).exists() for profile in campaign['profiles'].values()
                    for name in ('normal-collection.lock','normal-management.lock','release-selection.lock'))
        restored=all(read_selection(host,Path(profile))==campaign['saved_selection'][host]
                     for host,profile in campaign['profiles'].items())
        if stopped and restored:
            lock.unlink()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--campaign',required=True,type=Path)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--setup',choices=['claude','codex'])
    group.add_argument('--trial')
    args=parser.parse_args()
    print(json.dumps(run(args.campaign,args.setup or args.trial,setup=bool(args.setup)),ensure_ascii=True))
