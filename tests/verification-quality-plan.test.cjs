'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createQualityPlan } = require('../scripts/verification-quality-plan.cjs');
const { createQualityCampaign, openQualityCampaign } = require('../scripts/verification-quality-campaign.cjs');
const { digest } = require('../scripts/verification-packet.cjs');
const { modelSettings } = require('../scripts/review-native-format.cjs');
const { wireAnswer } = require('./fixtures/verification-explanation.cjs');
const fs = require('node:fs'), path = require('node:path');
const cases = require('./fixtures/verification-quality-cases.json');
const timeBudgets = { claude: 300000, codex: 600000 }; // Test inputs, not production defaults.
const base = path.resolve(__dirname, '../.superpowers');
test('plans require explicit host budgets and preserve different inference allowances', () => {
  assert.throws(() => createQualityPlan(cases), /explicit_native_time_budget_required/);
  assert.throws(() => createQualityPlan(cases, { claude: 300000 }), /explicit_native_time_budget_required/);
  const plan = createQualityPlan(cases, timeBudgets);
  assert.ok(plan.rows.every(row => row.budget.timeout_ms === timeBudgets[row.host]));
});
function setup(t) {
  fs.mkdirSync(base, { recursive: true }); const cwd = fs.mkdtempSync(path.join(base, 'quality101-test-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(cwd)), fs.realpathSync(base)); fs.rmSync(cwd, { recursive: true }); });
  return { cwd, campaign: createQualityCampaign(cwd, 'campaign', createQualityPlan(cases, timeBudgets)) };
}
// Mechanical campaign sequencing fixture. It says nothing about the held-out task's correct answer.
function fixtureAdapters(row) {
  const spec = row.spec, results = []; let ordinal = 0, draft = null;
  return { parent: invoke, child: invoke };
  async function invoke(req) {
    let result;
    if (req.stage === 'child') {
      const p = req.packet, s = p.sources[0];
      result = { question_id: p.question_id, packet_sha256: digest(p), status: 'answered', answer: 'Synthetic sequencing result.',
        conditions: [], uncertainties: [], citations: [{ source_id: s.id, start: 0, end: s.text.length, quote: s.text }] };
      results.push(result);
    } else {
      const claims = spec.obligations.map((o, i) => ({ id: 'Claim' + i, quote: 'Synthetic claim ' + i + '.',
        question_ids: [spec.questions.find(q => q.covers.includes(o.id)).id], obligation_ids: [o.id] }));
      result = { answer: claims.map(c => c.quote).join(' '), claims, unmapped_claims: [], uncovered_obligations: [],
        ...(req.stage === 'rewrite' ? { comparisons: results.map(r => ({ question_id: r.question_id, result_sha256: digest(r),
          status: 'supported', reason: 'Synthetic sequencing only.' })) } : {}) };
    }
    if (req.stage === 'draft') draft = structuredClone(result);
    if (req.stage !== 'child') result = wireAnswer(spec, result, draft);
    const selected = modelSettings(req.host, 'haiku-luna');
    return { execution_id: 'Fixture' + row.ordinal + 'Stage' + (++ordinal), host: req.host, model: selected.model,
      effort: selected.effort, request_sha256: digest(req), status: 'observed', cleanup_verified: true,
      active_owned_processes: 0, usage: { input_including_cache: 100, output_including_reasoning: 10,
        native_api_responses: null, completeness_verified: false }, result };
  }
}
function reviewFor(spec, outcome, status = 'PASS') {
  const verdict = { status, evidence: 'Sequencing fixture only, not an evaluation of task correctness.' };
  return { outcome_sha256: digest(outcome), reviewer: 'root', criteria: spec.criteria.map(c => ({ id: c.id, ...verdict })),
    question_omission: verdict, verifier_error: verdict, rewrite_new_error: verdict, normal_regression: verdict };
}
test('fixed 12-row campaign counts exact packets, CLI starts, contexts and supervised worst case', () => {
  const p = createQualityPlan(cases, timeBudgets);
  assert.equal(p.rows.length, 12); assert.equal(p.totals.top_level_cli_starts, 84); assert.equal(p.totals.child_contexts, 60);
  assert.equal(p.totals.worst_supervised_ms, 39900000); assert.equal(p.totals.parent_only_starts, 24);
  assert.deepEqual(p.rows.map(r => r.spec.questions.length), [6, 6, 3, 3, 6, 6, 6, 6, 3, 3, 6, 6]);
  assert.ok(p.rows.every(r => r.status === 'UNRUN')); assert.equal(p.native_starts, 0); assert.equal(p.authority_granted, false);
  assert.equal(p.independent_blind_holdout, false); assert.equal(p.normal_plugin_path_verified, false);
});
test('complete row must be reviewed before the next row, and first quality failure permanently stops remaining rows', async t => {
  const x = setup(t), p = createQualityPlan(cases, timeBudgets);
  const first = await x.campaign.runNext(fixtureAdapters);
  assert.equal(first.outcome.status, 'awaiting_review'); assert.equal(x.campaign.state().rows[1].status, 'UNRUN');
  await assert.rejects(x.campaign.runNext(fixtureAdapters), /next_blocked/);
  x.campaign.recordReview(reviewFor(p.rows[0].spec, first.outcome));
  assert.equal(x.campaign.state().status, 'ready');
  const second = await x.campaign.runNext(fixtureAdapters);
  x.campaign.recordReview(reviewFor(p.rows[1].spec, second.outcome, 'FAIL'));
  const reopened = openQualityCampaign(x.cwd, 'campaign', x.campaign.plan_sha256);
  assert.equal(reopened.state().status, 'stopped'); assert.equal(reopened.state().rows.filter(r => r.status === 'UNRUN').length, 10);
  await assert.rejects(reopened.runNext(fixtureAdapters), /next_blocked/);
});
test('adapter preparation failure consumes the campaign row and never repeats a material effect', async t => {
  const x = setup(t); let invoked = 0;
  await assert.rejects(x.campaign.runNext(() => { invoked++; throw new Error('Preparation failed'); }));
  assert.equal(x.campaign.state().status, 'stopped'); assert.equal(x.campaign.state().rows[0].status, 'interrupted_or_in_flight');
  await assert.rejects(x.campaign.runNext(fixtureAdapters), /next_blocked/); assert.equal(invoked, 1);
  assert.equal(x.campaign.state().rows.filter(r => r.status === 'UNRUN').length, 11);
});
test('changed stored plan, wrong expected hash and reordered rows cannot expand campaign scope', t => {
  const x = setup(t);
  assert.throws(() => openQualityCampaign(x.cwd, 'campaign', '0'.repeat(64)), /plan_changed/);
  const p = createQualityPlan(cases, timeBudgets); [p.rows[0], p.rows[1]] = [p.rows[1], p.rows[0]];
  assert.throws(() => createQualityCampaign(x.cwd, 'other', p), /row_binding/);
  const file = path.join(x.campaign.directory, 'plan.json'), changed = JSON.parse(fs.readFileSync(file, 'utf8'));
  changed.totals.top_level_cli_starts++; fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(() => x.campaign.state(), /plan_changed/);
});
