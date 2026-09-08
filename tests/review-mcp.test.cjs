'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createDispatcher, MAX_FRAME_BYTES } = require('../scripts/review-mcp.cjs');
const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });
const init = request(1, 'initialize', { protocolVersion: '2025-11-25',
  clientInfo: { name: 'test', version: '1' }, capabilities: {} });
const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
const call = (id, name, args) => request(id, 'tools/call', { name, arguments: args });
const clear = id => ({ id, assessment: 'no_issue_found', issues: [] });

test('requires initialization and ignores mutating notifications', () => {
  const dispatch = createDispatcher();
  assert.equal(dispatch(request(0, 'tools/list')).error.code, -32002);
  assert.equal(dispatch(init).result.protocolVersion, '2025-11-25');
  assert.equal(dispatch(request(2, 'tools/list')).error.code, -32002);
  assert.equal(dispatch(notification), null);
  const message = call(3, 'review_start', { draft: 'Hidden.' });
  delete message.id;
  assert.equal(dispatch(message), null);
  assert.equal(dispatch(call(4, 'review_start', { draft: 'Actual.' })).result.structuredContent.review_id, 'R1');
  assert.equal(dispatch(init).error.code, -32602);
});

test('malformed initialization cannot advance the connection state', () => {
  const invalid = [
    { ...init.params, capabilities: true },
    { ...init.params, capabilities: [] },
    { ...init.params, clientInfo: [] },
    { ...init.params, clientInfo: { name: 'test' } },
    { ...init.params, clientInfo: { name: 42, version: '1' } },
  ];
  for (const params of invalid) {
    const dispatch = createDispatcher();
    assert.equal(dispatch(request(1, 'initialize', params)).error?.code, -32602);
    dispatch(notification);
    assert.equal(dispatch(request(2, 'tools/list')).error.code, -32002);
    assert.equal(dispatch(init).result.protocolVersion, '2025-11-25');
  }
});

test('keeps an unfinished review intact and rejects stale review IDs', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(notification);
  const first = dispatch(call(2, 'review_start', { draft: 'One.\n\nTwo.' })).result.structuredContent;
  assert.equal(first.next_unit.id, 'U001');
  assert.equal(dispatch(call(3, 'review_start', { draft: 'Replacement.' })).result.isError, true);
  assert.equal(dispatch(call(4, 'review_submit', { review_id: 'R1', review: clear('U002') })).result.isError, true);
  assert.equal(dispatch(call(5, 'review_submit', { review_id: 'R1', review: clear('U001') })).result.structuredContent.next_unit.id, 'U002');
  const done = dispatch(call(6, 'review_submit', { review_id: 'R1', review: clear('U002') })).result.structuredContent;
  assert.equal(done.coverage_complete, true); assert.equal(done.factual_correctness_verified, false);
  assert.equal(dispatch(call(7, 'review_start', { draft: 'Next.' })).result.structuredContent.review_id, 'R2');
  assert.equal(dispatch(call(8, 'review_submit', { review_id: 'R1', review: clear('U001') })).result.isError, true);
});

function run(input) {
  return spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/review-mcp.cjs')], {
    input, encoding: 'utf8', timeout: 5000, maxBuffer: 2_000_000,
    env: { SystemRoot: process.env.SystemRoot || process.env.SYSTEMROOT || '' },
  });
}

test('real stdio process completes a Unicode review and emits only JSON-RPC', () => {
  const messages = [init, notification, request(2, 'tools/list'),
    call(3, 'review_start', { draft: '한글 😀\r\n\r\nSecond.' }),
    call(4, 'review_submit', { review_id: 'R1', review: clear('U001') }),
    call(5, 'review_submit', { review_id: 'R1', review: clear('U002') })];
  const result = run(messages.map(x => JSON.stringify(x)).join('\n') + '\n');
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const rows = result.stdout.trim().split('\n').map(x => JSON.parse(x));
  assert.equal(rows.length, 5);
  assert.equal(rows[1].result.tools.length, 2);
  assert.equal(rows[2].result.structuredContent.next_unit.text, '한글 😀\r\n');
  assert.equal(rows.at(-1).result.structuredContent.units.length, 2);
});

test('malformed, incomplete and oversized frames never echo request contents', () => {
  const marker = 'PRIVATE_TEST_MARKER';
  for (const input of [Buffer.from('{"' + marker + '\n'), Buffer.from(marker),
    Buffer.alloc(MAX_FRAME_BYTES + 1, 120), Buffer.from([0xff, 10])]) {
    const result = run(input);
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes(marker));
    assert.ok(JSON.parse(result.stdout.trim()).error);
  }
});
