'use strict';
const { checkedData, canonical, digest, exact } = require('./verification-packet.cjs');
const { parseAnchoredResult, anchoredSchema } = require('./verification-anchors.cjs');
const { parseStrictObject, reportSnapshot } = require('./verification-host-adapter.cjs');
const { submissionTool } = require('./verification-submission-contract.cjs');
function submissionAck(packet, value) {
  const args = checkedData(value), result = parseAnchoredResult(packet, canonical(args));
  if (result.status === 'answered' && result.uncertainties.length) throw new Error('submission_answered_with_uncertainty');
  return { accepted: true, packet_sha256: digest(packet), submission_sha256: digest(args),
    validated_result_sha256: digest(result), native_caller_verified: false, semantic_quality_verified: false };
}
function submissionSchema(packet) {
  const schema = anchoredSchema(packet);
  for (const key of ['question_id', 'packet_sha256', 'anchor_map_sha256', 'status']) schema.properties[key].type = 'string';
  schema.properties.uncertainties.description = 'Empty for answered. For unresolved or conflict, list material gaps preventing resolution within the supplied scope.';
  // The pinned native tool path cannot use root schema unions. submissionAck enforces this relation.
  schema.properties.status.description = 'answered requires supporting citations and uncertainties=[]. Otherwise use unresolved or conflict with a nonempty uncertainties array.';
  return schema;
}
function checkSubmissionAck(packet, args, content) {
  // Claude 2.1.266 forwards a text-only MCP result as a string. Both native
  // representations must contain the same strict JSON ack, without extraction.
  let text = content;
  if (typeof text !== 'string') {
    if (!Array.isArray(content) || content.length !== 1) throw new Error('submission_ack_format');
    exact(content[0], ['type', 'text']);
    if (content[0].type !== 'text') throw new Error('submission_ack_format');
    text = content[0].text;
  }
  const received = parseStrictObject(text), expected = submissionAck(packet, args);
  if (canonical(received) !== canonical(expected)) throw new Error('submission_ack_binding');
  return expected;
}
function auditSubmissionChild(reportValue, packet) {
  const child = reportSnapshot(reportValue);
  if (child.host !== 'claude' || child.thread_id === child.parent_thread_id || child.tools.length !== 1 ||
      child.non_text_user_blocks.length !== 1) throw new Error('submission_child_tool_count');
  const tool = child.tools[0], reply = child.non_text_user_blocks[0];
  if (tool.type !== 'tool_use' || tool.name !== submissionTool || reply.type !== 'tool_result' ||
      reply.tool_use_id !== tool.id || reply.is_error !== false ||
      !Number.isSafeInteger(tool.event_index) || !Number.isSafeInteger(reply.event_index) ||
      tool.event_index >= reply.event_index) throw new Error('submission_child_tool_binding');
  const ack = checkSubmissionAck(packet, tool.input, reply.content);
  return { result: parseAnchoredResult(packet, canonical(tool.input)), submission_sha256: ack.submission_sha256, tool_use_id: tool.id };
}
module.exports = { submissionAck, submissionSchema, checkSubmissionAck, auditSubmissionChild };
