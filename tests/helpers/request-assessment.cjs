'use strict';
// Synthetic native lifecycle fixtures exercise binding, not model accuracy or real host delivery.
const assert=require('node:assert/strict'),v=require('../../scripts/explanation-verification.cjs');
const {handleEvent}=require('../../hooks/scenario-evidence.cjs');
function assessmentResult(args){
  const packet=v.prepareAssessment(args).packets[0];
  return v.resultSubmission({challenge:packet.challenge,assessment_decision:'assessed',
    gap_review:'Synthetic assessment fixture; semantic accuracy is not claimed.',essential_gaps:[],corrections:[],issues:[]},'assessment').result;
}
function assessmentSubmission(result){
  assert.equal(result.kind,'fact');assert.deepEqual(result.checked_questions,[]);
  return {challenge:result.challenge,assessment_decision:result.verdict==='answered'?'assessed':'assessment_failed',...JSON.parse(result.answer),issues:result.issues};
}
function assessRequest(args,input,options,dispatch,{host='codex',childDispatch=dispatch,result=assessmentResult(args)}={}){
  const prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__';let next=100;
  const invoke=(name,value,extra={})=>{
    const event=input('PreToolUse',{tool_name:prefix+name,tool_use_id:'assessment-tool-'+next,tool_input:value,...extra});
    assert.deepEqual(handleEvent(event,options),{});
    const response=(extra.agent_id?childDispatch:dispatch)({jsonrpc:'2.0',id:next++,method:'tools/call',params:{name,arguments:value}}).result;
    assert.equal(response.isError,undefined);assert.deepEqual(handleEvent({...event,hook_event_name:'PostToolUse',tool_response:response},options),{});
    return response.structuredContent;
  };
  const prepared=invoke('explanation_assess_request',args),plan=v.prepareAssessment(args),packet=plan.packets[0],agent='request-assessment-child';
  assert.deepEqual(prepared,v.exposePlan(plan,host));
  const pre=input('PreToolUse',{tool_name:host==='claude'?'Agent':'spawn_agent',tool_use_id:'request-assessment-spawn',tool_input:host==='claude'
    ?prepared.native_dispatch.Agent:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}});
  assert.deepEqual(handleEvent(pre,options),{});
  const post={...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:agent}};
  if(host==='codex')assert.deepEqual(handleEvent(post,options),{});
  const child={agent_id:agent,turn_id:'request-assessment-turn'};
  const started=handleEvent(input('SubagentStart',{...child,agent_type:host==='claude'?v.agentType:'default',
    model:host==='claude'?'claude-haiku-4-5-20251001':'gpt-5.6-luna'}),options);
  assert.equal(started.hookSpecificOutput.hookEventName,'SubagentStart');
  if(host==='claude')assert.deepEqual(invoke('explanation_packet',{challenge:packet.challenge},child),v.packetBody(packet));
  const expected=result,submitted=assessmentSubmission(expected);
  const payload=invoke('explanation_assessment_result',submitted,child);assert.deepEqual(payload.result,expected);
  assert.deepEqual(handleEvent(input('SubagentStop',{...child,last_assistant_message:payload.final_text}),options),{});
  if(host==='claude')assert.deepEqual(handleEvent(post,options),{});
  return payload.result;
}
module.exports={assessmentResult,assessmentSubmission,assessRequest};
