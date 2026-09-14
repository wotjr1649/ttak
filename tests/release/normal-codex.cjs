'use strict';
// Installed-plugin comparison transport. Invoke only inside the bounded native
// supervisor with its reviewed, filtered environment and exclusive trial cwd.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {checkedData,exact,checkText,checkDigest,checkInt,list}=require('../../scripts/verification-packet.cjs');
const {possibleSecret}=require('../../scripts/review-native-format.cjs');
const {collector}=require('./normal-events.cjs'),{connect}=require('./normal-rpc.cjs');
const area=path.resolve(__dirname,'../../.superpowers'),sha=raw=>createHash('sha256').update(raw).digest('hex');
const rejectSpec=()=>{throw new Error('normal_trial_spec_invalid');};
function within(file,root){const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);}
function localPath(file,directory){
  checkText(file,2048);if(!path.isAbsolute(file)||!within(path.resolve(file),area))rejectSpec();
  const resolved=fs.realpathSync(file),stat=fs.lstatSync(file);
  if(resolved.toLowerCase()!==path.resolve(file).toLowerCase()||stat.isSymbolicLink()||
    (directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1))rejectSpec();
  return resolved;
}
function specification(value){
  const spec=checkedData(value);exact(spec,['prompt','session','skills','ttak_root','parent_turn_limit','internal_verifier_limit','collection_id']);
  if(typeof spec.collection_id!=='string'||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(spec.collection_id))rejectSpec();
  checkText(spec.prompt,32000);checkInt(spec.parent_turn_limit,1,20);checkInt(spec.internal_verifier_limit,0,11);
  if(spec.session!==null&&(typeof spec.session!=='string'||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(spec.session)))rejectSpec();
  if(spec.ttak_root!==null)localPath(spec.ttak_root,true);
  if(spec.internal_verifier_limit&&!spec.ttak_root)rejectSpec();
  list(spec.skills,4,0);const selected=new Set();
  for(const skill of spec.skills){
    exact(skill,['name','path','sha256']);checkText(skill.name,64);checkDigest(skill.sha256);
    if(!/^[a-z0-9-]+$/.test(skill.name)||selected.has(skill.path))rejectSpec();selected.add(skill.path);
    const file=localPath(skill.path,false);
    if(path.basename(file)!=='SKILL.md'||sha(fs.readFileSync(file))!==skill.sha256)rejectSpec();
  }
  return spec;
}
function reserveCheckpoint(spec,cwd=process.cwd()){
  specification(spec);const work=localPath(cwd,true);
  const file=path.join(work,'normal-checkpoint-'+spec.collection_id+'.json');
  const descriptor=fs.openSync(file,'wx');fs.closeSync(descriptor);return file;
}
function threadConfiguration(spec){
  // Codex retains the initial multi-agent mode across thread/resume. Provision
  // the candidate capability on its first activation; the per-turn observer
  // still rejects any spawn when that turn's verifier allocation is zero.
  return {model_reasoning_effort:'high','features.shell_tool':false,'features.apps':false,web_search:'disabled',
    'agents.enabled':spec.ttak_root!==null,'agents.max_concurrent_threads_per_session':1,
    'agents.default_subagent_model':'gpt-5.6-luna','agents.default_subagent_reasoning_effort':'high'};
}
async function run(value){
  const spec=specification(value);localPath(process.cwd(),true);const profile=localPath(process.env.CODEX_HOME,true),cache=path.join(profile,'plugins/cache');
  if(spec.skills.some(skill=>!within(path.resolve(skill.path),cache))||spec.ttak_root&&!within(path.resolve(spec.ttak_root),cache))rejectSpec();
  const checkpointFile=reserveCheckpoint(spec);
  const report={protocol:'ttak-normal-collection-v1',collection_id:spec.collection_id,request_sha256:sha(spec.prompt),model:null,effort:null,
    messages:[],child_messages:[],hooks:[],tool_items:[],function_items:[],agent_items:[],turns:[],child_turns:[],usage:[],child_usage:[],error:null};
  let resolveDone,rejectDone,settled=false;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});done.catch(()=>{});
  const reject=code=>{if(!settled){settled=true;rejectDone(new Error(code));}};
  const checkpoint=()=>{
    const raw=JSON.stringify(report);if(possibleSecret(raw)||Buffer.byteLength(raw)>1048576)throw new Error('report_withheld');
    localPath(checkpointFile,false);fs.writeFileSync(checkpointFile,raw+'\n');
  };
  const c=connect(collector({report,installed:spec.ttak_root,parentLimit:spec.parent_turn_limit,agentLimit:spec.internal_verifier_limit,
    checkpoint,reject,resolve:()=>{if(!settled){settled=true;resolveDone();}}}),reject);
  try{
    await c.request('initialize',{clientInfo:{name:'ttak_normal_comparison',version:'1'}});c.send({method:'initialized'});
    const config=threadConfiguration(spec);
    const options={cwd:process.cwd(),model:'gpt-5.6-luna',sandbox:'read-only',approvalPolicy:'never',config};
    const thread=spec.session?await c.request('thread/resume',{threadId:spec.session,...options})
      :await c.request('thread/start',{...options,allowProviderModelFallback:false});
    report.session=thread.thread.id;report.model=thread.model;report.effort=thread.reasoningEffort;
    if(report.model!=='gpt-5.6-luna'||report.effort!=='high')throw new Error('actual_model_mismatch');
    const input=spec.skills.map(skill=>({type:'skill',name:skill.name,path:skill.path}));input.push({type:'text',text:spec.prompt});
    await c.request('turn/start',{threadId:report.session,input,effort:'high'});await done;
  }catch(error){report.error=/^[a-z_]+$/.test(error.message)?error.message:'normal_trial_failed';}
  finally{await c.close();checkpoint();}
  if(!report.error){
    try{
      report.native_history=require('./normal-history.cjs').nativeHistory(profile,report.session,report.turns.map(turn=>turn.id));
      const expected=spec.ttak_root===null?'disabled':'v1';
      if(report.native_history.contexts.some(context=>context.multi_agent_version!==expected))throw new Error('native_agent_mode_mismatch');
    }catch(error){report.error=/^[a-z_]+$/.test(error.message)?error.message:'native_history_failed';}
    checkpoint();
  }
  return report;
}
module.exports={specification,reserveCheckpoint,threadConfiguration,run};
if(require.main===module){
  let input='',bytes=0;process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>65536){process.stdin.destroy();process.exitCode=1;}else input+=chunk;});
  process.stdin.on('end',async()=>{try{const report=await run(JSON.parse(input));console.log(JSON.stringify(report));if(report.error)process.exitCode=1;}
    catch{console.log('{"error":"normal_collection_failed"}');process.exitCode=1;}});
}
