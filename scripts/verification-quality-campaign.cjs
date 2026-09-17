'use strict';
// Finite local campaign journal. A review is evidence for sequencing, never authority to run a model.
const fs = require('node:fs'), path = require('node:path');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { checkedData, digest, checkDigest, canonical } = require('./verification-packet.cjs');
const { validateSpec, budgetFor, createExplanationRun, validateReview } = require('./verification-explanation.cjs');
function createQualityCampaign(root, name, value) {
  const plan = checkedData(value);
  if (plan.schema_version !== 1 || plan.authority_granted !== false || !Array.isArray(plan.rows) || plan.rows.length !== 12 ||
      plan.native_starts !== 0 || plan.automatic_retries !== 0 || plan.concurrency !== 1 ||
      plan.require_root_review_before_next_row !== true || plan.stop_after_first_execution_delivery_or_quality_failure !== true) {
    throw new Error('quality_plan');
  }
  const expectedOrder = [1, 2].flatMap(rep => ['known', 'normal', 'unseen'].flatMap(id => ['claude', 'codex'].map(host => [rep, id, host])));
  for (const [i, row] of plan.rows.entries()) {
    const spec = validateSpec(row.spec), expected = expectedOrder[i];
    if (row.ordinal !== i + 1 || row.repetition !== expected[0] || row.case_id !== expected[1] || row.host !== expected[2] ||
        row.host !== spec.host || row.status !== 'UNRUN' || row.spec_sha256 !== digest(spec) ||
        canonical(row.budget) !== canonical(budgetFor(spec, row.budget?.timeout_ms, row.budget?.cleanup_ms))) throw new Error('quality_row_binding');
  }
  for (const key of Object.keys(plan.totals)) {
    if (plan.totals[key] !== plan.rows.reduce((sum, r) => sum + r.budget[key], 0)) throw new Error('quality_total_binding');
  }
  const directory = store.location(root, name, false); fs.mkdirSync(directory);
  store.write(path.join(directory, 'plan.json'), plan);
  return openQualityCampaign(root, name, digest(plan));
}
function openQualityCampaign(root, name, planHash) {
  checkDigest(planHash); const directory = store.location(root, name);
  const rowDir = i => path.join(directory, 'row-' + String(i + 1).padStart(2, '0'));
  function inspect() {
    const plan = store.read(path.join(directory, 'plan.json'));
    if (digest(plan) !== planHash) throw new Error('quality_plan_changed');
    const allowed = ['plan.json', ...plan.rows.map((r, i) => path.basename(rowDir(i)))];
    if (store.namesIn(directory, 13).some(n => !allowed.includes(n))) throw new Error('quality_campaign_changed');
    const rows = []; let next = null, stopped = false, pending = false;
    for (const [i, planned] of plan.rows.entries()) {
      let status = 'UNRUN'; const dir = rowDir(i);
      if (store.exists(dir)) {
        store.checkedDirectory(dir);
        if (stopped || pending || next !== null) throw new Error('quality_row_order');
        const outcomeFile = path.join(dir, 'explanation', 'outcome.json');
        const reviewFile = path.join(dir, 'review.json');
        if (!store.exists(outcomeFile)) { status = 'interrupted_or_in_flight'; stopped = true; }
        else {
          const outcome = store.read(outcomeFile);
          const executionPlan = store.read(path.join(dir, 'explanation', 'plan.json'));
          if (digest(executionPlan.spec) !== planned.spec_sha256 || outcome.plan_sha256 !== digest(executionPlan)) throw new Error('quality_outcome_binding');
          if (outcome.status !== 'awaiting_review') { status = 'stopped'; stopped = true; }
          else if (!store.exists(reviewFile)) { status = 'awaiting_review'; pending = true; }
          else {
            const review = validateReview(planned.spec, outcome, store.read(reviewFile));
            status = review.status; if (status !== 'PASS') stopped = true;
          }
        }
      } else if (!stopped && !pending && next === null) next = i;
      rows.push({ ordinal: i + 1, case_id: planned.case_id, host: planned.host, repetition: planned.repetition, status });
    }
    return { plan, rows, next, status: stopped ? 'stopped' : pending ? 'awaiting_review' : next === null ? 'complete' : 'ready' };
  }
  async function runNext(adapterFactory) {
    if (typeof adapterFactory !== 'function') throw new Error('quality_adapter_factory');
    const state = inspect(); if (state.status !== 'ready') throw new Error('quality_next_blocked');
    const row = state.plan.rows[state.next], dir = rowDir(state.next);
    fs.mkdirSync(dir); // Exclusive campaign row claim precedes preparation and any external effect.
    const run = createExplanationRun(dir, 'explanation', row.spec, { timeout_ms: row.budget.timeout_ms, cleanup_ms: row.budget.cleanup_ms,
      not_after_ms: Date.now() + row.budget.worst_supervised_ms + 120000,
      max_observed_input_tokens: state.plan.max_observed_input_tokens_per_row,
      max_observed_output_tokens: state.plan.max_observed_output_tokens_per_row });
    const adapters = await adapterFactory(checkedData(row));
    const outcome = await run.run(adapters); return { outcome, state: inspect().rows };
  }
  function recordReview(value) {
    const state = inspect(); if (state.status !== 'awaiting_review') throw new Error('quality_review_blocked');
    const i = state.rows.findIndex(row => row.status === 'awaiting_review'), planned = state.plan.rows[i];
    const outcome = store.read(path.join(rowDir(i), 'explanation', 'outcome.json'));
    validateReview(planned.spec, outcome, value);
    store.write(path.join(rowDir(i), 'review.json'), value); return summary();
  }
  function summary() {
    const { rows, status, plan } = inspect();
    return { directory, plan_sha256: planHash, status, rows, budget: plan.totals, authority_granted: false,
      automatic_retries: 0, independent_blind_review: false, normal_plugin_path_verified: false };
  }
  inspect(); return { directory, plan_sha256: planHash, runNext, recordReview, state: summary };
}
module.exports = { createQualityCampaign, openQualityCampaign };
