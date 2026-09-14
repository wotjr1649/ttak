'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { Worker } = require('node:worker_threads');
const { createVerificationLedger, openVerificationLedger } = require('../scripts/verification-ledger.cjs');
const { auditVerificationCall } = require('../scripts/verification-native-audit.cjs');
const fixture = require('./fixtures/verification-p0.cjs');
const base = path.resolve(__dirname, '../.superpowers');
fs.mkdirSync(base, { recursive: true });

function setup(t, config = fixture.config()) {
  const temporary = fs.mkdtempSync(path.join(base, 'verification-p0-test-'));
  const root = path.join(temporary, 'store'); fs.mkdirSync(root);
  const created = createVerificationLedger(root, 'run', config);
  t.after(() => {
    assert.equal(fs.realpathSync(path.dirname(temporary)), fs.realpathSync(base));
    assert.equal(fs.realpathSync(temporary), temporary);
    // All descendants are this fixture's state; junctions are removed, never traversed.
    fs.rmSync(temporary, { recursive: true });
  });
  const reopen = () => openVerificationLedger(root, 'run', created.config_sha256);
  return { root, temporary, directory: created.directory, hash: created.config_sha256, reopen, ledger: reopen() };
}
function receipt(ticket, mutate = () => {}) {
  const { observed, expected } = fixture.observation(ticket); mutate(observed);
  return auditVerificationCall(ticket, observed, expected);
}
function step(ledger, kind, index, at) {
  const ticket = ledger.reserve(fixture.request(kind, index), at);
  ledger.accept(ticket, receipt(ticket), at + 1);
  return ticket;
}

