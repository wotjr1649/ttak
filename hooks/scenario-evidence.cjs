'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { analyzeScenario } = require('../scripts/finite-scenario.cjs');
const { explainScenario } = require('../scripts/finite-scenario-render.cjs');
const { reviewScenarioDraft } = require('../scripts/scenario-draft.cjs');
const { dataRoot, readState, parseControl } = require('./ttak.cjs');
const attempts = require('../scripts/explanation-attempt.cjs');
const verification = require('../scripts/explanation-verification.cjs');
const {readCurrentRequest}=require('../scripts/explanation-request-source.cjs');
const {readSubmittedResult}=require('../scripts/explanation-result-source.cjs');
const {digest: dataDigest}=require('../scripts/verification-packet.cjs');

const TOOL = 'mcp__ttak_scenario__scenario_review';
const DECISION_TOOL = 'mcp__ttak_scenario__explanation_decide';
const ASSESSMENT_TOOL = 'mcp__ttak_scenario__explanation_assess_request';
const ASSESSMENT_NOTICE_TOOL = 'mcp__ttak_scenario__explanation_notice_from_assessment';
const REPAIR_TOOL = 'mcp__ttak_scenario__explanation_repair_notice';
const PREPARE_TOOL = 'mcp__ttak_scenario__explanation_prepare', FINAL_TOOL = 'mcp__ttak_scenario__explanation_check_final';
const CORRECT_TOOL = 'mcp__ttak_scenario__explanation_revise_final';
const NEXT_TOOL='mcp__ttak_scenario__explanation_next';
const PACKET_TOOL='mcp__ttak_scenario__explanation_packet';
const DISPATCH_TOOL='mcp__ttak_scenario__explanation_dispatch';
const READ_RESULT_TOOL='mcp__ttak_scenario__explanation_result';
const FINAL_PREVIEW_TOOL='mcp__ttak_scenario__explanation_final_preview';
const RESULT_TOOLS={'mcp__ttak_scenario__explanation_fact_result':'fact','mcp__ttak_scenario__explanation_final_result':'final','mcp__ttak_scenario__explanation_notice_result':'notice','mcp__ttak_scenario__explanation_assessment_result':'assessment'};
const BOUND_TOOLS=[ASSESSMENT_TOOL,ASSESSMENT_NOTICE_TOOL,DECISION_TOOL,REPAIR_TOOL,PREPARE_TOOL,FINAL_TOOL,CORRECT_TOOL,NEXT_TOOL,DISPATCH_TOOL,READ_RESULT_TOOL];
const CANDIDATE_FILES = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json',
  '.claude-plugin/mcp.json',
  'hooks/hooks.json', 'hooks/ttak.cjs', 'hooks/scenario-evidence.cjs', 'hooks/scenario-stop.cjs',
  'scripts/explanation-attempt.cjs', 'scripts/scenario-feedback-mcp.cjs', 'scripts/scenario-draft.cjs',
  'scripts/finite-scenario.cjs', 'scripts/finite-scenario-render.cjs', 'scripts/finite-scenario-mcp.cjs',
  'scripts/review-mcp.cjs', 'scripts/review-session.cjs', 'scripts/review-repair.cjs', 'skills/ttak-explain/SKILL.md',
  'scripts/explanation-verification.cjs','scripts/explanation-review-checks.cjs','scripts/explanation-request-source.cjs','scripts/explanation-result-source.cjs','scripts/explanation-source-model.cjs','scripts/verification-packet.cjs','scripts/review-native-format.cjs',
  'scripts/review-roles.cjs','scripts/review-anchors.cjs','scripts/source-text-anchors.cjs','agents/ttak-fact-check.md',
  'policy/precedence.md','policy/invariants.md','policy/contract.md'];
function candidateDigest() {
  const hash = createHash('sha256');
  for (const file of CANDIDATE_FILES) {
    const target = path.join(__dirname, '..', file), stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) throw new Error('unsafe_attempt_candidate');
    hash.update(file + '\0').update(fs.readFileSync(target)).update('\0');
  }
  return hash.digest('hex');
}
const MAX_INPUT = 131072, MAX_STATE = 32768, MAX_FILES = 256;
const TTL = 30 * 60 * 1000;
const UNAVAILABLE = { systemMessage: 'TTAK could not record or use the evidence for its bounded final explanation check. No correctness verdict was produced.' };
const PREVIOUS_FAILURE = 'The previous explanation remains unverified because its check failed or its evidence was unavailable. '
  + 'A new request needs its own check; starting it does not verify the previous explanation.';
function notice(event, text) {
  return { systemMessage: text, ...(['SessionStart', 'UserPromptSubmit', 'SubagentStart', 'PostToolUse'].includes(event)
    ? { hookSpecificOutput: { hookEventName: event, additionalContext: text } } : {}) };
}
const COMPLETION_RULE = 'Deliver the complete explanation when the required claims are supported. '
  + 'If a required claim remains contradicted or unsupported, withhold the completed explanation and state '
  + 'the unresolved claim and the evidence needed to resolve it. Distinguish missing evidence from a failed '
  + 'check; use evidence already supplied rather than asking the user to supply it again. ';
