'use strict';
// Compact review reports, not a semantic oracle. No I/O, model calls or text trimming.
const {checkedData,exact,checkInt,list,canonical,checkText}=require('./verification-packet.cjs');
const dimensions={
  requirement_review:{
    essential_requirements:'Check every essential requirement in the entire original request, including prose. Distinguish requirements from source inventories and optional alternatives.',
    reader_format:'Check the actual requested reader, language, output format and length; count sentences when required.'},
  claim_review:{
    actors_targets:'Compare each claimed subject, action, read target, write target and resulting value with the original evidence.',
    conditions_outcomes:'Check each action under its stated conditions. Distinguish a false condition and no action from an operation being rejected or aborted; do not swap the actor in an alternative order.',
    timing_negation:'Check event order, snapshot timing, causal direction and negation in the actual explanation.',
    guarantees_scope_costs:'Check implementation and operating-mode conditions, affected operations, guarantees and costs. An effect on one class of operation is not an effect on every operation.'},
  fact_review:{
    source_support:'Compare each actual fact answer with the original evidence, not with the final answer alone. A matching quote or receipt does not establish its conclusion.',
    computed_outcomes:'Compare every model-derived fact with the supplied definition and fresh bounded computation; keep its scope separate from real-system claims. If no finite model applies, check derivations from their actual premises.',
    internal_consistency:'Check the factual reasons for contradictions, changed actors or conditions, and unsupported scope. Do not attribute a final-only clause to a fact answer.'}
};
function reviewSchema(field){
  if(typeof field!=='string'||!Object.hasOwn(dimensions,field))throw new Error('verification_review_group');
  const properties=Object.fromEntries(Object.entries(dimensions[field]).map(([key,description])=>[key,{description:description
    +' After checking, use pass only when no material defect is found; otherwise give the zero-based indices of its concrete defects in the corresponding issue list.',
    anyOf:[{type:'string',enum:['pass']},{type:'array',items:{type:'integer',minimum:0,maximum:15},minItems:1,maxItems:16,uniqueItems:true}]}]));
  return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
function flatReviewSchema(legacy=false){
  if(typeof legacy!=='boolean')throw new Error('verification_review_schema_mode');
  const properties=Object.fromEntries(Object.keys(dimensions).flatMap(field=>
    Object.entries(reviewSchema(field).properties).map(([key,schema])=>[!legacy&&field==='fact_review'?'fact_'+key:key,schema])));
  return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
function inlineReviewSchema(issueSchema){
  const issue=checkedData(issueSchema),properties={};
  for(const [group,checks]of Object.entries(dimensions))for(const [key,description]of Object.entries(checks)){
    const name=group==='fact_review'?'fact_'+key:key;
    const source=group==='fact_review'
      ?'Quote the defective assertion in the actual fact answer. Missing coverage in the final explanation belongs under essential_requirements, not here.'
      :group==='requirement_review'?'For missing coverage, quote the original requirement; otherwise quote the defective final wording.'
      :'Quote the defective final wording.';
    properties[name]={description:description+' '+source+' Use pass if no material defect is found, otherwise supply the complete concrete issues directly in this field. Do not supply issue numbers.',
      anyOf:[{type:'string',enum:['pass']},{type:'array',items:issue,minItems:1,maxItems:16,uniqueItems:true}]};
  }
  return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
function compileInlineReviewChecks(value){
  const input=checkedData(value);exact(input,flatReviewSchema().required);
  const flat={},issues=[],byValue=new Map();
  for(const key of flatReviewSchema().required){
    const value=input[key];
    if(value==='pass'){flat[key]='pass';continue;}
    list(value,16);const local=new Set();
    flat[key]=value.map(issue=>{
      exact(issue,['quote','reason','evidence_needed']);checkText(issue.quote,1500);checkText(issue.reason,2000);checkText(issue.evidence_needed,1000);
      const id=canonical(issue);if(local.has(id))throw new Error('verification_duplicate_review_issue');local.add(id);
      if(!byValue.has(id)){byValue.set(id,issues.length);issues.push(issue);}
      return byValue.get(id);
    });
  }
  const checks=expandReviewChecks(flat);compileReviewChecks(checks,issues.length);
  return {checks,issues};
}
function expandReviewChecks(value){
  const input=checkedData(value),legacy=Object.keys(dimensions.fact_review).some(key=>Object.hasOwn(input,key));
  exact(input,flatReviewSchema(legacy).required);
  return Object.fromEntries(Object.entries(dimensions).map(([field,checks])=>
    [field,Object.fromEntries(Object.keys(checks).map(key=>[key,input[!legacy&&field==='fact_review'?'fact_'+key:key]]))]));
}
function compileReviewChecks(value,issueCount){
  const input=checkedData(value);exact(input,Object.keys(dimensions));checkInt(issueCount,0,16);const referenced=new Set(),output={};
  for(const [field,checks]of Object.entries(dimensions)){
    exact(input[field],Object.keys(checks));
    for(const value of Object.values(input[field])){
      if(value==='pass')continue;
      list(value,16);if(new Set(value).size!==value.length)throw new Error('verification_duplicate_review_issue');
      for(const index of value){checkInt(index,0,issueCount-1);referenced.add(index);}
    }
    output[field]=checkText(canonical(input[field]),400);
  }
  if(referenced.size!==issueCount)throw new Error('verification_unreferenced_review_issue');
  return output;
}
function scopeReviewIssues(value,issues,factIssues){
  const input=checkedData({checks:value,issues,fact_issues:factIssues});exact(input.checks,Object.keys(dimensions));
  const merged=[],byValue=new Map(),maps={},referenced={issues:new Set(),fact_issues:new Set()},output={};
  for(const field of ['issues','fact_issues']){
    const entries=input[field];list(entries,16,0);const local=new Set();maps[field]=[];
    for(const issue of entries){
      const key=canonical(issue);if(local.has(key))throw new Error('verification_duplicate_review_issue');local.add(key);
      if(!byValue.has(key)){byValue.set(key,merged.length);merged.push(issue);}
      maps[field].push(byValue.get(key));
    }
  }
  list(merged,16,0);
  for(const [group,checks]of Object.entries(dimensions)){
    const source=group==='fact_review'?'fact_issues':'issues';exact(input.checks[group],Object.keys(checks));output[group]={};
    for(const [key,value]of Object.entries(input.checks[group])){
      if(value==='pass'){output[group][key]='pass';continue;}
      list(value,16);if(new Set(value).size!==value.length)throw new Error('verification_duplicate_review_issue');
      output[group][key]=value.map(index=>{
        checkInt(index,0,input[source].length-1);referenced[source].add(index);return maps[source][index];
      });
    }
  }
  for(const field of ['issues','fact_issues'])if(referenced[field].size!==input[field].length)throw new Error('verification_unreferenced_review_issue');
  compileReviewChecks(output,merged.length);
  return {checks:output,issues:merged};
}
module.exports={reviewSchema,flatReviewSchema,inlineReviewSchema,compileInlineReviewChecks,expandReviewChecks,compileReviewChecks,scopeReviewIssues};
