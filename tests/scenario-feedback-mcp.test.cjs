'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createDispatcher } = require('../scripts/scenario-feedback-mcp.cjs');
const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });
const init = request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
const ready = { jsonrpc: '2.0', method: 'notifications/initialized' };
const call = (id, draft = 'Neither transaction writes to a cell the other reads from.') => request(id, 'tools/call', {
  name: 'scenario_review', arguments: { scenario: { initial: { a: true, b: true }, invariant: { cells: ['a','b'], at_least: 1 },
    transactions: [{ id: 'One', guard: { cells: ['b'], at_least: 1 }, writes: { a: false } },
      { id: 'Two', guard: { cells: ['a'], at_least: 1 }, writes: { b: false } }] }, draft, language: 'en' } });

test('protocol validation remains in force and tool is discoverable after initialization', () => {
  const dispatch = createDispatcher();
  assert.equal(dispatch(call(2)).error.code, -32002);
  assert.equal(dispatch(init).result.serverInfo.name, 'ttak-scenario-feedback');
  dispatch(ready);
  assert.equal(dispatch(request(2, 'tools/list', {})).result.tools[0].name, 'scenario_review');
  assert.equal(dispatch({ ...call(3), id: undefined }).error.code, -32600);
  const notification = call(3); delete notification.id;
  assert.equal(dispatch(notification), null);
  assert.equal(dispatch(init).error.code, -32602);
});

test('a real draft gets computed feedback and a corrected draft remains uncertified', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(ready);
  const first = dispatch(call(2)).result.structuredContent;
  assert.equal(first.status, 'needs_revision');
  assert.equal(first.issues[0].evidence.length, 2);
  assert.equal(first.computed.facts.potential_write_write_edges.length, 0);
  const next = dispatch(call(3, 'Each transaction reads a cell the other writes; their writes are disjoint.')).result.structuredContent;
  assert.equal(next.issues.length, 0);
  assert.equal(next.final_answer_verified, false);
  // A plugin connection serves later user tasks too, not only the first diagnostic.
  for (let id = 4; id < 9; id++) assert.equal(dispatch(call(id)).result.structuredContent.status, 'needs_revision');
});

test('malformed and executable-looking values do not run or reflect through error paths', () => {
  const dispatch = createDispatcher(); dispatch(init); dispatch(ready);
  const bad = call(2); bad.params.arguments.scenario.transactions[0].writes = { private_marker_do_not_echo: false };
  const response = dispatch(bad);
  assert.equal(response.result.isError, true);
  assert.ok(!JSON.stringify(response).includes('private_marker_do_not_echo'));
  assert.equal(dispatch(request(3, 'tools/call', { name: 'exec', arguments: {} })).error.code, -32602);
  const extra = call(4); extra.params.arguments.claims = [{ truthful: true }];
  assert.equal(dispatch(extra).error.code, -32602);
});

test('real stdio transport delivers feedback without logs or credential environment', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/scenario-feedback-mcp.cjs'),'--host','codex'], {
    input: [init, ready, call(2)].map(JSON.stringify).join('\n')+'\n', encoding: 'utf8', timeout: 5000,
    maxBuffer: 1048576, windowsHide: true,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => ['SYSTEMROOT','WINDIR','PATH'].includes(key.toUpperCase()))) });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const rows = result.stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(rows.map(row => row.id), [1, 2]);
  assert.deepEqual(JSON.parse(rows[1].result.content[0].text), rows[1].result.structuredContent);
  assert.equal(rows[1].result.structuredContent.status, 'needs_revision');
});

test('packet cache is connection-local and bounded; one response never exposes all pending packets',()=>{
  const dispatch=createDispatcher();dispatch(init);dispatch(ready);
  const make=id=>({attempt_id:id,candidate_sha256:'a'.repeat(64),request:'Explain reading this stipulated register. It stores 7; reading returns 7 without changes.',
    blocks:[{text:'The value remains 7 when read.',question_ids:['Q1','Q2']}],sources:[],questions:[
      {id:'Q1',kind:'mechanism',target:'Reading the stipulated register',conditions:'Use the stipulated rule.',source_ids:[]},
      {id:'Q2',kind:'relationship',target:'Read result and stored value',conditions:'Use the stipulated rule.',source_ids:[]}]});
  const args=make('first-attempt');
  const first=dispatch(request(2,'tools/call',{name:'explanation_prepare',arguments:args})).result;
  assert.equal(first.isError,undefined);assert.equal(first.structuredContent.packets.length,1);
  assert.deepEqual(first.structuredContent.pending_question_ids,['Q2']);
  assert.equal(dispatch(request(3,'tools/call',{name:'explanation_prepare',arguments:args})).result.isError,true);
  for(let i=0;i<7;i++)assert.equal(dispatch(request(10+i,'tools/call',{name:'explanation_prepare',arguments:make('attempt-'+i)})).result.isError,undefined);
  assert.equal(dispatch(request(30,'tools/call',{name:'explanation_prepare',arguments:make('overflow-attempt')})).result.isError,true);
  const disconnected=createDispatcher();disconnected(init);disconnected(ready);
  assert.equal(disconnected(request(2,'tools/call',{name:'explanation_next',arguments:{attempt_id:'first-attempt'}})).result.isError,true);
});

