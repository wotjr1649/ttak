'use strict';
// In-memory, stdio-only result submission. This module does not register a host connection.
// Caller identity is NOT established here; the native child trace must establish it separately.
const { Transform } = require('node:stream');
const { serve } = require('./review-mcp.cjs');
const { validatePacket, checkedData, canonical, digest } = require('./verification-packet.cjs');
const { submissionAck, submissionSchema } = require('./verification-submission-audit.cjs');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function createDispatcher(packetValue) {
  const packet = validatePacket(packetValue);
  const tool = { name: 'verification_submit', description: 'Submit one verification result using the supplied source anchor IDs. '
    + 'This validates structure and exact source ranges, not truth. Submit once. No files or network are accessed.',
    inputSchema: submissionSchema(packet),
    strict: true,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false } };
  let initialized = false, ready = false, attempted = false, messages = 0;
  return value => {
    if (++messages > 64) throw new Error('submission_message_limit');
    const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    let request;
    try { request = checkedData(value); } catch { return fail(null, -32600, 'Invalid request'); }
    if (!request || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return fail(null, -32600, 'Invalid request');
    if (!Object.hasOwn(request, 'id')) {
      if (request.method === 'notifications/initialized' && initialized) ready = true;
      return null;
    }
    const id = request.id;
    if (!(typeof id === 'string' && id.length <= 128) && !Number.isSafeInteger(id)) return fail(null, -32600, 'Invalid request id');
    const respond = result => ({ jsonrpc: '2.0', id, result });
    if (request.method === 'ping') return respond({});
    if (request.method === 'initialize') {
      const p = request.params;
      if (initialized || !record(p) || typeof p.protocolVersion !== 'string' || !record(p.capabilities) || !record(p.clientInfo) ||
          typeof p.clientInfo.name !== 'string' || typeof p.clientInfo.version !== 'string') return fail(id, -32602, 'Invalid initialization');
      initialized = true;
      return respond({ protocolVersion: ['2025-11-25', '2025-06-18', '2025-03-26'].includes(p.protocolVersion) ? p.protocolVersion : '2025-11-25',
        capabilities: { tools: {} }, serverInfo: { name: 'ttak-verification-submission', version: '0.1.0' } });
    }
    if (!ready) return fail(id, -32002, 'Initialization required');
    if (request.method === 'tools/list') return respond({ tools: [checkedData(tool)] });
    if (request.method !== 'tools/call') return fail(id, -32601, 'Method not found');
    if (request.params?.name !== tool.name) return fail(id, -32602, 'Unknown tool');
    const errorResult = text => respond({ isError: true, content: [{ type: 'text', text }] });
    if (attempted) return errorResult('submission_attempt_consumed');
    attempted = true; // Invalid submissions consume the only attempt too.
    try {
      const ack = submissionAck(packet, request.params.arguments);
      return respond({ content: [{ type: 'text', text: canonical(ack) }], structuredContent: ack });
    } catch { return errorResult('invalid_verification_submission'); }
  };
}
async function serveSubmission(input, output, packet) {
  let bytes = 0;
  const bounded = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    callback(bytes > 2097152 ? new Error('submission_stream_limit') : null, bytes > 2097152 ? undefined : chunk);
  } });
  // Lifetime belongs to the supervising native process budget. A separate
  // 120-second timer here used to cut off slower inference before submission.
  input.pipe(bounded);
  try { await serve(bounded, output, createDispatcher(packet)); }
  finally { input.unpipe(bounded); input.destroy(); bounded.destroy(); }
}
module.exports = { createDispatcher, serveSubmission };
if (require.main === module) {
  const diagnostic = process.argv.length === 3 && process.argv[2] === '--diagnostic';
  const pinned = process.argv.length === 4 && process.argv[2] === '--pinned';
  if (!diagnostic && !pinned) process.exitCode = 2;
  else {
    if (['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'NODE_OPTIONS', 'NODE_PATH'].some(k => process.env[k])) {
      process.exitCode = 1; // Fail before protocol processing; never print credential values.
    } else {
    try {
      const packet = diagnostic ? require('./verification-native-run.cjs').diagnosticPacket()
        : require('./verification-input.cjs').readPinnedInput(process.cwd(), process.argv[3]).packet;
      process.stdout.on('error', () => process.stdin.destroy());
      serveSubmission(process.stdin, process.stdout, packet).catch(() => { process.exitCode = 1; });
    } catch { process.exitCode = 1; } // Fixed failure, no rejected packet/path/secret output.
    }
  }
}
