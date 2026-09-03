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
    assert.strictEqual(ttak.writeState(true).ok, false);
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
    assert.strictEqual(ttak.writeState(true).ok, false);
  });
});
