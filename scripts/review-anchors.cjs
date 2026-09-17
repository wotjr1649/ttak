'use strict';

// Addresses identify contiguous source text. They neither infer claims nor judge truth.
const { preparePacket, reviewKey, validateRole } = require('./review-roles.cjs');
const { splitUnits, MAX_CHARS, ReviewSession } = require('./review-session.cjs');
const { textAnchors } = require('./source-text-anchors.cjs');
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

function sourceAnchors(input) {
  const packet = preparePacket(input);
  let count = 0;
  return splitUnits(packet.draft).map(unit => {
    const anchors = textAnchors(unit.text).map((anchor, i) => {
      if (++count > 4096) throw new Error('too_many_source_anchors');
      return { id: `${unit.id}.A${String(i + 1).padStart(3, '0')}`, ...anchor };
    });
    return { ...unit, anchors };
  });
}

function resolveSpan(units, unitId, span) {
  if (!fields(span, ['first', 'last'])) throw new Error('invalid_source_span');
  const unit = units.find(value => value.id === unitId);
  const first = unit?.anchors.findIndex(value => value.id === span.first) ?? -1;
  const last = unit?.anchors.findIndex(value => value.id === span.last) ?? -1;
  if (first < 0 || last < first) throw new Error('foreign_or_reversed_source_span');
  return unit.text.slice(unit.anchors[first].start, unit.anchors[last].end);
}

function decodeAnchoredRole(input, role, value) {
  const packet = preparePacket(input);
  if (!['evidence', 'context'].includes(role) || !fields(value, ['role', 'review_key', 'units']) ||
      value.role !== role || value.review_key !== reviewKey(packet) || !Array.isArray(value.units) ||
      JSON.stringify(value).length > MAX_CHARS) throw new Error('invalid_anchored_report');
  const units = sourceAnchors(packet);
  if (value.units.length !== units.length) throw new Error('incomplete_anchored_report');
  const decoded = { role, review_key: value.review_key, units: value.units.map((unit, index) => {
    if (!fields(unit, ['id', 'non_claim_reason', 'claims']) || unit.id !== units[index].id ||
        !Array.isArray(unit.claims)) throw new Error('invalid_anchored_unit');
    return { id: unit.id, non_claim_reason: unit.non_claim_reason, claims: unit.claims.map(claim => {
      const names = role === 'evidence' ? ['span', 'verdict', 'reference_ids', 'reason'] :
        ['span', 'verdict', 'related', 'reason'];
      if (!fields(claim, names)) throw new Error('invalid_anchored_claim');
      const output = { quote: resolveSpan(units, unit.id, claim.span), verdict: claim.verdict, reason: claim.reason };
      if (role === 'evidence') output.reference_ids = claim.reference_ids;
      else {
        if (!Array.isArray(claim.related)) throw new Error('invalid_anchored_links');
        output.related = claim.related.map(link => {
          if (!fields(link, ['unit_id', 'span'])) throw new Error('invalid_anchored_link');
          return { unit_id: link.unit_id, quote: resolveSpan(units, link.unit_id, link.span) };
        });
      }
      return output;
    }) };
  }) };
  // Reuse every existing uniqueness, coverage, reference and context-link check.
  validateRole(packet, role, decoded);
  return decoded;
}

function repairTargets(input, review) {
  const packet = preparePacket(input), session = new ReviewSession(packet.draft);
  if (!review || !Array.isArray(review.units)) throw new Error('invalid_anchored_repair_review');
  for (const unit of review.units) { session.issue(); session.accept(unit); }
  const complete = session.finish(), targets = [];
  for (const unit of complete.units) for (const issue of unit.issues) {
    if (!['contradicted', 'internal_inconsistency'].includes(issue.kind)) throw new Error('unresolved_anchored_repair');
    if (!targets.some(target => target.unit_id === unit.id && target.quote === issue.quote)) {
      targets.push({ id: `P${String(targets.length + 1).padStart(3, '0')}`, unit_id: unit.id, quote: issue.quote });
    }
  }
  if (!targets.length) throw new Error('missing_anchored_repair_targets');
  return targets;
}

function decodeAnchoredPatches(input, review, value) {
  if (!fields(value, ['patches']) || !Array.isArray(value.patches) ||
      JSON.stringify(value).length > MAX_CHARS) throw new Error('invalid_anchored_patches');
  const targets = repairTargets(input, review), seen = new Set();
  return { patches: value.patches.map(patch => {
    if (!fields(patch, ['target_id', 'replacement'])) throw new Error('invalid_anchored_patch');
    const target = targets.find(item => item.id === patch.target_id);
    if (!target || seen.has(target.id)) throw new Error('foreign_or_duplicate_repair_target');
    seen.add(target.id);
    return { unit_id: target.unit_id, quote: target.quote, replacement: patch.replacement };
  }) };
}

module.exports = { sourceAnchors, resolveSpan, decodeAnchoredRole, repairTargets, decodeAnchoredPatches };
