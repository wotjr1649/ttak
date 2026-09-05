const { compose } = require('../hooks/ttak.cjs');

// approxTokens is a stated approximation at four characters per token, not a
// tokenizer measurement. Report it as such wherever it is published.
const out = {};
for (const scope of ['main', 'subagent']) {
  const text = compose(scope) || '';
  out[scope] = { bytes: Buffer.byteLength(text, 'utf8'), approxTokens: Math.ceil(text.length / 4) };
}
console.log(JSON.stringify(out, null, 2));
