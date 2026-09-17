'use strict';
// Local append-only scheduling evidence. Operator decisions are data, never user authority.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function validatePlan(jobs, maxCalls) {
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 25 || !Array.isArray(jobs) ||
      jobs.length > maxCalls || !jobs.length || new Set(jobs).size !== jobs.length ||
      jobs.some(id => typeof id !== 'string' || !/^[a-z0-9.-]{1,100}$/.test(id))) throw new Error('invalid_screen_plan');
  if (jobs.some(id => id === '.' || id === '..')) throw new Error('invalid_screen_plan');
}
function createScreenLedger(directory, jobs, maxCalls) {
  validatePlan(jobs, maxCalls);
  fs.mkdirSync(directory);
  write(directory, 'plan.json', { jobs, maxCalls });
}

function openScreenLedger(directory) {
  const plan = read(path.join(directory, 'plan.json'));
  validatePlan(plan.jobs, plan.maxCalls);
  const state = () => {
    let used = 0, next = null, pending = null;
    for (const id of plan.jobs) {
      const dir = path.join(directory, id);
      if (!fs.existsSync(dir)) { if (!next) next = id; continue; }
      if (fs.lstatSync(dir).isSymbolicLink() || fs.realpathSync(dir) !== path.join(fs.realpathSync(directory), id)) {
        throw new Error('screen_path_escape');
      }
      if (next) throw new Error('screen_order_corrupted');
      const receiptPath = path.join(dir, 'receipt.json');
      if (!fs.existsSync(receiptPath)) return { status: 'in_flight_or_interrupted', used: used + 1, pending: id };
      const receipt = read(receiptPath);
      if (receipt.calls !== 1 || !['collected', 'failed'].includes(receipt.status)) throw new Error('screen_receipt_corrupted');
      used += receipt.calls;
      if (receipt.status === 'failed') return { status: 'stopped', used, pending: id };
      const result = read(path.join(dir, 'result.json'));
      if (hash(result) !== receipt.result_sha256) throw new Error('screen_result_changed');
      const decisionPath = path.join(dir, 'decision.json');
      if (!fs.existsSync(decisionPath)) { pending = id; break; }
      const decision = read(decisionPath);
      if (decision.result_sha256 !== receipt.result_sha256) throw new Error('screen_decision_mismatch');
      if (decision.decision !== 'continue') return { status: 'stopped', used, pending: id };
    }
    if (used > plan.maxCalls) throw new Error('screen_budget_corrupted');
    return { status: pending ? 'awaiting_adjudication' : next ? 'ready' : 'complete', used, next, pending };
  };
  async function run(id, invoke) {
    const before = state();
    if (before.status !== 'ready' || before.next !== id || before.used >= plan.maxCalls) throw new Error('screen_not_runnable');
    const dir = path.join(directory, id);
    fs.mkdirSync(dir); // Atomic reservation prevents two processes launching the same job.
    write(dir, 'reservation.json', { id, reserved_calls: 1, started_at: new Date().toISOString() });
    try {
      const result = await invoke();
      write(dir, 'result.json', result);
      write(dir, 'receipt.json', { status: 'collected', calls: 1, result_sha256: hash(result) });
      return result;
    } catch {
      // Count the reservation conservatively; an audit can report confirmed prelaunch failure separately.
      write(dir, 'receipt.json', { status: 'failed', calls: 1, retry: false });
      throw new Error('screen_call_failed_no_retry');
    }
  }
  function adjudicate(id, decision) {
    const current = state();
    if (current.status !== 'awaiting_adjudication' || current.pending !== id ||
        !decision || !['continue', 'stop'].includes(decision.decision) ||
        typeof decision.reason !== 'string' || !decision.reason.trim() || decision.reason.length > 20000 ||
        !Array.isArray(decision.sources) || decision.sources.some(source => typeof source !== 'string')) {
      throw new Error('invalid_screen_adjudication');
    }
    const dir = path.join(directory, id), receipt = read(path.join(dir, 'receipt.json'));
    if (decision.result_sha256 !== receipt.result_sha256) throw new Error('screen_decision_mismatch');
    write(dir, 'decision.json', decision);
    return state();
  }
  return { state, run, adjudicate };
}
module.exports = { createScreenLedger, openScreenLedger, hash };
