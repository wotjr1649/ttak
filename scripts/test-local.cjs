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
const files = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs') &&
  (process.platform === 'win32' || name !== 'bounded-native-process.test.cjs')).sort().map(name => 'tests/' + name);
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
      const named = log.split('\n').filter(line => line.startsWith('not ok ')).join('\n');
      process.stderr.write((named && named + '\n\n') + log.slice(-10000));
      process.exitCode = 1; break;
    }
  }
} finally {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ platform: process.platform, node: process.version,
    windows_process_suite: process.platform === 'win32', results }, null, 2) + '\n');
  if (path.dirname(fs.realpathSync(temporary)) !== fs.realpathSync(output)) throw new Error('unexpected_temporary_path');
  fs.rmSync(temporary, { recursive: true });
}
