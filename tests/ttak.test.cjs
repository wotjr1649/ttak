const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHECKER = path.join(ROOT, 'scripts', 'check-id-sets.cjs');
const { ids, docs } = require(CHECKER);

function run(args) {
  return execFileSync(process.execPath, [CHECKER, ...args],
    { cwd: ROOT, encoding: 'utf8' });
}

test('English and Korean documents carry identical requirement-ID sets', () => {
  assert.match(run([]), /ID sets match: \d+ ids/);
});

test('both documents define exactly 157 requirements', () => {
  const { EN, KO } = docs();
  assert.strictEqual(ids(EN).size, 157);
  assert.strictEqual(ids(KO).size, 157);
  assert.match(run([]), /ID sets match: 157 ids/);
});

test('the v0.2 amendment moved the set by exactly four members', () => {
  // The pre-amendment set held 157 IDs. Given the total is still 157, these
  // four membership facts pin the set exactly: two additions plus an
  // unchanged total force exactly two removals, and they are named here.
  // Any other substitution would change the total or one of these four.
  for (const [lang, file] of Object.entries(docs())) {
    const set = ids(file);
    assert.ok(set.has('TTAK-TRACK-008'), `${lang}: TTAK-TRACK-008 not defined`);
    assert.ok(set.has('TTAK-TRIM-009'), `${lang}: TTAK-TRIM-009 not defined`);
    assert.ok(!set.has('SRC-006'), `${lang}: retired SRC-006 still defined`);
    assert.ok(!set.has('LIC-004'), `${lang}: retired LIC-004 still defined`);
  }
});

test('deleting one requirement definition fails the check', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-idset-'));
  try {
    const dir = path.join(tmp, 'docs');
    fs.mkdirSync(dir);
    const src = docs();
    for (const file of Object.values(src)) {
      fs.copyFileSync(file, path.join(dir, path.basename(file)));
    }

    const ko = path.join(dir, path.basename(src.KO));
    const before = fs.readFileSync(ko, 'utf8');
    const after = before.replace(/^- \[TTAK-TRIM-009\].*\r?\n/m, '');
    assert.notStrictEqual(after, before, 'fixture removed nothing');
    fs.writeFileSync(ko, after);
    assert.strictEqual(ids(ko).size, 156, 'fixture left the definition count unchanged');

    assert.throws(() => run([dir]), (err) => {
      assert.notStrictEqual(err.status, 0, 'checker exited 0 on a deleted requirement');
      assert.match(err.stderr, /Only in EN: TTAK-TRIM-009/);
      return true;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

const { checkHygiene } = require('./lint/check-hygiene.cjs');

test('no shipped file contains a CR byte', () => {
  const { crFiles } = checkHygiene(ROOT);
  assert.deepStrictEqual(crFiles, []);
});

test('every declared license string is MIT', () => {
  const { licenseMismatch } = checkHygiene(ROOT);
  assert.deepStrictEqual(licenseMismatch, []);
});

function withData(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-'));
  const prev = process.env.PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(dir, 'ttak-ttak');
  try { return fn(path.join(dir, 'ttak-ttak'), dir); }
  finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const ttak = require('../hooks/ttak.cjs');

test('absent state reads as absent, and lifecycle reads create nothing', () => {
  withData((leaf) => {
    assert.strictEqual(ttak.readState().status, 'absent');
    assert.strictEqual(fs.existsSync(leaf), false);
  });
});

test('a write creates the leaf directory and round-trips', () => {
  withData((leaf) => {
    assert.strictEqual(ttak.writeState(true).ok, true);
    assert.strictEqual(fs.existsSync(leaf), true);
    assert.strictEqual(ttak.readState().status, 'on');
    assert.strictEqual(ttak.writeState(false).ok, true);
    assert.strictEqual(ttak.readState().status, 'off');
  });
});

test('a missing parent is unavailable and is never created', () => {
  const prev = process.env.PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(os.tmpdir(), 'ttak-no-such-parent-xyz', 'ttak-ttak');
  try {
    assert.strictEqual(ttak.readState().status, 'unavailable');
    const res = ttak.writeState(true);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.refused, true);
    assert.strictEqual(fs.existsSync(path.join(os.tmpdir(), 'ttak-no-such-parent-xyz')), false);
  } finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
  }
});

test('corrupt but readable state is invalid, never guessed, and is repairable by a write', () => {
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true });
    fs.writeFileSync(path.join(leaf, 'state.json'), '{not json');
    assert.strictEqual(ttak.readState().status, 'invalid');
    assert.strictEqual(ttak.writeState(true).ok, true);
    assert.strictEqual(ttak.readState().status, 'on');
  });
});

test('a state path that is a directory is unavailable and is not repairable', () => {
  withData((leaf) => {
    fs.mkdirSync(path.join(leaf, 'state.json'), { recursive: true });
    assert.strictEqual(ttak.readState().status, 'unavailable');
    const res = ttak.writeState(true);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.refused, true);
  });
});

test('a leaf that is a file, not a directory, is unavailable and is not repairable', () => {
  withData((leaf) => {
    fs.writeFileSync(leaf, 'not a directory');
    assert.strictEqual(ttak.readState().status, 'unavailable');
    const res = ttak.writeState(true);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.refused, true);
  });
});

test('neither PLUGIN_DATA nor CLAUDE_PLUGIN_DATA set is unavailable, and writeState refuses without throwing', () => {
  const prevPlugin = process.env.PLUGIN_DATA;
  const prevClaude = process.env.CLAUDE_PLUGIN_DATA;
  delete process.env.PLUGIN_DATA;
  delete process.env.CLAUDE_PLUGIN_DATA;
  try {
    assert.strictEqual(ttak.readState().status, 'unavailable');
    let res;
    assert.doesNotThrow(() => { res = ttak.writeState(true); });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.refused, true);
  } finally {
    if (prevPlugin === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prevPlugin;
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prevClaude;
  }
});

test('main composition carries all three policy files, subagent carries two', () => {
  const main = ttak.compose('main');
  const sub = ttak.compose('subagent');
  assert.ok(main.includes('Precedence') && main.includes('Invariants') && main.includes('Response contract'));
  assert.ok(sub.includes('Precedence') && sub.includes('Invariants'));
  assert.ok(!sub.includes('Response contract'));
});

