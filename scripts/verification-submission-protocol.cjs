'use strict';
const { checkedData, checkId } = require('./verification-packet.cjs');
const { childDelivery, parentPrompt } = require('./verification-delivery.cjs');
const { submissionFormat, submissionTool, verifierType } = require('./verification-submission-contract.cjs');
const { submissionAck, checkSubmissionAck } = require('./verification-submission-audit.cjs');
const model = 'claude-haiku-4-5-20251001';
const agentTool = name => name === 'Agent' || name === 'Task';
function createSubmissionProtocol(packet, sessionId, selectedFormat = submissionFormat) {
  checkId(sessionId);
  const wire = childDelivery('claude', packet, selectedFormat), prompt = parentPrompt('claude', packet, selectedFormat);
  const report = { host: 'claude', init: null, tools: [], inputs: [], submissions: [], submission_results: [],
    tasks: [], results: [], messages: [], errors: [] };
  let complete = false;
  function observeEvent(row) {
    if (complete) throw new Error('submission_event_after_completion');
    if (row.type === 'system' && row.subtype === 'api_retry') throw new Error('api_retry_observed');
    if (row.type === 'system' && row.subtype === 'init') {
      if (report.init || row.session_id !== sessionId || row.model !== model || row.parent_tool_use_id ||
          !Array.isArray(row.tools) || row.tools.length !== 1 || !agentTool(row.tools[0]) ||
          (row.mcp_servers || []).length || (row.plugins || []).length) throw new Error('submission_parent_inventory');
      report.init = { session_id: sessionId, model, tools: row.tools, mcp_count: 0, plugin_count: 0 };
      return [];
    }
    if (!report.init) throw new Error('submission_init_required');
    const parentTool = row.parent_tool_use_id || null;
    if (parentTool && parentTool !== report.tools[0]?.id) throw new Error('submission_parent_tool_binding');
    if (row.type === 'assistant') {
      const message = row.message;
      if (message?.model !== model || !Array.isArray(message.content)) throw new Error('submission_model_binding');
      checkId(message.id);
      const text = [];
      for (const block of message.content) {
        if (block.type === 'text') text.push(block.text);
        else if (['thinking', 'redacted_thinking'].includes(block.type)) continue;
        else if (block.type !== 'tool_use') throw new Error('submission_unexpected_tool');
        else if (parentTool) {
          if (block.name !== submissionTool || report.submissions.length) throw new Error('submission_unexpected_tool');
          checkId(block.id); submissionAck(packet, block.input);
          report.submissions.push({ id: block.id, name: block.name, input: checkedData(block.input), parent_tool_use_id: parentTool });
        } else {
          const input = block.input;
          if (!agentTool(block.name) || report.tools.length || input?.subagent_type !== verifierType ||
              input.prompt !== wire.input || input.run_in_background !== false ||
              Object.keys(input).some(k => !['description', 'subagent_type', 'prompt', 'run_in_background'].includes(k))) throw new Error('submission_parent_action');
          checkId(block.id); report.tools.push({ id: block.id, name: block.name, input: checkedData(input) });
        }
      }
      report.messages.push({ id: message.id, model, parent_tool_use_id: parentTool, text });
    } else if (row.type === 'user') {
      const content = row.message?.content;
      const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
      if (!Array.isArray(blocks)) throw new Error('submission_user_content');
      for (const block of blocks) {
        if (block.type === 'text') {
          if (parentTool) {
            if (block.text !== wire.input || report.inputs.length) throw new Error('submission_child_input');
            report.inputs.push({ parent_tool_use_id: parentTool, text: block.text });
          } else if (block.text !== prompt) throw new Error('submission_parent_input');
        } else if (block.type === 'tool_result') {
          if (block.is_error) throw new Error('submission_tool_failed');
          if (parentTool) {
            const submitted = report.submissions[0];
            if (!submitted || block.tool_use_id !== submitted.id || report.submission_results.length) throw new Error('submission_result_binding');
            checkSubmissionAck(packet, submitted.input, block.content);
            report.submission_results.push({ tool_use_id: block.tool_use_id, content: checkedData(block.content) });
          } else {
            if (block.tool_use_id !== report.tools[0]?.id || report.tasks.length) throw new Error('submission_agent_result');
            report.tasks.push({ tool_use_id: block.tool_use_id, content: checkedData(block.content) });
          }
        } else throw new Error('submission_user_content');
      }
    } else if (row.type === 'result') {
      if (parentTool || row.session_id !== sessionId || row.is_error || row.subtype !== 'success' ||
          row.permission_denials?.length || Object.keys(row.modelUsage || {}).some(k => k !== model)) throw new Error('submission_native_result');
      report.results.push({ session_id: sessionId, subtype: row.subtype, usage: row.usage, modelUsage: row.modelUsage });
      complete = true;
    } else if (row.type === 'error' || row.type === 'system' &&
        ['blocked', 'failed', 'error', 'timedOut'].includes(row.status || row.run?.status)) throw new Error('submission_native_failure');
    if (report.messages.length > 12 || report.results.length > 1) throw new Error('submission_event_limit');
    checkedData(report); return [];
  }
  function observe(row) {
    try { return observeEvent(row); }
    catch (error) {
      // Persist only a closed vocabulary, never the rejected payload or error text.
      const codes = ['submission_event_after_completion', 'api_retry_observed', 'submission_parent_inventory',
        'submission_init_required', 'submission_parent_tool_binding', 'submission_model_binding',
        'submission_unexpected_tool', 'submission_parent_action', 'submission_user_content',
        'submission_child_input', 'submission_parent_input', 'submission_tool_failed', 'submission_result_binding',
        'submission_agent_result', 'submission_native_result', 'submission_native_failure', 'submission_event_limit',
        'submission_ack_format', 'submission_ack_binding', 'submission_answered_with_uncertainty', 'verification_invalid_fields', 'verification_invalid_data',
        'verification_data_limit', 'verification_content_rejected'];
      const types = ['system', 'assistant', 'user', 'result', 'tool_progress', 'tool_use_summary', 'error'];
      const blocks = Array.isArray(row?.message?.content) ? row.message.content : [];
      report.errors.push({ code: codes.includes(error.message) ? error.message : 'submission_rejected',
        event_type: types.includes(row?.type) ? row.type : 'other',
        blocks: blocks.slice(0, 8).map(b => ({ type: ['text', 'tool_use', 'tool_result'].includes(b?.type) ? b.type : 'other',
          content_form: Array.isArray(b?.content) ? 'array' : typeof b?.content === 'string' ? 'string' : 'other',
          is_error: b?.is_error === true, repeated_submission_id: !!report.submissions[0] && b?.id === report.submissions[0].id,
          ...(error.message === 'submission_parent_action' && b?.type === 'tool_use' ? {
            parent_action: { allowed_tool: agentTool(b.name), first_call: report.tools.length === 0,
              verifier_type_matches: b.input?.subagent_type === verifierType, prompt_matches: b.input?.prompt === wire.input,
              explicit_foreground: b.input?.run_in_background === false,
              allowed_fields_only: !!b.input && typeof b.input === 'object' && Object.keys(b.input)
                .every(k => ['description', 'subagent_type', 'prompt', 'run_in_background'].includes(k)) }
          } : {}),
          ...(error.message === 'verification_invalid_fields' && b?.type === 'tool_use' ? {
            submission_fields: { missing: ['question_id', 'packet_sha256', 'anchor_map_sha256', 'status', 'answer', 'conditions', 'citations', 'uncertainties']
              .filter(k => !b.input || !Object.hasOwn(b.input, k)),
            unknown_count: b.input && typeof b.input === 'object' ? Object.keys(b.input).filter(k =>
              !['question_id', 'packet_sha256', 'anchor_map_sha256', 'status', 'answer', 'conditions', 'citations', 'uncertainties'].includes(k)).length : null,
            citation_fields_valid: Array.isArray(b.input?.citations) && b.input.citations.every(c => c && typeof c === 'object' &&
              Object.keys(c).length === 3 && ['source_id', 'first', 'last'].every(k => Object.hasOwn(c, k))) }
          } : {}) })) });
      throw error;
    }
  }
  function finish() {
    if (!complete || report.tools.length !== 1 || report.inputs.length !== 1 || report.submissions.length !== 1 ||
        report.submission_results.length !== 1 || report.tasks.length !== 1) throw new Error('submission_incomplete');
    const content = report.tasks[0].content;
    if (!Array.isArray(content)) throw new Error('submission_agent_id');
    const ids = content.filter(b => b.type === 'text').flatMap(b => [...b.text.matchAll(/^agentId: ([A-Za-z0-9_-]+) \(/gm)].map(m => m[1]));
    if (ids.length !== 1 || ids[0] === sessionId) throw new Error('submission_agent_id');
    checkId(ids[0]);
    return { parent_thread_id: sessionId, children: [{ thread_id: ids[0], packet_sha256: wire.packet_sha256,
      spawn_mode: 'custom_verifier_foreground', completed: true }] };
  }
  return { observe, finish, report, prompt, isComplete: () => complete };
}
module.exports = { createSubmissionProtocol };
