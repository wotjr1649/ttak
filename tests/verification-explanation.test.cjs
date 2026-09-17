'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { validateSpec, budgetFor, createExplanationRun, validateReview, parentRequest } = require('../scripts/verification-explanation.cjs');
const { digest } = require('../scripts/verification-packet.cjs');
const fixture = require('./fixtures/verification-explanation.cjs');
const base = path.resolve(__dirname, '../.superpowers');
function setup(t, spec = fixture.spec(), overrides = {}) {
  fs.mkdirSync(base, { recursive: true }); const cwd = fs.mkdtempSync(path.join(base, 'explanation101-test-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(cwd)), fs.realpathSync(base)); fs.rmSync(cwd, { recursive: true }); });
  const limits = { timeout_ms: 1000, cleanup_ms: 100, not_after_ms: Date.now() + 600000,
    max_observed_input_tokens: 10000, max_observed_output_tokens: 10000, ...overrides };
  return { run: createExplanationRun(cwd, 'run', spec, limits), cwd };
}
test('a real local journal executes draft, isolated packets, comparison and full rewrite without truth claims', async t => {
  const x = setup(t), adapters = fixture.adapters((o, req) => {
    if (req.stage === 'child') {
      assert.deepEqual(Object.keys(req).sort(), ['host', 'packet', 'run_id', 'stage', 'turn_id']);
      assert.doesNotMatch(JSON.stringify(req), /PARENT_ONLY_MARKER|Synthetic1|claims|checks|draft/);
    }
  }, (req, ordinal) => assert.ok(fs.existsSync(path.join(x.run.directory, 'reservation-' + ordinal + '.json'))));
  const outcome = await x.run.run(adapters);
  assert.equal(outcome.status, 'awaiting_review'); assert.equal(adapters.requests.length, 4);
  assert.equal(outcome.rows.filter(r => r.status === 'observed').length, 4);
  assert.equal(outcome.usage.input_including_cache, 400); assert.equal(outcome.usage.output_including_reasoning, 80);
  assert.equal(outcome.budget.top_level_cli_starts, 4); assert.equal(outcome.budget.child_contexts, 2);
  assert.equal(outcome.budget.authority_granted, false); assert.equal(outcome.p0_receipt, null);
  assert.equal(outcome.semantic_quality_verified, false); assert.equal(outcome.semantic_coverage_verified, false);
  assert.equal(outcome.full_input_observed, false); assert.equal(outcome.final.comparisons.length, 2);
  assert.match(adapters.requests.at(-1).prompt, /PARENT_ONLY_MARKER/);
  assert.match(outcome.final.answer, /T1 reads B/);
  await assert.rejects(x.run.run(adapters), /EEXIST/); assert.equal(adapters.requests.length, 4);
});
test('undeclared obligation, unknown source and over-capacity questions fail before any call', () => {
  for (const mutate of [s => s.obligations.push({ id: 'O3', text: 'Missing condition.' }),
    s => s.questions[0].source_ids = ['Unknown'], s => s.questions.push(...Array(7).fill(s.questions[0]))]) {
    const s = fixture.spec(); mutate(s); assert.throws(() => validateSpec(s));
  }
});
test('missing draft coverage stops before a child and retains later UNRUN rows', async t => {
  for (const mutate of [o => o.result.blocks.pop(), o => o.result.unmapped_claims.push('New claim'),
    o => o.result.blocks[0].link_ids = ['Other'], o => o.result.blocks[0].text = '']) {
    const x = setup(t), a = fixture.adapters((o, req) => { if (req.stage === 'draft') mutate(o); });
    const outcome = await x.run.run(a); assert.equal(outcome.status, 'stopped');
    assert.equal(a.requests.length, 1); assert.deepEqual(outcome.rows.map(r => r.status), ['failed', 'UNRUN', 'UNRUN', 'UNRUN']);
  }
});
test('wrong question/hash, unresolved, conflict, incomplete, model and cleanup errors stop immediately', async t => {
  for (const mutate of [o => o.result.question_id = 'Q2', o => o.result.packet_sha256 = '0'.repeat(64),
    o => { o.result.status = 'unresolved'; o.result.uncertainties = ['No evidence.']; },
    o => { o.result.status = 'conflict'; o.result.uncertainties = ['Conflicting evidence.']; },
    o => o.result.citations[0].quote = 'Invented quote', o => o.status = 'partial',
    o => o.model = 'Other', o => o.cleanup_verified = false, o => o.active_owned_processes = 1,
    o => o.request_sha256 = '0'.repeat(64)]) {
    const x = setup(t), a = fixture.adapters((o, req, ordinal) => { if (ordinal === 2) mutate(o); });
    const out = await x.run.run(a); assert.equal(out.status, 'stopped'); assert.equal(a.requests.length, 2);
    assert.deepEqual(out.rows.map(r => r.status), ['observed', 'failed', 'UNRUN', 'UNRUN']);
  }
});
test('duplicate execution identity and explicit cancellation cannot resume or refund reservations', async t => {
  for (const mutate of [(o, req, i) => { if (i === 3) o.execution_id = 'Synthetic2'; },
    (o, req, i) => { if (i === 2) throw new Error('Fixture cancellation'); }]) {
    const x = setup(t), a = fixture.adapters(mutate), out = await x.run.run(a);
    assert.equal(out.status, 'stopped'); assert.equal(out.rows.at(-1).status, 'UNRUN');
    await assert.rejects(x.run.run(a), /EEXIST/);
  }
});
test('malformed or unresolved comparison and new rewrite claims never produce a passed answer', async t => {
  for (const mutate of [o => o.result.comparisons.pop(), o => o.result.comparisons[0].status = 'unresolved',
    o => o.result.comparisons[0].result_sha256 = '0'.repeat(64), o => o.result.unmapped_claims.push('New cost assertion'),
    o => o.result.blocks[1].link_ids = ['L0001']]) {
    const x = setup(t), a = fixture.adapters((o, r) => { if (r.stage === 'rewrite') mutate(o); });
    const out = await x.run.run(a); assert.equal(out.status, 'stopped'); assert.equal(out.final, null);
    assert.equal(out.rows.at(-1).status, 'failed'); assert.equal(a.requests.length, 4);
    assert.ok(fs.existsSync(path.join(x.run.directory, 'observation-4.json')));
  }
});
test('observed usage overflow stops the next call without claiming a native token hard cap', async t => {
  const x = setup(t, fixture.spec(), { max_observed_input_tokens: 150 }), a = fixture.adapters();
  const out = await x.run.run(a); assert.equal(out.failure, 'explanation_usage_stop'); assert.equal(a.requests.length, 2);
  assert.equal(out.usage.input_including_cache, 200); assert.equal(out.budget.token_hard_cap_verified, false);
  assert.equal(out.rows.at(-1).status, 'UNRUN');
});
test('changed saved plan and concurrent calls cannot execute a second unit', async t => {
  const x = setup(t), a = fixture.adapters(); const file = path.join(x.run.directory, 'plan.json');
  const changed = JSON.parse(fs.readFileSync(file, 'utf8')); changed.spec.task += ' Changed';
  fs.writeFileSync(file, JSON.stringify(changed)); await assert.rejects(x.run.run(a), /plan_changed/);
  assert.equal(a.requests.length, 0);
  const y = setup(t), b = fixture.adapters(), results = await Promise.allSettled([y.run.run(b), y.run.run(b)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(b.requests.length, 4);
});
test('completed-answer review checks every criterion and all three error boundaries separately', async t => {
  const s = fixture.spec(), x = setup(t, s), out = await x.run.run(fixture.adapters());
  const pass = { status: 'PASS', evidence: 'Explicit root inspection of the complete local fixture.' };
  const review = { outcome_sha256: digest(out), reviewer: 'root', criteria: s.criteria.map(c => ({ id: c.id, ...pass })),
    question_omission: pass, verifier_error: pass, rewrite_new_error: pass, normal_regression: pass };
  assert.equal(validateReview(s, out, review).status, 'PASS');
  for (const key of ['question_omission', 'verifier_error', 'rewrite_new_error', 'normal_regression']) {
    const changed = structuredClone(review); changed[key].status = 'FAIL';
    assert.equal(validateReview(s, out, changed).status, 'FAIL');
    changed[key].status = 'UNREVIEWED'; assert.equal(validateReview(s, out, changed).status, 'UNREVIEWED');
  }
  const missing = structuredClone(review); missing.criteria.pop(); assert.throws(() => validateReview(s, out, missing));
  const stale = structuredClone(review); stale.outcome_sha256 = '0'.repeat(64); assert.throws(() => validateReview(s, out, stale));
  const other = fixture.spec(); other.task = 'A different task with the same criterion IDs.';
  assert.throws(() => validateReview(other, out, review), /review_binding/);
  const extra = structuredClone(review); extra.question_omission.id = 'Injected';
  assert.throws(() => validateReview(s, out, extra), /invalid_fields/);
});
test('a well-shaped but false verifier answer remains a semantic-review obligation', async t => {
  const x = setup(t), out = await x.run.run(fixture.adapters((o, req) => {
    if (req.stage === 'child') o.result.answer = 'Incorrect interpretation despite an exact citation.';
  }));
  assert.equal(out.status, 'awaiting_review'); assert.equal(out.semantic_quality_verified, false);
  assert.equal(out.p0_receipt, null);
});
test('question capacity and conservative runtime are derived, never treated as authorization', () => {
  const s = fixture.spec(), budget = budgetFor(s, 300000);
  assert.equal(budget.worst_process_ms, 1220000); assert.equal(budget.worst_supervised_ms, 1300000);
  assert.equal(budget.native_api_responses, null); assert.equal(budget.authority_granted, false);
  assert.doesNotMatch(parentRequest(s, 'draft').prompt, /PARENT_ONLY_MARKER/);
});
