'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitUnits, MAX_CHARS } = require('../scripts/review-session.cjs');
const { preparePacket, reviewKey, validateRole, mergeRoles } = require('../scripts/review-roles.cjs');
const { reviewByRoles } = require('../scripts/review-role-workflow.cjs');
const { applyPatches } = require('../scripts/review-repair.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const packet = { task: 'Check fixture facts and relationships.', draft: 'Keep.\n\nWrong.',
  references: [{ id: 'R1', url: 'https://example.test/reference', summary: 'Fixture source.' }] };
const claim = (role, quote, verdict, related = []) => role === 'evidence'
  ? { quote, verdict, reference_ids: ['R1'], reason: 'Fixture source judgment.' }
  : { quote, verdict, related, reason: 'Fixture context judgment.' };
function report(input, role, entries = {}) {
  return { role, review_key: reviewKey(input), units: splitUnits(input.draft).map(unit => ({ id: unit.id,
    non_claim_reason: entries[unit.id]?.length ? '' : 'Fixture unit declares no claim for this role.',
    claims: entries[unit.id] || [] })) };
}
const bad = (input = packet) => report(input, 'evidence', {
  U002: [claim('evidence', 'Wrong.', 'contradicted')],
});

test('selects input fields and binds reports to task, exact draft and evidence', () => {
  const selected = preparePacket({ ...packet, expected: 'secret answer key', references:
    [{ ...packet.references[0], expected: 'never deliver' }] });
  assert.deepEqual(selected, packet);
  const value = bad();
  for (const changed of [{ ...packet, task: 'Other task.' }, { ...packet, draft: 'Keep.\n\nRight.' },
    { ...packet, references: [{ ...packet.references[0], summary: 'Changed evidence.' }] }]) {
    assert.throws(() => validateRole(changed, 'evidence', value), /wrong_role_or_revision/);
  }
  assert.throws(() => validateRole(packet, 'context', value), /wrong_role_or_revision/);
});

test('requires ordered full unit coverage, explicit non-claim reasons and strict fields', () => {
  for (const mutate of [r => r.units.pop(), r => r.units.reverse(), r => r.units[1] = r.units[0],
    r => r.units[0].non_claim_reason = '', r => r.units[1].non_claim_reason = 'Also a non-claim',
    r => r.units[1].extra = true, r => r.coverage_complete = true]) {
    const value = bad(); mutate(value);
    assert.throws(() => validateRole(packet, 'evidence', value));
  }
  assert.equal(validateRole(packet, 'evidence', bad()).claims.length, 1);
});

test('rejects foreign, ambiguous, duplicate and broken-Unicode claim quotes', () => {
  for (const quote of ['Keep.', 'Missing.', '\ud83d']) {
    const value = bad(); value.units[1].claims[0].quote = quote;
    assert.throws(() => validateRole(packet, 'evidence', value), /role_quote/);
  }
  const repeated = { ...packet, draft: 'Keep.\n\nWrong. Wrong.' };
  assert.throws(() => validateRole(repeated, 'evidence', bad(repeated)), /ambiguous_role_quote/);
  const selfOverlap = { ...packet, draft: 'aaa' };
  assert.throws(() => validateRole(selfOverlap, 'evidence', report(selfOverlap, 'evidence', {
    U001: [claim('evidence', 'aa', 'contradicted')],
  })), /ambiguous_role_quote/);
  const duplicate = bad(); duplicate.units[1].claims.push(clone(duplicate.units[1].claims[0]));
  assert.throws(() => validateRole(packet, 'evidence', duplicate), /duplicate_role_claim/);
});

test('checks reference identities, evidence presence and context links', () => {
  for (const ids of [[], ['R2'], ['R1', 'R1']]) {
    const value = bad(); value.units[1].claims[0].reference_ids = ids;
    assert.throws(() => validateRole(packet, 'evidence', value), /invalid_claim_references/);
  }
  const unknown = bad(); unknown.units[1].claims[0].verdict = 'not_established';
  unknown.units[1].claims[0].reference_ids = [];
  assert.equal(validateRole(packet, 'evidence', unknown).claims.length, 1);
  for (const related of [[], [{ unit_id: 'U999', quote: 'Keep.' }],
    [{ unit_id: 'U001', quote: 'Wrong.' }], [{ unit_id: 'U002', quote: 'Wrong.' }],
    [{ unit_id: 'U001', quote: 'Keep.' }, { unit_id: 'U001', quote: 'Keep.' }]]) {
    const value = report(packet, 'context', { U002: [claim('context', 'Wrong.', 'internal_inconsistency', related)] });
    assert.throws(() => validateRole(packet, 'context', value));
  }
  assert.equal(validateRole(packet, 'context', report(packet, 'context', { U002: [
    claim('context', 'Wrong.', 'internal_inconsistency', [{ unit_id: 'U001', quote: 'Keep.' }]),
  ] })).claims.length, 1);
});

