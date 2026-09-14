'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const source=require('../scripts/explanation-source-model.cjs'),v=require('../scripts/explanation-verification.cjs');
const {digest,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const model={initial:{ready:true},invariant:{cells:['ready'],at_least:1},transactions:[
  {id:'Inspect',guard:{cells:['ready'],at_least:1},writes:{ready:true}}]};
const notes=['A snapshot includes committed changes visible when the first non-control statement starts.',
  'The mechanism can reject an operation.\n\nThe caller must retry the whole operation.'];
const record=text=>({id:'SOURCE',text,sha256:textDigest(text),version:'fixture-v1'});
const appendix=text=>({sha256:textDigest(text),text});
const request=(sources=notes.map(record))=>'Explain the abstract example and any necessary source conditions.\n'+JSON.stringify({scenario:model,sources});
const binding={attempt_id:'11111111-1111-4111-8111-111111111195',candidate_sha256:'a'.repeat(64)};
const answer=text=>({computed_models:[{model_sha256:digest(model),model}],request_context:'ready is the state cell inspected by Inspect.',
  additional_sources:(Array.isArray(text)?text:text?[text]:[]).map(appendix),language:'en'});

test('only complete, digest-matched supplied source records become available appendices',()=>{
  assert.deepEqual(source.sourceAppendices(request()),notes.map(text=>({text,sha256:textDigest(text)})));
  assert.deepEqual(source.sourceAppendices('Explain an ordinary value.'),[]);
  assert.deepEqual(source.sourceAppendices(request([{text:notes[0]}])),[]);
  assert.throws(()=>source.sourceAppendices(request([{...record(notes[0]),sha256:'a'.repeat(64)}])));
  assert.throws(()=>source.sourceAppendices(request(Array.from({length:9},(_,i)=>record('Source '+i)))));
  const fresh=source.sourceAppendices(request());fresh[0].text='changed';assert.equal(source.sourceAppendices(request())[0].text,notes[0]);
});

test('structured model documents remain computation evidence, never duplicate prose appendices',()=>{
  const raw=JSON.stringify({scenario:model,computed_outcome:'UNTRUSTED_SOURCE_LABEL'}),original=request([record(raw),...notes.map(record)]);
  assert.deepEqual(source.sourceAppendices(original),notes.map(appendix));
  const evidence=source.verifierModels(original);assert.ok(evidence.length>=1);
  assert.ok(evidence.every(item=>item.source.model_sha256===digest(model)));
  assert.equal(source.computedFactAccounts(original).length,1);
  assert.throws(()=>source.checkFactModelSources(answer(raw),[digest(model)],notes.map(textDigest)));
  const plan=v.prepare({...binding,request:original}),document=JSON.parse(plan.packets[0].prompt.slice(plan.packets[0].prompt.indexOf('\n')+1)),data=document.data;
  assert.equal(data.original_request,original);assert.deepEqual(data.model_evidence,evidence);
  assert.deepEqual(data.source_appendices,notes.map(appendix));
  assert.deepEqual(document.submission.input_schema.properties.answer.properties.additional_sources.items.properties.sha256.enum,notes.map(textDigest));
  const empty=v.prepare({...binding,request:request([])}).packets[0];
  assert.equal(JSON.parse(empty.prompt.slice(empty.prompt.indexOf('\n')+1)).submission.input_schema.properties.answer.properties.additional_sources.maxItems,0);
  assert.doesNotMatch(source.compileModelAnswer(answer(notes)).answer,/UNTRUSTED_SOURCE_LABEL/);
});

test('typed whole records preserve internal paragraphs; excerpts and new qualifiers are refused',()=>{
  const hashes=notes.map(textDigest);
  for(const texts of [[],[notes[0]],[notes[1]],notes,[...notes].reverse()])
    assert.doesNotThrow(()=>source.checkSourceAppendix(texts.map(appendix),hashes));
  for(const text of [notes[0].replace('non-control ','').replace('committed ',''),notes[1].split('\n\n')[0],
    notes.join('\n'),notes[0]+' ',notes[0]+'\n\nUnsupported guarantee.',notes[0]])
    assert.throws(()=>source.checkSourceAppendix([appendix(text)],text===notes[0]?[]:hashes));
  assert.throws(()=>source.checkSourceAppendix([],[hashes[0],hashes[0]]));
  assert.throws(()=>source.checkSourceAppendix([appendix(notes[0]),appendix(notes[0])],hashes));
  assert.throws(()=>source.checkSourceAppendix(Array.from({length:9},(_,i)=>appendix('Source '+i)),hashes));
});

test('encoded objects, missing or additional fields and forged source text cannot become appendices',()=>{
  const good=appendix(notes[0]),hashes=notes.map(textDigest);
  for(const value of [JSON.stringify(good),[JSON.stringify(good)],[{...good,version:'fixture-v1'}],
    [{text:notes[0]}],[{...good,text:notes[0].replace('committed ','')}],[null]])
    assert.throws(()=>source.checkSourceAppendix(value,hashes));
  let reads=0;const accessor={...good};Object.defineProperty(accessor,'text',{enumerable:true,get(){reads++;return notes[0];}});
  assert.throws(()=>source.checkSourceAppendix([accessor],hashes));assert.equal(reads,0);
  const schema=source.modelAnswerSchema().properties.additional_sources;
  assert.equal(schema.type,'array');assert.deepEqual(schema.items.required,['sha256','text']);assert.equal(schema.items.additionalProperties,false);
  const compiled=source.compileModelAnswer(answer(notes));assert.ok(compiled.answer.endsWith(notes.join('\n\n')));
});

test('fact provenance binds appendix hashes as well as the selected models',()=>{
  const plan=v.prepare({...binding,request:request()}),state=v.initialVerification(plan);
  assert.deepEqual(state.facts[0].source_appendix_sha256s,notes.map(textDigest));
  assert.doesNotThrow(()=>v.checkedVerification(state));
  for(const hashes of [undefined,['invalid'],[textDigest(notes[0]),textDigest(notes[0])]]){
    const bad=structuredClone(state);if(hashes===undefined)delete bad.facts[0].source_appendix_sha256s;else bad.facts[0].source_appendix_sha256s=hashes;
    assert.throws(()=>v.checkedVerification(bad));
  }
  assert.doesNotThrow(()=>source.checkFactModelSources(answer(notes),[digest(model)],notes.map(textDigest)));
  assert.throws(()=>source.checkFactModelSources(answer(notes[0]),[digest(model)],[]));
  assert.doesNotMatch(JSON.stringify(state),/committed changes|non-control statement/);
});

test('both normal MCP hosts reject an ungrounded appendix and accept the unchanged source',()=>{
  for(const host of ['claude','codex'])for(const valid of [true,false]){
    const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'appendix-test',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
    const call=(name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
    const plan=v.prepare({...binding,request:request()});assert.equal(call('explanation_prepare',{...binding,request:request()}).isError,undefined);
    const input={challenge:plan.packets[0].challenge,verdict:'answered',answer:answer(valid?notes[0]:notes[0].replace('committed ','')),issues:[]};
    const result=call('explanation_fact_result',input);
    if(valid){assert.equal(result.isError,undefined);assert.ok(result.structuredContent.result.answer.endsWith(notes[0]));}
    else assert.equal(result.isError,true);
  }
});
