'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs');
const { testPython } = require('../scripts/test-python.cjs');
test('Windows requires an explicit interpreter before any process can start', () => {
  for (const value of [null, '', 'python', 'py.exe', 'python3', 'relative/python.exe', 'bad\npath']) {
    assert.throws(() => testPython(value, 'win32'), /Set TTAK_TEST_PYTHON/);
  }
});
test('Windows Store aliases are rejected without invoking them', () => {
  for (const name of ['python.exe', 'py.exe', 'python3.exe']) {
    assert.throws(() => testPython('C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\' + name, 'win32'), /aliases/);
  }
});
test('the configured existing interpreter resolves without PATH lookup', () => {
  assert.equal(testPython(process.execPath, 'win32'), fs.realpathSync(process.execPath));
  assert.equal(testPython(null, 'linux'), 'python3');
});
