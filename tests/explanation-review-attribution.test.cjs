'use strict';
// Native-file selection over synthetic pinned records; no model or filesystem writes.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{selectSubmittedResult}=require('../scripts/explanation-result-source.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs'),{digest,textDigest,canonical}=require('../scripts/verification-packet.cjs');
const parent='11111111-1111-4111-8111-111111111111',child='22222222-2222-4222-8222-222222222222',turn='33333333-3333-4333-8333-333333333333',cwd=process.cwd();
const good='Both reads return7 and the stored value remains7.',bad='The first read changes the stored value to0, which remains0 after the second read.';
function fixture(host,config={}){
  const request='Explain the fictional Nori register in two sentences. It starts at7 and reading does not change it. Derive both read values and the final value.';
  const binding={attempt_id:parent,candidate_sha256:'b'.repeat(64)},plan=v.prepare({...binding,request});
  const fact=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:config.fact??good,issues:[]},'fact').result;
  const final=v.finalize({...binding,request,facts:[{id:'REQUEST_FACTS',result:fact}],final_text:config.final??bad,revision:0});
  const checks=reviewChecks();for(const [group,fields]of Object.entries(config.links??{claim_review:['conditions_outcomes']}))for(const field of fields)checks[group][field]=[0];
  let args={challenge:final.packet.challenge,final_decision:'revise_explanation',...checks,checked_questions:['REQUEST_FACTS'],
    issues:[{quote:config.quote??bad,reason:'The supplied read definition preserves the stored value.',evidence_needed:'Keep the result scoped to its actual source.'}]};
  if(config.scoped){const {requirement_review,claim_review,fact_review,...rest}=args;
    args={...rest,...requirement_review,...claim_review,...Object.fromEntries(Object.entries(fact_review).map(([key,value])=>['fact_'+key,value])),fact_issues:config.copyFactIssue?args.issues:[]};}
  const payload=v.finalReviewSubmission(args),call='result-call',get='packet-call',agent=host==='codex'?child:'a222233334444555';
  const slot={...v.slot(final.packet),agent_id:agent,phase:'referenced',delivery:host==='codex'?'native':'mcp',submitted:true,spawn_confirmed:true,retrieved:true,
    retrieval_sha256:textDigest(get),child_turn_sha256:host==='codex'?textDigest(turn):null,submission_call_sha256:textDigest(call),
    submission_sha256:digest(payload.result),reply_sha256:digest(payload.result),verdict:null};
  const input={session_id:parent,cwd},pinned={isSidechain:true,agentId:agent,sessionId:parent,version:'2.1.266',cwd};
  const rows=host==='codex'?[
    {type:'session_meta',payload:{id:agent,session_id:parent,parent_thread_id:parent,cli_version:'0.154.0',cwd}},
    {type:'turn_context',payload:{turn_id:turn,model:'gpt-5.6-luna',effort:'high'}},
    {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:final.packet.prompt}]}},
    {type:'event_msg',payload:{type:'item_completed',thread_id:agent,turn_id:turn,item:{type:'McpToolCall',id:call,server:'ttak_scenario',tool:'explanation_final_result',status:'completed',readOnlyHint:true,
      arguments:args,result:{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload}}}}
  ]:[
    {type:'assistant',uuid:'get-row',...pinned,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:get,name:'mcp__plugin_ttak_ttak_scenario__explanation_packet',input:{challenge:final.packet.challenge}}]}},
    {type:'user',sourceToolAssistantUUID:'get-row',...pinned,message:{role:'user',content:[{type:'tool_result',tool_use_id:get,content:JSON.stringify(v.packetBody(final.packet))}]}},
    {type:'assistant',uuid:'result-row',...pinned,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:call,name:'mcp__plugin_ttak_ttak_scenario__explanation_final_result',input:args}]}},
    {type:'user',sourceToolAssistantUUID:'result-row',...pinned,message:{role:'user',content:[{type:'tool_result',tool_use_id:call,content:JSON.stringify(payload)}]}}
  ];
  const raw=()=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
  return {rows,input,slot,payload,final,read:()=>selectSubmittedResult(raw(),input,slot,host,'final')};
}
for(const host of ['claude','codex']){
  test(host+' rejects176 final-only quote assigned to otherwise correct fact checks',()=>{
    const f=fixture(host,{links:{claim_review:['conditions_outcomes'],fact_review:['source_support','computed_outcomes','internal_consistency']}});
    assert.throws(f.read,/native_submitted_result_unavailable/);
  });
  test(host+' accepts verbatim final, fact, shared and original requirement targets without repairing evidence',()=>{
    const cases=[{}, {final:good,fact:bad,links:{fact_review:['computed_outcomes']}}, {fact:bad,links:{claim_review:['conditions_outcomes'],fact_review:['internal_consistency']}},
      {quote:'in two sentences',links:{requirement_review:['reader_format']}}, {links:{requirement_review:['essential_requirements']}}];
    for(const config of cases){const f=fixture(host,config),before=canonical(f.payload);assert.deepEqual(f.read(),f.payload.result);assert.equal(canonical(f.payload),before);}
  });
  test(host+' rejects every cross-target link, missing quote and whitespace-repaired quote',()=>{
    for(const config of [
      {links:{fact_review:['source_support']}},{links:{fact_review:['computed_outcomes']}},{links:{fact_review:['internal_consistency']}},
      {final:good,fact:bad,links:{claim_review:['actors_targets']}},{final:good,fact:bad,links:{requirement_review:['essential_requirements']}},
      {quote:'in two sentences',links:{claim_review:['conditions_outcomes']}},{quote:bad.replace('value to0','value to 0')},
      {quote:'A phrase absent from all three sources.'},{quote:'7 and',fact:'7\nand',links:{fact_review:['source_support']}}
    ])assert.throws(fixture(host,config).read,/native_submitted_result_unavailable/);
  });
  test(host+' requires the exact observed packet, not another user message or unpaired tool output',()=>{
    for(const mode of ['missing','duplicate','changed','wrong-source','wrong-hash']){
      const f=fixture(host);
      if(mode==='wrong-hash')f.slot.prompt_sha256='c'.repeat(64);
      else if(host==='codex'){
        if(mode==='missing')f.rows.splice(2,1);
        if(mode==='duplicate')f.rows.push(structuredClone(f.rows[2]));
        if(mode==='changed')f.rows[2].payload.content[0].text+=' ';
        if(mode==='wrong-source')f.rows[2].payload.role='assistant';
      }else{
        if(mode==='missing')f.rows.splice(0,2);
        if(mode==='duplicate')f.rows.push(structuredClone(f.rows[1]));
        if(mode==='changed'){const body=JSON.parse(f.rows[1].message.content[0].content);body.prompt+=' ';f.rows[1].message.content[0].content=JSON.stringify(body);}
        if(mode==='wrong-source')f.rows[1].sourceToolAssistantUUID='unrelated';
      }
      assert.throws(f.read,/native_submitted_result_unavailable/);
    }
  });
  test(host+' preserves literal Unicode, line breaks, quotes and backslashes without interpreting them',()=>{
    const text='가정 "x"의 값은7입니다.\nLiteral C:\\data\\value is unchanged; é is a label.';
    const f=fixture(host,{fact:text,quote:text,links:{fact_review:['source_support']}});
    assert.deepEqual(f.read(),f.payload.result);
    assert.throws(fixture(host,{fact:text,quote:text.replace('é','e\u0301'),links:{fact_review:['source_support']}}).read,/native_submitted_result_unavailable/);
  });
  test(host+' source-specific issue lists still require the actual quote in every linked native source',()=>{
    const valid=fixture(host,{scoped:true});assert.deepEqual(valid.read(),valid.payload.result);
    const wrong=fixture(host,{scoped:true,copyFactIssue:true,links:{claim_review:['conditions_outcomes'],fact_review:['computed_outcomes']}});
    assert.throws(wrong.read,/native_submitted_result_unavailable/);
  });
}
test('Claude packet retrieval requires its pinned identity, tool, result pairing and pre-submission order',()=>{
  for(const change of [
    f=>f.rows[0].agentId='other',f=>f.rows[1].sessionId=child,f=>f.rows[0].message.model='other',
    f=>f.rows[1].version='2.1.269',f=>f.rows[1].cwd=cwd+'x',f=>f.rows[0].isSidechain=false,
    f=>f.rows[0].message.content[0].name='mcp__other__explanation_packet',
    f=>f.rows[0].message.content[0].input.challenge='d'.repeat(64),f=>f.rows[1].message.content[0].is_error=true,
    f=>f.rows[1].message.content[0].tool_use_id='other',f=>f.rows.push(...f.rows.splice(0,2)),
    f=>{const p=JSON.parse(f.rows[1].message.content[0].content);p.prompt_sha256='d'.repeat(64);f.rows[1].message.content[0].content=JSON.stringify(p);}
  ]){const f=fixture('claude');change(f);assert.throws(f.read,/native_submitted_result_unavailable/);}
});
test('Codex packet text after the submission or nested in tool output cannot supply the review target',()=>{
  for(const mode of ['after','tool-output']){
    const f=fixture('codex');if(mode==='after')f.rows.push(...f.rows.splice(2,1));
    else f.rows[2]={type:'response_item',payload:{type:'custom_tool_call_output',output:f.final.packet.prompt}};
    assert.throws(f.read,/native_submitted_result_unavailable/);
  }
});
test('public fact checks name their actual target while legacy flat/grouped results remain exact equivalents',()=>{
  const tool=v.resultTools.find(t=>t.name==='explanation_final_result');
  for(const key of ['source_support','computed_outcomes','internal_consistency']){
    assert.ok(Object.hasOwn(tool.inputSchema.properties,'fact_'+key));assert.equal(Object.hasOwn(tool.inputSchema.properties,key),false);
  }
  const f=fixture('codex'),parsed=JSON.parse(f.payload.result.answer),grouped=Object.fromEntries(Object.entries(parsed).map(([k,s])=>[k,JSON.parse(s)]));
  const base={challenge:f.final.packet.challenge,final_decision:'revise_explanation',checked_questions:['REQUEST_FACTS'],issues:f.payload.result.issues};
  const legacy={...base,...grouped.requirement_review,...grouped.claim_review,...grouped.fact_review};
  const scoped={...base,...grouped.requirement_review,...grouped.claim_review,...Object.fromEntries(Object.entries(grouped.fact_review).map(([k,value])=>['fact_'+k,value]))};
  for(const input of [legacy,scoped,{...base,...grouped}])assert.deepEqual(v.finalReviewSubmission(input),f.payload);
  assert.throws(()=>v.finalReviewSubmission({...scoped,source_support:'pass'}));assert.throws(()=>v.finalReviewSubmission({...legacy,fact_source_support:'pass'}));
});