test('composition states the ranking to the model, not only to the specification', () => {
  const main = ttak.compose('main');
  assert.match(main, /yields to/i);
  assert.match(main, /not a guard/i);
});

test('policy text names every protected noun verbatim', () => {
  const main = ttak.compose('main');
  for (const noun of ['standard library', 'trust-boundary validation', 'data-loss prevention',
                      'accessibility', 'explicit output formats']) {
    assert.ok(main.includes(noun), `missing protected noun: ${noun}`);
  }
});

function withPolicyCopy(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-policy-'));
  for (const n of ['precedence', 'invariants', 'contract']) {
    fs.copyFileSync(path.join(ROOT, 'policy', `${n}.md`), path.join(dir, `${n}.md`));
  }
  try { mutate(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('composition is all-or-nothing when a required policy file is missing, for every file in every scope', () => {
  const scopeFiles = { main: ['precedence', 'invariants', 'contract'], subagent: ['precedence', 'invariants'] };
  for (const [scope, names] of Object.entries(scopeFiles)) {
    for (const missing of names) {
      withPolicyCopy((dir) => {
        fs.unlinkSync(path.join(dir, `${missing}.md`));
        assert.strictEqual(ttak.compose(scope, dir), null, `${scope} should be null when ${missing}.md is missing`);
      });
    }
  }
});

test('composition is all-or-nothing when a required policy file is empty', () => {
  withPolicyCopy((dir) => {
    fs.writeFileSync(path.join(dir, 'precedence.md'), '');
    assert.strictEqual(ttak.compose('main', dir), null);
    assert.strictEqual(ttak.compose('subagent', dir), null);
  });
});

test('an inherited Object.prototype key never reaches compose as a valid scope', () => {
  for (const scope of ['constructor', 'hasOwnProperty', '__proto__', 'toString']) {
    assert.strictEqual(ttak.compose(scope), null, `scope=${scope} should compose to null, not throw`);
  }
});

test('the provider-neutral scan finds nothing to flag in shipped policy text', () => {
  const { providerLeaks } = checkHygiene(ROOT);
  assert.deepStrictEqual(providerLeaks, []);
});

test('a non-string scope never reaches compose as valid, not even a null-prototype object or a symbol', () => {
  const cases = [
    ['null-prototype object', Object.create(null)],
    ['symbol', Symbol('x')],
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['plain object', {}],
  ];
  for (const [label, scope] of cases) {
    assert.strictEqual(ttak.compose(scope), null, `scope=${label} should compose to null, not throw`);
  }
});

test('exactly three control prompts are recognized', () => {
  assert.strictEqual(ttak.parseControl('ttak'), 'status');
  assert.strictEqual(ttak.parseControl('  TTAK ON '), 'on');
  assert.strictEqual(ttak.parseControl('ttak off'), 'off');
});

test('near misses are ordinary prompts', () => {
  for (const p of ['/ttak', 'ttak status', 'ttak on please', 'ttak.', 'ttak\non',
                   'is ttak on?', 'ttakon', '$ttak', 'ttak  on']) {
    assert.strictEqual(ttak.parseControl(p), null, `should be ordinary: ${JSON.stringify(p)}`);
  }
});

test('a non-string prompt never reaches parseControl as valid, not even a null-prototype object or a symbol', () => {
  const cases = [
    ['null-prototype object', Object.create(null)],
    ['symbol', Symbol('x')],
    ['array', ['ttak']],
    ['object whose toString throws', { toString() { throw new Error('boom'); } }],
    ['undefined', undefined],
  ];
  for (const [label, prompt] of cases) {
    assert.strictEqual(ttak.parseControl(prompt), null, `prompt=${label} should parse to null, not throw`);
  }
});

function runHook(input) { return ttak.handle(input); }

test('nothing is injected while off', () => {
  withData(() => {
    ttak.writeState(false);
    const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  });
});

test('SessionStart injects the main composition while on', () => {
  withData(() => {
    ttak.writeState(true);
    const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    const o = JSON.parse(r.stdout);
    assert.strictEqual(o.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.ok(o.hookSpecificOutput.additionalContext.includes('Response contract'));
  });
});

test('SubagentStart injects the reduced composition', () => {
  withData(() => {
    ttak.writeState(true);
    const o = JSON.parse(runHook({ hook_event_name: 'SubagentStart' }).stdout);
    assert.strictEqual(o.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.ok(!o.hookSpecificOutput.additionalContext.includes('Response contract'));
    assert.ok(o.hookSpecificOutput.additionalContext.includes('Invariants'));
  });
});

test('the first-session notice fires once and only while off', () => {
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true });
    const a = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.match(JSON.parse(a.stdout).hookSpecificOutput.additionalContext, /ttak on/);
    const b = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.strictEqual(b.stdout, '');
  });
});

test('a control prompt is blocked and never reaches the model', () => {
  withData(() => {
    const r = runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak on' });
    const o = JSON.parse(r.stdout);
    assert.strictEqual(o.decision, 'block');
    assert.strictEqual(ttak.readState().status, 'on');
    assert.ok(!JSON.stringify(o).includes('state.json'));
  });
});

test('an ordinary prompt is a no-op and fails open', () => {
  withData(() => {
    ttak.writeState(true);
    const r = runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'refactor this function' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  });
});

test('a control prompt is blocked even when state cannot be written', () => {
  const prev = process.env.PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(os.tmpdir(), 'ttak-no-parent-abc', 'ttak-ttak');
  try {
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak on' }).stdout);
    assert.strictEqual(o.decision, 'block');
    // Exact text, not just "no leaked path": a regression that reports
    // success ("TTAK saved setting: ON.") when nothing was written would
    // still pass a decision-only/no-leak check.
    assert.strictEqual(o.reason, 'TTAK could not read or write its saved setting. Nothing was changed.');
    assert.ok(!/ENOENT|[A-Za-z]:\\|\/tmp/.test(o.reason));
  } finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
  }
});

// --- fix round 1: reviewer findings C1, C2, I3, I4, I5, I6, M2 ---

