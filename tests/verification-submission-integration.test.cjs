'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { agentDefinitions, submissionFormat, pinnedSubmissionFormat, submissionTool, verifierType, coordinatorType } = require('../scripts/verification-submission-contract.cjs');
const { childDelivery } = require('../scripts/verification-delivery.cjs');
const { createProtocol } = require('../scripts/verification-worker-protocol.cjs');
const { argumentsFor } = require('../scripts/verification-host-worker.cjs');
const { diagnosticPacket } = require('../scripts/verification-native-run.cjs');
const { submissionAck, auditSubmissionChild } = require('../scripts/verification-submission-audit.cjs');
const { collectClaudeTranscript } = require('../scripts/verification-host-adapter.cjs');
const { anchorMap } = require('../scripts/verification-anchors.cjs');
const { digest, canonical } = require('../scripts/verification-packet.cjs');
const packet = diagnosticPacket(), model = 'claude-haiku-4-5-20251001';
const input = childDelivery('claude', packet, submissionFormat).input;
const answer = () => ({ question_id: packet.question_id, packet_sha256: digest(packet),
  anchor_map_sha256: anchorMap(packet).anchor_map_sha256, status: 'answered', answer: 'A leaves before B.', conditions: [],
  citations: [{ source_id: 'S1', first: 'A0001', last: 'A0003' }], uncertainties: [] });
