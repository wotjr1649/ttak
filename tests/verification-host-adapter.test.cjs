'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../scripts/verification-host-adapter.cjs');
const { encodePacket, digest } = require('../scripts/verification-packet.cjs');
const fixture = require('./fixtures/verification-p0.cjs');
const packet = () => fixture.plan().packets[0].input;
const answer = () => fixture.observation(fixture.ticket()).observed.result;
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const binding = () => ({ parent_session_id: 'Parent1', agent_id: 'Child1' });
const usage = output => ({ input_tokens: 3, cache_creation_input_tokens: 5,
  cache_read_input_tokens: 7, output_tokens: output,
  ...(output > 1 ? { output_tokens_details: { thinking_tokens: 4 } } : {}) });
function claudeRows() {
  const base = { sessionId: 'Parent1', version: '2.1.266', isSidechain: true, agentId: 'Child1' };
  return [
    { ...base, uuid: 'U1', type: 'user', message: { content: encodePacket(packet()) } },
    { ...base, uuid: 'A1', type: 'assistant', message: { id: 'Message1', model: 'claude-haiku-4-5-20251001',
      usage: usage(1), content: [{ type: 'thinking', thinking: 'HIDDEN_BODY_FIXTURE' }] } },
    { ...base, uuid: 'A2', type: 'assistant', message: { id: 'Message1', model: 'claude-haiku-4-5-20251001',
      usage: usage(11), content: [{ type: 'text', text: JSON.stringify(answer()) }] } }
  ];
}
function codexRows() {
  return [
    { type: 'session_meta', payload: { id: 'Child1', cli_version: '0.154.0' } },
    { type: 'turn_context', payload: { model: 'gpt-5.6-luna', effort: 'high' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: encodePacket(packet()) }] } },
    { type: 'response_item', payload: { type: 'reasoning', content: [{ text: 'HIDDEN_BODY_FIXTURE' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(answer()) }] } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 15,
      cached_input_tokens: 7, cache_write_input_tokens: 5, output_tokens: 11, reasoning_output_tokens: 4, total_tokens: 26 } } } },
    { type: 'event_msg', payload: { type: 'task_complete', error: null } }
  ];
}
test('Claude selects final usage snapshot without adding replayed messages or thinking text', () => {
  const rows = claudeRows(); rows.push(structuredClone(rows[2]));
  const r = adapter.collectClaudeTranscript(jsonl(rows), binding());
  assert.equal(r.responses.length, 1); assert.equal(r.usage.raw_totals.output_tokens, 11);
  assert.equal(r.usage.limit_debit.output_tokens, 11); assert.equal(r.visible_answer_blocks.length, 1);
  assert.doesNotMatch(JSON.stringify(r), /HIDDEN_BODY_FIXTURE/); assert.ok(Object.isFrozen(r.responses[0].usage));
});
test('Claude changed event UUID payload and decreasing snapshot are rejected', () => {
  let rows = claudeRows(); rows.push(structuredClone(rows[2])); rows[3].message.usage.output_tokens = 12;
  assert.throws(() => adapter.collectClaudeTranscript(jsonl(rows), binding()), /event_conflict/);
  rows = claudeRows(); const revision = structuredClone(rows[2]); revision.uuid = 'A3'; revision.message.usage.output_tokens = 10;
  rows.push(revision); assert.throws(() => adapter.collectClaudeTranscript(jsonl(rows), binding()), /usage_revision_conflict/);
});
test('same Claude response cannot change its input accounting or lose thinking metadata', () => {
  for (const change of [u => u.input_tokens++, u => delete u.output_tokens_details]) {
    const rows = claudeRows(), revision = structuredClone(rows[2]); revision.uuid = 'A3'; change(revision.message.usage); rows.push(revision);
    assert.throws(() => adapter.collectClaudeTranscript(jsonl(rows), binding()), /usage_revision_conflict/);
  }
});
test('Claude wrong session, child, sidechain, version and model are rejected', () => {
  for (const [key, value] of [['sessionId', 'Other'], ['agentId', 'Other'], ['isSidechain', false], ['version', '2.1.267']]) {
    const rows = claudeRows(); rows[2][key] = value;
    assert.throws(() => adapter.collectClaudeTranscript(jsonl(rows), binding()), /thread_binding/);
  }
  const rows = claudeRows(); rows[2].message.model = 'other';
  assert.throws(() => adapter.collectClaudeTranscript(jsonl(rows), binding()), /model_mismatch/);
});
test('Claude final parent and child totals reconcile against native model rollup', () => {
  const child = adapter.collectClaudeTranscript(jsonl(claudeRows()), binding());
  const rows = claudeRows(); for (const row of rows) { row.isSidechain = false; delete row.agentId; if (row.message.id) row.message.id = 'ParentMessage'; }
  const parent = adapter.collectClaudeTranscript(jsonl(rows), { parent_session_id: 'Parent1', agent_id: null });
  const rollup = { inputTokens: 6, cacheCreationInputTokens: 10, cacheReadInputTokens: 14, outputTokens: 22, thinkingTokens: 8 };
  const total = adapter.reconcileClaudeUsage([parent, child], rollup);
  assert.equal(total.response_count, 2); assert.equal(total.limit_debit.input_tokens, 30);
  assert.throws(() => adapter.reconcileClaudeUsage([parent, child], { ...rollup, outputTokens: 23 }), /rollup_mismatch/);
  assert.throws(() => adapter.reconcileClaudeUsage([child, child], rollup), /thread_binding/);
  assert.throws(() => adapter.reconcileClaudeUsage([JSON.parse(JSON.stringify(child))], rollup), /uncollected_report/);
});
test('Codex keeps aggregate snapshots and does not manufacture response IDs', () => {
  const rows = codexRows(); rows.splice(6, 0, structuredClone(rows[5]));
  const r = adapter.collectCodexTranscript(jsonl(rows), { thread_id: 'Child1' });
  assert.equal(r.usage.totalTokens, 26); assert.equal(r.responses, null);
  assert.doesNotMatch(JSON.stringify(r), /HIDDEN_BODY_FIXTURE/);
  const assessed = adapter.assessChildForLedger(r, packet());
  assert.ok(assessed.blockers.includes('native_response_ids_unavailable'));
  assert.equal(assessed.ready_for_ledger, false); assert.equal(assessed.receipt, null);
});
test('Codex missing counters, regressing totals and partial turns fail', () => {
  let rows = codexRows(); delete rows[5].payload.info.total_token_usage.cache_write_input_tokens;
  assert.throws(() => adapter.collectCodexTranscript(jsonl(rows), { thread_id: 'Child1' }), /invalid_integer/);
  rows = codexRows(); rows.splice(6, 0, structuredClone(rows[5])); rows[6].payload.info.total_token_usage.input_tokens--;
  assert.throws(() => adapter.collectCodexTranscript(jsonl(rows), { thread_id: 'Child1' }), /usage_revision_conflict/);
  rows = codexRows(); rows.at(-1).payload.error = { message: 'PRIVATE_ERROR_FIXTURE' };
  assert.throws(() => adapter.collectCodexTranscript(jsonl(rows), { thread_id: 'Child1' }), /^Error: adapter_incomplete_turn$/);
  assert.throws(() => adapter.collectCodexTranscript(jsonl(codexRows().slice(0, -1)), { thread_id: 'Child1' }), /missing_observations/);
});
test('Codex model, effort, version and thread bindings are checked', () => {
  for (const mutate of [r => r[0].payload.id = 'Other', r => r[0].payload.cli_version = '0.155.0',
    r => r[1].payload.model = 'other', r => r[1].payload.effort = 'low']) {
    const rows = codexRows(); mutate(rows);
    assert.throws(() => adapter.collectCodexTranscript(jsonl(rows), { thread_id: 'Child1' }), /binding|model_mismatch/);
  }
});
test('strict result parsing rejects fences, prose, wrong packet and wrong citation', () => {
  assert.deepEqual(adapter.parseChildResult(packet(), JSON.stringify(answer())), answer());
  for (const text of ['```json\n' + JSON.stringify(answer()) + '\n```', 'Answer: ' + JSON.stringify(answer()),
    JSON.stringify(answer()) + '{}', '[]']) {
    assert.throws(() => adapter.parseChildResult(packet(), text), /not_json_object/);
  }
  assert.throws(() => adapter.parseChildResult(packet(), JSON.stringify({ ...answer(), packet_sha256: 'a'.repeat(64) })), /result_binding/);
  const bad = answer(); bad.citations[0].quote = 'invented';
  assert.throws(() => adapter.parseChildResult(packet(), JSON.stringify(bad)), /citation_mismatch/);
});
test('prepared child input separates result instructions from the exact P0 packet', () => {
  for (const host of ['claude', 'codex']) {
    const prepared = adapter.prepareChildInput(host, packet());
    assert.equal(prepared.user_input, encodePacket(packet())); assert.equal(prepared.packet_sha256, digest(packet()));
    assert.equal(prepared.instruction_delivery_verified, false);
    assert.doesNotMatch(JSON.stringify(prepared), /PRIVATE_DRAFT_PARENT_ONLY/);
  }
  assert.throws(() => adapter.prepareChildInput('other', packet()), /unknown_host/);
});
test('visible observations never become a full-input P0 receipt', () => {
  const r = adapter.collectClaudeTranscript(jsonl(claudeRows()), binding());
  const assessed = adapter.assessChildForLedger(r, packet());
  assert.equal(assessed.ready_for_ledger, false); assert.equal(assessed.receipt, null);
  assert.ok(assessed.blockers.includes('full_system_and_developer_input_unobserved'));
  assert.throws(() => adapter.assessChildForLedger({ ...r, full_input_observed: true }, packet()), /uncollected_report/);
});
test('extra child input or tools cannot be accepted as the single packet', () => {
  let rows = claudeRows(); rows[0].message.content += '\nPARENT_DRAFT';
  let r = adapter.collectClaudeTranscript(jsonl(rows), binding());
  assert.throws(() => adapter.assessChildForLedger(r, packet()), /input_mismatch/);
  rows = claudeRows(); rows[2].message.content.push({ type: 'tool_use', id: 'Tool1', name: 'Bash' });
  r = adapter.collectClaudeTranscript(jsonl(rows), binding());
  assert.throws(() => adapter.assessChildForLedger(r, packet()), /child_used_tools/);
});
test('malformed, excessive and executable-looking inputs have no execution route', () => {
  assert.throws(() => adapter.collectClaudeTranscript('{', binding()), /invalid_jsonl/);
  assert.throws(() => adapter.collectClaudeTranscript(' '.repeat(2097153), binding()), /transcript_limit/);
  assert.throws(() => adapter.collectClaudeTranscript('{}\n'.repeat(2049), binding()), /transcript_limit/);
  assert.throws(() => adapter.collectClaudeTranscript(jsonl(claudeRows()), { get parent_session_id() { throw Error('GETTER_EXECUTED'); }, agent_id: 'Child1' }), /invalid_data/);
});
test('unknown user blocks and server tools remain visible and cannot pass the child check', () => {
  const rows = claudeRows(); rows[0].message.content = [{ type: 'text', text: encodePacket(packet()) },
    { type: 'tool_result', tool_use_id: 'OldParentTool', content: 'PARENT_DRAFT_FIXTURE' }];
  let r = adapter.collectClaudeTranscript(jsonl(rows), binding());
  assert.equal(r.non_text_user_blocks.length, 1);
  assert.throws(() => adapter.assessChildForLedger(r, packet()), /input_mismatch/);
  const other = claudeRows(); other[2].message.content.push({ type: 'server_tool_use', id: 'Web1', name: 'web_search' });
  r = adapter.collectClaudeTranscript(jsonl(other), binding());
  assert.throws(() => adapter.assessChildForLedger(r, packet()), /child_used_tools/);
  const codex = codexRows(); codex[2].payload.content.push({ type: 'input_image', image_url: 'synthetic' });
  r = adapter.collectCodexTranscript(jsonl(codex), { thread_id: 'Child1' });
  assert.throws(() => adapter.assessChildForLedger(r, packet()), /input_mismatch/);
});
test('duplicate decoded JSON keys are rejected at every object depth', () => {
  const valid = JSON.stringify(answer());
  assert.throws(() => adapter.parseChildResult(packet(), valid.replace('{', '{"question_id":"Wrong",')), /duplicate_result_key/);
  assert.throws(() => adapter.parseChildResult(packet(), valid.replace('"source_id":', '"source_id":"Wrong","source_id":')), /duplicate_result_key/);
  assert.throws(() => adapter.parseChildResult(packet(), valid.replace('{', '{"question_\\u0069d":"Wrong",')), /duplicate_result_key/);
  const nested = answer(); nested.answer = 'Literal {"x":1,"x":2} and commas are text.';
  assert.equal(adapter.parseChildResult(packet(), JSON.stringify(nested)).answer, nested.answer);
});
