"""Freeze or verify low-model comparison inputs offline. Never launch a model.

Preparation is not permission to run the comparison or evidence of product quality.
"""
import argparse
import json
from pathlib import Path

import low_models
import prepare

ROOT = prepare.ROOT


def protocol():
    legacy = prepare.protocol()
    old = '- Claude Sonnet 5 (`claude-sonnet-5`), medium effort.'
    if legacy.count(old) != 1:
        raise ValueError('historical model section changed; review the new protocol')
    active = legacy.replace(old, '- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), thinking enabled; '
                            'requested MAX_THINKING_TOKENS=8192; effort unsupported. '
                            'Record observed thinking separately from the requested cap.')
    current = (ROOT / 'docs/LOW_MODEL_RELEASE.ko.md').read_text(encoding='utf-8')
    start, end = '## 합격 판정\n', '## 실행 순서와 상한\n'
    if current.count(start) != 1 or current.count(end) != 1:
        raise ValueError('low-model acceptance section is ambiguous')
    return active + '\n' + start + current.split(start)[1].split(end)[0]


def source_files():
    names = prepare.POLICY + prepare.SKILLS + [
        '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'hooks/hooks.json',
        '.claude-plugin/mcp.json',
        'scripts/scenario-draft.cjs', 'scripts/scenario-feedback-mcp.cjs',
        'scripts/explanation-attempt.cjs', 'scripts/explanation-request-source.cjs', 'scripts/explanation-result-source.cjs', 'scripts/explanation-source-model.cjs',
        'scripts/explanation-verification.cjs', 'scripts/explanation-review-checks.cjs', 'scripts/verification-packet.cjs',
        'scripts/review-native-format.cjs', 'scripts/review-roles.cjs',
        'scripts/review-anchors.cjs', 'scripts/source-text-anchors.cjs',
        'agents/ttak-fact-check.md',
        'scripts/finite-scenario.cjs', 'scripts/finite-scenario-render.cjs',
        'scripts/finite-scenario-mcp.cjs', 'scripts/review-mcp.cjs',
        'scripts/review-session.cjs', 'scripts/review-repair.cjs',
        'hooks/ttak.cjs', 'hooks/scenario-stop.cjs', 'hooks/scenario-evidence.cjs', 'assets/logo.png', 'tests/release/cases.json',
        'tests/release/prepare.py', 'tests/release/collect.py', 'tests/release/codex_profile.py',
        'tests/release/low_models.py', 'tests/release/low_study.py',
        'tests/release/release_runtime.py', 'tests/release/hook_review.py',
        'tests/release/normal_results.py', 'tests/release/normal_commands.py', 'tests/release/normal_turn.py',
        'tests/release/original_adapter.py',
        'tests/release/normal_profile.py', 'tests/release/normal-select.cjs',
        'tests/release/normal_trial.py', 'tests/release/normal_campaign.py',
        'tests/release/normal-events.cjs', 'tests/release/normal-parse.cjs',
        'tests/release/normal-rpc.cjs', 'tests/release/normal-codex.cjs',
        'tests/release/normal-history.cjs', 'scripts/review-native.cjs',
        'tests/release/normal-state.cjs',
        'scripts/scenario-native-audit.cjs', 'scripts/bounded-native-process.cjs',
        'scripts/bounded-native-cli.cjs', 'scripts/windows-job.cs', 'scripts/windows-job.ps1',
        'tests/release/fixtures/project.py', 'tests/release/verify_project.py',
        'tests/release/sources/manifest.json']
    names += ['tests/release/sources/' + record['path'] for record in prepare.source_records()]
    files = {}
    for name in sorted(set(names)):
        path = ROOT / name
        if path.is_symlink() or path.resolve(strict=True) != path.absolute() or not path.is_file():
            raise ValueError('source must be an ordinary task-local file')
        files[name] = path.read_bytes()
    return files


