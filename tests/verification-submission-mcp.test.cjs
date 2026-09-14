'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), path = require('node:path');
const { createDispatcher, serveSubmission } = require('../scripts/verification-submission-mcp.cjs');
const { Readable, Writable } = require('node:stream');
const { diagnosticPacket } = require('../scripts/verification-native-run.cjs');
const { anchorMap } = require('../scripts/verification-anchors.cjs');
const { digest } = require('../scripts/verification-packet.cjs');
const packet = diagnosticPacket();
const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });
const init = req(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'local-test', version: '1' } });
const ready = { jsonrpc: '2.0', method: 'notifications/initialized' };
const answer = () => ({ question_id: packet.question_id, packet_sha256: digest(packet),
  anchor_map_sha256: anchorMap(packet).anchor_map_sha256, status: 'answered', answer: 'Synthetic answer.',
  conditions: [], citations: [{ source_id: 'S1', first: 'A0001', last: 'A0003' }], uncertainties: [] });
const call = args => req(3, 'tools/call', { name: 'verification_submit', arguments: args });
const setup = () => { const d = createDispatcher(packet); d(init); d(ready); return d; };
test('one in-memory structured submission binds the unchanged anchored result without certifying native caller or truth', () => {
  const d = setup(), r = d(call(answer())).result;
  assert.equal(r.structuredContent.accepted, true); assert.equal(r.structuredContent.submission_sha256, digest(answer()));
  assert.equal(r.structuredContent.native_caller_verified, false); assert.equal(r.structuredContent.semantic_quality_verified, false);
  assert.equal(d(call(answer())).result.isError, true);
});
test('submission schema and receiver agree that answered cannot carry material unresolved uncertainties', () => {
  const d = setup(), tools = d(req(2, 'tools/list', {})).result.tools;
  assert.equal(tools[0].strict, true);
  for (const key of ['question_id', 'packet_sha256', 'anchor_map_sha256', 'status']) assert.equal(tools[0].inputSchema.properties[key].type, 'string');
  assert.equal(tools[0].inputSchema.anyOf, undefined);
  assert.match(tools[0].inputSchema.properties.status.description, /uncertainties=\[\]/);
  const mixed = answer(); mixed.uncertainties = ['The asked question is unresolved.'];
  assert.equal(d(call(mixed)).result.isError, true);
  for (const status of ['unresolved', 'conflict']) {
    const value = { ...mixed, status };
    assert.equal(setup()(call(value)).result.structuredContent.accepted, true);
    value.uncertainties = []; assert.equal(setup()(call(value)).result.isError, true);
  }
});
test('malformed data, invented ranges and attempted caller/path controls consume the only attempt', () => {
  for (const mutate of [r => r.citations[0].last = 'A9999', r => r.packet_sha256 = '0'.repeat(64),
    r => r.thread_id = 'pretend-child', r => r.path = 'D:\\unrelated', r => r.command = 'must-not-execute']) {
    const d = setup(), r = answer(); mutate(r);
    assert.equal(d(call(r)).result.content[0].text, 'invalid_verification_submission');
    assert.equal(d(call(answer())).result.content[0].text, 'submission_attempt_consumed');
  }
});
test('notifications and uninitialized calls cannot submit, and only one tool is exposed', () => {
  const d = createDispatcher(packet); assert.equal(d(call(answer())).error.code, -32002);
  d(init); d(ready); const list = d(req(2, 'tools/list', {})).result.tools;
  assert.deepEqual(list.map(t => t.name), ['verification_submit']);
  const notification = call(answer()); delete notification.id; assert.equal(d(notification), null);
  assert.equal(d(call(answer())).result.structuredContent.accepted, true);
  assert.equal(d(req(5, 'resources/read', { uri: 'file:///unrelated' })).error.code, -32601);
});
test('dispatcher does not invoke accessors or echo possible secret values', () => {
  const d = setup(), value = {}; Object.defineProperty(value, 'jsonrpc', { get() { throw new Error('must-not-run'); }, enumerable: true });
  assert.equal(d(value).error.code, -32600);
  const r = answer(); r.answer = 'sk-' + 'A'.repeat(24);
  const out = JSON.stringify(d(call(r))); assert.ok(!out.includes(r.answer));
});
test('connection message count is bounded', () => {
  const d = setup(); for (let i = 0; i < 62; i++) d(req(i + 3, 'ping', {}));
  assert.throws(() => d(req(100, 'ping', {})), /message_limit/);
});

test('malformed initialization cannot enable submissions', () => {
  for (const value of [[], 'unexpected', null]) {
    const d = createDispatcher(packet), changed = structuredClone(init); changed.params.capabilities = value;
    assert.equal(d(changed).error.code, -32602); d(ready); assert.equal(d(call(answer())).error.code, -32002);
  }
});
test('real stdio process completes the protocol using only a public fixture and filtered environment', { timeout: 10000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(k.toUpperCase())));
  const input = [init, ready, req(2, 'tools/list', {}), call(answer())].map(r => JSON.stringify(r)).join('\n') + '\n';
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/verification-submission-mcp.cjs'), '--diagnostic'],
    { input, env, encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 65536 });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const rows = result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).result.structuredContent.accepted, true);
  assert.equal(rows.at(-1).result.structuredContent.native_caller_verified, false);
});

test('bounded stdio rejects excessive total bytes and incomplete frames', async () => {
  for (const [bytes, code] of [[Buffer.alloc(2097153), /stream_limit/], [Buffer.from('{"jsonrpc":"2.0"}'), /incomplete_message/]]) {
    const output = new Writable({ write(chunk, encoding, callback) { callback(); } });
    await assert.rejects(serveSubmission(Readable.from([bytes]), output, packet), code);
  }
});
