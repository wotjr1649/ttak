'use strict';
// Inspect only host-supplied final text. Never read transcript paths or execute text.
const { reviewFinalScope } = require('../scripts/scenario-draft.cjs');
const { readState } = require('./ttak.cjs');
const { takeEvidence, reconciliationReason, COMPLETION_RULE, checkAttempt, failFinal } = require('./scenario-evidence.cjs');

// Stop processing, not transcript replacement. Host display/resume behavior needs native proof.
const unavailable = () => ({ continue: false, stopReason: 'TTAK final explanation check was unavailable. '
  + 'The explanation is not verified. Restore the check and its current-turn evidence before completing the explanation.' });

function handle(input, enabled = readState().status === 'on', evidenceOptions) {
  if (!enabled) return {};
  if (!input || input.hook_event_name !== 'Stop') return {};
  const failed = () => { failFinal(input, evidenceOptions); return unavailable(); };
  if (typeof input.last_assistant_message !== 'string' ||
    typeof input.stop_hook_active !== 'boolean' || !input.last_assistant_message.trim()) return failed();
  const attempt = checkAttempt(input, evidenceOptions);
  if (attempt.status === 'withheld') return {};
  if(attempt.status==='complete'){
    try{if(!reviewFinalScope(input.last_assistant_message).length)return {};}catch{}
    return failed();
  }
  if (attempt.status === 'unavailable') return failed();
  if (attempt.status === 'decision_required') return { decision: 'block', reason: attempt.reason };
  const evidence = takeEvidence(input, evidenceOptions);
  if (evidence.status === 'ready') {
    try { return { decision: 'block', reason: reconciliationReason(evidence.scenarios) }; }
    catch { return failed(); }
  }
  if (evidence.status === 'unavailable') return failed();
  let issues;
  try { issues = reviewFinalScope(input.last_assistant_message); }
  catch { return failed(); }
  if (!issues.length) return {};
  const feedback = [...new Set(issues.map(issue=>issue.feedback))].slice(0,4).join(' ');
  if (input.stop_hook_active || evidence.status === 'consumed') {
    failFinal(input, evidenceOptions);
    return { continue: false,
      stopReason: 'TTAK still detects an unresolved explanation-scope issue after one correction. The explanation is not verified. ' + feedback };
  }
  return { decision: 'block', reason: 'Review the final explanation you just gave. '
    + feedback
    + ' Revise the affected explanation and preserve the requested example, reader level and trade-off. '
    + COMPLETION_RULE + 'This is one bounded correction, not a correctness certificate.' };
}

if (require.main === module) {
  const MAX_INPUT = 131072;
  let bytes = 0, chunks = [], done = false;
  const finish = bad => {
    if (done) return; done = true;
    let result;
    try { result = readState().status !== 'on' ? {} : bad ? null : handle(JSON.parse(Buffer.concat(chunks).toString('utf8')), true); }
    catch { result = null; }
    process.stdout.write(JSON.stringify(result || unavailable())+'\n');
    process.stdin.destroy();
  };
  process.stdin.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_INPUT) finish(true); else chunks.push(chunk); });
  process.stdin.on('end', () => finish(false));
  process.stdin.on('error', () => finish(true));
  setTimeout(() => finish(true), 1000).unref();
}
module.exports = { handle };