const digest = value => createHash('sha256').update(value).digest('hex');
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) &&
  !/^(?:sk-|gh[pousr]_)/i.test(value);
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));

// Keep only the finite model, with generated ordinal names. Drafts, original
// identifiers, tool text, transcript paths and user prompts never enter the store.
function canonicalScenario(input) {
  analyzeScenario(input);
  const cells = Object.keys(input.initial);
  const cell = name => 'C' + (cells.indexOf(name) + 1);
  const predicate = value => ({ cells: value.cells.map(cell), at_least: value.at_least });
  return { initial: Object.fromEntries(cells.map(name => [cell(name), input.initial[name]])),
    invariant: predicate(input.invariant), transactions: input.transactions.map((transaction, index) => ({
      id: 'T' + (index + 1), guard: predicate(transaction.guard),
      writes: Object.fromEntries(Object.entries(transaction.writes).map(([name, value]) => [cell(name), value]))
    })) };
}

function checkedState(value) {
  const fields = ['version', 'epoch', 'turn', 'updated', 'status', 'scenarios'];
  if (value && Object.hasOwn(value, 'attempt')) fields.push('attempt');
  if (value && Object.hasOwn(value, 'request_sha256')) fields.push('request_sha256');
  if (value && Object.hasOwn(value, 'pending_tool')) fields.push('pending_tool');
  if (!keys(value, fields) || value.version !== 1 ||
    typeof value.epoch !== 'string' || !/^[a-f0-9-]{36}$/.test(value.epoch) ||
    !(value.turn === null || (typeof value.turn === 'string' && /^[a-f0-9]{64}$/.test(value.turn))) ||
    !Number.isSafeInteger(value.updated) || value.updated < 0 ||
    !['empty', 'pending', 'consumed', 'unavailable'].includes(value.status) ||
    !Array.isArray(value.scenarios) || value.scenarios.length > 4 ||
    (value.status === 'pending' && !value.scenarios.length)) throw new Error('invalid_evidence_state');
  for (const scenario of value.scenarios) {
    if (!isDeepStrictEqual(scenario, canonicalScenario(scenario))) throw new Error('invalid_evidence_state');
  }
  if (value.attempt != null) {
    attempts.checkedAttempt(value.attempt);
    if (value.attempt.id !== value.epoch) throw new Error('invalid_attempt_epoch');
  }
  if(value.request_sha256!=null&&!/^[a-f0-9]{64}$/.test(value.request_sha256))throw new Error('invalid_request_binding');
  if(value.pending_tool){const p=value.pending_tool;
    if(!keys(p,['name','call_sha256','input_sha256'])||!BOUND_TOOLS.includes(p.name)||
      !/^[a-f0-9]{64}$/.test(p.call_sha256)||!/^[a-f0-9]{64}$/.test(p.input_sha256)||!value.attempt)throw new Error('invalid_pending_tool');}
  else if(Object.hasOwn(value,'pending_tool'))throw new Error('invalid_pending_tool');
  return value;
}

