'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { handleEvent } = require('../hooks/scenario-evidence.cjs');
const { handle: stop } = require('../hooks/scenario-stop.cjs');
const { decide:formatNotice, propose, exposeDecision, requested, instruction, continuation, begin:beginAttempt, tool:decisionTool } = require('../scripts/explanation-attempt.cjs');
const {reviewNotice}=require('./helpers/withholding-review.cjs');
const {assessRequest}=require('./helpers/request-assessment.cjs');
// Formatting tests inspect the notice fields; envelope request/revision checks have separate tests.
const decide=({request,revision,assessment_result,...args})=>formatNotice(args);
const { createDispatcher } = require('../scripts/scenario-feedback-mcp.cjs');
const runtime = path.resolve(__dirname, '../.superpowers');
function fixture(body) {
  const root = fs.mkdtempSync(path.join(runtime, 'attempt-test-'));
  const options = { root, enabled: true, now: 1000000 };
  const input = (event, extra = {}) => {
    if(event==='UserPromptSubmit'&&requested(extra.prompt))input.request=extra.prompt;
    return { hook_event_name: event, session_id: 'attempt-session', turn_id: 'attempt-turn', ...extra };
  };
  input.assess=(args,dispatch)=>assessRequest(args,input,options,dispatch);
  const file = path.join(root, 'scenario-evidence-v1', createHash('sha256').update('attempt-session').digest('hex') + '.json');
  const begin = () => handleEvent(input('UserPromptSubmit', { prompt: 'Use ttak-explain to explain this example. The measured slowdown is essential but no measurements are available.' }), options);
  const finish = (text, active = false) => stop(input('Stop', { last_assistant_message: text, stop_hook_active: active }), true, options);
  try { body({ options, input, file, begin, finish }); }
  finally { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(runtime)); fs.rmSync(root, { recursive: true }); }
}

test('omitting the decision tool cannot complete a registered explanation', () => fixture(({ begin, finish }) => {
  begin();
  const result = finish('Measurements are missing. Here is the complete explanation. All claims are supported.', true);
  assert.equal(result.continue, false);
  assert.match(result.stopReason, /not verified/);
}));

test('a failed final-input check remains visible after session end and resume', () => fixture(({ begin, finish, input, options }) => {
  begin(); assert.equal(finish('').continue, false);
  handleEvent(input('SessionEnd'), options);
  const resumed = handleEvent(input('SessionStart', { source: 'resume' }), options);
  assert.match(resumed.hookSpecificOutput?.additionalContext || '', /unverified/);
}));

test('a pending explanation survives session end as incomplete and does not poison a new ordinary task', () => fixture(({ begin, input, options, finish }) => {
  begin(); handleEvent(input('SessionEnd'), options);
  const resumed = handleEvent(input('SessionStart', { source: 'resume' }), options);
  assert.match(resumed.hookSpecificOutput?.additionalContext || '', /unverified/);
  const next = handleEvent(input('UserPromptSubmit', { prompt: 'Fix the CSV quoting bug.' }), options);
  assert.match(next.hookSpecificOutput?.additionalContext || '', /previous explanation/i);
  assert.deepEqual(finish('Fixed CSV escaping and checked round-trip behavior.'), {});
}));

test('an interrupted registered explanation cannot become a completed answer', () => fixture(({ begin, input, options, finish }) => {
  begin(); handleEvent(input('Interrupt'), options);
  assert.equal(finish('The complete explanation is ready.', true).continue, false);
}));

function decisionEvent(file, input, mutate = value => value) {
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const args = { attempt_id: state.attempt.id, candidate_sha256: state.attempt.candidate, request:input.request,revision:0,
    disposition: 'withheld', language: 'en', corrections: [], unresolved: [{ requirement: 'Measured slowdown for this workload',
      request_quote:input.request,
      reason: 'missing_evidence', evidence_needed: 'Comparable benchmark measurements for both isolation levels.' }] };
  const dispatch = createDispatcher();
  dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  dispatch({ jsonrpc: '2.0', method: 'notifications/initialized' });
  args.assessment_result=input.assess({attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,request:args.request},dispatch);
  const result = dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'explanation_decide', arguments: args } }).result;
  assert.equal(result.isError, undefined);
  return mutate(input('PostToolUse', { tool_name: 'mcp__ttak_scenario__explanation_decide', tool_input: args, tool_response: result }));
}

