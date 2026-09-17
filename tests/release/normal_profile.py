"""Temporarily select installed comparison plugins through normal native controls.

The caller supplies the reverified saved selection and an explicit installed
catalogue. A profile lease serializes selectors; an active collection prevents
selection or restoration. Unexpected concurrent state is preserved and reported.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import tomllib

import low_models
from normal_turn import local_directory, write_new
from prepare import ROOT
from release_runtime import invoke_bounded, native_binary, RUNTIME_BINARIES


def read_selection(host, profile):
    path = profile / ('settings.json' if host == 'claude' else 'config.toml')
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_nlink != 1 or path.resolve(strict=True) != path:
        raise ValueError('profile configuration is not an ordinary owned file')
    source = path.read_text(encoding='utf-8')
    if host == 'claude':
        selected = json.loads(source).get('enabledPlugins', {})
    elif host == 'codex':
        selected = {key: value.get('enabled') for key, value in tomllib.loads(source).get('plugins', {}).items()}
    else:
        raise ValueError('unknown native host')
    if len(selected) > 256 or any(type(value) is not bool for value in selected.values()):
        raise ValueError('ambiguous saved plugin selection')
    return selected


def target_selection(saved, selected_ids, allowed_ids):
    if (not isinstance(saved, dict) or any(type(value) is not bool for value in saved.values())
            or len(saved) > 256 or len(selected_ids) != len(set(selected_ids))
            or not set(selected_ids) <= set(allowed_ids) <= set(saved)):
        raise ValueError('selection differs from installed comparison catalogue')
    target = dict(saved)
    for key, value in saved.items():
        if key.startswith('ttak@ttak-') or key in allowed_ids:
            target[key] = key in selected_ids
        elif value:
            raise ValueError('an unrelated active plugin prevents a clean comparison')
    return target


def management_call(host, args, native_input, profile, directory, name, ceiling):
    directory = local_directory(directory)
    if (not re.fullmatch(r'[a-z0-9.-]{1,120}', name) or type(ceiling) is not int
            or not 1 <= ceiling <= 4096):
        raise ValueError('invalid management reservation')
    if len(list(directory.glob('*.reservation.json'))) >= ceiling:
        raise ValueError('management budget exhausted')
    write_new(directory / (name + '.reservation.json'), dict(host=host, args=args,
        input_sha256=hashlib.sha256(native_input.encode('utf-8')).hexdigest(), native_model_starts=0))
    env = low_models.native_environment(host, profile)
    env.update(TEMP=str(directory), TMP=str(directory))
    lock = profile / 'normal-management.lock'
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    cleaned = False
    try:
        result = invoke_bounded(args, native_input, directory, env, 20)
        cleaned = result.get('cleanupVerified') is True and result.get('activeProcesses') == 0
        write_new(directory / (name + '.json'), {key: result[key] for key in
            ('status', 'exitCode', 'cleanupVerified', 'activeProcesses', 'assignedBeforeResume', 'elapsedMs')})
        if result['status'] != 'exited' or result['exitCode'] != 0:
            raise ValueError('normal selection control failed; inspect recorded process state')
        return result['stdout']
    finally:
        os.close(descriptor)
        if cleaned:
            stat = lock.lstat()
            if lock.is_symlink() or not lock.is_file() or stat.st_nlink != 1:
                raise ValueError('management process marker changed')
            lock.unlink()


def change_selection(host, profile, expected, target, directory, prefix, ceiling):
    if any((profile / name).exists() for name in ('normal-collection.lock', 'normal-management.lock')):
        raise ValueError('native collection is still active or cleanup is unverified')
    if read_selection(host, profile) != expected:
        raise ValueError('plugin selection changed before native control')
    evidence = dict(method='normal native controls', before=expected, target=target, hooks=None)
    if host == 'codex':
        raw = management_call(host, [str(RUNTIME_BINARIES['node']), str(ROOT / 'tests/release/normal-select.cjs')],
            json.dumps(dict(expected=expected, target=target), ensure_ascii=False), profile, directory, prefix, ceiling)
        reply = json.loads(raw)
        if reply.get('selection_verified') is not True or reply.get('selection') != target or reply.get('trust_changes') != 0:
            raise ValueError('native selection evidence differs')
        evidence['hooks'] = reply['hooks']
    else:
        current = dict(expected)
        for index, (identifier, enabled) in enumerate(target.items()):
            if current[identifier] == enabled:
                continue
            if not re.fullmatch(r'(?:ttak@ttak-[a-z0-9-]+|(?:ponytail|eli5|i-have-adhd)@ttak-original-claude-v4)', identifier):
                raise ValueError('Claude selection cannot change an unrelated plugin')
            if read_selection(host, profile) != current:
                raise ValueError('Claude selection changed between native controls')
            management_call(host, [native_binary(host), 'plugin', 'enable' if enabled else 'disable', identifier,
                '--scope', 'user'], '', profile, directory, prefix + '-' + str(index), ceiling)
            current[identifier] = enabled
            if read_selection(host, profile) != current:
                raise ValueError('Claude control did not establish the requested selection')
    if read_selection(host, profile) != target:
        raise ValueError('native selection readback mismatch')
    write_new(directory / (prefix + '.selection.json'), evidence)
    return evidence


@contextmanager
def profile_selection(*, host, profile, saved, selected_ids, allowed_ids, management_directory,
                      reservation_prefix, management_ceiling):
    profile = local_directory(profile)
    if host not in low_models.HOSTS or profile != (ROOT / '.superpowers/release-run-03/profiles' / (host + '-ttak')).resolve(strict=True):
        raise ValueError('selection requires the existing reviewed profile')
    target = target_selection(saved, selected_ids, allowed_ids)
    lock = profile / 'release-selection.lock'
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    restored = False
    evidence = None
    try:
        evidence = change_selection(host, profile, saved, target, management_directory,
            reservation_prefix + '-select', management_ceiling)
        yield evidence
    finally:
        try:
            if any((profile / name).exists() for name in ('normal-collection.lock', 'normal-management.lock')):
                raise ValueError('cannot restore before verified native cleanup')
            current = read_selection(host, profile)
            if current == saved:
                restored = True
            elif current == target:
                change_selection(host, profile, target, saved, management_directory,
                    reservation_prefix + '-restore', management_ceiling)
                restored = True
            else:
                raise ValueError('unexpected selection retained for inspection; no overwrite')
            if evidence is not None:
                evidence['restored'] = True
        finally:
            os.close(descriptor)
            if restored:
                stat = lock.lstat()
                if lock.is_symlink() or not lock.is_file() or stat.st_nlink != 1:
                    raise ValueError('profile selection lease changed')
                lock.unlink()
