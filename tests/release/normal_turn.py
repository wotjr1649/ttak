"""Collect one already-provisioned normal-plugin turn under a bounded supervisor.

The caller must verify the frozen candidate, selected plugins, reviewed hooks and
subscription profile before entry. This module never installs, selects, trusts,
grades, retries or executes model-produced code. Incomplete work remains recorded.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

import low_models
from normal_commands import request
from normal_results import normal_result, control_result
from prepare import ROOT
from release_runtime import checked_timeout, invoke_bounded, native_binary, RUNTIME_BINARIES


def local_directory(value):
    path = Path(value).absolute()
    resolved = path.resolve(strict=True)
    area = (ROOT / '.superpowers').resolve(strict=True)
    if (resolved != path or path.is_symlink() or path.is_junction()
            or not path.is_dir() or resolved == area or not resolved.is_relative_to(area)):
        raise ValueError('normal collection directory escaped its task area')
    return resolved


def write_new(path, value):
    with path.open('x', encoding='utf-8', newline='\n') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


def run_turn(*, host, prompt, profile, work, record_directory, skills, ttak_root,
             session, timeout, parent_turn_limit, internal_verifier_limit, control=None):
    checked_timeout(timeout)
    if control is not None and (control not in ('on','off') or prompt!='ttak '+control
            or session is not None or skills or ttak_root is None or internal_verifier_limit!=0):
        raise ValueError('local control mode requires an exact fresh ON/OFF command')
    profile, work = local_directory(profile), local_directory(work)
    if host not in low_models.HOSTS or profile != (
            ROOT / '.superpowers/release-run-03/profiles' / (host + '-ttak')).resolve(strict=True):
        raise ValueError('normal collection requires the reviewed existing subscription profile')
    destination = Path(record_directory).absolute()
    parent = local_directory(destination.parent)
    if destination.parent != parent or destination.exists() or destination.is_symlink():
        raise ValueError('collection already exists or traverses an unreviewed path')
    native_binary(host)  # Verify the executable before reserving or starting any work.
    collection_id = str(uuid.uuid4())
    args, native_input = request(host, prompt, session=session, skills=skills, ttak_root=ttak_root,
        collection_id=collection_id, parent_turn_limit=parent_turn_limit,
        internal_verifier_limit=internal_verifier_limit)
    lock = profile / 'normal-collection.lock'
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    cleanup_verified = False
    try:
        destination.mkdir()
        write_new(destination / 'reservation.json', dict(host=host, collection_id=collection_id,
            prior_session=session, native_session_id=session or (collection_id if host == 'claude' else None),
            prompt_sha256=hashlib.sha256(prompt.encode('utf-8')).hexdigest(), args=args,
            timeout_seconds=timeout, parent_turn_limit=parent_turn_limit,
            internal_verifier_limit=internal_verifier_limit, native_starts_reserved=1, local_control=control))
        env = low_models.native_environment(host, profile)
        env.update(TEMP=str(destination), TMP=str(destination))
        if host == 'claude':
            if ttak_root:
                env['CLAUDE_PLUGIN_ROOT'] = str(ttak_root)
            env.update(CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS='1',
                CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH='1', CLAUDE_CODE_SUBAGENT_MODEL_FORCE='1')
        result = invoke_bounded(args, native_input, work, env, timeout)
        cleanup_verified = result.get('cleanupVerified') is True and result.get('activeProcesses') == 0
        process = dict(status=result['status'], exit_code=result['exitCode'],
            cleanup_verified=cleanup_verified, active_processes=result['activeProcesses'],
            assigned_before_resume=result['assignedBeforeResume'], elapsed_ms=result['elapsedMs'])
        write_new(destination / 'process.json', process)
        checkpoint_text = None
        if host == 'codex' and result['status'] == 'timeout' and cleanup_verified:
            checkpoint = work / ('normal-checkpoint-' + collection_id + '.json')
            stat = checkpoint.lstat()
            if (checkpoint.is_symlink() or not checkpoint.is_file() or stat.st_nlink != 1
                    or stat.st_size > 1048576 or checkpoint.resolve(strict=True) != checkpoint):
                raise ValueError('incomplete collection checkpoint is unavailable')
            checkpoint_text = checkpoint.read_text(encoding='utf-8')
        # Parse only in memory; raw stdout may contain hidden native reasoning.
        parser_env = {key: value for key, value in env.items()
                      if key.upper() in {'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
                                         'PATHEXT', 'SYSTEMDRIVE', 'TEMP', 'TMP'}}
        parsed = subprocess.run([str(RUNTIME_BINARIES['node']), str(ROOT / 'tests/release/normal-parse.cjs')],
            input=json.dumps(dict(host=host, stdout=result['stdout'], process={key: result[key] for key in
                                  ('status', 'cleanupVerified', 'activeProcesses')},
                                  checkpoint_text=checkpoint_text), ensure_ascii=False), cwd=work, env=parser_env,
            capture_output=True, encoding='utf-8', timeout=10)
        if parsed.returncode:
            raise ValueError('normal collection parser rejected native output')
        report = json.loads(parsed.stdout)
        write_new(destination / 'collected.json', report)
        normalized = control_result(host,report,process,control) if control else normal_result(host, report, process)
        if control is None and normalized['observed_models'] != [low_models.settings(host)['model']]:
            raise ValueError('actual native model differs from the frozen model')
        if session is not None and normalized['session'] != session:
            raise ValueError('native resume did not retain the observed session')
        if ttak_root is not None:
            snapshot = subprocess.run([str(RUNTIME_BINARIES['node']),str(ROOT / 'tests/release/normal-state.cjs')],
                input=json.dumps(dict(profile=str(profile),installed=str(ttak_root),session=normalized['session'])),
                cwd=work,env=parser_env,capture_output=True,encoding='utf-8',timeout=10)
            if snapshot.returncode:
                raise ValueError('post-turn evidence state could not be preserved')
            write_new(destination / 'state-snapshot.json',json.loads(snapshot.stdout))
        write_new(destination / 'result.json', normalized)
        return normalized
    except Exception as error:
        if destination.is_dir() and not (destination / 'failure.json').exists():
            write_new(destination / 'failure.json', dict(error_type=type(error).__name__,
                cleanup_verified=cleanup_verified, no_retry=True, release_qualified=False))
        raise
    finally:
        os.close(descriptor)
        if cleanup_verified:
            # A failed supervisor keeps the lock until independent cleanup audit.
            stat = lock.lstat()
            if lock.is_symlink() or stat.st_nlink != 1 or not lock.is_file():
                raise ValueError('normal collection lock changed')
            lock.unlink()
