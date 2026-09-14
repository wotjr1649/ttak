'use strict';
// P0 checks normalized observations, not a native transport. No I/O or hidden reasoning.
const { modelSettings } = require('./review-native-format.cjs');
const { checkedData, canonical, digest, encodePacket, validatePacket, exact, checkId,
  checkText, checkInt, checkDigest, list, uniqueIds } = require('./verification-packet.cjs');
const receipts = new WeakSet();
const fields = Object.freeze({
  claude: ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens', 'thinking_tokens'],
  codex: ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens', 'reasoningOutputTokens', 'totalTokens']
});

function checkedLimits(value) {
  exact(value, ['max_responses', 'max_input_tokens', 'max_output_tokens']);
  checkInt(value.max_responses, 1, 1024);
  checkInt(value.max_input_tokens, 1, 1000000000);
  checkInt(value.max_output_tokens, 1, 1000000000);
  return value;
}
function validateTicket(value) {
  const ticket = checkedData(value);
  exact(ticket, ['schema_version', 'run_id', 'turn_id', 'call_id', 'kind', 'host', 'cli_version',
    'parent_thread_id', 'question_id', 'packet_sha256', 'limits', 'reserved_at_ms', 'expires_at_ms']);
  if (ticket.schema_version !== 1 || !['parent', 'child', 'rewrite'].includes(ticket.kind) ||
      !Object.hasOwn(fields, ticket.host)) throw new Error('verification_invalid_ticket');
  for (const name of ['run_id', 'turn_id', 'call_id', 'parent_thread_id']) checkId(ticket[name]);
  if (typeof ticket.cli_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(ticket.cli_version)) {
    throw new Error('verification_invalid_version');
  }
  if (ticket.kind === 'child') { checkId(ticket.question_id); checkDigest(ticket.packet_sha256); }
  else if (ticket.question_id !== null || ticket.packet_sha256 !== null) throw new Error('verification_invalid_ticket');
  checkedLimits(ticket.limits);
  checkInt(ticket.reserved_at_ms); checkInt(ticket.expires_at_ms, ticket.reserved_at_ms + 1);
  return ticket;
}

function auditUsage(host, value, rollup = null) {
  if (!Object.hasOwn(fields, host)) throw new Error('verification_unknown_host');
  const responses = checkedData(value), unique = new Map(), raw = Object.fromEntries(fields[host].map(key => [key, 0]));
  list(responses, 1024);
  const selected = modelSettings(host, 'haiku-luna');
  for (const row of responses) {
    exact(row, ['response_id', 'thread_id', 'model', 'effort', 'usage']);
    checkId(row.response_id); checkId(row.thread_id);
    if (row.model !== selected.model || row.effort !== selected.effort) throw new Error('verification_model_mismatch');
    exact(row.usage, fields[host]);
    for (const key of fields[host]) {
      if (host === 'claude' && key === 'thinking_tokens' && row.usage[key] === null) continue;
      checkInt(row.usage[key]);
    }
    if (host === 'claude' && row.usage.thinking_tokens > row.usage.output_tokens) {
      throw new Error('verification_usage_inconsistent');
    }
    if (unique.has(row.response_id)) {
      if (canonical(unique.get(row.response_id)) !== canonical(row)) throw new Error('verification_response_conflict');
      continue; // Repeated notification of the same response is not another API response.
    }
    unique.set(row.response_id, row);
    for (const key of fields[host]) {
      raw[key] = raw[key] === null || row.usage[key] === null ? null : checkInt(raw[key] + row.usage[key]);
    }
  }
  if (rollup !== null && canonical(checkedData(rollup)) !== canonical(raw)) throw new Error('verification_rollup_mismatch');
  // Claude's thinking counter is an output detail. Codex's overlapping components are
  // retained verbatim; component sums below are conservative reservation debits, NOT cost.
  const input = host === 'claude' ? raw.input_tokens + raw.cache_creation_input_tokens + raw.cache_read_input_tokens
    : raw.inputTokens + raw.cachedInputTokens + raw.cacheWriteInputTokens;
  const output = host === 'claude' ? raw.output_tokens : raw.outputTokens + raw.reasoningOutputTokens;
  checkInt(input); checkInt(output);
  return { response_count: unique.size, response_ids: [...unique.keys()], raw_totals: raw,
    limit_debit: { input_tokens: input, output_tokens: output },
    accounting: host === 'claude' ? 'exclusive_input_categories_output_includes_thinking' : 'conservative_component_sum_not_cost',
    native_usage_completeness_verified: false };
}

