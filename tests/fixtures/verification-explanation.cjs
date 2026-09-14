'use strict';
// Local deterministic adapter fixture; no native execution or semantic certification.
const { input } = require('./verification-p0.cjs');
const { digest } = require('../../scripts/verification-packet.cjs');
const { modelSettings } = require('../../scripts/review-native-format.cjs');
const { claimLinkMap, draftReviewMap } = require('../../scripts/verification-explanation.cjs');
function spec() {
  const p = input();
  return { schema_version: 1, run_id: 'Explain101', turn_id: 'Turn101', host: 'claude', task: 'Explain the synthetic example.',
    reader: 'A database engineer', language: 'en', obligations: [
      { id: 'O1', text: 'Explain the relationship.' }, { id: 'O2', text: 'Explain the cost.' }],
    bundle: p.bundle, questions: p.questions,
    criteria: [{ id: 'H1', text: 'Includes the concrete relationship.' }, { id: 'Q1', text: 'States the cost accurately.' }] };
}
function completeAnswer(stage, results = []) {
  const value = { answer: stage === 'draft' ? 'PARENT_ONLY_MARKER. T1 and T2 interact. Monitoring costs work.'
    : 'T1 reads B and writes A, while T2 reads A and writes B. Monitoring costs work on every attempt.',
    claims: [{ id: 'C1', quote: stage === 'draft' ? 'T1 and T2 interact.' : 'T1 reads B and writes A, while T2 reads A and writes B.',
      question_ids: ['Q1'], obligation_ids: ['O1'] },
    { id: 'C2', quote: stage === 'draft' ? 'Monitoring costs work.' : 'Monitoring costs work on every attempt.',
      question_ids: ['Q2'], obligation_ids: ['O2'] }], unmapped_claims: [], uncovered_obligations: [] };
  if (stage === 'rewrite') value.comparisons = results.map(r => ({ question_id: r.question_id,
    result_sha256: digest(r), status: 'supported', reason: 'Checked the supplied synthetic source.' }));
  return value;
}
function adapters(mutate = () => {}, onRequest = () => {}) {
  let ordinal = 0; const childResults = [], requests = [];
  async function invoke(request) {
    ordinal++; requests.push(structuredClone(request)); onRequest(request, ordinal);
    const p = request.packet, selected = modelSettings(request.host, 'haiku-luna');
    const result = p ? { question_id: p.question_id, packet_sha256: digest(p), status: 'answered',
      answer: p.sources[0].text, conditions: [], uncertainties: [], citations: [{ source_id: p.sources[0].id,
        start: 0, end: p.sources[0].text.length, quote: p.sources[0].text }] } : wireAnswer(spec(), completeAnswer(request.stage, childResults));
    const observed = { execution_id: 'Synthetic' + ordinal, host: request.host, model: selected.model, effort: selected.effort,
      request_sha256: digest(request), status: 'observed', cleanup_verified: true, active_owned_processes: 0,
      usage: { input_including_cache: 100, output_including_reasoning: 20, native_api_responses: null, completeness_verified: false }, result };
    mutate(observed, request, ordinal);
    if (p) childResults.push(result);
    return observed;
  }
  return { parent: invoke, child: invoke, requests };
}
function wireAnswer(s, answer, draft = completeAnswer('draft')) {
  const map = claimLinkMap(s);
  const { answer: text, claims, ...rest } = answer;
  if (rest.comparisons) {
    rest.assessments = draftReviewMap(s, draft, rest.comparisons.map(c => ({ question_id: c.question_id })))
      .map(u => ({ review_id: u.id, verdict: 'supported', reason: 'Synthetic per-claim review only.' }));
    rest.comparisons = rest.comparisons.map((c, i) => ({ check_id: 'K' + String(i + 1).padStart(4, '0'), status: c.status, reason: c.reason }));
  }
  return { ...rest, claim_map_sha256: map.claim_map_sha256, blocks: claims.map((c, i) => ({
    id: c.id, text: (i === 0 ? text.slice(0, text.indexOf(c.quote)) : '') + c.quote,
    link_ids: map.links.filter(l => c.question_ids.includes(l.question_id) &&
      c.obligation_ids.includes(l.obligation_id)).map(l => l.id) })) };
}
module.exports = { spec, completeAnswer, wireAnswer, adapters };
