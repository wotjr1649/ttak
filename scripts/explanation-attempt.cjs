'use strict';
// Pure protocol: text is data. No files, processes, network or model calls.
const { createHash } = require('node:crypto');
const { checkedVerification, prepareWithholding, exposeFinal, normalizeRequest, checkedNoticeCorrection, noticeCorrectionSchema,
  parseAnswer, checkNoticeRepair, registerWithholding, requestScope, prepareAssessment, resultSubmission, observedAssessment,
  checkWithholdingTransition, noticeGapSchema } = require('./explanation-verification.cjs');
const { checkedData, canonical, digest } = require('./verification-packet.cjs');
const hash = text => createHash('sha256').update(text).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const NOTICE_FORBIDDEN = '[\\r\\n<>`]';
const forbiddenNoticeText = new RegExp(NOTICE_FORBIDDEN);
const DECISION_FIELDS = ['attempt_id', 'candidate_sha256', 'disposition', 'language', 'unresolved'];
const failureNotice = 'This explanation attempt is unverified. Neither the explanation nor its proposed notice is approved. '
  + 'Report the failed check without claiming approval; do not make further verification calls for this attempt. '
  + 'Keep the original requirements unchanged. A failed check needs restoration of the check, not removal of a user requirement.';
function checkedText(value, limit = 24000) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > limit ||
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+\S{12,}|eyJ[A-Za-z0-9_-]{20,}\.)|-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value) ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\u202a-\u202e\u2066-\u2069]/.test(value) || !value.isWellFormed()) {
    throw new Error('explanation_text_rejected');
  }
  return value;
}
function requested(prompt) {
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > 65536) return false;
  // Routing only, never evidence of completeness or semantic correctness.
  const visible = prompt.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|^\s*>.*$/gm, '')
    .replace(/\b(?:do\s+not|don['’]t|never)\s+(?:explain|give|provide|write|create|offer)\b[^.;!?\n]*/gi, '')
    .replace(/설명(?:을\s*)?(?:반복)?하지\s*(?:말|마)[^.!?\n]*/g, '');
  return /\bttak[-:]explain\b|\bexplain\b|\b(?:give|provide|write|create|offer)\b[^.!?\n]{0,100}\bexplanation\b|\bbreak\s+(?:this|it)\s+down\b|\bwalk\s+me\s+through\b|설명(?:해|하)|풀어서\s*(?:말|알려)/i.test(visible);
}
function begin(id, candidate) {
  return checkedAttempt({ id, candidate, status: 'pending', final_sha256: null, unmet: 0, corrections: 0 });
}
function checkedAttempt(value) {
  const fields=['id','candidate','status','final_sha256','unmet','corrections'];
  if(value&&Object.hasOwn(value,'verification'))fields.push('verification');
  if (!exact(value, fields) ||
      !uuid(value.id) || !hex(value.candidate) || !['pending', 'withheld', 'complete', 'unavailable', 'cancelled'].includes(value.status) ||
      !(value.final_sha256 === null || hex(value.final_sha256)) ||
      !Number.isSafeInteger(value.unmet) || value.unmet < 0 || value.unmet > 8 ||
      !Number.isSafeInteger(value.corrections) || value.corrections < 0 || value.corrections > 1 ||
      (value.status === 'withheld' && (!hex(value.final_sha256) || !value.unmet))) {
    throw new Error('invalid_explanation_attempt');
  }
  if(value.verification)checkedVerification(value.verification);
  if(value.status==='complete'&&(!value.verification||value.verification.purpose==='withholding'||value.verification.final?.phase!=='returned'||
    value.verification.final.verdict!=='complete'||value.final_sha256!==value.verification.final_sha256||
    !value.verification.facts.every(s=>s.phase==='returned'&&s.verdict==='answered')))throw new Error('independent_completion_evidence_required');
  if(value.status==='withheld'&&(!value.verification||value.verification.purpose!=='withholding'||value.verification.final?.phase!=='returned'||
    value.verification.final.verdict!=='complete'||value.final_sha256!==value.verification.final_sha256))throw new Error('independent_withholding_review_required');
  return value;
}
function decide(args) {
  const fields = Object.hasOwn(args ?? {}, 'corrections') ? [...DECISION_FIELDS, 'corrections'] : DECISION_FIELDS;
  if (!exact(args, fields) ||
      !uuid(args.attempt_id) || !hex(args.candidate_sha256) || !['en', 'ko'].includes(args.language) ||
      !['complete', 'withheld'].includes(args.disposition)) throw new Error('invalid_explanation_decision');
  // There is deliberately no model-controlled supported flag that can issue a completion certificate.
  // Completion needs the independent verification path, not this withholding protocol.
  if (args.disposition === 'complete') throw new Error('independent_completion_evidence_required');
  if (!Array.isArray(args.unresolved) || !args.unresolved.length || args.unresolved.length > 8) throw new Error('unresolved_requirements_required');
  const ko = args.language === 'ko';
  const lines = args.unresolved.map((item, index) => {
    const fields=['requirement','reason','evidence_needed'];if(Object.hasOwn(item??{},'request_quote'))fields.push('request_quote');
    if (!exact(item, fields) ||
        !['missing_evidence', 'contradicted', 'failed_check'].includes(item.reason)) throw new Error('invalid_unresolved_requirement');
    if(Object.hasOwn(item,'request_quote'))checkedText(item.request_quote,1000);
    for (const field of ['requirement', 'evidence_needed']) {
      checkedText(item[field], 480);
      if (forbiddenNoticeText.test(item[field])) throw new Error('unresolved_requirement_not_plain_text');
    }
    const reason = ko ? { missing_evidence: '근거 부족', contradicted: '근거와 모순', failed_check: '검사 실패' }[item.reason]
      : { missing_evidence: 'missing evidence', contradicted: 'contradicted', failed_check: 'failed check' }[item.reason];
    return `${index + 1}. ${item.requirement} (${reason}). ${ko ? '필요한 근거 또는 복구' : 'Evidence or recovery needed'}: ${item.evidence_needed}`;
  });
  const corrections = args.corrections ?? [];
  if (!Array.isArray(corrections) || corrections.length > 4 || args.corrections === null) throw new Error('invalid_explanation_corrections');
  const corrected = corrections.map((item, index) => {
    if (!exact(item, ['claim', 'correction', 'basis'])) throw new Error('invalid_explanation_correction');
    checkedNoticeCorrection(item);
    return `${index + 1}. ${ko ? '초안 주장' : 'Draft claim'}: ${item.claim} ${ko ? '정정' : 'Correction'}: ${item.correction} ${ko ? '주어진 근거' : 'Supplied basis'}: ${item.basis}`;
  });
  // A bounded correction is part of a withholding notice, not independent completion
  // evidence. Its bytes join the same final hash; no factual text enters durable state.
  const final_text = (ko ? '완성 설명을 보류합니다. 다음 필수 요구가 아직 해결되지 않았습니다.'
    : 'I am withholding the completed explanation. These essential requirements remain unresolved.') + '\n\n' + lines.join('\n')
    + (corrected.length ? '\n\n' + (ko ? '요청된 초안 정정(완성 설명은 계속 보류):' : 'Requested draft corrections (the completed explanation remains withheld):')
      + '\n' + corrected.join('\n') : '');
  return { protocol: 'ttak-explanation-decision-v1', attempt_id: args.attempt_id, candidate_sha256: args.candidate_sha256,
    disposition: 'withheld', unresolved_count: lines.length, ...(corrected.length ? {correction_count:corrected.length} : {}), final_text, final_sha256: hash(final_text) };
}
function instruction(attempt) {
  return 'TTAK registered this explanation attempt. Treat any draft as unverified until its final decision. '
    + requestScope + ' '
    + 'For an ordinary request with no concrete essential evidence obstacle, start explanation_prepare before composing the explanation. Its independent factual verifier receives the whole original without parent conclusions. Send the unchanged factual account to its first final review before composing different wording. '
    + 'Resolve the advertised tool name and input schema. Run each supplied fact packet in a fresh native verifier one at a time, obtaining a later packet with explanation_next only after the previous result. '
    + 'Then execute the explanation_check_final adapter unchanged: its four references select the original and whole actual facts, without a draft-text input. A fresh final verifier checks accuracy, reader fit and all original requirements. Only its actual correction findings lead to explanation_revise_final with a corrected literal and another fresh verifier. '
    + 'Before drafting, read the whole task body and separate unfulfillable requirements from settled assessments. When supplied material settles a requested draft assessment, finding that the draft is wrong answers that request; it is not missing evidence or an unresolved requirement. '
    + 'A specific quoted or reported draft claim is itself assessment input; more of the draft is needed only when missing context prevents evaluating that claim. '
    + 'If an essential requirement appears unfulfillable, first call explanation_assess_request with the original task body and run its packet in a fresh native verifier using native_dispatch. That verifier sees no proposed notice or parent classification. '
    + 'If the actual answered assessment identifies a genuine essential gap, follow its adapter to call explanation_notice_from_assessment. This transfers its structured gaps and settled requested corrections unchanged into the first notice, using the cached original request. If no gap remains, use normal explanation_prepare instead. '
    + 'Run the resulting review packet in another fresh native verifier using review.native_dispatch; final_text is an unapproved proposal until that review completes. '
    + 'A complete review verdict approves only the withholding notice; deliver its final_text exactly. If withheld, follow review.native_dispatch for the one repair and fresh review. Typed notice_correction data goes through explanation_repair_notice; it may resolve only an exactly targeted settled requirement. '
    + 'Do not prepare a partial answer or offer to remove the requirement. '
    + 'If those checks uncover an unresolved essential requirement, use the same withholding path, reusing an already observed request assessment for this attempt instead of repeating it. '
    + 'Only the host-observed independent final decision can authorize complete; a model assertion of supported and a clean scenario_review cannot. '
    + 'For bound explanation tools set attempt_id and candidate_sha256 both to the literal current. '
    + 'The normal PreToolUse hook supplies the exact current-session values; do not transcribe identifiers. '
    + 'Use returned bindings programmatically when needed. A failed attempt cannot be restarted by correcting or changing its identifiers. '
    + 'Internal continuation tag: '+hash(attempt.id+':'+attempt.candidate).slice(0,16)+'.';
}
function continuation(attempt) {
  checkedAttempt(attempt);
  if(attempt.status==='pending'&&attempt.verification?.purpose==='request_assessment')return 'TTAK request-and-evidence assessment is pending notice construction. '
    +(attempt.verification.facts[0].phase==='returned'
      ? 'Use its actual answered result with explanation_notice_from_assessment if a genuine essential gap remains, or use explanation_prepare for normal drafting otherwise. '
      : 'Run the issued assessment packet once using its native_dispatch; do not compose or deliver a notice before that actual result. ')
    +'The assessment does not approve the explanation or a notice. Do not restart it. Internal assessment tag: '+hash(attempt.id+':'+attempt.candidate+':'+attempt.verification.plan_sha256).slice(0,16)+'.';
  if(attempt.status==='pending'&&attempt.verification?.purpose==='withholding')return 'TTAK withholding notice review is still pending. '
    +'Run the issued review packet in its fresh native verifier using review.native_dispatch; the notice is not yet approved for delivery. '
    +'If that review returned withheld, follow review.native_dispatch for the one repair and fresh review. Typed notice_correction data goes through explanation_repair_notice; it may resolve only an exactly targeted settled requirement. '
    +'Do not restart the attempt or present the full explanation. Internal notice-review tag: '+hash(attempt.id+':'+attempt.candidate+':'+attempt.verification.final_sha256).slice(0,16)+'.';
  if (attempt.status === 'pending') return instruction(attempt);
  if (!['withheld', 'complete'].includes(attempt.status)) return null;
  const source = attempt.status === 'withheld'
    ? 'TTAK has already withheld this explanation. Copy the final_text returned by the latest accepted explanation_notice_from_assessment, explanation_decide or explanation_repair_notice whose native notice verifier returned complete'
    : 'TTAK has already independently approved this explanation. Copy delivery.final_text from the latest successful explanation_result whose final result returned complete. For a legacy full-result verifier return without explanation_result, copy the literal final_text from the reviewed final packet instead';
  return source + ' exactly as the entire final assistant message. This is a delivery-only correction of the already-bound text. '
    + 'Do not call tools, repeat verification, restart the attempt, change the requirement, acknowledge this instruction, or add a preface or closing text. '
    + 'The tool receipt or verifier JSON is not the explanation body. '
    + 'Internal delivery tag: '+hash(attempt.id+':'+attempt.candidate+':'+attempt.status+':'+attempt.final_sha256).slice(0,16)+'.';
}
function proposalInput(value){
  const input=checkedData(value);
  if(!Object.hasOwn(input??{},'request')||!Object.hasOwn(input??{},'revision'))throw new Error('withholding_review_input_required');
  if(!Object.hasOwn(input??{},'corrections'))throw new Error('withholding_corrections_required');
  if(!Object.hasOwn(input??{},'assessment_result'))throw new Error('withholding_assessment_required');
  return input;
}
function propose(value){
  const {request,revision,assessment_result,...args}=proposalInput(value);
  checkedText(request,32000);
  const decision=decide(args),review=prepareWithholding({...args,request,revision,assessment_result},decision);
  return {decision,review};
}
function revisionDecision(value){
  const {request,revision}=proposalInput(value);
  if(request!=='current'||revision!==1)throw new Error('withholding_revision_selector');
  return selectedDecision(value);
}
function selectedDecision(value){
  const {request,revision,assessment_result,...args}=proposalInput(value);
  if(request!=='current'&&assessment_result!=='current')throw new Error('withholding_cache_selector');
  checkedText(request,32000);if(![0,1].includes(revision))throw new Error('withholding_revision_selector');
  if(assessment_result!=='current'){
    const result=parseAnswer(canonical(assessment_result),{kind:'fact',challenge:assessment_result?.challenge});
    if(result.verdict!=='answered')throw new Error('withholding_assessment_unresolved');
  }
  const decision=decide(args);for(const item of args.unresolved)checkedText(item.request_quote,1000);
  return decision;
}
function exposeDecision(proposal,host='codex',resolvedRequest,resolvedAssessment){
  if(resolvedRequest!==undefined){checkedText(resolvedRequest,32000);
    if(hash(normalizeRequest(resolvedRequest))!==proposal.review.request_sha256)throw new Error('withholding_resolved_request_mismatch');}
  if(resolvedAssessment!==undefined&&digest(checkedData(resolvedAssessment))!==proposal.review.assessment_sha256)throw new Error('withholding_resolved_assessment_mismatch');
  const payload={...proposal.decision,revision:proposal.review.revision,notice_authorized:false,review:exposeFinal(proposal.review,host),
    ...(resolvedRequest!==undefined?{resolved_request:resolvedRequest}:{}),...(resolvedAssessment!==undefined?{resolved_assessment:resolvedAssessment}:{})};
  if(Buffer.byteLength(canonical(payload))>65536)throw new Error('withholding_response_limit');
  return payload;
}
function assessmentNoticeInput(value){
  const args=checkedData(value);
  if(!exact(args,['attempt_id','candidate_sha256','assessment_result','language'])||!uuid(args.attempt_id)||!hex(args.candidate_sha256)||
    !['en','ko'].includes(args.language))throw new Error('withholding_assessment_notice_input');
  return args;
}
function noticeFromAssessment(value,requestValue,resultValue){
  const input=assessmentNoticeInput(value),request=normalizeRequest(requestValue);
  const packet=prepareAssessment({attempt_id:input.attempt_id,candidate_sha256:input.candidate_sha256,request}).packets[0];
  const assessment_result=parseAnswer(canonical(checkedData(resultValue)),packet);
  if(assessment_result.verdict!=='answered')throw new Error('withholding_assessment_unresolved');
  if(input.assessment_result!=='current'&&digest(input.assessment_result)!==digest(assessment_result))throw new Error('withholding_assessment_changed');
  const findings=checkedData(JSON.parse(assessment_result.answer));
  const typed=resultSubmission({...findings,challenge:packet.challenge,assessment_decision:'assessed',issues:assessment_result.issues},'assessment').result;
  if(canonical(typed)!==canonical(assessment_result))throw new Error('withholding_assessment_findings_changed');
  const args={attempt_id:input.attempt_id,candidate_sha256:input.candidate_sha256,request,assessment_result,
    language:input.language,disposition:'withheld',revision:0,unresolved:findings.essential_gaps,corrections:findings.corrections};
  return {args,proposal:propose(args)};
}
function exposeAssessmentNotice(compiled,host='codex'){
  const payload={...exposeDecision(compiled.proposal,host),
    source_assessment:{request:compiled.args.request,assessment_result:compiled.args.assessment_result}};
  if(Buffer.byteLength(canonical(payload))>65536)throw new Error('withholding_response_limit');return payload;
}
function checkAssessmentNoticeArguments(value,attempt){
  const args=assessmentNoticeInput(value);checkedAttempt(attempt);
  const observed=observedAssessment(attempt);
  if(args.assessment_result!=='current'&&digest(args.assessment_result)!==observed.reply_sha256)throw new Error('withholding_unobserved_assessment');
  const requestHash=attempt.verification.request_sha256;
  checkWithholdingTransition(attempt,{attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,purpose:'withholding',revision:0,
    request_sha256:requestHash,assessment_sha256:observed.reply_sha256},requestHash);
  return args;
}
function registerAssessmentNotice(attempt,value,payload,host,requestHash){
  const args=checkAssessmentNoticeArguments(value,attempt),data=checkedData(payload);
  const compiled=noticeFromAssessment(args,data.source_assessment?.request,data.source_assessment?.assessment_result);
  if(canonical(data)!==canonical(exposeAssessmentNotice(compiled,host)))throw new Error('withholding_assessment_notice_changed');
  return registerWithholding(attempt,compiled.proposal.review,requestHash);
}
function checkRepairArguments(value,attempt){
  const args=checkedData(value);
  if(!exact(args,['attempt_id','candidate_sha256','review_result'])||args.attempt_id!==attempt.id||args.candidate_sha256!==attempt.candidate)
    throw new Error('withholding_repair_binding');
  checkNoticeRepair(attempt,args.review_result);return args;
}
function repairProposal(value,reviewValue){
  const original=checkedData(value),previous=propose(original);
  if(original.revision!==0)throw new Error('withholding_repair_revision');
  const review_result=parseAnswer(canonical(reviewValue),previous.review.packet);
  if(review_result.verdict!=='withheld'||!review_result.issues.every(issue=>Object.hasOwn(issue,'notice_correction')))
    throw new Error('withholding_repair_issue_type');
  const corrections=[...(original.corrections??[]),...review_result.issues.map(issue=>{
    const {resolves_request_quote,...item}=issue.notice_correction;return checkedNoticeCorrection(item);
  })];
  if(new Set(corrections.map(item=>item.claim)).size!==corrections.length)throw new Error('withholding_repair_duplicate_correction');
  const resolved=review_result.issues.map(issue=>issue.notice_correction).filter(item=>Object.hasOwn(item,'resolves_request_quote')).map(item=>item.resolves_request_quote);
  if(new Set(resolved).size!==resolved.length||resolved.some(quote=>original.unresolved.filter(item=>item.request_quote===quote).length!==1))
    throw new Error('withholding_repair_unknown_or_duplicate_target');
  const revised={...original,revision:1,corrections,unresolved:original.unresolved.filter(item=>!resolved.includes(item.request_quote))};
  const proposal=propose(revised);
  return {original,review_result,previous,revised,proposal};
}
function exposeRepair(compiled,host='codex'){
  const payload={...exposeDecision(compiled.proposal,host),repair:{original:compiled.original,review_result:compiled.review_result}};
  if(Buffer.byteLength(canonical(payload))>65536)throw new Error('withholding_response_limit');return payload;
}
function registerRepair(attempt,value,payload,host,requestHash){
  const args=checkRepairArguments(value,attempt),data=checkedData(payload);
  const compiled=repairProposal(data.repair?.original,data.repair?.review_result);
  checkNoticeRepair(attempt,compiled.review_result);
  if(digest(compiled.previous.review)!==attempt.verification.plan_sha256||canonical(data)!==canonical(exposeRepair(compiled,host))||
    args.review_result!=='current'&&digest(args.review_result)!==digest(compiled.review_result))throw new Error('withholding_repair_changed');
  return registerWithholding(attempt,compiled.proposal.review,requestHash);
}
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const tool = { name: 'explanation_decide', description: 'After the actual independent request-and-evidence assessment, propose the exact withholding notice and prepare another fresh native review against the unchanged original request. '
  + requestScope + ' '
  + 'This tool cannot certify factual completeness. Use the current hook-provided attempt and candidate binding. '
  + 'Use revision 0 initially. Run review.packet using review.native_dispatch; only a complete native review approves this notice, not the full explanation. Follow that adapter for the one repair and fresh review if needed. '
  + 'The Stop hook verifies the actual native review and exact final text. Report unresolved requirements and the evidence or failed check to restore. '
  + 'Supply corrections explicitly. A requested assessment settled by supplied evidence is an answered requirement even when the draft claim is false; put that assessment in corrections, not unresolved. This is a short withholding notice, not the full explanation.',
  inputSchema: {...object({ attempt_id: { type: 'string' }, candidate_sha256: { type: 'string' },
    request:{type:'string',minLength:1,maxLength:32000,description:requestScope+' After explanation_assess_request, use current to reuse that exact request from this bounded connection for revision 0 or 1. The hook independently checks the resolved original bytes and result. A missing cache, changed request or different attempt is rejected.'},
    revision:{type:'integer',minimum:0,maximum:1},
    assessment_result:{oneOf:[{type:'string',const:'current'},{type:'object'}],description:'The actual answered REQUEST_ASSESSMENT native fact result. After its actual result read, current reuses the parent connection cache on either host. An explicitly retained result can also be transferred programmatically without reconstruction. The hook checks its observed native receipt hash.'},
    disposition: { type: 'string', enum: ['withheld'] }, language: { type: 'string', enum: ['en', 'ko'] },
    unresolved: { type: 'array', minItems: 1, maxItems: 8, items: noticeGapSchema },
    corrections: { type:'array',maxItems:4,description:'Always supply this array. Include every short draft assessment explicitly requested by the user and already settled by supplied evidence. Use an empty array only when there is no such assessment. A false draft claim is resolved by its supported correction, not a request for more evidence. Do not include a complete explanation or optional claims. An uncertain assessment remains unresolved.',
      items:noticeCorrectionSchema }
  }),required:[...DECISION_FIELDS,'corrections','request','revision','assessment_result']},
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } };
const assessmentNoticeTool={name:'explanation_notice_from_assessment',description:'Build the initial withholding notice directly from the actual independent request assessment. '
  +'Transfers all structured essential_gaps and corrections unchanged and reuses the exact original request in this bounded connection. '
  +'Use the assessment adapter recipe. This tool does not approve the notice: run its review.native_dispatch in another fresh native verifier and deliver final_text exactly only after complete. '
  +'An empty gap list requires the normal explanation_prepare path instead. Existing one-revision repair rules remain in effect.',
  inputSchema:object({attempt_id:{type:'string'},candidate_sha256:{type:'string'},assessment_result:{oneOf:[{type:'string',const:'current'},{type:'object'}],
    description:'The exact observed native REQUEST_ASSESSMENT result. current reuses the parent connection cache after the actual result read. The supplied Codex recipe transfers its retained assessment unchanged, or uses current after normal fact checks. The hook independently checks the native receipt hash.'},language:{type:'string',enum:['en','ko']}}),
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}};
const repairTool={name:'explanation_repair_notice',description:'Apply the actual native notice reviewer\'s typed notice_correction fields directly to corrections. '
  +'Every issue must supply such a correction. Preserve the cached original request; remove an unresolved entry only when notice_correction.resolves_request_quote targets it exactly and supplies its settled correction. Preserve all other unresolved entries. Consume the one notice revision and prepare a fresh independent review. '
  +'Use review.native_dispatch\'s complete repair recipe. This tool does not approve the notice or complete the explanation.',
  inputSchema:object({attempt_id:{type:'string'},candidate_sha256:{type:'string'},review_result:{oneOf:[{type:'string',const:'current'},{type:'object'}],
    description:'The exact observed native review result. Claude uses current for its same-connection typed result; Codex passes the retained result object using the supplied recipe. The hook independently verifies its native receipt hash.'}}),
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}};
module.exports = { requested, begin, checkedAttempt, checkedText, decide, propose, revisionDecision, exposeDecision, instruction, continuation, hash, tool,
  checkRepairArguments,repairProposal,exposeRepair,registerRepair,repairTool,failureNotice,selectedDecision,
  noticeFromAssessment,exposeAssessmentNotice,checkAssessmentNoticeArguments,registerAssessmentNotice,assessmentNoticeTool };
