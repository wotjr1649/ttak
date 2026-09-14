'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { explainScenario } = require('../scripts/finite-scenario-render.cjs');
const { inspectScenarioDelivery } = require('../scripts/finite-scenario-audit.cjs');
const input = { scenario: { initial: { alpha: true, beta: true }, invariant: { cells: ['alpha','beta'], at_least: 1 },
  transactions: [{ id: 'First', guard: { cells: ['beta'], at_least: 1 }, writes: { alpha: false } },
    { id: 'Second', guard: { cells: ['alpha'], at_least: 1 }, writes: { beta: false } }] }, language: 'en' };
const expected = explainScenario(input.scenario, input.language);
test('plain and JSON-encoded native responses preserve the same computation including escaped newlines', () => {
  for (const text of [expected.explanation, JSON.stringify(expected)]) for (const content of [text, [{type:'text',text}]]) {
    const result = inspectScenarioDelivery(input, content, expected.explanation);
    assert.equal(result.response_matches_computation, true);
    assert.equal(result.explanation_verbatim_in_final, true);
    assert.equal(result.semantic_quality_verified, false);
  }
});
test('matching tool output does not certify a paraphrase or even the prose around a verbatim block', () => {
  const paraphrase = inspectScenarioDelivery(input, JSON.stringify(expected), 'An unverified paraphrase.');
  assert.equal(paraphrase.response_matches_computation, true);
  assert.equal(paraphrase.explanation_verbatim_in_final, false);
  const extra = inspectScenarioDelivery(input, expected.explanation, expected.explanation+'\nAll databases are verified.');
  assert.equal(extra.explanation_verbatim_in_final, true);
  assert.equal(extra.semantic_quality_verified, false);
});
test('matching explanation cannot hide changed facts, missing fields or extra payload', () => {
  for (const value of [{...expected,facts:{...expected.facts,real_database_verified:true}},
    {explanation:expected.explanation}, {...expected,extra:'ignored?'}, {wrapper:expected},
    {...expected,explanation:expected.explanation+' changed'}]) {
    assert.equal(inspectScenarioDelivery(input, JSON.stringify(value), expected.explanation).response_matches_computation, false);
  }
});
test('malformed, oversized, mixed and executable-looking content is rejected without reflecting it', () => {
  for (const content of ['{bad','private_marker_do_not_echo','x'.repeat(1048577),
    [{type:'text',text:expected.explanation},{type:'text',text:'extra'}],
    [{type:'image',text:expected.explanation}], {text:expected.explanation}]) {
    const result = inspectScenarioDelivery(input, content, expected.explanation);
    assert.equal(result.response_matches_computation, false);
    assert.ok(!JSON.stringify(result).includes('private_marker_do_not_echo'));
  }
  assert.equal(inspectScenarioDelivery(input,expected.explanation,'x'.repeat(1048577)).final_text_valid,false);
});
test('invalid input and Unicode language handling are kept distinct from final quality', () => {
  assert.equal(inspectScenarioDelivery({...input,extra:true},expected.explanation,'answer').input_valid,false);
  assert.equal(inspectScenarioDelivery({...input,language:'unknown'},expected.explanation,'answer').input_valid,false);
  const ko = {...input,language:'ko'}, result = explainScenario(ko.scenario,ko.language);
  assert.equal(inspectScenarioDelivery(ko,JSON.stringify(result),result.explanation).response_matches_computation,true);
});
