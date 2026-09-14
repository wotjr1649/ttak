'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { auditVerificationCall, auditUsage, validateAnswer, receiptSummary } = require('../scripts/verification-native-audit.cjs');
const { digest, textDigest } = require('../scripts/verification-packet.cjs');
const fixture = require('./fixtures/verification-p0.cjs');

test('both normalized host contracts bind the full input, result, model and cleanup without claiming native proof', () => {
  for (const host of ['claude', 'codex']) {
    const ticket = fixture.ticket('child', 0, host), { observed, expected } = fixture.observation(ticket);
    const receipt = auditVerificationCall(ticket, observed, expected);
    assert.equal(receipt.normalized_observations_match, true);
    assert.equal(receipt.native_delivery_verified, false);
    assert.equal(receipt.semantic_quality_verified, false);
    assert.equal(receipt.usage.native_usage_completeness_verified, false);
    assert.equal(receipt.usage.response_count, 1);
    assert.equal(receipt.result_sha256, digest(observed.result));
    assert.ok(Object.isFrozen(receipt.result.citations[0]));
    assert.ok(!Object.hasOwn(receiptSummary(receipt), 'result'));
  }
});
test('extra history, missing input, unexpected tools and fork indicators cannot pass normalized input checks', () => {
  for (const mutate of [o => o.inputs.push({ role: 'assistant', content: 'Parent draft' }),
    o => o.inputs[0].content += ' Parent draft', o => o.inputs.pop(), o => o.inputs[1].content += '\n',
    o => o.history = 'all', o => o.tools = ['Read'], o => o.tools = ['mcp__other__send'],
    o => o.thread_id = o.parent_thread_id, o => o.parent_thread_id = 'OtherParent']) {
    const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket); mutate(observed);
    assert.throws(() => auditVerificationCall(ticket, observed, expected));
  }
  const t = fixture.ticket(), { observed, expected } = fixture.observation(t);
  expected.inputs.push({ role: 'user', content: 'Second input, even if expected by the caller.' });
  observed.inputs = structuredClone(expected.inputs);
  assert.throws(() => auditVerificationCall(t, observed, expected), /child_input_contract/);
});
test('model, version, run, turn, question and response ownership are independently checked', () => {
  for (const mutate of [o => o.model = 'other-model', o => o.effort = 'max', o => o.cli_version = '0.1.0',
    o => o.run_id = 'OtherRun', o => o.turn_id = 'OtherTurn', o => o.call_id = 'C9999',
    o => o.result.question_id = 'Q2', o => o.result.packet_sha256 = '0'.repeat(64),
    o => o.responses[0].model = 'other-model', o => o.responses[0].thread_id = 'OtherThread']) {
    const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket); mutate(observed);
    assert.throws(() => auditVerificationCall(ticket, observed, expected));
  }
});
test('cancelled, partial, failed and incompletely cleaned calls cannot produce receipts', () => {
  for (const mutate of [o => o.completion = 'partial', o => o.completion = 'cancelled', o => o.completion = 'error',
    o => o.cleanup.active_owned_processes = 1, o => o.cleanup.call_finished = false, o => o.cleanup.child_thread_closed = false]) {
    const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket); mutate(observed);
    assert.throws(() => auditVerificationCall(ticket, observed, expected));
  }
});
test('citations require real source IDs, exact UTF-16 spans and no fabricated quote repair', () => {
  const packet = fixture.plan().packets[0].input, { observed } = fixture.observation(fixture.ticket());
  for (const mutate of [r => r.citations[0].source_id = 'Other', r => r.citations[0].start = -1,
    r => r.citations[0].end++, r => r.citations[0].quote += ' invented',
    r => r.citations.push(r.citations[0]), r => r.citations = []]) {
    const result = structuredClone(observed.result); mutate(result); assert.throws(() => validateAnswer(packet, result));
  }
  packet.sources[0].text = '🌱 exact'; packet.sources[0].sha256 = textDigest(packet.sources[0].text);
  const result = structuredClone(observed.result); result.packet_sha256 = digest(packet);
  result.citations = [{ source_id: 'S1', start: 0, end: 2, quote: '🌱' }];
  assert.equal(validateAnswer(packet, result).citations[0].quote, '🌱');
  result.citations[0].end = 1; result.citations[0].quote = '\ud83c';
  assert.throws(() => validateAnswer(packet, result), /invalid_unicode/);
});
test('unresolved evidence and conflicting results remain unresolved; false answers are not semantically certified', () => {
  const ticket = fixture.ticket();
  for (const status of ['unresolved', 'conflict', 'answered']) {
    const { observed, expected } = fixture.observation(ticket);
    observed.result.status = status; observed.result.uncertainties = ['The supplied evidence does not settle this.'];
    assert.equal(auditVerificationCall(ticket, observed, expected).outcome, 'unresolved');
  }
  const { observed, expected } = fixture.observation(ticket);
  observed.result.answer = 'The fixture deliberately makes a false claim despite a valid citation.';
  const report = auditVerificationCall(ticket, observed, expected);
  assert.equal(report.semantic_quality_verified, false);
});
test('response replay is deduplicated, conflicting replay is rejected and independent responses remain distinct', () => {
  const { observed } = fixture.observation(fixture.ticket());
  const duplicate = structuredClone(observed.responses[0]);
  let result = auditUsage('claude', [...observed.responses, duplicate]);
  assert.equal(result.response_count, 1);
  assert.deepEqual(result.limit_debit, { input_tokens: 15, output_tokens: 11 });
  assert.equal(result.raw_totals.thinking_tokens, 4);
  duplicate.usage.output_tokens++;
  assert.throws(() => auditUsage('claude', [...observed.responses, duplicate]), /response_conflict/);
  duplicate.response_id = 'SecondResponse';
  result = auditUsage('claude', [...observed.responses, duplicate]);
  assert.equal(result.response_count, 2); assert.equal(result.raw_totals.output_tokens, 23);
});
test('Codex counter components are preserved and its reservation debit is explicitly not measured cost', () => {
  const { observed } = fixture.observation(fixture.ticket('child', 0, 'codex'));
  const usage = auditUsage('codex', observed.responses);
  assert.deepEqual(usage.raw_totals, fixture.usage('codex'));
  assert.deepEqual(usage.limit_debit, { input_tokens: 27, output_tokens: 15 });
  assert.equal(usage.accounting, 'conservative_component_sum_not_cost');
  assert.equal(auditUsage('codex', observed.responses, fixture.usage('codex')).response_count, 1);
  const bad = fixture.usage('codex'); bad.totalTokens++;
  assert.throws(() => auditUsage('codex', observed.responses, bad), /rollup_mismatch/);
});
test('missing or impossible usage cannot silently become zero; unavailable thinking detail stays null', () => {
  for (const mutate of [o => o.responses = [], o => o.responses[0].usage = null,
    o => delete o.responses[0].usage.input_tokens, o => o.responses[0].usage.input_tokens = -1,
    o => o.responses[0].usage.output_tokens = Number.MAX_SAFE_INTEGER + 1,
    o => o.responses[0].usage.thinking_tokens = 100]) {
    const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket); mutate(observed);
    assert.throws(() => auditVerificationCall(ticket, observed, expected));
  }
  const { observed } = fixture.observation(fixture.ticket()); observed.responses[0].usage.thinking_tokens = null;
  assert.equal(auditUsage('claude', observed.responses).raw_totals.thinking_tokens, null);
});
test('every response and token allocation is checked, without pretending an after-the-fact audit stops a host', () => {
  for (const [field, value] of [['max_input_tokens', 14], ['max_output_tokens', 10], ['max_responses', 1]]) {
    const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket);
    ticket.limits[field] = value;
    if (field === 'max_responses') observed.responses.push({ ...structuredClone(observed.responses[0]), response_id: 'Second' });
    assert.throws(() => auditVerificationCall(ticket, observed, expected), /usage_limit/);
  }
});
test('only live immutable audit receipts can be submitted to the ledger and hidden content is never forwarded', () => {
  const ticket = fixture.ticket(), { observed, expected } = fixture.observation(ticket);
  const receipt = auditVerificationCall(ticket, observed, expected);
  assert.throws(() => receiptSummary(structuredClone(receipt)), /unaudited_receipt/);
  assert.throws(() => { receipt.result.answer = 'Changed'; }, TypeError);
  observed.responses[0].thinking = 'SYNTHETIC_HIDDEN_BODY';
  assert.throws(() => auditVerificationCall(ticket, observed, expected), /invalid_fields/);
});
test('parent steps and the final rewrite use the parent identity and never pose as fresh child contexts', () => {
  for (const kind of ['parent', 'rewrite']) {
    const ticket = fixture.ticket(kind), { observed, expected } = fixture.observation(ticket);
    assert.equal(auditVerificationCall(ticket, observed, expected).kind, kind);
    observed.history = 'none'; assert.throws(() => auditVerificationCall(ticket, observed, expected), /parent_binding/);
  }
});
test('native UUID-shaped parent and child IDs bind without being treated as storage paths', () => {
  const ticket = fixture.ticket(); ticket.parent_thread_id = '12345678-1234-1234-1234-123456789012';
  const { observed, expected } = fixture.observation(ticket);
  observed.thread_id = '23456789-1234-1234-1234-123456789012';
  observed.responses[0].thread_id = observed.thread_id;
  assert.equal(auditVerificationCall(ticket, observed, expected).thread_id, observed.thread_id);
  observed.thread_id = '../' + observed.thread_id;
  assert.throws(() => auditVerificationCall(ticket, observed, expected), /invalid_id/);
});
