'use strict';
// Pure native-output audit. Never reads files, runs models or exposes hidden reasoning.
const assert = require('node:assert/strict');
const { reviewScenarioDraft } = require('./scenario-draft.cjs');
const { explainScenario } = require('./finite-scenario-render.cjs');
const textContent = content => typeof content === 'string' ? content : Array.isArray(content)
  ? content.filter(block => ['text', 'input_text', 'output_text'].includes(block.type)).map(block => block.text).join('\n') : '';

function auditClaudeScenario(records, native, expected) {
  assert.ok(Array.isArray(records) && records.length <= 20000);
  assert.equal(native.is_error, false);
  assert.equal((native.permission_denials || []).length, 0);
  assert.deepEqual(Object.keys(native.modelUsage), [expected.model]);
  assert.equal(typeof native.result, 'string');
  assert.ok(native.result.trim());
  const assistants = records.filter(row => row.type === 'assistant');
  const users = records.filter(row => row.type === 'user');
  assert.ok(assistants.length);
  assert.ok(assistants.every(row => row.sessionId === native.session_id && row.version === expected.version &&
    row.message.model === expected.model && !row.isSidechain && row.effort == null));
  assert.equal(textContent(assistants.at(-1).message.content), native.result);
  const blocks = assistants.flatMap(row => row.message.content);
  assert.ok(blocks.some(block => ['thinking', 'redacted_thinking'].includes(block.type)));
  const uses = blocks.filter(block => block.type === 'tool_use');
  const returns = users.flatMap(row => Array.isArray(row.message?.content) ? row.message.content : [])
    .filter(block => block.type === 'tool_result');
  assert.equal(new Set(uses.map(use => use.id)).size, uses.length);
  assert.equal(uses.length, returns.length);
  const body = expected.skillBody.trim();
  assert.ok(body.length > 100);
  let skillDelivered = users.some(row => textContent(row.message?.content).includes(body));
  const calls = [];
  let skillCalls = 0;
  for (const use of uses) {
    const matching = returns.filter(row => row.tool_use_id === use.id);
    assert.equal(matching.length, 1);
    assert.notEqual(matching[0].is_error, true);
    const returned = textContent(matching[0].content);
    if (use.name === 'Skill') {
      assert.ok(['ttak-explain', 'ttak:ttak-explain'].includes(use.input.skill));
      skillCalls++;
      // Hosts may return the body here or expand it into a separate user message.
      skillDelivered ||= returned.includes(body);
      continue;
    }
    assert.equal(use.name, expected.toolName);
    const args = use.input;
    const recomputed = { ...reviewScenarioDraft(args.scenario, args.draft, args.language),
      computed: explainScenario(args.scenario, args.language) };
    assert.deepEqual(JSON.parse(returned), recomputed);
    calls.push({ input: args, feedback: recomputed,
      final_supported_checks: reviewScenarioDraft(args.scenario, native.result, args.language) });
  }
  assert.ok(skillDelivered);
  assert.ok(skillCalls <= 2);
  assert.ok(calls.length >= 1 && calls.length <= 4);
  return { session: native.session_id, answer: native.result, skill_delivery_verified: true,
    calls, assistant_messages: assistants.length, tool_calls: uses.length, native_agentic_turns: native.num_turns,
    usage: native.usage, quality_verified: false };
}

module.exports = { auditClaudeScenario, textContent };
