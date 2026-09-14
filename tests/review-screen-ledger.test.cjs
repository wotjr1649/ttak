'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createScreenLedger, openScreenLedger, hash } = require('../scripts/review-screen-ledger.cjs');
const base = path.resolve(__dirname, '../.superpowers');
function fixture(t) {
  const dir = path.join(base, 'ledger-test-' + randomUUID());
  createScreenLedger(dir, ['a.claude', 'a.codex'], 2);
  t.after(() => {
    assert.ok(fs.realpathSync(dir).startsWith(fs.realpathSync(base) + path.sep));
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        for (const file of fs.readdirSync(target)) fs.unlinkSync(path.join(target, file));
        fs.rmdirSync(target);
      } else fs.unlinkSync(target);
    }
    fs.rmdirSync(dir);
  });
  return { dir, ledger: openScreenLedger(dir) };
}
const decision = (value, choice = 'continue') => ({ decision: choice, result_sha256: hash(value), reason: 'Fixture adjudication.', sources: ['fixture'] });
test('both hosts share ordered persisted reservations and a finite allowance', async t => {
  const { dir, ledger } = fixture(t);
  await assert.rejects(ledger.run('a.codex', () => assert.fail()), /not_runnable/);
  const result = { status: 'fixture' };
  await ledger.run('a.claude', async () => result);
  assert.equal(openScreenLedger(dir).state().status, 'awaiting_adjudication');
  await assert.rejects(ledger.run('a.codex', () => assert.fail()), /not_runnable/);
  ledger.adjudicate('a.claude', decision(result));
  await ledger.run('a.codex', async () => result);
  ledger.adjudicate('a.codex', decision(result));
  assert.equal(ledger.state().status, 'complete'); assert.equal(ledger.state().used, 2);
  await assert.rejects(ledger.run('a.claude', () => assert.fail()), /not_runnable/);
});
test('concurrent invokers cannot reserve one job twice', async t => {
  const { dir, ledger } = fixture(t); let finish, calls = 0;
  const first = ledger.run('a.claude', () => { calls++; return new Promise(resolve => finish = resolve); });
  await assert.rejects(openScreenLedger(dir).run('a.claude', () => { calls++; }), /not_runnable/);
  finish({}); await first; assert.equal(calls, 1);
});
test('a transport failure or negative decision stops subsequent calls', async t => {
  const { ledger } = fixture(t);
  await assert.rejects(ledger.run('a.claude', async () => { throw Error('fixture'); }), /no_retry/);
  assert.equal(ledger.state().status, 'stopped'); assert.equal(ledger.state().used, 1);
  await assert.rejects(ledger.run('a.codex', () => assert.fail()), /not_runnable/);
  const other = fixture(t).ledger;
  await other.run('a.claude', async () => ({})); other.adjudicate('a.claude', decision({}, 'stop'));
  await assert.rejects(other.run('a.codex', () => assert.fail()), /not_runnable/);
});
test('decisions bind to the actual unchanged result and cannot be overwritten', async t => {
  const { dir, ledger } = fixture(t); await ledger.run('a.claude', async () => ({ value: 1 }));
  assert.throws(() => ledger.adjudicate('a.claude', decision({ value: 2 })), /mismatch/);
  ledger.adjudicate('a.claude', decision({ value: 1 }));
  assert.throws(() => ledger.adjudicate('a.claude', decision({ value: 1 })), /invalid/);
  fs.writeFileSync(path.join(dir, 'a.claude/result.json'), '{"value":2}');
  assert.throws(() => ledger.state(), /result_changed/);
});
test('an interrupted reservation cannot be relaunched after reopening', async t => {
  const { dir } = fixture(t); fs.mkdirSync(path.join(dir, 'a.claude'));
  const reopened = openScreenLedger(dir);
  assert.equal(reopened.state().status, 'in_flight_or_interrupted');
  await assert.rejects(reopened.run('a.claude', () => assert.fail()), /not_runnable/);
});
test('reopening validates path and budget data rather than trusting edited ledger files', async t => {
  const { dir, ledger } = fixture(t);
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ jobs: ['../outside'], maxCalls: 2 }));
  assert.throws(() => openScreenLedger(dir), /invalid_screen_plan/);
  await ledger.run('a.claude', async () => ({}));
  fs.writeFileSync(path.join(dir, 'a.claude/receipt.json'), JSON.stringify({ calls: -1, status: 'collected', result_sha256: hash({}) }));
  assert.throws(() => ledger.state(), /receipt_corrupted/);
});
