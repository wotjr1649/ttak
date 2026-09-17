'use strict';
const { reportSnapshot } = require('./verification-host-adapter.cjs');
const { checkInt, checkedData } = require('./verification-packet.cjs');
function summarizeExecutionUsage(values) {
  if (!Array.isArray(values) || !values.length || values.length > 9) throw new Error('execution_report_limit');
  const reports = values.map(reportSnapshot), host = reports[0].host;
  if (reports.some(r => r.host !== host) || new Set(reports.map(r => r.thread_id)).size !== reports.length) {
    throw new Error('execution_duplicate_or_mixed_threads');
  }
  const seenMessages = new Set();
  const threads = reports.map(r => {
    const raw = host === 'claude' ? r.usage.raw_totals : r.usage;
    let input, output, total;
    if (host === 'claude') {
      for (const response of r.responses) {
        if (seenMessages.has(response.response_id)) throw new Error('execution_message_collision');
        seenMessages.add(response.response_id);
      }
      input = checkInt(raw.input_tokens + raw.cache_creation_input_tokens + raw.cache_read_input_tokens);
      output = raw.output_tokens; total = checkInt(input + output);
    } else {
      input = raw.inputTokens; output = raw.outputTokens; total = raw.totalTokens;
      if (checkInt(input + output) !== total || raw.cachedInputTokens > input || raw.reasoningOutputTokens > output) {
        throw new Error('execution_counter_inconsistent');
      }
    }
    return { thread_id: r.thread_id, basis: r.usage_basis, raw_counters: raw,
      input_including_cache: input, output_including_reasoning: output, reported_total_tokens: total };
  });
  return checkedData({ host, accounting_unit: host === 'codex' ? 'distinct_thread_cumulative_snapshot'
    : 'final_assistant_message_snapshot', threads,
  observed_assistant_message_ids: host === 'claude' ? [...seenMessages] : null,
  native_api_response_count: null,
  totals: Object.fromEntries(['input_including_cache', 'output_including_reasoning', 'reported_total_tokens']
    .map(k => [k, threads.reduce((sum, t) => checkInt(sum + t[k]), 0)])),
  completeness_verified: false, monetary_cost: null, api_token_hard_cap_verified: false });
}
module.exports = { summarizeExecutionUsage };
