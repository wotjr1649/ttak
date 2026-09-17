'use strict';
// The public v2 item stream omits code-mode custom calls. Read the completed
// native turn ledger locally, retaining visible call inputs and usage only.
const path=require('node:path'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {findTranscript}=require('../../scripts/review-native.cjs');
const {possibleSecret}=require('../../scripts/review-native-format.cjs');
const sha=text=>createHash('sha256').update(text).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
function visibleOutput(value){
 if(typeof value==='string')return value;
 if(!Array.isArray(value)||value.some(block=>!['text','input_text'].includes(block?.type)||typeof block.text!=='string'))throw new Error('native_history_output_type');
 return value.map(block=>block.text).join('\n');
}
function collectHistory(events,session,turnIds){
 if(!uuid(session)||!Array.isArray(turnIds)||!turnIds.length||turnIds.some(id=>!uuid(id))||new Set(turnIds).size!==turnIds.length)throw new Error('native_history_scope');
 const selected=new Set(turnIds),contexts=new Map(),calls=[],outputs=[],usage=[],responses=new Set();let current=null;
 for(const event of events){
  if(event.type==='turn_context'){
   current=event.payload?.turn_id;
   if(selected.has(current)){
    if(event.payload.model!=='gpt-5.6-luna'||event.payload.effort!=='high')throw new Error('native_history_model');
    const settings={turn_id:current,model:event.payload.model,effort:event.payload.effort,multi_agent_version:event.payload.multi_agent_version??null};
    if(contexts.has(current)&&JSON.stringify(contexts.get(current))!==JSON.stringify(settings))throw new Error('native_history_settings_changed');
    contexts.set(current,settings);
   }
  }
  if(event.type==='token_usage_record'&&selected.has(event.payload?.turn_id)){
   const p=event.payload,u=p.usage;
   if(p.thread_id!==session||responses.has(p.response_id)||!u||!['input_tokens','output_tokens','total_tokens','reasoning_output_tokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0)||u.total_tokens!==u.input_tokens+u.output_tokens)throw new Error('native_history_usage');
   responses.add(p.response_id);usage.push({turn_id:p.turn_id,response_id:p.response_id,input:u.input_tokens,output:u.output_tokens,total:u.total_tokens,thinking:u.reasoning_output_tokens});
  }
  if(event.type!=='response_item')continue;
  const item=event.payload,turn=item?.internal_chat_message_metadata_passthrough?.turn_id??current;
  if(!selected.has(turn))continue;
  if(['custom_tool_call','function_call'].includes(item.type)){
   const input=item.type==='custom_tool_call'?item.input:item.arguments;
   if(typeof item.call_id!=='string'||typeof item.name!=='string'||typeof input!=='string'||possibleSecret(input))throw new Error('native_history_call_withheld');
   calls.push({turn_id:turn,type:item.type,call_id:item.call_id,name:item.name,input,input_sha256:sha(input)});
  }else if(['custom_tool_call_output','function_call_output'].includes(item.type)){
   const text=visibleOutput(item.output);
   if(typeof item.call_id!=='string'||possibleSecret(text))throw new Error('native_history_output_withheld');
   outputs.push({turn_id:turn,type:item.type,call_id:item.call_id,output_sha256:sha(text),output_bytes:Buffer.byteLength(text)});
  }else if(/(?:tool|function|shell|search|generation).*call/.test(item.type??''))throw new Error('native_history_unexpected_call');
 }
 if([...selected].some(id=>!contexts.has(id)))throw new Error('native_history_missing_turn');
 const ids=calls.map(call=>call.call_id);
 if(new Set(ids).size!==ids.length||outputs.length!==calls.length||outputs.some(out=>ids.filter(id=>id===out.call_id).length!==1)||new Set(outputs.map(out=>out.call_id)).size!==outputs.length)throw new Error('native_history_unpaired_call');
 return {source:'completed_native_turn_ledger',session,turn_ids:turnIds,contexts:[...contexts.values()],calls,outputs,usage,
   aggregate:usage.reduce((sum,row)=>{sum.responses++;for(const key of ['input','output','total','thinking'])sum[key]+=row[key];return sum;},{responses:0,input:0,output:0,total:0,thinking:0}),hidden_content_retained:false};
}
function nativeHistory(profile,session,turnIds){
 const expected=path.resolve(__dirname,'../../.superpowers/release-run-03/profiles/codex-ttak');
 if(profile!==expected||fs.realpathSync(profile)!==profile)throw new Error('native_history_profile');
 const events=findTranscript(profile,'codex',session).trim().split(/\r?\n/).map(JSON.parse);
 const result=collectHistory(events,session,turnIds);
 if(Buffer.byteLength(JSON.stringify(result))>524288)throw new Error('native_history_limit');
 return result;
}
module.exports={collectHistory,nativeHistory};