test('deduplicates identical negative spans while retaining both reasons and source reports', () => {
  const context = report(packet, 'context', { U002: [
    claim('context', 'Wrong.', 'internal_inconsistency', [{ unit_id: 'U001', quote: 'Keep.' }]),
  ] });
  const merged = mergeRoles(packet, bad(), context);
  assert.equal(merged.status, 'repairable');
  assert.equal(merged.review.units[1].issues.length, 1);
  assert.match(merged.review.units[1].issues[0].reason, /evidence:.*\ncontext:/);
  assert.deepEqual(merged.reports, [bad(), context]);
  assert.equal(applyPatches(packet.draft, merged.review,
    [{ unit_id: 'U002', quote: 'Wrong.', replacement: 'Right.' }]).text, 'Keep.\n\nRight.');
});

test('conflicting positive judgments, unresolved claims and overlapping error locations block repair', () => {
  for (const verdict of ['consistent', 'not_established']) {
    const context = report(packet, 'context', { U002: [claim('context', 'Wrong.', verdict)] });
    const merged = mergeRoles(packet, bad(), context);
    assert.equal(merged.status, 'conflict'); assert.equal(merged.review, null);
  }
  const context = report(packet, 'context', { U002: [
    claim('context', 'Wrong', 'internal_inconsistency', [{ unit_id: 'U001', quote: 'Keep.' }]),
  ] });
  assert.equal(mergeRoles(packet, bad(), context).status, 'overlapping_findings');
  const unresolved = report(packet, 'context', { U001: [claim('context', 'Keep.', 'not_established')] });
  assert.equal(mergeRoles(packet, bad(), unresolved).status, 'unresolved');
});

test('validates size, reference uniqueness and malformed packet text without native calls', () => {
  for (const input of [{ ...packet, draft: '\ud83d' }, { ...packet, task: '' },
    { ...packet, references: [packet.references[0], packet.references[0]] },
    { ...packet, references: [{ ...packet.references[0], summary: 'x'.repeat(MAX_CHARS + 1) }] }]) {
    assert.throws(() => preparePacket(input));
  }
  const huge = bad(); huge.units[1].claims[0].reason = 'x'.repeat(MAX_CHARS);
  assert.throws(() => validateRole(packet, 'evidence', huge), /role_report_too_large/);
});

test('workflow repairs once and rechecks all revised units in five fresh transport sessions', async () => {
  const jobs = [];
  const result = await reviewByRoles({ ...packet, maxCalls: 5 }, async job => {
    jobs.push(clone(job));
    let value;
    if (job.phase === 'repair') value = { patches: [{ unit_id: 'U002', quote: 'Wrong.', replacement: 'Right.\n\nAdded.' }] };
    else value = job.role === 'evidence' && job.packet.draft.includes('Wrong.')
      ? bad(job.packet) : report(job.packet, job.role);
    // Callback mutations must not change the retained packet, prior reports or caller input.
    job.packet.task = 'Mutated callback data';
    if (job.reports) job.reports[0].units = [];
    return { session: `native-${jobs.length}`, value };
  });
  assert.deepEqual(jobs.map(job => job.phase), ['review', 'review', 'repair', 'recheck', 'recheck']);
  assert.equal(result.status, 'reviewed'); assert.equal(result.calls, 5);
  assert.equal(result.repairs, 1); assert.equal(result.text, 'Keep.\n\nRight.\n\nAdded.');
  assert.ok(result.report.reports.every(row => row.units.length === 3));
  assert.equal(result.history.length, 4);
  assert.notEqual(result.history[0].review_key, result.history[2].review_key);
  assert.equal(result.factual_correctness_verified, false);
  assert.equal(packet.draft, 'Keep.\n\nWrong.');
  assert.ok(jobs.filter(job => job.phase !== 'repair').every(job => !Object.hasOwn(job, 'reports')));
});

test('normal-control finding stops before second role or repair and remains incomplete', async () => {
  let calls = 0;
  const result = await reviewByRoles({ ...packet, maxCalls: 5, stopOnFinding: true }, async job => {
    calls++; return { session: 'first', value: bad(job.packet) };
  });
  assert.equal(calls, 1); assert.equal(result.status, 'finding_stop');
  assert.equal(result.text, packet.draft); assert.equal(result.report, null);
  assert.equal(result.workflow_complete, false); assert.equal(result.history.length, 1);
});

test('reserves complete passes and repair plus two rechecks before spending or editing', async () => {
  for (const maxCalls of [1, 2, 3, 4]) {
    let calls = 0;
    const result = await reviewByRoles({ ...packet, maxCalls }, async job => ({
      session: `s-${++calls}`, value: job.role === 'evidence' ? bad(job.packet) : report(job.packet, job.role),
    }));
    assert.equal(result.status, 'budget_exhausted');
    assert.equal(calls, maxCalls === 1 ? 0 : 2);
    assert.equal(result.text, packet.draft); assert.equal(result.repairs, 0);
  }
});

