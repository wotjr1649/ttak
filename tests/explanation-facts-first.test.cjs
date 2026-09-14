'use strict';
// Local protocol evidence only. Synthetic receipts do not certify native semantics.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs');
const request='Explain the fictional Miro register: it stores an integer, and each read returns it without changing it. Starting at 9, derive two reads and the final stored value. Also assess the claim that a read erases it.';
const input=()=>({attempt_id:'12345678-1234-1234-1234-123456789151',candidate_sha256:'a'.repeat(64),request});
function connection(host){const dispatch=createDispatcher({host});let id=1;
  dispatch({jsonrpc:'2.0',id:id++,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'facts-first-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  return (method,params)=>dispatch({jsonrpc:'2.0',id:id++,method,params}).result;
}
test('facts-first preparation carries only the exact original and no parent-derived answer',()=>{
  const args=input(),plan=v.prepare(args),packet=plan.packets[0],body=JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  assert.equal(plan.preparation,'request_facts');assert.equal(plan.purpose,undefined);assert.equal(plan.draft_sha256,null);
  assert.equal(plan.request_sha256,textDigest(request));assert.equal(plan.complete_authorized,false);assert.equal(plan.independent_native_agents_required,1);
  assert.equal(plan.packets.length,1);assert.equal(packet.id,'REQUEST_FACTS');assert.equal(body.data.original_request,request);
  assert.deepEqual(Object.keys(body.data).sort(),['original_request','purpose','source_mode']);
  assert.equal(body.data.purpose,'request_facts');assert.equal(body.submission.tool,'explanation_fact_result');
  assert.doesNotMatch(packet.prompt,/9, 9, 9|draft_sha256|parent_answer|sibling_answer/);
  assert.deepEqual(args,input());assert.notEqual(v.prepare({...args,request:request+' Give one limitation.'}).packets[0].challenge,packet.challenge);
  const legacy=v.prepare({...args,draft:'Both reads return 9 and the stored value is 9. Reading does not erase it.'});
  assert.equal(legacy.preparation,undefined);assert.match(legacy.draft_sha256,/^[a-f0-9]{64}$/);assert.notEqual(legacy.packets[0].challenge,packet.challenge);
});
test('both native tools advertise the three-field facts-first path and use the same bounded compiler',()=>{
  for(const host of ['claude','codex']){
    const call=connection(host),tool=call('tools/list',{}).tools.find(t=>t.name==='explanation_prepare');
    assert.deepEqual(tool.inputSchema.required,['attempt_id','candidate_sha256','request']);assert.equal(tool.inputSchema.additionalProperties,false);
    assert.equal(tool.inputSchema.properties.draft,undefined);assert.deepEqual(tool.annotations,v.prepareTool.annotations);
    const response=call('tools/call',{name:tool.name,arguments:input()});assert.equal(response.isError,undefined);
    assert.deepEqual(response.structuredContent,v.exposePlan(v.prepare(input()),host));
  }
});
test('facts-first keeps strict original, mode and legacy validation without repairing invalid inputs',()=>{
  for(const bad of [{...input(),request:''},{...input(),request:'x'.repeat(32001)},{...input(),request:'bad\ud800'},
    {...input(),request:'sk-'+'SYNTHETIC'.repeat(4)},{...input(),draft:null},{...input(),questions:[]},{...input(),preparation:'request_facts'},
    {...input(),plan_json:'{}'},{...input(),blocks:[]}])assert.throws(()=>v.prepare(bad));
  let invoked=0;const value=input();Object.defineProperty(value,'request',{enumerable:true,get(){invoked++;return request;}});
  assert.throws(()=>v.prepare(value));assert.equal(invoked,0);
  const plan=v.prepare(input()),valid=v.initialVerification(plan);assert.equal(v.checkedVerification(valid),valid);
  for(const bad of [{...valid,preparation:'other'},{...valid,draft_sha256:'a'.repeat(64)},
    {...valid,purpose:'request_assessment'},{...valid,facts:[{...valid.facts[0],id:'OTHER'}]},
    {...valid,facts:[...valid.facts,...valid.facts]},Object.fromEntries(Object.entries(valid).filter(([k])=>k!=='preparation'))])assert.throws(()=>v.checkedVerification(bad));
  const legacy=v.initialVerification(v.prepare({...input(),draft:'A legacy draft.'}));assert.throws(()=>v.checkedVerification({...legacy,draft_sha256:null}));
  assert.equal(v.checkedVerification(legacy),legacy);
});
test('facts-first does not authorize completion, unobserved facts or a restarted preparation',()=>{
  const args=input(),plan=v.prepare(args),start=a.begin(args.attempt_id,args.candidate_sha256),attempt=v.registerPlan(start,plan,textDigest(request));
  assert.equal(attempt.status,'pending');assert.equal(a.checkedAttempt(attempt),attempt);
  assert.throws(()=>v.registerPlan(start,plan,textDigest(request+' changed')),/plan_binding/);
  assert.throws(()=>v.registerPlan(attempt,plan,textDigest(request)),/plan_binding/);
  assert.throws(()=>a.checkedAttempt({...attempt,status:'complete',final_sha256:'b'.repeat(64)}),/independent_completion/);
  const packet=plan.packets[0],fact={protocol:v.protocol,kind:'fact',challenge:packet.challenge,verdict:'answered',answer:'Synthetic unobserved answer.',issues:[],checked_questions:[]};
  const finalArgs={...args,final_text:'This is not yet an approved explanation.',facts:[{id:packet.id,result:fact}],revision:0};
  assert.throws(()=>v.registerFinal(attempt,v.finalize(finalArgs),finalArgs),/unobserved_fact/);
  assert.throws(()=>v.checkFinalReferences({...finalArgs,request:'current',facts:'current'},attempt),/unobserved_fact/);
  assert.doesNotMatch(canonical(attempt),/Miro|stores an integer|erases/);
});
test('normal hooks bind a facts-first preparation and reject changed or malformed wire data',()=>{
  const runtime=path.resolve(__dirname,'../.superpowers');
  for(const mode of ['valid','post-changed','source-changed','malformed']){
    const root=fs.mkdtempSync(path.join(runtime,'facts-first-')),options={root,enabled:true,now:1000000},base={session_id:'facts-first-parent',turn_id:'facts-first-turn'};
    const event=data=>handleEvent({...base,...data},options),file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
    try{
      event({hook_event_name:'UserPromptSubmit',prompt:request});
      const args={...input(),attempt_id:'current',candidate_sha256:'current',...(mode==='source-changed'?{request:request+' changed'}:{}),...(mode==='malformed'?{draft:null}:{})};
      const pre={hook_event_name:'PreToolUse',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_prepare',tool_use_id:'facts-first-call',tool_input:args},result=event(pre);
      if(['source-changed','malformed'].includes(mode)){
        assert.equal(result.hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
        assert.equal(event({...pre,tool_input:{...input(),attempt_id:'current',candidate_sha256:'current'}}).hookSpecificOutput.permissionDecision,'deny');continue;
      }
      const bound=result.hookSpecificOutput.updatedInput;assert.equal(bound.request,request);assert.equal(Object.hasOwn(bound,'draft'),false);
      const response=connection('claude')('tools/call',{name:'explanation_prepare',arguments:bound});assert.equal(response.isError,undefined);
      const post=event({...pre,hook_event_name:'PostToolUse',tool_input:mode==='post-changed'?{...bound,request:request+' '}:bound,tool_response:response});
      if(mode==='post-changed'){assert.match(post.systemMessage,/could not record/);assert.equal(read().status,'unavailable');}
      else{assert.deepEqual(post,{});assert.equal(read().attempt.verification.preparation,'request_facts');assert.equal(read().attempt.verification.draft_sha256,null);
        assert.equal(read().attempt.status,'pending');assert.equal(a.checkedAttempt(read().attempt).status,'pending');assert.doesNotMatch(canonical(read()),/Miro|stores an integer|erases/);}
    }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
  }
});
