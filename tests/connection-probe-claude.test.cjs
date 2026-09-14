'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { initial, observe } = require('../scripts/connection-probe-claude.cjs');
const model = 'claude-haiku-4-5-20251001';
test('forwarded child text retains linkage and drops thinking bodies', () => {
  const r = initial(); observe(r, { type: 'assistant', parent_tool_use_id: 'agent1', message: {
    id: 'm1', model, usage: { output_tokens: 4 }, content: [{ type: 'thinking', thinking: 'PRIVATE_THINKING' }, { type: 'text', text: 'A' }] } });
  assert.equal(r.messages[0].parent_tool_use_id, 'agent1'); assert.deepEqual(r.messages[0].text, ['A']);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_THINKING/);
});
test('fork, nested child and extra spawn are rejected', () => {
  const row = input => ({ type: 'assistant', message: { model, content: [{ type: 'tool_use', name: 'Agent', id: 'a1', input }] } });
  assert.throws(() => observe(initial(), row({ subagent_type: 'fork' })), /unexpected_agent_action/);
  assert.throws(() => observe(initial(), { ...row({}), parent_tool_use_id: 'parent' }), /unexpected_agent_action/);
  const r = initial(); observe(r, row({})); assert.throws(() => observe(r, row({})), /unexpected_agent_action/);
});
test('wrong model, additional connector and retry event stop', () => {
  assert.throws(() => observe(initial(), { type: 'assistant', message: { model: 'other' } }), /model_mismatch/);
  assert.throws(() => observe(initial(), { type: 'system', subtype: 'init', model, tools: ['Agent'], mcp_servers: [{}] }), /unexpected_init/);
  assert.throws(() => observe(initial(), { type: 'system', subtype: 'api_retry', error: 'PRIVATE_ERROR' }), /api_retry_observed/);
});
test('failed tool result and final permission denial cannot pass', () => {
  assert.throws(() => observe(initial(), { type: 'user', message: { content: [{ type: 'tool_result', is_error: true }] } }), /agent_tool_failed/);
  assert.throws(() => observe(initial(), { type: 'result', subtype: 'success', is_error: false, permission_denials: [{}] }), /native_result_failed/);
});
test('observed Task alias is accepted but additional tools, nested Task and fork still fail', () => {
  const init = tools => ({ type: 'system', subtype: 'init', model, tools, mcp_servers: [], plugins: [] });
  for (const name of ['Task', 'Agent']) {
    observe(initial(), init([name]));
    const row = { type: 'assistant', message: { model, content: [{ type: 'tool_use', name,
      input: { subagent_type: 'general-purpose' } }] } };
    observe(initial(), row);
    assert.throws(() => observe(initial(), { ...row, parent_tool_use_id: 'parent' }), /unexpected_agent_action/);
    row.message.content[0].input.subagent_type = 'fork';
    assert.throws(() => observe(initial(), row), /unexpected_agent_action/);
  }
  for (const names of [[], ['Task', 'Bash'], ['Task', 'Agent'], ['Other']]) {
    assert.throws(() => observe(initial(), init(names)), /unexpected_init/);
  }
});
