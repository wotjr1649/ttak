'use strict';
// Pure comparison of tool data. No model, filesystem, network or semantic-quality verdict.
const { isDeepStrictEqual } = require('node:util');
const { explainScenario } = require('./finite-scenario-render.cjs');
const MAX_BYTES = 1048576;
const boundedText = value => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_BYTES;
function inspectScenarioDelivery(input, content, finalAnswer) {
  const report = { input_valid: false, response_matches_computation: false, response_format: null,
    final_text_valid: boundedText(finalAnswer), explanation_verbatim_in_final: false,
    semantic_quality_verified: false };
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2 ||
      !Object.hasOwn(input, 'scenario') || !Object.hasOwn(input, 'language')) return report;
  let expected;
  try { expected = explainScenario(input.scenario, input.language); } catch { return report; }
  report.input_valid = true;
  if (report.final_text_valid) report.explanation_verbatim_in_final = finalAnswer.includes(expected.explanation);
  // Only observed transport forms: a string or one MCP text block. Do not search arbitrary nesting.
  let text = content;
  if (Array.isArray(content)) {
    if (content.length !== 1 || content[0]?.type !== 'text') return report;
    text = content[0].text;
  }
  if (!boundedText(text)) return report;
  if (text === expected.explanation) {
    report.response_matches_computation = true; report.response_format = 'plain_text';
    return report;
  }
  let structured;
  try { structured = JSON.parse(text); } catch { return report; }
  report.response_format = 'structured_json';
  // Compare facts too: a matching explanation cannot conceal changed coverage or dependencies.
  report.response_matches_computation = isDeepStrictEqual(structured, expected);
  return report;
}
module.exports = { inspectScenarioDelivery };
