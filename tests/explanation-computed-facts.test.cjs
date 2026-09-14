'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const source=require('../scripts/explanation-source-model.cjs');
const {explainScenario}=require('../scripts/finite-scenario-render.cjs');
const {digest,textDigest,checkedData}=require('../scripts/verification-packet.cjs');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const model=()=>({initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
  {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},
  {id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]});
const context='The supplied state cells and transactions form the abstract example; the invariant is the required condition on those cells.';
const input=(models=[model()],text='',language='en')=>({computed_models:models.map(m=>({model_sha256:digest(m),model:m})),request_context:models.length?context:'',additional_sources:text?[{sha256:textDigest(text),text}]:[],language});
test('computed fact compiler renders the selected exact model instead of taking a generated result claim',()=>{
  assert.equal(typeof source.compileModelAnswer,'function');
  const m=model(),compiled=source.compileModelAnswer(input([m]));
  assert.equal(compiled.answer,context+'\n\n'+explainScenario(m,'en').explanation);assert.deepEqual(compiled.model_sha256s,[digest(m)]);
  assert.match(compiled.answer,/T1` reads `B`/);assert.match(compiled.answer,/T2` reads `A`/);
  assert.match(compiled.answer,/makes no update because its guard is false/);assert.match(compiled.answer,/did not verify a real database/);
});
test('renamed, guard-false, overlapping and unsafe-serial models preserve the existing engine results',()=>{
  assert.equal(typeof source.compileModelAnswer,'function');
  const renamed={initial:{active:true,ready:true},invariant:{cells:['active','ready'],at_least:1},transactions:[
    {id:'Right',guard:{cells:['active'],at_least:1},writes:{ready:false}},
    {id:'Left',guard:{cells:['ready'],at_least:1},writes:{active:false}}]};
  const disabled=model();disabled.initial.B=false;
  const overlap=model();overlap.transactions[1].writes={A:false};
  const unsafe=model();unsafe.transactions.forEach(t=>{t.guard={cells:[],at_least:0};});
  for(const m of [renamed,disabled,overlap,unsafe])for(const language of ['en','ko']){
    const out=source.compileModelAnswer(input([m],'',language));assert.equal(out.answer,context+'\n\n'+explainScenario(m,language).explanation);assert.deepEqual(out.model_sha256s,[digest(m)]);
  }
  assert.match(source.compileModelAnswer(input([overlap])).answer,/aborts on a write conflict/);
  assert.match(source.compileModelAnswer(input([unsafe])).answer,/Serialization alone is insufficient/);
});
test('supplementary facts remain literal data, never a computed certificate or an instruction to execute',()=>{
  assert.equal(typeof source.compileModelAnswer,'function');
  const note='Required implementation evidence remains for the independent review.';
  assert.equal(source.compileModelAnswer(input([],note)).answer,note);
  const m=model(),out=source.compileModelAnswer(input([m],note));assert.equal(out.answer,context+'\n\n'+explainScenario(m,'en').explanation+'\n\n'+note);
  const second=model();second.transactions.reverse();const both=source.compileModelAnswer(input([m,second]));
  assert.equal(both.answer,[context,explainScenario(m,'en').explanation,explainScenario(second,'en').explanation].join('\n\n'));
  assert.deepEqual(both.model_sha256s,[digest(m),digest(second)]);
});
test('malformed or forged model replies and output excess are rejected without evaluating objects',()=>{
  assert.equal(typeof source.compileModelAnswer,'function');let evaluated=0;
  const accessor={get computed_models(){evaluated++;return [];},additional_sources:'x',language:'en'};
  const wrong=input();wrong.computed_models[0].model.transactions[0].guard.cells=['A'];
  const extra=input();extra.computed_models[0].computed={answer:'Always safe'};
  for(const value of [accessor,wrong,extra,input([model(),model()]),input([],''),input([], 'x'.repeat(8001)),
    input([model()],'x'.repeat(8000)),{...input(),language:'unknown'},{...input(),computed_models:null},
    {...input(),unknown:true},{...input(),additional_sources:3},input(Array.from({length:5},model))])assert.throws(()=>source.compileModelAnswer(value));
  assert.equal(evaluated,0);
});
test('the source binding accepts only selected original-model hashes and preserves the generic text route',()=>{
  assert.equal(typeof source.checkFactModelSources,'function');
  const m=model(),changed=model();changed.transactions[0].guard.cells=['A'];
  assert.doesNotThrow(()=>source.checkFactModelSources(input([m]),[digest(m)]));
  assert.doesNotThrow(()=>source.checkFactModelSources(input([], 'The supplied model is not relevant to the requested fact.'),[digest(m)],[textDigest('The supplied model is not relevant to the requested fact.')]));
  assert.doesNotThrow(()=>source.checkFactModelSources('Plain unrelated factual answer.',undefined));
  for(const [answer,allowed]of [[input([changed]),[digest(m)]],[input([m]),undefined],['Rewritten finite facts.',[digest(m)]],
    [input([m]),[]],[input([m]),[digest(m),digest(m)]],[input([m]),['wrong']]])assert.throws(()=>source.checkFactModelSources(answer,allowed));
});
test('computed-answer schema describes data-only definitions and returns a fresh schema to each caller',()=>{
  assert.equal(typeof source.modelAnswerSchema,'function');const schema=source.modelAnswerSchema();
  assert.deepEqual(schema.required,['computed_models','request_context','additional_sources','language']);assert.equal(schema.additionalProperties,false);
  assert.equal(schema.properties.computed_models.maxItems,4);assert.equal(schema.properties.computed_models.items.properties.model.$ref,'#/$defs/finite_model');
  assert.equal(schema.$defs.finite_model.type,'object');
  assert.equal(schema.properties.additional_sources.items.properties.text.maxLength,8000);
  schema.properties.language.enum.push('changed');assert.deepEqual(source.modelAnswerSchema().properties.language.enum,['en','ko']);
});

