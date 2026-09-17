'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { parseSubject, auditSubject } = require('../scripts/native-subject-format.cjs');
const session = '12345678-1234-1234-1234-123456789012';
const lines = rows => rows.map(JSON.stringify).join('\n');
const expected = { session, version: '2.1.266', prompt: 'task', policy: 'entire policy', condition: 'ttak' };
function claudeRows() { return [{ type: 'user', message: { content: 'task' } },
  { type: 'attachment', attachment: { type: 'hook_additional_context', hookEvent: 'SessionStart', content: ['entire policy'] } },
  { type: 'assistant', version: '2.1.266', sessionId: session,
    message: { model: 'claude-haiku-4-5-20251001', content: [{ type: 'thinking' }, { type: 'text', text: 'answer' }] } }]; }

test('single-turn parsing requires actual Haiku and preserves native failures', () => {
  const value = { is_error: false, permission_denials: [], modelUsage: { 'claude-haiku-4-5-20251001': {} },
    session_id: session, result: 'answer', usage: { output_tokens: 42, non_token_value: 'omit' } };
  assert.equal(parseSubject('claude', JSON.stringify(value)).answer, 'answer');
  for (const change of [r => r.modelUsage = { 'claude-sonnet-5': {} }, r => r.permission_denials = [{}],
    r => r.result = '', r => r.session_id = 'bad', r => r.is_error = true]) {
    const changed = structuredClone(value); change(changed); assert.throws(() => parseSubject('claude', JSON.stringify(changed)));
  }
});

test('policy must arrive through the actual incoming hook, not a model echo', () => {
  assert.equal(auditSubject('claude', lines(claudeRows()), expected).policy_delivered, true);
  const echo = claudeRows(); echo.splice(1, 1); echo[1].message.content.push({ type: 'text', text: 'entire policy' });
  assert.throws(() => auditSubject('claude', lines(echo), expected));
  assert.throws(() => auditSubject('claude', lines(claudeRows()), { ...expected, condition: 'baseline' }));
  assert.equal(auditSubject('claude', lines(echo), { ...expected, condition: 'baseline' }).policy_delivered, false);
  const tool = claudeRows(); tool[2].message.content.push({ type: 'tool_use', name: 'StructuredOutput' });
  assert.throws(() => auditSubject('claude', lines(tool), expected), /subject_unexpected_tool/);
});

test('Luna subject parsing rejects tools and its policy audit requires developer delivery', () => {
  const events = [{ type: 'thread.started', thread_id: session },
    { type: 'item.completed', item: { type: 'agent_message', text: 'module' } },
    { type: 'turn.completed', usage: { output_tokens: 9 } }];
  assert.equal(parseSubject('codex', lines(events)).answer, 'module');
  assert.throws(() => parseSubject('codex', lines([...events, { type: 'item.completed', item: { type: 'command_execution' } }])));
  const transcript = [{ type: 'session_meta', payload: { id: session, cli_version: '0.153.4' } },
    { type: 'turn_context', payload: { model: 'gpt-5.6-luna', effort: 'high' } },
    { type: 'response_item', payload: { role: 'user', content: [{ type: 'input_text', text: 'task' }] } },
    { type: 'response_item', payload: { role: 'developer', content: [{ type: 'input_text', text: 'prefix\nentire policy\nsuffix' }] } }];
  assert.equal(auditSubject('codex', lines(transcript), { ...expected, version: '0.153.4' }).policy_delivered, true);
  transcript[3].payload.role = 'assistant';
  assert.throws(() => auditSubject('codex', lines(transcript), { ...expected, version: '0.153.4' }));
});