test('the first-session notice fires even when the host never pre-created the leaf directory', () => {
  withData((leaf) => {
    // Leaf intentionally NOT created: the fresh-profile shape some hosts
    // leave behind (design §4.1) — parent exists, leaf does not, so
    // readState() reports 'absent'. C1: the notice used to require the leaf
    // to already exist and silently died here forever.
    assert.strictEqual(fs.existsSync(leaf), false, 'fixture must start truly absent, not pre-created');
    const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    const o = JSON.parse(r.stdout);
    assert.match(o.hookSpecificOutput.additionalContext, /ttak on/);
    assert.strictEqual(fs.existsSync(path.join(leaf, '.notified')), true);
  });
});

test('the notice never creates a leaf directory whose parent is also missing', () => {
  const prev = process.env.PLUGIN_DATA;
  const noParent = path.join(os.tmpdir(), 'ttak-notice-no-parent-xyz');
  process.env.PLUGIN_DATA = path.join(noParent, 'ttak-ttak');
  try {
    const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
    assert.strictEqual(fs.existsSync(noParent), false);
  } finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
  }
});

test('the status control prompt reports the saved setting without changing it', () => {
  withData(() => {
    ttak.writeState(true);
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.match(o.reason, /ON/);
    assert.strictEqual(ttak.readState().status, 'on');
  });
});

test('ttak off is blocked and saves the setting to off', () => {
  withData(() => {
    ttak.writeState(true);
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak off' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.match(o.reason, /OFF/);
    assert.strictEqual(ttak.readState().status, 'off');
  });
});

test('an unrelated lifecycle event is a no-op', () => {
  withData(() => {
    ttak.writeState(true);
    const r = runHook({ hook_event_name: 'PreToolUse' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  });
});

test('handle never injects a partial composition when policy is incomplete', () => {
  // M2: handle()'s compose() call is hardwired to POLICY_DIR (__dirname-
  // derived), so an incomplete policy/ can only be reached by isolating a
  // fresh copy of the module beside a deliberately incomplete policy/ — the
  // real repository is never touched, and an interrupted run cannot delete
  // shipped policy.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-isolated-policy-'));
  const hooksDir = path.join(tmp, 'hooks');
  fs.mkdirSync(hooksDir);
  fs.copyFileSync(path.join(ROOT, 'hooks', 'ttak.cjs'), path.join(hooksDir, 'ttak.cjs'));
  fs.mkdirSync(path.join(tmp, 'policy'));
  fs.copyFileSync(path.join(ROOT, 'policy', 'invariants.md'), path.join(tmp, 'policy', 'invariants.md'));
  // precedence.md and contract.md deliberately omitted: compose('main') must be null.
  fs.mkdirSync(path.join(tmp, 'data'));
  const prev = process.env.PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(tmp, 'data', 'ttak-ttak');
  try {
    const isolated = require(path.join(hooksDir, 'ttak.cjs'));
    assert.strictEqual(isolated.compose('main'), null, 'fixture is not actually incomplete');
    assert.strictEqual(isolated.writeState(true).ok, true);
    const r = isolated.handle({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  } finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- fix round 1: enumerate-every-branch sweep found two more real gaps ---

test('the status control prompt never claims ON or OFF when the saved setting is unreadable', () => {
  const ERR_TEXT = 'TTAK could not read or write its saved setting. Nothing was changed.';

  // invalid: leaf exists, state.json exists but is not parseable JSON.
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true });
    fs.writeFileSync(path.join(leaf, 'state.json'), '{not json');
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.strictEqual(o.reason, ERR_TEXT, `invalid state must report the bounded error, not guess ON/OFF: ${o.reason}`);
  });

  // unavailable: parent directory of PLUGIN_DATA does not exist at all.
  const prev = process.env.PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(os.tmpdir(), 'ttak-no-parent-abc', 'ttak-ttak');
  try {
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.strictEqual(o.reason, ERR_TEXT, `unavailable state must report the bounded error, not guess ON/OFF: ${o.reason}`);
  } finally {
    if (prev === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prev;
  }
});

test('SubagentStart does not receive the first-session notice even while absent', () => {
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true }); // leaf exists, state.json absent -> status 'absent'
    const r = runHook({ hook_event_name: 'SubagentStart' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  });
});

const { spawn } = require('node:child_process');

// --- fix round 2 (coordinator review): the env isolation used to live only
// in each test's six lines of save/set/restore boilerplate, which protects
// only the tests that remember to repeat it -- a new assertion that just
// calls spawnHook() with no isolation of its own inherits a real
// CLAUDE_PLUGIN_DATA and can write into another plugin's data directory.
// Moved the structural guard here so every caller is safe by default; the
// per-test isolation stays too (belt and braces), since it also isolates
// PLUGIN_DATA, which this function deliberately leaves alone so a test that
// sets it still propagates. This also gives the call its own bound: node:test
// has no default per-test timeout, so a broken/removed fallback must not be
// able to hang the suite. A killed child resolves instead of hanging, with a
// `killed` marker the assertions can check. ---
function spawnHook(payload, { closeStdin = true } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.CLAUDE_PLUGIN_DATA;
    const p = spawn(process.execPath, [path.join(ROOT, 'hooks', 'ttak.cjs')], { env });
    let out = '';
    let killed = false;
    const bound = setTimeout(() => { killed = true; p.kill(); }, 5000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', (code) => { clearTimeout(bound); resolve({ out, code, killed }); });
    p.stdin.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
    if (closeStdin) p.stdin.end();
  });
}

