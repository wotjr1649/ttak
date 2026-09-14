'use strict';
// Audit only the pinned Claude parent protocol; meta text is never a general exemption.
const { canonical, checkedData } = require('./verification-packet.cjs');
const { collectClaudeTranscript, reportSnapshot } = require('./verification-host-adapter.cjs');
const enforcement = '[structured-output-enforce] You MUST call the StructuredOutput tool to complete this request. Call this tool now.';
const acknowledgement = 'Structured output provided successfully';
const proofs = new WeakMap();
const fail = () => { throw new Error('explanation_parent_protocol'); };
function auditClaudeParent(raw, report, prompt, result) {
  reportSnapshot(report);
  if (report.host !== 'claude' || report.thread_id !== report.parent_thread_id) fail();
  const recollected = collectClaudeTranscript(raw, { parent_session_id: report.thread_id, agent_id: null });
  if (canonical(recollected) !== canonical(report)) fail();
  let original = false, meta = false, call = null, ack = false, previous = null;
  const seen = new Set();
  // The collector above bounds bytes, lines and frames and validates session/model/version/usage.
  for (const line of raw.split(/\r?\n/).filter(l => l.trim())) {
    const row = JSON.parse(line);
    if (!['user', 'assistant'].includes(row.type)) continue;
    if (seen.has(row.uuid) || row.message.role !== row.type || ack ||
        (row.isMeta !== undefined && typeof row.isMeta !== 'boolean')) fail();
    seen.add(row.uuid);
    const content = row.message.content;
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
    if (!Array.isArray(blocks) || !blocks.length) fail();
    if (row.type === 'user') {
      if (blocks.length !== 1) fail();
      const b = blocks[0];
      if (!original) {
        if (seen.size !== 1 || row.isMeta === true || b.type !== 'text' || b.text !== prompt) fail();
        original = true;
      } else if (b.type === 'text') {
        if (meta || call || row.isMeta !== true || b.text !== enforcement ||
            !previous?.visible_text || row.parentUuid !== previous.uuid) fail();
        meta = true;
      } else if (b.type === 'tool_result') {
        if (row.isMeta === true || !call || b.tool_use_id !== call.id ||
            (b.is_error !== undefined && b.is_error !== false) ||
            b.content !== acknowledgement || row.parentUuid !== call.uuid || previous?.uuid !== call.uuid) fail();
        ack = true;
      } else fail();
    } else {
      if (!original || row.isMeta === true || call) fail();
      // The first response may follow a native attachment omitted from this projection.
      // Subsequent assistant chunks and the response to enforcement must keep their observed edge.
      if (previous && (previous.type === 'assistant' || previous.meta) && row.parentUuid !== previous.uuid) fail();
      for (const b of blocks) {
        if (['thinking', 'redacted_thinking', 'text'].includes(b.type)) continue;
        if (b.type !== 'tool_use' || b.name !== 'StructuredOutput' || call ||
            typeof b.id !== 'string' || !b.id || canonical(checkedData(b.input)) !== canonical(checkedData(result))) fail();
        call = { id: b.id, uuid: row.uuid };
      }
    }
    previous = { uuid: row.uuid, type: row.type, meta: row.isMeta === true,
      visible_text: row.type === 'assistant' && blocks.some(b => b.type === 'text') };
  }
  if (!original || !call || !ack) fail();
  const proof = Object.freeze({ schema_version: 1, protocol: 'claude-2.1.266-StructuredOutput',
    enforcement_events: Number(meta), structured_output_calls: 1, acknowledgements: 1 });
  proofs.set(proof, { report, prompt, inputs: Object.freeze(meta ? [prompt, enforcement] : [prompt]) });
  return proof;
}
function parentProofInputs(proof, report, prompt) {
  const binding = proofs.get(proof);
  if (!binding || binding.report !== report || binding.prompt !== prompt) fail();
  return binding.inputs;
}
module.exports = { auditClaudeParent, parentProofInputs };
