'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { prepareVerification, encodePacket, validatePacket, textDigest, digest, checkedData } = require('../scripts/verification-packet.cjs');
const fixture = require('./fixtures/verification-p0.cjs');

test('child packets contain only a fixed question and selected independent evidence', () => {
  const input = fixture.input(), before = structuredClone(input), result = prepareVerification(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.packets[0].input, { schema_version: 1, question_id: 'Q1', language: 'en', kind: 'relationship',
    question: 'What relationships hold between the selected targets under the supplied conditions?',
    targets: input.bundle.targets, conditions: input.bundle.conditions, sources: [input.bundle.sources[0]] });
  assert.doesNotMatch(encodePacket(result.packets[0].input), /PRIVATE_DRAFT|Run89|Turn1|O1|Monitoring/);
  assert.deepEqual(result.coverage, { O1: ['Q1'], O2: ['Q2'] });
  assert.equal(result.declared_coverage_complete, true);
  assert.equal(result.semantic_coverage_verified, false);
});
test('changing the parent draft changes the parent binding but never the child input', () => {
  const input = fixture.input(), first = prepareVerification(input);
  input.draft = 'A completely different, incorrect parent answer.';
  const second = prepareVerification(input);
  assert.notEqual(second.draft_sha256, first.draft_sha256);
  assert.deepEqual(second.packets, first.packets);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  assert.equal(digest(prepareVerification(reordered)), digest(second));
  second.packets[0].input.sources[0].text = 'Caller mutation';
  assert.equal(first.packets[0].input.sources[0].text, input.bundle.sources[0].text);
});
test('closed selectors reject draft forwarding, arbitrary paths, URLs and executable controls', () => {
  const mutations = [v => v.parent_history = 'DRAFT', v => v.questions[0].answer = 'DRAFT',
    v => v.questions[0].question = 'Why is the draft correct?', v => v.questions[0].tool = 'Bash',
    v => v.bundle.sources[0].path = '../transcript', v => v.bundle.sources[0].url = 'https://example.test',
    v => v.questions[0].source_ids = ['../S1'], v => v.questions[0].target_ids = ['C:\\draft'],
    v => v.questions[0].condition_ids = ['https://example.test'], v => v.questions[0].kind = 'constructor'];
  for (const mutate of mutations) { const input = fixture.input(); mutate(input); assert.throws(() => prepareVerification(input)); }
});
test('declared obligations cannot be dropped and references cannot be duplicated or invented', () => {
  for (const mutate of [v => v.questions.pop(), v => v.questions[1].covers = ['O1'],
    v => v.questions[0].covers = ['Unknown'], v => v.questions[0].source_ids = ['S1', 'S1'],
    v => v.questions[0].source_ids = ['Missing'], v => v.questions[1].id = 'Q1',
    v => v.bundle.sources.push(v.bundle.sources[0]), v => v.obligations.push('O1'),
    v => v.bundle.sources[0].text += ' Changed', v => v.questions[0].source_ids = []]) {
    const input = fixture.input(); mutate(input); assert.throws(() => prepareVerification(input));
  }
});
test('question limits reject overflow instead of silently trimming important questions', () => {
  const input = fixture.input();
  input.questions = Array.from({ length: 8 }, (_, index) => ({ ...structuredClone(input.questions[0]), id: 'Q' + (index + 1), covers: ['O1', 'O2'] }));
  assert.equal(prepareVerification(input).packets.length, 8);
  input.questions.push({ ...input.questions[0], id: 'Q9' });
  assert.throws(() => prepareVerification(input), /invalid_list/);
});
test('source bytes, Unicode and packet size are checked without normalizing evidence', () => {
  const input = fixture.input(), source = input.bundle.sources[0];
  source.text = '한글 🌱\r\nExact evidence.'; source.sha256 = textDigest(source.text);
  const plan = prepareVerification(input);
  assert.equal(plan.packets[0].input.sources[0].text, source.text);
  source.text += '\ud800'; source.sha256 = '0'.repeat(64);
  assert.throws(() => prepareVerification(input), /invalid_unicode/);
  const large = fixture.input();
  for (const item of large.bundle.targets) item.text = 'x'.repeat(32768);
  assert.throws(() => prepareVerification(large), /packet_limit/);
  const tampered = plan.packets[0].input; tampered.question += ' Extra conclusion.';
  assert.throws(() => validatePacket(tampered), /invalid_question/);
});
test('non-JSON objects cannot execute getters or serializers during validation', () => {
  let executions = 0;
  const accessor = fixture.input();
  Object.defineProperty(accessor, 'draft', { enumerable: true, get() { executions++; return 'wrong'; } });
  const serializer = fixture.input(); serializer.toJSON = () => { executions++; return {}; };
  for (const value of [accessor, serializer, Object.assign(Object.create({ inherited: true }), fixture.input()),
    { value: undefined }, { value: Infinity }, new Date(), new Array(3), JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => checkedData(value));
  }
  assert.equal(executions, 0);
  const cycle = {}; cycle.self = cycle; assert.throws(() => checkedData(cycle));
  let deep = {}; for (let i = 0; i < 20; i++) deep = { deep }; assert.throws(() => checkedData(deep), /limit/);
});
test('possible secrets are rejected with fixed errors and are not emitted as error details', () => {
  const input = fixture.input(); input.bundle.sources[0].text = 'sk-' + 'x'.repeat(24);
  assert.throws(() => prepareVerification(input), error => error.message === 'verification_content_rejected');
});
test('source hashes and coverage labels do not certify neutral premises or factual accuracy', () => {
  const input = fixture.input();
  input.bundle.targets[0].text = 'An unsupported premise deliberately supplied by the fixture author';
  const plan = prepareVerification(input);
  assert.equal(plan.semantic_coverage_verified, false);
  assert.equal(plan.packets[0].input.targets[0].text, input.bundle.targets[0].text);
  // The caller still has to review source selection and premise neutrality; no classifier is faked.
});