function validateAnswer(packetValue, value) {
  const packet = validatePacket(packetValue), result = checkedData(value);
  exact(result, ['question_id', 'packet_sha256', 'status', 'answer', 'conditions', 'citations', 'uncertainties']);
  if (result.question_id !== packet.question_id || result.packet_sha256 !== digest(packet) ||
      !['answered', 'unresolved', 'conflict'].includes(result.status)) throw new Error('verification_result_binding');
  checkText(result.answer);
  list(result.conditions, 32, 0).forEach(item => checkText(item, 4096));
  list(result.uncertainties, 32, result.status === 'answered' ? 0 : 1).forEach(item => checkText(item, 4096));
  list(result.citations, 32, result.status === 'answered' ? 1 : 0);
  const seen = new Set();
  for (const cite of result.citations) {
    exact(cite, ['source_id', 'start', 'end', 'quote']);
    const source = packet.sources.find(item => item.id === cite.source_id);
    if (!source) throw new Error('verification_unknown_citation');
    checkInt(cite.start, 0, source.text.length); checkInt(cite.end, cite.start + 1, source.text.length);
    checkText(cite.quote);
    if (source.text.slice(cite.start, cite.end) !== cite.quote) throw new Error('verification_citation_mismatch');
    const key = canonical([cite.source_id, cite.start, cite.end]);
    if (seen.has(key)) throw new Error('verification_duplicate_citation');
    seen.add(key);
  }
  return result;
}

function auditVerificationCall(ticketValue, observedValue, expectedValue) {
  const ticket = validateTicket(ticketValue), observed = checkedData(observedValue), expected = checkedData(expectedValue);
  exact(expected, ['inputs', 'packet']);
  list(expected.inputs, 32);
  for (const message of expected.inputs) {
    exact(message, ['role', 'content']);
    if (!['system', 'developer', 'user'].includes(message.role)) throw new Error('verification_invalid_input_role');
    checkText(message.content, 100000);
  }
  exact(observed, ['host', 'cli_version', 'run_id', 'turn_id', 'call_id', 'thread_id', 'parent_thread_id',
    'model', 'effort', 'history', 'inputs', 'tools', 'responses', 'rollup', 'completion', 'result', 'cleanup']);
  for (const key of ['host', 'cli_version', 'run_id', 'turn_id', 'call_id', 'parent_thread_id']) {
    if (observed[key] !== ticket[key]) throw new Error('verification_observation_binding');
  }
  checkId(observed.thread_id);
  const model = modelSettings(ticket.host, 'haiku-luna');
  if (observed.model !== model.model || observed.effort !== model.effort) throw new Error('verification_model_mismatch');
  if (observed.completion !== 'completed') throw new Error('verification_incomplete_call');
  if (canonical(observed.inputs) !== canonical(expected.inputs)) throw new Error('verification_input_mismatch');
  if (canonical(observed.tools) !== '[]') throw new Error('verification_unexpected_tools');
  exact(observed.cleanup, ['call_finished', 'child_thread_closed', 'active_owned_processes']);
  if (observed.cleanup.call_finished !== true || observed.cleanup.active_owned_processes !== 0 ||
      observed.cleanup.child_thread_closed !== (ticket.kind === 'child')) throw new Error('verification_cleanup_incomplete');
  let result;
  if (ticket.kind === 'child') {
    const packet = validatePacket(expected.packet);
    if (packet.question_id !== ticket.question_id || digest(packet) !== ticket.packet_sha256 ||
        observed.thread_id === ticket.parent_thread_id || observed.history !== 'none') {
      throw new Error('verification_child_binding');
    }
    const users = expected.inputs.filter(message => message.role === 'user');
    if (users.length !== 1 || users[0] !== expected.inputs.at(-1) || users[0].content !== encodePacket(packet)) {
      throw new Error('verification_child_input_contract');
    }
    result = validateAnswer(packet, observed.result);
  } else {
    if (expected.packet !== null || observed.thread_id !== ticket.parent_thread_id || observed.history !== 'parent') {
      throw new Error('verification_parent_binding');
    }
    exact(observed.result, ['answer']); checkText(observed.result.answer, 100000);
    result = observed.result;
  }
  for (const row of list(observed.responses, 1024)) {
    if (row.thread_id !== observed.thread_id) throw new Error('verification_response_thread_mismatch');
  }
  const usage = auditUsage(ticket.host, observed.responses, observed.rollup);
  if (usage.response_count > ticket.limits.max_responses || usage.limit_debit.input_tokens > ticket.limits.max_input_tokens ||
      usage.limit_debit.output_tokens > ticket.limits.max_output_tokens) throw new Error('verification_usage_limit');
  const receipt = { schema_version: 1, ticket_sha256: digest(ticket), call_id: ticket.call_id,
    run_id: ticket.run_id, turn_id: ticket.turn_id, kind: ticket.kind, thread_id: observed.thread_id,
    question_id: ticket.question_id, packet_sha256: ticket.packet_sha256,
    outcome: result.status && (result.status !== 'answered' || result.uncertainties.length) ? 'unresolved' : 'complete',
    result_sha256: digest(result), result, usage,
    normalized_observations_match: true, native_delivery_verified: false, semantic_quality_verified: false };
  // A ledger accepts only an unmodified in-process audit receipt, never a model-supplied pass flag.
  const freeze = item => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } };
  freeze(receipt); receipts.add(receipt);
  return receipt;
}
function receiptSummary(receipt) {
  if (!receipts.has(receipt)) throw new Error('verification_unaudited_receipt');
  const { result, ...summary } = receipt;
  return checkedData(summary);
}

