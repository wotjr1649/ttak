'use strict';

// Internal review sequencing only. This module performs no I/O, model calls or execution
// of draft content. Accepted judgments prove coverage, never factual correctness.
const MAX_CHARS = 100_000;
const MAX_UNITS = 512;

function splitUnits(draft) {
  if (typeof draft !== 'string' || draft.length > MAX_CHARS || !draft.trim()) {
    throw new Error('invalid_draft');
  }
  const units = [];
  let text = '';
  const flush = () => {
    if (!text) return;
    if (units.length >= MAX_UNITS) throw new Error('too_many_units');
    units.push({ id: `U${String(units.length + 1).padStart(3, '0')}`, text });
    text = '';
  };
  // Preserve LF, CRLF and CR exactly; offsets are deliberately not part of this API.
  for (const line of draft.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    if (line.trim()) text += line;
    else flush();
  }
  flush();
  return units;
}

function exactFields(value, names) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function checkedReview(unit, row) {
  if (!exactFields(row, ['id', 'assessment', 'issues']) || row.id !== unit.id ||
      !['no_issue_found', 'needs_review'].includes(row.assessment) || !Array.isArray(row.issues) ||
      row.issues.length > MAX_UNITS ||
      (row.issues.length > 0) !== (row.assessment === 'needs_review')) {
    throw new Error('invalid_review');
  }
  const issues = [];
  let issueSize = 0;
  for (const issue of row.issues) {
    if (!exactFields(issue, ['quote', 'kind', 'reason']) ||
        !['contradicted', 'not_established', 'internal_inconsistency'].includes(issue.kind) ||
        typeof issue.quote !== 'string' || issue.quote.length > unit.text.length || !issue.quote.trim() ||
        typeof issue.reason !== 'string' || issue.reason.length > MAX_CHARS || !issue.reason.trim() ||
        !unit.text.includes(issue.quote)) {
      throw new Error('invalid_issue');
    }
    const copy = { quote: issue.quote, kind: issue.kind, reason: issue.reason };
    issueSize += JSON.stringify(copy).length;
    if (issueSize > MAX_CHARS) throw new Error('report_too_large');
    issues.push(copy);
  }
  return { id: row.id, assessment: row.assessment, issues };
}

class ReviewSession {
  #draft;
  #units;
  #reviews = [];
  #pending = false;
  #reportSize = 0;

  constructor(draft) {
    this.#units = splitUnits(draft);
    this.#draft = draft;
  }

  issue() {
    if (this.#reviews.length === this.#units.length) return { done: true };
    this.#pending = true;
    return { done: false, unit: { ...this.#units[this.#reviews.length] },
      context: this.#draft, remaining: this.#units.length - this.#reviews.length };
  }

  accept(row) {
    if (!this.#pending) throw new Error('no_pending_unit');
    const review = checkedReview(this.#units[this.#reviews.length], row);
    const size = JSON.stringify(review).length;
    if (size + this.#reportSize > MAX_CHARS) throw new Error('report_too_large');
    // Commit state only after every check succeeds. A rejected result keeps its unit pending.
    this.#reviews.push(review);
    this.#reportSize += size;
    this.#pending = false;
    return { accepted: true, remaining: this.#units.length - this.#reviews.length };
  }

  finish() {
    if (this.#reviews.length !== this.#units.length || this.#pending) {
      throw new Error('incomplete_review');
    }
    return { units: this.#reviews.map(row => ({ ...row, issues: row.issues.map(x => ({ ...x })) })),
      coverage_complete: true, factual_correctness_verified: false };
  }
}

module.exports = { MAX_CHARS, MAX_UNITS, splitUnits, ReviewSession };
