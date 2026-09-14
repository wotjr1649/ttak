'use strict';
// Synthetic host receipts exercise the real hook state machine, not model accuracy or native delivery.
const assert=require('node:assert/strict');
const a=require('../../scripts/explanation-attempt.cjs'),v=require('../../scripts/explanation-verification.cjs');
const {handleEvent}=require('../../hooks/scenario-evidence.cjs');
const {canonical}=require('../../scripts/verification-packet.cjs');
function reviewNotice(args,input,options,overrides={}){
  const packet=a.propose(args).review.packet,id='notice-'+args.revision,agent='child-'+id;
  const pre=input('PreToolUse',{tool_name:'spawn_agent',tool_use_id:id,tool_input:{message:packet.prompt,
    model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}});
  assert.deepEqual(handleEvent(pre,options),{});
  assert.deepEqual(handleEvent({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:agent}},options),{});
  const start=handleEvent(input('SubagentStart',{agent_id:agent,agent_type:'default',model:'gpt-5.6-luna'}),options);
  assert.match(start.hookSpecificOutput.additionalContext,/fresh TTAK verifier/);
  const resultArgs={challenge:packet.challenge,notice_decision:'approve_notice',requirement_review:'The withholding notice identifies the missing measurement.',
    evidence_review:'Comparable workload measurements can establish the requested relative slowdown.',
    assessment_review:'The notice includes any requested settled assessments.',checked_questions:[v.assessmentId],issues:[],...overrides};
  const payload=v.resultSubmission(resultArgs,'notice'),child={agent_id:agent,turn_id:'turn-'+agent,tool_use_id:'submit-'+id,
    tool_name:'mcp__ttak_scenario__explanation_notice_result',tool_input:resultArgs};
  assert.deepEqual(handleEvent(input('PreToolUse',child),options),{});
  assert.deepEqual(handleEvent(input('PostToolUse',{...child,tool_response:{structuredContent:payload,content:[{type:'text',text:canonical(payload)}]}}),options),{});
  assert.deepEqual(handleEvent(input('SubagentStop',{agent_id:agent,turn_id:child.turn_id,last_assistant_message:payload.final_text}),options),{});
  return payload.result;
}
module.exports={reviewNotice};
