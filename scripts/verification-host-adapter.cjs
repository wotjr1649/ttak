'use strict';
// Local evidence conversion only. No process, filesystem, network, or model-supplied receipt.
const { checkedData, checkId, checkInt, checkText, exact, canonical, digest, encodePacket,
  validatePacket } = require('./verification-packet.cjs');
const { validateAnswer, auditUsage } = require('./verification-native-audit.cjs');
const { modelSettings } = require('./review-native-format.cjs');
const { submissionTool } = require('./verification-submission-contract.cjs');
const reports = new WeakSet();
const versions = Object.freeze({ claude: '2.1.266', codex: '0.154.0' });
const inputKeys = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
const codexKeys = ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens',
  'outputTokens', 'reasoningOutputTokens', 'totalTokens'];
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function hostSettings(host) {
  if (!Object.hasOwn(versions, host)) throw new Error('adapter_unknown_host');
  return { host, cli_version: versions[host], ...modelSettings(host, 'haiku-luna') };
}
function* rows(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 2097152) throw new Error('adapter_transcript_limit');
  const lines = text.split(/\r?\n/); if (lines.length > 2048) throw new Error('adapter_transcript_limit');
  for (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line) > 262144) throw new Error('adapter_frame_limit');
    let row; try { row = JSON.parse(line); } catch { throw new Error('adapter_invalid_jsonl'); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('adapter_invalid_row');
    yield row; // Unselected fields, including reasoning, never enter the returned report.
  }
}
function textBlocks(content) {
  if (typeof content === 'string') return [checkText(content, 100000)];
  if (!Array.isArray(content)) throw new Error('adapter_invalid_content');
  return content.filter(b => b && ['text', 'input_text', 'output_text'].includes(b.type))
    .map(b => checkText(b.text, 100000));
}
function brand(value) {
  const report = freeze(checkedData(value)); reports.add(report); return report;
}
function requireReport(report, host) {
  if (!reports.has(report) || (host && report.host !== host)) throw new Error('adapter_uncollected_report');
}
function observeTime(range, value) {
  if (value == null) { range.complete = false; return; }
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isSafeInteger(time) || time < 0) throw new Error('adapter_invalid_timestamp');
  range.first = range.first === null ? time : Math.min(range.first, time);
  range.last = range.last === null ? time : Math.max(range.last, time);
}
function reportSnapshot(report) { requireReport(report); return report; }
function claudeUsage(value) {
  const result = {};
  for (const key of [...inputKeys, 'output_tokens']) result[key] = checkInt(value?.[key]);
  result.thinking_tokens = value.output_tokens_details?.thinking_tokens ?? null;
  if (result.thinking_tokens !== null) checkInt(result.thinking_tokens, 0, result.output_tokens);
  return result;
}
function collectClaudeTranscript(text, bindingValue) {
  const binding = checkedData(bindingValue);
  exact(binding, ['parent_session_id', 'agent_id']); checkId(binding.parent_session_id);
  if (binding.agent_id !== null) checkId(binding.agent_id);
  if (binding.agent_id === binding.parent_session_id) throw new Error('adapter_thread_binding');
  const settings = hostSettings('claude'), thread = binding.agent_id || binding.parent_session_id;
  const messages = new Map(), seen = new Map(), inputs = [], tools = [], visible = [], nonTextInputs = [];
  const observedTime = { first: null, last: null, complete: true };
  for (const row of rows(text)) {
    if (!['assistant', 'user'].includes(row.type)) continue;
    observeTime(observedTime, row.timestamp);
    if (row.sessionId !== binding.parent_session_id || row.version !== settings.cli_version ||
        row.isSidechain !== (binding.agent_id !== null) ||
        (binding.agent_id !== null && row.agentId !== binding.agent_id)) throw new Error('adapter_thread_binding');
    checkId(row.uuid);
    const message = row.message;
    if (!message || typeof message !== 'object') throw new Error('adapter_invalid_message');
    const content = textBlocks(message.content);
    const calls = Array.isArray(message.content) ? message.content
      .filter(b => b && !['text', 'thinking', 'redacted_thinking'].includes(b.type))
      .map(b => ({ type: checkText(b.type, 128), ...(b.id ? { id: checkId(b.id) } : {}),
        ...(b.name ? { name: checkText(b.name, 128) } : {}),
        ...(b.type === 'tool_use' && b.name === submissionTool ? { input: checkedData(b.input) } : {}),
        ...(b.type === 'tool_result' && binding.agent_id !== null ? { tool_use_id: checkId(b.tool_use_id),
          is_error: b.is_error === true, content: checkedData(b.content) } : {}) })) : [];
    const usage = row.type === 'assistant' ? claudeUsage(message.usage) : null;
    const selected = checkedData({ type: row.type, id: message.id ?? null, model: message.model ?? null,
      content, calls, usage });
    if (seen.has(row.uuid)) {
      if (seen.get(row.uuid) !== canonical(selected)) throw new Error('adapter_event_conflict');
      continue;
    }
    seen.set(row.uuid, canonical(selected));
    for (const call of calls) if (call.name === submissionTool || call.type === 'tool_result' && call.tool_use_id) call.event_index = seen.size;
    if (row.type === 'user') {
      inputs.push(...content.map(value => ({ role: 'user', content: value })));
      nonTextInputs.push(...calls); continue;
    }
    if (message.model !== settings.model) throw new Error('adapter_model_mismatch');
    checkId(message.id);
    const previous = messages.get(message.id);
    if (previous && (inputKeys.some(k => previous.usage[k] !== usage[k]) ||
        previous.usage.output_tokens > usage.output_tokens ||
        (previous.usage.thinking_tokens !== null && (usage.thinking_tokens === null ||
          previous.usage.thinking_tokens > usage.thinking_tokens)))) throw new Error('adapter_usage_revision_conflict');
    messages.set(message.id, { response_id: message.id, thread_id: thread, model: settings.model,
      effort: null, usage });
    tools.push(...calls); visible.push(...content);
  }
  if (!messages.size || !inputs.length) throw new Error('adapter_missing_observations');
  const responses = [...messages.values()];
  return brand({ host: 'claude', cli_version: settings.cli_version, thread_id: thread,
    parent_thread_id: binding.parent_session_id, model: settings.model, effort: null,
    visible_inputs: inputs, non_text_user_blocks: nonTextInputs, visible_answer_blocks: visible, tools, responses,
    usage: auditUsage('claude', responses), usage_basis: 'last_native_snapshot_per_assistant_message_id',
    observed_time_range: observedTime,
    input_scope: 'visible_user_messages', full_input_observed: false, native_delivery_verified: false });
}
function codexUsage(value) {
  const native = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens',
    'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
  return Object.fromEntries(codexKeys.map((key, i) => [key, checkInt(value?.[native[i]])]));
}
function collectCodexTranscript(text, bindingValue) {
  const binding = checkedData(bindingValue); exact(binding, ['thread_id']); checkId(binding.thread_id);
  const settings = hostSettings('codex'), inputs = [], tools = [], visible = [], nonTextInputs = [];
  const observedTime = { first: null, last: null, complete: true };
  let metas = 0, contexts = 0, complete = 0, usage = null;
  for (const row of rows(text)) {
    const p = row.payload;
    if (!p || typeof p !== 'object') continue;
    observeTime(observedTime, row.timestamp);
    if (row.type === 'session_meta') {
      if (++metas !== 1 || p.id !== binding.thread_id || p.cli_version !== settings.cli_version) throw new Error('adapter_thread_binding');
    } else if (row.type === 'turn_context') {
      if (++contexts !== 1 || p.model !== settings.model || p.effort !== settings.effort) throw new Error('adapter_model_mismatch');
    } else if (row.type === 'response_item' && p.type === 'message') {
      if (p.role === 'user') {
        inputs.push(...textBlocks(p.content).map(content => ({ role: 'user', content })));
        if (Array.isArray(p.content)) nonTextInputs.push(...p.content.filter(b =>
          b && !['text', 'input_text', 'output_text'].includes(b.type)).map(b => ({ type: checkText(b.type, 128) })));
      }
      if (p.role === 'assistant') visible.push(...textBlocks(p.content));
    } else if (row.type === 'response_item' && !['reasoning', 'message'].includes(p.type)) {
      // Record tool presence; never evaluate exec/custom-tool input to infer isolation.
      tools.push({ type: checkText(p.type, 128) });
    } else if (row.type === 'event_msg' && p.type === 'token_count' && p.info) {
      const current = codexUsage(p.info.total_token_usage);
      if (usage && codexKeys.some(key => current[key] < usage[key])) throw new Error('adapter_usage_revision_conflict');
      usage = current;
    } else if (row.type === 'event_msg' && p.type === 'task_complete') {
      if (p.error || ++complete !== 1) throw new Error('adapter_incomplete_turn');
    } else if (row.type === 'event_msg' && ['error', 'turn_aborted'].includes(p.type)) throw new Error('adapter_incomplete_turn');
  }
  if (metas !== 1 || contexts !== 1 || complete !== 1 || !usage || !inputs.length || !visible.length) {
    throw new Error('adapter_missing_observations');
  }
  return brand({ host: 'codex', cli_version: settings.cli_version, thread_id: binding.thread_id,
    model: settings.model, effort: settings.effort, visible_inputs: inputs, non_text_user_blocks: nonTextInputs, visible_answer_blocks: visible,
    tools, responses: null, usage, usage_basis: 'thread_cumulative_snapshot_not_response_records',
    observed_time_range: observedTime,
    input_scope: 'visible_user_messages', full_input_observed: false, native_delivery_verified: false });
}
function reconcileClaudeUsage(values, modelUsageValue) {
  if (!Array.isArray(values) || !values.length || values.length > 9) throw new Error('adapter_report_limit');
  values.forEach(value => requireReport(value, 'claude'));
  if (new Set(values.map(v => v.thread_id)).size !== values.length ||
      new Set(values.map(v => v.parent_thread_id)).size !== 1) throw new Error('adapter_thread_binding');
  const responses = values.flatMap(v => v.responses);
  if (new Set(responses.map(v => v.response_id)).size !== responses.length) throw new Error('adapter_response_collision');
  const value = checkedData(modelUsageValue), rollup = {};
  const names = { input_tokens: 'inputTokens', cache_creation_input_tokens: 'cacheCreationInputTokens',
    cache_read_input_tokens: 'cacheReadInputTokens', output_tokens: 'outputTokens', thinking_tokens: 'thinkingTokens' };
  for (const [key, name] of Object.entries(names)) rollup[key] = key === 'thinking_tokens' && value[name] == null
    ? null : checkInt(value[name]);
  return auditUsage('claude', responses, rollup);
}
function parseStrictObject(text) {
  checkText(text, 65536);
  if (!text.trim().startsWith('{') || !text.trim().endsWith('}')) throw new Error('adapter_result_not_json_object');
  let value; try { value = JSON.parse(text); } catch { throw new Error('adapter_result_not_json_object'); }
  // JSON syntax is already valid. Track decoded object keys to reject ambiguous duplicate fields.
  const stack = [];
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
    const token = match[0], top = stack.at(-1);
    if (token === '{') stack.push({ keys: new Set(), expectsKey: true });
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && top) top.expectsKey = true;
    else if (token === ':' && top) top.expectsKey = false;
    else if (token.startsWith('"') && top?.expectsKey) {
      const key = JSON.parse(token);
      if (top.keys.has(key)) throw new Error('adapter_duplicate_result_key');
      top.keys.add(key);
    }
  }
  return checkedData(value);
}
function parseChildResult(packet, text) {
  return validateAnswer(packet, parseStrictObject(text)); // Fences, missing bindings and bad citations are never repaired.
}
function prepareChildInput(host, packetValue) {
  const settings = hostSettings(host), packet = validatePacket(packetValue);
  return freeze({ ...settings, packet_sha256: digest(packet), user_input: encodePacket(packet),
    required_result_instructions: 'Return one bare JSON object, without Markdown or commentary. '
      + 'Required fields: question_id, packet_sha256, status, answer, conditions, citations, uncertainties. '
      + 'Use status answered, unresolved or conflict. Each citation has source_id, start, end, quote; '
      + 'offsets count UTF-16 code units in the supplied source. Use only supplied material; use no tools. '
      + 'question_id=' + packet.question_id + '; packet_sha256=' + digest(packet) + '.',
    instruction_delivery_verified: false });
}
function assessChildForLedger(report, packetValue) {
  requireReport(report);
  const packet = validatePacket(packetValue), blockers = ['full_system_and_developer_input_unobserved'];
  if (report.tools.length) throw new Error('adapter_child_used_tools');
  if (report.non_text_user_blocks.length || report.visible_inputs.length !== 1 || report.visible_inputs[0].content !== encodePacket(packet)) {
    throw new Error('adapter_child_input_mismatch');
  }
  if (report.visible_answer_blocks.length !== 1) throw new Error('adapter_ambiguous_result');
  const result = parseChildResult(packet, report.visible_answer_blocks[0]);
  if (report.host === 'codex') blockers.push('native_response_ids_unavailable');
  blockers.push('native_spawn_completion_and_cleanup_not_bound_to_ticket');
  return freeze({ host: report.host, thread_id: report.thread_id, packet_sha256: digest(packet),
    result, usage: report.usage, blockers, ready_for_ledger: false, receipt: null,
    native_delivery_verified: false, semantic_quality_verified: false });
}
module.exports = { prepareChildInput, collectClaudeTranscript, collectCodexTranscript,
  reconcileClaudeUsage, parseChildResult, parseStrictObject, assessChildForLedger, reportSnapshot };