test('parent, separate question contexts and one final rewrite form a persisted bounded unit', t => {
  const { ledger, reopen, directory } = setup(t);
  assert.throws(() => ledger.reserve(fixture.request('rewrite'), 1000), /rewrite_before/);
  step(ledger, 'parent', 0, 1000);
  step(reopen(), 'child', 0, 1100);
  assert.throws(() => ledger.reserve(fixture.request('rewrite'), 1200), /rewrite_before/);
  step(ledger, 'child', 1, 1200);
  step(reopen(), 'rewrite', 0, 1300);
  const state = reopen().state(1301);
  assert.equal(state.status, 'complete'); assert.equal(state.used_calls, 4);
  assert.deepEqual(state.completed_questions, ['Q1', 'Q2']);
  assert.deepEqual(state.reserved, { max_responses: 8, max_input_tokens: 400, max_output_tokens: 400 });
  assert.deepEqual(state.observed, { responses: 4, input_debit: 60, output_debit: 44 });
  assert.throws(() => ledger.reserve(fixture.request('rewrite'), 1400), /not_reservable/);
  const persisted = fs.readdirSync(directory).filter(name => name !== 'plan.json')
    .flatMap(name => fs.readdirSync(path.join(directory, name)).map(file => fs.readFileSync(path.join(directory, name, file), 'utf8'))).join('\n');
  assert.doesNotMatch(persisted, /PRIVATE_DRAFT|SYNTHETIC_VISIBLE_ANSWER|SYNTHETIC_PARENT_ANSWER|reads B/);
});
test('Codex question receipts retain their counter convention through reopen and final rewrite', t => {
  const { ledger, reopen } = setup(t, fixture.config('codex'));
  step(ledger, 'child', 0, 1000); step(reopen(), 'child', 1, 1100); step(ledger, 'rewrite', 0, 1200);
  const state = reopen().state(1201);
  assert.equal(state.status, 'complete');
  assert.deepEqual(state.observed, { responses: 3, input_debit: 81, output_debit: 45 });
  assert.equal(state.reserved.max_input_tokens, 300);
});
test('a reservation is on disk before it can be used, and reopened handles cannot relaunch it', t => {
  const { ledger, reopen, directory } = setup(t);
  const ticket = ledger.reserve(fixture.request(), 1000);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'C0001/reservation.json'))).ticket, ticket);
  assert.equal(reopen().state(1001).used_calls, 1);
  assert.equal(reopen().state(1001).status, 'in_flight');
  assert.throws(() => reopen().reserve(fixture.request(), 1001), /not_reservable/);
  // Recovery can settle an already observed completed call; it does not invoke the call again.
  reopen().accept(ticket, receipt(ticket), 1002);
  assert.equal(reopen().state(1002).status, 'ready');
});
test('an incomplete atomic reservation is charged and never silently restarted', t => {
  const { directory, reopen } = setup(t);
  fs.mkdirSync(path.join(directory, 'C0001'));
  const state = reopen().state(1000);
  assert.equal(state.status, 'in_flight'); assert.equal(state.used_calls, 1);
  assert.equal(state.pending.interrupted, true);
  assert.equal(state.reservation_accounting_complete, false);
  assert.throws(() => reopen().reserve(fixture.request(), 1001), /not_reservable/);
});
test('independent worker writers cannot both reserve the same next slot', { timeout: 10000 }, async t => {
  const { root, hash, reopen } = setup(t);
  const modulePath = path.resolve(__dirname, '../scripts/verification-ledger.cjs');
  // Fixed local worker code with inert path/config data; no model or host executable.
  const source = `const { parentPort, workerData } = require('node:worker_threads');
    const { openVerificationLedger } = require(workerData.modulePath);
    const ledger = openVerificationLedger(workerData.root, 'run', workerData.hash);
    parentPort.postMessage('ready');
    parentPort.once('message', () => {
      try { ledger.reserve(workerData.request, 1000); parentPort.postMessage('reserved'); }
      catch { parentPort.postMessage('rejected'); }
      parentPort.close();
    });`;
  const workers = [0, 1].map(() => new Worker(source, { eval: true, workerData: { root, hash, modulePath, request: fixture.request() } }));
  try {
    const pending = workers.map(worker => new Promise((resolve, reject) => {
      worker.once('error', reject);
      worker.once('message', message => { if (message !== 'ready') reject(Error('unexpected_worker_state')); else resolve(); });
    }));
    await Promise.all(pending);
    const results = workers.map(worker => new Promise((resolve, reject) => { worker.once('error', reject); worker.once('message', resolve); }));
    workers.forEach(worker => worker.postMessage('go'));
    assert.deepEqual((await Promise.all(results)).sort(), ['rejected', 'reserved']);
    assert.equal(reopen().state(1001).used_calls, 1);
  } finally { await Promise.all(workers.map(worker => worker.terminate())); }
});
test('failure, cancellation and partial completion consume their slots and stop all later work', t => {
  for (const reason of ['execution_error', 'cancelled', 'partial', 'quality_failure']) {
    const { ledger, reopen } = setup(t), ticket = ledger.reserve(fixture.request(), 1000);
    const after = ledger.fail(ticket, reason, 1001);
    assert.equal(after.status, 'stopped'); assert.equal(after.used_calls, 1); assert.equal(after.stop_reason, reason);
    assert.equal(reopen().state(1002).stop_reason, reason);
    assert.throws(() => reopen().reserve(fixture.request(), 1002), /not_reservable/);
    assert.throws(() => ledger.accept(ticket, receipt(ticket), 1003), /no_matching_reservation/);
  }
});
test('timeout is terminal, reversed clocks are rejected, and a late success cannot reopen a call', t => {
  const { ledger, reopen } = setup(t), ticket = ledger.reserve(fixture.request(), 1000);
  assert.throws(() => ledger.state(999));
  assert.equal(reopen().state(2000).stop_reason, 'timeout');
  assert.throws(() => ledger.accept(ticket, receipt(ticket), 2000), /no_retry/);
  assert.equal(reopen().state(2001).status, 'stopped');
  const other = setup(t);
  step(other.ledger, 'child', 0, 1100);
  assert.throws(() => other.ledger.reserve(fixture.request('child', 1), 1100), /clock_reversed/);
  assert.equal(setup(t).ledger.state(10000).status, 'expired');
});
test('successful calls do not refund response or token reservations', t => {
  for (const key of ['max_responses', 'max_input_tokens', 'max_output_tokens']) {
    const cfg = fixture.config(); cfg.limits[key] = fixture.allocation()[key];
    const { ledger } = setup(t, cfg);
    step(ledger, 'child', 0, 1000);
    assert.throws(() => ledger.reserve(fixture.request('child', 1), 1100), /reservation_limit/);
    assert.equal(ledger.state(1100).used_calls, 1);
  }
});
test('wrong question order and forged or cross-turn receipts cannot advance the ledger', t => {
  const { ledger } = setup(t);
  assert.throws(() => ledger.reserve(fixture.request('child', 1), 1000), /question_order/);
  const ticket = ledger.reserve(fixture.request(), 1000);
  assert.throws(() => ledger.accept({ ...ticket, turn_id: 'Different' }, receipt(ticket), 1001), /no_matching/);
  assert.throws(() => ledger.accept(ticket, structuredClone(receipt(ticket)), 1001), /no_retry/);
  assert.equal(ledger.state(1002).status, 'stopped');
});
test('a fresh-looking receipt cannot reuse another question thread or API response ID', t => {
  for (const replay of ['thread', 'response']) {
    const { ledger } = setup(t);
    step(ledger, 'child', 0, 1000);
    const second = ledger.reserve(fixture.request('child', 1), 1100);
    const report = receipt(second, observed => {
      if (replay === 'response') observed.responses[0].response_id = 'Response_C0001';
      else { observed.thread_id = 'Child_Q1'; observed.responses[0].thread_id = 'Child_Q1'; }
    });
    assert.throws(() => ledger.accept(second, report, 1101), /no_retry/);
    assert.equal(ledger.state(1102).used_calls, 2);
    assert.equal(ledger.state(1102).status, 'stopped');
  }
});
test('structurally valid unresolved evidence stops before rewrite and is never reclassified as a pass', t => {
  const { ledger } = setup(t), ticket = ledger.reserve(fixture.request(), 1000);
  const report = receipt(ticket, observed => { observed.result.status = 'unresolved'; observed.result.uncertainties = ['Unsettled evidence.']; });
  assert.equal(ledger.accept(ticket, report, 1001).stop_reason, 'unresolved');
  assert.throws(() => ledger.reserve(fixture.request('rewrite'), 1100), /not_reservable/);
});
test('changed plan and corrupted settled accounting cannot be trusted when reopening', t => {
  const { directory, reopen } = setup(t);
  const file = path.join(directory, 'plan.json'), changed = JSON.parse(fs.readFileSync(file));
  changed.limits.max_calls++; fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(reopen, /plan_changed/);
  const other = setup(t); step(other.ledger, 'child', 0, 1000);
  const settlementFile = path.join(other.directory, 'C0001/settlement.json');
  const settlement = JSON.parse(fs.readFileSync(settlementFile));
  settlement.audit.usage.limit_debit.input_tokens = 0; fs.writeFileSync(settlementFile, JSON.stringify(settlement));
  assert.throws(() => other.reopen().state(1002), /invalid_summary_usage/);
});
test('storage rejects traversal, existing state, junctions and hard-linked files without changing their targets', t => {
  const { root, temporary, directory, hash, reopen } = setup(t);
  for (const name of ['../escape', '..', 'C:\\escape', 'https://example.test', 'run/child']) {
    assert.throws(() => createVerificationLedger(root, name, fixture.config()), /storage_name/);
  }
  const before = fs.readFileSync(path.join(directory, 'plan.json'));
  assert.throws(() => createVerificationLedger(root, 'run', fixture.config()));
  assert.deepEqual(fs.readFileSync(path.join(directory, 'plan.json')), before);
  const outside = path.join(temporary, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => openVerificationLedger(root, 'alias', hash), /storage_link/);
  assert.throws(() => createVerificationLedger(path.join(root, 'alias'), 'new', fixture.config()), /storage_link/);
  const target = path.join(outside, 'plan.json'); fs.writeFileSync(target, before);
  fs.unlinkSync(path.join(directory, 'plan.json')); fs.linkSync(target, path.join(directory, 'plan.json'));
  assert.throws(reopen, /storage_file/);
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(fs.existsSync(path.join(outside, 'new')), false);
});
test('out-of-order directories, unknown state and changed reservation limits stop inspection', t => {
  const one = setup(t); fs.mkdirSync(path.join(one.directory, 'C0002'));
  assert.throws(() => one.reopen().state(1000), /order_corrupted/);
  const two = setup(t); fs.writeFileSync(path.join(two.directory, 'untrusted.json'), '{}');
  assert.throws(() => two.reopen().state(1000), /store_corrupted/);
  const three = setup(t); three.ledger.reserve(fixture.request(), 1000);
  const file = path.join(three.directory, 'C0001/reservation.json'), row = JSON.parse(fs.readFileSync(file));
  row.ticket.expires_at_ms++; fs.writeFileSync(file, JSON.stringify(row));
  assert.throws(() => three.reopen().state(1001), /reservation_changed/);
});
test('oversized persisted files and directory floods are rejected before unbounded reads', t => {
  const one = setup(t);
  fs.writeFileSync(path.join(one.directory, 'plan.json'), ' '.repeat(262145));
  assert.throws(one.reopen, /storage_file/);
  const two = setup(t);
  for (let i = 0; i < 7; i++) fs.writeFileSync(path.join(two.directory, 'extra-' + i), '');
  assert.throws(() => two.reopen().state(1000), /store_corrupted/);
});
