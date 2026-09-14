'use strict';
// Bounded data decoding and finite computation only. No I/O, evaluation or trust
// promotion: a located definition is not proof that it models the real system.
const {checkedData,exact,checkText,checkDigest,list,canonical,digest,textDigest}=require('./verification-packet.cjs');
const {explainScenario}=require('./finite-scenario-render.cjs');
const {analyzeScenario}=require('./finite-scenario.cjs');
function decodeDocument(raw){
  let value;try{value=JSON.parse(raw);}catch(error){if(error instanceof SyntaxError)return null;throw error;}
  value=checkedData(value);
  if(!value||typeof value!=='object')return null;
  // JSON.parse selects the last duplicate key. Ambiguous source definitions must
  // not acquire a computed answer through that implicit selection.
  const stack=[];
  for(const match of raw.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)){
    const token=match[0],top=stack.at(-1);
    if(token==='{'||token==='[')stack.push({object:token==='{',key:true,keys:new Set()});
    else if(token==='}'||token===']')stack.pop();
    else if(token===','&&top?.object)top.key=true;
    else if(token.startsWith('"')&&top?.object&&top.key){const key=JSON.parse(token);
      if(top.keys.has(key))throw new Error('source_model_duplicate_key');top.keys.add(key);top.key=false;}
  }
  return value;
}
function sourceModels(request){
  checkText(request,32000);
  let scanned=0,nodes=0,decodes=0;const output=[];
  function endOfDocument(start){
    const stack=[];let quoted=false,escaped=false;
    for(let at=start;at<request.length;at++){
      if(++scanned>128000)throw new Error('source_model_scan_limit');const ch=request[at];
      if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
      if(ch==='"'){quoted=true;continue;}
      if(ch==='{'||ch==='['){stack.push(ch);if(stack.length>16)throw new Error('source_model_depth_limit');}
      else if(ch==='}'||ch===']'){
        if(stack.pop()!==(ch==='}'?'{':'['))return null;
        if(!stack.length)return at+1;
      }
    }
    return null;
  }
  function visit(value,source,path,depth){
    if(++nodes>4096||depth>16)throw new Error('source_model_tree_limit');
    if(typeof value==='string'){
      const raw=value.trim();if(!raw.startsWith('{')&&!raw.startsWith('['))return;
      if(++decodes>8)throw new Error('source_model_decode_limit');const decoded=decodeDocument(raw);
      if(decoded!==null)visit(decoded,source,[...path,{decode:'json'}],depth+1);return;
    }
    if(!value||typeof value!=='object')return;
    const keys=Object.keys(value);
    if(!Array.isArray(value)&&keys.length===3&&['initial','invariant','transactions'].every(k=>Object.hasOwn(value,k))){
      if(output.length>=4)throw new Error('source_model_count_limit');
      const model=checkedData(value),computed=explainScenario(model,'en');
      output.push({source:{...source,path,model_sha256:digest(model)},model,computed});
      checkText(canonical(output),16000);return;
    }
    if(Array.isArray(value))value.forEach((item,index)=>visit(item,source,[...path,index],depth+1));
    else for(const key of keys)visit(value[key],source,[...path,key],depth+1);
  }
  // Deliberately narrow: complete JSON documents beginning on their own line.
  // Inline prose and unsupported encodings remain for the independent verifier.
  let next=0;
  for(const match of request.matchAll(/^[\t ]*[\[{]/gm)){
    const start=match.index+match[0].length-1;if(start<next)continue;
    const end=endOfDocument(start);if(end===null)break;
    next=end;const newline=request.indexOf('\n',end),tail=request.slice(end,newline===-1?request.length:newline);
    if(tail.trim())continue;
    const raw=request.slice(start,end),value=decodeDocument(raw);if(value===null)continue;
    visit(value,{start_utf16:start,end_utf16:end,document_sha256:textDigest(raw)},[],0);
  }
  return output;
}
// The verifier receives named reads and applied writes together with each state
// transition. Recompute from the original source, not a parent-supplied result.
function verifierModels(request){
  const output=sourceModels(request).map(({source,model})=>{
    const result=analyzeScenario(model),state_columns=Object.keys(model.initial),stateValues=state=>state_columns.map(name=>state[name]);
    const witness=schedules=>{
      const chosen=schedules.find(schedule=>!schedule.invariant_preserved)??schedules[0];
      return {order:chosen.order,steps:chosen.steps.map(step=>({transaction:step.transaction,guard_read_values:step.observed,outcome:step.outcome,
        writes_applied:step.outcome==='committed'?model.transactions.find(t=>t.id===step.transaction).writes:{},state_after:stateValues(step.state),invariant_holds:step.invariant_holds})),
        final_state:stateValues(chosen.final_state),invariant_preserved:chosen.invariant_preserved};
    };
    const readValues=(transaction,schedules)=>transaction.guard.cells.map(cell=>{
      const observed=new Set(schedules.map(schedule=>schedule.steps.find(step=>step.transaction===transaction.id).observed[cell]));
      return [false,true].filter(value=>observed.has(value));
    });
    return {source,model,computed:{state_columns,
      concurrent_orders_checked:result.concurrent_start_schedules.length,serial_orders_checked:result.serial_schedules.length,
      potential_read_write_edges:result.potential_read_write_edges,potential_write_write_edges:result.potential_write_write_edges,
      concurrent_start_witness:witness(result.concurrent_start_schedules),serial_witness:witness(result.serial_schedules),
      guard_read_values_across_checked_orders:model.transactions.map(transaction=>({transaction:transaction.id,
        concurrent_start:readValues(transaction,result.concurrent_start_schedules),serial:readValues(transaction,result.serial_schedules)})),
      concurrent_invariant_violation_found:result.concurrent_invariant_violation_found,all_serial_orders_preserve_invariant:result.all_serial_orders_preserve_invariant,
      real_database_verified:false,all_possible_interleavings_checked:false}};
  });
  if(output.length)checkText(canonical(output),16000);return output;
}
function computedFactAccounts(request){
  const accounts=new Map();
  for(const {source,computed}of sourceModels(request))if(!accounts.has(source.model_sha256)){
    accounts.set(source.model_sha256,{model_sha256:source.model_sha256,language:'en',answer:computed.explanation,answer_sha256:textDigest(computed.explanation)});
  }
  const output=[...accounts.values()];if(output.length)checkText(canonical(output),16000);return output;
}
// Whole supplied records preserve qualifications that a generated paraphrase can
// drop. Their hashes establish origin only; the final review still checks truth.
function sourceAppendices(request){
  const documents=new Map(),records=new Map();let nodes=0;
  for(const {source} of sourceModels(request))documents.set(source.document_sha256,
    request.slice(source.start_utf16,source.end_utf16));
  function visit(value,depth){
    if(++nodes>4096||depth>16)throw new Error('source_appendix_scan_limit');
    if(!value||typeof value!=='object')return;
    if(!Array.isArray(value)&&Array.isArray(value.sources))for(const record of value.sources){
      if(!record||typeof record!=='object'||typeof record.text!=='string'||typeof record.sha256!=='string')continue;
      checkText(record.text,8000);checkDigest(record.sha256);
      if(textDigest(record.text)!==record.sha256)throw new Error('source_appendix_digest');
      // Definitions and source-authored outcome labels already belong to the
      // model evidence. Do not append their entire JSON as additional prose or
      // reintroduce those labels as independently computed factual outcomes.
      const raw=record.text.trim();
      if((raw.startsWith('{')||raw.startsWith('['))&&sourceModels(raw).length)continue;
      records.set(record.sha256,{sha256:record.sha256,text:record.text});
      if(records.size>8)throw new Error('source_appendix_count_limit');
    }
    for(const child of Object.values(value))visit(child,depth+1);
  }
  for(const raw of documents.values())visit(decodeDocument(raw),0);
  const result=[...records.values()];if(result.length)checkText(canonical(result),16000);return result;
}
function checkedAppendices(value){
  const records=checkedData(value);list(records,8,0);const seen=new Set();
  for(const record of records){
    exact(record,['sha256','text']);checkDigest(record.sha256);checkText(record.text,8000);
    if(textDigest(record.text)!==record.sha256||seen.has(record.sha256))throw new Error('source_appendix_record');
    seen.add(record.sha256);
  }
  if(records.length)checkText(records.map(record=>record.text).join('\n\n'),8000);
  return records;
}
function checkSourceAppendix(value,hashes){
  const allowed=checkedData(hashes);list(allowed,8,0).forEach(checkDigest);
  if(new Set(allowed).size!==allowed.length)throw new Error('source_appendix_binding');
  if(checkedAppendices(value).some(record=>!allowed.includes(record.sha256)))throw new Error('source_appendix_not_whole_original');
}
function modelAnswerSchema(){
  const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
  const name={type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]{0,31}$'};
  const predicate=object({cells:{type:'array',items:name,minItems:0,maxItems:16,uniqueItems:true},at_least:{type:'integer',minimum:0,maximum:16}});
  const state={type:'object',minProperties:1,maxProperties:16,additionalProperties:{type:'boolean'}};
  const model=object({initial:state,invariant:predicate,transactions:{type:'array',minItems:1,maxItems:4,
    items:object({id:name,guard:predicate,writes:state})}});
  return {...object({computed_models:{type:'array',minItems:0,maxItems:4,
    items:object({model_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},model:{$ref:'#/$defs/finite_model'}}),
    description:'Select relevant exact model definitions and their source.model_sha256 from model_evidence. The compiler constructs their finite factual account; do not retype calculated results or invent a new model.'},
    request_context:{type:'string',maxLength:2000,
      description:'For selected models, explain how their symbols, actors and invariant correspond to the original requested example. Use only the supplied context; do not invent domain entities. For an abstract request, explain the abstract roles. Required nonempty when selecting a model; empty only when no model is selected. This prose is reviewed, not a computed certificate.'},
    additional_sources:{type:'array',minItems:0,maxItems:8,items:object({sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},text:{type:'string',minLength:1,maxLength:8000}}),
      description:'Select only still-needed whole source_appendices objects with their exact sha256 and text fields. Use an empty array when none is needed. These are objects, never JSON strings. The compiler appends their text unchanged; do not paraphrase, excerpt or add optional alternatives. Origin is not truth certification.'},
    language:{type:'string',enum:['en','ko'],description:'Language of the internal computed account; the parent still matches the user\'s requested language and reader.'}}),$defs:{finite_model:model}};
}
function compileModelAnswer(value){
  const input=checkedData(value);exact(input,['computed_models','request_context','additional_sources','language']);list(input.computed_models,4,0);
  if(!['en','ko'].includes(input.language))throw new Error('verification_computed_answer_language');
  if(input.computed_models.length||input.request_context!=='')checkText(input.request_context,2000);
  const appendices=checkedAppendices(input.additional_sources);
  const model_sha256s=[],parts=input.request_context===''?[]:[input.request_context];
  for(const entry of input.computed_models){
    exact(entry,['model_sha256','model']);checkDigest(entry.model_sha256);
    if(digest(entry.model)!==entry.model_sha256||model_sha256s.includes(entry.model_sha256))throw new Error('verification_computed_answer_model');
    // The existing finite engine validates the definition and computes all its
    // bounded schedules. Neither supplied result labels nor free-form prose
    // become a computed outcome.
    const computed=explainScenario(entry.model,input.language);parts.push(computed.explanation);model_sha256s.push(entry.model_sha256);
  }
  parts.push(...appendices.map(record=>record.text));
  return {answer:checkText(parts.join('\n\n'),8000),model_sha256s};
}
function checkFactModelSources(answer,expected,appendixHashes=[]){
  if(expected===undefined){checkText(answer,8000);return;}
  const allowed=checkedData(expected);list(allowed,4);allowed.forEach(checkDigest);
  if(new Set(allowed).size!==allowed.length)throw new Error('verification_computed_answer_source');
  const compiled=compileModelAnswer(answer);
  if(compiled.model_sha256s.some(hash=>!allowed.includes(hash)))throw new Error('verification_computed_answer_source');
  checkSourceAppendix(answer.additional_sources,appendixHashes);
}
module.exports={sourceModels,verifierModels,computedFactAccounts,sourceAppendices,checkSourceAppendix,modelAnswerSchema,compileModelAnswer,checkFactModelSources};