const ackContent = () => [{ type: 'text', text: canonical(submissionAck(packet, answer())) }];
function events() {
  return [
    { type: 'system', subtype: 'init', session_id: 'Parent1', model, tools: ['Task'], mcp_servers: [], plugins: [] },
    { type: 'assistant', message: { id: 'ParentM1', model, content: [{ type: 'tool_use', id: 'Agent1', name: 'Agent', input: {
      description: 'Synthetic diagnostic', subagent_type: verifierType, prompt: input, run_in_background: false } }] } },
    { type: 'user', parent_tool_use_id: 'Agent1', message: { content: input } },
    { type: 'assistant', parent_tool_use_id: 'Agent1', message: { id: 'ChildM1', model, content: [
      { type: 'thinking', thinking: 'HIDDEN_REASONING_FIXTURE' }, { type: 'tool_use', id: 'Submit1', name: submissionTool, input: answer() }] } },
    { type: 'user', parent_tool_use_id: 'Agent1', message: { content: [{ type: 'tool_result', tool_use_id: 'Submit1', content: ackContent() }] } },
    { type: 'assistant', parent_tool_use_id: 'Agent1', message: { id: 'ChildM2', model, content: [{ type: 'text', text: 'Submitted.' }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'Agent1', content: [
      { type: 'text', text: 'Submitted.' }, { type: 'text', text: "agentId: Child1 (use SendMessage to continue)" }] }] } },
    { type: 'result', session_id: 'Parent1', subtype: 'success', is_error: false, usage: {}, modelUsage: { [model]: {} } }
  ];
}
const replay = rows => { const p = createProtocol('claude', packet, 'D:\\synthetic', 'D:\\profile', 'Parent1', submissionFormat); rows.forEach(r => p.observe(r)); return p; };
function childRows() {
  return events().filter(r => r.parent_tool_use_id).map((r, i) => ({ ...r,
    uuid: 'Event' + i, sessionId: 'Parent1', agentId: 'Child1', isSidechain: true, version: '2.1.266', timestamp: '2026-09-11T00:00:00Z',
    message: { ...r.message, ...(r.type === 'assistant' ? { usage: { input_tokens: 10, cache_creation_input_tokens: 5,
      cache_read_input_tokens: 7, output_tokens: 20, output_tokens_details: { thinking_tokens: 4 } } } : {}) } }));
}
const collect = rows => collectClaudeTranscript(rows.map(r => JSON.stringify(r)).join('\n'), { parent_session_id: 'Parent1', agent_id: 'Child1' });
test('parent-action diagnostics distinguish prompt and foreground failures without copying rejected data', () => {
  for (const key of ['prompt', 'run_in_background']) {
    const p = replay(events().slice(0, 1)), row = events()[1];
    row.message.content[0].input[key] = 'UNTRUSTED_REJECTED_PAYLOAD';
    assert.throws(() => p.observe(row), /submission_parent_action/);
    const details = p.report.errors[0].blocks[0].parent_action;
    assert.equal(details[key === 'prompt' ? 'prompt_matches' : 'explicit_foreground'], false);
    assert.equal(details.allowed_tool, true); assert.equal(details.verifier_type_matches, true);
    assert.doesNotMatch(JSON.stringify(p.report), /UNTRUSTED_REJECTED_PAYLOAD/);
  }
});
test('submission-field diagnostics expose only expected missing names and counts of unknown fields', () => {
  const p = replay(events().slice(0, 3)), row = events()[3];
  delete row.message.content[1].input.anchor_map_sha256;
  row.message.content[1].input.PRIVATE_UNKNOWN_FIELD = 'UNTRUSTED_REJECTED_PAYLOAD';
  assert.throws(() => p.observe(row), /invalid_fields/);
  const details = p.report.errors[0].blocks[1].submission_fields;
  assert.deepEqual(details.missing, ['anchor_map_sha256']); assert.equal(details.unknown_count, 1);
  assert.equal(details.citation_fields_valid, true);
  assert.doesNotMatch(JSON.stringify(p.report), /PRIVATE_UNKNOWN_FIELD|UNTRUSTED_REJECTED_PAYLOAD/);
});
test('inline server is child-only and exposes one submission tool without host/global configuration', () => {
  const defs = agentDefinitions(process.execPath, path.resolve(__dirname, '../scripts/verification-submission-mcp.cjs'));
  assert.deepEqual(defs[coordinatorType].tools, ['Agent(' + verifierType + ')']);
  assert.equal(defs[coordinatorType].mcpServers, undefined);
  assert.deepEqual(defs[verifierType].tools, [submissionTool]);
  assert.equal(defs[verifierType].mcpServers.length, 1);
  const server = defs[verifierType].mcpServers[0].ttak_verification;
  assert.equal(server.type, 'stdio'); assert.equal(server.command, process.execPath);
  assert.deepEqual(Object.values(server.env), ['', '', '', '', '']);
  const args = argumentsFor('claude', 'Parent1', submissionFormat);
  assert.equal(args[args.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
  assert.equal(args[args.indexOf('--agent') + 1], coordinatorType);
  assert.throws(() => childDelivery('codex', packet, submissionFormat), /claude_only/);
});
test('native protocol binds child submission, ack and completed Agent result', () => {
  const p = replay(events()), envelope = p.finish();
  assert.equal(envelope.children[0].spawn_mode, 'custom_verifier_foreground');
  assert.equal(envelope.children[0].thread_id, 'Child1');
  assert.doesNotMatch(JSON.stringify(p.report), /HIDDEN_REASONING_FIXTURE/);
});
test('v4 supplies exact packet only to the verifier definition and binds the short native dispatch input', () => {
  const wire = childDelivery('claude', packet, pinnedSubmissionFormat);
  assert.equal(JSON.parse(wire.pinned_context).packet_json, JSON.parse(input).packet_json);
  assert.deepEqual(JSON.parse(wire.pinned_context).source_anchors, JSON.parse(input).source_anchors);
  assert.equal(JSON.parse(wire.pinned_context).schema_version, 4);
  assert.match(JSON.parse(wire.pinned_context).result_schema.properties.status.description, /uncertainties=\[\]/);
  assert.ok(wire.input.length < 160); assert.match(wire.input, new RegExp(digest(packet)));
  const args = argumentsFor('claude', 'Parent1', pinnedSubmissionFormat, 'a'.repeat(64), packet);
  const defs = JSON.parse(args[args.indexOf('--agents') + 1]);
  assert.ok(defs[verifierType].prompt.endsWith(wire.pinned_context));
  assert.ok(!defs[coordinatorType].prompt.includes(wire.pinned_context));
  assert.deepEqual(defs[verifierType].tools, [submissionTool]);
  assert.throws(() => argumentsFor('claude', 'Parent1', pinnedSubmissionFormat, null, packet), /pinned_context_binding/);
  assert.throws(() => argumentsFor('claude', 'Parent1', pinnedSubmissionFormat, 'a'.repeat(64), null));
  const rows = events(); rows[1].message.content[0].input.prompt = wire.input; rows[2].message.content = wire.input;
  const p = createProtocol('claude', packet, 'D:\\synthetic', 'D:\\profile', 'Parent1', pinnedSubmissionFormat);
  rows.forEach(r => p.observe(r)); assert.equal(p.finish().children[0].thread_id, 'Child1');
  for (const changed of [wire.input + ' More', wire.input.replace(digest(packet), '0'.repeat(64)), input]) {
    const q = createProtocol('claude', packet, 'D:\\synthetic', 'D:\\profile', 'Parent1', pinnedSubmissionFormat);
    q.observe(rows[0]); const row = structuredClone(rows[1]); row.message.content[0].input.prompt = changed;
    assert.throws(() => q.observe(row), /submission_parent_action/);
  }
});
test('parent submission, wrong child link/type/model and duplicate submission are rejected', () => {
  for (const mutate of [r => delete r[3].parent_tool_use_id, r => r[3].parent_tool_use_id = 'Other',
    r => r[1].message.content[0].input.subagent_type = 'general-purpose', r => r[3].message.model = 'other',
    r => r.splice(4, 0, structuredClone(r[3]))]) {
    const rows = events(); mutate(rows); assert.throws(() => replay(rows).finish());
  }
});
test('extra tools, forged ack, failed tool, stale IDs, missing submission and parent MCP inventory fail', () => {
  for (const mutate of [r => r[3].message.content[1].name = 'Bash', r => r[4].message.content[0].content[0].text = '{}',
    r => r[4].message.content[0].is_error = true, r => r[4].message.content[0].tool_use_id = 'Other',
    r => r.splice(3, 2), r => r[0].mcp_servers = [{ name: 'ttak_verification' }]]) {
    const rows = events(); mutate(rows); assert.throws(() => replay(rows).finish());
  }
});
test('immutable native child report supplies structured result independently of free text', () => {
  const rows = childRows(); rows.at(-1).message.content[0].text = '```json\nTHIS IS NOT THE RESULT\n```';
  const report = collect(rows), audited = auditSubmissionChild(report, packet);
  assert.equal(audited.result.answer, 'A leaves before B.'); assert.equal(audited.submission_sha256, digest(answer()));
  assert.equal(audited.result.citations[0].end, 106); assert.equal(report.native_delivery_verified, false);
  assert.doesNotMatch(JSON.stringify(report), /HIDDEN_REASONING_FIXTURE/);
});
test('native audit rejects result-before-call, extra tools, fake/unlinked ack and parent report', () => {
  for (const mutate of [r => [r[1], r[2]] = [r[2], r[1]], r => r[1].message.content.push({ type: 'tool_use', id: 'Other', name: 'Bash' }),
    r => r[2].message.content[0].content = [{ type: 'text', text: '{}' }], r => r[2].message.content[0].tool_use_id = 'Other']) {
    const rows = childRows(); mutate(rows); assert.throws(() => auditSubmissionChild(collect(rows), packet));
  }
  assert.throws(() => auditSubmissionChild({ tools: [] }, packet), /uncollected/);
});
test('receiver refuses inherited credentials before reading any MCP message', { timeout: 10000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(k.toUpperCase())));
  const sentinel = 'excluded-fixture';
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/verification-submission-mcp.cjs'), '--diagnostic'],
    { input: '{}\n', env: { ...env, CLAUDE_CODE_OAUTH_TOKEN: sentinel }, encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 4096 });
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
test('rejection records a closed diagnostic vocabulary without rejected payloads', () => {
  const p = replay(events().slice(0, 4));
  const row = events()[4]; row.message.content[0].content = { rejected: 'UNTRUSTED_REJECTED_PAYLOAD' };
  assert.throws(() => p.observe(row), /submission_ack_format/);
  assert.equal(p.report.errors[0].code, 'submission_ack_format');
  assert.equal(p.report.errors[0].blocks[0].content_form, 'other');
  assert.doesNotMatch(JSON.stringify(p.report), /UNTRUSTED_REJECTED_PAYLOAD/);
});
test('Claude text-only MCP ack is accepted only as the exact strict JSON object', () => {
  const rows = events(); rows[4].message.content[0].content = ackContent()[0].text;
  assert.equal(replay(rows).finish().children[0].thread_id, 'Child1');
  const native = childRows(); native[2].message.content[0].content = ackContent()[0].text;
  assert.equal(auditSubmissionChild(collect(native), packet).submission_sha256, digest(answer()));
  for (const value of ['```json\n' + ackContent()[0].text + '\n```', 'prefix ' + ackContent()[0].text,
    '{}', ackContent()[0].text.replace('"accepted":true', '"accepted":true,"accepted":true')]) {
    const invalid = events(); invalid[4].message.content[0].content = value;
    assert.throws(() => replay(invalid).finish());
  }
});
