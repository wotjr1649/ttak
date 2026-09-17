'use strict';
// Offline suite entry point. Native model collectors are never invoked here.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const python = require('./test-python.cjs').testPython();
const output = path.join(root, '.superpowers/local-checks');
fs.mkdirSync(output, { recursive: true });
const temporary = fs.mkdtempSync(path.join(output, 'temporary-'));
const allowed = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'SYSTEMDRIVE', 'TTAK_TEST_PYTHON']);
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.has(name.toUpperCase())));
Object.assign(env, { TEMP: temporary, TMP: temporary, TMPDIR: temporary, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' });
env.TTAK_TEST_PYTHON = python;
// The native collector is Windows-only by design -- it supervises through a job
// object assigned before the process starts, and scripts/verification-execution.cjs
// names pwsh.exe by absolute path. The suites that drive it therefore have nothing
// to exercise elsewhere. Listed by the reason rather than one-by-one as they are
// noticed: bounded-native-process was gated from the start, the other two were not,
// and on the branch's first CI run they failed 23 times on ubuntu for no reason but
// the platform. Excluded from the file list rather than skipped inside it, because
// the run also asserts zero skipped assertions.
const windowsOnly = new Set(['bounded-native-process.test.cjs', 'verification-execution.test.cjs',
  'verification-native-evidence.test.cjs']);
const files = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs') &&
  (process.platform === 'win32' || !windowsOnly.has(name))).sort().map(name => 'tests/' + name);
const commands = [
  ['node-tests', process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...files]],
  ['python-tests', python, ['-B', '-m', 'unittest', 'discover', '-s', 'tests/release', '-p', 'test_*.py']],
  ['conformance', python, ['-B', 'tests/conformance/run.py', '--selftest']]
];
const results = [];
try {
  for (const [name, executable, args] of commands) {
    const started = Date.now();
    const run = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8', timeout: 180000,
      maxBuffer: 4194304, windowsHide: true });
    const log = (run.stdout || '') + (run.stderr || '');
    fs.writeFileSync(path.join(output, name + '.log'), log);
    const noSkipped = name === 'node-tests' ? /^# skipped 0$/m.test(log) : !/\bskipped=\d+/i.test(log);
    const ok = run.status === 0 && !run.error && noSkipped;
    results.push({ name, ok, exit_code: run.status, elapsed_ms: Date.now() - started,
      ...(name === 'node-tests' ? { files: files.length, tests: Number(log.match(/^# tests (\d+)$/m)?.[1]), no_skips: noSkipped } : {}) });
    process.stdout.write(JSON.stringify(results.at(-1)) + '\n');
    if (!ok) {
      // The tail alone is useless when a suite fails early: TAP prints the
      // failures where they happen and the last 10k is whatever passed after
      // them. A CI run reporting 23 failures and naming none is a check
      // nobody can act on, so name them first, then keep the tail.
      // Names alone were not enough the first time this mattered: a Windows job
      // failed two process-supervision tests on one run and passed the next two,
      // and the assertion that broke was in the YAML block after the `not ok`
      // line, which the tail had dropped. Keep each failing entry with the block
      // that follows it.
      const entries = log.split(/(?=^not ok )/m).slice(1)
        .map(part => part.split(/^ok /m)[0].split(/^# Subtest/m)[0].trimEnd())
        .join('\n\n');
      process.stderr.write((entries && entries + '\n\n') + log.slice(-10000));
      process.exitCode = 1; break;
    }
  }
} finally {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ platform: process.platform, node: process.version,
    windows_process_suite: process.platform === 'win32', results }, null, 2) + '\n');
  if (path.dirname(fs.realpathSync(temporary)) !== fs.realpathSync(output)) throw new Error('unexpected_temporary_path');
  fs.rmSync(temporary, { recursive: true });
}
