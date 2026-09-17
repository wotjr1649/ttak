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
  assert.deepEqual(rows[1].result.tools.map(tool => tool.name), ['review_start', 'review_submit', 'review_repair']);
  assert.equal(rows[2].result.structuredContent.next_unit.text, '한글 😀\r\n');
  assert.equal(rows.at(-1).result.structuredContent.units.length, 2);
});

test('repair requires a completed review and starts a new full review with fresh IDs', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(notification);
  const patch = { unit_id: 'U002', quote: 'Wrong.', replacement: 'Correct.\n\nAdded context.' };
  dispatch(call(2, 'review_start', { draft: 'Keep.\n\nWrong.' }));
  assert.equal(dispatch(call(3, 'review_repair', { review_id: 'R1', patches: [patch] })).result.isError, true);
  dispatch(call(4, 'review_submit', { review_id: 'R1', review: clear('U001') }));
  dispatch(call(5, 'review_submit', { review_id: 'R1', review: { id: 'U002', assessment: 'needs_review',
    issues: [{ quote: 'Wrong.', kind: 'contradicted', reason: 'Fixture evidence.' }] } }));
  const fixed = dispatch(call(6, 'review_repair', { review_id: 'R1', patches: [patch] })).result.structuredContent;
  assert.equal(fixed.text, 'Keep.\n\nCorrect.\n\nAdded context.');
  assert.equal(fixed.previous_review_id, 'R1'); assert.equal(fixed.review_id, 'R2');
  assert.equal(fixed.coverage_complete, false); assert.equal(fixed.requires_recheck, true);
  assert.equal(fixed.factual_correctness_verified, false); assert.equal(fixed.remaining, 3);
  assert.equal(fixed.next_unit.id, 'U001');
  assert.equal(dispatch(call(7, 'review_submit', { review_id: 'R1', review: clear('U001') })).result.isError, true);
  assert.equal(dispatch(call(8, 'review_submit', { review_id: 'R2', review: clear('U002') })).result.isError, true);
  for (let i = 1; i <= 3; i++) {
    const result = dispatch(call(8+i, 'review_submit', { review_id: 'R2', review: clear(`U00${i}`) })).result;
    assert.notEqual(result.isError, true);
    if (i === 3) {
      assert.equal(result.structuredContent.coverage_complete, true);
      assert.equal(result.structuredContent.factual_correctness_verified, false);
    }
  }
});

test('invalid repairs and repair notifications cannot replace a completed review', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(notification);
  dispatch(call(2, 'review_start', { draft: 'Wrong.' }));
  dispatch(call(3, 'review_submit', { review_id: 'R1', review: { id: 'U001', assessment: 'needs_review',
    issues: [{ quote: 'Wrong.', kind: 'contradicted', reason: 'Fixture evidence.' }] } }));
  const good = { review_id: 'R1', patches: [{ unit_id: 'U001', quote: 'Wrong.', replacement: 'Correct.' }] };
  const note = call(4, 'review_repair', good); delete note.id;
  assert.equal(dispatch(note), null);
  for (const args of [
    { ...good, review_id: 'R0' }, { ...good, patches: [] },
    { ...good, patches: [{ ...good.patches[0], quote: 'Other.' }] },
    { ...good, patches: [{ ...good.patches[0], replacement: 'x\n\n'.repeat(513) }] },
  ]) assert.equal(dispatch(call(5, 'review_repair', args)).result.isError, true);
  assert.ok(dispatch(call(6, 'review_repair', { ...good, draft: 'Forged.' })).error);
  const result = dispatch(call(7, 'review_repair', good)).result.structuredContent;
  assert.equal(result.review_id, 'R2'); assert.equal(result.text, 'Correct.');
  dispatch(call(8, 'review_submit', { review_id: 'R2', review: clear('U001') }));
  const noChange = dispatch(call(9, 'review_repair', { review_id: 'R2', patches: [] })).result;
  assert.equal(noChange.isError, true); assert.equal(noChange.content[0].text, 'no_repair_needed');
});

test('real stdio repair preserves Unicode and requires a subsequent review', () => {
  const messages = [init, notification,
    call(2, 'review_start', { draft: '오류 😀\r\n' }),
    call(3, 'review_submit', { review_id: 'R1', review: { id: 'U001', assessment: 'needs_review',
      issues: [{ quote: '오류', kind: 'contradicted', reason: 'Fixture evidence.' }] } }),
    call(4, 'review_repair', { review_id: 'R1', patches: [{ unit_id: 'U001', quote: '오류', replacement: '수정' }] }),
    call(5, 'review_submit', { review_id: 'R2', review: clear('U001') })];
  const result = run(messages.map(x => JSON.stringify(x)).join('\n') + '\n');
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const rows = result.stdout.trim().split('\n').map(x => JSON.parse(x));
  const repair = rows[3].result.structuredContent;
  assert.equal(repair.text, '수정 😀\r\n'); assert.equal(repair.coverage_complete, false);
  assert.equal(repair.factual_correctness_verified, false);
  assert.equal(rows[4].result.structuredContent.review_id, 'R2');
  assert.equal(rows[4].result.structuredContent.coverage_complete, true);
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
