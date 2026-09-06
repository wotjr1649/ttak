const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
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

// The two shapes a fresh profile actually leaves behind, one per host, both
// observed on live hosts (docs/analysis/). They are separate tests so a
// regression names which host it broke.

test("Claude Code's fresh-profile shape: leaf missing, parent exists", () => {
  withData((leaf, root) => {
    assert.strictEqual(fs.existsSync(root), true, 'fixture: parent must exist');
    assert.strictEqual(fs.existsSync(leaf), false, 'fixture: leaf must not exist');
    assert.strictEqual(ttak.readState().status, 'absent');
    assert.strictEqual(ttak.writeState(true).ok, true);
    assert.strictEqual(ttak.readState().status, 'on');
  });
});

test("Codex's fresh-profile shape: leaf and parent both missing", () => {
  withData((leaf, root) => {
    // Codex 0.153.4 creates no part of <CODEX_HOME>/plugins/data/, so the
    // state path is two levels below anything that exists. Reverting
    // writeState to a non-recursive mkdirSync fails here and nowhere else.
    const deep = path.join(root, 'plugins', 'data', 'ttak-ttak');
    process.env.PLUGIN_DATA = deep;
    assert.strictEqual(fs.existsSync(path.dirname(deep)), false, 'fixture: parent must not exist');
    assert.strictEqual(ttak.readState().status, 'absent');
    assert.strictEqual(ttak.writeState(true).ok, true);
    assert.strictEqual(fs.existsSync(path.join(deep, 'state.json')), true);
    assert.strictEqual(ttak.readState().status, 'on');
    assert.ok(!fs.existsSync(leaf), 'nothing was written to the unused leaf');
  });
});

// A name that lstat sees but stat cannot resolve. On Windows this is a
// dangling directory junction, which any unprivileged user can create; on
// POSIX it is a dangling symlink. Returns false if the platform refuses,
// so the tests below skip loudly rather than passing vacuously.
function makeDangling(p) {
  try { fs.symlinkSync(path.join(path.dirname(p), 'no-such-target'), p, 'junction'); return true; }
  catch { return false; }
}

// Every shape where the state path cannot be used. `statSync` alone reports
// ENOENT for all of them -- the same errno it reports for a path that is
// simply free -- so each one was, at some point, read as 'absent' and
// answered as a confident OFF for a path nothing can ever be written to.
// Fix round 2 (F1) found the first, the final round (F-J) the other two.
const UNUSABLE_SHAPES = {
  'file where a parent directory should be': (root) => {
    const asFile = path.join(root, 'data');
    fs.writeFileSync(asFile, 'not a directory');
    return path.join(asFile, 'ttak-ttak');
  },
  'dangling junction as the leaf': (root) => {
    const leaf = path.join(root, 'ttak-ttak');
    return makeDangling(leaf) ? leaf : null;
  },
  'dangling junction as a parent': (root) => {
    const asLink = path.join(root, 'data');
    return makeDangling(asLink) ? path.join(asLink, 'ttak-ttak') : null;
  },
};

test('an unusable state path is unavailable, never a confident OFF', (t) => {
  let ran = 0;
  for (const [shape, setup] of Object.entries(UNUSABLE_SHAPES)) {
    withData((_leaf, root) => {
      const target = setup(root);
      if (target === null) return;
      ran += 1;
      process.env.PLUGIN_DATA = target;
      assert.strictEqual(ttak.readState().status, 'unavailable', `${shape}: read`);
      const res = ttak.writeState(true);
      assert.strictEqual(res.ok, false, `${shape}: write must not report success`);
      assert.strictEqual(res.refused, true, `${shape}: a refusal must stay distinguishable from a crash`);
      const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
      assert.strictEqual(o.reason, 'TTAK could not read or write its saved setting. Nothing was changed.',
        `${shape}: the status prompt must not claim ON or OFF`);
    });
  }
  if (ran < Object.keys(UNUSABLE_SHAPES).length) {
    t.diagnostic(`only ${ran} of ${Object.keys(UNUSABLE_SHAPES).length} shapes were creatable on this platform`);
  }
  assert.ok(ran >= 1, 'no unusable shape could be constructed; this test proved nothing');
});

