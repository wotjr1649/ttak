"""Reviewed bundled transport and bounded native execution, without model grading."""
import json
import hashlib
import os
import re
from pathlib import Path
import subprocess

from prepare import ROOT


NATIVE_BINARY_ROOTS = {
    'claude': Path('C:/Users/js/.local/share/claude/versions'),
    'codex': Path('C:/Users/js/.codex/packages/standalone/releases'),
}
NATIVE_LEDGER = ROOT / 'tests' / 'release' / 'native-binaries.json'
RUNTIME_BINARIES = {
    'node': Path('C:/Program Files/nodejs/node.exe'),
    'powershell': Path('C:/Program Files/PowerShell/7/pwsh.exe'),
}


def _version_key(text):
    """A sortable key, or None when the name is not a version."""
    parts = text.split('.')
    if len(parts) < 2 or not all(part.isdigit() for part in parts):
        return None
    return tuple(int(part) for part in parts)


def _current_binary(host):
    """The newest build the host has installed, read off disk.

    Deliberately not `<host> --version`: the offline suite runs with a filtered
    environment, so a subprocess here fails for reasons that have nothing to do
    with what is being checked. The install directory is the same fact without
    the process.
    """
    root = NATIVE_BINARY_ROOTS[host]
    best = None
    for entry in sorted(root.iterdir()) if root.is_dir() else []:
        if host == 'claude':
            key, executable = _version_key(entry.name), entry
            version = entry.name
        else:
            version = entry.name.split('-')[0]
            key, executable = _version_key(version), entry / 'bin' / 'codex.exe'
        if key is None or not executable.is_file():
            continue
        if best is None or key > best[0]:
            best = (key, version, executable)
    if best is None:
        raise ValueError('%s: no installed build under %s' % (host, root))
    return best[1], best[2]


def native_binary(host):
    """Use an explicit executable, never whichever alias wins PATH -- and know
    which bytes it was.

    The version is deliberately not pinned. It cannot usefully be: the host
    updates itself and keeps only the last few builds, so a hash fixed here dies
    within days, and when it dies it fails identically whether the host updated
    or somebody replaced the binary. A check that fails routinely for a benign
    reason is one people learn to skip, and then it cannot report the real one.

    What is checked instead is immutability, which survives updates. A version
    seen for the first time is recorded. A version already in the ledger whose
    bytes have changed fails: an update issues a new version number, tampering
    reuses an old one. What is given up is pre-approval of builds that did not
    exist when the approval was written, which was never achievable here.
    """
    if host not in NATIVE_BINARY_ROOTS:
        raise ValueError('unknown native host')
    version, executable = _current_binary(host)
    with executable.open('rb') as handle:
        observed = hashlib.file_digest(handle, 'sha256').hexdigest()
    ledger = {}
    if NATIVE_LEDGER.exists():
        ledger = json.loads(NATIVE_LEDGER.read_text(encoding='utf-8'))
    seen = ledger.setdefault(host, {}).get(version)
    if seen is not None and seen != observed:
        raise ValueError(
            '%s %s: bytes changed for a version already recorded (%s -> %s); an update '
            'would have issued a new version number' % (host, version, seen[:12], observed[:12]))
    if seen is None:
        ledger[host][version] = observed
        NATIVE_LEDGER.parent.mkdir(parents=True, exist_ok=True)
        NATIVE_LEDGER.write_text(json.dumps(ledger, indent=2, sort_keys=True) + '\n',
                                 encoding='utf-8', newline='\n')
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
