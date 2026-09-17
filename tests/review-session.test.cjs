'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_CHARS, MAX_UNITS, splitUnits, ReviewSession } = require('../scripts/review-session.cjs');

const clear = id => ({ id, assessment: 'no_issue_found', issues: [] });
const finding = (id, quote) => ({ id, assessment: 'needs_review', issues: [
  { quote, kind: 'not_established', reason: 'No supporting evidence.' },
] });

test('preserves Unicode and source line endings while assigning distinct repeated paragraphs', () => {
  assert.deepEqual(splitUnits('\r\n한글 😀\r\nnext\r\n\r\nSame.\r\n\r\nSame.'), [
    { id: 'U001', text: '한글 😀\r\nnext\r\n' },
    { id: 'U002', text: 'Same.\r\n' },
    { id: 'U003', text: 'Same.' },
  ]);
});

test('cannot skip, replay or complete an unreviewed unit', () => {
  const session = new ReviewSession('First.\n\nSecond.');
  assert.throws(() => session.accept(clear('U001')), /no_pending_unit/);
  const pending = session.issue();
  assert.deepEqual(session.issue(), pending);
  assert.throws(() => session.accept(clear('U002')), /invalid_review/);
  assert.throws(() => session.finish(), /incomplete_review/);
  session.accept(clear('U001'));
  assert.throws(() => session.accept(clear('U001')), /no_pending_unit/);
  assert.equal(session.issue().unit.id, 'U002');
  assert.throws(() => session.accept(clear('U001')), /invalid_review/);
  session.accept(finding('U002', 'Second.'));
  assert.deepEqual(session.issue(), { done: true });
  const result = session.finish();
  assert.equal(result.units.length, 2);
  assert.equal(result.coverage_complete, true);
  assert.equal(result.factual_correctness_verified, false);
});

test('rejects quotes from other units and leaves the assigned work pending', () => {
  const session = new ReviewSession('First.\n\nSecond.');
  session.issue();
  assert.throws(() => session.accept(finding('U001', 'Second.')), /invalid_issue/);
  assert.equal(session.issue().remaining, 2);
  session.accept(finding('U001', 'First.'));
  assert.equal(session.issue().unit.id, 'U002');
});

test('caller mutation cannot change source text or accepted evidence', () => {
  const session = new ReviewSession('First.');
  const pending = session.issue();
  pending.unit.text = 'Forged.';
  const row = finding('U001', 'First.');
  session.accept(row);
  row.issues[0].quote = 'Forged.';
  const finished = session.finish();
  finished.units[0].issues[0].quote = 'Forged again.';
  assert.equal(session.finish().units[0].issues[0].quote, 'First.');
});

test('bounds input and cumulative reports without advancing on failure', () => {
  for (const draft of ['', null, 'x'.repeat(MAX_CHARS + 1), 'x\n\n'.repeat(MAX_UNITS + 1)]) {
    assert.throws(() => new ReviewSession(draft));
  }
  const session = new ReviewSession('First.\n\nSecond.');
  session.issue();
  const first = finding('U001', 'First.');
  first.issues[0].reason = 'x'.repeat(60_000);
  session.accept(first);
  session.issue();
  const second = finding('U002', 'Second.');
  second.issues[0].reason = 'x'.repeat(60_000);
  assert.throws(() => session.accept(second), /report_too_large/);
  assert.equal(session.issue().unit.id, 'U002');
  session.accept(clear('U002'));
  assert.equal(session.finish().coverage_complete, true);
});

test('rejects contradictory assessments and extra transport fields', () => {
  const session = new ReviewSession('First.');
  session.issue();
  for (const row of [null, [], { ...clear('U001'), passed: true },
    { ...finding('U001', 'First.'), assessment: 'no_issue_found' },
    { ...clear('U001'), assessment: 'needs_review' },
    { ...finding('U001', 'First.'), issues: Array(MAX_UNITS + 1) }]) {
    assert.throws(() => session.accept(row), /invalid_review/);
  }
  assert.throws(() => session.accept({ ...finding('U001', 'First.'), issues: Array(1) }), /invalid_issue/);
  session.accept(clear('U001'));
  assert.equal(session.finish().factual_correctness_verified, false);
});
