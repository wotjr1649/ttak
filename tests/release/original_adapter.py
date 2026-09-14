"""Build comparison adapters from pinned sources in memory; no install or model calls.

Codex's explicit-only policy is documented at
https://learn.chatgpt.com/docs/build-skills . Translation changes metadata only.
"""
import json
from pathlib import PurePosixPath

import prepare

PACKAGES = ('ponytail', 'eli5', 'i-have-adhd')
AUTHOR = 'TTAK local comparison adapter'


def adapt_skill(raw, host):
    if host not in ('claude', 'codex') or not isinstance(raw, bytes) or len(raw) > 32000:
        raise ValueError('invalid original skill input')
    raw.decode('utf-8')
    if not raw.startswith(b'---\n') or b'\n---\n' not in raw[4:]:
        raise ValueError('original frontmatter is unavailable')
    header, body = raw[4:].split(b'\n---\n', 1)
    key = b'disable-model-invocation:'
    lines = header.split(b'\n')
    policy_lines = [line for line in lines if line.startswith(key)]
    if len(policy_lines) > 1:
        raise ValueError('ambiguous original invocation policy')
    if host == 'claude' or not policy_lines or policy_lines == [key + b' false']:
        return raw, None
    if policy_lines != [key + b' true']:
        raise ValueError('unsupported original invocation policy')
    translated = b'---\n' + b'\n'.join(line for line in lines if line != policy_lines[0]) + b'\n---\n' + body
    assert translated[4:].split(b'\n---\n', 1)[1] == body
    policy = (b'interface:\n  display_name: "Original comparison skill"\n'
              b'  short_description: "Original skill with explicit invocation only."\n'
              b'policy:\n  allow_implicit_invocation: false\n')
    return translated, policy


def package_files(host, name):
    if host not in ('claude', 'codex') or name not in PACKAGES:
        raise ValueError('unsupported comparison adapter')
    files, translations = {}, []
    for record in prepare.source_records():
        original = PurePosixPath(record['path'])
        if original.parts[0] != name:
            continue
        relative = PurePosixPath(*original.parts[1:])
        raw = (prepare.SOURCES / record['path']).read_bytes()
        if relative.name == 'skill-source.md':
            relative = relative.with_name('SKILL.md')
            adapted, policy = adapt_skill(raw, host)
            files[str(relative)] = adapted
            if policy is not None:
                files[str(relative.parent / 'agents/openai.yaml')] = policy
                translations.append({'path': str(relative), 'original_sha256': prepare.sha(raw),
                                     'adapter_sha256': prepare.sha(adapted), 'body_unchanged': True,
                                     'from': 'disable-model-invocation: true',
                                     'to': 'policy.allow_implicit_invocation: false'})
        elif relative.name == 'LICENSE' and len(relative.parts) == 1:
            files[str(relative)] = raw
        else:
            raise ValueError('unreviewed original package file')
    if 'LICENSE' not in files or not any(path.endswith('/SKILL.md') for path in files):
        raise ValueError('incomplete original package')
    metadata = {'name': name, 'version': '0.0.0',
                'description': 'Local comparison adapter for pinned source skill bodies.', 'license': 'MIT'}
    if host == 'codex':
        metadata.update(author={'name': AUTHOR}, skills='./skills/', interface={
            'displayName': name + ' original comparison',
            'shortDescription': 'Pinned source skills for local comparison.',
            'longDescription': 'Original skill bodies and licenses are unchanged. Host metadata translations are recorded separately.',
            'developerName': AUTHOR, 'category': 'Productivity', 'capabilities': [],
            'defaultPrompt': ['Load the original ' + name + ' skill for the upcoming task.']})
    files[f'.{host}-plugin/plugin.json'] = (json.dumps(metadata, indent=2) + '\n').encode('utf-8')
    return files, translations
