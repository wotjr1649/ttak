'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { initial, observe, validateConfig, safe } = require('../scripts/connection-probe.cjs');
test('reasoning and native error bodies are never retained', () => {
  const r = initial();
  observe(r, { method: 'item/completed', params: { item: { type: 'reasoning', text: 'PRIVATE_REASONING_FIXTURE' } } });
  observe(r, { method: 'item/reasoning/textDelta', params: { delta: 'PRIVATE_REASONING_FIXTURE' } });
  assert.throws(() => observe(r, { method: 'error', params: { message: 'PRIVATE_ERROR_FIXTURE' } }), /native_error/);
  assert.doesNotMatch(safe(r), /PRIVATE_/);
});
test('usage preserves counters without inventing response counts or summing repeats', () => {
  const r = initial();
  const row = { method: 'thread/tokenUsage/updated', params: { threadId: 'parent', turnId: 'turn',
    tokenUsage: { total: { inputTokens: 100, cachedInputTokens: 80, outputTokens: 4, totalTokens: 104, secretField: 1 } } } };
  observe(r, row); observe(r, row);
  assert.equal(r.usage.length, 2); assert.equal(r.usage[0].total.totalTokens, 104);
  assert.equal(r.usage[0].total.secretField, undefined); assert.equal(r.internal_api_response_count, null);
});
test('extra spawn and follow-up fail instead of requesting a retry', () => {
  const r = initial();
  const row = { method: 'item/completed', params: { item: { type: 'collabAgentToolCall',
    tool: 'spawnAgent', status: 'completed', agentsStates: { child: { status: 'completed', message: 'hidden result' } } } } };
  observe(r, row); assert.equal(r.tools[0].agentsStates.child.message, undefined);
  assert.throws(() => observe(r, row), /extra_spawn/);
  assert.throws(() => observe(initial(), { method: 'item/completed', params: { item: {
    type: 'collabAgentToolCall', tool: 'followupTask' } } }), /unexpected_agent_action/);
});
test('unexpected tools, failed turns and blocked hooks stop', () => {
  assert.throws(() => observe(initial(), { method: 'item/completed', params: { item: { type: 'commandExecution' } } }), /unexpected_tool/);
  assert.throws(() => observe(initial(), { method: 'turn/completed', params: { turn: { status: 'failed' } } }), /turn_failed/);
  assert.throws(() => observe(initial(), { method: 'hook/completed', params: { run: { status: 'blocked' } } }), /hook_denied/);
});
test('resolved provider, connector and plugin changes are rejected before a turn', () => {
  const c = { plugins: { 'ttak@ttak-release': { enabled: true }, 'ttak@ttak-stop77': { enabled: false } } };
  validateConfig(c);
  for (const extra of [{ model_provider: 'other' }, { mcp_servers: { external: {} } }, { model_providers: { other: {} } }]) {
    assert.throws(() => validateConfig({ ...c, ...extra }), /unexpected_provider_or_connector/);
  }
  assert.throws(() => validateConfig({ plugins: {} }), /plugin_selection_changed/);
});
