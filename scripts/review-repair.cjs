'use strict';

// Pure text repair boundaries. No files, processes, network or model calls.
// Validated records limit edit locations; they do not grant permission or verify truth.
const { ReviewSession, splitUnits, MAX_CHARS } = require('./review-session.cjs');
const fields = (value, names) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === names.length &&
  names.every(name => Object.hasOwn(value, name));
const keyFor = (id, quote) => JSON.stringify([id, quote]);
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
function wellFormed(text) {
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (character.length === 1 && code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}

function applyPatches(draft, review, patches) {
  const session = new ReviewSession(draft);
  const units = splitUnits(draft);
  if (!fields(review, ['units']) || !Array.isArray(review.units) || review.units.length !== units.length) {
    throw new Error('incomplete_review');
  }
  const rows = new Map();
  for (const row of review.units) {
    if (!row || typeof row.id !== 'string' || rows.has(row.id)) throw new Error('invalid_review');
    rows.set(row.id, row);
  }
  // Reuse the same complete-coverage, own-unit quote and report-size checks as live sequencing.
  for (const unit of units) {
    session.issue();
    session.accept(rows.get(unit.id));
  }
  const checked = session.finish().units;
  const eligible = new Map();
  const protectedSpans = [];
  let cursor = 0;
  let unresolved = 0;
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitStart = draft.indexOf(unit.text, cursor);
    cursor = unitStart + unit.text.length;
    for (const issue of checked[i].issues) {
      if (!wellFormed(issue.quote)) throw new Error('invalid_issue');
      const offset = unit.text.indexOf(issue.quote);
      // Search one character later, so overlapping occurrences (aa in aaa) are ambiguous too.
      const unique = unit.text.indexOf(issue.quote, offset + 1) < 0;
      const span = { start: unitStart + offset, end: unitStart + offset + issue.quote.length };
      if (issue.kind === 'not_established') {
        unresolved++;
        protectedSpans.push(unique ? span : { start: unitStart, end: cursor });
      } else {
        const key = keyFor(unit.id, issue.quote);
        if (!unique || eligible.has(key)) throw new Error('ambiguous_error_location');
        eligible.set(key, span);
      }
    }
  }
  const spans = [...eligible.values()].sort((a, b) => a.start - b.start);
  if (spans.some((span, i) => i > 0 && overlaps(spans[i - 1], span))) {
    throw new Error('overlapping_errors');
  }
  if (spans.some(span => protectedSpans.some(protectedSpan => overlaps(span, protectedSpan)))) {
    throw new Error('unresolved_claim_overlap');
  }
  if (!Array.isArray(patches) || patches.length !== eligible.size) {
    throw new Error('incomplete_patches');
  }
  const seen = new Set();
  const edits = [];
  let resultSize = draft.length;
  let replacementSize = 0;
  for (const patch of patches) {
    if (!fields(patch, ['unit_id', 'quote', 'replacement']) ||
        !Object.values(patch).every(value => typeof value === 'string')) throw new Error('invalid_patch');
    const key = keyFor(patch.unit_id, patch.quote);
    if (!eligible.has(key) || seen.has(key)) throw new Error('unreviewed_patch');
    if (!patch.replacement.trim() || patch.replacement === patch.quote || !wellFormed(patch.replacement)) {
      throw new Error('invalid_replacement');
    }
    replacementSize += patch.replacement.length;
    if (replacementSize > MAX_CHARS) throw new Error('corrected_draft_too_large');
    seen.add(key);
    const span = eligible.get(key);
    resultSize += patch.replacement.length - (span.end - span.start);
    edits.push({ ...span, replacement: patch.replacement });
  }
  if (resultSize > MAX_CHARS) throw new Error('corrected_draft_too_large');
  const parts = [];
  cursor = 0;
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    parts.push(draft.slice(cursor, edit.start), edit.replacement);
    cursor = edit.end;
  }
  parts.push(draft.slice(cursor));
  return { text: parts.join(''), patch_count: edits.length, unresolved_issues: unresolved,
    factual_correctness_verified: false };
}

module.exports = { applyPatches };
