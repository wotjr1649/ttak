'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),v=require('../scripts/explanation-verification.cjs'),{digest,textDigest,canonical}=require('../scripts/verification-packet.cjs');
const {handle:handleStop}=require('../hooks/scenario-stop.cjs');
const request='Explain the fictional Daro counter. Its given operation adds two to the stored integer. Start at 3 and apply that operation once.';
test('displayed verifier results put the binding envelope before the answer without changing canonical values',()=>{
  const challenge='a'.repeat(64),samples=[
    ['fact',{challenge,verdict:'answered',answer:'A bounded fact answer.',issues:[]}],
    ['final',{challenge,final_decision:'approve_explanation',requirement_review:'The request is covered.',claim_review:'The proposal matches its premises.',fact_review:'The independent factual reasons match the original.',issues:[],checked_questions:['trace']}],
    ['notice',{challenge,notice_decision:'approve_notice',requirement_review:'The gap is accurately identified.',evidence_review:'The requested measurements suffice.',assessment_review:'The requested assessment is included.',checked_questions:[v.assessmentId],issues:[]}],
    ['assessment',{challenge,assessment_decision:'assessed',gap_review:'No essential gap is established.',essential_gaps:[],corrections:[],issues:[]}]
  ];
  for(const [kind,args]of samples){
    const payload=v.resultSubmission(args,kind),parsed=JSON.parse(payload.final_text);
    assert.deepEqual(Object.keys(parsed),['protocol','challenge','kind','verdict','answer','issues','checked_questions']);
    assert.deepEqual(parsed,payload.result);assert.equal(digest(parsed),digest(payload.result));
    assert.deepEqual(v.parseAnswer(payload.final_text,{kind:payload.result.kind,challenge}),v.parseAnswer(canonical(payload.result),{kind:payload.result.kind,challenge}));
  }
});
function fixture(body,answer='The operation adds two: the stored value changes from 3 to 5.'){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'return-test-'));
  const options={root,enabled:true,now:1000000},base={session_id:'return-parent',turn_id:'parent-turn'};
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
  const event=input=>handleEvent({...base,...input},options);
  const child={turn_id:'child-turn',agent_id:'return-child'};
  try{
    event({hook_event_name:'UserPromptSubmit',prompt:request});const attempt=read().attempt;
    const args={attempt_id:attempt.id,candidate_sha256:attempt.candidate,request,blocks:[{text:'It changes 3 to 5.',question_ids:['trace']}],
      questions:[{id:'trace',kind:'mechanism',target:'The operation and complete state trace',conditions:'Start at 3 and add two once.',source_ids:[]}],sources:[]};
    const plan=v.prepare(args),packet=plan.packets[0],response=v.exposePlan(plan);
    assert.deepEqual(event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_prepare',tool_input:args,
      tool_response:{structuredContent:response,content:[{type:'text',text:JSON.stringify(response)}]}}),{});
    const spawn={tool_name:'spawn_agent',tool_use_id:'spawn-one',tool_input:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
    assert.deepEqual(event({...spawn,hook_event_name:'PreToolUse'}),{});
    assert.deepEqual(event({...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child.agent_id}}),{});
    event({...child,hook_event_name:'SubagentStart',agent_type:'default'});
    assert.deepEqual(event({...child,hook_event_name:'UserPromptSubmit',prompt:packet.prompt}),{});
    const submitted=v.resultSubmission({challenge:packet.challenge,verdict:'answered',answer,issues:[]},'fact');
    const input={...child,tool_name:'mcp__ttak_scenario__explanation_fact_result',tool_use_id:'result-one',tool_input:{challenge:packet.challenge,verdict:submitted.result.verdict,answer:submitted.result.answer,issues:[]}};
    const submit=()=>{assert.deepEqual(event({...input,hook_event_name:'PreToolUse'}),{});assert.deepEqual(event({...input,hook_event_name:'PostToolUse',
      tool_response:{structuredContent:submitted,content:[{type:'text',text:JSON.stringify(submitted)}]}}),{});};
    const finish=(text,extra={})=>event({...child,hook_event_name:'SubagentStop',last_assistant_message:text,stop_hook_active:false,...extra});
    const stop=()=>handleStop({...base,hook_event_name:'Stop',last_assistant_message:'The explanation remains unverified.',stop_hook_active:false},true,options);
    body({event,child,read,file,packet,submitted,input,submit,finish,stop});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