test('selected models require bounded request context, kept literal and separate from computed evidence',()=>{
  const valid=input(),missing={...valid};delete missing.request_context;
  for(const value of [missing,...['','  ',null,3,'x'.repeat(2001),'한'.repeat(667)].map(request_context=>({...valid,request_context}))])
    assert.throws(()=>source.compileModelAnswer(value));
  let reads=0;const accessor={...valid};Object.defineProperty(accessor,'request_context',{enumerable:true,get(){reads++;return context;}});
  assert.throws(()=>source.compileModelAnswer(accessor));assert.equal(reads,0);
  const literal='In the requested example A and B indicate whether the respective doctor is on call. T1 and T2 are their leave decisions.';
  const out=source.compileModelAnswer({...valid,request_context:literal});
  assert.equal(out.answer,literal+'\n\n'+explainScenario(model(),'en').explanation);
  assert.deepEqual(out.model_sha256s,[digest(model())]);
  assert.equal(source.modelAnswerSchema().properties.request_context.maxLength,2000);
  assert.match(body(v.prepare({...binding,request:request(model())}).packets[0]).submission.input_schema.properties.answer.properties.request_context.description,/original requested example/);
});
const binding={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64)};
const request=m=>'Explain the supplied finite example and one mitigation with its trade-off.\n'+JSON.stringify(m);
const body=packet=>JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
function launched(delivery,requestFor=request){
  const m=model(),plan=v.prepare({...binding,request:requestFor(m)}),packet=plan.packets[0],id='computed-fact-child';
  let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);
  const spawn={hook_event_name:'PreToolUse',tool_name:delivery==='native'?'spawn_agent':'Agent',tool_use_id:'computed-spawn',tool_input:delivery==='native'
    ?{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}
    :{description:'Check one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}};
  attempt=v.observeAgent(attempt,spawn);
  if(delivery==='native')attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:id}});
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:id,agent_type:v.agentType});
  if(delivery==='mcp'){
    const get={hook_event_name:'PreToolUse',agent_id:id,tool_use_id:'computed-get',tool_input:{challenge:packet.challenge}};
    attempt=v.observePacket(attempt,get);attempt=v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  }
  return {m,plan,packet,id,spawn,attempt};
}
test('model-bearing packets require computed-answer objects and retain only original-model hashes in the fact slot',()=>{
  const m=model(),plan=v.prepare({...binding,request:request(m)}),schema=body(plan.packets[0]).submission.input_schema.properties.answer;
  assert.equal(schema.type,'object');assert.deepEqual(schema.properties.computed_models.items.properties.model_sha256.enum,[digest(m)]);
  const stored=v.initialVerification(plan);assert.deepEqual(stored.facts[0].source_model_sha256s,[digest(m)]);
  assert.doesNotMatch(JSON.stringify(stored),/"initial"|"model"|"guard"|"additional_sources"/);
  const plain=v.prepare({...binding,request:'Explain a fictional Nori register holding7.'});
  assert.equal(body(plain.packets[0]).submission.input_schema.properties.answer.type,'string');
  assert.equal(Object.hasOwn(v.initialVerification(plain).facts[0],'source_model_sha256s'),false);
  const corrupted=structuredClone(stored);corrupted.facts[0].source_model_sha256s=['bad'];assert.throws(()=>v.checkedVerification(corrupted));
});
test('both normal host transitions require exact original models before submitting and disclosing compiled facts',()=>{
  for(const delivery of ['native','mcp']){
    const f=launched(delivery),args={challenge:f.packet.challenge,verdict:'answered',answer:input([f.m]),issues:[]};
    const payload=v.resultSubmission(args,'fact');assert.equal(payload.result.answer,context+'\n\n'+explainScenario(f.m,'en').explanation);
    const submit={hook_event_name:'PreToolUse',agent_id:f.id,tool_use_id:'computed-submit',tool_input:args};
    let attempt=v.observeSubmission(f.attempt,submit,'fact');attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PostToolUse',submission_payload:payload},'fact');
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:f.id,last_assistant_message:payload.receipt_text});
    if(delivery==='mcp')attempt=v.observeAgent(attempt,{...f.spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:payload.receipt_text+'\nagentId: '+f.id+' (for resuming)'}]});
    assert.equal(attempt.verification.facts[0].phase,'referenced');assert.equal(attempt.status,'pending');
    const ref=v.resultReference({attempt_id:'current',candidate_sha256:'current',challenge:'current'},attempt),readArgs={...ref.args,result:payload.result};
    attempt=v.observeResultRead(attempt,readArgs,v.resultRead(readArgs));assert.equal(attempt.verification.facts[0].phase,'returned');assert.equal(attempt.verification.facts[0].verdict,'answered');
    assert.equal(attempt.status,'pending');assert.deepEqual(attempt.verification.facts[0].source_model_sha256s,[digest(f.m)]);
    assert.doesNotMatch(JSON.stringify(attempt),/Initial state|"model"|"guard"|"additional_sources"/);
  }
});
test('legacy rewriting and a different self-consistent model cannot enter an active source-bound native fact',()=>{
  for(const delivery of ['native','mcp'])for(const mode of ['legacy','different','forged']){
    const f=launched(delivery),other=model();other.transactions[0].guard.cells=['A'];
    const answer=mode==='legacy'?'Both modeled transactions commit.':input([other]);if(mode==='forged')answer.computed_models[0].model_sha256=digest(f.m);
    const args={challenge:f.packet.challenge,verdict:'answered',answer,issues:[]};
    assert.throws(()=>v.observeSubmission(f.attempt,{hook_event_name:'PreToolUse',agent_id:f.id,tool_use_id:'different-submit',tool_input:args},'fact'));
    assert.equal(f.attempt.verification.facts[0].submitted,false);assert.equal(f.attempt.verification.facts[0].submission_sha256,null);
  }
});

