'use strict';

// Pure JSON-data validation and reconciliation. URLs, quotes and reasons are never executed.
const { createHash } = require('node:crypto');
const { splitUnits, ReviewSession, MAX_CHARS, MAX_UNITS } = require('./review-session.cjs');
const roles = ['evidence', 'context'];
const fields = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const string = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_CHARS) return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char.length === 1 && code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
};
const copy = value => JSON.parse(JSON.stringify(value));

function preparePacket(input) {
  if (!input || !string(input.task) || !string(input.draft) || !Array.isArray(input.references) ||
      input.references.length > MAX_UNITS) throw new Error('invalid_role_packet');
  splitUnits(input.draft);
  const ids = new Set();
  const references = input.references.map(ref => {
    if (!ref || !['id', 'url', 'summary'].every(key => string(ref[key])) ||
        ref.id.length > 128 || ids.has(ref.id)) throw new Error('invalid_reference');
    ids.add(ref.id);
    // Select only these inert fields; omit operator metadata and expected answers.
    return { id: ref.id, url: ref.url, summary: ref.summary };
  });
  if (JSON.stringify(references).length > MAX_CHARS) throw new Error('references_too_large');
  return { task: input.task, draft: input.draft, references };
}

function reviewKey(input) {
  return createHash('sha256').update(JSON.stringify(preparePacket(input))).digest('hex');
}

function validateRole(input, role, value) {
  const packet = preparePacket(input);
  if (!roles.includes(role) || !fields(value, ['role', 'review_key', 'units']) ||
      value.role !== role || value.review_key !== reviewKey(packet)) throw new Error('wrong_role_or_revision');
  const units = splitUnits(packet.draft);
  if (!Array.isArray(value.units) || value.units.length !== units.length) throw new Error('incomplete_role_coverage');
  if (JSON.stringify(value).length > MAX_CHARS) throw new Error('role_report_too_large');
  const references = new Set(packet.references.map(ref => ref.id));
  const located = new Map();
  let cursor = 0;
  for (const unit of units) {
    const start = packet.draft.indexOf(unit.text, cursor);
    located.set(unit.id, { ...unit, start });
    cursor = start + unit.text.length;
  }
  const locate = (unitId, quote) => {
    const unit = located.get(unitId);
    if (!unit || !string(quote)) throw new Error('invalid_role_quote');
    const offset = unit.text.indexOf(quote);
    if (offset < 0) throw new Error('foreign_role_quote');
    if (unit.text.indexOf(quote, offset + 1) >= 0) throw new Error('ambiguous_role_quote');
    return { start: unit.start + offset, end: unit.start + offset + quote.length };
  };
  const claims = [];
  let claimCount = 0;
  for (let i = 0; i < units.length; i++) {
    const row = value.units[i];
    if (!fields(row, ['id', 'non_claim_reason', 'claims']) || row.id !== units[i].id ||
        !Array.isArray(row.claims) || row.claims.length > MAX_UNITS ||
        (row.claims.length ? row.non_claim_reason !== '' : !string(row.non_claim_reason))) {
      throw new Error('invalid_role_unit');
    }
    const seen = new Set();
    for (const claim of row.claims) {
      if (++claimCount > MAX_UNITS) throw new Error('too_many_role_claims');
      const keys = role === 'evidence' ? ['quote', 'verdict', 'reference_ids', 'reason'] :
        ['quote', 'verdict', 'related', 'reason'];
      const verdicts = role === 'evidence' ? ['supported', 'contradicted', 'not_established'] :
        ['consistent', 'internal_inconsistency', 'not_established'];
      if (!fields(claim, keys) || !verdicts.includes(claim.verdict) || !string(claim.reason)) {
        throw new Error('invalid_role_claim');
      }
      const span = locate(row.id, claim.quote);
      if (seen.has(claim.quote)) throw new Error('duplicate_role_claim');
      seen.add(claim.quote);
      if (role === 'evidence') {
        if (!Array.isArray(claim.reference_ids) || claim.reference_ids.length > MAX_UNITS ||
            new Set(claim.reference_ids).size !== claim.reference_ids.length ||
            claim.reference_ids.some(id => !references.has(id)) ||
            (claim.verdict !== 'not_established' && !claim.reference_ids.length)) {
          throw new Error('invalid_claim_references');
        }
      } else {
        if (!Array.isArray(claim.related) || claim.related.length > MAX_UNITS ||
            (claim.verdict === 'internal_inconsistency' && !claim.related.length)) {
          throw new Error('invalid_context_links');
        }
        const links = new Set();
        for (const related of claim.related) {
          if (!fields(related, ['unit_id', 'quote'])) throw new Error('invalid_context_link');
          const other = locate(related.unit_id, related.quote);
          const key = `${other.start}:${other.end}`;
          if ((other.start === span.start && other.end === span.end) || links.has(key)) {
            throw new Error('duplicate_or_self_link');
          }
          links.add(key);
        }
      }
      claims.push({ role, unit_id: row.id, ...copy(claim), ...span });
    }
  }
  return { report: copy(value), claims };
}

function mergeRoles(input, evidence, context) {
  const packet = preparePacket(input);
  const checked = [validateRole(packet, 'evidence', evidence), validateRole(packet, 'context', context)];
  const all = checked.flatMap(item => item.claims);
  const negative = claim => ['contradicted', 'internal_inconsistency'].includes(claim.verdict);
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  const errors = all.filter(negative);
  const reports = checked.map(item => item.report);
  const result = (status, review = null) => ({ status, review, reports,
    coverage_complete: true, factual_correctness_verified: false });
  // Positive or uncertain judgments intersecting an error require adjudication, even
  // when role-specific semantics might eventually explain the disagreement.
  for (const error of errors) {
    if (all.some(other => !negative(other) && overlaps(error, other))) return result('conflict');
  }
  for (let i = 0; i < errors.length; i++) {
    for (let j = i + 1; j < errors.length; j++) {
      const a = errors[i], b = errors[j];
      if (!overlaps(a, b)) continue;
      if (a.start !== b.start || a.end !== b.end) return result('overlapping_findings');
    }
  }
  if (all.some(claim => claim.verdict === 'not_established')) return result('unresolved');
  const combined = new Map();
  for (const error of errors) {
    const key = `${error.start}:${error.end}`;
    // An identical negative span is one repair target; preserve both role reasons.
    // The legacy repair kind follows evidence when present, not a choice of replacement.
    if (!combined.has(key)) combined.set(key, { unit_id: error.unit_id, quote: error.quote,
      kind: error.verdict, reasons: [] });
    combined.get(key).reasons.push(`${error.role}: ${error.reason}`);
  }
  const session = new ReviewSession(packet.draft);
  for (const unit of splitUnits(packet.draft)) {
    const issues = [...combined.values()].filter(item => item.unit_id === unit.id)
      .map(item => ({ quote: item.quote, kind: item.kind, reason: item.reasons.join('\n') }));
    session.issue();
    session.accept({ id: unit.id, assessment: issues.length ? 'needs_review' : 'no_issue_found', issues });
  }
  const review = { units: session.finish().units };
  return result(errors.length ? 'repairable' : 'reviewed', review);
}

module.exports = { preparePacket, reviewKey, validateRole, mergeRoles };
