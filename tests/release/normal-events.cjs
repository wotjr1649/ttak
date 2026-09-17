'use strict';
const path=require('node:path');
const methods=new Set(['turn/started','turn/completed','item/completed','hook/completed','thread/tokenUsage/updated']);
function collector({report,installed,parentLimit,agentLimit,checkpoint,resolve,reject}){
  let continuation=false,turns=0;
  return r=>{
    if(r.method==='error'){reject('native_error');return;}
    if(!methods.has(r.method))return;
    const thread=r.params?.threadId;if(typeof thread!=='string'||!thread){reject('missing_event_thread');return;}
    const parent=thread===report.session,p=r.params;
    if(r.method==='turn/started'){
      if(parent){continuation=false;if(++turns>parentLimit)reject('turn_limit');}
    }else if(r.method==='item/completed'){
      const item=p.item;
      if(item.type==='agentMessage'){
        (parent?report.messages:report.child_messages).push({id:item.id,thread_id:thread,text:item.text,phase:item.phase??null});
      }else if(item.type==='mcpToolCall'){
        if(!installed||item.server!=='ttak_scenario'||!['scenario_review','explanation_final_preview','explanation_result','explanation_assess_request','explanation_notice_from_assessment','explanation_decide','explanation_repair_notice','explanation_prepare','explanation_next','explanation_check_final','explanation_revise_final','explanation_packet','explanation_dispatch','explanation_fact_result','explanation_final_result','explanation_notice_result','explanation_assessment_result'].includes(item.tool))reject('unexpected_tool');
        report.tool_items.push({id:item.id,type:item.type,thread_id:thread,server:item.server,tool:item.tool,arguments:item.arguments,status:item.status,result:item.result});
      }else if(item.type==='collabAgentToolCall'){
        report.agent_items.push({...item,thread_id:thread});
        if(!parent||!['spawnAgent','wait','closeAgent','listAgents'].includes(item.tool))reject('unexpected_agent_action');
        if(report.agent_items.filter(i=>i.tool==='spawnAgent').length>agentLimit)reject('internal_verifier_limit');
      }else if(item.type==='functionCallOutput'){
        report.function_items.push({id:item.id,name:item.name,namespace:item.namespace??null,thread_id:thread});
        if(!['exec','spawn_agent','wait_agent','close_agent','list_agents','multi_agent_v1__spawn_agent','multi_agent_v1__wait_agent','multi_agent_v1__close_agent','multi_agent_v1__list_agents'].includes(item.name))reject('unexpected_function_output');
      }else if(!['reasoning','userMessage','hookPrompt'].includes(item.type))reject('unexpected_item');
    }else if(r.method==='hook/completed'){
      const run=p.run;
      if(installed&&run.source==='plugin'&&path.resolve(run.sourcePath)===path.join(installed,'hooks/hooks.json')){
        report.hooks.push({...run,thread_id:thread,turn_id:p.turnId??null});
        if(parent&&run.eventName==='stop')continuation=run.entries.some(e=>e.kind==='feedback')&&run.status!=='stopped';
      }else reject('unexpected_hook');
    }else if(r.method==='thread/tokenUsage/updated'){
      if(parent)report.usage.push(p.tokenUsage);else report.child_usage.push({thread_id:thread,usage:p.tokenUsage});
    }else if(r.method==='turn/completed'){
      (parent?report.turns:report.child_turns).push({thread_id:thread,id:p.turn.id,status:p.turn.status});
      if(parent){if(p.turn.status!=='completed')reject('turn_not_completed');else if(!continuation)resolve();}
    }
    checkpoint();
  };
}
function collectReport(stdout,processResult,readCheckpoint){
  if(stdout.trim())return {...JSON.parse(stdout),collection:{source:'emitted_report',complete:true}};
  if(processResult.status!=='timeout'||!processResult.cleanupVerified||processResult.activeProcesses!==0)
    throw new Error('missing_report_without_verified_timeout');
  const report=JSON.parse(readCheckpoint());
  if(typeof report.session!=='string'||!Array.isArray(report.messages)||!Array.isArray(report.hooks))throw new Error('invalid_checkpoint');
  return {...report,collection:{source:'checkpoint_after_timeout',complete:false,unreported_inflight_usage_possible:true}};
}
// A host-emitted empty commentary item is not a verifier return. Preserve every
// nonempty item and even empty finals so the auditor still detects bad returns.
const verifierReturnMessages=(report,id)=>report.child_messages.filter(m=>m.thread_id===id&&!(m.phase==='commentary'&&m.text===''));
function collectClaude(raw){
  const report={messages:[],tools:[],tool_results:[],results:[],hooks:[],models:[],sessions:[],usage:[],system:[],incomplete_tail:false};
  const lines=raw.split(/\r?\n/).filter(Boolean);
  for(let index=0;index<lines.length;index++){
    let r;try{r=JSON.parse(lines[index]);}catch(error){if(index!==lines.length-1||raw.endsWith('\n'))throw error;report.incomplete_tail=true;break;}
    const parent_tool_use_id=r.parent_tool_use_id??null;
    if(r.session_id&&!report.sessions.includes(r.session_id))report.sessions.push(r.session_id);
    if(r.type==='assistant'){
      if(r.message.model&&!report.models.includes(r.message.model))report.models.push(r.message.model);
      for(const b of r.message.content??[]){
        if(b.type==='text')report.messages.push({id:r.message.id,text:b.text,parent_tool_use_id});
        if(b.type==='tool_use')report.tools.push({id:b.id,name:b.name,input:b.input,parent_tool_use_id});
      }
      if(r.message.usage)report.usage.push({id:r.message.id,usage:r.message.usage,parent_tool_use_id});
    }else if(r.type==='user'){
      for(const b of r.message?.content??[])if(b.type==='tool_result')report.tool_results.push({id:b.tool_use_id,is_error:b.is_error??false,
        content:typeof b.content==='string'?b.content:(b.content??[]).filter(c=>c.type==='text').map(c=>({type:'text',text:c.text})),parent_tool_use_id});
    }else if(r.type==='result')report.results.push({subtype:r.subtype,is_error:r.is_error,result:r.result??null,
      session_id:r.session_id,usage:r.usage,modelUsage:r.modelUsage,num_turns:r.num_turns,error_count:r.errors?.length??0,permission_denials_count:r.permission_denials?.length??0});
    else if(r.type==='system'){
      if(/^hook_/.test(r.subtype??''))report.hooks.push({subtype:r.subtype,hook_id:r.hook_id,hook_name:r.hook_name,
        hook_event:r.hook_event,stdout:r.stdout,stderr:r.stderr,exit_code:r.exit_code,outcome:r.outcome});
      else report.system.push({subtype:r.subtype,model:r.model,tools:r.tools,plugins:r.plugins});
    }
  }
  return report;
}

module.exports={collector,collectReport,verifierReturnMessages,collectClaude};