test('verified MCP withholding is the exact final body and never requests a scenario reconciliation', () => fixture(({ begin, file, input, options, finish }) => {
  for (const container of ['full', 'blocks', 'text']) {
    begin();
    const event = decisionEvent(file, input), payload = event.tool_response.structuredContent;
    if (container === 'blocks') event.tool_response = event.tool_response.content;
    if (container === 'text') event.tool_response = event.tool_response.content[0].text;
    assert.deepEqual(handleEvent(event, options), {});
    reviewNotice(event.tool_input,input,options);
    assert.deepEqual(finish(payload.final_text), {});
    assert.deepEqual(finish(payload.final_text, true), {});
    assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status, 'withheld');
    handleEvent(input('SessionEnd'), options);
    const resume = handleEvent(input('SessionStart', { source: 'resume' }), options);
    assert.match(resume.hookSpecificOutput.additionalContext, /unverified/);
    assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status, 'withheld');
  }
}));

test('appended or rewritten final content cannot use a withholding decision', () => fixture(({ begin, file, input, options, finish }) => {
  for (const change of [text => text + '\n\nHere is the complete explanation.', text => text.replace('withholding', 'completing'), text => text + ' ']) {
    begin(); const event = decisionEvent(file, input), body = event.tool_response.structuredContent.final_text;
    handleEvent(event, options);
    reviewNotice(event.tool_input,input,options);
    assert.equal(finish(change(body), true).continue, false);
    assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status, 'unavailable');
    assert.equal(finish(body).continue, false);
  }
}));

test('malformed preparation cannot be repaired into success by a later valid withholding call',()=>fixture(({begin,file,input,options,finish})=>{
  begin();const valid=decisionEvent(file,input),args={attempt_id:'current',candidate_sha256:'current',
    request:'Explain the example.',blocks:'[{"text":"Partial draft","question_ids":["Q1"]}],"questions":[]'};
  const denied=handleEvent(input('PreToolUse',{tool_name:'mcp__ttak_scenario__explanation_prepare',tool_use_id:'bad-prepare',tool_input:args}),options);
  assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(JSON.parse(fs.readFileSync(file)).status,'unavailable');
  const later=handleEvent(input('PreToolUse',{tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'later-decide',tool_input:valid.tool_input}),options);
  assert.equal(later.hookSpecificOutput.permissionDecision,'deny');
  assert.equal(finish(valid.tool_response.structuredContent.final_text,true).continue,false);
  assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status,'unavailable');
}));

test('model-reported support cannot issue completion and an unbound tool response cannot become a decision', () => fixture(({ begin, file, input, options, finish }) => {
  begin(); const event = decisionEvent(file, input);
  assert.throws(() => decide({ ...event.tool_input, disposition: 'complete', unresolved: [] }), /independent_completion_evidence_required/);
  for (const mutate of [
    value => { value.tool_response.structuredContent.disposition = 'complete'; },
    value => { value.tool_response.content[0].text = '{}'; },
    value => { value.tool_input.attempt_id = '00000000-0000-0000-0000-000000000000'; },
    value => { value.tool_input.candidate_sha256 = 'a'.repeat(64); },
    value => { value.tool_input.unresolved[0].supported = true; }
  ]) {
    begin(); const altered = decisionEvent(file, input); mutate(altered);
    assert.match(handleEvent(altered, options).systemMessage, /could not record/);
    assert.equal(finish('All claims supported.', true).continue, false);
  }
}));

test('decisions retain no requirement text and reject possible secrets before generating or storing a digest', () => fixture(({ begin, file, input, options }) => {
  begin(); const event = decisionEvent(file, input);
  handleEvent(event, options);
  const raw = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(raw, /Measured slowdown|benchmark|missing_evidence|final_text/);
  const marker = 'sk-' + 'SYNTHETIC'.repeat(4);
  assert.throws(() => decide({ ...event.tool_input, unresolved: [{ ...event.tool_input.unresolved[0], requirement: marker }] }), /explanation_text_rejected/);
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
}));