test('an observed native typed result gets exactly one serialization correction before its unchanged JSON return',()=>fixture(({submit,finish,submitted,read,event,child,file})=>{
  submit();const parentTurn=read().turn,blocked=finish(submitted.result.answer);assert.equal(blocked.decision,'block');
  assert.equal(read().status,'empty');assert.equal(read().attempt.verification.facts[0].return_corrections,1);
  assert.equal(read().attempt.verification.facts[0].reply_sha256,null);
  assert.deepEqual(event({...child,turn_id:'return-turn',hook_event_name:'UserPromptSubmit',prompt:blocked.reason}),{});
  assert.equal(read().turn,parentTurn);
  assert.deepEqual(finish(submitted.final_text,{turn_id:'return-turn',stop_hook_active:true}),{});
  const slot=read().attempt.verification.facts[0];assert.equal(slot.phase,'returned');assert.equal(slot.submitted,true);assert.equal(slot.reply_sha256,digest(submitted.result));
  assert.equal(slot.submission_sha256,slot.reply_sha256);assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Daro|stored value|"answer"|"issues"|"final_text"/);
}));
test('canonical child JSON without an observed typed submission cannot establish a return',()=>fixture(({finish,submitted,read})=>{
  assert.match(finish(submitted.final_text).systemMessage,/could not record/);assert.equal(read().status,'unavailable');
  assert.equal(read().attempt.verification.facts[0].reply_sha256,null);
}));
test('a returned JSON object cannot change the actual submitted answer or verdict',()=>fixture(({submit,finish,submitted,read})=>{
  submit();const changed={...submitted.result,answer:'A different answer.'};assert.match(finish(canonical(changed)).systemMessage,/could not record/);
  assert.equal(read().status,'unavailable');assert.equal(read().attempt.verification.facts[0].return_corrections,0);
}));
test('a valid JSON inner answer cannot replace the submitted envelope or obtain a copy correction',()=>fixture(({submit,finish,submitted,read,stop})=>{
  submit();assert.doesNotThrow(()=>JSON.parse(submitted.result.answer));
  const response=finish(submitted.result.answer);
  assert.match(response.systemMessage,/could not record/);assert.equal(response.decision,undefined);
  assert.equal(read().status,'unavailable');assert.equal(read().attempt.status,'pending');
  const slot=read().attempt.verification.facts[0];
  assert.equal(slot.return_corrections,0);assert.equal(slot.submitted,true);assert.equal(slot.reply_sha256,null);
  assert.equal(stop().continue,false);assert.equal(read().attempt.status,'unavailable');
},canonical({gap_review:'The stated operation is sufficient.',essential_gaps:[],corrections:[]})));
test('a second malformed serialization exhausts the one correction even if the host flag is false',()=>fixture(({submit,finish,submitted,read})=>{
  submit();assert.equal(finish(submitted.result.answer).decision,'block');assert.match(finish(submitted.result.answer).systemMessage,/could not record/);
  assert.equal(read().status,'unavailable');assert.equal(read().attempt.verification.facts[0].return_corrections,1);
}));
test('parent or unrelated child cannot submit a result for the active verifier',()=>{
  for(const actor of [{agent_id:'other-child',turn_id:'other-turn'},{agent_id:undefined,turn_id:'parent-turn'}])fixture(({event,input})=>{
    const r=event({...input,...actor,hook_event_name:'PreToolUse'});assert.equal(r.hookSpecificOutput?.permissionDecision,'deny');
  });
});
test('a duplicate submission cannot replace the result retained for output correction',()=>fixture(({submit,event,input,read})=>{
  submit();const before=read().attempt.verification.facts[0].submission_sha256;
  assert.equal(event({...input,tool_use_id:'result-two',hook_event_name:'PreToolUse'}).hookSpecificOutput?.permissionDecision,'deny');
  assert.equal(read().attempt.verification.facts[0].submission_sha256,before);assert.equal(read().status,'unavailable');
}));
test('a pre-hook reservation or a post-hook without reservation is not a submitted-result receipt',()=>{
  fixture(({event,input,finish,submitted,read})=>{
    assert.deepEqual(event({...input,hook_event_name:'PreToolUse'}),{});
    assert.match(finish(submitted.result.answer).systemMessage,/could not record/);assert.equal(read().status,'unavailable');
    assert.equal(read().attempt.verification.facts[0].submitted,false);
  });
  fixture(({event,input,submitted,read})=>{
    const r=event({...input,hook_event_name:'PostToolUse',tool_response:{content:[{type:'text',text:JSON.stringify(submitted)}],structuredContent:submitted}});
    assert.match(r.systemMessage,/could not record/);assert.equal(read().status,'unavailable');
  });
});
test('changed tool arguments, response body or result kind fail closed',()=>{
  for(const mode of ['arguments','response','kind'])fixture(({event,input,submitted,read})=>{
    assert.deepEqual(event({...input,hook_event_name:'PreToolUse'}),{});
    const payload=structuredClone(submitted),next=structuredClone(input);
    if(mode==='arguments')next.tool_input.answer='A replacement answer.';
    if(mode==='response')payload.result.answer='A replacement answer.';
    if(mode==='kind'){next.tool_name='mcp__ttak_scenario__explanation_final_result';next.tool_input.checked_questions=['trace'];}
    const r=event({...next,hook_event_name:'PostToolUse',tool_response:{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload}});
    assert.match(r.systemMessage,/could not record/);assert.equal(read().status,'unavailable');assert.equal(read().attempt.verification.facts[0].submitted,false);
  });
});
test('unsafe output and an already-used host continuation never receive an output correction',()=>{
  for(const mode of ['unicode','secret-marker','continued'])fixture(({submit,finish,submitted,read})=>{
    submit();const r=mode==='unicode'?finish('Invalid\ud800reply'):mode==='secret-marker'?finish('-----BEGIN PRIVATE KEY-----')
      :finish(submitted.result.answer,{stop_hook_active:true});
    assert.match(r.systemMessage,/could not record/);assert.equal(r.decision,undefined);assert.equal(read().attempt.verification.facts[0].return_corrections,0);
  });
});
test('serialization correction never reflects a malformed control character back into its prompt',()=>fixture(({submit,finish})=>{
  submit();const r=finish('Broken\u0000JSON');assert.equal(r.decision,'block');assert.equal(r.reason.includes('\u0000'),false);assert.equal(r.reason.includes('Broken'),false);
}));
test('a correction prompt cannot bind another child, the parent turn or multiple return turns',()=>{
  for(const extra of [{agent_id:'other-child',turn_id:'return-turn'},{turn_id:'parent-turn'},{turn_id:'child-turn'}])fixture(({submit,finish,submitted,event,child,read})=>{
    submit();const blocked=finish(submitted.result.answer),before=read();
    assert.equal(event({...child,...extra,hook_event_name:'UserPromptSubmit',prompt:blocked.reason}).continue,false);
    assert.deepEqual(read(),before);
  });
  fixture(({submit,finish,submitted,event,child,read})=>{
    submit();const blocked=finish(submitted.result.answer);
    assert.deepEqual(event({...child,turn_id:'return-turn',hook_event_name:'UserPromptSubmit',prompt:blocked.reason}),{});
    const before=read();assert.equal(event({...child,turn_id:'second-return-turn',hook_event_name:'UserPromptSubmit',prompt:blocked.reason}).continue,false);assert.deepEqual(read(),before);
  });
});
