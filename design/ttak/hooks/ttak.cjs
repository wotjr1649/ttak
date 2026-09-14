'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readState, writeState } = require('./state.cjs');

const ROOT = path.resolve(__dirname, '..');
const NONE = { stdout: '', exit: 0 };
const APPLY = 'Applies to guidance loaded at the next SessionStart. Existing conversation text stays; use a fresh conversation to exclude previously loaded guidance.';
const ERROR = 'TTAK setting unavailable or invalid; no successful change confirmed.';

function control(action) {
  if (!['status', 'on', 'off'].includes(action)) return { ok: false, message: 'Usage: ttak [on|off]' };
  if (action !== 'status' && !writeState(action === 'on').ok) return { ok: false, message: ERROR };
  const state = readState().status;
  if (!['on', 'off', 'absent'].includes(state)) return { ok: false, message: ERROR };
  return { ok: true, message: `TTAK saved setting: ${state === 'on' ? 'ON' : 'OFF'}. ${APPLY}` };
}

function parseControl(prompt) {
  if (typeof prompt !== 'string') return null;
  const match = /^(?:ttak|\/ttak(?::ttak)?|\$ttak)(?: (on|off))?$/i.exec(prompt.trim());
  return match ? match[1]?.toLowerCase() || 'status' : null;
}

function compose() {
  // Paths are emitted as inert quoted data; never interpolate them into shell commands.
  if (/[\r\n`]/.test(ROOT)) return null;
  try {
    for (const name of ['explain', 'review']) {
      const p = path.join(ROOT, 'references', `${name}.md`);
      if (!fs.statSync(p).isFile()) return null;
    }
    const core = fs.readFileSync(path.join(ROOT, 'policy/core.md'), 'utf8').trim();
    return core ? core.replaceAll('{{TTAK_ROOT}}', ROOT.replaceAll('\\', '/')) : null;
  } catch { return null; }
}

function handle(input) {
  if (input?.hook_event_name === 'UserPromptSubmit') {
    const action = parseControl(input.prompt);
    if (!action) return NONE;
    const result = control(action);
    return { stdout: JSON.stringify({ decision: 'block', reason: result.message }), exit: 0 };
  }
  if (input?.hook_event_name !== 'SessionStart' || !['startup', 'resume', 'clear', 'compact'].includes(input.source)) return NONE;
  const state = readState().status;
  if (state === 'off' || state === 'absent') return NONE;
  const core = state === 'on' ? compose() : null;
  if (!core) return { stdout: JSON.stringify({ systemMessage: 'TTAK guidance unavailable; activation not confirmed.' }), exit: 0 };
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: core } }), exit: 0 };
}

module.exports = { control, parseControl, compose, handle };

if (require.main === module) {
  if (process.argv.length > 2) {
    const result = control(process.argv.length === 3 ? process.argv[2] : 'invalid');
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.ok ? 0 : 1;
  } else {
    let text = '', done = false;
    const finish = () => {
      if (done) return;
      done = true;
      let input;
      try { input = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { input = null; }
      const result = handle(input);
      if (result.stdout) process.stdout.write(result.stdout + '\n');
      process.exitCode = result.exit;
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      text += chunk;
      if (Buffer.byteLength(text) > 65536) { text = ''; finish(); process.stdin.destroy(); }
    });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(() => { text = ''; finish(); process.stdin.destroy(); }, 1000).unref();
  }
}