test('a read still creates nothing, at any depth', () => {
  withData((leaf, root) => {
    const deep = path.join(root, 'plugins', 'data', 'ttak-ttak');
    process.env.PLUGIN_DATA = deep;
    assert.strictEqual(ttak.readState().status, 'absent');
    assert.strictEqual(fs.existsSync(path.join(root, 'plugins')), false);
    assert.ok(!fs.existsSync(leaf));
  });
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

// D2 (fix round 2, High): both checks below used to read only
// ttak.compose('main'). That is blind to *which file* a bullet lives in --
// moving the `standard library` bullet from policy/invariants.md (read by
// both scopes) to policy/contract.md (main-only) leaves main's byte total
// and both old checks green while the bullet silently vanishes from the
// subagent injection. Bind every noun and its sentence to its own source
// file and to every scope that file actually reaches. `explicit output
// formats` is main-only by design (policy/contract.md is not in the
// subagent SCOPES entry in hooks/ttak.cjs); the other four belong in both.
const PROTECTED_BULLETS = [
  {
    file: 'invariants.md',
    scopes: ['main', 'subagent'],
    nouns: ['standard library'],
    bullet: '- Prefer, in order: existing project code, the standard library, native platform features, an already-installed dependency, then the smallest new implementation that fully satisfies the requirement.',
  },
  {
    file: 'invariants.md',
    scopes: ['main', 'subagent'],
    nouns: ['trust-boundary validation', 'data-loss prevention', 'accessibility'],
    bullet: '- Never simplify away trust-boundary validation, security controls, correctness guards, data-loss prevention, accessibility, or the failure handling that protects the result. Never simplify away anything the user explicitly asked for; if they want the larger version, build it without re-arguing.',
  },
  {
    file: 'contract.md',
    scopes: ['main'],
    nouns: ['explicit output formats'],
    bullet: '- Honor explicit output formats. When detail, a walkthrough or an exhaustive review is asked for, give it in full without an arbitrary brevity or list limit.',
  },
];

// Fix round 3, residual 1: the loop below used to walk only each entry's own
// `scopes`, which bound the four subagent-reaching nouns positively but left
// `explicit output formats` (main-only by design) with no assertion that it
// stays out of subagent -- four facts and a silence. Walking every scope for
// every noun makes it one statement: present where listed, absent where not.
//
// N5 (fix round 4, Low): ALL_SCOPES was a hand-copy of the keys of SCOPES in
// hooks/ttak.cjs with nothing tying the two together, so adding a third scope
// to the product left that "present where listed, absent where not" guarantee
// silently not covering it. The missing-file test's `scopeFiles` and
// withPolicyCopy's own file list were two more copies of the same object.
// Keep one hand-written model here as the independent witness -- deriving it
// from the product would make the product the sole witness to itself, the
// circularity the byte/token pin below exists to prevent -- assert it equals
// the product's once, and read the other two off it. Latent today, because
// handle() hard-codes the two hook events, but it is the one-way binding this
// round exists to remove, one level up.
const SCOPE_FILES = { main: ['precedence', 'invariants', 'contract'], subagent: ['precedence', 'invariants'] };
const ALL_SCOPES = Object.keys(SCOPE_FILES);
const POLICY_FILES = [...new Set(Object.values(SCOPE_FILES).flat())];
const POLICY_SOURCES = new Map(POLICY_FILES.map((n) =>
  [`${n}.md`, fs.readFileSync(path.join(ROOT, 'policy', `${n}.md`), 'utf8')]));

test('the scope model this file asserts against is the one hooks/ttak.cjs composes from', () => {
  assert.deepStrictEqual({ ...ttak.SCOPES }, SCOPE_FILES,
    'SCOPES in hooks/ttak.cjs and the scope model every assertion in this file walks have diverged');
});

// F3 (final fix, Low): round 4 froze SCOPES because exporting it hands out a
// live handle on the object that decides what text gets injected, and said so
// in a comment. Removing all three Object.freeze calls left the suite green,
// so the claim had no witness. It has one now.
test('the exported scope map is frozen, not merely documented as read-only', () => {
  assert.ok(Object.isFrozen(ttak.SCOPES), 'hooks/ttak.cjs exports SCOPES without freezing it');
  for (const [scope, files] of Object.entries(ttak.SCOPES)) {
    assert.ok(Object.isFrozen(files), `hooks/ttak.cjs exports SCOPES.${scope} without freezing it`);
    assert.throws(() => files.push('contract'), TypeError,
      `SCOPES.${scope} accepted a push: the exported scope map is not read-only`);
  }
});

// N4 (fix round 4, Low), first half: the file check below was `includes` only.
// It said the noun must be *in* its file; it never said it is only there.
// Two-way, the same way the scope check beside it already is.
//
// F4 (final fix, Low): what that costs, recorded here rather than only in a
// report nobody will open. Two-way binding is stronger than the product
// requires: it forbids these five nouns and three bullets from the other two
// policy files entirely. Four of the nouns are distinctive phrases;
// `accessibility` is an ordinary word, so a future policy edit that uses it
// legitimately in precedence.md or contract.md will fail here. That failure
// has TWO correct repairs and the message names both -- delete the new use, or
// keep it and update PROTECTED_BULLETS to record where the noun now lives.
// Deleting is not automatically the right one. This constrains the
// repository's own files, not the injected instruction text, so the project's
// finding about counter-intuitive constraints on model behaviour does not
// apply to it (controller ruling, fix round 5).
test('policy text names every protected noun verbatim, in its own file and only there, and exactly the scopes it reaches', () => {
  const composed = { main: ttak.compose('main'), subagent: ttak.compose('subagent') };
  for (const { file, scopes, nouns } of PROTECTED_BULLETS) {
    for (const noun of nouns) {
      for (const [name, source] of POLICY_SOURCES) {
        assert.strictEqual(source.includes(noun), name === file, name === file
          ? `missing protected noun in policy/${name}: ${noun}`
          : `protected noun also appears in policy/${name}; its file of record is policy/${file}: `
            + `${noun} -- either remove it from policy/${name}, or, if that use is legitimate, `
            + `update PROTECTED_BULLETS to record where this noun now lives`);
      }
      for (const scope of ALL_SCOPES) {
        const shouldReach = scopes.includes(scope);
        assert.strictEqual(composed[scope].includes(noun), shouldReach, shouldReach
          ? `missing protected noun in ${scope} scope: ${noun}`
          : `protected noun leaked into ${scope} scope, which should not carry it: ${noun}`);
      }
    }
  }
});

// Controller addendum 2 (task 10, carried from task 9): the noun loop above
// only checks that each noun occurs somewhere. `accessibility` is an ordinary
// word, so a bullet that starts using it in another sense could satisfy the
// loop while no longer carrying the protected noun in its own sentence. Pin
// the three enclosing bullets verbatim, as they stand in their source files,
// so both the per-noun loop and this sentence-level pin must hold.
//
// N4 (fix round 4, Low), second half: this test was titled "and every scope"
// while its loop walked only each entry's own `scopes`, and its file check was
// one-way -- the same shape round 3 had just removed from the noun test one
// line above, left standing here. Duplicating a protected sentence into
// policy/precedence.md shipped green. Both bindings are two-way now.
//
// What stays open, stated as the substantive case rather than the flattering
// one: every binding here is exact-string. A near-copy of the main-only
// contract bullet with the noun singularised ("explicit output format") added
// to policy/invariants.md is not this bullet and does not contain this noun,
// so it satisfies every assertion in both tests while reaching the subagent
// injection. Nothing short of semantics catches that; it is the standing cost
// of pinning strings, not a gap this round could have closed.
test('the sentences carrying the five protected nouns are pinned verbatim, in their own file and only there, and in exactly the scopes that file reaches', () => {
  const composed = { main: ttak.compose('main'), subagent: ttak.compose('subagent') };
  for (const { file, scopes, bullet } of PROTECTED_BULLETS) {
    for (const [name, source] of POLICY_SOURCES) {
      assert.strictEqual(source.includes(bullet), name === file, name === file
        ? `bullet no longer present verbatim in policy/${name}: "${bullet}"`
        : `bullet duplicated into policy/${name}; its file of record is policy/${file}: "${bullet}" `
          + `-- either remove it from policy/${name}, or, if that use is legitimate, update `
          + `PROTECTED_BULLETS to record where this bullet now lives`);
    }
    for (const scope of ALL_SCOPES) {
      const shouldReach = scopes.includes(scope);
      assert.strictEqual(composed[scope].includes(bullet), shouldReach, shouldReach
        ? `bullet no longer present verbatim in ${scope} scope: "${bullet}"`
        : `bullet leaked into ${scope} scope, which should not carry it: "${bullet}"`);
    }
  }
});

// D5 (fix round 2, Low, pre-existing but now in scope because the pins above
// assume it): a space-to-newline edit inside a policy line is byte-neutral,
// so the byte pin can't see it, and a wrapped continuation line breaks any
// contiguous-string pin that happens to cross the wrap point. Every
// non-blank, non-heading line must be self-contained: it either starts a flat
// bullet ('- ') or the line before it is blank/a heading. This covers
// policy/precedence.md's un-bulleted paragraph lines too -- each of its
// three paragraphs is its own isolated line today.
//
// N6 (fix round 4, Low): the failure message said "looks like a wrapped
// continuation line", which is not what this check enforces. A legitimate
// nested sub-bullet ("  - Name the file it touches.") is rejected too, because
// it does not start at column 0. Flat bullets are what the Global Constraint
// means, so the strictness stays and the message now names what it enforces.
//
// N3 (fix round 4): the evasion set, restated accurately. Round 2 recorded the
// two known evasions -- a blank-line split leaving an orphan paragraph
// mid-list, and a continuation promoted to its own `- ` bullet -- as harmless
// because "any mutation that adds or removes a character already changes the
// byte count and is caught by D1 instead". That is false, and it is the
// argument an earlier finding in this task destroyed: correct the published
// figures and the byte pin goes silent. Every mutation in the fix-4 re-review
// corrected the figures first, which is exactly why they passed. So both
// evasions ship green, caught by nothing else, unless the line they touch is
// one of the three bullets pinned verbatim above. The promoted-bullet form is
// syntactically a legitimate bullet and cannot be told from one without
// semantics, so this detector is deliberately not widened to chase them.
test('every policy line stands alone as a flat bullet or its own block, never a wrapped or nested continuation', () => {
  for (const file of POLICY_FILES.map((n) => `${n}.md`)) {
    const lines = fs.readFileSync(path.join(ROOT, 'policy', file), 'utf8').split('\n');
    let prevIsContent = false;
    lines.forEach((line, i) => {
      const isBlank = line.trim() === '';
      const isHeading = line.startsWith('#');
      if (isBlank || isHeading) { prevIsContent = false; return; }
      assert.ok(!prevIsContent || line.startsWith('- '),
        `policy/${file}:${i + 1} must open a flat '- ' bullet or a new block; it continues the line `
        + `above, and nothing here may be a wrapped or nested continuation: "${line}"`);
      prevIsContent = true;
    });
  }
});

function withPolicyCopy(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttak-policy-'));
  for (const n of POLICY_FILES) {
    fs.copyFileSync(path.join(ROOT, 'policy', `${n}.md`), path.join(dir, `${n}.md`));
  }
  try { mutate(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('composition is all-or-nothing when a required policy file is missing, for every file in every scope', () => {
  for (const [scope, names] of Object.entries(SCOPE_FILES)) {
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
  // A missing parent is no longer unwritable -- writeState creates the whole
  // path. The genuinely unwritable shape is a leaf that exists and is not a
  // directory, which no amount of creating can fix.
  withData((leaf) => {
    fs.writeFileSync(leaf, 'not a directory');
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak on' }).stdout);
    assert.strictEqual(o.decision, 'block');
    // Exact text, not just "no leaked path": a regression that reports
    // success ("TTAK saved setting: ON.") when nothing was written would
    // still pass a decision-only/no-leak check.
    assert.strictEqual(o.reason, 'TTAK could not read or write its saved setting. Nothing was changed.');
    assert.ok(!/ENOENT|[A-Za-z]:\\|\/tmp/.test(o.reason));
  });
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

test('the first-session notice fires when the parent is missing too', () => {
  // The Codex shape. This test used to assert the opposite -- that the notice
  // refuses when the parent is missing -- which on Codex meant the plugin's
  // only discovery path was dead on every fresh profile.
  withData((leaf, root) => {
    const deep = path.join(root, 'plugins', 'data', 'ttak-ttak');
    process.env.PLUGIN_DATA = deep;
    const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /ttak on/);
    assert.strictEqual(fs.existsSync(path.join(deep, '.notified')), true);
    assert.ok(!fs.existsSync(leaf));
  });
});

test('the notice emits if and only if its flag was recorded', () => {
  // Fix round 2, F9. Pinning "some guard returns early" is untestable here:
  // four shapes funnel into one catch-all that returns the same NOOP, so no
  // assertion can tell them apart. The property that actually matters is the
  // biconditional -- an emit without a recorded flag repeats every session,
  // and the notice is the only discovery path an off-by-default plugin has.
  // Deleting the flag write fails this on the first two shapes.
  const shapes = {
    'leaf-missing-parent-exists': (leaf) => {},
    'leaf-and-parent-missing': (leaf, root) => { process.env.PLUGIN_DATA = path.join(root, 'p', 'd', 'ttak-ttak'); },
    'leaf-is-a-file': (leaf) => fs.writeFileSync(leaf, 'not a directory'),
    'ancestor-is-a-file': (leaf, root) => {
      const asFile = path.join(root, 'data');
      fs.writeFileSync(asFile, 'not a directory');
      process.env.PLUGIN_DATA = path.join(asFile, 'ttak-ttak');
    },
    // The shape that disproved the round-2 claim that a failing flag write was
    // unreachable: its immediate parent is a real directory, so the old
    // reasoning admitted it, and it still cannot be created or written into.
    'leaf-is-a-dangling-junction': (leaf) => { makeDangling(leaf); },
  };
  for (const [shape, setup] of Object.entries(shapes)) {
    withData((leaf, root) => {
      setup(leaf, root);
      const r = runHook({ hook_event_name: 'SessionStart', source: 'startup' });
      const recorded = fs.existsSync(path.join(path.dirname(ttak.statePath()), '.notified'));
      assert.strictEqual(r.stdout !== '', recorded,
        `${shape}: emitted=${r.stdout !== ''} but flag recorded=${recorded}`);
      assert.strictEqual(r.exit, 0, `${shape}: a lifecycle hook must fail open`);
    });
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

  // unavailable: the leaf exists and is not a directory. (A missing parent is
  // no longer unavailable -- it is absent, and writeState creates the path.)
  withData((leaf) => {
    fs.writeFileSync(leaf, 'not a directory');
    const o = JSON.parse(runHook({ hook_event_name: 'UserPromptSubmit', prompt: 'ttak' }).stdout);
    assert.strictEqual(o.decision, 'block');
    assert.strictEqual(o.reason, ERR_TEXT, `unavailable state must report the bounded error, not guess ON/OFF: ${o.reason}`);
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

// D4 (fix round 2, Low): a Map silently lets a later ## heading of the same
// name overwrite an earlier one, so a duplicate section could corrupt any of
// its callers green. Fix it once, here, rather than at each call site: every
// test that reads a `##` section out of a document goes through this helper.
// (fix round 4: this comment used to claim "four callers". There were five
// call sites across four tests when it said so, and seven across five after
// this round. A count that goes stale on the next edit is not worth carrying,
// so it is not restated.)
//
// N7 (fix round 4, Low): headings were read inside fenced code blocks too.
// ATTRIBUTIONS.md exists to reproduce upstream notices verbatim and already
// carries four fenced blocks, so the first upstream notice containing a `## `
// line would split a section mid-notice, or trip the duplicate check below, in
// the one file whose whole purpose is embedding foreign text. Verified not a
// regression -- the pre-fix helper mis-read the same input, so the callers
// failed on it before this fix too -- but it would break confusingly. Track
// the fence and split only outside it. Section bodies still carry their fenced
// content verbatim, which the notice checks above read back out of them.
//
// F2 (final fix, High): round 4 toggled on any line starting with ```, so a
// legitimate, normally rendering four-backtick block containing a ``` line
// left the toggle stuck open and the enclosing section swallowed every later
// heading to end of file. The section GREW, and the four prose pins are
// `includes()`, so they stayed satisfied from anywhere in the rest of the
// document -- this fix defeated the section-scoping fix in the same commit.
// Round 4's residual R6 enumerated only the cases where a section disappears
// (which fail loudly at `assert.ok(section, ...)`) and never the case where it
// grows, which is the silent one. That closure was wrong.
//
// Track the fence per CommonMark instead: a run of >= 3 backticks or tildes
// opens one, and only a run of the SAME character, AT LEAST AS LONG, with
// nothing else on the line, closes it. Up to three leading spaces are allowed
// on both, which also closes R6's indented-fence and `~~~` cases.
//
// `level` selects the heading depth. A level-2 body already ends where the
// next `## ` begins, so `sections(sections(t).get(a), 3)` yields a `### `
// subsection bounded by its parent section instead of running to EOF.
function sections(text, level = 2) {
  const mark = '#'.repeat(level) + ' ';
  const entries = [];
  let fence = null;
  for (const line of text.split('\n')) {
    const run = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null) {
      if (run) fence = run[1];
      else if (line.startsWith(mark)) { entries.push([line.slice(mark.length), []]); continue; }
    } else if (run && run[1][0] === fence[0] && run[1].length >= fence.length && line.trim() === run[1]) {
      fence = null;
    }
    if (entries.length) entries[entries.length - 1][1].push(line);
  }
  // The sibling of F2, closed rather than disclosed: a fence that is never
  // closed grows its section to end of file exactly as the mis-tracked one
  // did, and `includes()` pins stay satisfied from anywhere in the rest of the
  // document. Correct fence tracking does not help when the document itself is
  // unbalanced, so make that loud here instead of leaving it silent -- the
  // omission that made round 4's R6 closure wrong.
  assert.strictEqual(fence, null,
    `unclosed \`${fence}\` fence: every heading after it is swallowed to end of file`);
  const out = new Map();
  for (const [heading, body] of entries) {
    const key = heading.trim();
    assert.ok(!out.has(key), `duplicate "${mark}${key}" section: sections() would silently return the last one`);
    out.set(key, [heading, ...body].join('\n'));
  }
  return out;
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

test('injected size is reported for both scopes and the subagent scope is smaller', () => {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'scripts', 'measure-injection.cjs')], { cwd: ROOT, encoding: 'utf8' });
  const m = JSON.parse(out);
  assert.ok(m.main.bytes > 0 && m.subagent.bytes > 0);
  assert.ok(m.subagent.bytes < m.main.bytes);
});

// Controller addendum 1 (task 10), fix round 1: the README publishes these
// byte counts as facts about the shipped artifact. Comparing them only to
// scripts/measure-injection.cjs's own stdout would make the script the sole
// witness to its own correctness -- change the script to report text.length
// instead of Buffer.byteLength and update the README to match, and a
// spawn-and-compare check agrees while the published claim quietly changes
// meaning. Compute the true figure in the test, from the same compose() the
// script and the hook both call, and tie the README and the script to it
// separately so each is checked against the composition, not against
// each other.
//
// D1 (fix round 2, High): fix round 1 closed this circle for bytes only.
// approxTokens had no witness at all -- changing the script's divisor to /3
// and the README's token column to match passed green, the same circularity
// one column to the right. Extend `expected` with the same
// Math.ceil(length / 4) the script and the README claim to report, and check
// both against it.
//
// N2 (fix round 4, Medium): `.find()` returned the first matching row, so a
// second size table appended after the real one -- same row prefixes, false
// figures -- left the README publishing two contradictory tables with the
// suite green. The same round deleted the `**Provisional.**` label and
// published "These figures fail the suite if the policy files or the README
// drift from what that command prints" in its place, while its own residual
// list recorded that nothing asserted a count of one. Make the sentence true
// rather than weaker: exactly one row may start with each prefix.
//
// F1 + F1b (final fix, High): that check bound the header to its section and to
// file-wide uniqueness, and left the data rows bound to neither. `readmeColumn`
// read a row by byte prefix from anywhere in the document, so false figures
// rendered in the table with the real rows hidden in an HTML comment at end of
// file shipped green, in both languages. And its uniqueness test compared raw
// bytes of markdown table lines while GFM ignores cell padding, so a
// padding-different copy renders identically and compares unequal -- round 5's
// R2 closure argued a second table needs different labels, when it only needs
// different bytes.
//
// Both close together, using the pattern the header check already used:
// normalise each table line to its trimmed cells, and read the figures out of
// the size section's own table by position instead of searching the file for a
// prefix. `readmeColumn` is gone, so there is no longer a way to read a
// published figure from outside the section that publishes it.
const normRow = (line) => line.split('|').map((c) => c.trim()).join('|');

// SIZE_SECTION_PINS is declared below; test bodies run after module evaluation.
function sizeTable(name, pin) {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  const parent = sections(text).get(pin.parent);
  assert.ok(parent, `${name}: no "## ${pin.parent}" section`);
  const section = sections(parent, 3).get(pin.heading);
  assert.ok(section, `${name}: no "### ${pin.heading}" section inside "## ${pin.parent}"`);
  const rows = section.split('\n').filter((l) => l.startsWith('|')).map(normRow);
  assert.strictEqual(rows.length, 4,
    `${name}: the size section must hold exactly one table -- header, separator, one row per scope `
    + `-- and holds ${rows.length} table lines`);
  return { text, section, rows };
}

test('both READMEs and the measurement script report bytes and tokens that match the composition', () => {
  const expected = {};
  for (const scope of ['main', 'subagent']) {
    const text = ttak.compose(scope);
    expected[scope] = { bytes: Buffer.byteLength(text, 'utf8'), tokens: Math.ceil(text.length / 4) };
  }

  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'scripts', 'measure-injection.cjs')], { cwd: ROOT, encoding: 'utf8' });
  const m = JSON.parse(out);
  for (const scope of ['main', 'subagent']) {
    assert.strictEqual(m[scope].bytes, expected[scope].bytes,
      `scripts/measure-injection.cjs reports a stale ${scope}-scope byte count`);
    assert.strictEqual(m[scope].approxTokens, expected[scope].tokens,
      `scripts/measure-injection.cjs reports a stale ${scope}-scope token approximation`);
  }

  // The row labels used to live here as a second hand-written copy of the same
  // table SIZE_SECTION_PINS describes. They are in SIZE_SECTION_PINS now, and
  // the figures are read out of the section's own table by position, so a row
  // that renders somewhere else in the document cannot answer for this one.
  for (const [name, pin] of Object.entries(SIZE_SECTION_PINS)) {
    const { rows } = sizeTable(name, pin);
    for (const [i, scope] of [[2, 'main'], [3, 'subagent']]) {
      const cell = rows[i].split('|');
      assert.strictEqual(cell[1], pin.rows[scope],
        `${name}: the size table's row ${i - 1} is not the ${scope} row -- it reads "${cell[1]}"`);
      assert.strictEqual(Number(cell[2].replace(/,/g, '')), expected[scope].bytes,
        `${name}: published ${scope}-scope byte figure is stale against compose('${scope}')`);
      assert.strictEqual(Number(cell[3].replace(/,/g, '')), expected[scope].tokens,
        `${name}: published ${scope}-scope token figure is stale against compose('${scope}')`);
    }
  }
});

// D3 (fix round 2, Medium): the byte/token numbers can no longer be false,
// but every sentence that makes them interpretable was still free -- the
// reproduction command, the four-characters-per-token ratio, the "not exact"
// disclaimer, and the column header's own approximation label could each be
// deleted or changed with the suite green. Pin them too.
//
// N1 (fix round 4, Medium): all five ran `includes` over the whole README, so
// relabelling the rendered header to `| Scope | Bytes | Tokens |`, deleting
// the disclaimer from beside the figures and re-homing the five pinned strings
// in an appendix section passed -- the rendered page then presents the
// approximation as exact, reversing the plan's "do not present it as exact",
// with the suite green. The test's own name says "section", which is not what
// it checked. Scope it there, the way the `## Method` pin below already does.
// `heading` is a `### ` inside `parent`, so it is read out of the parent's
// body: a level-2 body ends at the next `## `, which bounds the last
// subsection instead of letting it run to the end of the file.
const SIZE_SECTION_PINS = {
  'README.md': {
    parent: 'What is measured',
    heading: 'Size of the injected text',
    header: '| Scope | Bytes | Approx. tokens (~4 chars/token) |',
    rows: {
      main: 'Session start (precedence + invariants + contract)',
      subagent: 'Subagent start (precedence + invariants)',
    },
    command: 'node scripts/measure-injection.cjs',
    ratio: 'a token approximation at four characters per token',
    disclaimer: 'an estimate, not an exact token count',
    // fix round 5: narrowed from "These figures ... or the README drift" to the
    // table. R1 and R2 of round 4 showed the wider claim was still false --
    // prose elsewhere can state any number, and a differently-labelled table
    // can publish contradictory ones. The claim now matches what is enforced:
    // this table's figures, against the policy files and against this table.
    pinStatement: 'The figures in this table fail the suite if the policy files or this table drift '
      + 'from what that command prints',
  },
  'README.ko.md': {
    parent: '측정된 것',
    heading: '주입되는 텍스트의 크기',
    header: '| 범위 | 바이트 | 근사 토큰 수 (~4자/토큰) |',
    rows: {
      main: '세션 시작 (precedence + invariants + contract)',
      subagent: '서브에이전트 시작 (precedence + invariants)',
    },
    command: 'node scripts/measure-injection.cjs',
    ratio: '4자당 1토큰으로 계산한 토큰',
    disclaimer: '추정치이며 정확한 토큰 수가 아닙니다',
    pinStatement: '정책 파일이나 이 표가 그 명령의 출력과 어긋나면 이 표의 수치들은 테스트 스위트에서 실패합니다',
  },
};

test('the size section still explains how to reproduce the figures and that the token column is approximate', () => {
  for (const [name, pin] of Object.entries(SIZE_SECTION_PINS)) {
    const { text, section, rows } = sizeTable(name, pin);
    const flat = section.replace(/\s+/g, ' ');
    // N2, second half: one table, and the pinned header is its own first row.
    // With the positional row reads above, this is what makes the README's
    // "the figures in this table fail the suite if ... this table drift[s]"
    // sentence true of a second table: it cannot be added inside this section,
    // and nothing rendering as one of these rows may appear anywhere else.
    //
    // F1b: every comparison here is on normalised cells. Byte equality let a
    // copy with different padding, which GFM renders identically, count as a
    // different line.
    assert.strictEqual(rows[0], normRow(pin.header),
      `${name}: the table's own header row no longer labels the token column as an approximation`);
    const allRows = text.split('\n').filter((l) => l.startsWith('|')).map(normRow);
    assert.strictEqual(allRows.filter((r) => r === normRow(pin.header)).length, 1,
      `${name}: exactly one size table may exist; a second row rendering as this header publishes `
      + `a second set of figures`);
    for (const [scope, label] of Object.entries(pin.rows)) {
      assert.strictEqual(allRows.filter((r) => r.split('|')[1] === label).length, 1,
        `${name}: exactly one table row anywhere in the file may be labelled "${label}" (${scope})`);
    }
    assert.ok(flat.includes(pin.command), `${name}: reproduction command is missing, changed, or no longer beside the figures`);
    assert.ok(flat.includes(pin.ratio), `${name}: the four-characters-per-token ratio is missing from the size section`);
    assert.ok(flat.includes(pin.disclaimer), `${name}: the "not exact" disclaimer is missing from the size section`);
    assert.ok(flat.includes(pin.pinStatement), `${name}: the sentence stating the figures are pinned to the composition is missing from the size section`);
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

// Controller addendum 3 (task 10, carried item): the Method section's two-metric
// definition can be deleted with the suite green, and unlike the ruling block and
// the persona paragraph it is not disclosed anywhere as unguarded. Every per-unit
// and file-wide figure in this document is only interpretable given this
// definition, so pin it, scoped to the Method section -- not because a shorter
// string elsewhere (the F1 table's "file-wide" column header, say) could ever
// satisfy a full-sentence pin by accident, but because the check should stay
// bound to the section that actually defines these metrics, per the brief's
// "row-scoped" instruction.
// (fix round 2: corrected this comment. It previously claimed the scoping
// exists to stop the F1 header from accidentally matching; a short header
// could never satisfy a pin this specific, so that was not the real reason.)
test('the copied-text inventory Method section still defines its two metrics', () => {
  const inv = fs.readFileSync(path.join(ROOT, 'docs', 'COPIED_TEXT_INVENTORY.md'), 'utf8');
  const method = sections(inv).get('Method');
  assert.ok(method, 'no Method section in the inventory');
  const flat = method.replace(/\s+/g, ' ');
  assert.ok(flat.includes('**Per-unit** — one TTAK bullet or paragraph against one source file. '
    + 'This is the *Longest run* column in every table. It shows where the reproduced material sits.'),
  'the per-unit metric is no longer defined the same way in the Method section');
  assert.ok(flat.includes('**File-wide** — the whole TTAK file against the whole source file, so a '
    + 'run that continues across a bullet boundary is counted rather than truncated at it. This is '
    + 'the larger figure and the honest headline. F1 reports it for all four shipped files.'),
  'the file-wide metric is no longer defined the same way in the Method section');
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

// The v0.1 review document records SHA-256 values for the specification files
// and closes by requiring recomputation whenever they change; the v0.2
// amendment section 8 step 3 made that an obligation when it hit the same
// situation. Nothing enforced it. Round 0 of the v0.3 amendment edited both
// files and left the record matching nothing for a commit, and the rename in
// fix round 1 would have done it again. An obligation with no instrument is not
// an obligation.
//
// Bound to `docs()` -- the same single definition the parity gate reads, and
// the one place a rename has to land -- so a rename that does not reach the
// hash record fails here, instead of leaving the test checking whatever the
// table happens to list.
const HASH_ROW = /^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/;

// Every SHA-256 table in the document, in order. A table starts at its own
// header row and ends at the first line that is not a table row, so the
// `|---|---|` separator is skipped and the historical v0.1 and v0.2 tables stay
// separate from the live one rather than merging into a single row list.
function hashTables(text) {
  const tables = [];
  let rows = null;
  for (const line of text.split('\n')) {
    if (/^\| *파일[^|]*\| *SHA-256 *\|$/.test(line)) { rows = []; tables.push(rows); continue; }
    if (rows === null) continue;
    if (!line.startsWith('|')) { rows = null; continue; }
    const m = HASH_ROW.exec(line);
    if (m) rows.push([m[1], m[2]]);
  }
  return tables;
}

test('the recorded specification hashes match the files `docs()` names', () => {
  const rel = 'TTAK_Plugin_Product_Definition_v0.1_CANDIDATE_REVIEW_KO.md';
  const text = fs.readFileSync(path.join(ROOT, 'docs', rel), 'utf8');
  const expected = Object.values(docs()).map((f) => path.basename(f)).sort();

  const tables = hashTables(text);
  assert.ok(tables.length, `${rel}: no SHA-256 table found at all`);

  // The current filenames must appear in exactly one table. Two would make "the
  // current record" ambiguous -- a fourth table appended beside the live one
  // lets a stale copy keep satisfying this check -- and zero means the record
  // was dropped or the rename never reached it.
  const live = tables.filter((t) => t.some(([name]) => expected.includes(name)));
  assert.strictEqual(live.length, 1,
    `${rel}: the files docs() names must appear in exactly one hash table, found ${live.length}`);

  // And it must be the last one, because the document's own prose says the last
  // table is the current value. A historical table appended after it would make
  // the document and this test disagree about which record is live.
  assert.strictEqual(tables.indexOf(live[0]), tables.length - 1,
    `${rel}: the current hash table must be the last one in the document`);

  const rows = live[0];
  const names = rows.map(([name]) => name);
  assert.strictEqual(new Set(names).size, names.length,
    `${rel}: duplicate filename row in the current hash table`);
  assert.deepStrictEqual(names.slice().sort(), expected,
    `${rel}: the current hash table must list exactly the files docs() names, no more and no fewer`);

  for (const [name, recorded] of rows) {
    const actual = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, 'docs', name))).digest('hex');
    assert.strictEqual(actual, recorded,
      `${name}: recorded hash is stale -- the file changed and the record in ${rel} did not`);
  }
});