test('native result tools preserve an adverse result and cannot silently normalize contradictory verdicts',()=>{
  const dispatch=createDispatcher();dispatch(init);dispatch(ready);
  const arguments_={challenge:'a'.repeat(64),verdict:'unresolved',answer:'An essential measurement is missing.',
    issues:[{quote:'Measured slowdown',reason:'No observations were supplied.',evidence_needed:'Comparable benchmark observations.'}]};
  const good=dispatch(request(2,'tools/call',{name:'explanation_fact_result',arguments:arguments_})).result;
  assert.equal(good.isError,undefined);assert.equal(good.structuredContent.result.verdict,'unresolved');
  assert.deepEqual(good.structuredContent.result.checked_questions,[]);
  assert.deepEqual(JSON.parse(good.structuredContent.final_text),good.structuredContent.result);
  const bad=dispatch(request(3,'tools/call',{name:'explanation_fact_result',arguments:{...arguments_,verdict:'answered'}})).result;
  assert.equal(bad.isError,true);
});

test('parent native dispatch transfers exact prepared data while a fresh child connection needs no shared packet cache for result submission',()=>{
  const v=require('../scripts/explanation-verification.cjs'),parent=createDispatcher(),child=createDispatcher();
  for(const d of [parent,child]){d(init);d(ready);}
  const args={attempt_id:'dispatch-attempt',candidate_sha256:'a'.repeat(64),request:'Explain the defined Nori register. It holds 7 and a read returns 7 without changes.',
    blocks:[{text:'A read returns 7; the value remains 7.',question_ids:['Q1']}],sources:[],questions:[{id:'Q1',kind:'mechanism',target:'Nori reading',conditions:'Use the stipulated rule.',source_ids:[]}]};
  const prepared=parent(request(2,'tools/call',{name:'explanation_prepare',arguments:args})).result.structuredContent,packet=prepared.packets[0];
  const dispatchArgs={attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,challenge:packet.challenge};
  const wire=parent(request(3,'tools/call',{name:'explanation_dispatch',arguments:dispatchArgs})).result.structuredContent;
  assert.equal(wire.native_spawn.message,v.prepare(args).packets[0].prompt);assert.equal(wire.complete_authorized,false);
  assert.equal(child(request(4,'tools/call',{name:'explanation_packet',arguments:{challenge:packet.challenge}})).error.code,-32602);
  const submitted=child(request(5,'tools/call',{name:'explanation_fact_result',arguments:{challenge:packet.challenge,verdict:'answered',answer:'Reading returns 7 and leaves 7 stored.',issues:[]}})).result;
  assert.equal(submitted.isError,undefined);assert.equal(JSON.parse(submitted.structuredContent.final_text).challenge,packet.challenge);
  assert.equal(parent(request(6,'tools/call',{name:'explanation_dispatch',arguments:{...dispatchArgs,candidate_sha256:'b'.repeat(64)}})).result.isError,true);
});

test('each normal host lists and serves only its own packet transport, including guessed tool names',()=>{
  for(const host of ['claude','codex']){
    const dispatch=createDispatcher({host});dispatch(init);dispatch(ready);
    const names=dispatch(request(2,'tools/list',{})).result.tools.map(t=>t.name);
    assert.equal(names.length,16);assert.ok(names.includes('explanation_revise_final'));assert.ok(names.includes('explanation_final_preview'));assert.ok(names.includes('explanation_result'));assert.ok(names.includes('explanation_notice_from_assessment'));assert.ok(names.includes('explanation_assessment_result'));assert.ok(names.includes('explanation_assess_request'));assert.ok(names.includes('explanation_notice_result'));assert.ok(names.includes('explanation_repair_notice'));assert.equal(names.includes('explanation_packet'),host==='claude');assert.equal(names.includes('explanation_dispatch'),host==='codex');
    const wrong=host==='claude'?'explanation_dispatch':'explanation_packet';assert.equal(dispatch(request(3,'tools/call',{name:wrong,arguments:{}})).error.code,-32602);
  }
  assert.throws(()=>createDispatcher({host:'unknown'}),/verification_host/);
});

test('a fresh Claude connection still cannot retrieve a different connection packet',()=>{
  const parent=createDispatcher({host:'claude'}),child=createDispatcher({host:'claude'});for(const d of [parent,child]){d(init);d(ready);}
  const args={attempt_id:'connection-audit',candidate_sha256:'a'.repeat(64),request:'Explain the fictional box holding 7.',
    blocks:[{text:'The box holds 7.',question_ids:['Q1']}],questions:[{id:'Q1',kind:'mechanism',target:'The box',conditions:'It holds 7.',source_ids:[]}],sources:[]};
  const prepared=parent(request(2,'tools/call',{name:'explanation_prepare',arguments:args})).result.structuredContent;
  assert.deepEqual(Object.keys(prepared.native_dispatch).sort(),['Agent','explanation_check_final','explanation_result','instructions']);
  const get=request(3,'tools/call',{name:'explanation_packet',arguments:{challenge:prepared.packets[0].challenge}});
  assert.equal(parent(get).result.isError,undefined);assert.equal(child(get).result.isError,true);
});

test('the stdio entry point refuses missing or ambiguous host configuration before processing input',()=>{
  for(const args of [[],['--host'],['--host','unknown'],['--host','claude','--host','codex']]){
    const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/scenario-feedback-mcp.cjs'),...args],{
      input:JSON.stringify(init)+'\n',encoding:'utf8',timeout:5000,maxBuffer:4096,windowsHide:true,
      env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['SYSTEMROOT','WINDIR','PATH'].includes(key.toUpperCase())))});
    assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(result.stderr,'invalid_plugin_host\n');
  }
});
