'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createProtocol, verifyCodexCalls } = require('../scripts/verification-worker-protocol.cjs');
const { childDelivery, codexCalls, parentPrompt, codexEnvironment } = require('../scripts/verification-delivery.cjs');
const { argumentsFor } = require('../scripts/verification-host-worker.cjs');
const { diagnosticPacket } = require('../scripts/verification-native-run.cjs');
const { encodePacket, digest } = require('../scripts/verification-packet.cjs');
const path = require('node:path');
const packet = diagnosticPacket(), cwd = 'D:\\synthetic\\run', profile = 'D:\\synthetic\\profile';
const cm = 'claude-haiku-4-5-20251001';
function claudeRows() {
  const content = childDelivery('claude', packet).input;
  return [
    { type: 'system', subtype: 'init', session_id: 'Parent1', model: cm, tools: ['Task'], mcp_servers: [], plugins: [] },
    { type: 'assistant', message: { id: 'M1', model: cm, content: [{ type: 'tool_use', id: 'Tool1', name: 'Agent', input: {
      description: 'FIFO diagnostic', subagent_type: 'general-purpose', prompt: content, run_in_background: false } }] } },
    { type: 'user', parent_tool_use_id: 'Tool1', message: { content } },
    { type: 'assistant', parent_tool_use_id: 'Tool1', message: { id: 'M2', model: cm, content: [
      { type: 'thinking', thinking: 'HIDDEN_REASONING_FIXTURE' }, { type: 'text', text: '{}' }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'Tool1', is_error: false,
      content: [{ type: 'text', text: '{}' }, { type: 'text', text: "agentId: Child1 (use SendMessage to continue)" }] }] } },
    { type: 'result', session_id: 'Parent1', subtype: 'success', is_error: false, result: 'DONE', modelUsage: { [cm]: {} } }
  ];
}
function claudeProtocol(rows = claudeRows()) {
  const p = createProtocol('claude', packet, cwd, profile, 'Parent1'); rows.forEach(r => p.observe(r)); return p;
}
function codexProtocol() {
  const p = createProtocol('codex', packet, cwd, profile, null);
  assert.equal(p.observe({ id: 1, result: {} })[1].method, 'config/read');
  p.observe({ id: 2, result: { config: { plugins: { 'ttak@ttak-release': { enabled: true }, 'ttak@ttak-stop77': { enabled: false } } } } });
  const command = 'node "' + path.join(profile, 'plugins/cache/ttak-release/ttak/0.2.0-rc.1+codex.20260908082818/hooks/ttak.cjs') + '"';
  const start = p.observe({ id: 3, result: { data: [{ hooks: ['sessionStart', 'userPromptSubmit', 'subagentStart'].map(eventName => ({
    enabled: true, eventName, command, pluginId: 'ttak@ttak-release', trustStatus: 'trusted', handlerType: 'command' })) }] } });
  assert.equal(start[0].method, 'thread/start');
  const turn = p.observe({ id: 4, result: { model: 'gpt-5.6-luna', reasoningEffort: 'high', modelProvider: 'openai', thread: { id: 'Parent1' } } });
  assert.equal(turn[0].params.input[0].text, parentPrompt('codex', packet));
  p.observe({ id: 5, result: {} }); return p;
}
function collab(tool, overrides = {}) {
  return { method: 'item/completed', params: { threadId: 'Parent1', item: { type: 'collabAgentToolCall', id: tool,
    tool, status: 'completed', senderThreadId: 'Parent1', receiverThreadIds: ['Child1'],
    model: tool === 'spawnAgent' ? 'gpt-5.6-luna' : null, reasoningEffort: tool === 'spawnAgent' ? 'high' : null,
    prompt: tool === 'spawnAgent' ? childDelivery('codex', packet).input : null,
    agentsStates: { Child1: { status: tool === 'spawnAgent' ? 'pendingInit' : 'completed' } }, ...overrides } } };
}
test('delivery preserves canonical packet, binds both hashes, and excludes the draft', () => {
  for (const host of ['codex', 'claude']) {
    const d = childDelivery(host, packet), parsed = JSON.parse(d.input);
    assert.equal(parsed.packet_json, encodePacket(packet)); assert.equal(d.packet_sha256, digest(packet));
    assert.match(parsed.result_instructions, /UTF-16/); assert.match(parsed.result_instructions, /bare JSON/);
    assert.doesNotMatch(parentPrompt(host, packet), /PARENT_ONLY_ORCHID_95/);
  }
});
test('Claude actual Agent/Task event shapes bind one forwarded input and native child ID', () => {
  const p = claudeProtocol(), result = p.finish();
  assert.equal(result.children[0].thread_id, 'Child1'); assert.equal(result.children[0].spawn_mode, 'general_purpose_foreground');
  assert.doesNotMatch(JSON.stringify(p.report), /HIDDEN_REASONING_FIXTURE/);
  assert.throws(() => p.observe(claudeRows()[0]), /after_completion/);
});
test('Claude changed packet, model override, background, fork, resume and extra fields stop', () => {
  for (const mutation of [v => v.prompt += 'x', v => v.model = 'haiku', v => v.run_in_background = true,
    v => v.subagent_type = 'fork', v => v.resume = 'old', v => v.extra = 'unexpected']) {
    const rows = claudeRows(); mutation(rows[1].message.content[0].input);
    assert.throws(() => claudeProtocol(rows), /child_request|unexpected_agent_action/);
  }
});
test('Claude wrong session, forwarded parent link, duplicate input and tool result cannot complete', () => {
  for (const mutation of [r => r[0].session_id = 'Other', r => r[2].parent_tool_use_id = 'Other',
    r => r.splice(3, 0, structuredClone(r[2])), r => r[4].message.content[0].tool_use_id = 'Other',
    r => r[5].session_id = 'Other']) {
    const rows = claudeRows(); mutation(rows);
    assert.throws(() => claudeProtocol(rows).finish(), /worker_/);
  }
});
test('Claude child tools, model changes, API retry, permission denial, and early close stop', () => {
  const mutations = [r => r[3].message.model = 'other', r => r[3].message.content.push({ type: 'tool_use', name: 'Bash', input: {} }),
    r => r.splice(3, 0, { type: 'system', subtype: 'api_retry' }), r => r[5].permission_denials = [{}], r => r.pop()];
  for (const mutation of mutations) { const rows = claudeRows(); mutation(rows); assert.throws(() => claudeProtocol(rows).finish()); }
});
test('Codex requires config/hooks before one parent turn and ordered spawn/wait/close', () => {
  const p = codexProtocol(); ['spawnAgent', 'wait', 'closeAgent'].forEach(tool => p.observe(collab(tool)));
  p.observe({ method: 'turn/completed', params: { threadId: 'Parent1', turn: { id: 'T1', status: 'completed' } } });
  assert.equal(p.finish().children[0].thread_id, 'Child1');
  assert.throws(() => p.observe({ id: 4, result: {} }), /after_completion/);
});
test('Codex polling preserves unfinished work but still requires completion before close', () => {
  for (const interim of ['running', 'failed']) {
    const p = codexProtocol();
    p.observe(collab('spawnAgent'));
    p.observe(collab('wait', { agentsStates: { Child1: { status: interim } } }));
    p.observe(collab('wait'));
    p.observe(collab('closeAgent'));
    p.observe({ method: 'turn/completed', params: { threadId: 'Parent1', turn: { status: 'completed' } } });
    if (interim === 'running') assert.equal(p.finish().children[0].thread_id, 'Child1');
    else assert.throws(() => p.finish(), /incomplete/);
  }
});

