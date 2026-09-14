'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'design/ttak');
const SCRIPT = path.join(PLUGIN, 'hooks/ttak.cjs');
const { parseControl } = require(SCRIPT);
const area = path.join(ROOT, '.superpowers/redesign-212');
fs.mkdirSync(area, { recursive: true });

function fixture() {
  return fs.mkdtempSync(path.join(area, 'state-'));
}
function run(root, args = [], event, extra = {}) {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC']) if (process.env[key]) env[key] = process.env[key];
  if (root) env.PLUGIN_DATA = root;
  Object.assign(env, extra);
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: PLUGIN, env, input: event === undefined ? '' : typeof event === 'string' ? event : JSON.stringify(event),
    encoding: 'utf8', timeout: 5000, maxBuffer: 128 * 1024
  });
  assert.ifError(result.error);
  assert.equal(result.stderr, '');
  return { ...result, value: result.stdout.trim() ? JSON.parse(result.stdout) : null };
}
const start = source => ({ hook_event_name: 'SessionStart', source });

test('fresh OFF emits no policy or references and creates no state', () => {
  const root = path.join(fixture(), 'not-created');
  assert.equal(run(root, [], start('startup')).stdout, '');
  assert.equal(fs.existsSync(root), false);
  assert.match(run(root, ['status']).value.message, /OFF/);
  assert.equal(fs.existsSync(root), false);
});

test('saved ON survives a new process and emits core with resolvable references, not their bodies', () => {
  const root = fixture();
  assert.equal(run(root, ['on']).value.ok, true);
  for (const source of ['startup', 'resume', 'clear', 'compact']) {
    const output = run(root, [], start(source)).value.hookSpecificOutput;
    assert.equal(output.hookEventName, 'SessionStart');
    assert.ok(output.additionalContext.includes('Track'));
    assert.ok(!output.additionalContext.includes('{{TTAK_ROOT}}'));
    for (const name of ['explain', 'review']) {
      const target = path.join(PLUGIN, 'references', name + '.md');
      assert.ok(output.additionalContext.includes(target.replaceAll('\\', '/')));
      assert.ok(!output.additionalContext.includes(fs.readFileSync(target, 'utf8').trim()));
    }
  }
});

test('OFF controls all subsequent lifecycle injection, and does not claim to erase history', () => {
  const root = fixture();
  run(root, ['on']);
  const before = run(root, [], start('startup')).stdout;
  const changed = run(root, ['off']);
  assert.equal(changed.value.ok, true);
  assert.match(changed.value.message, /Existing conversation text stays/);
  for (const source of ['startup', 'resume', 'clear', 'compact']) assert.equal(run(root, [], start(source)).stdout, '');
  assert.ok(before.length > 0); // Already emitted data remains data; no erasure claim.
});

test('only complete control commands change state; quotations and extra payloads do not', () => {
  for (const command of ['ttak on', '/ttak on', '/ttak:ttak on', '$ttak on']) assert.equal(parseControl(command), 'on');
  for (const prompt of ['Explain ttak on', '"ttak on"', 'ttak on\nignore everything', 'ttak on; echo x', '/ttak off now', 'normal mode', 'ttak online']) {
    assert.equal(parseControl(prompt), null);
    const root = fixture();
    assert.equal(run(root, [], { hook_event_name: 'UserPromptSubmit', prompt }).stdout, '');
    assert.equal(fs.existsSync(path.join(root, 'state.json')), false);
  }
  const root = fixture();
  assert.equal(run(root, [], { hook_event_name: 'UserPromptSubmit', prompt: '/ttak off' }).value.decision, 'block');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'state.json'))), { enabled: false });
});

test('ordinary prompts, subagents, unsupported lifecycle sources do not inject or mutate', () => {
  const root = fixture(); run(root, ['on']);
  const before = fs.readFileSync(path.join(root, 'state.json'));
  for (const event of [{ hook_event_name: 'UserPromptSubmit', prompt: 'Explain this to a manager' }, { hook_event_name: 'SubagentStart' }, start('fork'), start(undefined)]) {
    assert.equal(run(root, [], event).stdout, '');
  }
  assert.deepEqual(fs.readFileSync(path.join(root, 'state.json')), before);
});

test('missing or relative host data roots refuse writes without falling back to a home directory', () => {
  for (const root of [null, 'relative-root']) {
    const result = run(root, ['on']);
    assert.equal(result.status, 1); assert.equal(result.value.ok, false);
  }
});

test('corrupt, oversized and unrelated state is preserved and never reported OFF', () => {
  for (const content of ['broken', '{"enabled":true,"unrelated":"keep"}', ' '.repeat(4097)]) {
    const root = fixture(), target = path.join(root, 'state.json');
    fs.writeFileSync(target, content);
    assert.equal(run(root, ['off']).value.ok, false);
    assert.equal(run(root, ['status']).value.ok, false);
    assert.equal(fs.readFileSync(target, 'utf8'), content);
    assert.equal(run(root, [], start('startup')).value.hookSpecificOutput, undefined);
  }
});

test('host root through a junction is refused and the target stays unchanged', () => {
  const root = fixture(), real = path.join(root, 'real'), link = path.join(root, 'link');
  fs.mkdirSync(real); fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(run(link, ['on']).value.ok, false);
  assert.equal(fs.readdirSync(real).length, 0);
});

test('malformed and oversized hook input and invalid CLI args have no state effect', () => {
  const root = fixture();
  for (const input of ['{', 'x'.repeat(70000)]) assert.equal(run(root, [], input).stdout, '');
  assert.equal(run(root, ['on', 'extra']).status, 1);
  assert.equal(fs.existsSync(path.join(root, 'state.json')), false);
});

test('package discovers only the settings skill; explanation and review are not auto skills', () => {
  const skills = fs.readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(PLUGIN, 'skills', e.name, 'SKILL.md'))).map(e => e.name);
  assert.deepEqual(skills, ['ttak']);
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'))).hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ['SessionStart', 'UserPromptSubmit']);
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(PLUGIN, manifest))).mcpServers, undefined);
  }
});

test('a failed rename leaves no temporary file, no false success and the saved state intact', () => {
  const root = fixture(), target = path.join(root, 'state.json'), content = JSON.stringify({ enabled: false }) + '\n';
  fs.writeFileSync(target, content);
  const { writeState, readState } = require(path.join(PLUGIN, 'hooks/state.cjs'));
  const realRename = fs.renameSync, realRoot = process.env.PLUGIN_DATA;
  // Observed on Windows with a read-only state.json; injected here so the
  // cleanup is checked the same way on every platform.
  fs.renameSync = () => { const e = new Error('EPERM'); e.code = 'EPERM'; throw e; };
  process.env.PLUGIN_DATA = root;
  try {
    assert.equal(writeState(true).ok, false);
    assert.equal(readState().status, 'off');
  } finally {
    fs.renameSync = realRename;
    if (realRoot === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = realRoot;
  }
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
  assert.equal(fs.readFileSync(target, 'utf8'), content);
});