function validateReceiptSummary(value, ticketValue) {
  const summary = checkedData(value), ticket = validateTicket(ticketValue);
  exact(summary, ['schema_version', 'ticket_sha256', 'call_id', 'run_id', 'turn_id', 'kind', 'thread_id',
    'question_id', 'packet_sha256', 'outcome', 'result_sha256', 'usage', 'normalized_observations_match',
    'native_delivery_verified', 'semantic_quality_verified']);
  if (summary.schema_version !== 1 || summary.ticket_sha256 !== digest(ticket) ||
      ['call_id', 'run_id', 'turn_id', 'kind', 'question_id', 'packet_sha256'].some(key => summary[key] !== ticket[key]) ||
      summary.normalized_observations_match !== true || summary.native_delivery_verified !== false ||
      summary.semantic_quality_verified !== false || !['complete', 'unresolved'].includes(summary.outcome)) {
    throw new Error('verification_invalid_summary');
  }
  checkId(summary.thread_id); checkDigest(summary.result_sha256);
  if ((summary.thread_id === ticket.parent_thread_id) === (ticket.kind === 'child')) {
    throw new Error('verification_invalid_summary_thread');
  }
  exact(summary.usage, ['response_count', 'response_ids', 'raw_totals', 'limit_debit', 'accounting', 'native_usage_completeness_verified']);
  uniqueIds(summary.usage.response_ids, ticket.limits.max_responses);
  if (summary.usage.response_count !== summary.usage.response_ids.length || summary.usage.native_usage_completeness_verified !== false) {
    throw new Error('verification_invalid_summary_usage');
  }
  const selected = modelSettings(ticket.host, 'haiku-luna');
  const recomputed = auditUsage(ticket.host, [{ response_id: 'Summary', thread_id: summary.thread_id,
    model: selected.model, effort: selected.effort, usage: summary.usage.raw_totals }]);
  if (canonical(summary.usage.limit_debit) !== canonical(recomputed.limit_debit) ||
      summary.usage.accounting !== recomputed.accounting || recomputed.limit_debit.input_tokens > ticket.limits.max_input_tokens ||
      recomputed.limit_debit.output_tokens > ticket.limits.max_output_tokens) throw new Error('verification_invalid_summary_usage');
  return summary;
}

module.exports = { validateTicket, checkedLimits, auditUsage, validateAnswer, auditVerificationCall, receiptSummary, validateReceiptSummary };