test('generated polling code does not close a child when a wait times out', async () => {
  const calls = codexCalls(packet, 'Child1');
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const events = [], emitted = [];
  const tools = {
    multi_agent_v1__wait_agent: async () => {
      events.push('wait');
      return events.length < 3 ? { timed_out: true } : { timed_out: false, status: { Child1: { completed: 'done' } } };
    },
    multi_agent_v1__close_agent: async () => { events.push('close'); return {}; }
  };
  // Only locally generated, reviewed code is executed; transcript bytes remain data.
  await new AsyncFunction('tools', 'text', calls[1])(tools, value => emitted.push(value));
  assert.deepEqual(events, ['wait', 'wait', 'wait']);
  assert.equal(emitted[0].status.Child1.completed, 'done');
  await new AsyncFunction('tools', 'text', calls[2])(tools, () => {});
  assert.equal(events.at(-1), 'close');
});

test('Codex changed input/model, nested spawn, second spawn and unrelated RPC fail', () => {
  for (const overrides of [{ prompt: '{}' }, { model: 'other' }, { reasoningEffort: 'low' }, { senderThreadId: 'Child1' }]) {
    assert.throws(() => codexProtocol().observe(collab('spawnAgent', overrides)), /child_request/);
  }
  const p = codexProtocol(); p.observe(collab('spawnAgent'));
  assert.throws(() => p.observe(collab('spawnAgent')), /extra_spawn/);
  assert.throws(() => codexProtocol().observe({ id: 88, method: 'approval/request' }), /rpc_rejected/);
});
test('Codex missing close or unfinished native child cannot produce envelope', () => {
  for (const names of [['spawnAgent', 'wait'], ['spawnAgent', 'closeAgent', 'wait']]) {
    const p = codexProtocol(); names.forEach(tool => p.observe(collab(tool)));
    p.observe({ method: 'turn/completed', params: { threadId: 'Parent1', turn: { status: 'completed' } } });
    assert.throws(() => p.finish(), /incomplete/);
  }
});
test('fork proof requires literal observed calls; appended execution and self-report are rejected without eval', () => {
  const rows = codexCalls(packet, 'Child1').map(input => ({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input } }));
  const raw = values => values.map(r => JSON.stringify(r)).join('\n');
  verifyCodexCalls(raw(rows), packet, 'Child1');
  for (const mutation of [r => r[0].payload.input += '\nthrow new Error("MUST_NOT_EXECUTE");',
    r => r[0].payload.input = r[0].payload.input.replace('fork_context":false', 'fork_context":true'), r => r.pop()]) {
    const copy = structuredClone(rows); mutation(copy);
    assert.throws(() => verifyCodexCalls(raw(copy), packet, 'Child1'), /spawn_proof/);
  }
  assert.throws(() => verifyCodexCalls(raw([{ type: 'response_item', payload: { type: 'message', role: 'assistant', content: 'fork false' } }]), packet, 'Child1'), /spawn_proof/);
});
test('CLI arguments preserve subscription path and pin native models without bypass flags', () => {
  const claude = argumentsFor('claude', 'Session1'), codex = argumentsFor('codex', null);
  assert.ok(claude.includes(cm)); assert.ok(claude.includes('--strict-mcp-config'));
  assert.ok(codex.includes('shell_tool')); assert.ok(codex.includes('app-server'));
  assert.doesNotMatch(JSON.stringify([claude, codex]), /dangerously|--bare|api-key|resume/);
  assert.match(codexEnvironment(cwd, Date.parse('2026-09-11T00:00:00Z')), /<current_date>2026-09-11<\/current_date>/);
  assert.throws(() => codexEnvironment('D:\\x<unsafe>', Date.now()), /environment_path/);
});
