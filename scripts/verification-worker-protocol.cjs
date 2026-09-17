'use strict';
const path = require('node:path');
const codex = require('./connection-probe.cjs'), claude = require('./connection-probe-claude.cjs');
const { checkId, checkedData } = require('./verification-packet.cjs');
const { childDelivery, parentPrompt, codexCalls, format } = require('./verification-delivery.cjs');
const model = { codex: 'gpt-5.6-luna', claude: 'claude-haiku-4-5-20251001' };
function createProtocol(host, packet, cwd, profile, sessionId, selectedFormat = format) {
  if (require('./verification-submission-contract.cjs').isSubmissionFormat(selectedFormat)) {
    if (host !== 'claude') throw new Error('submission_claude_only');
    return require('./verification-submission-protocol.cjs').createSubmissionProtocol(packet, sessionId, selectedFormat);
  }
  const wire = childDelivery(host, packet, selectedFormat), prompt = parentPrompt(host, packet, selectedFormat);
  const report = host === 'codex' ? codex.initial() : claude.initial();
  let phase = 0, complete = false;
  const call = (id, method, params) => ({ id, method, params });
  function observe(row) {
    if (complete) throw new Error('worker_event_after_completion');
    if (host === 'claude') {
      if (row.type === 'system' && row.subtype === 'init') {
        if (report.init || row.session_id !== sessionId) throw new Error('worker_session_binding');
      } else if (!report.init) throw new Error('worker_init_required');
      claude.observe(report, row);
      for (const t of report.tools) {
        const input = t.input;
        if (input?.subagent_type !== 'general-purpose' || input.prompt !== wire.input ||
            input.run_in_background !== false || Object.keys(input).some(k =>
              !['description', 'subagent_type', 'prompt', 'run_in_background'].includes(k))) throw new Error('worker_child_request');
        checkId(t.id);
      }
      if (report.inputs.some(i => i.parent_tool_use_id !== report.tools[0]?.id ||
          i.text.length !== 1 || i.text[0] !== wire.input)) throw new Error('worker_child_input');
      if (row.type === 'result') {
        if (row.session_id !== sessionId || report.results.length !== 1) throw new Error('worker_session_binding');
        complete = true;
      }
      return [];
    }
    if (row.error || row.id != null && row.method) throw new Error('worker_rpc_rejected');
    if (row.id != null) {
      if (row.id !== phase + 1 || row.id > 5) throw new Error('worker_rpc_order');
      phase++;
      if (row.id === 1) return [{ method: 'initialized' }, call(2, 'config/read', { includeLayers: false })];
      if (row.id === 2) {
        codex.validateConfig(row.result?.config);
        return [call(3, 'hooks/list', { cwds: [cwd] })];
      }
      if (row.id === 3) {
        if (row.result?.errors?.length || row.result?.data?.some(v => v.errors?.length)) throw new Error('worker_hook_inventory');
        const hooks = row.result?.data?.flatMap(v => v.hooks).filter(h => h.enabled);
        const expected = path.join(profile, 'plugins/cache/ttak-release/ttak/0.2.0-rc.1+codex.20260908082818/hooks/ttak.cjs');
        if (!Array.isArray(hooks) || hooks.length !== 3 ||
            new Set(hooks.map(h => h.eventName)).size !== 3 || hooks.some(h =>
              !['SessionStart', 'UserPromptSubmit', 'SubagentStart', 'sessionStart', 'userPromptSubmit', 'subagentStart'].includes(h.eventName) ||
              h.pluginId !== 'ttak@ttak-release' || h.trustStatus !== 'trusted' || h.handlerType !== 'command' ||
              h.command.replaceAll('/', '\\') !== ('node "' + expected + '"').replaceAll('/', '\\'))) throw new Error('worker_hook_inventory');
        return [call(4, 'thread/start', { cwd, model: model.codex,
          allowProviderModelFallback: false, sandbox: 'read-only', approvalPolicy: 'never' })];
      }
      if (row.id === 4) {
        const r = row.result;
        if (r?.model !== model.codex || r.reasoningEffort !== 'high' || r.modelProvider !== 'openai') throw new Error('worker_model_binding');
        checkId(r.thread?.id); report.parent = { id: r.thread.id }; report.requested_turns = 1;
        return [call(5, 'turn/start', { threadId: r.thread.id, input: [{ type: 'text', text: prompt }], effort: 'high' })];
      }
      return [];
    }
    codex.observe(report, row);
    for (const t of report.tools) {
      if (t.threadId !== report.parent?.id || t.senderThreadId !== report.parent.id ||
          !['spawnAgent', 'wait', 'closeAgent'].includes(t.tool) || t.receiverThreadIds?.length !== 1) throw new Error('worker_child_request');
      if (t.tool === 'spawnAgent' && (t.prompt !== wire.input || t.model !== model.codex || t.reasoningEffort !== 'high')) throw new Error('worker_child_request');
    }
    if (row.method === 'turn/completed' && row.params.threadId === report.parent?.id) complete = true;
    return [];
  }
  function finish() {
    if (!complete || report.errors.length) throw new Error('worker_incomplete');
    let parentId, childId;
    if (host === 'codex') {
      parentId = report.parent.id;
      if (!/^spawnAgent,(?:wait,)+closeAgent$/.test(report.tools.map(t => t.tool).join(','))) throw new Error('worker_incomplete');
      childId = report.tools[0].receiverThreadIds[0];
      if (report.tools.some(t => t.status !== 'completed' || t.receiverThreadIds[0] !== childId) ||
          report.tools.slice(1, -2).some(t => !['pendingInit', 'running'].includes(t.agentsStates[childId]?.status)) ||
          report.tools.slice(-2).some(t => t.agentsStates[childId]?.status !== 'completed')) throw new Error('worker_incomplete');
    } else {
      parentId = sessionId;
      if (report.tools.length !== 1 || report.tasks.length !== 1 || report.inputs.length !== 1 ||
          report.tasks[0].tool_use_id !== report.tools[0].id) throw new Error('worker_incomplete');
      const content = report.tasks[0].content;
      if (!Array.isArray(content)) throw new Error('worker_child_id_unobserved');
      const ids = content.filter(b => b.type === 'text').flatMap(b =>
        [...b.text.matchAll(/^agentId: ([A-Za-z0-9_-]+) \(/gm)].map(m => m[1]));
      if (ids.length !== 1) throw new Error('worker_child_id_unobserved');
      childId = ids[0];
    }
    checkId(parentId); checkId(childId);
    if (childId === parentId) throw new Error('worker_child_id_reused');
    return checkedData({ parent_thread_id: parentId, children: [{ thread_id: childId,
      packet_sha256: wire.packet_sha256, spawn_mode: host === 'codex' ? 'fork_context_false' : 'general_purpose_foreground', completed: true }] });
  }
  return { observe, finish, report, prompt, isComplete: () => complete,
    initialize: call(1, 'initialize', { clientInfo: { name: 'ttak_verification95', version: '1' } }) };
}
function verifyCodexCalls(raw, packet, childId, selectedFormat = format) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2097152) throw new Error('worker_transcript_limit');
  const inputs = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    const row = JSON.parse(line), p = row.payload;
    if (row.type !== 'response_item' || !p) continue;
    if (p.type === 'custom_tool_call') {
      if (p.name !== 'exec' || typeof p.input !== 'string') throw new Error('worker_spawn_proof');
      inputs.push(p.input.trim());
    } else if (p.type.endsWith('_call')) throw new Error('worker_spawn_proof');
  }
  const expected = codexCalls(packet, childId, selectedFormat);
  if (inputs.length !== expected.length || inputs.some((v, i) => v !== expected[i])) throw new Error('worker_spawn_proof');
  // Literal equality only. Native JavaScript is never executed by this verifier.
}
module.exports = { createProtocol, verifyCodexCalls };
