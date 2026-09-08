'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyPatches } = require('../scripts/review-repair.cjs');
const { MAX_CHARS } = require('../scripts/review-session.cjs');
const clear = id => ({ id, assessment: 'no_issue_found', issues: [] });
const issue = (quote, kind = 'contradicted') => ({ quote, kind, reason: 'Fixture evidence.' });
const row = (id, ...issues) => ({ id, assessment: 'needs_review', issues });
const patch = (unit_id, quote, replacement) => ({ unit_id, quote, replacement });

test('rejects a quote that cuts a Unicode surrogate pair', () => {
  for (const quote of ['\ud83d', '\ude00']) {
    const review = { units: [row('U001', issue(quote))] };
    assert.throws(() => applyPatches('😀', review, [patch('U001', quote, 'x')]), /invalid_issue/);
  }
});

test('rejects malformed replacement text while accepting a complete emoji', () => {
  const review = { units: [row('U001', issue('x'))] };
  for (const replacement of ['\ud83d', '\ude00', 'a\ud83db']) {
    assert.throws(() => applyPatches('x', review, [patch('U001', 'x', replacement)]), /invalid_replacement/);
  }
  assert.equal(applyPatches('x', review, [patch('U001', 'x', '😀')]).text, '😀');
});

test('preserves every untouched Unicode character and line ending with unordered input', () => {
  const draft = '\r\n  한글 😀\r\n\t\r\nSame.\r\n\r\nSame.\r\n';
  const review = { units: [row('U003', issue('Same.')), row('U001', issue('😀')), clear('U002')] };
  const patches = [patch('U003', 'Same.', 'Last.'), patch('U001', '😀', '🙂 longer')];
  const before = JSON.stringify({ review, patches });
  const result = applyPatches(draft, review, patches);
  assert.equal(result.text, '\r\n  한글 🙂 longer\r\n\t\r\nSame.\r\n\r\nLast.\r\n');
  assert.equal(result.patch_count, 2);
  assert.equal(result.factual_correctness_verified, false);
  assert.equal(JSON.stringify({ review, patches }), before);
});

test('requires complete valid review before accepting any edits', () => {
  const draft = 'One.\n\nTwo.';
  const good = row('U002', issue('Two.'));
  for (const review of [null, { units: [good] }, { units: [good, good] },
    { units: [clear('U001'), row('U002', issue('One.'))] },
    { units: [clear('U001'), good], factual_correctness_verified: true },
    { units: [clear('U001'), { ...good, assessment: 'no_issue_found' }] }]) {
    assert.throws(() => applyPatches(draft, review, [patch('U002', 'Two.', 'Three.')]));
  }
});

test('rejects repeated and self-overlapping quotes, duplicate findings and overlapping errors', () => {
  for (const [draft, issues, patches] of [
    ['aaa', [issue('aa')], [patch('U001', 'aa', 'b')]],
    ['Same. Same.', [issue('Same.')], [patch('U001', 'Same.', 'Other.')]],
    ['First claim.', [issue('First'), issue('First')], [patch('U001', 'First', 'Other')]],
    ['First claim.', [issue('First claim.'), issue('claim.')],
      [patch('U001', 'First claim.', 'Other.'), patch('U001', 'claim.', 'word.')]],
  ]) assert.throws(() => applyPatches(draft, { units: [row('U001', ...issues)] }, patches));
});

test('protects unresolved claims including ambiguous overlapping occurrences', () => {
  const review = { units: [row('U001', issue('aa', 'not_established'), issue('b'))] };
  // aa occurs at positions 0 and 1; the whole unit is protected when its location is ambiguous.
  assert.throws(() => applyPatches('aaab', review, [patch('U001', 'b', 'c')]), /unresolved_claim_overlap/);
  const onlyUnknown = { units: [row('U001', issue('Unknown', 'not_established'))] };
  assert.deepEqual(applyPatches('Unknown.', onlyUnknown, []), {
    text: 'Unknown.', patch_count: 0, unresolved_issues: 1, factual_correctness_verified: false,
  });
  assert.throws(() => applyPatches('Unknown.', onlyUnknown, [patch('U001', 'Unknown', 'Known')]));
  const disjoint = { units: [row('U001', issue('Unknown', 'not_established'), issue('wrong'))] };
  assert.equal(applyPatches('Unknown and wrong.', disjoint, [patch('U001', 'wrong', 'correct')]).text,
    'Unknown and correct.');
});

test('rejects missing, duplicate, unreviewed, malformed and sparse patches', () => {
  const review = { units: [row('U001', issue('One')), row('U002', issue('Two'))] };
  const first = patch('U001', 'One', '1');
  const second = patch('U002', 'Two', '2');
  for (const patches of [[], [first], [first, first], [first, patch('U002', 'absent', '2')],
    [first, { ...second, extra: true }], [first, { ...second, quote: [] }], Array(2)]) {
    assert.throws(() => applyPatches('One\n\nTwo', review, patches));
  }
});

test('bounds replacement output and rejects empty or unchanged replacements', () => {
  const review = { units: [row('U001', issue('x'))] };
  for (const replacement of ['', ' ', 'x', 'a'.repeat(MAX_CHARS + 1)]) {
    assert.throws(() => applyPatches('x', review, [patch('U001', 'x', replacement)]));
  }
  const longDraft = 'x' + 'z'.repeat(MAX_CHARS - 1);
  assert.throws(() => applyPatches(longDraft, review, [patch('U001', 'x', 'longer')]), /too_large/);
  assert.equal(applyPatches('x', review, [patch('U001', 'x', 'a'.repeat(MAX_CHARS))]).text.length, MAX_CHARS);
  const clearReview = { units: [clear('U001')] };
  assert.equal(applyPatches('Unchanged.', clearReview, []).text, 'Unchanged.');
});