// withData() from Task 2 is synchronous: its finally block deletes the temp
// directory before an async callback resolves. Set up inline here instead.
//
// --- fix round 1 (coordinator review): C1 -- both PLUGIN_DATA and
// CLAUDE_PLUGIN_DATA must be isolated here, not just PLUGIN_DATA. dataRoot()
// falls back to CLAUDE_PLUGIN_DATA, and on a host where that already points
// at a real plugin's data dir, the unisolated test wrote a real .notified
// flag there. ---
test('the entry point emits handle() output and exits 0', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-'));
  const prevPD = process.env.PLUGIN_DATA;
  const prevCPD = process.env.CLAUDE_PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(dir, 'ttak-ttak');
  delete process.env.CLAUDE_PLUGIN_DATA;
  try {
    ttak.writeState(true);
    const r = await spawnHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.strictEqual(r.code, 0);
    assert.ok(JSON.parse(r.out).hookSpecificOutput);
  } finally {
    if (prevPD === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prevPD;
    if (prevCPD === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prevCPD;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- fix round 1: I1 -- this only asserted exit code and elapsed time, so
// swapping the timer's callback for () => process.exit(0) (no parsing, no
// handle(), no output) still passed. State is now ON and the output is
// asserted, so the fallback has to actually run handle(). ---
test('stdin without EOF still exits 0 within the fallback window', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-'));
  const prevPD = process.env.PLUGIN_DATA;
  const prevCPD = process.env.CLAUDE_PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(dir, 'ttak-ttak');
  delete process.env.CLAUDE_PLUGIN_DATA;
  try {
    ttak.writeState(true);
    const started = Date.now();
    const r = await spawnHook({ hook_event_name: 'SessionStart', source: 'startup' }, { closeStdin: false });
    // fix round 2: this line only runs once the promise resolves, so on a
    // real hang it was never reached -- it caught slow-but-terminating, not
    // fast-but-broken. spawnHook()'s own bound (see above) now resolves a
    // hung child instead of never resolving, so this assertion is reachable
    // and the `killed` marker names the failure precisely.
    assert.strictEqual(r.killed, false, 'spawnHook had to force-kill the child; the fallback did not exit on its own');
    assert.strictEqual(r.code, 0);
    assert.ok(Date.now() - started < 3000, 'hook must not hang the session');
    assert.ok(JSON.parse(r.out).hookSpecificOutput, 'the fallback must still run handle(), not just exit');
  } finally {
    if (prevPD === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prevPD;
    if (prevCPD === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prevCPD;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- fix round 1: I2 -- 'error' is a presence-or-absence guard; half-mutating
// its body proved nothing. A write-only fd passed as the child's fd 0 fails
// on read with a genuine EBADF, deterministically. ---
test('a genuine stdin read error still exits 0 instead of crashing the process', async () => {
  const prevPD = process.env.PLUGIN_DATA;
  const prevCPD = process.env.CLAUDE_PLUGIN_DATA;
  delete process.env.PLUGIN_DATA;
  delete process.env.CLAUDE_PLUGIN_DATA;
  const wfd = fs.openSync(os.devNull, 'w');
  try {
    const r = await new Promise((resolve) => {
      const p = spawn(process.execPath, [path.join(ROOT, 'hooks', 'ttak.cjs')],
        { env: { ...process.env }, stdio: [wfd, 'pipe', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('close', (code) => resolve({ code, err }));
    });
    assert.strictEqual(r.code, 0, `a stdin read error must fail open, not crash: ${r.err}`);
  } finally {
    fs.closeSync(wfd);
    if (prevPD === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prevPD;
    if (prevCPD === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prevCPD;
  }
});

// --- fix round 1: M2 -- same PowerShell host, same failure class as the
// timer; left out of Task 6 only because it was outside the brief's verbatim
// scope. ---
test('a BOM-prefixed stdin payload still parses', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-'));
  const prevPD = process.env.PLUGIN_DATA;
  const prevCPD = process.env.CLAUDE_PLUGIN_DATA;
  process.env.PLUGIN_DATA = path.join(dir, 'ttak-ttak');
  delete process.env.CLAUDE_PLUGIN_DATA;
  try {
    ttak.writeState(true);
    const payload = '\uFEFF' + JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' });
    const r = await spawnHook(payload);
    assert.strictEqual(r.code, 0);
    assert.ok(JSON.parse(r.out).hookSpecificOutput);
  } finally {
    if (prevPD === undefined) delete process.env.PLUGIN_DATA; else process.env.PLUGIN_DATA = prevPD;
    if (prevCPD === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prevCPD;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- fix round 2: I3's mirror -- readState() strips a BOM from state.json
// too, not just the stdin fallback, but nothing asserted it. Mutating that
// strip away survives the suite silently: a BOM-prefixed state.json reads as
// 'invalid' instead of the real state. Same host, same failure class as the
// stdin BOM assertion above. ---
test('readState strips a BOM from state.json the same way the stdin fallback does', () => {
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true });
    fs.writeFileSync(path.join(leaf, 'state.json'), '\uFEFF' + JSON.stringify({ enabled: true }));
    assert.deepStrictEqual(ttak.readState(), { status: 'on' });
  });
});

test('the explainer frontmatter is safe for both hosts', () => {
  const p = path.join(ROOT, 'skills', 'ttak-explain', 'SKILL.md');
  const raw = fs.readFileSync(p, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter must parse');
  assert.match(fm[1], /^name: ttak-explain$/m);
  // fix round 1, M1: the previous check only looked at the opening
  // delimiter, so stripping just the closing quote left an unterminated
  // YAML scalar -- which both hosts fail to parse -- and still passed.
  // Require a complete quoted scalar, or the start of a block scalar.
  assert.match(fm[1], /^description: ("[^"]*"|'[^']*'|[>|].*)$/m);
  assert.ok(!/disable-model-invocation/.test(fm[1]),
    'the Codex publish validator rejects this field set to true');
  assert.ok(fm[1].length < 1400, 'description budget');
});

test('the explainer is self-contained', () => {
  const body = fs.readFileSync(path.join(ROOT, 'skills', 'ttak-explain', 'SKILL.md'), 'utf8');
  const flat = body.replace(/\s+/g, ' ');
  // fix round 1, I2: /accurate/i, and this task's own round-1 replacement
  // /accuracy/i, pin a word rather than the claim it stands for --
  // "Accuracy is traded for simplicity whenever the reader is a beginner."
  // keeps the word and would have passed either one. Pin the sentence.
  assert.ok(flat.includes('Accuracy is not traded for simplicity at any level'));
  // fix round 1, I2: the second invariant this test's own name promises
  // (self-contained -> both invariants restated) had no check at all;
  // deleting the whole paragraph stayed green at 46/46.
  assert.ok(flat.includes(
    'Never infer age, diagnosis, education, intelligence, or a relationship from insufficient evidence'));
  assert.ok(!/\/ttak|\$ttak/.test(body), 'host invocation syntax belongs in the README');
});

test('the explainer content is pinned by sentence, not by word', () => {
  const body = fs.readFileSync(path.join(ROOT, 'skills', 'ttak-explain', 'SKILL.md'), 'utf8');
  const flat = body.replace(/\s+/g, ' ');
  // fix round 1, I2: the adult default is the market position; reversing it
  // to a five-year-old stayed green with no claim pinned against it.
  assert.ok(flat.includes(
    'When none is stated, assume a capable adult who may be unfamiliar with the subject'));
  // fix round 1, I2: all four profile rows, by content -- not just table
  // presence -- so a deleted table or a deleted row both fail here.
  for (const row of [
    'Beginner | Plain vocabulary, the core idea, one short concrete example',
    'Practitioner | Purpose, operating flow, where it is applied, common failure points',
    'Expert | Internal mechanics, edge cases, performance, trade-offs',
    'Decision-maker | Outcome, cost, risk, scope, alternatives, the decision required',
  ]) {
    assert.ok(flat.includes(row), `missing profile row: ${row}`);
  }
  // fix round 1, I3, added to the skill body on the coordinator's authority:
  // the text-first market position rested on the body never mentioning an
  // artifact, which is silence, not a specification.
  assert.ok(flat.includes(
    'Deliver the explanation in the conversation. Produce no file, artifact, or document unless the user asks for one.'));
});

const { checkManifests } = require('./lint/check-hygiene.cjs');

test('all four manifests agree on name, version and license', () => {
  assert.deepStrictEqual(checkManifests(ROOT).mismatches, []);
});

test('the listing logo exists, is non-empty, and is referenced by the codex interface', () => {
  const logo = path.join(ROOT, 'assets', 'logo.png');
  assert.ok(fs.statSync(logo).size > 0, 'assets/logo.png is missing or zero bytes');
  const codex = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.strictEqual(codex.interface.logo, './assets/logo.png');
  assert.strictEqual(codex.interface.composerIcon, './assets/logo.png');
});

test('the codex manifest has no hooks field and a complete interface block', () => {
  const codex = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'));
  // The Codex publish validator rejects a top-level `hooks` field even though
  // the runtime supports one; hooks/hooks.json is discovered by default instead.
  assert.ok(!('hooks' in codex), 'the codex publish validator rejects a top-level hooks field');
  assert.ok(codex.interface && typeof codex.interface === 'object', 'interface block is required');
  for (const key of ['displayName', 'shortDescription', 'longDescription', 'developerName',
    'category', 'capabilities', 'defaultPrompt', 'logo']) {
    const v = codex.interface[key];
    // capabilities/defaultPrompt are arrays: [] is truthy, so a bare
    // truthiness test would pass on an empty list despite the message
    // below claiming "non-empty". Length is the right instrument for those;
    // truthiness (which also rejects '') is right for the string fields.
    const nonEmpty = Array.isArray(v) ? v.length > 0 : Boolean(v);
    assert.ok(nonEmpty, `interface.${key} is required and must be non-empty`);
  }
});

// The Codex interface.logo doubles as the marketplace listing image, and
// assets/logo.png is currently the authorised Task 8 placeholder (68 bytes,
// 1x1 -- see task-8-report.md). A missing/zero-byte file is already caught
// above; the realistic failure is shipping the placeholder itself, which
// nothing else catches. Skipped rather than left failing, with the exact
// unskip condition named, so a submission-time run still shows a named
// "skipped" line instead of silently omitting the check.
test('the listing logo meets the minimum size for a real marketplace listing',
  { skip: 'assets/logo.png is still the Task 8 68-byte 1x1 placeholder -- remove this skip once ' +
    'it is replaced with a real >=128x128 mark (see task-8-report.md, fix round 1, finding 4)' },
  () => {
    const b = fs.readFileSync(path.join(ROOT, 'assets', 'logo.png'));
    const width = b.readUInt32BE(16);
    const height = b.readUInt32BE(20);
    assert.ok(width >= 128 && height >= 128,
      `assets/logo.png is ${width}x${height}, below the 128x128 listing floor`);
  });

test('attributions reproduce each upstream notice as published', () => {
  const a = fs.readFileSync(path.join(ROOT, 'ATTRIBUTIONS.md'), 'utf8');
  for (const url of ['github.com/DietrichGebert/ponytail', 'github.com/ayghri/i-have-adhd',
                     'github.com/DreambigOu/ELI5', 'github.com/wotjr1649/leanclarity']) {
    assert.ok(a.includes(url), `missing source: ${url}`);
  }
  // Verified by reading the file at the pin: this LICENSE names no holder.
  //
  // fix round 2, F-L: both checks below ran against the whole file, where the
  // holder-less line had exactly one match. A second holder-less line added
  // anywhere would have let a repair of the ELI5 notice pass unnoticed, and
  // the negative check named only one invented holder. Scope both to that
  // source's own section and reject any holder, not just `DreambigOu`.
  const eli5 = sections(a).get('DreambigOu/ELI5');
  assert.ok(eli5, 'no DreambigOu/ELI5 section');
  assert.ok(!/Copyright \(c\) 2026 \S/.test(eli5),
    'inventing a copyright holder is a false attribution statement');

  // fix round 4: a file-wide count of four `Permission is hereby granted`
  // lines was F-L's defect one marker down -- it cannot tell a complete
  // notice from a truncated one, so deleting a warranty paragraph passed.
  // Require every structural part of an MIT notice inside each fenced block,
  // per block rather than per file. This catches truncation, which is the
  // realistic failure, and it runs offline.
  //
  // What stays open, stated as the substantive case rather than the flattering
  // one: these assertions prove each notice is internally complete and carries
  // the holder THIS FILE claims for it. Nothing in-repo proves that holder is
  // what upstream published -- the constants below were read from the pinned
  // clones by hand. Body text between the structural markers is unchecked too.
  // Byte-equality against `git cat-file blob <pin>:LICENSE` is the check for
  // both, it needs the clones, and a hash recorded here would be a magic
  // number CI could neither regenerate nor falsify.
  //
  // fix round 5, NEW-1: round 4 walked the blocks by index and never bound one
  // to its source, so swapping two holders, blanking `ponytail`'s, or writing
  // `Ayoub Ghriss` into `leanclarity`'s all stayed green. The holder line is
  // the one fact MIT requires preserved and the one section 19.3 forbids
  // altering by name. Read each block out of its own source's section and
  // check the holder recorded for that source.
  assert.strictEqual((a.match(/^```$/gm) || []).length, 8,
    'expected exactly four fenced notice blocks, one per source');
  for (const [source, holder] of Object.entries({
    'DietrichGebert/ponytail': 'Copyright (c) 2026 DietrichGebert',
    'ayghri/i-have-adhd': 'Copyright (c) 2026 Ayoub Ghriss',
    'DreambigOu/ELI5': 'Copyright (c) 2026',
    'wotjr1649/leanclarity': 'Copyright (c) 2026 LeanClarity contributors',
  })) {
    const s = sections(a).get(source);
    assert.ok(s, `no attribution section for source: ${source}`);
    const block = s.match(/^```\n([\s\S]*?)^```$/m);
    assert.ok(block, `${source}: no reproduced notice block in its own section`);
    const lines = block[1].split('\n');
    const at = lines.indexOf(holder);
    assert.notStrictEqual(at, -1,
      `${source}: its notice must reproduce its own copyright line, "${holder}"`);
    // fix round 5, NEW-4: a holder inserted on the next line passed both the
    // old positive (`\s*$` ends the line happily) and the old negative (which
    // needed a literal space). Every published notice puts a blank line here,
    // so requiring one closes both the same-line and next-line forms, for all
    // four sources rather than only for the holder-less one.
    assert.strictEqual(lines[at + 1], '',
      `${source}: nothing may follow its copyright line but a blank line`);
    for (const part of [
      /^Permission is hereby granted/m,
      /^The above copyright notice and this permission notice shall be included/m,
      /^THE SOFTWARE IS PROVIDED "AS IS"/m,
      /IN NO EVENT SHALL/,
    ]) {
      assert.match(block[1], part, `${source}: its notice is truncated, ${part} is missing`);
    }
  }
});

// fix round 2 removed 'the README warns about the measured composition
// finding'. Its two assertions were /not a guard/i and /ponytail/i against the
// whole of README.md; the second is the exact defect F-B names, since the
// attribution list alone satisfies it. Both claims are now pinned as contiguous
// per-language sentences in README_PINS below, so the test measured nothing the
// surviving one does not measure more strictly.

function sections(text) {
  return new Map(text.split(/\n## /).slice(1)
    .map((s) => [s.split('\n')[0].trim(), s]));
}

test('every attributed source carries its pinned revision and the artifacts derived from it', () => {
  const a = fs.readFileSync(path.join(ROOT, 'ATTRIBUTIONS.md'), 'utf8');
  // fix round 2, F-G: pins and artifacts used to be checked independently
  // against the whole file. `policy/contract.md` appears 5 times in it and
  // `7dfe5b2...` 3 times, so nothing tied an artifact to the source it is
  // claimed to derive from -- a wrong pairing would still have passed. Both
  // are now read out of the source's own `##` section, and the pin out of that
  // section's own `Pinned revision` bullet.
  const bySource = sections(a);
  for (const [source, pin, artifacts] of [
    ['DietrichGebert/ponytail', '2ed6c52c9d7e5e56942508591085fd45dea277d3',
      ['policy/invariants.md', 'policy/precedence.md', 'policy/contract.md']],
    ['ayghri/i-have-adhd', '58494af57962b2d7a996b4d419474380a299af5e',
      ['policy/contract.md', 'policy/precedence.md', 'skills/ttak-explain/SKILL.md']],
    ['DreambigOu/ELI5', 'a766623b062331fdde53467001379b4ddf3acc2f',
      ['skills/ttak-explain/SKILL.md']],
    ['wotjr1649/leanclarity', '7dfe5b2e25166e91069034038ac59121f771e844',
      ['policy/invariants.md', 'policy/contract.md', 'README.md', 'README.ko.md']],
  ]) {
    const s = bySource.get(source);
    assert.ok(s, `no attribution section for source: ${source}`);
    assert.ok(s.includes(`github.com/${source}`), `${source}: its section does not carry its URL`);
    const pinned = s.match(/- Pinned revision: `([0-9a-f]{40})`/);
    assert.ok(pinned, `${source}: no pinned-revision bullet in its own section`);
    assert.strictEqual(pinned[1], pin, `${source}: pinned revision does not match the record`);
    const derived = s.match(/- TTAK artifacts derived from it:([\s\S]*?)\n- /);
    assert.ok(derived, `${source}: no derived-artifact bullet in its own section`);
    for (const artifact of artifacts) {
      assert.ok(derived[1].includes(artifact),
        `${source}: ${artifact} is not listed among the artifacts derived from it`);
    }
  }
  // One source has two pins. Both belong in the record, per section 19.3, and
  // the second belongs in that source's section rather than merely in the file.
  assert.ok(bySource.get('ayghri/i-have-adhd').includes('cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c'),
    "the predecessor's own i-have-adhd pin belongs in that source's record");
});

// The inherited figures are all negative or null. Nothing can assert that the
// README's prose is honest; these assert that the numbers a reader would need
// in order to judge it for themselves are on the page, in both languages.
//
// fix round 2: five claims below are pinned as contiguous per-language
// sentences rather than as tokens or as presence checks inside a section.
// Every one of them had a mutation that removed the claim a reader relies on
// while leaving the token that was being checked. A token shared with unrelated
// text is not a pin, and neither is presence inside a section that holds five
// other copies of it. Whitespace is normalised before matching so that
// re-wrapping a paragraph does not fail a pin.
const README_PINS = {
  'README.md': {
    // F-A: /\/hooks/ also matched require('./hooks/ttak.cjs') in the size
    // command, so deleting the whole 395-character trust-review paragraph
    // left the suite green.
    trustReview: "trust the plugin's hooks through `/hooks` before any of them run",
    // F-B: the section carrying "8 of 24" holds five of the six file-wide
    // `ponytail` occurrences, so a section-scoped /ponytail/i survived
    // replacing the advice sentence with one that drops the plugin's name.
    advice: 'Running TTAK alongside `ponytail` is not recommended',
    // F-C: "6 of 6 across two hosts and two candidates" merged two distinct
    // measurements into a figure true of neither denominator. Both halves of
    // the argument are pinned, not only the corrected number.
    //
    // fix round 3, C6: round 2's replacement said "6 of 6 again on Claude",
    // which is also wrong. The gate is three runs per host per case per
    // candidate (evidence L446, `17 cases x 3 runs x 2 hosts`, 102 runs at
    // L259 and L616), so the revision gave Claude three runs, not six. The
    // "six consecutive" at L479-482 spans both candidates and already
    // includes the frozen candidate's three, which the first clause counts.
    gateCause: 'It failed 6 of 6 across both hosts on the frozen candidate, and 3 of 3 again on '
      + 'Claude after a revision built specifically to fix it',
    // F-I: the evidence qualifies this figure at Claude Opus 5 rates.
    cost: '$0.002 per session at Claude Opus 5 rates',
    // F-K: the open-gate list omitted the gate the README states twice
    // elsewhere is inherited and un-rerun.
    openGate: 'the inherited `LCL-BEH-001` behaviour gate (not re-run)',
    // fix round 3, C5: /not a guard|가드가 아닙니다/i matched twice in
    // README.ko.md -- the bullet and the composition sentence at :150 -- so
    // deleting the bullet stayed green. English matched once only because
    // :24 reads "Not a guard" and :152 reads "is a guard"; that is an
    // accident of wording, not a guard. Pin the bullet by its content.
    notAGuard: '**Not a guard.** Not an enforcement mechanism, not a security control, not a '
      + 'correctness guarantee.',
  },
  'README.ko.md': {
    trustReview: '통해 플러그인 훅을 검토하고 신뢰하도록 요구합니다',
    advice: 'TTAK을 `ponytail`과 함께 사용하는 것은 권장하지 않습니다',
    // fix round 5, NEW-3: `두 호스트 모두 6회 중 6회` reads distributively --
    // six per host, twelve in total. The English `6 of 6 across both hosts`
    // cannot be read that way, so F-C's implicit denominator survived in
    // Korean alone. `걸쳐` spans the two hosts instead of quantifying over
    // each. Both languages carry the same force per [DOC-003].
    gateCause: '게이트에 동결된 후보에서 두 호스트에 걸쳐 6회 중 6회 실패했으며, 이를 고치려고 만든 '
      + '개정판도 Claude에서 3회 중 3회 다시 실패했습니다',
    cost: 'Claude Opus 5 요금 기준으로 세션당 대략 $0.002',
    openGate: '다시 돌리지 않은 물려받은 행동 게이트 `LCL-BEH-001`',
    notAGuard: '**가드가 아닙니다.** 강제 메커니즘도, 보안 통제도, 정확성 보장도 아닙니다.',
  },
};

test('both READMEs publish the inherited measurements, including the negative ones', () => {
  for (const name of ['README.md', 'README.ko.md']) {
    const r = fs.readFileSync(path.join(ROOT, name), 'utf8');
    const flat = r.replace(/\s+/g, ' ');
    const pin = README_PINS[name];
    assert.match(r, /p = 1\.0000/, `${name}: the null behaviour result is not stated`);
    assert.match(r, /5 of 17|17개 중 5개/, `${name}: the failed behaviour gate is not stated`);
    assert.match(r, /8 of 24|24회 중 8회/, `${name}: the composition figure is not stated`);
    assert.match(r, /13 of 24|24회 중 13회/,
      `${name}: that figure is a published correction; the number it replaced belongs with it`);
    const measured = flat.split(/ ## /).find((s) => /8 of 24|24회 중 8회/.test(s));
    assert.ok(measured, `${name}: no section carries the composition figure`);
    assert.ok(measured.includes(pin.advice),
      `${name}: the section carrying the composition figure must advise, in one sentence that names `
      + `the plugin, against running the two together: "${pin.advice}"`);
    assert.ok(flat.includes(pin.trustReview),
      `${name}: the Codex hook trust-review sentence is missing: "${pin.trustReview}"`);
    assert.ok(flat.includes(pin.gateCause),
      `${name}: the behaviour-gate cause must name the denominator each 6 of 6 belongs to, and `
      + `that the revision built to fix it also failed: "${pin.gateCause}"`);
    assert.ok(flat.includes(pin.cost),
      `${name}: the per-session cost figure must carry the rate it was computed at`);
    assert.ok(flat.includes(pin.openGate),
      `${name}: the un-rerun behaviour gate belongs in the open-gate list`);
    assert.ok(r.includes('/ttak:ttak-explain') && r.includes('$ttak:ttak-explain'),
      `${name}: both host invocation strings are required`);
    assert.ok(flat.includes(pin.notAGuard),
      `${name}: the not-a-guard bullet is missing: "${pin.notAGuard}"`);
  }
});

test('the copied-text inventory tracks both i-have-adhd pins and the reproduced-expression rows', () => {
  const inv = fs.readFileSync(path.join(ROOT, 'docs', 'COPIED_TEXT_INVENTORY.md'), 'utf8');
  // One source, two pins: the record must say which chain applies and why.
  assert.ok(inv.includes('58494af57962b2d7a996b4d419474380a299af5e'), 'the 5.1 pin is missing');
  assert.ok(inv.includes('cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c'), "the predecessor's pin is missing");
  // The two places where wording deliberately tracks upstream.
  //
  // fix round 2, F-F: the old check counted `Reproduced expression` file-wide
  // (15 occurrences) against a threshold of 2, so downgrading both mandated
  // rows to `Independent re-expression` -- the exact misclassification this
  // inventory exists to prevent -- left the suite green. A count is not a
  // classification. Pin each mandated row's own verdict cell, scoped to the
  // `policy/invariants.md` section so the identically numbered rows in the
  // deliberate-tracking table above cannot satisfy it.
  const invariants = sections(inv).get('`policy/invariants.md`');
  assert.ok(invariants, 'no policy/invariants.md section in the inventory');
  for (const [id, what] of [['I4', 'the reuse-order chain'], ['I7', 'the protected-noun list']]) {
    const row = invariants.split('\n').find((l) => l.startsWith(`| ${id} |`));
    assert.ok(row, `${id}: no row in the policy/invariants.md section`);
    assert.match(row, /\| \*\*Reproduced expression\*\*/,
      `${id} (${what}) must stay classified as a reproduced expression, not downgraded`);
  }
  assert.match(inv, /reuse[- ]order/i, 'the reuse-order chain is not recorded');
  assert.match(inv, /protected noun/i, 'the protected-noun list is not recorded');
  assert.match(inv, /ponytail-review/, 'Review material must be recorded even when not carried');

  // fix round 3, C3: the inventory headlines a 29-word file-wide run between
  // `policy/invariants.md` and the predecessor's `policies/engineering.md`.
  // The upstream half of that measurement cannot be checked in-repo, but the
  // local half can: if the policy file is edited, the headline silently
  // becomes false in the direction that flatters the project. Both the policy
  // text and the inventory's quoted evidence are pinned to the same run,
  // normalised exactly as the inventory's Method section describes.
  const RUN_29 = 'the reported symptom optimize for the smallest correct change not the shortest '
    + 'looking diff never simplify away trust boundary validation security controls correctness '
    + 'guards data loss prevention accessibility or';
  assert.strictEqual(RUN_29.split(' ').length, 29, 'the pinned run is not 29 words');
  const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(normalise(fs.readFileSync(path.join(ROOT, 'policy', 'invariants.md'), 'utf8'))
    .includes(RUN_29),
  'policy/invariants.md no longer contains the 29-word run the inventory headlines');
  assert.ok(normalise(inv).includes(RUN_29),
    'the inventory no longer quotes the 29-word run it headlines');

  // fix round 5, NEW-2: the above pins the run's text and the test constant's
  // word count -- not the number the file publishes. Reverting the headline to
  // 18, shrinking the F1 table, swapping 29 and 12 between the two files, and
  // deleting the F1 table outright all stayed green. F-D exists because a
  // published figure under-reported its own file's defect; an edit re-creating
  // exactly that defect was unguarded. Pin the printed numbers too.
  assert.match(inv, /longest shared run of \*\*29 words\*\* measured file-wide/,
    'the ruling block must headline the file-wide 29-word run');
  for (const [file, w] of [['policy/invariants.md', 29], ['policy/contract.md', 12]]) {
    const row = inv.split('\n').find((l) => l.startsWith(`| \`${file}\` | `));
    assert.ok(row, `${file}: no row in the F1 file-wide table`);
    assert.match(row, new RegExp(`^\\| \`${file}\` \\| \\*\\*${w} w\\*\\* \\|`),
      `${file}: the F1 file-wide table must report ${w} w against its own source`);
  }

  // fix round 3, C4, widened in round 4: this file exists to hold two licence
  // gates open, and nothing stopped a future edit from closing them in the
  // Status table. Round 3 pinned the one gate that had been named by
  // instance; both belong here, because the class is what matters.
  //
  // fix round 5, NEW-5: /\*\*Open\*\*/ anywhere in the row read a token, not a
  // state -- `Closed — was **Open**, now signed off` passed it. Read the
  // state cell and require it to open with the marker.
  for (const id of ['[LIC-007]', '[AC-012]']) {
    const row = inv.split('\n').find((l) => l.startsWith(`| \`${id}\``));
    assert.ok(row, `no ${id} row in the inventory Status table`);
    assert.match(row.split('|')[2].trim(), /^\*\*Open\*\*/,
      `${id} is closed by a human ruling, not by editing its state cell`);
  }
  for (const f of ['policy/precedence.md', 'policy/invariants.md', 'policy/contract.md',
                   'skills/ttak-explain/SKILL.md']) {
    assert.ok(inv.includes(f), `not inventoried: ${f}`);
  }
});

// fix round 5, NEW-6: the four sites carrying a corrected behaviour-gate
// denominator were all unguarded and silently revertible, including
// AMENDMENT_EN.md, where the merged claim originated. This task has twice
// watched a corrected figure be re-broken -- once as the merged claim, once as
// the replacement that asserted six post-revision Claude runs where the gate
// ran three. A correction is worth no more than its pin.
test('every corrected behaviour-gate denominator names what it counts', () => {
  const amend = fs.readFileSync(path.join(ROOT, 'docs',
    'TTAK_Plugin_Product_Definition_v0.2_AMENDMENT_EN.md'), 'utf8').replace(/\s+/g, ' ');
  for (const pin of [
    '`BEH-GUI-04` fails 6/6 on Claude across two candidates',
    '6/6 failure rate across two hosts on the frozen candidate `1.0.2`',
    'failed 6/6 across both hosts on the frozen candidate `1.0.2`, and 3/3 again on Claude',
  ]) {
    assert.ok(amend.includes(pin), `AMENDMENT_EN.md: denominator no longer named: "${pin}"`);
  }
  const inv = fs.readFileSync(path.join(ROOT, 'docs', 'COPIED_TEXT_INVENTORY.md'), 'utf8');
  const c7 = inv.split('\n').find((l) => l.startsWith('| C7 |'));
  assert.ok(c7, 'no C7 row in the inventory');
  assert.ok(c7.includes('failing 6 of 6 across both hosts on the frozen candidate `1.0.2`'),
    'the C7 row must name the candidate its 6 of 6 belongs to');
});

// Section 19.3: attribution lives in ATTRIBUTIONS.md and README prose only. A
// project name in a manifest reads as affiliation and is searchable. The whole
// file is scanned rather than the two named fields, because no manifest field
// has a legitimate reason to carry an upstream project name.
test('no upstream project is named anywhere in the shipped manifests', () => {
  const forbidden = [/ponytail/i, /i-have-adhd/i, /eli5/i, /leanclarity/i,
                     /DietrichGebert/i, /ayghri/i, /DreambigOu/i];
  for (const rel of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json',
                     '.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const n of forbidden) {
      assert.ok(!n.test(raw), `${rel} names an upstream project: ${n}`);
    }
  }
});