function regular(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_STATE) throw new Error('unsafe_evidence_file');
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function directory(root, create) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('missing_plugin_data');
  const resolved = path.resolve(root), real = fs.realpathSync(resolved);
  const same = process.platform === 'win32' ? real.toLowerCase() === resolved.toLowerCase() : real === resolved;
  if (!same || !fs.lstatSync(resolved).isDirectory()) throw new Error('unsafe_plugin_data');
  const dir = path.join(resolved, 'scenario-evidence-v1');
  if (create) {
    try { fs.mkdirSync(dir); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  try {
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_evidence_directory');
  } catch (error) { if (!create && error.code === 'ENOENT') return null; throw error; }
  return dir;
}

function transaction(input, root, create, mutate, recoverInvalid = false, selectedStem = null) {
  if (!id(input?.session_id) || (input.turn_id != null && !id(input.turn_id))) return { status: 'absent' };
  if(selectedStem!==null&&!/^[a-f0-9]{64}$/.test(selectedStem))throw new Error('invalid_evidence_key');
  const dir = directory(root, create);
  if (!dir) return { status: 'absent' };
  const stem = selectedStem??digest(input.session_id), file = path.join(dir, stem + '.json'), lock = path.join(dir, stem + '.lock');
  // No waiting or lock stealing. Concurrent invocations cannot both consume a turn.
  const lockFd = fs.openSync(lock, 'wx', 0o600);
  let temporary;
  try {
    const exists = regular(file);
    let before = null, invalid = false;
    if (exists) {
      const raw = fs.readFileSync(file, 'utf8');
      try { before = checkedState(JSON.parse(raw)); }
      catch (error) {
        // Only a new prompt can replace corrupt content after all file and lock
        // checks succeed. No rejected bytes become evidence or enter the notice.
        if (!recoverInvalid) throw error;
        invalid = true;
      }
    }
    const result = mutate(before, input.turn_id == null ? null : digest(input.turn_id), invalid);
    if (Object.hasOwn(result, 'next')) {
      if (result.next === null) { if (exists) fs.unlinkSync(file); }
      else {
        const next = checkedState(result.next);
        if (!exists) {
          const listing = fs.opendirSync(dir);
          let count = 0;
          try { while (listing.readSync()) { if (++count >= MAX_FILES) throw new Error('evidence_store_full'); } }
          finally { listing.closeSync(); }
        }
        const raw = JSON.stringify(next) + '\n';
        if (Buffer.byteLength(raw) > MAX_STATE) throw new Error('evidence_state_too_large');
        temporary = path.join(dir, stem + '.' + randomUUID() + '.tmp');
        fs.writeFileSync(temporary, raw, { flag: 'wx', mode: 0o600 });
        regular(file);
        fs.renameSync(temporary, file);
        temporary = null;
      }
    }
    return result;
  } finally {
    if (temporary) fs.unlinkSync(temporary);
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}

function packetOwner(input,root){
  const receiver=input.agent_id??input.session_id;
  if(!id(receiver))throw new Error('verification_packet_actor');
  const dir=directory(root,false);if(!dir)throw new Error('verification_packet_actor');
  const candidates=[],direct=digest(input.session_id)+'.json';
  const files=fs.readdirSync(dir);if(files.length>MAX_FILES)throw new Error('evidence_store_full');
  // Search only existing receipt metadata in this plugin's bounded store. Never
  // follow a transcript path, take a parent key from tool arguments, or copy text.
  for(const name of [direct,...files.filter(name=>name!==direct)]){
    if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
    const file=path.join(dir,name);if(!regular(file))continue;
    let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{continue;}
    const stored=value?.attempt?.verification;
    if(!Array.isArray(stored?.facts))continue;
    const slots=[...stored.facts,...(stored.final?[stored.final]:[])];
    if(!slots.some(slot=>slot&&(slot.agent_id===receiver||name===direct&&verification.packetActor(slot,input))))continue;
    checkedState(value);candidates.push(name.slice(0,-5));
  }
  if(candidates.length!==1)throw new Error('verification_packet_actor');
  return candidates[0];
}

function observedScenario(input) {
  const args = input.tool_input;
  if (!keys(args, ['scenario', 'draft', 'language'])) throw new Error('invalid_evidence_arguments');
  const expected = { ...reviewScenarioDraft(args.scenario, args.draft, args.language),
    computed: explainScenario(args.scenario, args.language) };
  // Hosts may supply JSON text, MCP content blocks, or the full MCP result.
  // Normalize only the container; the recomputed payload must still match exactly.
  observedPayload(input.tool_response, expected);
  return canonicalScenario(args.scenario);
}
function observedPayload(supplied, expected) {
  const response = typeof supplied === 'string' ? { content: [{ type: 'text', text: supplied }] }
    : Array.isArray(supplied) ? { content: supplied } : supplied;
  if (!response || response.isError || !Array.isArray(response.content) || response.content.length !== 1 ||
    response.content[0].type !== 'text' || typeof response.content[0].text !== 'string' ||
    (expected!==undefined&&!isDeepStrictEqual(JSON.parse(response.content[0].text), expected)) ||
    (response.structuredContent !== undefined && !isDeepStrictEqual(response.structuredContent, JSON.parse(response.content[0].text)))) {
    throw new Error('unverified_tool_result');
  }
  return expected===undefined?JSON.parse(response.content[0].text):expected;
}

function handleEvent(input, { root = dataRoot(), enabled = readState().status === 'on', now = Date.now() } = {}) {
  if (!input || !['SessionStart', 'SessionEnd', 'Interrupt', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop'].includes(input.hook_event_name)) return {};
  // Claude's normal plugin MCP loader scopes tool names; Codex uses the server key.
  // Accept exactly these two known names, never an arbitrary server-name suffix.
  const host=typeof input.tool_name==='string'&&input.tool_name.startsWith('mcp__plugin_ttak_ttak_scenario__')?'claude':'codex';
  if(typeof input.tool_name==='string'&&input.tool_name.startsWith('mcp__plugin_ttak_ttak_scenario__'))
    input={...input,tool_name:'mcp__ttak_scenario__'+input.tool_name.slice('mcp__plugin_ttak_ttak_scenario__'.length)};
  const event = input.hook_event_name;
  const agentEvent=['SubagentStart','SubagentStop'].includes(event)||['PreToolUse','PostToolUse'].includes(event)&&verification.agentTool(input.tool_name);
  const packetEvent=['PreToolUse','PostToolUse'].includes(event)&&input.tool_name===PACKET_TOOL;
  const resultEvent=['PreToolUse','PostToolUse'].includes(event)&&Object.hasOwn(RESULT_TOOLS,input.tool_name);
  const previewEvent=['PreToolUse','PostToolUse'].includes(event)&&input.tool_name===FINAL_PREVIEW_TOOL;
  const bindingEvent=event==='PreToolUse'&&BOUND_TOOLS.includes(input.tool_name);
  if ((agentEvent||packetEvent||resultEvent||previewEvent||bindingEvent||event==='PostToolUse')&&!enabled)return {};
  if(event==='PreToolUse'&&!agentEvent&&!packetEvent&&!resultEvent&&!previewEvent&&!bindingEvent)return {};
  const boundReturn=event==='PostToolUse'&&BOUND_TOOLS.includes(input.tool_name);
  if (event === 'PostToolUse' && !agentEvent && !resultEvent && !previewEvent && ![TOOL, ASSESSMENT_TOOL, ASSESSMENT_NOTICE_TOOL, DECISION_TOOL, REPAIR_TOOL, PREPARE_TOOL, FINAL_TOOL,CORRECT_TOOL,NEXT_TOOL,PACKET_TOOL,DISPATCH_TOOL,READ_RESULT_TOOL].includes(input.tool_name)) return {};
  if (event === 'SessionStart' && !['startup', 'resume', 'clear', 'compact'].includes(input.source)) return {};
  if (!id(input.session_id)) return {};
  let rejectedResult = false,packetStem=null;
  try {
    if(boundReturn){
      rejectedResult=true;
      transaction(input,root,false,(before,turn)=>{
        if(before?.pending_tool){const p=before.pending_tool;
          if(before.turn!==turn||p.name!==input.tool_name||!id(input.tool_use_id)||p.call_sha256!==digest(input.tool_use_id)||
            p.input_sha256!==dataDigest(input.tool_input))throw new Error('verification_parent_return_changed');}
        return {};
      });
    }
    if(bindingEvent){
      rejectedResult=true;
      if(host==='claude'&&input.tool_name===DISPATCH_TOOL)throw new Error('verification_host_route');
      const result=transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt||before.turn!==turn||before.status==='unavailable'||before.pending_tool||before.attempt.status!=='pending'||!id(input.tool_use_id)||
          before.attempt.candidate!==candidateDigest()||now<before.updated||now-before.updated>TTL)throw new Error('verification_binding_scope');
        let bound=input.tool_name===DISPATCH_TOOL?verification.bindDispatchArguments(input.tool_input,before.attempt)
          :verification.bindArguments(input.tool_input,before.attempt);
        if(bound.input.request==='current'&&([ASSESSMENT_TOOL,PREPARE_TOOL].includes(input.tool_name)||
            host==='codex'&&input.tool_name===FINAL_TOOL&&!verification.usesFinalReferences(bound.input))){
          bound={changed:true,input:{...bound.input,request:readCurrentRequest(input,root,before.request_sha256,host)}};
        }
        if(input.tool_name===READ_RESULT_TOOL){
          if(input.agent_id!=null||host==='claude'&&typeof input.transcript_path!=='string')throw new Error('verification_result_parent_required');
          const reference=verification.resultReference(bound.input,before.attempt);
          bound={changed:true,input:{...reference.args,result:readSubmittedResult(input,root,reference.slot,host,reference.kind)}};
        }else if(input.tool_name===ASSESSMENT_TOOL){
          const compiled=verification.prepareAssessment(bound.input);
          verification.registerAssessment(before.attempt,compiled,before.request_sha256);
        }else if(input.tool_name===PREPARE_TOOL){
          const compiled=verification.prepare(bound.input);
          verification.registerPlan(before.attempt,compiled,before.request_sha256);
        }else if([FINAL_TOOL,CORRECT_TOOL].includes(input.tool_name)){
          if(input.tool_name===CORRECT_TOOL)verification.correctionArguments(bound.input);
          if(verification.usesFinalReferences(bound.input))verification.checkFinalReferences(bound.input,before.attempt);
          else verification.registerFinal(before.attempt,verification.finalize(bound.input),bound.input);
        }else if(input.tool_name===ASSESSMENT_NOTICE_TOOL){
          attempts.checkAssessmentNoticeArguments(bound.input,before.attempt);
        }else if(input.tool_name===REPAIR_TOOL){
          attempts.checkRepairArguments(bound.input,before.attempt);
        }else if(input.tool_name===DECISION_TOOL){
          if(bound.input.request==='current'||bound.input.assessment_result==='current'){
            const decision=attempts.selectedDecision(bound.input);
            // The original request and actual assessment are independently resolved
            // and compared again at PostToolUse; selectors never authorize a result.
            verification.checkWithholdingTransition(before.attempt,{...decision,purpose:'withholding',revision:bound.input.revision,
              request_sha256:bound.input.request==='current'?before.request_sha256:digest(verification.normalizeRequest(bound.input.request)),
              assessment_sha256:bound.input.assessment_result==='current'?verification.observedAssessment(before.attempt).reply_sha256:dataDigest(bound.input.assessment_result)},before.request_sha256);
          }else{
            const proposal=attempts.propose(bound.input);
            verification.registerWithholding(before.attempt,proposal.review,before.request_sha256);
          }
        }
        // A failed MCP call may have no PostToolUse on the native host. Retain
        // its receipt until the exact successful return; another route cannot
        // silently erase the failed/missing check. No request text is persisted.
        return {status:'bound',...bound,next:{...before,updated:now,pending_tool:{name:input.tool_name,
          call_sha256:digest(input.tool_use_id),input_sha256:dataDigest(bound.input)}}};
      });
      if(result.status!=='bound')throw new Error('verification_binding_absent');
      // This documented input rewrite applies only to the named, bundled,
      // read-only MCP calls in an already registered parent turn. No permission
      // settings change, other tool approval or failed-attempt recovery occurs.
      return result.changed?{hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',
        updatedInput:result.input}}:{};
    }else if(packetEvent||resultEvent||previewEvent){
      rejectedResult=true;packetStem=packetOwner(input,root);
      const result=transaction(input,root,false,before=>{
        if(!before?.attempt||before.status==='unavailable'||before.attempt.candidate!==candidateDigest()||now-before.updated>TTL||now<before.updated)
          throw new Error('verification_packet_state');
        const payload=event==='PostToolUse'?observedPayload(input.tool_response):undefined;
        const bound=resultEvent?verification.bindSubmissionArguments(before.attempt,input,RESULT_TOOLS[input.tool_name]):{changed:false};
        const attempt=previewEvent?verification.observeFinalPreview(before.attempt,{...input,preview_payload:payload})
          :resultEvent?verification.observeSubmission(before.attempt,{...input,submission_payload:payload},RESULT_TOOLS[input.tool_name])
          :verification.observePacket(before.attempt,{...input,packet_payload:payload});
        return {next:{...before,attempt,updated:now},...bound};
      },false,packetStem);
      if(result.changed)return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',updatedInput:result.input}};
    }else if(agentEvent){
      const result=transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt)return {};
        if(['PreToolUse','PostToolUse'].includes(event)&&before.turn!==turn)return {};
        if(before.pending_tool)throw new Error('verification_parent_return_missing');
        if(before.status==='unavailable'){
          if(event==='PreToolUse')throw new Error('verification_attempt_unavailable');
          const slots=before.attempt.verification;
          return event==='PostToolUse'&&id(input.tool_use_id)&&slots&&[...slots.facts,...(slots.final?[slots.final]:[])]
            .some(slot=>slot.spawn_sha256===digest(input.tool_use_id))?{status:'unavailable'}:{};
        }
        if(before.attempt.candidate!==candidateDigest()||now-before.updated>TTL||now<before.updated)throw new Error('verification_candidate_or_time');
        const attempt=verification.observeAgent(before.attempt,input);
        const child=event==='SubagentStart'&&attempt?.verification&&[...attempt.verification.facts,...(attempt.verification.final?[attempt.verification.final]:[])]
          .find(slot=>slot.phase==='launched'&&slot.agent_id===input.agent_id);
        const corrected=event==='SubagentStop'&&attempt?.verification&&[...attempt.verification.facts,...(attempt.verification.final?[attempt.verification.final]:[])]
          .find(slot=>slot.agent_id===input.agent_id&&slot.return_corrections===1&&
            [...before.attempt.verification.facts,...(before.attempt.verification.final?[before.attempt.verification.final]:[])].find(old=>old.id===slot.id)?.return_corrections===0);
        return attempt?{next:{...before,attempt,updated:now},...(child?{verifier_challenge:child.challenge,delivery:child.delivery,kind:attempt.verification.purpose==='withholding'?'notice':attempt.verification.purpose==='request_assessment'?'assessment':child.kind}:{}),
          ...(corrected?{return_correction:verification.returnInstruction(corrected)}:{})}:{};
      });
      if(result.verifier_challenge)return notice(event,verification.verifierInstruction(result.verifier_challenge,result.delivery,result.kind));
      if(result.return_correction)return {decision:'block',reason:result.return_correction};
      if(result.status==='unavailable')return notice(event,attempts.failureNotice
        +' Do not continue or relaunch this verifier, even if its native return suggests a follow-up.');
    } else if (event === 'SessionStart' || event === 'SessionEnd' || event === 'Interrupt') {
      const result = transaction(input, root, false, (before, turn) => {
        if (!enabled || !before) return { next: null };
        if (event === 'Interrupt' && before.turn !== turn) return {};
        if (before.attempt) {
          const pending = before.attempt.status === 'pending';
          const next = pending && event !== 'SessionStart' ? { ...before, status: 'unavailable',
            attempt: { ...before.attempt, status: event === 'Interrupt' ? 'cancelled' : 'unavailable' } } : before;
          return { status: before.attempt.status==='complete'?'retained_complete':'retained_unavailable', next };
        }
        if (event === 'SessionStart' && input.source === 'compact') return {};
        return before.status === 'unavailable' ? { status: 'retained_unavailable' } : { next: null };
      });
      if (event === 'SessionStart' && result.status === 'retained_unavailable') return notice(event, PREVIOUS_FAILURE);
    } else if (event === 'UserPromptSubmit' && (!enabled || parseControl(input.prompt))) {
      transaction(input, root, false, () => ({ next: null }));
    } else if (event === 'UserPromptSubmit') {
      const result = transaction(input, root, true, (before, turn, invalid) => {
        const nativeChild=verification.childSlot(before?.attempt,input.prompt);
        if(nativeChild){
          if(before.status==='unavailable'||before.attempt.candidate!==candidateDigest()||now<before.updated||now-before.updated>TTL)
            throw new Error('verification_child_prompt_unavailable');
          const attempt=verification.childPrompt(before.attempt,input,before.turn);
          if(!attempt)throw new Error('verification_child_prompt_unavailable');
          return {status:'verifier_prompt',next:{...before,attempt,updated:now}};
        }
        // Codex Stop feedback is delivered as a new user prompt. Keep the same
        // attempt and its spent correction when this is our exact continuation.
        if (before?.attempt?.corrections === 1 && input.prompt === attempts.continuation(before.attempt)) {
          return { status: 'continuation', attempt: before.attempt, next: { ...before, turn } };
        }
        const epoch = randomUUID(), attempt = attempts.requested(input.prompt) ? attempts.begin(epoch, candidateDigest()) : null;
        const request_sha256=attempt?attempts.hash(verification.normalizeRequest(input.prompt)):null;
        return { status: invalid || before?.status === 'unavailable' || before?.attempt&&before.attempt.status!=='complete' ? 'previous_unavailable' : 'new_task', attempt,
          next: { version: 1, epoch, turn, updated: now, status: 'empty', scenarios: [], attempt,request_sha256 } };
      }, true);
      if(['verifier_prompt','continuation'].includes(result.status))return {};
      const messages = [result.status === 'previous_unavailable' ? PREVIOUS_FAILURE : '',
        result.attempt ? attempts.instruction(result.attempt) : ''].filter(Boolean);
      if (messages.length) return notice(event, messages.join(' '));
    } else if(input.tool_name===READ_RESULT_TOOL){
      rejectedResult=true;const payload=observedPayload(input.tool_response);
      transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt||before.turn!==turn||before.status==='unavailable'||before.pending_tool?.name!==READ_RESULT_TOOL||
          before.attempt.candidate!==candidateDigest()||now-before.updated>TTL||now<before.updated)throw new Error('verification_result_read_scope');
        return {next:{...before,attempt:verification.observeResultRead(before.attempt,input.tool_input,payload,host),updated:now}};
      });
    } else if(input.tool_name===DISPATCH_TOOL){
      observedPayload(input.tool_response);
    } else if([ASSESSMENT_TOOL,PREPARE_TOOL,FINAL_TOOL,CORRECT_TOOL,NEXT_TOOL].includes(input.tool_name)){
      // A structurally valid MCP response can still fail its native-receipt binding.
      // Keep either failure visible for this turn's later Stop check.
      rejectedResult=true;
      let payload,compiled,finalArgs=input.tool_input;
      try{
        if(input.tool_name===ASSESSMENT_TOOL){compiled=verification.prepareAssessment(input.tool_input);payload=observedPayload(input.tool_response,verification.exposePlan(compiled,host));}
        else if(input.tool_name===PREPARE_TOOL){compiled=verification.prepare(input.tool_input);payload=observedPayload(input.tool_response,verification.exposePlan(compiled,host));}
        else if([FINAL_TOOL,CORRECT_TOOL].includes(input.tool_name)){
          if(input.tool_name===CORRECT_TOOL)verification.correctionArguments(input.tool_input);
          if(verification.usesFinalReferences(input.tool_input)){
            const supplied=observedPayload(input.tool_response),resolved=verification.finalizeReferences(input.tool_input,supplied.source_facts);
            compiled=resolved.payload;finalArgs=resolved.args;payload=observedPayload(input.tool_response,verification.exposeReferencedFinal(resolved,host));
          }else{compiled=verification.finalize(input.tool_input);payload=observedPayload(input.tool_response,verification.exposeFinal(compiled,host));}
        }
        else payload=observedPayload(input.tool_response);
      }
      catch(error){rejectedResult=true;throw error;}
      const result=transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt||before.turn!==turn||before.status==='unavailable')return {status:'unavailable'};
        if(before.attempt.candidate!==candidateDigest()||now-before.updated>TTL||now<before.updated)throw new Error('verification_candidate_or_time');
        const attempt=input.tool_name===ASSESSMENT_TOOL?verification.registerAssessment(before.attempt,compiled,before.request_sha256)
          :input.tool_name===PREPARE_TOOL?verification.registerPlan(before.attempt,compiled,before.request_sha256)
          :input.tool_name===NEXT_TOOL?verification.registerNext(before.attempt,input.tool_input,payload,host):verification.registerFinal(before.attempt,compiled,finalArgs);
        const scenarios=[...before.scenarios];
        for(const entry of compiled?.model_evidence??[]){const model=canonicalScenario(entry.model);
          if(!scenarios.some(existing=>isDeepStrictEqual(existing,model)))scenarios.push(model);}
        if(scenarios.length>4)throw new Error('too_many_original_source_models');
        return {next:{...before,attempt,scenarios,status:scenarios.length?'pending':before.status,updated:now}};
      });
      if(['absent','unavailable'].includes(result.status))return UNAVAILABLE;
    } else if (input.tool_name === ASSESSMENT_NOTICE_TOOL) {
      rejectedResult=true;
      const payload=observedPayload(input.tool_response);
      const result=transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt||before.turn!==turn||before.status==='unavailable'||before.pending_tool?.name!==ASSESSMENT_NOTICE_TOOL||
          before.attempt.candidate!==candidateDigest()||now-before.updated>TTL||now<before.updated)throw new Error('withholding_assessment_notice_scope');
        const attempt=attempts.registerAssessmentNotice(before.attempt,input.tool_input,payload,host,before.request_sha256);
        return {next:{...before,attempt,updated:now}};
      });
      if(['absent','unavailable'].includes(result.status))return UNAVAILABLE;
    } else if (input.tool_name === REPAIR_TOOL) {
      rejectedResult=true;
      const payload=observedPayload(input.tool_response);
      const result=transaction(input,root,false,(before,turn)=>{
        if(!before?.attempt||before.turn!==turn||before.status==='unavailable'||before.attempt.candidate!==candidateDigest()||
          now-before.updated>TTL||now<before.updated)throw new Error('withholding_repair_scope');
        const attempt=attempts.registerRepair(before.attempt,input.tool_input,payload,host,before.request_sha256);
        return {next:{...before,attempt,updated:now}};
      });
      if(['absent','unavailable'].includes(result.status))return UNAVAILABLE;
    } else if (input.tool_name === DECISION_TOOL) {
      rejectedResult=true;
      let proposal;
      try {
        const reuse=input.tool_input?.request==='current',reuseAssessment=input.tool_input?.assessment_result==='current';
        if(reuse||reuseAssessment)attempts.selectedDecision(input.tool_input);
        const payload=reuse||reuseAssessment?observedPayload(input.tool_response):null;
        const resolved=reuse?payload.resolved_request:undefined,assessment=reuseAssessment?payload.resolved_assessment:undefined;
        proposal=attempts.propose({...input.tool_input,...(reuse?{request:resolved}:{}),...(reuseAssessment?{assessment_result:assessment}:{})});
        observedPayload(input.tool_response,attempts.exposeDecision(proposal,host,resolved,assessment));
      }
      catch (error) { rejectedResult = true; throw error; }
      const result = transaction(input, root, false, (before, turn) => {
        const attempt = before?.attempt;
        if (!before || before.turn !== turn || !attempt) return { status: 'unavailable' };
        if (before.status === 'unavailable' || ['unavailable', 'cancelled'].includes(attempt.status)) return { status: 'unavailable' };
        if (proposal.decision.attempt_id !== attempt.id || proposal.decision.candidate_sha256 !== attempt.candidate ||
            attempt.candidate !== candidateDigest() || now - before.updated > TTL || now < before.updated) {
          return { status: 'unavailable', next: { ...before, status: 'unavailable', attempt: { ...attempt, status: 'unavailable' } } };
        }
        return { next: { ...before, updated: now,
          attempt:verification.registerWithholding(attempt,proposal.review,before.request_sha256) } };
      });
      if (['absent', 'unavailable'].includes(result.status)) return UNAVAILABLE;
    } else {
      let scenario;
      try { scenario = observedScenario(input); }
      catch (error) { rejectedResult = true; throw error; }
      const result = transaction(input, root, false, (before, turn) => {
        if (!before || before.turn !== turn) return { status: 'unavailable' };
        if (now - before.updated > TTL || now < before.updated) {
          return { status: 'unavailable', next: { ...before, status: 'unavailable' } };
        }
        if (before.status === 'unavailable') return { status: 'unavailable' };
        if (before.status === 'consumed') return { status: 'consumed' };
        const scenarios = before.scenarios.some(item => isDeepStrictEqual(item, scenario))
          ? before.scenarios : [...before.scenarios, scenario];
        if (scenarios.length > 4) return { status: 'unavailable', next: { ...before, status: 'unavailable' } };
        return { next: { ...before, updated: now, status: 'pending', scenarios } };
      });
      if (['absent', 'unavailable'].includes(result.status)) return UNAVAILABLE;
    }
    if(boundReturn)transaction(input,root,false,(before,turn)=>{
      if(!before||before.turn!==turn||before.status==='unavailable')throw new Error('verification_parent_return_unavailable');
      const {pending_tool,...next}=before;return pending_tool?{next}:{};
    });
    return {};
  } catch {
    // Keep a rejected result visible to the later Stop check. Store no rejected bytes,
    // never contaminate a different turn, and never bypass a failed filesystem guard.
    if (enabled && (rejectedResult||agentEvent)) {
      try {
        transaction(input, root, false, (before, turn) => {
          const slots=before?.attempt?.verification;
          const ownChild=slots&&['SubagentStart','SubagentStop'].includes(event)&&
            [...slots.facts,...(slots.final?[slots.final]:[])].some(slot=>
              slot.agent_id===input.agent_id||event==='SubagentStart'&&slot.phase==='launched'&&slot.agent_id===null);
          return before&&(before.turn===turn||ownChild||packetStem)?{next:{...before,status:'unavailable'}}:{};
        },false,packetStem);
      } catch { /* The unavailable notice remains; Stop independently checks storage. */ }
    }
    if(!enabled)return {};
    if(event==='PreToolUse')return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'TTAK independent verification request or binding was rejected. '+attempts.failureNotice}};
    if(event==='UserPromptSubmit')return {...notice(event,UNAVAILABLE.systemMessage),continue:false,stopReason:'TTAK could not safely register this explanation request.'};
    return notice(event, UNAVAILABLE.systemMessage);
  }
}

