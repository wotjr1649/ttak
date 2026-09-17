'use strict';
// Single-turn subject output and incoming policy evidence. Never execute response text.
const { possibleSecret, modelSettings, auditTranscript } = require('./review-native-format.cjs');
function json(text) {
  if (possibleSecret(text)) throw new Error('subject_content_withheld');
  try { return JSON.parse(text); } catch { throw new Error('invalid_subject_json'); }
}
function parseSubject(host, stdout) {
  const selected = modelSettings(host, 'haiku-luna');
  let session, answer, usage;
  if (host === 'claude') {
    const result = json(stdout);
    if (result.is_error !== false || result.permission_denials?.length ||
        !result.modelUsage || Object.keys(result.modelUsage).length !== 1 ||
        !Object.hasOwn(result.modelUsage, selected.model)) throw new Error('subject_model_or_execution_failure');
    session = result.session_id; answer = result.result; usage = result.usage;
  } else {
    const events = stdout.trim().split(/\r?\n/).map(json);
    if (events.some(row => ['error', 'turn.failed'].includes(row.type) ||
      (row.type?.startsWith('item.') && !['agent_message', 'reasoning'].includes(row.item?.type)))) {
      throw new Error('subject_error_or_tool');
    }
    const starts = events.filter(row => row.type === 'thread.started');
    const ends = events.filter(row => row.type === 'turn.completed');
    const answers = events.filter(row => row.type === 'item.completed' && row.item?.type === 'agent_message');
    if (starts.length !== 1 || ends.length !== 1 || !answers.length) throw new Error('ambiguous_subject_result');
    session = starts[0].thread_id; answer = answers.map(row => row.item.text).join('\n'); usage = ends[0].usage;
  }
  if (typeof answer !== 'string' || !answer.trim() || typeof session !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session)) throw new Error('missing_subject_result');
  const tokens = Object.fromEntries(Object.entries(usage || {}).filter(([key, value]) =>
    key.includes('token') && Number.isFinite(value) && value >= 0));
  return { session, answer, usage: tokens };
}

function auditSubject(host, transcript, expected) {
  if (!['baseline', 'ttak'].includes(expected.condition) || typeof expected.policy !== 'string' || !expected.policy.trim()) {
    throw new Error('invalid_subject_condition');
  }
  const audit = auditTranscript(host, transcript, expected, 'haiku-luna');
  const rows = transcript.trim().split(/\r?\n/).map(json);
  if (host === 'claude' && rows.some(row => row.type === 'assistant' &&
      (row.message?.content || []).some(block => block.type === 'tool_use'))) throw new Error('subject_unexpected_tool');
  const incoming = host === 'claude' ? rows.filter(row => row.type === 'attachment' &&
    row.attachment?.type === 'hook_additional_context' && row.attachment.hookEvent === 'SessionStart')
    .flatMap(row => row.attachment.content) : rows.filter(row => row.type === 'response_item' && row.payload?.role === 'developer')
    .flatMap(row => row.payload.content || []).filter(block => ['text', 'input_text'].includes(block.type)).map(block => block.text);
  const delivered = incoming.some(text => typeof text === 'string' && text.includes(expected.policy));
  if (delivered !== (expected.condition === 'ttak')) throw new Error('subject_policy_delivery_mismatch');
  return { ...audit, condition: expected.condition, policy_delivered: delivered, quality_verified: false };
}
module.exports = { parseSubject, auditSubject };
