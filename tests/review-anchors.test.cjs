'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceAnchors, resolveSpan, decodeAnchoredRole, repairTargets, decodeAnchoredPatches } = require('../scripts/review-anchors.cjs');
const { reviewKey, mergeRoles } = require('../scripts/review-roles.cjs');
const { applyPatches } = require('../scripts/review-repair.cjs');
const packet = draft => ({ task: 'Explain the supplied example.', draft,
  references: [{ id: 'R', url: 'https://example.invalid', summary: 'Synthetic reference.' }] });
const report = (input, role = 'evidence') => ({ role, review_key: reviewKey(input), units: sourceAnchors(input).map(unit => ({
  id: unit.id, non_claim_reason: '', claims: [{ span: { first: unit.anchors[0].id, last: unit.anchors[0].id },
    verdict: role === 'evidence' ? 'not_established' : 'consistent', reason: 'Synthetic judgment.',
    ...(role === 'evidence' ? { reference_ids: [] } : { related: [] }) }] })) });

test('anchors partition every source unit without changing Unicode, line endings or punctuation', () => {
  const p = packet('한글 😀 first. Next?\r\nCode 1.25!\rLast。\n\nSecond paragraph without punctuation');
  for (const unit of sourceAnchors(p)) {
    assert.equal(unit.anchors.map(a => a.text).join(''), unit.text);
    let end = 0;
    for (const anchor of unit.anchors) {
      assert.equal(anchor.start, end);
      assert.equal(unit.text.slice(anchor.start, anchor.end), anchor.text);
      assert.ok(anchor.text.isWellFormed()); end = anchor.end;
    }
    assert.equal(end, unit.text.length);
  }
});

test('a source range includes intervening text and cannot synthesize an ellipsis quote', () => {
  const units = sourceAnchors(packet('Heading. Middle is required. Ending.'));
  assert.equal(resolveSpan(units, 'U001', { first: 'U001.A001', last: 'U001.A003' }), units[0].text);
  for (const span of [{ first: 'U001.A003', last: 'U001.A001' },
    { first: 'U002.A001', last: 'U002.A001' }, { first: 'U001.A001', last: 'U001.A999' },
    { first: 'U001.A001', last: 'U001.A003', quote: 'Heading...Ending' }]) {
    assert.throws(() => resolveSpan(units, 'U001', span));
  }
});

test('decoded reports retain uncertainty and all existing exact-quote checks', () => {
  const p = packet('A reads B. A changes A.');
  const evidence = decodeAnchoredRole(p, 'evidence', report(p));
  const context = decodeAnchoredRole(p, 'context', report(p, 'context'));
  assert.equal(evidence.units[0].claims[0].quote, 'A reads B.');
  assert.equal(mergeRoles(p, evidence, context).status, 'unresolved');
  const duplicate = packet('Same.\nSame.\n');
  assert.throws(() => decodeAnchoredRole(duplicate, 'evidence', report(duplicate)), /ambiguous_role_quote/);
});

test('stale, foreign, reordered, extra-field and invalid-reference reports remain rejected', () => {
  const p = packet('First.\n\nSecond.');
  for (const mutate of [r => r.review_key = 'stale', r => r.units.reverse(), r => r.units.pop(),
    r => r.units[0].claims[0].quote = 'injected', r => r.units[0].claims[0].span.first = 'U002.A001',
    r => r.units[0].claims[0].reference_ids = ['foreign'], r => r.units[0].claims[0].verdict = 'supported']) {
    const value = report(p); mutate(value);
    assert.throws(() => decodeAnchoredRole(p, 'evidence', value));
  }
});

test('context links resolve source ranges while self-links and missing support fail', () => {
  const p = packet('A reads B.\n\nA never reads B.');
  const value = report(p, 'context');
  const claim = value.units[1].claims[0]; claim.verdict = 'internal_inconsistency';
  claim.related = [{ unit_id: 'U001', span: { first: 'U001.A001', last: 'U001.A001' } }];
  const result = decodeAnchoredRole(p, 'context', value);
  assert.equal(result.units[1].claims[0].related[0].quote, 'A reads B.\n');
  claim.related[0] = { unit_id: 'U002', span: { first: 'U002.A001', last: 'U002.A001' } };
  assert.throws(() => decodeAnchoredRole(p, 'context', value));
});

test('pathological punctuation cannot create an unbounded address catalog', () => {
  assert.throws(() => sourceAnchors(packet('a. '.repeat(4100))), /too_many_source_anchors/);
});

test('repair IDs resolve only reviewed quotes and still pass the original patch validator', () => {
  const p = packet('Before. Wrong 😀. After.');
  const review = { units: [{ id: 'U001', assessment: 'needs_review', issues: [
    { kind: 'contradicted', quote: 'Wrong 😀.', reason: 'Synthetic error.' }] }] };
  assert.deepEqual(repairTargets(p, review), [{ id: 'P001', unit_id: 'U001', quote: 'Wrong 😀.' }]);
  const value = { patches: [{ target_id: 'P001', replacement: 'Correct 😀.' }] };
  const patches = decodeAnchoredPatches(p, review, value).patches;
  assert.equal(applyPatches(p.draft, review, patches).text, 'Before. Correct 😀. After.');
  for (const changed of [{ patches: [] }, { patches: [{ target_id: 'P001', replacement: '\ud800' }] }]) {
    assert.throws(() => applyPatches(p.draft, review, decodeAnchoredPatches(p, review, changed).patches));
  }
  for (const changed of [{ patches: [{ target_id: 'P002', replacement: 'x' }] },
    { patches: [value.patches[0], value.patches[0]] },
    { patches: [{ ...value.patches[0], quote: 'Before.' }] }]) {
    assert.throws(() => decodeAnchoredPatches(p, review, changed));
  }
  review.units[0].issues[0].kind = 'not_established';
  assert.throws(() => repairTargets(p, review), /unresolved_anchored_repair/);
});
