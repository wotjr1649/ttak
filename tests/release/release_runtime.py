"""Reviewed bundled transport and bounded native execution, without model grading."""
import json
import hashlib
import os
from pathlib import Path
import subprocess

from prepare import ROOT


NATIVE_BINARIES = {
    'claude': (Path('C:/Users/js/.local/share/claude/versions/2.1.266'),
               'd2c5f7b3b6a12819097ceb6efbce2a390157166003fcaee32dbde0e6d7b45ef7'),
    'codex': (Path('C:/Users/js/.codex/packages/standalone/releases/0.154.0-x86_64-pc-windows-msvc/bin/codex.exe'),
              'be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde'),
}
RUNTIME_BINARIES = {
    'node': Path('C:/Program Files/nodejs/node.exe'),
    'powershell': Path('C:/Program Files/PowerShell/7/pwsh.exe'),
}


def native_binary(host):
    """Use the reviewed executable, never whichever alias happens to win PATH."""
    if host not in NATIVE_BINARIES:
        raise ValueError('unknown native host')
    executable, expected = NATIVE_BINARIES[host]
    with executable.open('rb') as handle:
        observed = hashlib.file_digest(handle, 'sha256').hexdigest()
    if observed != expected:
        raise ValueError('native executable changed; review before collection')
    return str(executable)


def checked_timeout(seconds):
    if type(seconds) is not int or not 1 <= seconds <= 2147450:
        raise ValueError('an explicit finite model execution budget is required')
    return seconds


def reviewed_mcp(host, plugin_roots, condition):
    """Return the exact reviewed declaration path, not a new transport override.

    The normal Codex plugin loads its inline declaration from plugin.json.
    Only the legacy Claude collector consumes a companion MCP file directly.
    """
    if host not in ('claude', 'codex') or condition not in ('baseline', 'original', 'ttak'):
        raise ValueError('unknown host or comparison condition')
    selected = None
    for plugin_root in plugin_roots:
        plugin_root = Path(plugin_root).resolve(strict=True)
        if (plugin_root / '.mcp.json').exists():
            raise ValueError('unreviewed root MCP declaration')
        for folder in ('.claude-plugin', '.codex-plugin'):
            manifest_path = plugin_root / folder / 'plugin.json'
            if not manifest_path.exists():
                continue
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            config = manifest.get('mcpServers')
            if config is None:
                if (plugin_root / folder / 'mcp.json').exists():
                    raise ValueError('undeclared MCP configuration')
                continue
            inline = folder == '.codex-plugin' and isinstance(config, dict)
            if inline and (plugin_root / folder / 'mcp.json').exists():
                raise ValueError('unexpected duplicate MCP configuration')
            expected = inline or (folder == '.claude-plugin' and config == f'./{folder}/mcp.json')
            if condition != 'ttak' or manifest.get('name') != 'ttak' or not expected:
                raise ValueError('unreviewed plugin MCP declaration')
            # Compare the complete installed executable dependency closure to the
            # candidate whose bytes the caller has verified against the freeze.
            import low_study
            files = low_study.source_files()
            runtime = {'scripts/scenario-draft.cjs', 'scripts/scenario-feedback-mcp.cjs',
                       'scripts/explanation-attempt.cjs', 'scripts/explanation-request-source.cjs', 'scripts/explanation-result-source.cjs', 'scripts/explanation-source-model.cjs',
                       'scripts/explanation-verification.cjs', 'scripts/explanation-review-checks.cjs', 'scripts/verification-packet.cjs',
                       'scripts/review-native-format.cjs', 'scripts/review-roles.cjs',
                       'scripts/review-anchors.cjs', 'scripts/source-text-anchors.cjs',
                       'agents/ttak-fact-check.md',
                       'scripts/finite-scenario.cjs', 'scripts/finite-scenario-render.cjs',
                       'scripts/finite-scenario-mcp.cjs', 'scripts/review-mcp.cjs',
                       'scripts/review-session.cjs', 'scripts/review-repair.cjs'}
            for name, raw in files.items():
                if name not in runtime and not name.startswith(('hooks/', 'policy/', 'skills/', '.claude-plugin/', '.codex-plugin/')):
                    continue
                target = plugin_root / name
                if target.is_symlink() or target.resolve(strict=True) != target.absolute() or target.read_bytes() != raw:
                    raise ValueError('installed candidate differs from reviewed runtime')
            active = '.claude-plugin' if host == 'claude' else '.codex-plugin'
            if folder == active:
                if selected is not None:
                    raise ValueError('ambiguous candidate transport')
                selected = manifest_path if inline else plugin_root / folder / 'mcp.json'
    if condition == 'ttak' and (len(plugin_roots) != 1 or selected is None):
        raise ValueError('candidate must provide exactly one reviewed bundled transport')
    return selected


def invoke_bounded(args, prompt, cwd, env, timeout):
    checked_timeout(timeout)
    if os.name != 'nt':
        raise ValueError('this collector requires its reviewed Windows process supervisor')
    node, powershell = RUNTIME_BINARIES['node'], RUNTIME_BINARIES['powershell']
    if not node.is_file() or not powershell.is_file() or not Path(args[0]).is_absolute():
        raise ValueError('native runtime must resolve to absolute executable paths')
    request = {'executable': args[0], 'arguments': args[1:], 'cwd': str(Path(cwd).resolve()),
               'input': prompt, 'timeoutMs': timeout * 1000, 'cleanupMs': 5000,
               'stdoutLimit': 1048576, 'stderrLimit': 65536}
    # The Node helper uses a job assigned before the native process starts.
    # A supervisor timeout is an unverified cleanup failure, never a retry signal.
    result = subprocess.run([str(node), str(ROOT / 'scripts/bounded-native-cli.cjs'), str(powershell)],
                            input=json.dumps(request), cwd=cwd, env=env, capture_output=True,
                            text=True, encoding='utf-8', errors='strict', timeout=timeout + 40)
    if result.returncode:
        raise ValueError('native supervisor failed; cleanup unverified')
    value = json.loads(result.stdout)
    if not value.get('cleanupVerified') or value.get('activeProcesses') != 0 or not value.get('assignedBeforeResume'):
        raise ValueError('native process cleanup unverified')
    return value
