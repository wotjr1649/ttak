'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewDraft } = require('../scripts/review-workflow.cjs');
const clear = id => ({ id, assessment: 'no_issue_found', issues: [] });
const options = { task: 'Review fixture.', draft: 'Keep.\n\nWrong.', evidence: 'Fixture evidence.', maxCalls: 5 };

test('reviews every original and revised unit with separate transport sessions', async () => {
  const jobs = [];
  const result = await reviewDraft(options, async job => {
    jobs.push(job);
    let value = clear(job.unit?.id);
    if (job.phase === 'repair') value = { patches: [{ unit_id: 'U002', quote: 'Wrong.', replacement: 'Correct.' }] };
    else if (job.unit.text === 'Wrong.') value = { id: 'U002', assessment: 'needs_review',
      issues: [{ quote: 'Wrong.', kind: 'contradicted', reason: 'Fixture evidence.' }] };
    return { session: `session-${jobs.length}`, value };
  });
  assert.equal(result.status, 'reviewed'); assert.equal(result.calls, 5);
  assert.equal(result.text, 'Keep.\n\nCorrect.'); assert.equal(result.repairs, 1);
  assert.equal(result.factual_correctness_verified, false);
  assert.deepEqual(jobs.map(job => job.phase), ['review', 'review', 'repair', 'review', 'review']);
  assert.equal(jobs[3].unit.id, 'U001'); assert.equal(jobs[3].draft, result.text);
  assert.ok(jobs.every(job => job.task === options.task && job.evidence === options.evidence));
});

test('insufficient budget starts no partial review pass', async () => {
  let calls = 0;
  const result = await reviewDraft({ ...options, maxCalls: 1 }, async () => { calls++; });
  assert.equal(calls, 0); assert.equal(result.status, 'budget_exhausted');
  assert.equal(result.workflow_complete, false); assert.equal(result.report, null);
});

test('repaired text cannot inherit old completion when recheck budget is insufficient', async () => {
  let calls = 0;
  const result = await reviewDraft({ ...options, draft: 'Wrong.', maxCalls: 2 }, async job => ({
    session: `session-${++calls}`, value: job.phase === 'repair'
      ? { patches: [{ unit_id: 'U001', quote: 'Wrong.', replacement: 'Correct.' }] }
      : { id: 'U001', assessment: 'needs_review', issues: [{ quote: 'Wrong.', kind: 'contradicted', reason: 'Fixture.' }] },
  }));
  assert.equal(calls, 2); assert.equal(result.status, 'budget_exhausted');
  assert.equal(result.text, 'Correct.'); assert.equal(result.report, null); assert.equal(result.workflow_complete, false);
});

test('rejects transport session reuse and propagates a worker failure without retry', async () => {
  await assert.rejects(reviewDraft(options, async job => ({ session: 'same', value: clear(job.unit.id) })), /session_reused/);
  let calls = 0;
  await assert.rejects(reviewDraft(options, async () => { calls++; throw new Error('worker_failed'); }), /worker_failed/);
  assert.equal(calls, 1);
});

test('unresolved evidence and repair limit stop without claiming completion', async () => {
  for (const kind of ['not_established', 'contradicted']) {
    let calls = 0;
    const result = await reviewDraft({ ...options, draft: 'Wrong.', maxRepairs: 0 }, async () => ({
      session: `session-${++calls}`, value: { id: 'U001', assessment: 'needs_review',
        issues: [{ quote: 'Wrong.', kind, reason: 'Fixture.' }] },
    }));
    assert.equal(result.status, kind === 'not_established' ? 'unresolved' : 'repair_limit');
    assert.equal(calls, 1); assert.equal(result.workflow_complete, false);
  }
});

test('invalid bounds and foreign unit judgments fail before further work', async () => {
  for (const maxCalls of [0, -1, 129, 1.5]) {
    await assert.rejects(reviewDraft({ ...options, maxCalls }, async () => assert.fail()), /invalid_workflow_options/);
  }
  let calls = 0;
  await assert.rejects(reviewDraft(options, async () => ({ session: `session-${++calls}`, value: clear('U999') })), /invalid_review/);
  assert.equal(calls, 1);
});
