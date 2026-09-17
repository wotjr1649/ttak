'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const history = require('./fixtures/verification-history.json');
const { validateExplanation, validateParentResult, claimLinkMap } = require('../scripts/verification-explanation.cjs');

function errors(value) {
  const found = [];
  for (const claim of value.result.claims) {
    if (!value.result.answer.includes(claim.quote)) found.push({ id: claim.id, code: 'claim_quote' });
    if (claim.obligation_ids.some(id => !claim.question_ids.some(qid =>
      value.questions.find(q => q.id === qid)?.covers.includes(id)))) found.push({ id: claim.id, code: 'claim_coverage' });
  }
  return found;
}

test('102 preserves all five structural failures, including failures hidden by the first rejection', () => {
  const value = history.legacy102;
  assert.equal(value.result.claims.length, 24);
  assert.deepEqual(errors(value), value.expected_errors);
  assert.throws(() => validateExplanation(value, value.result, 'draft'), /claim_coverage/);
  const linked = structuredClone(value.result);
  linked.claims.find(c => c.id === 'CL5').question_ids.push('Q1');
  assert.throws(() => validateExplanation(value, linked, 'draft'), /claim_quote/);
  assert.deepEqual(value.questions.find(q => q.id === 'Q2').covers, ['O4']);
});

test('102 CL5 can be decomposed into its two exact statements without broadening Q2', () => {
  const value = structuredClone(history.legacy102);
  const at = value.result.claims.findIndex(c => c.id === 'CL5');
  value.result.claims.splice(at, 1,
    { id: 'CL5a', quote: 'T1 and T2 write to different rows.', question_ids: ['Q1'], obligation_ids: ['O2'] },
    { id: 'CL5b', quote: 'Snapshot isolation does not require transactions writing disjoint sets of rows to conflict.',
      question_ids: ['Q2'], obligation_ids: ['O4'] });
  assert.deepEqual(errors(value), history.legacy102.expected_errors.filter(e => e.id !== 'CL5'));
  // This is a structural positive control; the historical explanation remains semantically wrong.
});

test('103 generates exact quotes once, while known incorrect meaning stays a negative quality control', () => {
  const { spec, wire } = history.known103;
  const draftWire = { claim_map_sha256: claimLinkMap(spec).claim_map_sha256, blocks: wire.blocks,
    unmapped_claims: [], uncovered_obligations: [] };
  const result = validateParentResult(spec, draftWire, 'draft');
  assert.ok(result.claims.every(c => result.answer.includes(c.quote)));
  assert.ok(result.answer.includes('T1 still observes `A = true`'));
  const reviewed = history.cases.find(c => c.id === 'known-codex-2');
  assert.equal(reviewed.review.criteria.find(c => c.id === 'H1').status, 'FAIL');
  assert.equal(reviewed.review.criteria.find(c => c.id === 'Q1').status, 'FAIL');
});

test('historical H/Q success and full-flow success remain distinct and no diagnostic becomes a holdout', () => {
  assert.equal(history.cases.length, 7);
  assert.equal(history.cases.filter(c => c.review.criteria.every(r => r.status === 'PASS')).length, 3);
  const normal = history.cases.find(c => c.id === 'normal-claude-1');
  assert.ok(normal.review.criteria.every(r => r.status === 'PASS'));
  assert.equal(normal.review.verifier_error.status, 'FAIL');
  const unseen = history.cases.find(c => c.id === 'unseen-codex-1');
  assert.equal(unseen.review.normal_regression.status, 'UNREVIEWED');
  for (const c of history.cases) {
    assert.equal(c.holdout, false);
    assert.ok(c.answer.trim());
    assert.ok(c.provenance.every(p => /^[a-f0-9]{64}$/.test(p.sha256)));
  }
});