function failFinal(input, { root = dataRoot() } = {}) {
  try {
    transaction(input, root, false, (before, turn) => before && before.turn === turn
      ? { next: { ...before, status: 'unavailable', ...(before.attempt
        ? { attempt: { ...before.attempt, status: 'unavailable' } } : {}) } } : {});
  } catch { /* Preserve rejected files and locks; the caller returns an unavailable stop. */ }
}

function checkAttempt(input, { root = dataRoot(), now = Date.now() } = {}) {
  try {
    return transaction(input, root, false, (before, turn) => {
      if (!before || before.turn !== turn || !before.attempt) return { status: 'absent' };
      const attempt = before.attempt;
      const fail = () => ({ status: 'unavailable', next: { ...before, status: 'unavailable',
        attempt: { ...attempt, status: 'unavailable' } } });
      if (before.status === 'unavailable' || before.pending_tool || ['unavailable', 'cancelled'].includes(attempt.status) ||
          attempt.candidate !== candidateDigest() || now - before.updated > TTL || now < before.updated) return fail();
      const text = attempts.checkedText(input.last_assistant_message);
      if (['withheld','complete'].includes(attempt.status) && attempts.hash(text) === attempt.final_sha256) {
        if(attempt.status==='complete'&&before.scenarios.some(model=>reviewScenarioDraft(model,text,'en').issues.length))return fail();
        return { status: attempt.status };
      }
      if (input.stop_hook_active || attempt.corrections) return fail();
      return { status: 'decision_required', reason: attempts.continuation(attempt),
        next: { ...before, attempt: { ...attempt, corrections: 1 } } };
    });
  } catch { failFinal(input, { root }); return { status: 'unavailable' }; }
}

