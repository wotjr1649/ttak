'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { explainScenario } = require('../scripts/finite-scenario-render.cjs');
const { createDispatcher } = require('../scripts/finite-scenario-mcp.cjs');
const scenario = () => ({ initial: { alpha: true, beta: true }, invariant: { cells: ['alpha', 'beta'], at_least: 1 },
  transactions: [{ id: 'First', guard: { cells: ['beta'], at_least: 1 }, writes: { alpha: false } },
    { id: 'Second', guard: { cells: ['alpha'], at_least: 1 }, writes: { beta: false } }] });
const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });
const init = request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
const ready = { jsonrpc: '2.0', method: 'notifications/initialized' };
const call = id => request(id, 'tools/call', { name: 'scenario_explain', arguments: { scenario: scenario(), language: 'en' } });

test('renderer preserves scope and distinguishes false guards from write-conflict aborts', () => {
  const result = explainScenario(scenario(), 'en');
  assert.match(result.explanation, /`First` reads `beta`, which `Second` can write/);
  assert.match(result.explanation, /makes no update because its guard is false/);
  assert.ok(!result.explanation.includes('aborts on a write conflict'));
  assert.match(result.explanation, /did not check every possible interleaving/);
  assert.match(result.explanation, /Include snapshot acquisition and the guard check/);
  assert.equal(result.facts.real_database_verified, false);
  assert.equal(result.facts.all_possible_interleavings_checked, false);
});

test('renderer does not recommend serialization when the input logic still violates the invariant', () => {
  const input = scenario(); input.transactions.forEach(t => { t.guard = { cells: [], at_least: 0 }; });
  const text = explainScenario(input, 'en').explanation;
  assert.match(text, /Serialization alone is insufficient/);
  assert.ok(!text.includes('A mitigation in this model'));
  assert.ok(!text.includes('Checked ordering:'));
  assert.throws(() => explainScenario(input, 'unknown'), /unsupported_scenario_language/);
  assert.match(explainScenario(scenario(), 'ko').explanation, /가능한 모든 interleaving을 검사한 것은 아닙니다/);
});

test('mitigation ordering is derived for every participant and absent when no concurrent violation exists', () => {
  const input = {initial:{red:true,green:true,blue:true},invariant:{cells:['red','green','blue'],at_least:1},
    transactions:[{id:'Red',guard:{cells:['green','blue'],at_least:1},writes:{red:false}},
      {id:'Green',guard:{cells:['red','blue'],at_least:1},writes:{green:false}},
      {id:'Blue',guard:{cells:['red','green'],at_least:1},writes:{blue:false}}]};
  const rendered = explainScenario(input,'en');
  assert.equal(rendered.facts.concurrent_invariant_violation_found,true);
  assert.equal(rendered.facts.all_serial_orders_preserve_invariant,true);
  const ordering = rendered.explanation.split('\n\n').find(p=>p.startsWith('Checked ordering:'));
  assert.ok(ordering.indexOf('`Red`') < ordering.indexOf('`Green`'));
  assert.ok(ordering.indexOf('`Green`') < ordering.indexOf('`Blue`'));
  assert.equal((ordering.match(/takes snapshot/g)||[]).length,3);
  assert.match(rendered.explanation,/Ordering commits after all snapshots/);
  input.transactions.forEach(t=>Object.keys(t.writes).forEach(cell=>{t.writes[cell]=true;}));
  const safe = explainScenario(input,'en');
  assert.equal(safe.facts.concurrent_invariant_violation_found,false);
  assert.ok(!safe.explanation.includes('Checked ordering:'));
  assert.ok(!safe.explanation.includes('still admits the violating schedule'));
});

test('MCP initialization, notifications and per-connection call bound are enforced', () => {
  const dispatch = createDispatcher();
  assert.equal(dispatch(call(2)).error.code, -32002);
  assert.equal(dispatch({ ...init, params: { ...init.params, capabilities: [] } }).error.code, -32602);
  assert.ok(dispatch(init).result);
  assert.equal(dispatch({ ...call(2), id: undefined }).error.code, -32600);
  dispatch(ready);
  const notification = call(2); delete notification.id;
  assert.equal(dispatch(notification), null);
  for (const id of [2, 3, 4]) assert.ok(dispatch(call(id)).result.structuredContent);
  assert.equal(dispatch(call(5)).result.content[0].text, 'tool_call_limit');
  assert.equal(dispatch(init).error.code, -32602);
});

test('invalid data and tool names never become executed commands or echoed error contents', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(ready);
  const bad = call(2); bad.params.arguments.scenario.transactions[0].writes = { private_marker_do_not_echo: false };
  const result = dispatch(bad);
  assert.equal(result.result.isError, true);
  assert.ok(!JSON.stringify(result).includes('private_marker_do_not_echo'));
  assert.equal(dispatch(request(3, 'tools/call', { name: 'run_command', arguments: {} })).error.code, -32602);
  const list = dispatch(request(4, 'tools/list', {})).result.tools;
  assert.equal(list.length, 1); assert.equal(list[0].annotations.readOnlyHint, true);
  assert.equal(list[0].annotations.openWorldHint, false);
});

test('real stdio server returns only protocol messages and preserves Korean output', () => {
  const input = call(3); input.params.arguments.language = 'ko';
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/finite-scenario-mcp.cjs')], {
    input: [init, ready, request(2, 'tools/list', {}), input].map(JSON.stringify).join('\n') + '\n',
    encoding: 'utf8', timeout: 5000, maxBuffer: 1048576, windowsHide: true,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => ['SYSTEMROOT', 'WINDIR', 'PATH'].includes(key.toUpperCase()))) });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const rows = result.stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3]);
  assert.equal(rows[2].result.content[0].text, rows[2].result.structuredContent.explanation);
  assert.match(rows[2].result.content[0].text, /최종 상태/);
  assert.equal(rows[2].result.structuredContent.facts.real_database_verified, false);
});
