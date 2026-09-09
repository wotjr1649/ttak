'use strict';

// Orchestration only: the caller supplies reviewed input and a trusted native-call adapter.
// This module does not launch processes, fetch evidence or grant authority for model calls.
const { ReviewSession, splitUnits, MAX_CHARS } = require('./review-session.cjs');
const { applyPatches } = require('./review-repair.cjs');

async function reviewDraft(options, invoke) {
  const { task, draft, evidence, maxCalls, maxRepairs = 1 } = options;
  if (typeof task !== 'string' || !task.trim() || task.length > MAX_CHARS ||
      typeof evidence !== 'string' || evidence.length > MAX_CHARS || typeof invoke !== 'function' ||
      !Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 128 ||
      !Number.isSafeInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > 2) {
    throw new Error('invalid_workflow_options');
  }
  splitUnits(draft);
  let text = draft;
  let calls = 0;
  let repairs = 0;
  let report = null;
  const sessions = new Set();
  const result = status => ({ status, text, report, calls, repairs,
    workflow_complete: status === 'reviewed', factual_correctness_verified: false });
  const perform = async job => {
    if (calls >= maxCalls) throw new Error('call_budget_exhausted');
    calls++;
    const response = await invoke({ ...job, task, evidence });
    // This ID comes from the trusted native transport, never from model-produced JSON.
    if (!response || typeof response.session !== 'string' || !response.session.trim() ||
        sessions.has(response.session)) throw new Error('review_session_reused_or_missing');
    sessions.add(response.session);
    return response.value;
  };
  for (;;) {
    const units = splitUnits(text);
    // Do not spend calls on a pass that cannot finish inside the remaining allowance.
    if (units.length > maxCalls - calls) return result('budget_exhausted');
    const session = new ReviewSession(text);
    for (const unit of units) {
      session.issue();
      const judgment = await perform({ phase: 'review', draft: text, unit });
      session.accept(judgment);
    }
    report = session.finish();
    const issues = report.units.flatMap(unit => unit.issues);
    if (!issues.length) return result('reviewed');
    if (issues.some(issue => issue.kind === 'not_established')) return result('unresolved');
    if (repairs >= maxRepairs) return result('repair_limit');
    if (calls >= maxCalls) return result('budget_exhausted');
    const proposal = await perform({ phase: 'repair', draft: text,
      review: JSON.parse(JSON.stringify({ units: report.units })) });
    if (!proposal || Object.keys(proposal).length !== 1 || !Array.isArray(proposal.patches)) {
      throw new Error('invalid_repair_proposal');
    }
    const fixed = applyPatches(text, { units: report.units }, proposal.patches);
    if (!fixed.patch_count || fixed.text === text) throw new Error('unchanged_repair');
    splitUnits(fixed.text); // Validate revised input before committing state.
    text = fixed.text;
    repairs++;
    report = null; // A review of the previous text cannot certify this revision.
  }
}

module.exports = { reviewDraft };