function takeEvidence(input, { root = dataRoot(), now = Date.now() } = {}) {
  try {
    return transaction(input, root, false, (before, turn) => {
      if (!before || before.turn !== turn || before.status === 'empty') return { status: 'absent' };
      if (before.status === 'unavailable') return { status: 'unavailable' };
      if (now - before.updated > TTL || now < before.updated) {
        return { status: 'unavailable', next: { ...before, status: 'unavailable' } };
      }
      if (before.status === 'consumed') return { status: 'consumed' };
      return { status: input.stop_hook_active ? 'consumed' : 'ready', scenarios: before.scenarios,
        next: { ...before, status: 'consumed', updated: now } };
    });
  } catch { return { status: 'unavailable' }; }
}

function reconciliationReason(scenarios) {
  const summaries = scenarios.map((scenario, index) => {
    const result = analyzeScenario(scenario);
    const number = name => Number(name.slice(1));
    const predicate = value => ({ cells: value.cells.map(number), at_least: value.at_least });
    return { example: index + 1, initial: Object.values(scenario.initial),
      invariant: predicate(scenario.invariant),
      transactions: scenario.transactions.map(transaction => ({
        guard: predicate(transaction.guard),
        writes: Object.entries(transaction.writes).map(([cell, value]) => [number(cell), value])
      })),
      cross_read_write: result.potential_read_write_edges.map(edge => [number(edge.reader), number(edge.writer)]),
      overlapping_writes: result.potential_write_write_edges.map(edge => edge.transactions.map(number)),
      concurrent_violation: result.concurrent_invariant_violation_found,
      all_serial_orders_preserve_invariant: result.all_serial_orders_preserve_invariant };
  });
  const reason = 'Reconcile the final explanation with this turn\'s scenario_review results once. '
    + 'This is a required evidence check, not a finding that the answer is wrong. '
    + 'Check the complete answer: each transaction\'s read set versus write set, guard versus invariant, '
    + 'snapshot observations, and the conditions under which the proposed remedy preserves the invariant. '
    + 'Distinguish preventing an invalid commit from detecting or compensating for a state after commit. '
    + 'For implementation and cost claims, use the delivered reference notes: PostgreSQL 18 SERIALIZABLE '
    + 'provides serial-equivalent committed results while execution can overlap; serialization failures require '
    + 'whole-transaction retry. SSI monitors dangerous dependency structures with ordering conditions. '
    + 'Performance magnitude depends on the implementation and workload. These are PostgreSQL facts, '
    + 'not guarantees for every database. Preserve valid content and the requested reader level, example and '
    + 'trade-off. Correct only substantive discrepancies. ' + COMPLETION_RULE + 'This check does not certify the answer. '
    + 'The following computed models use 1-based cell and transaction numbers following each original initial '
    + 'object and transaction array. Writes are [cell, boolean]; dependency pairs are [reader, writer]. '
    + 'Match them to your actual tool inputs. '
    + JSON.stringify(summaries);
  if (Buffer.byteLength(reason) > 8000) throw new Error('evidence_feedback_too_large');
  return reason;
}

if (require.main === module) {
  let bytes = 0, chunks = [], done = false;
  const finish = bad => {
    if (done) return; done = true;
    let result;
    const malformed=()=>readState().status==='on'?{...UNAVAILABLE,continue:false,
      stopReason:'TTAK evidence input could not be validated. This explanation is not verified.'}:{};
    try { result = bad ? malformed() : handleEvent(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { bad=true;result = malformed(); }
    if(bad&&readState().status==='on')process.exitCode=2;
    process.stdout.write(JSON.stringify(result) + '\n');
    process.stdin.destroy();
  };
  process.stdin.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_INPUT) finish(true); else chunks.push(chunk); });
  process.stdin.on('end', () => finish(false));
  process.stdin.on('error', () => finish(true));
  setTimeout(() => finish(true), 1000).unref();
}
module.exports = { handleEvent, takeEvidence, reconciliationReason, canonicalScenario, TOOL, TTL, COMPLETION_RULE,
  checkAttempt, failFinal, candidateDigest, CANDIDATE_FILES, DECISION_TOOL };
