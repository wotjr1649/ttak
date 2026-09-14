'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { anchorMap, anchoredSchema, parseAnchoredResult, outputInstructions } = require('../scripts/verification-anchors.cjs');
const { childDelivery, anchoredFormat, format, parentPrompt } = require('../scripts/verification-delivery.cjs');
const { argumentsFor } = require('../scripts/verification-host-worker.cjs');
const { createProtocol } = require('../scripts/verification-worker-protocol.cjs');
const { parseChildResult } = require('../scripts/verification-host-adapter.cjs');
const { diagnosticPacket } = require('../scripts/verification-native-run.cjs');
const { digest, textDigest, encodePacket } = require('../scripts/verification-packet.cjs');
const { textAnchors } = require('../scripts/source-text-anchors.cjs');
function packet(text) {
  const p = diagnosticPacket();
  if (text !== undefined) { p.sources[0].text = text; p.sources[0].sha256 = textDigest(text); }
  return p;
}
function result(p = packet()) {
  return { question_id: p.question_id, packet_sha256: digest(p), anchor_map_sha256: anchorMap(p).anchor_map_sha256,
    status: 'answered', answer: 'Synthetic independently assessed answer.', conditions: [],
    citations: [{ source_id: 'S1', first: 'A0001', last: 'A0001' }], uncertainties: [] };
}
test('shared anchor boundaries preserve whitespace, CRLF, Unicode and every source code unit', () => {
  for (const text of ['A. B! C?', '\n\r\nA.\r\n\rB.  ', '😀 먼저다.\n다음이다。 끝！？', 'Same. Same.', 'a'.repeat(32000)]) {
    const p = packet(text), spans = anchorMap(p).sources[0].anchors;
    assert.equal(spans.map(s => s.text).join(''), text);
    let previous = 0;
    for (const a of spans) {
      assert.equal(a.start, previous); assert.equal(text.slice(a.start, a.end), a.text); previous = a.end;
      assert.doesNotMatch(a.text, /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);
    }
    assert.equal(previous, text.length);
  }
});
test('anchor selection generates exact P0 offsets and quote without model arithmetic', () => {
  const p = packet(), r = result(p), map = anchorMap(p);
  assert.equal(map.sources[0].anchors.length, 3);
  r.citations = [{ source_id: 'S1', first: 'A0002', last: 'A0003' }];
  const decoded = parseAnchoredResult(p, JSON.stringify(r));
  assert.deepEqual(decoded.citations, [{ source_id: 'S1', start: 59, end: 106,
    quote: ' A arrives before B. No other operations occur.' }]);
  assert.deepEqual(parseChildResult(p, JSON.stringify(decoded)), decoded);
  assert.equal(decoded.answer, r.answer); assert.ok(!Object.hasOwn(decoded, 'anchor_map_sha256'));
});
test('repeated source text is selected by position, never fuzzy-matched to the first quote', () => {
  const p = packet('Repeat. Repeat. Repeat.'), r = result(p);
  r.citations[0].first = r.citations[0].last = 'A0003';
  const decoded = parseAnchoredResult(p, JSON.stringify(r));
  assert.equal(decoded.citations[0].start, 15); assert.equal(decoded.citations[0].end, 23);
});
test('foreign, reversed, duplicate, unknown and cross-source anchors fail', () => {
  for (const mutation of [r => r.citations[0].source_id = 'Unknown', r => r.citations[0].first = 'A9999',
    r => r.citations[0].last = 'A9999', r => { r.citations[0].first = 'A0003'; r.citations[0].last = 'A0001'; },
    r => r.citations.push({ ...r.citations[0] }), r => r.citations[0].start = 0,
    r => r.citations[0].quote = 'injected']) {
    const r = result(); mutation(r); assert.throws(() => parseAnchoredResult(packet(), JSON.stringify(r)));
  }
});
test('changed packet, anchor map hash or source version invalidates the result', () => {
  for (const mutation of [r => r.packet_sha256 = '0'.repeat(64), r => r.anchor_map_sha256 = '0'.repeat(64), r => r.question_id = 'Other']) {
    const r = result(); mutation(r); assert.throws(() => parseAnchoredResult(packet(), JSON.stringify(r)), /binding/);
  }
  const p = packet(), r = result(p); p.sources[0].version = 'changed';
  assert.throws(() => parseAnchoredResult(p, JSON.stringify(r)), /anchor_binding/);
});
test('bare JSON remains mandatory and duplicate decoded keys are not silently accepted', () => {
  const json = JSON.stringify(result());
  for (const text of ['```json\n' + json + '\n```', 'prefix' + json, json + '\ntrailing', json.replace('{', '{"status":"answered",'),
    json.replace('"first":', '"\\u0066irst":"A0001","first":')]) {
    assert.throws(() => parseAnchoredResult(packet(), text), /not_json_object|duplicate_result_key/);
  }
});
test('unresolved stays unresolved and answered without evidence cannot pass', () => {
  const r = result(); r.status = 'unresolved'; r.citations = []; r.uncertainties = ['Insufficient evidence.'];
  assert.equal(parseAnchoredResult(packet(), JSON.stringify(r)).status, 'unresolved');
  r.uncertainties = []; assert.throws(() => parseAnchoredResult(packet(), JSON.stringify(r)));
  r.status = 'answered'; assert.throws(() => parseAnchoredResult(packet(), JSON.stringify(r)));
});
test('published v1 bytes remain unchanged; v2 separately binds source map and schema', () => {
  const p = packet();
  for (const host of ['codex', 'claude']) {
    assert.equal(childDelivery(host, p).input_sha256, '7238a68b4f69a6d815dd0f3a0f1d405aa3768f25a2843c2088857b4d00499e14');
    const wire = childDelivery(host, p, anchoredFormat), data = JSON.parse(wire.input);
    assert.equal(data.packet_json, encodePacket(p)); assert.equal(data.anchor_map_sha256, anchorMap(p).anchor_map_sha256);
    assert.deepEqual(data.result_schema, anchoredSchema(p)); assert.equal(data.result_instructions, outputInstructions);
    assert.ok(!Object.hasOwn(data.source_anchors[0].anchors[0], 'start'));
    assert.doesNotMatch(wire.input, /PARENT_ONLY_ORCHID_95/);
    assert.notEqual(wire.input, childDelivery(host, p, format).input);
  }
  assert.equal(textDigest(parentPrompt('claude', p)), '29b15cc0fccb8156c33d02a900281f7b4226c499576a5eec44dddbc6d5402a8b');
});
test('Claude v2 sends fixed child system instructions, without claiming native schema enforcement', () => {
  const args = argumentsFor('claude', 'Session1', anchoredFormat);
  assert.equal(args[args.indexOf('--append-subagent-system-prompt') + 1], outputInstructions);
  assert.ok(!args.includes('--json-schema')); assert.ok(!args.includes('--system-prompt'));
  assert.ok(!argumentsFor('claude', 'Session1').includes('--append-subagent-system-prompt'));
  assert.doesNotMatch(JSON.stringify(args), /--bare|dangerously|api-key/);
});
test('bounded anchor and wire limits fail before native preparation', () => {
  assert.throws(() => textAnchors('A. '.repeat(4097)), /too_many_source_anchors/);
  assert.throws(() => childDelivery('claude', packet('a'.repeat(32000)), anchoredFormat), /delivery_limit/);
  assert.throws(() => childDelivery('claude', packet(), 'unknown'), /unknown_format/);
});
test('Claude collector validates the v2 child input and rejects a v1 downgrade', () => {
  const p = packet(), protocol = createProtocol('claude', p, 'D:\\synthetic', 'D:\\profile', 'Parent1', anchoredFormat);
  protocol.observe({ type: 'system', subtype: 'init', session_id: 'Parent1', model: 'claude-haiku-4-5-20251001', tools: ['Task'] });
  const row = prompt => ({ type: 'assistant', message: { model: 'claude-haiku-4-5-20251001', content: [{ type: 'tool_use',
    id: 'Tool1', name: 'Agent', input: { description: 'synthetic', subagent_type: 'general-purpose', prompt, run_in_background: false } }] } });
  assert.throws(() => protocol.observe(row(childDelivery('claude', p).input)), /child_request/);
});
