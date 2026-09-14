'use strict';
// Resolve before launching tests: Windows aliases may install runtimes automatically.
const fs = require('node:fs'), path = require('node:path');
function testPython(configured = process.env.TTAK_TEST_PYTHON, platform = process.platform) {
  if (!configured && platform !== 'win32') return 'python3';
  if (typeof configured !== 'string' || !path.isAbsolute(configured) ||
      /[\x00-\x1f]/.test(configured) || /(?:^|[\\/])WindowsApps(?:[\\/]|$)/i.test(configured)) {
    throw new Error('Set TTAK_TEST_PYTHON to an existing Python interpreter absolute path; installation aliases are not allowed.');
  }
  const actual = fs.realpathSync(configured);
  if (/(?:^|[\\/])WindowsApps(?:[\\/]|$)/i.test(actual) || !fs.statSync(actual).isFile()) {
    throw new Error('TTAK_TEST_PYTHON must resolve to an existing interpreter file.');
  }
  return actual;
}
module.exports = { testPython };
