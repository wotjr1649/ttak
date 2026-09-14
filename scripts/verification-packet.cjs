'use strict';
// P0 data compiler only: no I/O or model calls. A selected source is not a trust grant.
const { createHash } = require('node:crypto');
const { possibleSecret } = require('./review-native-format.cjs');
const MAX_BYTES = 1048576, MAX_QUESTIONS = 8, MAX_PACKET_BYTES = 65536;
const questions = Object.freeze({
  mechanism: 'What mechanism applies to the selected targets under the supplied conditions?',
  relationship: 'What relationships hold between the selected targets under the supplied conditions?',
  implementation: 'Which implementation-specific guarantees and limitations apply under these conditions?',
  cost: 'What costs arise, and under which conditions, for the selected targets?',
  mitigation: 'What mitigation applies, with which preconditions and trade-offs?',
  analogy: 'Where does an analogy for the selected targets hold, and where does it break down?'
});

function exact(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== names.length || names.some(key => !Object.hasOwn(value, key))) {
    throw new Error('verification_invalid_fields');
  }
}
function checkText(value, max = 32768) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > max ||
      possibleSecret(value)) throw new Error('verification_content_rejected');
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char.length === 1 && code >= 0xd800 && code <= 0xdfff) throw new Error('verification_invalid_unicode');
  }
  return value;
}
function checkId(value) {
  checkText(value, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new Error('verification_invalid_id');
  return value;
}
function checkInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('verification_invalid_integer');
  return value;
}
// Accept JSON values, not executable JS objects. Reject accessors/toJSON, sparse arrays,
// cycles, exotic prototypes and oversized structures before serialization can invoke them.
function checkedData(value) {
  let nodes = 0, bytes = 0;
  const seen = new Set();
  function visit(item, depth) {
    if (++nodes > 20000 || depth > 16) throw new Error('verification_data_limit');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new Error('verification_invalid_number');
      return item;
    }
    if (typeof item === 'string') {
      bytes += Buffer.byteLength(item);
      if (bytes > MAX_BYTES || possibleSecret(item)) throw new Error('verification_content_rejected');
      return item;
    }
    if (!item || typeof item !== 'object' || seen.has(item)) throw new Error('verification_invalid_data');
    const array = Array.isArray(item), proto = Object.getPrototypeOf(item);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) {
      throw new Error('verification_invalid_data');
    }
    seen.add(item);
    const keys = Reflect.ownKeys(item);
    if (keys.length > 20000 || (array && item.length > 20000)) throw new Error('verification_data_limit');
    const copy = array ? [] : {};
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          (array && !/^(0|[1-9][0-9]*)$/.test(key))) throw new Error('verification_invalid_data');
      bytes += Buffer.byteLength(key);
      if (bytes > MAX_BYTES || possibleSecret(key)) throw new Error('verification_content_rejected');
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('verification_invalid_data');
      copy[key] = visit(descriptor.value, depth + 1);
    }
    if (array && (keys.length !== item.length + 1 || copy.length !== item.length)) {
      throw new Error('verification_invalid_data');
    }
    seen.delete(item);
    return copy;
  }
  const copy = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(copy)) > MAX_BYTES) throw new Error('verification_data_limit');
  return copy;
}
function canonical(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(checkedData(value)));
}
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const textDigest = value => createHash('sha256').update(checkText(value, MAX_BYTES)).digest('hex');
function checkDigest(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('verification_invalid_digest');
  return value;
}
function list(value, max, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('verification_invalid_list');
  return value;
}
function uniqueIds(values, max = 64, min = 1) {
  list(values, max, min).forEach(checkId);
  if (new Set(values).size !== values.length) throw new Error('verification_duplicate_id');
  return values;
}
function entries(value, source = false) {
  list(value, 32, source ? 1 : 0);
  for (const row of value) {
    exact(row, source ? ['id', 'version', 'text', 'sha256'] : ['id', 'text']);
    checkId(row.id); checkText(row.text);
    if (source) {
      checkText(row.version, 128); checkDigest(row.sha256);
      if (textDigest(row.text) !== row.sha256) throw new Error('verification_source_changed');
    }
  }
  uniqueIds(value.map(row => row.id), 32, source ? 1 : 0);
  return value;
}

function validatePacket(value) {
  const packet = checkedData(value);
  exact(packet, ['schema_version', 'question_id', 'language', 'kind', 'question', 'targets', 'conditions', 'sources']);
  if (packet.schema_version !== 1 || !['en', 'ko'].includes(packet.language) ||
      !Object.hasOwn(questions, packet.kind) || packet.question !== questions[packet.kind]) {
    throw new Error('verification_invalid_question');
  }
  checkId(packet.question_id);
  entries(packet.targets); list(packet.targets, 32);
  entries(packet.conditions); entries(packet.sources, true);
  if (Buffer.byteLength(canonical(packet)) > MAX_PACKET_BYTES) throw new Error('verification_packet_limit');
  return packet;
}
const encodePacket = packet => canonical(validatePacket(packet));

function prepareVerification(value) {
  const input = checkedData(value);
  exact(input, ['run_id', 'turn_id', 'language', 'draft', 'obligations', 'bundle', 'questions']);
  checkId(input.run_id); checkId(input.turn_id); checkText(input.draft, 100000);
  uniqueIds(input.obligations);
  exact(input.bundle, ['targets', 'conditions', 'sources']);
  entries(input.bundle.targets); entries(input.bundle.conditions); entries(input.bundle.sources, true);
  list(input.questions, MAX_QUESTIONS);
  const packets = [], coverage = Object.fromEntries(input.obligations.map(id => [id, []]));
  for (const row of input.questions) {
    exact(row, ['id', 'kind', 'target_ids', 'condition_ids', 'source_ids', 'covers']);
    checkId(row.id);
    const select = (ids, collection, min = 1) => {
      uniqueIds(ids, 32, min);
      return ids.map(id => {
        const entry = collection.find(item => item.id === id);
        if (!entry) throw new Error('verification_unknown_reference');
        return entry;
      });
    };
    const packet = validatePacket({ schema_version: 1, question_id: row.id, language: input.language,
      kind: row.kind, question: questions[row.kind],
      targets: select(row.target_ids, input.bundle.targets),
      conditions: select(row.condition_ids, input.bundle.conditions, 0),
      sources: select(row.source_ids, input.bundle.sources) });
    uniqueIds(row.covers);
    for (const id of row.covers) {
      if (!Object.hasOwn(coverage, id)) throw new Error('verification_unknown_obligation');
      coverage[id].push(row.id);
    }
    packets.push({ question_id: row.id, packet_sha256: digest(packet), input: packet });
  }
  uniqueIds(packets.map(packet => packet.question_id), MAX_QUESTIONS);
  if (Object.values(coverage).some(ids => !ids.length)) throw new Error('verification_uncovered_obligation');
  return { schema_version: 1, run_id: input.run_id, turn_id: input.turn_id,
    draft_sha256: textDigest(input.draft), bundle_sha256: digest(input.bundle), packets, coverage,
    declared_coverage_complete: true, semantic_coverage_verified: false };
}

module.exports = { prepareVerification, validatePacket, encodePacket, MAX_QUESTIONS,
  checkedData, canonical, digest, textDigest, exact, checkId, checkText, checkInt, checkDigest, list, uniqueIds };
