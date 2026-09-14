'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { collectClaudeTranscript } = require('../scripts/verification-host-adapter.cjs');
const { auditClaudeParent, parentProofInputs } = require('../scripts/verification-parent-claude.cjs');
const { auditParentReport } = require('../scripts/verification-explanation-native.cjs');
const prompt = 'Public synthetic request.', result = { answer: 'Synthetic output.' }, time = 1789084800000;
const enforcement = '[structured-output-enforce] You MUST call the StructuredOutput tool to complete this request. Call this tool now.';
const jsonl = rows => rows.map((r, i) => JSON.stringify({ ...r, timestamp: new Date(time + i).toISOString() })).join('\n');
function rows(meta = false) {
  const base = { sessionId: 'Parent103', version: '2.1.266', isSidechain: false, isMeta: false };
  const user = (uuid, parentUuid, content) => ({ ...base, uuid, parentUuid, type: 'user', message: { role: 'user', content } });
  const assistant = (uuid, parentUuid, content) => ({ ...base, uuid, parentUuid, type: 'assistant', message: {
    role: 'assistant', id: 'M' + uuid, model: 'claude-haiku-4-5-20251001',
    usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 10 }, content } });
  return [user('U1', null, prompt), ...(meta ? [assistant('A0', 'HiddenEvent', [{ type: 'text', text: 'Preliminary answer.' }]),
    { ...user('U2', 'A0', enforcement), isMeta: true }] : []),
  assistant('A1', meta ? 'U2' : 'HiddenEvent', [{ type: 'thinking', thinking: 'HIDDEN_BODY' },
    { type: 'tool_use', id: 'Output1', name: 'StructuredOutput', input: result }]),
  user('U3', 'A1', [{ type: 'tool_result', tool_use_id: 'Output1', is_error: false, content: 'Structured output provided successfully' }])];
}
function audit(r, answer = result) {
  const raw = jsonl(r), report = collectClaudeTranscript(raw, { parent_session_id: 'Parent103', agent_id: null });
  return { report, proof: auditClaudeParent(raw, report, prompt, answer) };
}
test('direct and exactly bound enforcement protocols are accepted with opaque report-bound proofs', () => {
  for (const meta of [false, true]) {
    const { report, proof } = audit(rows(meta));
    assert.equal(proof.enforcement_events, Number(meta));
    assert.equal(auditParentReport(report, prompt, time, time + 10, [], proof), true);
    assert.deepEqual(parentProofInputs(proof, report, prompt), meta ? [prompt, enforcement] : [prompt]);
    assert.doesNotMatch(JSON.stringify({ report, proof }), /HIDDEN_BODY/);
    assert.throws(() => parentProofInputs({ ...proof }, report, prompt), /parent_protocol/);
    assert.throws(() => parentProofInputs(proof, audit(rows(meta)).report, prompt), /parent_protocol/);
    assert.throws(() => parentProofInputs(proof, report, prompt + ' changed'), /parent_protocol/);
    if (meta) assert.throws(() => auditParentReport(report, prompt, time, time + 10), /parent_report/);
  }
});
for (const [name, mutate] of Object.entries({
  unknown_meta: r => r[2].message.content += ' Additional instruction',
  unmarked_meta: r => r[2].isMeta = false,
  wrong_meta_edge: r => r[2].parentUuid = 'U1',
  wrong_meta_role: r => r[2].message.role = 'assistant',
  wrong_output_edge: r => r[3].parentUuid = 'U1',
  malformed_original_meta: r => r[0].isMeta = 'false',
  malformed_assistant_meta: r => r[3].isMeta = 'false',
  malformed_ack_meta: r => r[4].isMeta = 'false',
  repeated_meta: r => r.splice(3, 0, { ...r[2], uuid: 'U4' }),
  changed_duplicate_uuid: r => r.splice(3, 0, { ...r[2], isMeta: false }),
  repeated_uuid: r => r.splice(3, 0, structuredClone(r[2])),
  wrong_session: r => r[2].sessionId = 'Other',
  wrong_version: r => r[2].version = '2.1.265',
  sidechain: r => r[2].isSidechain = true,
  unknown_tool: r => r[3].message.content[1].name = 'Bash',
  second_tool: r => r[3].message.content.push(structuredClone(r[3].message.content[1])),
  wrong_output: r => r[3].message.content[1].input = { answer: 'Changed' },
  missing_ack: r => r.pop(),
  wrong_ack_id: r => r[4].message.content[0].tool_use_id = 'Other',
  wrong_ack_edge: r => r[4].parentUuid = 'U2',
  error_ack: r => r[4].message.content[0].is_error = true,
  malformed_error_ack: r => r[4].message.content[0].is_error = 'false',
  wrong_ack_text: r => r[4].message.content[0].content = 'Other',
  meta_ack: r => r[4].isMeta = true,
  mixed_ack: r => r[4].message.content.push({ type: 'text', text: 'Additional input' }),
  ack_before_call: r => [r[3], r[4]] = [r[4], r[3]],
  post_ack_input: r => r.push({ ...r[0], uuid: 'U9' }),
  original_marked_meta: r => r[0].isMeta = true,
  wrong_original: r => r[0].message.content += ' changed',
  missing_preliminary_text: r => r[1].message.content = [{ type: 'thinking', thinking: 'HIDDEN_BODY' }]
})) test('Claude parent rejects ' + name, () => {
  const r = structuredClone(rows(true)); mutate(r); assert.throws(() => audit(r));
});
test('a collected report from a different visible transcript cannot bless raw native output', () => {
  const r = rows(true), { report } = audit(r); r[1].message.content[0].text = 'Altered';
  assert.throws(() => auditClaudeParent(jsonl(r), report, prompt, result), /parent_protocol/);
  assert.throws(() => auditClaudeParent(jsonl(rows()), structuredClone(audit(rows()).report), prompt, result), /uncollected/);
});
test('native successful acknowledgement may omit is_error but may not provide a nonboolean value', () => {
  const r = rows(); delete r.at(-1).message.content[0].is_error;
  assert.equal(audit(r).proof.acknowledgements, 1);
});
test('split native assistant blocks preserve their observed event chain', () => {
  for (const meta of [false, true]) {
    const r = rows(meta), at = meta ? 3 : 1;
    const thinking = structuredClone(r[at]); thinking.uuid = 'Thinking1';
    thinking.message.content = thinking.message.content.slice(0, 1);
    r[at].message.content = r[at].message.content.slice(1);
    r[at].parentUuid = thinking.uuid; r.splice(at, 0, thinking);
    assert.equal(audit(r).proof.structured_output_calls, 1);
    r[at + 1].parentUuid = 'DifferentBranch';
    assert.throws(() => audit(r), /parent_protocol/);
  }
});
