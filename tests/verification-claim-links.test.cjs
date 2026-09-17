'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { claimLinkMap, comparisonMap, draftReviewMap, responseSchema, parentRequest, validateParentResult, validateExplanation } = require('../scripts/verification-explanation.cjs');
const { digest } = require('../scripts/verification-packet.cjs');
const { spec, completeAnswer, wireAnswer } = require('./fixtures/verification-explanation.cjs');
test('claim link enumeration is deterministic, complete and bound to the entire spec', () => {
  const s = spec(), map = claimLinkMap(s), wire = wireAnswer(s, completeAnswer('draft'));
  assert.deepEqual(map.links, [{ id: 'L0001', question_id: 'Q1', obligation_id: 'O1' },
    { id: 'L0002', question_id: 'Q2', obligation_id: 'O2' }]);
  const final = validateParentResult(s, wire, 'draft');
  assert.equal(final.answer, wire.blocks.map(b => b.text).join('\n\n'));
  assert.deepEqual(final.claims.map(c => c.quote), wire.blocks.map(b => b.text));
  assert.deepEqual(responseSchema('draft', s).properties.blocks.items.properties.link_ids.items.enum, map.links.map(l => l.id));
  assert.notEqual(claimLinkMap({ ...s, turn_id: 'Other' }).claim_map_sha256, map.claim_map_sha256);
  assert.match(parentRequest(s, 'draft').prompt, /built-in StructuredOutput tool exactly once/);
  assert.match(parentRequest({ ...s, host: 'codex' }, 'draft').prompt, /Return one bare JSON object/);
});
for (const [name, mutate] of Object.entries({
  unknown_link: r => r.blocks[0].link_ids = ['L9999'],
  empty_links: r => r.blocks[0].link_ids = [],
  duplicate_link: r => r.blocks[0].link_ids.push('L0001'),
  mixed_legacy_field: r => r.blocks[0].question_ids = ['Q1'],
  stale_map: r => r.claim_map_sha256 = '0'.repeat(64),
  missing_map: r => delete r.claim_map_sha256,
  missing_obligation: r => r.blocks[1].link_ids = ['L0001'],
  separate_answer: r => r.answer = 'Different answer',
  copied_quote: r => r.blocks[0].quote = 'Not present',
  empty_block: r => r.blocks[0].text = '',
  oversized_block: r => r.blocks[0].text = 'x'.repeat(16001),
  duplicate_claim: r => r.blocks[1].id = r.blocks[0].id,
  admitted_unmapped: r => r.unmapped_claims.push('Uncovered assertion'),
  admitted_uncovered: r => r.uncovered_obligations.push('O2')
})) test('claim contract rejects ' + name, () => {
  const s = spec(), wire = wireAnswer(s, completeAnswer('draft')); mutate(wire);
  assert.throws(() => validateParentResult(s, wire, 'draft'));
});
test('multiple links preserve each legal pair and the original independent-array error still fails', () => {
  const s = spec(), wire = wireAnswer(s, completeAnswer('draft'));
  wire.blocks[0].link_ids.push('L0002');
  assert.deepEqual(validateParentResult(s, wire, 'draft').claims[0].obligation_ids, ['O1', 'O2']);
  const old = completeAnswer('draft'); old.claims[0].obligation_ids.push('O2');
  assert.throws(() => validateExplanation(s, old, 'draft'), /claim_coverage/);
});
test('Markdown, Unicode, code, and line breaks are preserved once without quote reconstruction', () => {
  const s = spec(), wire = wireAnswer(s, completeAnswer('draft'));
  wire.blocks[0].text = '### 설명 🧪\n\n**T1** reads B.\n\n```sql\nSELECT 1;\n```';
  const out = validateParentResult(s, wire, 'draft');
  assert.equal(out.claims[0].quote, wire.blocks[0].text);
  assert.ok(out.answer.includes(out.claims[0].quote));
  const old = completeAnswer('draft'); old.claims[0].quote += ' Changed copy';
  assert.throws(() => validateExplanation(s, old, 'draft'), /claim_quote/);
});
test('rewrite selects fixed check IDs while the caller binds the original question and complete result hash', () => {
  const s = spec(), results = [{ question_id: 'Q1', answer: 'First check' }, { question_id: 'Q2', answer: 'Second check' }];
  const map = comparisonMap(results), req = parentRequest(s, 'rewrite', completeAnswer('draft'), results);
  assert.ok(req.prompt.includes(digest(results[0])));
  assert.deepEqual(req.schema.properties.comparisons.items.required, ['check_id', 'status', 'reason']);
  assert.deepEqual(req.schema.properties.comparisons.items.properties.check_id.enum, ['K0001', 'K0002']);
  const wire = wireAnswer(s, completeAnswer('rewrite', results));
  const final = validateParentResult(s, wire, 'rewrite', results, completeAnswer('draft'));
  assert.deepEqual(final.comparisons.map(c => c.result_sha256), results.map(digest));
  assert.deepEqual(map.map(c => c.result), results);
  for (const mutate of [r => r.comparisons.pop(), r => r.comparisons[1].check_id = 'K0001',
    r => r.comparisons[0].check_id = 'K9999', r => r.comparisons[0].result_sha256 = '0'.repeat(64),
    r => r.comparisons[0].status = 'unresolved']) {
    const bad = structuredClone(wire); mutate(bad); assert.throws(() => validateParentResult(s, bad, 'rewrite', results, completeAnswer('draft')));
  }
});
test('every draft-claim/check link requires an assessment and admitted errors cannot remain verbatim', () => {
  const s = spec(), results = [{ question_id: 'Q1' }, { question_id: 'Q2' }], draft = completeAnswer('draft');
  const wire = wireAnswer(s, completeAnswer('rewrite', results), draft);
  assert.deepEqual(draftReviewMap(s, draft, results).map(r => [r.claim_id, r.check_id]), [['C1', 'K0001'], ['C2', 'K0002']]);
  for (const mutate of [r => r.assessments.pop(), r => r.assessments[1].review_id = 'R0001',
    r => r.assessments[0].review_id = 'R9999', r => r.assessments[0].verdict = 'ignored',
    r => { r.assessments[0].verdict = 'contradicted'; r.blocks[0].text = draft.claims[0].quote; }]) {
    const bad = structuredClone(wire); mutate(bad); assert.throws(() => validateParentResult(s, bad, 'rewrite', results, draft));
  }
  wire.assessments[0].verdict = 'contradicted';
  assert.ok(validateParentResult(s, wire, 'rewrite', results, draft).answer.includes('T1 reads B'));
  const multi = completeAnswer('draft'); multi.claims[0].question_ids.push('Q2'); multi.claims[0].obligation_ids.push('O2');
  assert.equal(draftReviewMap(s, multi, results).length, 3);
});
