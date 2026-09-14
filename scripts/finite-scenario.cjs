'use strict';

// Pure finite model: boolean cells, guarded atomic writes, at most four transactions.
// No SQL execution, I/O, model calls or interpretation of strings as code.
const fields = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(value);

function validate(input) {
  if (!fields(input, ['initial', 'invariant', 'transactions']) || !input.initial ||
      typeof input.initial !== 'object' || Array.isArray(input.initial)) throw new Error('invalid_scenario');
  const cells = Object.keys(input.initial);
  if (!cells.length || cells.length > 16 || cells.some(key => !identifier(key) || typeof input.initial[key] !== 'boolean')) {
    throw new Error('invalid_scenario_cells');
  }
  const predicate = value => {
    if (!fields(value, ['cells', 'at_least']) || !Array.isArray(value.cells) || value.cells.length > 16 ||
        new Set(value.cells).size !== value.cells.length || value.cells.some(key => !cells.includes(key)) ||
        !Number.isInteger(value.at_least) || value.at_least < 0 || value.at_least > value.cells.length) {
      throw new Error('invalid_scenario_predicate');
    }
    return { cells: [...value.cells], at_least: value.at_least };
  };
  const invariant = predicate(input.invariant);
  if (!Array.isArray(input.transactions) || input.transactions.length < 1 || input.transactions.length > 4) {
    throw new Error('invalid_scenario_transactions');
  }
  const ids = new Set();
  const transactions = input.transactions.map(transaction => {
    if (!fields(transaction, ['id', 'guard', 'writes']) || !identifier(transaction.id) || ids.has(transaction.id) ||
        !transaction.writes || typeof transaction.writes !== 'object' || Array.isArray(transaction.writes)) {
      throw new Error('invalid_scenario_transaction');
    }
    ids.add(transaction.id);
    const writes = Object.keys(transaction.writes);
    if (!writes.length || writes.length > 16 || writes.some(key => !cells.includes(key) || typeof transaction.writes[key] !== 'boolean')) {
      throw new Error('invalid_scenario_writes');
    }
    return { id: transaction.id, guard: predicate(transaction.guard), writes: { ...transaction.writes } };
  });
  return { initial: { ...input.initial }, invariant, transactions };
}

function holds(predicate, state) {
  return predicate.cells.filter(cell => state[cell]).length >= predicate.at_least;
}

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, index) => permutations(items.filter((_, at) => at !== index)).map(rest => [item, ...rest]));
}

function run(scenario, order, mode) {
  let state = { ...scenario.initial };
  const written = new Set(), steps = [];
  for (const transaction of order) {
    // In the concurrent-start model every snapshot predates every commit. In the serial
    // model snapshot acquisition, guard evaluation and writes finish before the next starts.
    const snapshot = mode === 'concurrent_start' ? scenario.initial : state;
    const observed = Object.fromEntries(transaction.guard.cells.map(cell => [cell, snapshot[cell]]));
    let outcome;
    if (!holds(transaction.guard, snapshot)) outcome = 'guard_false';
    else if (mode === 'concurrent_start' && Object.keys(transaction.writes).some(cell => written.has(cell))) {
      outcome = 'write_conflict_abort';
    } else {
      outcome = 'committed';
      state = { ...state, ...transaction.writes };
      for (const cell of Object.keys(transaction.writes)) written.add(cell);
    }
    steps.push({ transaction: transaction.id, observed, outcome, state: { ...state }, invariant_holds: holds(scenario.invariant, state) });
  }
  return { order: order.map(transaction => transaction.id), steps, final_state: { ...state },
    invariant_preserved: steps.every(step => step.invariant_holds) };
}

function analyzeScenario(input) {
  const scenario = validate(input);
  if (!holds(scenario.invariant, scenario.initial)) throw new Error('initial_invariant_does_not_hold');
  const readWrite = [], writeWrite = [];
  for (const reader of scenario.transactions) for (const writer of scenario.transactions) {
    if (reader.id === writer.id) continue;
    const cells = reader.guard.cells.filter(cell => Object.hasOwn(writer.writes, cell));
    if (cells.length) readWrite.push({ reader: reader.id, writer: writer.id, cells });
  }
  for (let i = 0; i < scenario.transactions.length; i++) for (let j = i + 1; j < scenario.transactions.length; j++) {
    const left = scenario.transactions[i], right = scenario.transactions[j];
    const cells = Object.keys(left.writes).filter(cell => Object.hasOwn(right.writes, cell));
    if (cells.length) writeWrite.push({ transactions: [left.id, right.id], cells });
  }
  const orders = permutations(scenario.transactions);
  const concurrent = orders.map(order => run(scenario, order, 'concurrent_start'));
  const serial = orders.map(order => run(scenario, order, 'serial'));
  return { scope: 'Finite boolean model; guards read their listed cells; writes are atomic; concurrent snapshots all precede commits; first-committer-wins on overlapping writes.',
    real_database_verified: false, all_possible_interleavings_checked: false,
    potential_read_write_edges: readWrite, potential_write_write_edges: writeWrite,
    concurrent_start_schedules: concurrent, serial_schedules: serial,
    concurrent_invariant_violation_found: concurrent.some(schedule => !schedule.invariant_preserved),
    all_serial_orders_preserve_invariant: serial.every(schedule => schedule.invariant_preserved) };
}

module.exports = { analyzeScenario };
