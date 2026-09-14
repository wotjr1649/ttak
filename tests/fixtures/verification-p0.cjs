'use strict';
// Public synthetic data only; this fixture neither invokes nor imitates a live host.
const { prepareVerification, encodePacket, textDigest, digest } = require('../../scripts/verification-packet.cjs');
function input() {
  const first = 'T1 reads B and writes A. T2 reads A and writes B.';
  const second = 'Monitoring has a cost on each attempt; retries add work after an abort.';
  return { run_id: 'Run89', turn_id: 'Turn1', language: 'en', draft: 'PRIVATE_DRAFT_PARENT_ONLY',
    obligations: ['O1', 'O2'], bundle: {
      targets: [{ id: 'T1', text: 'Transaction T1' }, { id: 'T2', text: 'Transaction T2' }],
      conditions: [{ id: 'C1', text: 'Both transactions start together.' }],
      sources: [{ id: 'S1', version: 'fixture-1', text: first, sha256: textDigest(first) },
        { id: 'S2', version: 'fixture-1', text: second, sha256: textDigest(second) }] },
    questions: [{ id: 'Q1', kind: 'relationship', target_ids: ['T1', 'T2'], condition_ids: ['C1'], source_ids: ['S1'], covers: ['O1'] },
      { id: 'Q2', kind: 'cost', target_ids: ['T1'], condition_ids: [], source_ids: ['S2'], covers: ['O2'] }] };
}
const plan = () => prepareVerification(input());
const allocation = () => ({ max_responses: 2, max_input_tokens: 100, max_output_tokens: 100 });
function config(host = 'claude') {
  const prepared = plan();
  return { schema_version: 1, run_id: prepared.run_id, turn_id: prepared.turn_id, parent_thread_id: 'Parent1',
    host, cli_version: host === 'claude' ? '2.1.266' : '0.154.0', plan_sha256: digest(prepared),
    questions: prepared.packets.map(({ question_id, packet_sha256 }) => ({ question_id, packet_sha256 })),
    started_at_ms: 1000, deadline_ms: 10000,
    limits: { max_calls: 5, max_responses: 10, max_input_tokens: 500, max_output_tokens: 500, call_timeout_ms: 1000 } };
}
function request(kind = 'child', index = 0) {
  const packet = plan().packets[index];
  return { kind, question_id: kind === 'child' ? packet.question_id : null,
    packet_sha256: kind === 'child' ? packet.packet_sha256 : null, limits: allocation() };
}
function ticket(kind = 'child', index = 0, host = 'claude') {
  const c = config(host);
  return { schema_version: 1, run_id: c.run_id, turn_id: c.turn_id, call_id: 'C0001', host, cli_version: c.cli_version,
    parent_thread_id: c.parent_thread_id, ...request(kind, index), reserved_at_ms: 1000, expires_at_ms: 2000 };
}
function usage(host = 'claude') {
  return host === 'claude' ? { input_tokens: 3, cache_creation_input_tokens: 5, cache_read_input_tokens: 7,
    output_tokens: 11, thinking_tokens: 4 } : { inputTokens: 15, cachedInputTokens: 7, cacheWriteInputTokens: 5,
    outputTokens: 11, reasoningOutputTokens: 4, totalTokens: 26 };
}
function observation(t) {
  const packet = t.kind === 'child' ? plan().packets.find(p => p.question_id === t.question_id).input : null;
  const inputs = [{ role: 'system', content: 'SYNTHETIC_APPROVED_CONTEXT' },
    { role: 'user', content: packet ? encodePacket(packet) : 'Synthetic parent step.' }];
  const thread = packet ? 'Child_' + t.question_id : t.parent_thread_id;
  const model = t.host === 'claude' ? 'claude-haiku-4-5-20251001' : 'gpt-5.6-luna';
  const effort = t.host === 'claude' ? null : 'high';
  const source = packet?.sources[0];
  const result = packet ? { question_id: packet.question_id, packet_sha256: digest(packet), status: 'answered',
    answer: 'SYNTHETIC_VISIBLE_ANSWER', conditions: [], citations: [{ source_id: source.id, start: 0,
      end: source.text.length, quote: source.text }], uncertainties: [] } : { answer: 'SYNTHETIC_PARENT_ANSWER' };
  return { expected: { inputs, packet }, observed: { host: t.host, cli_version: t.cli_version,
    run_id: t.run_id, turn_id: t.turn_id, call_id: t.call_id, thread_id: thread, parent_thread_id: t.parent_thread_id,
    model, effort, history: packet ? 'none' : 'parent', inputs: structuredClone(inputs), tools: [],
    responses: [{ response_id: 'Response_' + t.call_id, thread_id: thread, model, effort, usage: usage(t.host) }],
    rollup: null, completion: 'completed', result,
    cleanup: { call_finished: true, child_thread_closed: !!packet, active_owned_processes: 0 } } };
}
module.exports = { input, plan, config, request, ticket, observation, usage, allocation };