test('decisions for other turns cannot change this attempt', () => fixture(({ begin, file, input, options }) => {
  begin(); const event = decisionEvent(file, input), before = fs.readFileSync(file, 'utf8');
  event.turn_id = 'other-turn';
  assert.match(handleEvent(event, options).systemMessage, /could not record/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
}));
test('published notice constraints reject the same markup and line breaks as the unchanged local guard',()=>fixture(({begin,file,input})=>{
  begin();const args=decisionEvent(file,input).tool_input,properties=decisionTool.inputSchema.properties.unresolved.items.properties;
  for(const field of ['requirement','evidence_needed']){
    const schema=properties[field],accepts=text=>new RegExp(schema.pattern).test(text)&&!new RegExp(schema.not.pattern).test(text)&&text.length<=schema.maxLength;
    for(const text of ['B >= 1','<tag>','`B`','First\nsecond','Final newline\n','Final carriage return\r','   ']){
      assert.equal(accepts(text),false);assert.throws(()=>decide({...args,unresolved:[{...args.unresolved[0],[field]:text}]}));
    }
    for(const text of ['T1 reads B and writes A.','B must be true.','At least one doctor remains on call.']){
      assert.equal(accepts(text),true);const result=decide({...args,unresolved:[{...args.unresolved[0],[field]:text}]});assert.equal(result.disposition,'withheld');
    }
  }
  assert.deepEqual(decisionTool.inputSchema.properties.disposition.enum,['withheld']);assert.equal(decisionTool.inputSchema.properties.unresolved.minItems,1);
  assert.throws(()=>decide({...args,disposition:'complete',unresolved:[]}),/independent_completion_evidence_required/);
  assert.throws(()=>decide({...args,unresolved:[]}),/unresolved_requirements_required/);
}));

const correction = {claim:'T1 reads A.',correction:'T1 reads B and writes A.',basis:'The supplied T1 guard lists B; its write target is A.'};

test('requested corrections have a separate bounded place in withholding and remain in its final hash',()=>fixture(({file,input,options,finish})=>{
  handleEvent(input('UserPromptSubmit',{prompt:'Explain the supplied workload. T1 reads B and writes A. Assess the draft claim that T1 reads A. An exact measured slowdown is required, but no measurements are supplied.'}),options);
  const original=decisionEvent(file,input).tool_input,args={...original,corrections:[correction]},payload=decide(args);
  assert.equal(payload.disposition,'withheld');assert.equal(payload.unresolved_count,1);assert.equal(payload.correction_count,1);
  assert.match(payload.final_text,/Draft claim: T1 reads A\. Correction: T1 reads B and writes A\./);
  assert.equal(payload.final_sha256,createHash('sha256').update(payload.final_text).digest('hex'));
  assert.notEqual(payload.final_sha256,decide(original).final_sha256);
  const dispatcher=createDispatcher();dispatcher({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  dispatcher({jsonrpc:'2.0',method:'notifications/initialized'});
  const seeded=dispatcher({jsonrpc:'2.0',id:100,method:'tools/call',params:{name:'explanation_assess_request',arguments:{attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,request:args.request}}}).result;
  assert.equal(seeded.isError,undefined);
  const reply=dispatcher({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_decide',arguments:args}}).result;
  assert.deepEqual(reply.structuredContent,exposeDecision(propose(args)));
  assert.deepEqual(handleEvent(input('PostToolUse',{tool_name:'mcp__ttak_scenario__explanation_decide',tool_input:args,tool_response:reply}),options),{});
  reviewNotice(args,input,options);
  assert.deepEqual(finish(payload.final_text),{});
  const saved=fs.readFileSync(file,'utf8');assert.doesNotMatch(saved,/T1 reads|write target|supplied T1/);
  assert.equal(JSON.parse(saved).attempt.status,'withheld');
  assert.equal(finish(payload.final_text.replace('T1 reads B and writes A.','T1 reads A and writes B.'),true).continue,false);
  assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status,'unavailable');
}));

test('empty corrections preserve the formatted notice and corrections alone cannot certify completion',()=>fixture(({begin,file,input})=>{
  begin();const {corrections,...args}=decisionEvent(file,input).tool_input;
  assert.deepEqual(decide({...args,corrections:[]}),decide(args));
  assert.equal(decisionTool.inputSchema.required.includes('corrections'),true);
  assert.throws(()=>decide({...args,unresolved:[],corrections:[correction]}),/unresolved_requirements_required/);
  assert.throws(()=>decide({...args,disposition:'complete',corrections:[correction]}),/independent_completion_evidence_required/);
  assert.throws(()=>decide({...args,corrections:[{...correction,supported:true}]}),/invalid_explanation_correction/);
}));

test('correction fields reject markup, secrets, extra fields and unbounded content before rendering',()=>fixture(({begin,file,input})=>{
  begin();const args=decisionEvent(file,input).tool_input;
  for(const corrections of [null,'text',{},Array(5).fill(correction),[{claim:'Only a claim.'}]])assert.throws(()=>decide({...args,corrections}));
  for(const field of ['claim','correction','basis']){
    for(const text of ['','  ','line\nnext','<claim>','`B`','x'.repeat(481),'가'.repeat(161),'sk-'+'SYNTHETIC'.repeat(4)])
      assert.throws(()=>decide({...args,corrections:[{...correction,[field]:text}]}));
  }
  const ko=decide({...args,language:'ko',corrections:[{claim:'T1은 A를 읽는다.',correction:'T1은 B를 읽고 A에 쓴다.',basis:'제공된 T1 guard는 B를 나열하고 쓰기 대상은 A다.'}]});
  assert.match(ko.final_text,/요청된 초안 정정\(완성 설명은 계속 보류\)/);assert.equal(ko.disposition,'withheld');
}));

test('Codex Stop continuation rebinds the turn without resetting the attempt or correction budget', () => fixture(({ begin, file, input, options, finish }) => {
  begin(); const first = finish('A draft without a decision.');
  assert.equal(first.decision, 'block');
  const before = JSON.parse(fs.readFileSync(file));
  handleEvent(input('UserPromptSubmit', { prompt: first.reason, turn_id: 'host-continuation' }), options);
  const after = JSON.parse(fs.readFileSync(file));
  assert.equal(after.attempt.id, before.attempt.id);
  assert.equal(after.attempt.corrections, 1);
  const result = stop(input('Stop', { turn_id: 'host-continuation', stop_hook_active: false, last_assistant_message: 'Still no decision.' }), true, options);
  assert.equal(result.continue, false);
}));

test('a decided withholding gets one copy-only continuation without restarting its decision',()=>fixture(({begin,file,input,options,finish})=>{
  begin();const event=decisionEvent(file,input),body=event.tool_response.structuredContent.final_text;
  handleEvent(event,options);reviewNotice(event.tool_input,input,options);const decided=JSON.parse(fs.readFileSync(file));
  const first=finish(body+' Provide guidance to remove the requirement.');
  assert.equal(first.decision,'block');assert.match(first.reason,/already withheld/);
  assert.match(first.reason,/final_text returned by the latest accepted explanation_notice_from_assessment, explanation_decide or explanation_repair_notice/);
  assert.doesNotMatch(first.reason,/first call|start explanation_prepare|TTAK registered/);
  const continuation=handleEvent(input('UserPromptSubmit',{prompt:first.reason,turn_id:'copy-turn'}),options);
  assert.deepEqual(continuation,{});
  const after=JSON.parse(fs.readFileSync(file));
  assert.deepEqual(after.attempt,{...decided.attempt,corrections:1});
  assert.equal(after.request_sha256,decided.request_sha256);
  assert.equal(after.turn,createHash('sha256').update('copy-turn').digest('hex'));
  assert.deepEqual(stop(input('Stop',{turn_id:'copy-turn',last_assistant_message:body,stop_hook_active:false}),true,options),{});
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Measured slowdown|final_text/);
}));

test('copy-only continuation cannot spend another correction or revive failure on the same attempt',()=>fixture(({begin,file,input,options,finish})=>{
  begin();const event=decisionEvent(file,input),body=event.tool_response.structuredContent.final_text;
  handleEvent(event,options);reviewNotice(event.tool_input,input,options);const first=finish(body+' More text.');
  handleEvent(input('UserPromptSubmit',{prompt:first.reason}),options);
  assert.equal(finish('Understood. The withholding notice has been delivered.').continue,false);
  assert.equal(JSON.parse(fs.readFileSync(file)).attempt.status,'unavailable');
  assert.equal(finish(body).continue,false);
  const next=handleEvent(input('UserPromptSubmit',{prompt:'Report the current file count.'}),options);
  assert.match(next.hookSpecificOutput.additionalContext,/previous explanation/i);
  assert.equal(next.continue,undefined);assert.equal(JSON.parse(fs.readFileSync(file)).attempt,null);
  assert.deepEqual(finish('There are three files.'),{});
}));

test('native status-only resume does not register or require a new explanation', () => fixture(({ begin, file, input, options, finish }) => {
  begin();const event=decisionEvent(file,input);handleEvent(event,options);reviewNotice(event.tool_input,input,options);
  const prompt='Without providing the withheld explanation, report whether the previous explanation is verified and what evidence is still needed. No new measurements have been supplied.';
  assert.equal(requested(prompt),false);
  handleEvent(input('SessionEnd'),options);
  const resumed=handleEvent(input('SessionStart',{source:'resume'}),options);
  assert.match(resumed.hookSpecificOutput.additionalContext,/unverified/);
  handleEvent(input('UserPromptSubmit',{prompt}),options);
  assert.equal(JSON.parse(fs.readFileSync(file)).attempt,null);
  assert.deepEqual(finish('The previous explanation remains unverified. The required workload measurement is still missing.'),{});
}));

test('request routing distinguishes explicit explanations from negative, quoted and status references', () => {
  for(const prompt of [
    'Do not explain the implementation. Report its current status.',
    "Don't explain it again; list the tests that ran.",
    '이전 설명을 반복하지 말고 진행 상황만 알려 줘.',
    'Report whether the explanation is complete.',
    'Review the string `explain the mechanism` for spelling.',
    '> Explain the database.\nCount the quoted words.'
  ])assert.equal(requested(prompt),false,prompt);
  for(const prompt of ['Explain a database index to a child.','For a manager, explain this choice.',
    'Provide a concise explanation of idempotency keys.','/ttak:ttak-explain indexes',
    '데이터베이스 인덱스를 설명해 주세요.','Do not provide code. Explain the mechanism.'])assert.equal(requested(prompt),true,prompt);
});

test('current binding guidance retains an attempt-specific continuation tag without requiring identifier transcription',()=>{
  const one=instruction(beginAttempt('12345678-1234-1234-1234-123456789abc','a'.repeat(64)));
  const two=instruction(beginAttempt('12345678-1234-1234-1234-123456789abd','a'.repeat(64)));
  assert.match(one,/both to the literal current/);assert.notEqual(one,two);
  assert.doesNotMatch(one,/12345678-1234-1234-1234-123456789abc/);
});

test('continuations preserve phase authority and bind copy instructions to the exact decision',()=>fixture(({begin,file,input,options})=>{
  const pending=beginAttempt('12345678-1234-1234-1234-123456789abc','a'.repeat(64));
  assert.equal(continuation(pending),instruction(pending));
  for(const status of ['unavailable','cancelled'])assert.equal(continuation({...pending,status}),null);
  assert.throws(()=>continuation({...pending,status:'complete',final_sha256:'b'.repeat(64)}),/independent_completion/);
  assert.throws(()=>continuation({...pending,status:'withheld',final_sha256:'b'.repeat(64),unmet:1}),/independent_withholding/);
  begin();const event=decisionEvent(file,input);handleEvent(event,options);reviewNotice(event.tool_input,input,options);
  const decided=JSON.parse(fs.readFileSync(file)).attempt;
  assert.throws(()=>continuation({...decided,final_sha256:'c'.repeat(64)}),/independent_withholding/);
  assert.notEqual(continuation(decided),continuation({...decided,id:'12345678-1234-1234-1234-123456789abd'}));
  assert.throws(()=>continuation({...decided,unmet:0}),/invalid_explanation_attempt/);
}));
