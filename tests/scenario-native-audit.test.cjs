'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { auditClaudeScenario } = require('../scripts/scenario-native-audit.cjs');
const { reviewScenarioDraft } = require('../scripts/scenario-draft.cjs');
const { explainScenario } = require('../scripts/finite-scenario-render.cjs');
const expected = { model: 'test-model', version: 'test-version', toolName: 'mcp__ttak_scenario__scenario_review',
  skillBody: 'A synthetic explanation skill body with enough content to verify exact delivery, including concrete scope and reader constraints.' };
const args = { scenario: { initial: { a: true, b: true }, invariant: { cells: ['a','b'], at_least: 1 },
  transactions: [{ id: 'First', guard: { cells: ['b'], at_least: 1 }, writes: { a: false } },
    { id: 'Second', guard: { cells: ['a'], at_least: 1 }, writes: { b: false } }] }, draft: 'The writes are distinct, but reads overlap the other writes.', language: 'en' };
function fixture(expanded) {
  const assistant = content => ({ type: 'assistant', sessionId: 'session', version: expected.version,
    message: { model: expected.model, content } });
  const returned = { ...reviewScenarioDraft(args.scenario, args.draft, args.language), computed: explainScenario(args.scenario, args.language) };
  const rows = [assistant([{ type: 'thinking', thinking: 'hidden synthetic text must never appear in reports' },
    { type: 'tool_use', id: 'skill', name: 'Skill', input: { skill: 'ttak:ttak-explain' } }]),
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'skill',
    content: expanded ? 'Launching skill: ttak-explain' : expected.skillBody }] } }];
  if (expanded) rows.push({ type: 'user', isMeta: true, message: { content: [{ type: 'text', text: expected.skillBody }] } });
  rows.push(assistant([{ type: 'text', text: 'Intermediate text is not the final answer.' },
    { type: 'tool_use', id: 'review', name: expected.toolName, input: args }]),
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'review', content: JSON.stringify(returned) }] } },
  assistant([{ type: 'text', text: 'The final explanation.' }]));
  return { rows, native: { is_error: false, permission_denials: [], modelUsage: { [expected.model]: {} },
    session_id: 'session', result: 'The final explanation.', num_turns: 3, usage: {} } };
}
test('exact skill body can arrive in the tool result or a separate host-expanded message', () => {
  for (const expanded of [false, true]) {
    const { rows, native } = fixture(expanded), report = auditClaudeScenario(rows, native, expected);
    assert.equal(report.skill_delivery_verified, true);
    assert.equal(report.answer, 'The final explanation.');
    assert.equal(report.quality_verified, false);
    assert.ok(!JSON.stringify(report).includes('hidden synthetic'));
  }
});
test('a launch acknowledgement or skill name alone does not prove delivery', () => {
  const { rows, native } = fixture(true);
  rows.splice(2, 1);
  assert.throws(() => auditClaudeScenario(rows, native, expected));
});
test('changed tool evidence and unexpected executable tools cannot pass the audit', () => {
  for (const mutate of [rows => { rows[2].message.content[1].name = 'Bash'; },
    rows => { rows[3].message.content[0].content = '{}'; },
    rows => { rows[4].message.model = 'other-model'; }]) {
    const { rows, native } = fixture(false); mutate(rows);
    assert.throws(() => auditClaudeScenario(rows, native, expected));
  }
});
