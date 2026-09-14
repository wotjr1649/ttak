'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{canonical,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{handleEvent}=require('../hooks/scenario-evidence.cjs');
const request='Explain the fictional Daro register. It stores one integer. Reading returns that integer without changing it. Start at 3 and read twice.';
const args=()=>({attempt_id:'preparation-wire',candidate_sha256:'a'.repeat(64),request,
  blocks:[{text:'Both reads return 3 and 3 remains stored.',question_ids:['trace']}],
  questions:[{id:'trace',kind:'mechanism',target:'The complete read trace',conditions:'Start at 3 and read twice.',source_ids:[]}],sources:[]});
const wire=value=>({attempt_id:value.attempt_id,candidate_sha256:value.candidate_sha256,request:value.request,
  plan_json:JSON.stringify({blocks:value.blocks,questions:value.questions,sources:value.sources})});
function connection(host){const dispatch=createDispatcher({host});let id=1;
  dispatch({jsonrpc:'2.0',id:id++,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'wire-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  return (method,params)=>dispatch({jsonrpc:'2.0',id:id++,method,params}).result;
}
test('legacy structured preparation bounds remain available to the explicit document compiler',()=>{
  assert.throws(()=>v.prepareToolFor('unsupported'),/verification_prepare_host/);
  assert.deepEqual(v.prepareTool.inputSchema.required,['attempt_id','candidate_sha256','request','blocks','questions','sources']);
  assert.equal(v.prepareTool.inputSchema.additionalProperties,false);
  assert.equal(v.prepareTool.inputSchema.properties.questions.maxItems,8);
  assert.equal(v.prepareTool.inputSchema.properties.blocks.maxItems,32);
  assert.equal(v.prepareTool.inputSchema.properties.sources.maxItems,8);
});
test('the explicit plan document produces exactly the structured plan and packet hashes',()=>{
  const original=args(),encoded=wire(original);assert.deepEqual(v.prepare(encoded),v.prepare(original));
  const spaced={...encoded,plan_json:JSON.stringify(JSON.parse(encoded.plan_json),null,2)};assert.deepEqual(v.prepare(spaced),v.prepare(original));
  assert.deepEqual(original,args());assert.deepEqual(encoded,wire(original));
  const text='Literal \\n and an integer read.';
  original.request+=' Supplied source: '+text;original.sources=[{id:'S',version:'given',text}];original.questions[0].source_ids=['S'];
  assert.deepEqual(v.prepare(wire(original)),v.prepare(original));
});
test('explicit plan decoding never repairs legacy malformed fields or relaxes plan validation',()=>{
  const original=args(),encoded=wire(original),document=JSON.parse(encoded.plan_json);
  for(const value of [{...original,blocks:JSON.stringify(original.blocks)},
    {attempt_id:original.attempt_id,candidate_sha256:original.candidate_sha256,request,blocks:'[]'},
    {...encoded,blocks:original.blocks},...['',null,'[]','{}','```json\n{}\n```','{}{}','x'.repeat(96001)].map(plan_json=>({...encoded,plan_json}))])assert.throws(()=>v.prepare(value));
  const invalid=[{...document,request:'Changed original'},
    {blocks:document.blocks,questions:document.questions},
    {...document,blocks:JSON.stringify(document.blocks)},
    {...document,blocks:[{text:'A claim',question_ids:['absent']}]},
    {...document,questions:[{...document.questions[0],source_ids:['absent']}]},
    {...document,questions:[{...document.questions[0],conditions:'bad\ud800text'}]},
    {...document,blocks:[{text:'sk-'+'SYNTHETIC'.repeat(4),question_ids:['trace']}]},
    {...document,sources:[{id:'S',version:'given',text:'Not present in the original'}]}];
  for(const value of invalid)assert.throws(()=>v.prepare({...encoded,plan_json:JSON.stringify(value)}));
  for(const plan_json of ['{"__proto__":{},"blocks":[],"questions":[],"sources":[]}',
    '{"blocks":[],"questions":[],"sources":[],"constructor":{}}'])assert.throws(()=>v.prepare({...encoded,plan_json}));
  let invoked=0;const accessor={...encoded};Object.defineProperty(accessor,'plan_json',{enumerable:true,get(){invoked++;return encoded.plan_json;}});
  assert.throws(()=>v.prepare(accessor));assert.equal(invoked,0);
});
test('the normal Claude MCP prepares the same plan without a new tool or a rewritten original',()=>{
  const input=wire(args()),result=connection('claude')('tools/call',{name:'explanation_prepare',arguments:input});
  assert.equal(result.isError,undefined);assert.deepEqual(result.structuredContent,v.exposePlan(v.prepare(args()),'claude'));
});
test('normal hooks bind exact document bytes and keep failed preparation attempts unavailable',()=>{
  const runtime=path.resolve(__dirname,'../.superpowers');
  for(const mode of ['valid','post-changed','malformed']){
    const root=fs.mkdtempSync(path.join(runtime,'preparation-wire-')),options={root,enabled:true,now:1000000},base={session_id:'wire-parent',turn_id:'wire-turn'};
    const event=input=>handleEvent({...base,...input},options),file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
    try{
      event({hook_event_name:'UserPromptSubmit',prompt:request});
      const input={...wire(args()),attempt_id:'current',candidate_sha256:'current'};
      if(mode==='malformed')input.plan_json='{"blocks":[]}';
      const pre={hook_event_name:'PreToolUse',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_prepare',tool_use_id:'wire-call',tool_input:input},result=event(pre);
      if(mode==='malformed'){
        assert.equal(result.hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
        assert.equal(event({...pre,tool_input:{...input,plan_json:wire(args()).plan_json}}).hookSpecificOutput.permissionDecision,'deny');continue;
      }
      const bound=result.hookSpecificOutput.updatedInput;assert.equal(bound.plan_json,input.plan_json);
      assert.equal(bound.attempt_id,read().attempt.id);assert.equal(bound.candidate_sha256,read().attempt.candidate);
      const response=connection('claude')('tools/call',{name:'explanation_prepare',arguments:bound});assert.equal(response.isError,undefined);
      const postInput=mode==='post-changed'?{...bound,plan_json:bound.plan_json+' '}:bound;
      const post=event({...pre,hook_event_name:'PostToolUse',tool_input:postInput,tool_response:response});
      if(mode==='post-changed'){assert.match(post.systemMessage,/could not record/);assert.equal(read().status,'unavailable');}
      else{assert.deepEqual(post,{});assert.equal(read().attempt.verification.facts[0].phase,'planned');assert.equal(Object.hasOwn(read(),'pending_tool'),false);assert.doesNotMatch(canonical(read()),/Daro|plan_json|Both reads/);}
    }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
  }
});
