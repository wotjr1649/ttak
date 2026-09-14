'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { analyzeScenario } = require('../scripts/finite-scenario.cjs');
const example = () => ({ initial: { alpha: true, beta: true }, invariant: { cells: ['alpha', 'beta'], at_least: 1 },
  transactions: [{ id: 'First', guard: { cells: ['beta'], at_least: 1 }, writes: { alpha: false } },
    { id: 'Second', guard: { cells: ['alpha'], at_least: 1 }, writes: { beta: false } }] });

test('distinct writes still create two read-write dependencies and violate the invariant', () => {
  const input = example(), before = JSON.stringify(input), result = analyzeScenario(input);
  assert.deepEqual(result.potential_read_write_edges, [{ reader: 'First', writer: 'Second', cells: ['beta'] },
    { reader: 'Second', writer: 'First', cells: ['alpha'] }]);
  assert.deepEqual(result.potential_write_write_edges, []);
  assert.equal(result.concurrent_start_schedules.length, 2);
  for (const schedule of result.concurrent_start_schedules) {
    assert.deepEqual(schedule.steps.map(step => step.outcome), ['committed', 'committed']);
    assert.deepEqual(schedule.final_state, { alpha: false, beta: false });
    assert.equal(schedule.invariant_preserved, false);
  }
  assert.equal(JSON.stringify(input), before);
});

test('fresh snapshots under serial execution change the second decision', () => {
  const result = analyzeScenario(example());
  assert.equal(result.all_serial_orders_preserve_invariant, true);
  for (const schedule of result.serial_schedules) {
    assert.deepEqual(schedule.steps.map(step => step.outcome), ['committed', 'guard_false']);
    assert.equal(Object.values(schedule.steps[1].observed)[0], false);
  }
  assert.equal(result.real_database_verified, false);
  assert.equal(result.all_possible_interleavings_checked, false);
});

test('overlapping writes abort the later concurrent committer', () => {
  const input = example(); input.transactions[1].writes = { alpha: false };
  const result = analyzeScenario(input);
  assert.equal(result.potential_write_write_edges.length, 1);
  for (const schedule of result.concurrent_start_schedules) {
    assert.deepEqual(schedule.steps.map(step => step.outcome), ['committed', 'write_conflict_abort']);
  }
});

test('serialization is not certified when the modeled transaction logic itself is unsafe', () => {
  const input = example();
  for (const transaction of input.transactions) transaction.guard = { cells: [], at_least: 0 };
  const result = analyzeScenario(input);
  assert.equal(result.all_serial_orders_preserve_invariant, false);
  assert.equal(result.concurrent_invariant_violation_found, true);
});

test('potential overlaps do not assert that a guard-false transaction performed a write', () => {
  const input = example(); input.initial.alpha = false;
  const result = analyzeScenario(input);
  assert.equal(result.potential_read_write_edges.length, 2);
  for (const schedule of result.concurrent_start_schedules) {
    assert.equal(schedule.steps.find(step => step.transaction === 'Second').outcome, 'guard_false');
    assert.equal(schedule.final_state.beta, true);
  }
  assert.equal(result.concurrent_invariant_violation_found, false);
});

test('three-party scenario checks every serial order rather than only one favorable order', () => {
  const input = { initial: { a: true, b: true, c: true }, invariant: { cells: ['a', 'b', 'c'], at_least: 1 },
    transactions: ['a', 'b', 'c'].map(cell => ({ id: cell, guard: { cells: ['a', 'b', 'c'].filter(other => other !== cell), at_least: 1 }, writes: { [cell]: false } })) };
  const result = analyzeScenario(input);
  assert.equal(result.serial_schedules.length, 6);
  assert.equal(new Set(result.serial_schedules.map(schedule => schedule.order.join(','))).size, 6);
  assert.equal(result.all_serial_orders_preserve_invariant, true);
  assert.equal(result.concurrent_invariant_violation_found, true);
});

test('malformed, unbounded and unknown state references fail without executing strings', () => {
  for (const mutate of [s => s.initial.alpha = 'true', s => s.invariant.cells.push('missing'),
    s => s.transactions[0].writes.missing = false, s => s.transactions[1].id = 'First',
    s => s.transactions[0].guard.at_least = -1, s => s.transactions[0].guard.cells.push('beta'),
    s => s.transactions[0].command = 'not executable', s => s.transactions = Array(5).fill(s.transactions[0]),
    s => s.initial = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['x' + i, true])),
    s => s.initial = { alpha: false, beta: false }]) {
    const input = example(); mutate(input); assert.throws(() => analyzeScenario(input));
  }
});
