'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { collectClaudeTranscript, collectCodexTranscript } = require('../scripts/verification-host-adapter.cjs');
const { auditParentReport, auditParentResult, directStageRequest, nativeFailureCategory } = require('../scripts/verification-explanation-native.cjs');
const { preparePacketRun, executePacketRun, artifacts } = require('../scripts/verification-native-run.cjs');
const { completeAnswer } = require('./fixtures/verification-explanation.cjs');
const { diagnosticPacket } = require('../scripts/verification-native-run.cjs');
const { childDelivery, anchoredFormat } = require('../scripts/verification-delivery.cjs');
const result = completeAnswer('draft'), prompt = 'Synthetic complete-answer request.', time = 1789084800000;
const jsonl = rows => rows.map((r, i) => JSON.stringify({ ...r, timestamp: new Date(time + i).toISOString() })).join('\n') + '\n';
function claudeRows() {
  const base = { sessionId: 'Parent101', version: '2.1.266', isSidechain: false };
  return [{ ...base, uuid: 'U1', type: 'user', message: { content: prompt } },
    { ...base, uuid: 'A1', type: 'assistant', message: { id: 'M1', model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 10 },
      content: [{ type: 'thinking', thinking: 'HIDDEN_BODY_FIXTURE' },
        { type: 'tool_use', id: 'Output1', name: 'StructuredOutput', input: result }] } }];
}
const claudeReport = rows => collectClaudeTranscript(jsonl(rows), { parent_session_id: 'Parent101', agent_id: null });
function codexRows() {
  return [{ type: 'session_meta', payload: { id: 'Parent101', cli_version: '0.154.0' } },
    { type: 'turn_context', payload: { model: 'gpt-5.6-luna', effort: 'high' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(result) }] } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 15, cached_input_tokens: 5,
      cache_write_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 3, total_tokens: 25 } } } },
    { type: 'event_msg', payload: { type: 'task_complete', error: null } }];
}
const codexReport = rows => collectCodexTranscript(jsonl(rows), { thread_id: 'Parent101' });
test('parent result audit binds native structured output or exact JSON text without saving thinking', () => {
  for (const [host, rows, collect] of [['claude', claudeRows(), claudeReport], ['codex', codexRows(), codexReport]]) {
    const report = collect(rows); assert.equal(auditParentReport(report, prompt, time, time + 10), true);
    assert.equal(auditParentResult(host, jsonl(rows), report, result), true);
    assert.doesNotMatch(JSON.stringify(report), /HIDDEN_BODY_FIXTURE/);
    assert.throws(() => auditParentResult(host, jsonl(rows), report, { ...result, answer: 'Forged final answer' }), /result_binding/);
  }
});
test('unexpected parent tool, duplicate/unexpected input, wrong time and fabricated report fail', () => {
  const rows = claudeRows(); rows[1].message.content[1].name = 'Bash';
  assert.throws(() => auditParentReport(claudeReport(rows), prompt, time, time + 10));
  const extra = claudeRows(); extra.push({ ...extra[0], uuid: 'U2', message: { content: 'Unexpected context' } });
  assert.throws(() => auditParentReport(claudeReport(extra), prompt, time, time + 10));
  const report = claudeReport(claudeRows());
  assert.throws(() => auditParentReport(report, prompt, time + 1, time + 10));
  assert.throws(() => auditParentReport(report, prompt, time, time));
  assert.throws(() => auditParentReport(structuredClone(report), prompt, time, time + 10), /uncollected/);
});
test('new packet execution requires explicit expected hashes and validates data before preparation', async () => {
  await assert.rejects(executePacketRun('unused', null, '0'.repeat(64)), /invalid_digest/);
  await assert.rejects(executePacketRun('unused', '0'.repeat(64), '../path'), /invalid_digest/);
  await assert.rejects(preparePacketRun('claude', 'unused', { packet: 'not a packet' }, undefined, 300000), /invalid_fields/);
  assert.ok(artifacts.length <= 32);
  assert.ok(artifacts.filter(f => f !== 'verification-input.cjs').length + 4 <= 32);
});
test('multiple structured outputs and unknown Codex tool calls are not accepted as a finished parent answer', () => {
  const rows = claudeRows(); rows[1].message.content.push(structuredClone(rows[1].message.content[1]));
  assert.throws(() => auditParentResult('claude', jsonl(rows), claudeReport(rows), result), /result_binding/);
  const codex = codexRows(); codex.splice(3, 0, { type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec' } });
  assert.throws(() => auditParentReport(codexReport(codex), prompt, time, time + 20), /parent_report/);
});
test('Codex independent verifier receives exactly its packet with no model-generated coordinator copy', () => {
  const request = { run_id: 'Direct103', turn_id: 'Turn1', host: 'codex', stage: 'child', packet: diagnosticPacket() };
  const direct = directStageRequest(request);
  assert.equal(direct.role, 'independent_verifier_session');
  const envelope = JSON.parse(direct.prompt), legacy = JSON.parse(childDelivery('codex', request.packet, anchoredFormat).input);
  assert.equal(envelope.packet_json, legacy.packet_json); assert.deepEqual(envelope.source_anchors, legacy.source_anchors);
  assert.equal(envelope.schema_version, 5); assert.deepEqual(envelope.result_schema, direct.schema);
  assert.match(envelope.result_instructions, /answered requires an empty uncertainties array/);
  assert.equal(direct.schema.properties.question_id.const, request.packet.question_id);
  for (const key of ['question_id', 'packet_sha256', 'anchor_map_sha256', 'status']) assert.equal(direct.schema.properties[key].type, 'string');
  assert.throws(() => directStageRequest({ ...request, draft: 'PARENT_PRIVATE_CONTEXT' }), /invalid_fields/);
  assert.throws(() => directStageRequest({ ...request, host: 'claude' }), /native_request/);
});
test('native failure categories distinguish capacity and schema errors without retaining payloads', () => {
  for (const value of ['null', '[]', '1', '"message"', 'not JSON']) assert.equal(nativeFailureCategory('codex', value), 'unclassified');
  assert.equal(nativeFailureCategory('codex', JSON.stringify({ type: 'error', message: 'Selected model is at capacity. Please try a different model.' })), 'server_overloaded');
  assert.equal(nativeFailureCategory('codex', JSON.stringify({ type: 'turn.failed', error: { message: 'invalid_json_schema' } })), 'invalid_json_schema');
  assert.equal(nativeFailureCategory('codex', JSON.stringify({ type: 'item.completed', item: { text: 'server_overloaded' } })), 'unclassified');
  assert.equal(nativeFailureCategory('claude', JSON.stringify({ is_error: true, result: 'Provider detail with private data' })), 'unclassified');
});