def snapshot():
    suite = prepare.load_suite()
    suite['hosts'] = {host: low_models.settings(host) for host in low_models.HOSTS}
    suite['study'] = low_models.STUDY
    rows = low_models.plan()
    files = source_files()
    text = protocol()
    manifest = {'schema_version': 1, 'study': low_models.STUDY, 'planned_trials': len(rows),
                'files': [{'path': name, 'sha256': prepare.sha(raw)} for name, raw in files.items()],
                'protocol_sha256': prepare.sha(text.encode('utf-8')), 'budget': low_models.budget(rows),
                'status': 'prepared only; no subject trials executed',
                'qualification': False,
                'call_accounting': {'unit': 'top-level native CLI subject/activation or grading request',
                                    'internal_tool_and_stop_turns': 'record separately; not extra comparison subjects',
                                    'claude_max_agentic_turns_per_request': 20,
                                    'cost_claim': '516 requests is not a fixed token or monetary cost'},
                'execution_prerequisites': ['Resolve known candidate defects before full comparison',
                                            'Freeze the actual collector, installed delivery and runtime versions',
                                            'Verify native subscription, model, settings and instruction delivery'],
                'experimental_review_integrated': True,
                'normal_plugin_collector_ready': True,
                'scenario_feedback_bundled': True}
    return files, {'manifest.json': manifest, 'plan.json': rows, 'cases.json': suite}, text


def destination_path(destination, *, exists):
    path = Path(destination)
    resolved = path.resolve(strict=exists)
    runtime = (ROOT / '.superpowers').resolve(strict=True)
    if path.is_symlink() or not resolved.is_relative_to(runtime) or resolved == runtime:
        raise ValueError('study must be below this worktree task-runtime directory')
    if exists and not resolved.is_dir():
        raise ValueError('study destination must be a directory')
    return resolved


def freeze(destination):
    destination = destination_path(destination, exists=False)
    if destination.exists():
        raise ValueError('study already exists; never overwrite a frozen run')
    files, artifacts, text = snapshot()
    destination.mkdir(parents=True)
    for name, raw in files.items():
        target = destination / 'inputs' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as handle:
            handle.write(raw)
    for name, value in artifacts.items():
        with (destination / name).open('x', encoding='utf-8', newline='\n') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
    with (destination / 'protocol.md').open('x', encoding='utf-8', newline='\n') as handle:
        handle.write(text)
    return artifacts['manifest.json']


def verify_freeze(destination):
    destination = destination_path(destination, exists=True)
    files, artifacts, text = snapshot()
    expected_paths = set(artifacts) | {'protocol.md'} | {'inputs/' + name for name in files}
    # Reject extra auto-discoverable instructions or links without reading their contents.
    found, pending, entries = set(), [destination], 0
    while pending:
        for path in pending.pop().iterdir():
            entries += 1
            if entries > 4096 or path.is_symlink() or path.is_junction():
                raise ValueError('unexpected study tree or link')
            if path.is_dir():
                pending.append(path)
            elif path.is_file():
                found.add(path.relative_to(destination).as_posix())
            else:
                raise ValueError('unexpected study entry')
    if found != expected_paths:
        raise ValueError('study files missing or unexpected')
    for name, value in artifacts.items():
        if (destination / name).stat().st_size > 2_000_000:
            raise ValueError('oversized frozen metadata')
        if json.loads((destination / name).read_text(encoding='utf-8')) != value:
            raise ValueError('frozen metadata or current source changed')
    if (destination / 'protocol.md').stat().st_size > 2_000_000:
        raise ValueError('oversized frozen protocol')
    if (destination / 'protocol.md').read_text(encoding='utf-8') != text:
        raise ValueError('frozen protocol changed')
    for name, raw in files.items():
        path = destination / 'inputs' / name
        if path.stat().st_size != len(raw) or path.read_bytes() != raw:
            raise ValueError('frozen source copy changed')
    return artifacts['manifest.json']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--freeze', type=Path)
    mode.add_argument('--verify-freeze', type=Path)
    args = parser.parse_args()
    result = freeze(args.freeze) if args.freeze else verify_freeze(args.verify_freeze)
    print(json.dumps({'study': result['study'], 'trials': result['planned_trials'],
                      'budget': result['budget'], 'qualification': False, 'model_calls': 0}))


if __name__ == '__main__':
    main()