test('old revision reports and repeated sessions cannot complete a revised draft', async () => {
  let calls = 0;
  await assert.rejects(reviewByRoles({ ...packet, maxCalls: 5 }, async job => ({
    session: `s-${++calls}`, value: job.phase === 'repair'
      ? { patches: [{ unit_id: 'U002', quote: 'Wrong.', replacement: 'Right.' }] }
      : job.role === 'evidence' ? bad() : report(packet, 'context'),
  })), /wrong_role_or_revision/);
  assert.equal(calls, 4);
  await assert.rejects(reviewByRoles({ ...packet, maxCalls: 2 }, async job => ({
    session: 'same', value: report(job.packet, job.role),
  })), /session_reused_or_missing/);
});

test('worker failures and invalid first-role reports stop without retry', async () => {
  let calls = 0;
  await assert.rejects(reviewByRoles({ ...packet, maxCalls: 5 }, async () => {
    calls++; throw new Error('transport_failed');
  }), /transport_failed/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(reviewByRoles({ ...packet, maxCalls: 5 }, async () => {
    calls++; return { session: 's', value: report(packet, 'context') };
  }), /wrong_role_or_revision/);
  assert.equal(calls, 1);
});

test('conflicts and repair limits do not invoke repair or claim workflow completion', async () => {
  for (const conflict of [true, false]) {
    let calls = 0;
    const result = await reviewByRoles({ ...packet, maxCalls: 5, maxRepairs: 0 }, async job => ({
      session: `s-${++calls}`, value: job.role === 'evidence' ? bad(job.packet) : report(job.packet, 'context',
        conflict ? { U002: [claim('context', 'Wrong.', 'consistent')] } : {}),
    }));
    assert.equal(calls, 2); assert.equal(result.status, conflict ? 'conflict' : 'repair_limit');
    assert.equal(result.workflow_complete, false);
  }
});

test('positive evidence and context judgments complete in two calls without factual certification', async () => {
  let calls = 0;
  const result = await reviewByRoles({ ...packet, maxCalls: 2 }, async job => ({
    session: `s-${++calls}`, value: report(job.packet, job.role, Object.fromEntries(
      splitUnits(job.packet.draft).map(unit => [unit.id, [claim(job.role, unit.text.trim(),
        job.role === 'evidence' ? 'supported' : 'consistent')]]))),
  }));
  assert.equal(calls, 2); assert.equal(result.status, 'reviewed');
  assert.equal(result.workflow_complete, true); assert.equal(result.report.coverage_complete, true);
  assert.equal(result.factual_correctness_verified, false);
});

test('two repairs require eight calls and every new text gets two complete fresh reviews', async () => {
  let calls = 0;
  const result = await reviewByRoles({ ...packet, maxCalls: 8, maxRepairs: 2 }, async job => {
    calls++;
    const middle = job.packet.draft.includes('Middle.');
    const value = job.phase === 'repair'
      ? { patches: [{ unit_id: 'U002', quote: middle ? 'Middle.' : 'Wrong.', replacement: middle ? 'Right.' : 'Middle.' }] }
      : job.role === 'evidence' && !job.packet.draft.includes('Right.')
        ? report(job.packet, 'evidence', { U002: [claim('evidence', middle ? 'Middle.' : 'Wrong.', 'contradicted')] })
        : report(job.packet, job.role);
    return { session: `s-${calls}`, value };
  });
  assert.equal(result.calls, 8); assert.equal(result.repairs, 2);
  assert.equal(result.status, 'reviewed'); assert.equal(result.history.length, 6);
  assert.equal(new Set(result.history.map(row => row.review_key)).size, 3);
});

test('malformed, unreviewed and broken-Unicode patches fail without a recheck or retry', async () => {
  for (const proposal of [{ patches: [], extra: true }, { patches: [] },
    { patches: [{ unit_id: 'U001', quote: 'Keep.', replacement: 'Other.' }] },
    { patches: [{ unit_id: 'U002', quote: 'Wrong.', replacement: '\ud83d' }] }]) {
    let calls = 0;
    await assert.rejects(reviewByRoles({ ...packet, maxCalls: 5 }, async job => ({
      session: `s-${++calls}`, value: job.phase === 'repair' ? proposal :
        job.role === 'evidence' ? bad(job.packet) : report(job.packet, job.role),
    })));
    assert.equal(calls, 3); assert.equal(packet.draft, 'Keep.\n\nWrong.');
  }
});

test('unresolved claims and invalid options never reach automatic repair', async () => {
  for (const options of [{ maxCalls: 0 }, { maxCalls: 129 }, { maxCalls: 1.5 },
    { maxRepairs: 3 }, { maxRepairs: -1 }, { stopOnFinding: 'yes' }]) {
    await assert.rejects(reviewByRoles({ ...packet, maxCalls: 5, ...options }, async () => assert.fail()),
      /invalid_role_workflow_options/);
  }
  let calls = 0;
  const result = await reviewByRoles({ ...packet, maxCalls: 5 }, async job => ({
    session: `s-${++calls}`, value: job.role === 'evidence'
      ? report(job.packet, 'evidence', { U002: [claim('evidence', 'Wrong.', 'not_established')] })
      : report(job.packet, job.role),
  }));
  assert.equal(result.status, 'unresolved'); assert.equal(calls, 2);
  assert.equal(result.report.review, null); assert.equal(result.workflow_complete, false);
});