test('native fact receipts preserve whole source qualifications on both delivery routes',()=>{
  const note='Observe committed changes visible when the first non-control statement starts.';
  for(const delivery of ['native','mcp']){
    const f=launched(delivery,m=>'Explain this abstract example.\n'+JSON.stringify({scenario:m,sources:[{text:note,sha256:textDigest(note)}]}));
    const args={challenge:f.packet.challenge,verdict:'answered',answer:input([f.m],note),issues:[]};
    const pre={hook_event_name:'PreToolUse',agent_id:f.id,tool_use_id:'appendix-submit',tool_input:args};
    for(const text of [note.replace('committed ',''),note.replace('non-control ',''),note+' Always safe.'])
      assert.throws(()=>v.observeSubmission(f.attempt,{...pre,tool_input:{...args,answer:{...args.answer,additional_sources:[{sha256:textDigest(text),text}]}}},'fact'));
    const payload=v.resultSubmission(args,'fact');let attempt=v.observeSubmission(f.attempt,pre,'fact');
    attempt=v.observeSubmission(attempt,{...pre,hook_event_name:'PostToolUse',submission_payload:payload},'fact');
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:f.id,last_assistant_message:payload.receipt_text});
    if(delivery==='mcp')attempt=v.observeAgent(attempt,{...f.spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:payload.receipt_text+'\nagentId: '+f.id+' (for resuming)'}]});
    const ref=v.resultReference({attempt_id:'current',candidate_sha256:'current',challenge:'current'},attempt),readArgs={...ref.args,result:payload.result};
    attempt=v.observeResultRead(attempt,readArgs,v.resultRead(readArgs));assert.equal(attempt.verification.facts[0].phase,'returned');
    assert.ok(payload.result.answer.endsWith(note));assert.equal(attempt.status,'pending');
  }
});
test('actual MCP uses the prepared model context, preserves the canonical result and rejects out-of-source substitutions',()=>{
  for(const host of ['claude','codex'])for(const mode of ['valid','different','legacy']){
    const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'computed-fact-test',version:'1'}}});
    dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
    const m=model(),prepared=v.prepare({...binding,request:request(m)});
    const planResponse=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_prepare',arguments:{...binding,request:request(m)}}}).result;
    assert.equal(planResponse.isError,undefined);
    const other=model();other.transactions[0].guard.cells=['A'];
    const args={challenge:prepared.packets[0].challenge,verdict:'answered',answer:mode==='legacy'?'Rewritten facts.':input([mode==='different'?other:m]),issues:[]};
    const result=dispatch({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'explanation_fact_result',arguments:args}}).result;
    if(mode==='valid')assert.deepEqual(result.structuredContent,v.resultSubmission(args,'fact'));else assert.equal(result.isError,true);
  }
});
test('schema references resolve inside each schema root and preserve the existing bounded-data depth check',()=>{
  const plan=v.prepare({...binding,request:request(model())});
  for(const schema of [source.modelAnswerSchema(),v.resultTools.find(t=>t.name==='explanation_fact_result').inputSchema,body(plan.packets[0]).submission.input_schema]){
    assert.doesNotThrow(()=>checkedData({result:{tools:[{inputSchema:schema}]}}));let refs=0;
    function walk(value){
      if(!value||typeof value!=='object')return;
      if(Object.hasOwn(value,'$ref')){
        refs++;assert.equal(value.$ref,'#/$defs/finite_model');let target=schema;
        for(const part of value.$ref.slice(2).split('/')){assert.ok(Object.hasOwn(target,part));target=target[part];}
        assert.equal(target.type,'object');assert.deepEqual(target.required,['initial','invariant','transactions']);
      }
      for(const child of Object.values(value))walk(child);
    }
    walk(schema);assert.equal(refs,1);
  }
  let deep='leaf';for(let i=0;i<18;i++)deep={nested:deep};assert.throws(()=>checkedData(deep),/verification_data_limit/);
});
