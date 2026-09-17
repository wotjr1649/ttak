'use strict';
// Synthetic native transport around the real MCP compiler, for recipe wiring only.
const assert=require('node:assert/strict'),v=require('../../scripts/explanation-verification.cjs');
const {reviewChecks}=require('./final-review.cjs');
function recipeTransport(invoke,initial,{mode='complete'}={}){
  let held=structuredClone({...initial,previous:initial.previous??initial.facts.at(-1)}),packet,reply,closed=false;const steps=[],printed=[],registration={},child={agent_id:'synthetic-final-child'};
  const register=name=>async args=>{
      steps.push('register');registration.input=structuredClone(args);
      if(mode==='register-throw')throw new Error('Registration failed');
      const result=invoke(name,mode==='register-rejected'?{...args,candidate_sha256:'f'.repeat(64)}:args);registration.response=result;
      if(!result.isError)packet=(v.usesFinalReferences(args)?v.finalizeReferences(args,result.structuredContent.source_facts).payload:v.finalize(args)).packet;return result;
    };
  const tools={
    mcp__ttak_scenario__explanation_check_final:register('explanation_check_final'),
    mcp__ttak_scenario__explanation_revise_final:register('explanation_revise_final'),
    mcp__ttak_scenario__explanation_dispatch:async args=>{
      steps.push('dispatch');assert.ok(packet);assert.deepEqual(args,{attempt_id:'current',candidate_sha256:'current',challenge:'current'});
      return invoke('explanation_dispatch',{attempt_id:held.attempt_id,candidate_sha256:held.candidate_sha256,challenge:packet.challenge});
    },
    multi_agent_v1__spawn_agent:async args=>{
      steps.push('spawn');assert.deepEqual(args,{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false});return child;
    },
    multi_agent_v1__wait_agent:async args=>{
      steps.push('wait');assert.deepEqual(args,{targets:[child.agent_id],timeout_ms:60000});
      if(mode==='wait-throw')throw new Error('Wait failed');
      if(mode==='wait-timeout'){if(steps.filter(s=>s==='wait').length>1)throw new Error('Outer execution budget exhausted');return {timed_out:true,status:{}};}
      if(mode==='wait-once'&&steps.filter(s=>s==='wait').length===1)return {timed_out:true,status:{}};
      const groups=reviewChecks(),issues=mode==='withheld'?[{quote:'Synthetic proposed claim',reason:'A concrete contradiction for transport testing.',evidence_needed:'A corrected proposal.'}]:[];
      if(issues.length)groups.claim_review.conditions_outcomes=[0];
      const submitted={challenge:packet.challenge,final_decision:issues.length?'revise_explanation':'approve_explanation',...Object.assign({},...Object.values(groups)),checked_questions:['REQUEST_FACTS'],issues};
      reply=invoke('explanation_final_result',submitted).structuredContent;assert.ok(reply);return {timed_out:false,status:{[child.agent_id]:{completed:mode==='legacy-return'?reply.final_text:reply.receipt_text}}};
    },
    multi_agent_v1__close_agent:async args=>{steps.push('close');assert.deepEqual(args,{target:child.agent_id});closed=true;if(mode==='close-throw')throw new Error('Close failed');return {};},
    mcp__ttak_scenario__explanation_result:async args=>{
      steps.push('read');assert.equal(closed,true);assert.equal(args.challenge,packet.challenge);
      assert.equal(args.receipt_text,reply.receipt_text);
      assert.equal(args.include_next_step,true);
      const result=invoke('explanation_result',{...args,result:reply.result});assert.equal(result.isError,undefined);
      if(mode==='read-mismatch')result.structuredContent.result_sha256='e'.repeat(64);
      if(mode==='wrong-result-challenge')result.structuredContent.result.challenge='e'.repeat(64);
      if(mode==='wrong-result-kind')result.structuredContent.result.kind='fact';
      if(mode==='wrong-delivery-text')result.structuredContent.delivery.final_text='Unreviewed body.';
      if(mode==='wrong-delivery-scope')result.structuredContent.delivery.scope='withholding_notice';
      if(mode==='missing-delivery')delete result.structuredContent.delivery;
      if(mode==='missing-next')delete result.structuredContent.next_step;return result;
    }
  };
  return {tools,steps,printed,registration,get held(){return structuredClone(held);},
    load:key=>{assert.equal(key,'ttak-verification');return structuredClone(held);},
    store:(key,value)=>{assert.equal(key,'ttak-verification');steps.push('store');held=structuredClone(value);},
    text:value=>{steps.push('print');printed.push(value);}};
}
module.exports={recipeTransport};
