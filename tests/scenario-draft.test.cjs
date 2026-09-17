'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { reviewScenarioDraft, MAX_DRAFT } = require('../scripts/scenario-draft.cjs');
const scenario = () => ({ initial: { left: true, right: true }, invariant: { cells: ['left', 'right'], at_least: 1 },
  transactions: [{ id: 'One', guard: { cells: ['right'], at_least: 1 }, writes: { left: false } },
    { id: 'Two', guard: { cells: ['left'], at_least: 1 }, writes: { right: false } }] });
const review = text => reviewScenarioDraft(scenario(), text, 'en');

test('checks the actual prose and returns locations and computed edges, without trusting claim labels', () => {
  const draft = 'Their writes are disjoint. Neither transaction writes to a cell the other reads from.';
  const result = review(draft);
  assert.equal(result.status, 'needs_revision');
  assert.equal(result.issues.length, 1);
  const issue = result.issues[0];
  assert.match(draft.slice(issue.start, issue.end), /Neither transaction/);
  assert.deepEqual(issue.evidence, [{ reader: 'One', writer: 'Two', cells: ['right'] },
    { reader: 'Two', writer: 'One', cells: ['left'] }]);
  assert.equal(result.draft_semantics_verified, false);
  assert.equal(result.final_answer_verified, false);
});

test('normal write-write denial and unsupported paraphrases are never certified', () => {
  for (const text of ['There is no write-write conflict.', 'Their writes are disjoint but each reads what the other writes.',
    'Neither transaction touches anything relevant.', 'Everything is correct.']) {
    const result = review(text);
    assert.equal(result.issues.length, 0);
    assert.equal(result.status, 'no_supported_issue_found');
    assert.equal(result.draft_semantics_verified, false);
    assert.ok(result.unchecked_spans.length);
  }
});

test('cross-read denial and named participant ordering from the failed native answer are detected',()=>{
  const draft="No row is both read and written by different transactions (from SI's perspective).\n\n## Mitigation: Serializable Isolation\n\nA's read and write must complete before B's read begins, or vice versa.";
  const found=review(draft).issues;
  assert.deepEqual(new Set(found.map(i=>i.check)),new Set(['cross_read_write_overlap','named_isolation_ordering']));
  for(const text of ["Explicit coordination: A's read and write must complete before B's read begins.",
    '"No row is both read and written by different transactions" is wrong.',
    'No row is written by both transactions.'])assert.equal(review(text).issues.length,0);
});

test('renamed cells, reordered transactions and supported formulations retain the same finding', () => {
  const input = { initial: { awake: true, ready: true }, invariant: { cells: ['awake','ready'], at_least: 1 },
    transactions: [{ id: 'Beta', guard: { cells: ['awake'], at_least: 1 }, writes: { ready: false } },
      { id: 'Alpha', guard: { cells: ['ready'], at_least: 1 }, writes: { awake: false } }] };
  for (const text of ['There are no read/write dependencies.', 'The read-write sets are disjoint.',
    'Neither participant updates a value that the other reads.']) {
    const result = reviewScenarioDraft(input, text, 'en');
    assert.equal(result.issues[0].check, 'cross_read_write_overlap');
    assert.equal(result.issues[0].evidence[0].reader, 'Beta');
  }
});

test('no-edge and disabled-writer controls do not get invented contradictions', () => {
  const input = scenario(); input.transactions.forEach(t => { t.guard = { cells: [], at_least: 0 }; });
  assert.equal(reviewScenarioDraft(input, 'There are no read/write overlaps.', 'en').issues.length, 0);
  const disabled = scenario(); disabled.initial.off = false;
  disabled.transactions.forEach(t => { t.guard = { cells: ['left','right','off'], at_least: 3 }; });
  assert.equal(reviewScenarioDraft(disabled, 'There are no read/write overlaps.', 'en').issues.length, 0);
});

test('flags exclusivity and universal scope without rejecting a bounded valid remedy', () => {
  const text = 'The only fix is to serialize these transactions at the lock level. Any two transactions that read overlapping state cannot run in parallel.';
  const result = review(text);
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.every(issue => issue.kind === 'not_established'));
  assert.equal(review('A mitigation in this model is to coordinate complete transactions, including their snapshots. The trade-off is lost concurrency.').issues.length, 0);
});

test('questions, quoted errors, code and explicit rebuttals abstain', () => {
  for (const text of ['Are there no read/write overlaps?', '"There are no read/write overlaps" is wrong.',
    'It is incorrect to say there are no read/write overlaps.', 'If there are no read/write overlaps, this differs.',
    '> There are no read/write overlaps.', '```text\nThere are no read/write overlaps.\n```']) {
    assert.equal(review(text).issues.length, 0, text);
  }
});

test('Korean locations and feedback are preserved without reflecting arbitrary draft text', () => {
  const draft = '🧪 시작 상태입니다. 트랜잭션 간 읽기·쓰기 겹침은 없습니다. 유일한 해결책은 직렬화입니다.';
  const result = reviewScenarioDraft(scenario(), draft, 'ko');
  assert.equal(result.issues.length, 2);
  assert.match(result.issues[0].feedback, /교차 읽기/);
  assert.match(draft.slice(result.issues[0].start, result.issues[0].end), /트랜잭션 간/);
  assert.ok(!JSON.stringify(result).includes('🧪'));
});

test('malformed and unbounded inputs fail before processing', () => {
  for (const draft of ['', null, 'x'.repeat(MAX_DRAFT+1), '\ud800', 'A.\n'.repeat(257)]) {
    assert.throws(() => review(draft));
  }
  assert.throws(() => reviewScenarioDraft({}, 'There are no read/write overlaps.', 'en'));
  assert.throws(() => reviewScenarioDraft(scenario(), 'text', 'unknown'));
});

test('named isolation cannot silently turn into a physical schedule across sentences', () => {
  const draft = 'Use serializable isolation, implemented with locking or conflict detection. With serialization, one transaction must complete before the other begins, so the second sees the changed state. Transactions that touch overlapping data cannot run in parallel.';
  const result = review(draft);
  assert.deepEqual(new Set(result.issues.map(i => i.check)), new Set(['mitigation_scope', 'named_isolation_ordering']));
  assert.match(result.issues.find(i => i.check === 'named_isolation_ordering').feedback, /result equivalence/);
  const final = 'Mitigation: Serializable isolation. One transaction completes entirely—snapshot acquisition, guard check, write—before the other begins.';
  assert.ok(review(final).issues.some(i => i.check === 'named_isolation_ordering'));
});

test('valid serial coordination, outcome equivalence and qualified examples are not ordering failures', () => {
  for (const text of ['Explicitly coordinate whole transactions. One transaction completes before the other begins.',
    'Serializable isolation makes results equivalent to a serial order; concurrent transactions may abort and need retry.',
    'Serializable isolation behaves as if one transaction completes before the other begins.',
    'Serializable does not guarantee that one transaction completes before the other begins.',
    'A serializable implementation may allow concurrency.\n\nFor explicit serial coordination, one transaction must complete before the other begins.']) {
    assert.equal(review(text).issues.length, 0, text);
  }
});
