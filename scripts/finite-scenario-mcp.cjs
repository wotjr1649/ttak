'use strict';
// Pure calculation over stdin/stdout. No filesystem, network, credential or model access.
const { serve } = require('./review-mcp.cjs');
const { explainScenario } = require('./finite-scenario-render.cjs');
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const names = { type: 'array', maxItems: 16, items: { type: 'string', minLength: 1, maxLength: 32 } };
const predicate = object({ cells: names, at_least: { type: 'integer', minimum: 0, maximum: 16 } });
const state = { type: 'object', minProperties: 1, maxProperties: 16, additionalProperties: { type: 'boolean' } };
const schema = object({ scenario: object({ initial: state, invariant: predicate,
  transactions: { type: 'array', minItems: 1, maxItems: 4, items: object({
    id: { type: 'string', minLength: 1, maxLength: 32 }, guard: predicate, writes: state }) } }),
  language: { type: 'string', enum: ['en', 'ko'] } });
const tool = { name: 'scenario_explain', description: 'Compute and render a finite boolean concurrency example for a technical reader. '
  + 'Use descriptive ASCII identifiers for cells and transactions. A transaction reads all cells in its guard and applies constant writes only when its guard holds. '
  + 'The explanation includes computed dependencies, representative schedules, a serial coordination mitigation when justified, and precise scope limits. '
  + 'It does not execute SQL or verify a real database. Preserve those limits when presenting the explanation.', inputSchema: schema,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function createDispatcher() {
  let initialized = false, ready = false, calls = 0;
  return request => {
    const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (!request || typeof request !== 'object' || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return fail(null, -32600, 'Invalid request');
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
        capabilities: { tools: {} }, serverInfo: { name: 'ttak-finite-scenario', version: '0.1.0' } });
    }
    if (!ready) return fail(id, -32002, 'Initialization required');
    if (request.method === 'tools/list') return respond({ tools: [tool] });
    if (request.method !== 'tools/call') return fail(id, -32601, 'Method not found');
    if (request.params?.name !== tool.name) return fail(id, -32602, 'Unknown tool');
    if (++calls > 3) return respond({ isError: true, content: [{ type: 'text', text: 'tool_call_limit' }] });
    const args = request.params.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 2 ||
        !Object.hasOwn(args, 'scenario') || !Object.hasOwn(args, 'language')) return fail(id, -32602, 'Invalid tool arguments');
    try {
      const payload = explainScenario(args.scenario, args.language);
      return respond({ content: [{ type: 'text', text: payload.explanation }], structuredContent: payload });
    } catch { return respond({ isError: true, content: [{ type: 'text', text: 'invalid_scenario_arguments' }] }); }
  };
}
if (require.main === module) {
  process.stdout.on('error', () => process.stdin.destroy());
  serve(process.stdin, process.stdout, createDispatcher()).catch(() => { process.exitCode = 1; });
}
module.exports = { createDispatcher };
