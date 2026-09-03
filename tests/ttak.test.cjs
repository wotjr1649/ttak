const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('English and Korean documents carry identical requirement-ID sets', () => {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'scripts', 'check-id-sets.cjs')],
    { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /ID sets match: \d+ ids/);
});
