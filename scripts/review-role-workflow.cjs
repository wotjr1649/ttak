'use strict';

// Local orchestration only. invoke is a caller-supplied transport; no CLI or network here.
const { splitUnits } = require('./review-session.cjs');
const { applyPatches } = require('./review-repair.cjs');
const { preparePacket, reviewKey, validateRole, mergeRoles } = require('./review-roles.cjs');
const copy = value => JSON.parse(JSON.stringify(value));

async function reviewByRoles(options, invoke) {
  if (!options || typeof invoke !== 'function' || !Number.isSafeInteger(options.maxCalls) ||
      options.maxCalls < 1 || options.maxCalls > 128 ||
      !Number.isSafeInteger(options.maxRepairs ?? 1) || (options.maxRepairs ?? 1) < 0 ||
      (options.maxRepairs ?? 1) > 2 ||
      (options.stopOnFinding !== undefined && typeof options.stopOnFinding !== 'boolean')) {
    throw new Error('invalid_role_workflow_options');
  }
  const maxCalls = options.maxCalls, maxRepairs = options.maxRepairs ?? 1;
  const stopOnFinding = options.stopOnFinding ?? false;
  let packet = preparePacket(options);
  let calls = 0, repairs = 0, report = null;
  const history = [];
  const sessions = new Set();
  const result = status => ({ status, text: packet.draft, report, history, calls, repairs,
    workflow_complete: status === 'reviewed', factual_correctness_verified: false });
  const perform = async job => {
    if (calls >= maxCalls) throw new Error('role_call_budget_exhausted');
    calls++;
    const response = await invoke(copy({ ...job, packet, review_key: reviewKey(packet) }));
    if (!response || typeof response.session !== 'string' || !response.session.trim() ||
        sessions.has(response.session)) throw new Error('review_session_reused_or_missing');
    sessions.add(response.session);
    return response.value;
  };
  for (;;) {
    // An entire two-role pass must fit before any part of it is started.
    if (maxCalls - calls < 2) return result('budget_exhausted');
    const judgments = [];
    for (const role of ['evidence', 'context']) {
      const value = await perform({ phase: repairs ? 'recheck' : 'review', role });
      const checked = validateRole(packet, role, value);
      history.push({ review_key: reviewKey(packet), role, report: checked.report });
      judgments.push(checked.report);
      // Operator-only diagnostic option; never reveals control identity in worker input.
      if (stopOnFinding && checked.claims.some(claim =>
        !['supported', 'consistent'].includes(claim.verdict))) return result('finding_stop');
    }
    report = mergeRoles(packet, ...judgments);
    if (report.status !== 'repairable') return result(report.status);
    if (repairs >= maxRepairs) return result('repair_limit');
    // Reserve repair AND both full rechecks. Never alter text without room to recheck.
    if (maxCalls - calls < 3) return result('budget_exhausted');
    const proposal = await perform({ phase: 'repair', review: report.review, reports: report.reports });
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) ||
        Object.keys(proposal).length !== 1 || !Array.isArray(proposal.patches)) {
      throw new Error('invalid_repair_proposal');
    }
    const fixed = applyPatches(packet.draft, report.review, proposal.patches);
    if (!fixed.patch_count || fixed.text === packet.draft) throw new Error('unchanged_repair');
    splitUnits(fixed.text);
    packet = preparePacket({ ...packet, draft: fixed.text });
    repairs++;
    report = null; // Prior full coverage cannot certify the new draft.
  }
}

module.exports = { reviewByRoles };
