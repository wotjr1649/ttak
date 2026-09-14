'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{collector}=require('./release/normal-events.cjs');
const {collectClaude}=require('./release/normal-events.cjs');
test('Claude collection separates visible parent and child blocks without copying hidden or image payloads',()=>{
  const rows=[{type:'assistant',session_id:'session',parent_tool_use_id:null,message:{id:'parent',model:'haiku',usage:{input_tokens:2,output_tokens:3},content:[
    {type:'thinking',thinking:'HIDDEN_SENTINEL'},{type:'image',source:{data:'IMAGE_SENTINEL'}},{type:'text',text:'Visible answer'}]}},
    {type:'assistant',session_id:'session',parent_tool_use_id:'agent',message:{id:'child',model:'haiku',content:[{type:'text',text:'Receipt'}]}},
    {type:'result',subtype:'success',is_error:false,result:'Visible answer',session_id:'session',errors:[],permission_denials:[]}];
  const report=collectClaude(rows.map(JSON.stringify).join('\n')+'\n');
  assert.deepEqual(report.messages.map(m=>[m.text,m.parent_tool_use_id]),[['Visible answer',null],['Receipt','agent']]);
  assert.equal(report.results[0].is_error,false);assert.equal(report.results[0].error_count,0);
  assert.doesNotMatch(JSON.stringify(report),/HIDDEN_SENTINEL|IMAGE_SENTINEL/);
});
test('a truncated Claude tail remains incomplete while malformed complete records fail',()=>{
  const row=JSON.stringify({type:'result',subtype:'error_max_turns',is_error:true,result:'Earlier text',session_id:'session'});
  const partial=collectClaude(row+'\n{"type":');assert.equal(partial.incomplete_tail,true);assert.equal(partial.results[0].is_error,true);
  assert.throws(()=>collectClaude(row+'\n{"type":\n'));
  assert.throws(()=>collectClaude('not-json\n'+row+'\n'));
});
function fixture(){
  const report={session:'root',messages:[],child_messages:[],hooks:[],tool_items:[],function_items:[],agent_items:[],turns:[],child_turns:[],usage:[],child_usage:[]};
  const state={resolved:0,errors:[]},installed=path.resolve('fixture');
  const observe=collector({report,installed,parentLimit:2,agentLimit:2,checkpoint:()=>{},resolve:()=>state.resolved++,reject:code=>state.errors.push(code)});
  const event=(method,threadId,params={})=>observe({method,params:{threadId,...params}});
  const hook=(threadId,entries,status='completed')=>event('hook/completed',threadId,{run:{source:'plugin',sourcePath:path.join(installed,'hooks/hooks.json'),eventName:'stop',entries,status}});
  return {report,state,event,hook,observe};
}
test('verifier return selection omits only an empty commentary item and preserves every potentially invalid return',()=>{
  const {verifierReturnMessages}=require('./release/normal-events.cjs'),items=[
    {thread_id:'child',phase:'commentary',text:''},
    {thread_id:'child',phase:'commentary',text:'Not a JSON result'},
    {thread_id:'child',phase:'final_answer',text:''},
    {thread_id:'child',phase:null,text:''},
    {thread_id:'child',phase:'final_answer',text:'Actual JSON'},
    {thread_id:'other',phase:'final_answer',text:'Unrelated'}
  ];
  assert.deepEqual(verifierReturnMessages({child_messages:items},'child'),items.slice(1,5));
  assert.equal(items.length,6);
});
test('child final and completion are recorded without completing or contaminating the parent',()=>{
  const {report,state,event}=fixture();event('turn/started','root',{turn:{id:'p'}});event('turn/started','child',{turn:{id:'c'}});
  event('item/completed','child',{item:{type:'agentMessage',id:'cm',text:'Child result',phase:'final_answer'}});
  event('turn/completed','child',{turn:{id:'c',status:'completed'}});
  assert.equal(state.resolved,0);assert.equal(report.messages.length,0);assert.equal(report.turns.length,0);assert.equal(report.child_turns.length,1);
  event('item/completed','root',{item:{type:'agentMessage',id:'pm',text:'Parent result',phase:'final_answer'}});
  event('turn/completed','root',{turn:{id:'p',status:'completed'}});assert.equal(state.resolved,1);assert.equal(report.messages[0].thread_id,'root');
});
test('child hooks cannot clear parent continuation and child turns cannot exhaust the parent limit',()=>{
  const {state,event,hook}=fixture();event('turn/started','root',{turn:{id:'p'}});hook('root',[{kind:'feedback',text:'Parent correction'}]);
  for(let i=0;i<4;i++){event('turn/started','child',{turn:{id:'c'+i}});hook('child',[]);event('turn/completed','child',{turn:{id:'c'+i,status:'completed'}});}
  event('turn/completed','root',{turn:{id:'p',status:'completed'}});assert.equal(state.resolved,0);assert.deepEqual(state.errors,[]);
  event('turn/started','root',{turn:{id:'p2'}});hook('root',[]);event('turn/completed','root',{turn:{id:'p2',status:'completed'}});assert.equal(state.resolved,1);
});
test('unscoped lifecycle events and a failed root never become success',()=>{
  const {state,event,observe}=fixture();observe({method:'turn/completed',params:{turn:{status:'completed'}}});
  event('turn/completed','root',{turn:{id:'p',status:'interrupted'}});assert.equal(state.resolved,0);
  assert.deepEqual(state.errors,['missing_event_thread','turn_not_completed']);
});
test('usage is thread-scoped and hidden reasoning items are never copied',()=>{
  const {report,event}=fixture();event('thread/tokenUsage/updated','root',{tokenUsage:{total:{totalTokens:10}}});
  event('thread/tokenUsage/updated','child',{tokenUsage:{total:{totalTokens:20}}});
  event('item/completed','child',{item:{type:'reasoning',text:'HIDDEN_SYNTHETIC'}});
  assert.equal(report.usage[0].total.totalTokens,10);assert.equal(report.child_usage[0].thread_id,'child');assert.doesNotMatch(JSON.stringify(report),/HIDDEN_SYNTHETIC/);
});
test('the candidate assessment and notice calls are recorded while unknown tools and other servers remain rejected',()=>{
  const {report,state,event}=fixture();
  for(const tool of ['explanation_final_preview','explanation_result','explanation_assess_request','explanation_notice_from_assessment','explanation_repair_notice','explanation_notice_result','explanation_assessment_result'])
    event('item/completed',tool.endsWith('_result')?'child':'root',{item:{id:tool,type:'mcpToolCall',server:'ttak_scenario',tool,status:'completed',arguments:{},result:{}}});
  assert.deepEqual(state.errors,[]);assert.equal(report.tool_items.length,7);
  assert.equal(report.tool_items.find(item=>item.tool==='explanation_assessment_result').thread_id,'child');
  for(const item of [{server:'ttak_scenario',tool:'execute_arbitrary'},{server:'other_server',tool:'explanation_notice_from_assessment'}])
    event('item/completed','root',{item:{...item,type:'mcpToolCall'}});
  assert.deepEqual(state.errors,['unexpected_tool','unexpected_tool']);
});
test('only verified timeout cleanup permits an explicitly incomplete checkpoint report',()=>{
  const {collectReport}=require('./release/normal-events.cjs'),report={session:'root',messages:[],hooks:[]};let reads=0;
  const read=()=>{reads++;return JSON.stringify(report);},processResult={status:'timeout',cleanupVerified:true,activeProcesses:0};
  const recovered=collectReport('',processResult,read);assert.equal(reads,1);assert.equal(recovered.collection.complete,false);
  assert.equal(recovered.collection.source,'checkpoint_after_timeout');assert.equal(recovered.collection.unreported_inflight_usage_possible,true);
  const complete=collectReport(JSON.stringify(report),{status:'exited'},read);assert.equal(complete.collection.complete,true);assert.equal(reads,1);
  for(const altered of [{status:'exited'},{cleanupVerified:false},{activeProcesses:1}])
    assert.throws(()=>collectReport('',{...processResult,...altered},read),/missing_report/);
  assert.equal(reads,1);assert.throws(()=>collectReport('malformed',processResult,read));assert.equal(reads,1);
  assert.throws(()=>collectReport('',processResult,()=>JSON.stringify({})),/invalid_checkpoint/);
});
test('baseline collection rejects candidate tools and every unexpected hook',()=>{
  const errors=[],report={session:'root',tool_items:[],hooks:[]};
  const observe=collector({report,installed:null,parentLimit:2,agentLimit:0,checkpoint:()=>{},resolve:()=>{},reject:code=>errors.push(code)});
  observe({method:'item/completed',params:{threadId:'root',item:{type:'mcpToolCall',server:'ttak_scenario',tool:'explanation_prepare'}}});
  observe({method:'hook/completed',params:{threadId:'root',run:{source:'plugin',sourcePath:path.resolve('fixture/hooks/hooks.json')}}});
  assert.deepEqual(errors,['unexpected_tool','unexpected_hook']);
  const current=fixture();current.event('hook/completed','root',{run:{source:'plugin',sourcePath:path.resolve('other/hooks/hooks.json')}});
  assert.deepEqual(current.state.errors,['unexpected_hook']);
});
