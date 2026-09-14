'use strict';
// Select only the already-observed native result. Never execute transcript code,
// copy reasoning or retain a raw transcript. The caller owns the receipt state.
const path=require('node:path');
const v=require('./explanation-verification.cjs');
const {checkedData,exact,list,checkText,checkId,checkDigest,canonical,digest,textDigest}=require('./verification-packet.cjs');
const {readChildSnapshot,MAX_BYTES,MAX_LINES}=require('./explanation-request-source.cjs');
const {checkFactModelSources}=require('./explanation-source-model.cjs');
const {compileReviewChecks}=require('./explanation-review-checks.cjs');
const reject=()=>{throw new Error('native_submitted_result_unavailable');};
const sameCwd=(left,right)=>typeof left==='string'&&path.isAbsolute(left)&&path.resolve(left)===path.resolve(right);
const claudePinned=(row,input,slot)=>row.isSidechain===true&&row.agentId===slot.agent_id&&row.sessionId===input.session_id&&row.version==='2.1.266'&&sameCwd(row.cwd,input.cwd);
function finalReviewPacket(rows,input,slot,host,submissionIndex){
  checkDigest(slot.prompt_sha256);let prompt;
  if(host==='codex'){
    if(slot.delivery!=='native')reject();
    const found=[];
    for(const [index,row]of rows.entries())if(row.type==='response_item'&&row.payload?.type==='message'&&row.payload.role==='user'&&Array.isArray(row.payload.content))
      for(const block of row.payload.content)if(block?.type==='input_text'&&typeof block.text==='string'&&textDigest(block.text)===slot.prompt_sha256)found.push({index,text:block.text});
    if(found.length!==1||found[0].index>=submissionIndex)reject();prompt=found[0].text;
  }else{
    if(slot.delivery!=='mcp')reject();checkDigest(slot.retrieval_sha256);
    const uses=[];
    for(const [index,row]of rows.entries())if(row.type==='assistant'&&Array.isArray(row.message?.content))for(const block of row.message.content)
      if(block?.type==='tool_use'&&typeof block.id==='string'&&textDigest(block.id)===slot.retrieval_sha256)uses.push({row,block,index});
    if(uses.length!==1)reject();const use=uses[0];
    if(!claudePinned(use.row,input,slot)||use.row.message.role!=='assistant'||use.row.message.model!=='claude-haiku-4-5-20251001'||
      use.block.name!=='mcp__plugin_ttak_ttak_scenario__explanation_packet')reject();
    const args=checkedData(use.block.input);exact(args,['challenge']);if(args.challenge!==slot.challenge)reject();
    const replies=[];
    for(const [index,row]of rows.entries())if(row.type==='user'&&Array.isArray(row.message?.content))for(const block of row.message.content)
      if(block?.type==='tool_result'&&block.tool_use_id===use.block.id)replies.push({row,block,index});
    if(replies.length!==1)reject();const reply=replies[0];
    if(!claudePinned(reply.row,input,slot)||reply.row.message.role!=='user'||reply.row.sourceToolAssistantUUID!==use.row.uuid||
      reply.block.is_error||typeof reply.block.content!=='string'||reply.index<=use.index||reply.index>=submissionIndex)reject();
    const payload=checkedData(JSON.parse(reply.block.content));exact(payload,['protocol','challenge','prompt','prompt_sha256']);
    if(payload.protocol!==v.protocol||payload.challenge!==slot.challenge||payload.prompt_sha256!==slot.prompt_sha256)reject();prompt=payload.prompt;
  }
  checkText(prompt,48000);if(textDigest(prompt)!==slot.prompt_sha256)reject();
  const body=checkedData(JSON.parse(prompt.slice(prompt.indexOf('\n')+1)));exact(body,['protocol','challenge','kind','data','submission']);
  if(body.protocol!==v.protocol||body.challenge!==slot.challenge||body.kind!=='final'||body.data?.purpose!==undefined||
    body.submission?.tool!=='explanation_final_result')reject();
  checkText(body.data.request,32000);checkText(body.data.final_text,24000);list(body.data.facts,8);
  for(const fact of body.data.facts){exact(fact,['id','result']);checkId(fact.id);
    if(v.parseAnswer(canonical(fact.result),{kind:'fact',challenge:fact.result.challenge}).verdict!=='answered')reject();}
  return body.data;
}
function checkReviewAttribution(result,data){
  // Verbatim source membership is a necessary boundary, not semantic approval.
  // Check each linked group independently; never concatenate facts or repair quotes.
  const review=checkedData(JSON.parse(result.answer));exact(review,['requirement_review','claim_review','fact_review']);
  const checks=Object.fromEntries(Object.entries(review).map(([group,text])=>[group,checkedData(JSON.parse(text))]));
  compileReviewChecks(checks,result.issues.length);
  const sources={requirement_review:[data.request,data.final_text],claim_review:[data.final_text],fact_review:data.facts.map(f=>f.result.answer)};
  for(const [group,dimensions]of Object.entries(checks))for(const indices of Object.values(dimensions))if(indices!=='pass')
    for(const index of indices)if(!sources[group].some(text=>text.includes(result.issues[index].quote)))reject();
}
function payloadResult(payload,args,kind,slot){
  payload=checkedData(payload);const fields=Object.keys(payload??{}).sort();
  if(canonical(fields)!==canonical(['final_text','result'])&&canonical(fields)!==canonical(['final_text','receipt_text','result']))reject();
  args=checkedData(args);
  // The host can retain the original selector in its native tool-use record.
  // Resolve only an explicitly observed Pre reference after native identity,
  // call, return and receipt checks. Never reconstruct a malformed literal.
  if(args?.challenge==='current'){
    if(slot.submission_reference!==true)reject();
    args={...args,challenge:slot.challenge};
  }
  const expected=v.resultSubmission(args,kind);
  if(kind==='fact')checkFactModelSources(args.answer,slot.source_model_sha256s,slot.source_appendix_sha256s);
  if(canonical(payload.result)!==canonical(expected.result)||payload.final_text!==expected.final_text||
    Object.hasOwn(payload,'receipt_text')&&payload.receipt_text!==expected.receipt_text)reject();
  if(payload.result.challenge!==slot.challenge||payload.result.kind!==slot.kind||digest(payload.result)!==slot.submission_sha256)reject();
  return payload.result;
}
function selectSubmittedResult(raw,input,slot,host,kind){
  try{
    if(!['claude','codex'].includes(host)||!['fact','final','notice','assessment'].includes(kind)||typeof raw!=='string'||
      Buffer.byteLength(raw)>MAX_BYTES||!raw.endsWith('\n')||typeof input?.cwd!=='string'||!path.isAbsolute(input.cwd))reject();
    checkId(input.session_id);checkId(slot.agent_id);checkDigest(slot.challenge);checkDigest(slot.submission_call_sha256);checkDigest(slot.submission_sha256);
    if(slot.phase!=='referenced'||slot.submitted!==true||slot.spawn_confirmed!==true||slot.retrieved!==true||slot.verdict!==null||slot.reply_sha256!==slot.submission_sha256)reject();
    const lines=raw.split('\n');lines.pop();if(!lines.length||lines.length>MAX_LINES)reject();const rows=lines.map(line=>JSON.parse(line));
    if(host==='codex'){
      const headers=rows.filter(r=>r.type==='session_meta'),header=headers[0]?.payload;
      // In0.154.0 a child id names the thread; session_id still names its root.
      if(rows[0].type!=='session_meta'||headers.length!==1||header?.id!==slot.agent_id||header.session_id!==input.session_id||
        header.parent_thread_id!==input.session_id||header.cli_version!=='0.154.0'||!sameCwd(header.cwd,input.cwd))reject();
      checkDigest(slot.child_turn_sha256);
      const contexts=rows.filter(r=>r.type==='turn_context'&&typeof r.payload?.turn_id==='string'&&textDigest(r.payload.turn_id)===slot.child_turn_sha256);
      if(contexts.length!==1||contexts[0].payload.model!=='gpt-5.6-luna'||contexts[0].payload.effort!=='high')reject();
      const calls=rows.filter(r=>r.type==='event_msg'&&r.payload?.type==='item_completed'&&r.payload.item?.type==='McpToolCall'&&
        typeof r.payload.item.id==='string'&&textDigest(r.payload.item.id)===slot.submission_call_sha256);
      if(calls.length!==1)reject();const event=calls[0].payload,item=event.item;
      if(event.thread_id!==slot.agent_id||typeof event.turn_id!=='string'||textDigest(event.turn_id)!==slot.child_turn_sha256||item.server!=='ttak_scenario'||
        item.tool!=='explanation_'+kind+'_result'||item.status!=='completed'||item.readOnlyHint!==true||item.result?.isError||
        !Array.isArray(item.result?.content)||item.result.content.length!==1||item.result.content[0].type!=='text'||typeof item.result.content[0].text!=='string')reject();
      const payload=JSON.parse(item.result.content[0].text);
      if(canonical(checkedData(payload))!==canonical(checkedData(item.result.structuredContent)))reject();
      const result=payloadResult(payload,item.arguments,kind,slot);
      if(kind==='final'&&result.issues.length)checkReviewAttribution(result,finalReviewPacket(rows,input,slot,host,rows.indexOf(calls[0])));
      return result;
    }
    const pinned=row=>claudePinned(row,input,slot);
    const uses=[];for(const row of rows)if(row.type==='assistant'&&Array.isArray(row.message?.content))for(const block of row.message.content)
      if(block?.type==='tool_use'&&typeof block.id==='string'&&textDigest(block.id)===slot.submission_call_sha256)uses.push({row,block});
    if(uses.length!==1)reject();const use=uses[0];
    if(!pinned(use.row)||use.row.message.role!=='assistant'||use.row.message.model!=='claude-haiku-4-5-20251001'||
      use.block.name!=='mcp__plugin_ttak_ttak_scenario__explanation_'+kind+'_result')reject();
    const replies=[];for(const row of rows)if(row.type==='user'&&Array.isArray(row.message?.content))for(const block of row.message.content)
      if(block?.type==='tool_result'&&block.tool_use_id===use.block.id)replies.push({row,block});
    if(replies.length!==1)reject();const reply=replies[0];
    if(!pinned(reply.row)||reply.row.message.role!=='user'||reply.row.sourceToolAssistantUUID!==use.row.uuid||reply.block.is_error||typeof reply.block.content!=='string')reject();
    const result=payloadResult(JSON.parse(reply.block.content),use.block.input,kind,slot);
    if(kind==='final'&&result.issues.length)checkReviewAttribution(result,finalReviewPacket(rows,input,slot,host,rows.indexOf(use.row)));
    return result;
  }catch{reject();}
}
function readSubmittedResult(input,dataRoot,slot,host,kind){
  try{return selectSubmittedResult(readChildSnapshot(input,dataRoot,slot.agent_id,host),input,slot,host,kind);}
  catch{reject();}
}
module.exports={selectSubmittedResult,readSubmittedResult};
