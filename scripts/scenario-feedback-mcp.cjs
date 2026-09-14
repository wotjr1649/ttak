'use strict';
// Stdio only. Drafts are data, never commands, file paths, module names or network targets.
const { serve } = require('./review-mcp.cjs');
const { createDispatcher: protocolDispatcher } = require('./finite-scenario-mcp.cjs');
const { explainScenario } = require('./finite-scenario-render.cjs');
const { reviewScenarioDraft, MAX_DRAFT } = require('./scenario-draft.cjs');
const explanation = require('./explanation-attempt.cjs');
const verification = require('./explanation-verification.cjs');
const {checkedData,digest}=require('./verification-packet.cjs');
const {checkFactModelSources}=require('./explanation-source-model.cjs');
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const names = { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,31}$' } };
const predicate = object({ cells: names, at_least: { type: 'integer', minimum: 0, maximum: 16 } });
const state = { type: 'object', minProperties: 1, maxProperties: 16, additionalProperties: { type: 'boolean' } };
const tool = { name: 'scenario_review', description: 'Check an explanation draft against its finite boolean concurrency example. '
  + 'Supply the complete intended answer, including any proposed remedy and its trade-off, not claim labels or only the example. Returns sentence offsets, concrete contradiction/scope feedback, implementation reference notes, and a computed explanation. '
  + 'Revise identified sentences before answering. No findings is not a correctness certificate: unsupported prose remains unchecked. '
  + 'Guards read listed cells; constant writes are atomic. Does not run SQL, access files or use another model.',
  inputSchema: object({ scenario: object({ initial: state, invariant: predicate,
    transactions: { type: 'array', minItems: 1, maxItems: 4, items: object({
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,31}$' }, guard: predicate, writes: state }) } }),
    draft: { type: 'string', minLength: 1, maxLength: MAX_DRAFT }, language: { type: 'string', enum: ['en', 'ko'] } }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } };

function createDispatcher({host='codex'}={}) {
  verification.nativeAdapter(host);
  const tools=[tool,verification.prepareToolFor(host),verification.assessmentTool,explanation.assessmentNoticeTool,explanation.tool,explanation.repairTool,verification.nextTool,verification.finalToolFor(host),verification.correctionTool,
    host==='claude'?verification.packetTool:verification.dispatchTool,verification.resultReadToolFor(host),verification.finalPreviewTool,...verification.resultTools];
  // Reuse protocol/version/initialization validation without its diagnostic call counter.
  const protocol = protocolDispatcher();
  // One stdio connection owns this bounded, non-persistent packet cache. It has no
  // credentials, filesystem access, model execution or network destination.
  const plans=new Map();
  return request => {
    if (!request || !['tools/list', 'tools/call'].includes(request.method)) {
      const response = protocol(request);
      if (request?.method === 'initialize' && response?.result?.serverInfo) {
        response.result.serverInfo = { name: 'ttak-scenario-feedback', version: '0.1.0' };
      }
      return response;
    }
    const checked = protocol({ ...request, method: 'tools/list' });
    if (!checked || checked.error) return checked;
    const respond = result => ({ jsonrpc: '2.0', id: request.id, result });
    if (request.method === 'tools/list') return respond({tools});
    if(!tools.some(t=>t.name===request.params?.name))return {jsonrpc:'2.0',id:request.id,error:{code:-32602,message:'Unknown tool'}};
    if(request.params?.name===verification.finalPreviewTool.name){
      try{const payload=verification.finalPreview(request.params.arguments);
        return respond({content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload});}
      catch{return respond({isError:true,content:[{type:'text',text:'explanation_final_preview_unavailable: '+explanation.failureNotice}]});}
    }
    if(request.params?.name===verification.resultReadTool.name){
      try{const args=checkedData(request.params.arguments);let payload=verification.resultRead(args);
        const automaticNext=host==='claude'&&plans.has(args.attempt_id)&&plans.get(args.attempt_id).plan.purpose===undefined;
        if(args.include_next_step||automaticNext){
          const entry=plans.get(args.attempt_id),now=Date.now();
          if(args.include_next_step&&host!=='codex'||!entry||entry.plan.purpose!==undefined||entry.plan.candidate_sha256!==args.candidate_sha256||now<entry.created||now-entry.created>30*60*1000)
            throw new Error('verification_result_next_cache_unavailable');
          if(entry.next_reads.has(args.challenge))throw new Error('verification_result_next_spent');
        }
        if(payload.result.kind==='final'&&payload.result.verdict==='complete'){
          const entry=plans.get(args.attempt_id),now=Date.now();
          if(!entry||entry.plan.candidate_sha256!==args.candidate_sha256||now<entry.created||now-entry.created>30*60*1000)
            throw new Error('verification_delivery_cache_unavailable');
          const packet=entry.finals.get(1)??entry.finals.get(0);
          if(!packet||packet.challenge!==args.challenge)throw new Error('verification_delivery_final_unavailable');
          payload=verification.resultRead(args,packet);
        }
        if(payload.result.kind==='fact'){
          const entry=plans.get(args.attempt_id),now=Date.now();
          if(entry&&(entry.plan.purpose===undefined||entry.plan.purpose==='request_assessment')){
            if(entry.plan.candidate_sha256!==args.candidate_sha256||now<entry.created||now-entry.created>30*60*1000)
              throw new Error('verification_fact_read_cache_unavailable');
            const packet=entry.plan.packets.find(p=>p.challenge===args.challenge);
            if(!packet)throw new Error('verification_fact_read_packet_unavailable');
            if(entry.plan.purpose==='request_assessment'){
              if(entry.assessment_read||entry.assessment_result&&digest(entry.assessment_result)!==payload.result_sha256)
                throw new Error('verification_assessment_read_unavailable');
              const typed=verification.resultSubmission({...checkedData(JSON.parse(payload.result.answer)),challenge:packet.challenge,
                assessment_decision:payload.result.verdict==='answered'?'assessed':'assessment_failed',issues:payload.result.issues},'assessment');
              if(digest(typed.result)!==payload.result_sha256)throw new Error('verification_assessment_read_changed');
              entry.assessment_result=checkedData(payload.result);entry.assessment_read=true;
            }else{
              if(!entry.fact_results)throw new Error('verification_fact_read_packet_unavailable');
              if(entry.fact_reads.has(packet.id))throw new Error('verification_duplicate_fact_read');
              const previous=entry.fact_results.get(packet.id);
              if(previous&&digest(previous)!==payload.result_sha256)throw new Error('verification_fact_read_changed');
              entry.fact_results.set(packet.id,checkedData(payload.result));entry.fact_reads.add(packet.id);
            }
            // Separate Codex child connections cannot fill the parent cache at
            // submission. Carry only the exact read result here; native Pre/Post
            // receipts, not this non-persistent cache, authorize its later use.
          }
        }
        if(args.include_next_step||automaticNext){
          const entry=plans.get(args.attempt_id);let revision=null;
          if(payload.result.kind==='final'){
            revision=entry.finals.has(1)?1:0;
            if(entry.finals.get(revision)?.challenge!==args.challenge)throw new Error('verification_result_next_final_unavailable');
          }
          const context={remaining_facts:entry.plan.packets.filter(p=>!entry.fact_reads.has(p.id)).length,
            failed_facts:entry.plan.packets.filter(p=>entry.fact_reads.has(p.id)&&entry.fact_results.get(p.id).verdict!=='answered').length,revision};
          const packet=payload.result.kind==='fact'?entry.plan.packets.find(p=>p.challenge===args.challenge):entry.finals.get(revision);
          payload.next_step=host==='claude'?verification.claudeResultNextStep(payload.result,context,packet.id):verification.resultNextStep(payload.result,context);
          entry.next_reads.add(args.challenge);
        }
        return respond({content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload});}
      catch{return respond({isError:true,content:[{type:'text',text:'explanation_result_unavailable: '+explanation.failureNotice}]});}
    }
    if([verification.assessmentTool.name,verification.prepareTool.name,verification.nextTool.name,verification.finalTool.name,verification.correctionTool.name,verification.packetTool.name,verification.dispatchTool.name,...verification.resultTools.map(t=>t.name)].includes(request.params?.name)){
      try{
        let payload;const name=request.params.name,args=request.params.arguments,now=Date.now();
        for(const [id,entry]of plans)if(now-entry.created>30*60*1000)plans.delete(id);
        if(name===verification.assessmentTool.name){
          const plan=verification.prepareAssessment(args),old=plans.get(plan.attempt_id);
          if(!old&&plans.size>=8||old&&(old.assessment_used||old.plan.purpose!==undefined||old.plan.candidate_sha256!==plan.candidate_sha256||old.plan.request_sha256!==plan.request_sha256))
            throw new Error('verification_assessment_cache_unavailable');
          plans.set(plan.attempt_id,{plan,request:verification.normalizeRequest(args.request),assessment_used:true,assessment_result:null,assessment_read:false,finals:new Map(),created:old?.created??now});
          payload=verification.exposePlan(plan,host);
        }else if(name===verification.prepareTool.name){
          const plan=verification.prepare(args),old=plans.get(plan.attempt_id);
          if(!old&&plans.size>=8||old&&(old.plan.purpose!=='request_assessment'||old.plan.candidate_sha256!==plan.candidate_sha256||old.plan.request_sha256!==plan.request_sha256))
            throw new Error('verification_plan_cache_limit');
          plans.set(plan.attempt_id,{...old,plan,request:verification.normalizeRequest(args.request),fact_results:new Map(),fact_reads:new Set(),next_reads:new Set(),finals:new Map(),created:old?.created??now});payload=verification.exposePlan(plan,host);
        }else if(name===verification.nextTool.name){
          const entry=plans.get(args?.attempt_id);if(!entry)throw new Error('verification_plan_missing');
          payload=verification.nextPacket(entry.plan,args,host);
        }else if([verification.finalTool.name,verification.correctionTool.name].includes(name)){
          const input=name===verification.correctionTool.name?verification.correctionArguments(args):checkedData(args),entry=plans.get(input?.attempt_id);
          if(!entry||entry.plan.candidate_sha256!==input.candidate_sha256||entry.plan.purpose!==undefined)throw new Error('verification_final_packet_unavailable');
          const referenced=verification.usesFinalReferences(input)?verification.finalizeReferences(input,{request:entry.request,
            facts:entry.plan.packets.map(p=>({id:p.id,result:entry.fact_results.get(p.id)}))}):null;
          const compiled=referenced?referenced.payload:verification.finalize(input);
          if(entry.finals.has(compiled.revision))throw new Error('verification_final_packet_unavailable');
          payload=referenced?verification.exposeReferencedFinal(referenced,host):verification.exposeFinal(compiled,host);
          entry.finals.set(compiled.revision,compiled.packet);
        }else if(name===verification.dispatchTool.name){
          const entry=plans.get(args?.attempt_id);if(!entry)throw new Error('verification_plan_missing');
          const packets=[...entry.plan.packets,...entry.finals.values()].filter(p=>p.challenge===args?.challenge);
          if(packets.length!==1)throw new Error('verification_dispatch_packet_missing');
          payload=verification.dispatchPacket(entry.plan,packets[0],args);
        }else if(name===verification.packetTool.name){
          if(!args||Object.keys(args).length!==1||typeof args.challenge!=='string'||!/^([a-f0-9]{64})$/.test(args.challenge))throw new Error('verification_packet_request');
          const packets=[...plans.values()].flatMap(entry=>[...entry.plan.packets,...entry.finals.values()]).filter(p=>p.challenge===args.challenge);
          if(packets.length!==1)throw new Error('verification_packet_unavailable');payload=verification.packetBody(packets[0]);
        }
        else {
          if(name==='explanation_fact_result'){
            const input=checkedData(args),entries=[...plans.values()].filter(entry=>entry.plan.purpose===undefined&&entry.plan.packets.some(p=>p.challenge===input.challenge));
            if(entries.length>1)throw new Error('verification_fact_source_ambiguous');
            if(entries.length){const models=entries[0].plan.model_evidence;
              checkFactModelSources(input.answer,models?.length?[...new Set(models.map(entry=>entry.source.model_sha256))]:undefined,
                verification.initialVerification(entries[0].plan).facts[0].source_appendix_sha256s);}
          }
          payload=name==='explanation_final_result'?verification.finalReviewSubmission(args)
            :verification.resultSubmission(args,name==='explanation_fact_result'?'fact':name==='explanation_notice_result'?'notice':'assessment');
          for(const entry of plans.values())if(entry.plan.purpose==='request_assessment'&&entry.plan.packets[0].challenge===payload.result.challenge){
            if(name!=='explanation_assessment_result'||entry.assessment_result)throw new Error('verification_assessment_result_unavailable');
            entry.assessment_result=payload.result;
          }
          for(const entry of plans.values())if(entry.plan.purpose==='withholding'&&entry.plan.packet.challenge===payload.result.challenge){
            if(name!=='explanation_notice_result')throw new Error('withholding_notice_result_required');
            if(entry.review_result)throw new Error('withholding_duplicate_review_result');
            entry.review_result=payload.result;
          }
          for(const entry of plans.values())if(entry.plan.purpose===undefined){
            const packet=entry.plan.packets.find(p=>p.challenge===payload.result.challenge);
            if(packet){
              if(name!=='explanation_fact_result'||entry.fact_results.has(packet.id))throw new Error('verification_fact_result_unavailable');
              entry.fact_results.set(packet.id,checkedData(payload.result));
            }
          }
        }
        return respond({content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload});}
      catch{return respond({isError:true,content:[{type:'text',text:'explanation_verification_input_rejected: '+explanation.failureNotice}]});}
    }
    if (request.params?.name === explanation.assessmentNoticeTool.name) {
      try {
        const args=checkedData(request.params.arguments),now=Date.now();
        for(const [id,entry]of plans)if(now-entry.created>30*60*1000)plans.delete(id);
        const old=plans.get(args?.attempt_id);
        if(!old||!old.assessment_used||old.plan.purpose==='withholding'||old.plan.candidate_sha256!==args.candidate_sha256||typeof old.request!=='string')
          throw new Error('withholding_assessment_notice_cache_missing');
        const result=args.assessment_result==='current'?old.assessment_result:args.assessment_result;
        const compiled=explanation.noticeFromAssessment(args,old.request,result),review=compiled.proposal.review;
        if(review.request_sha256!==old.plan.request_sha256||old.assessment_result&&digest(old.assessment_result)!==review.assessment_sha256)
          throw new Error('withholding_assessment_changed');
        const payload=explanation.exposeAssessmentNotice(compiled,host);
        plans.set(review.attempt_id,{...old,plan:{...review,packets:[]},assessment_result:compiled.args.assessment_result,
          notice_args:compiled.args,review_result:null,finals:new Map([[0,review.packet]])});
        return respond({content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload});
      }catch{return respond({isError:true,content:[{type:'text',text:'explanation_assessment_notice_unavailable: '+explanation.failureNotice}]});}
    }
    if (request.params?.name === explanation.repairTool.name) {
      try {
        const args=checkedData(request.params.arguments),now=Date.now();
        for(const [id,entry]of plans)if(now-entry.created>30*60*1000)plans.delete(id);
        if(!args||Object.keys(args).length!==3||!['attempt_id','candidate_sha256','review_result'].every(k=>Object.hasOwn(args,k)))throw new Error('withholding_repair_input');
        const old=plans.get(args.attempt_id);
        if(!old||old.plan.purpose!=='withholding'||old.plan.candidate_sha256!==args.candidate_sha256||old.plan.revision!==0||old.finals.has(1)||!old.notice_args)
          throw new Error('withholding_repair_cache_missing');
        const result=args.review_result==='current'?old.review_result:args.review_result;
        const compiled=explanation.repairProposal(old.notice_args,result),payload=explanation.exposeRepair(compiled,host),review=compiled.proposal.review;
        const finals=new Map(old.finals);finals.set(1,review.packet);
        plans.set(review.attempt_id,{...old,plan:{...review,packets:[]},finals,review_result:null});
        return respond({content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload});
      }catch{return respond({isError:true,content:[{type:'text',text:'explanation_notice_repair_unavailable: '+explanation.failureNotice}]});}
    }
    if (request.params?.name === explanation.tool.name) {
      try {
        const args=checkedData(request.params.arguments),now=Date.now();
        for(const [id,entry]of plans)if(now-entry.created>30*60*1000)plans.delete(id);
        const old=plans.get(args.attempt_id),reuse=args.request==='current',reuseAssessment=args.assessment_result==='current';
        if(reuse||reuseAssessment)explanation.selectedDecision(args);
        if(!old||!old.assessment_used||old.plan.candidate_sha256!==args.candidate_sha256||typeof old.request!=='string')throw new Error('withholding_request_cache_missing');
        const resolved=reuse?old.request:args.request,assessment=reuseAssessment?old.assessment_result:args.assessment_result;
        const original={...args,request:resolved,assessment_result:assessment},proposal=explanation.propose(original),review=proposal.review;
        if(review.request_sha256!==old.plan.request_sha256||old.assessment_result&&digest(old.assessment_result)!==review.assessment_sha256)
          throw new Error('withholding_assessment_changed');
        if(review.revision===0&&old?.plan.purpose==='withholding'||review.revision===1&&
          (!old||old.plan.purpose!=='withholding'||old.finals.has(1)))throw new Error('withholding_revision_not_available');
        const finals=old?.plan.purpose==='withholding'?new Map(old.finals):new Map();finals.set(review.revision,review.packet);
        const payload = explanation.exposeDecision(proposal,host,reuse?resolved:undefined,reuseAssessment?assessment:undefined);
        plans.set(review.attempt_id,{...old,plan:{...review,packets:[]},request:verification.normalizeRequest(resolved),assessment_result:assessment,
          notice_args:original,review_result:null,finals});
        return respond({ content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload });
      } catch {
        return respond({ isError: true, content: [{ type: 'text', text: 'explanation_decision_unavailable: '+explanation.failureNotice }] });
      }
    }
    if (request.params?.name !== tool.name) return { jsonrpc: '2.0', id: request.id,
      error: { code: -32602, message: 'Unknown tool' } };
    const args = request.params.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 3 ||
      !['scenario', 'draft', 'language'].every(key => Object.hasOwn(args, key))) {
      return { jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Invalid tool arguments' } };
    }
    try {
      const feedback = reviewScenarioDraft(args.scenario, args.draft, args.language);
      const payload = { ...feedback, computed: explainScenario(args.scenario, args.language) };
      return respond({ content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload });
    } catch {
      return respond({ isError: true, content: [{ type: 'text', text: 'invalid_scenario_draft_arguments' }] });
    }
  };
}

if (require.main === module) {
  process.stdout.on('error', () => process.stdin.destroy());
  try{
    const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--host'||!['claude','codex'].includes(args[1]))throw new Error('invalid_plugin_host');
    serve(process.stdin,process.stdout,createDispatcher({host:args[1]})).catch(()=>{process.exitCode=1;});
  }catch{process.stderr.write('invalid_plugin_host\n');process.exitCode=2;}
}
module.exports = { createDispatcher, tool };
