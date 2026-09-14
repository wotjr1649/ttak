'use strict';
// Read only this native session's existing transcript. No new raw storage or egress.
// Native transcript layouts are not stable APIs: accept the observed pinned shapes only.
const fs=require('node:fs'),path=require('node:path');
const {normalizeRequest}=require('./explanation-verification.cjs');
const {checkDigest,textDigest}=require('./verification-packet.cjs');
const MAX_BYTES=8388608,MAX_ENTRIES=10000,MAX_LINES=10000;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const reject=()=>{throw new Error('native_original_request_unavailable');};
function directory(value){
  if(typeof value!=='string'||!path.isAbsolute(value))reject();
  const resolved=path.resolve(value),s=fs.lstatSync(resolved);
  if(!s.isDirectory()||s.isSymbolicLink()||fs.realpathSync(resolved)!==resolved)reject();return resolved;
}
function scopedPath(root,value){
  if(typeof value!=='string'||!path.isAbsolute(value))reject();
  const target=path.resolve(value),relative=path.relative(root,target);
  if(!relative||relative.split(path.sep).includes('..')||path.isAbsolute(relative))reject();
  const parts=relative.split(path.sep);let parent=root;
  for(const part of parts.slice(0,-1)){parent=path.join(parent,part);directory(parent);}
  if(fs.realpathSync(target)!==target)reject();return target;
}
function transcriptPath(input,dataRoot,host='codex'){
  const data=directory(dataRoot),container=directory(path.dirname(data)),plugins=directory(path.dirname(container));
  if(path.basename(container)!=='data'||path.basename(plugins)!=='plugins')reject();
  const profile=directory(path.dirname(plugins)),sessions=directory(path.join(profile,host==='claude'?'projects':'sessions'));
  const matches=name=>host==='claude'?name===input.session_id+'.jsonl':name.endsWith('-'+input.session_id+'.jsonl');
  if(input.transcript_path!==null&&input.transcript_path!==undefined){
    const file=scopedPath(sessions,input.transcript_path);
    if(!matches(path.basename(file)))reject();return file;
  }
  // A null native path has no target to reject. Resolve by the exact session filename
  // inside the same profile; an invalid explicit path never falls back to this search.
  const pending=[{dir:sessions,depth:0}],found=[];let entries=0;
  while(pending.length){
    const {dir,depth}=pending.pop();directory(dir);
    for(const item of fs.readdirSync(dir,{withFileTypes:true})){
      if(++entries>MAX_ENTRIES||item.isSymbolicLink())reject();const file=path.join(dir,item.name);
      if(item.isDirectory()){if(depth>=4)reject();pending.push({dir:file,depth:depth+1});}
      else if(item.isFile()&&matches(item.name))found.push(scopedPath(sessions,file));
    }
  }
  if(found.length!==1)reject();return found[0];
}
function readSnapshot(file){
  const before=fs.lstatSync(file,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size<1n||before.size>BigInt(MAX_BYTES))reject();
  const fd=fs.openSync(file,'r');
  try{
    const opened=fs.fstatSync(fd,{bigint:true});
    if(!opened.isFile()||opened.nlink!==1n||opened.dev!==before.dev||opened.ino!==before.ino||opened.size<1n||opened.size>BigInt(MAX_BYTES))reject();
    // Read a finite prefix, not a growing file until EOF. New complete records may
    // append during a hook; an unfinished trailing record is never selected as input.
    const bytes=Buffer.alloc(Number(opened.size));let offset=0;
    while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(count===0)reject();offset+=count;}
    const after=fs.lstatSync(file,{bigint:true}),held=fs.fstatSync(fd,{bigint:true});
    if(after.isSymbolicLink()||after.dev!==opened.dev||after.ino!==opened.ino||after.nlink!==1n||held.nlink!==1n||held.size<opened.size)reject();
    const end=bytes.lastIndexOf(10);if(end<0)reject();
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,end+1));
  }finally{fs.closeSync(fd);}
}
function selectCurrentRequest(raw,input,expectedHash){
  checkDigest(expectedHash);
  if(!uuid(input?.session_id)||!uuid(input?.turn_id)||typeof input.cwd!=='string'||!path.isAbsolute(input.cwd)||
    typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES||!raw.endsWith('\n'))reject();
  const lines=raw.split('\n');lines.pop();if(!lines.length||lines.length>MAX_LINES)reject();
  const records=lines.map(line=>JSON.parse(line)),headers=records.filter(r=>r.type==='session_meta');
  const header=headers[0]?.payload;
  if(records[0].type!=='session_meta'||headers.length!==1||header?.id!==input.session_id||header.session_id!==input.session_id||
    header.cli_version!=='0.154.0'||typeof header.cwd!=='string'||!path.isAbsolute(header.cwd)||path.resolve(header.cwd)!==path.resolve(input.cwd))reject();
  const found=[];
  for(const row of records){
    const item=row.payload,metadata=item?.internal_chat_message_metadata_passthrough;
    if(row.type!=='response_item'||item?.type!=='message'||item.role!=='user'||metadata?.turn_id!==input.turn_id)continue;
    if(!Array.isArray(item.content)||!Array.isArray(metadata.content_item_kinds)||item.content.length!==metadata.content_item_kinds.length)reject();
    for(let i=0;i<item.content.length;i++)if(metadata.content_item_kinds[i]==='user.text'){
      const block=item.content[i];if(block?.type!=='input_text'||typeof block.text!=='string')reject();
      const text=normalizeRequest(block.text);if(textDigest(text)===expectedHash)found.push(text);
    }
  }
  if(found.length!==1)reject();return found[0];
}
function selectClaudeCurrentRequest(raw,input,expectedHash){
  checkDigest(expectedHash);
  if(!uuid(input?.session_id)||typeof input.cwd!=='string'||!path.isAbsolute(input.cwd)||
    typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES||!raw.endsWith('\n'))reject();
  const lines=raw.split('\n');lines.pop();if(!lines.length||lines.length>MAX_LINES)reject();
  const records=lines.map(line=>JSON.parse(line));
  // Claude has no hook turn_id here. Use the latest external task record and
  // the hash registered by this parent turn's actual UserPromptSubmit. Never
  // search older matching user text after a different current task is present.
  const tasks=records.filter(row=>row.type==='user'&&row.isMeta!==true&&row.isSidechain!==true&&
    !(Array.isArray(row.message?.content)&&row.message.content.every(block=>block?.type==='tool_result')));
  const selected=tasks.at(-1);
  if(!selected||new Set(tasks.map(row=>row.uuid)).size!==tasks.length||!uuid(selected.uuid)||!uuid(selected.promptId)||
    selected.sessionId!==input.session_id||selected.version!=='2.1.266'||selected.isSidechain!==false||selected.userType!=='external'||
    typeof selected.cwd!=='string'||!path.isAbsolute(selected.cwd)||path.resolve(selected.cwd)!==path.resolve(input.cwd)||
    selected.message?.role!=='user'||typeof selected.message.content!=='string')reject();
  const content=selected.message.content,prefix='<command-message>ttak:ttak-explain</command-message>\n<command-name>/ttak:ttak-explain</command-name>\n<command-args>',suffix='</command-args>';
  // Two explicit wire representations, not substring or quote repair. A literal
  // wrapper in user-authored text remains intact when that is the registered hash.
  const alternatives=[content];if(content.startsWith(prefix)&&content.endsWith(suffix))alternatives.push(content.slice(prefix.length,-suffix.length));
  const found=alternatives.filter(text=>Buffer.byteLength(text)<=32000).map(normalizeRequest).filter(text=>textDigest(text)===expectedHash);
  if(found.length!==1)reject();return found[0];
}
function readCurrentRequest(input,dataRoot,expectedHash,host='codex'){
  checkDigest(expectedHash);if(!['claude','codex'].includes(host)||!uuid(input?.session_id)||host==='codex'&&!uuid(input?.turn_id))reject();
  const raw=readSnapshot(transcriptPath(input,dataRoot,host));
  return host==='claude'?selectClaudeCurrentRequest(raw,input,expectedHash):selectCurrentRequest(raw,input,expectedHash);
}
function readChildSnapshot(input,dataRoot,agentId,host='codex'){
  if(!['claude','codex'].includes(host)||!uuid(input?.session_id)||typeof input.cwd!=='string'||!path.isAbsolute(input.cwd)||
    typeof agentId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(agentId)||/^(?:sk-|gh[pousr]_)/i.test(agentId)||host==='codex'&&!uuid(agentId))reject();
  // Resolve the parent first: an invalid explicit parent path is never bypassed
  // by switching to a child lookup. Both targets remain in this same profile.
  const parent=transcriptPath(input,dataRoot,host);
  const child=host==='codex'?transcriptPath({...input,session_id:agentId,transcript_path:null},dataRoot,host)
    :scopedPath(directory(path.dirname(parent)),path.join(path.dirname(parent),input.session_id,'subagents','agent-'+agentId+'.jsonl'));
  return readSnapshot(child);
}
module.exports={readCurrentRequest,readChildSnapshot,selectCurrentRequest,selectClaudeCurrentRequest,MAX_BYTES,MAX_ENTRIES,MAX_LINES};
