'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { boundedNativeProcess, checkedTimeoutMs, MAX_TIMEOUT_MS } = require('../scripts/bounded-native-process.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(__dirname, 'fixtures/native-process.cjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['SYSTEMROOT', 'WINDIR', 'PATH', 'TEMP', 'TMP'].includes(key.toUpperCase())));
const settings = { powershell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', env };
// A harness ceiling, not an assertion. Every test here asserts what the supervisor
// returned -- status, cleanup, active processes -- and none asserts how fast. At
// 15s two of them timed out on a windows-latest runner that took 110s for a node
// suite this machine runs in 75s, then passed on the next run. A budget that fails
// for being on a busy runner reports the runner, so it is sized to survive one; a
// real hang still fails, just later.
const BUDGET = 45000;
const run = (mode, overrides = {}, args = []) => boundedNativeProcess({ executable: process.execPath,
  arguments: [fixture, mode, ...args], cwd: root, input: '', timeoutMs: 3000, stdoutLimit: 65536,
  stderrLimit: 4096, cleanupMs: 3000, ...overrides }, settings);

test('inference budgets are explicit, finite and may exceed two minutes', () => {
  for (const value of [undefined, null, 0, -1, Infinity, NaN, '300000', MAX_TIMEOUT_MS + 1]) {
    assert.throws(() => checkedTimeoutMs(value), /explicit_native_time_budget_required/);
  }
  assert.equal(checkedTimeoutMs(300000), 300000);
});

test('Windows supervisor accepts a caller budget above the former ceiling', { timeout: BUDGET }, async () => {
  const result = await run('echo', { timeoutMs: 300000, input: 'caller-selected budget' });
  assert.equal(result.status, 'exited');
  assert.equal(JSON.parse(result.stdout).input, 'caller-selected budget');
  assert.equal(result.cleanupVerified, true);
  assert.equal(result.activeProcesses, 0);
});

test('real Windows process preserves stdin and Windows argument quoting', { timeout: BUDGET }, async () => {
  const args = ['space value', '', 'a"b', 'trailing\\', '한글 😀', '$(not-a-command)'];
  const result = await run('echo', { input: 'quoted " input\n한글 😀' }, args);
  assert.equal(result.status, 'exited'); assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), { input: 'quoted " input\n한글 😀', args });
  assert.equal(result.assignedBeforeResume, true); assert.equal(result.activeProcesses, 0);
});
test('normal parent exit also removes its detached child', { timeout: BUDGET }, async () => {
  const result = await run('orphan');
  assert.equal(result.status, 'exited'); assert.ok(result.totalProcesses >= 2);
  assert.equal(result.cleanupVerified, true); assert.equal(result.activeProcesses, 0);
  const pid = Number(result.stdout); assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});
test('timeout removes the parent and descendants and withholds partial output', { timeout: BUDGET }, async () => {
  const result = await run('hang', { timeoutMs: 800 });
  assert.equal(result.status, 'timeout'); assert.ok(result.totalProcesses >= 2);
  assert.equal(result.activeProcesses, 0); assert.equal(result.stdout, '');
  assert.throws(() => process.kill(result.pid, 0), { code: 'ESRCH' });
});
test('stdout and stderr limits stop processes without returning oversized contents', { timeout: 20000 }, async () => {
  for (const mode of ['stdout', 'stderr']) {
    const result = await run(mode, { stdoutLimit: 1024, stderrLimit: 1024 });
    assert.equal(result.status, 'output_limit'); assert.equal(result.activeProcesses, 0);
    assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  }
});
test('nonzero native exit remains observable after verified cleanup', { timeout: BUDGET }, async () => {
  const result = await run('exit'); assert.equal(result.exitCode, 7);
  assert.equal(result.cleanupVerified, true);
});
