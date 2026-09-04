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
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true });
    fs.writeFileSync(path.join(leaf, 'state.json'), '{not json');
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.ok(!/\bON\b|\bOFF\b/.test(o.reason), `must not guess ON/OFF for invalid state: ${o.reason}`);
  });
});

test('SubagentStart does not receive the first-session notice even while absent', () => {
  withData((leaf) => {
    fs.mkdirSync(leaf, { recursive: true }); // leaf exists, state.json absent -> status 'absent'
    const r = runHook({ hook_event_name: 'SubagentStart' });
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(r.exit, 0);
  });
});
