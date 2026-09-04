'use strict';
const fs = require('node:fs');
const path = require('node:path');

function dataRoot() {
  return process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || null;
}

function statePath() {
  const root = dataRoot();
  return root ? path.join(root, 'state.json') : null;
}

function readState() {
  const p = statePath();
  if (!p) return { status: 'unavailable' };
  const leaf = path.dirname(p);
  let leafStat = null;
  try { leafStat = fs.statSync(leaf); }
  catch (e) {
    if (e.code !== 'ENOENT') return { status: 'unavailable' };
    // Leaf missing: absent only when the parent exists. The host may not
    // pre-create <plugin>-<marketplace>/ on a fresh profile.
    try { return fs.statSync(path.dirname(leaf)).isDirectory() ? { status: 'absent' } : { status: 'unavailable' }; }
    catch { return { status: 'unavailable' }; }
  }
  if (!leafStat.isDirectory()) return { status: 'unavailable' };

  let st = null;
  try { st = fs.statSync(p); }
  catch (e) { return e.code === 'ENOENT' ? { status: 'absent' } : { status: 'unavailable' }; }
  if (!st.isFile()) return { status: 'unavailable' };

  let raw;
  try { raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); }
  catch { return { status: 'unavailable' }; }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { status: 'invalid' }; }
  if (!parsed || typeof parsed.enabled !== 'boolean') return { status: 'invalid' };
  return { status: parsed.enabled ? 'on' : 'off' };
}

function writeState(enabled) {
  const p = statePath();
  if (!p) return { ok: false, refused: true };
  const leaf = path.dirname(p);
  try {
    if (!fs.existsSync(leaf)) {
      // Only create the leaf, and only when its parent already exists.
      // statSync throws when the parent is missing entirely (ENOENT); that is
      // a refusal too, not an unexpected crash, so it is caught here rather
      // than left to fall through to the catch-all below.
      let parentIsDir = false;
      try { parentIsDir = fs.statSync(path.dirname(leaf)).isDirectory(); } catch { parentIsDir = false; }
      if (!parentIsDir) return { ok: false, refused: true };
      fs.mkdirSync(leaf);
    } else if (!fs.statSync(leaf).isDirectory()) {
      return { ok: false, refused: true };
    }
    if (fs.existsSync(p) && !fs.statSync(p).isFile()) return { ok: false, refused: true };

    const tmp = path.join(leaf, `.state.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify({ enabled }) + '\n', 'utf8');
    fs.renameSync(tmp, p);
    const back = readState();
    return { ok: back.status === (enabled ? 'on' : 'off') };
  } catch { return { ok: false }; }
}

module.exports = { dataRoot, statePath, readState, writeState };

const POLICY_DIR = path.join(__dirname, '..', 'policy');
// Null prototype: SCOPES[scope] must be undefined for any inherited Object.prototype
// key (constructor, hasOwnProperty, __proto__, ...), never an inherited function/object
// that would pass `if (!names)` and then blow up as non-iterable.
const SCOPES = { __proto__: null, main: ['precedence', 'invariants', 'contract'], subagent: ['precedence', 'invariants'] };

function compose(scope, dir = POLICY_DIR) {
  if (typeof scope !== 'string') return null;
  const names = SCOPES[scope];
  if (!names) return null;
  const parts = [];
  for (const n of names) {
    let text;
    try { text = fs.readFileSync(path.join(dir, `${n}.md`), 'utf8').replace(/^\uFEFF/, '').trim(); }
    catch { return null; }
    if (!text) return null;
    parts.push(text);
  }
  return parts.join('\n\n');
}

module.exports.compose = compose;

const CONTROLS = new Map([['ttak', 'status'], ['ttak on', 'on'], ['ttak off', 'off']]);

function parseControl(prompt) {
  if (typeof prompt !== 'string') return null;
  return CONTROLS.get(prompt.trim().toLowerCase()) || null;
}

module.exports.parseControl = parseControl;

const NOTICE = 'TTAK is installed and off. Send the prompt "ttak on" to turn it on for this host, "ttak off" to turn it off.';
const ERR = 'TTAK could not read or write its saved setting. Nothing was changed.';

function noticeFlagPath() {
  const root = dataRoot();
  return root ? path.join(root, '.notified') : null;
}

function emit(event, text) {
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }), exit: 0 };
}
function block(reason) { return { stdout: JSON.stringify({ decision: 'block', reason }), exit: 0 }; }
const NOOP = { stdout: '', exit: 0 };

function handle(input) {
  try {
    const event = input && input.hook_event_name;
    if (event === 'UserPromptSubmit') {
      const cmd = parseControl(input.prompt);
      if (!cmd) return NOOP;
      // Own containment: a recognised control prompt must stay blocked even
      // if readState/writeState were to throw (they don't today, by design —
      // this is defense against a future regression, not a live path). The
      // outer catch below is for the lifecycle side and must stay fail-open;
      // this one must stay fail-closed.
      try {
        if (cmd === 'status') {
          const s = readState();
          if (s.status === 'unavailable' || s.status === 'invalid') return block(ERR);
          return block(`TTAK saved setting: ${s.status === 'on' ? 'ON' : 'OFF'}. It applies from the next clean session boundary; resumed or compacted contexts may retain earlier text.`);
        }
        const ok = writeState(cmd === 'on').ok;
        return block(ok ? `TTAK saved setting: ${cmd === 'on' ? 'ON' : 'OFF'}.` : ERR);
      } catch { return block(ERR); }
    }

    if (event !== 'SessionStart' && event !== 'SubagentStart') return NOOP;

    const s = readState();
    if (s.status !== 'on') {
      // Notice is for genuinely absent state only (design §4.4). 'off' is an
      // explicit user choice and 'invalid'/'unavailable' are failures; none
      // of those should nag the user with an activation hint.
      if (event !== 'SessionStart' || s.status !== 'absent') return NOOP;
      const flag = noticeFlagPath();
      if (!flag || fs.existsSync(flag)) return NOOP;
      const leaf = path.dirname(flag);
      try {
        // Some hosts never pre-create the leaf directory on a fresh profile
        // (design §4.1): absent state can mean "leaf missing, parent
        // exists". The notice is a deliberate one-time write, exempt from
        // "reads never create" — it may create the leaf, following the same
        // rule writeState uses: only when the parent exists, never when it
        // is missing (a missing parent throws here and is caught below).
        if (!fs.existsSync(leaf)) {
          if (!fs.statSync(path.dirname(leaf)).isDirectory()) return NOOP;
          fs.mkdirSync(leaf);
        } else if (!fs.statSync(leaf).isDirectory()) {
          return NOOP;
        }
        fs.writeFileSync(flag, '');
      } catch { return NOOP; }
      return emit(event, NOTICE);
    }

    const text = compose(event === 'SubagentStart' ? 'subagent' : 'main');
    return text ? emit(event, text) : NOOP;
  } catch { return NOOP; }
}

module.exports.handle = handle;

if (require.main === module) {
  let buf = '';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    let input = null;
    try { input = JSON.parse(buf.replace(/^\uFEFF/, '')); } catch { input = null; }
    let r = { stdout: '', exit: 0 };
    try { r = handle(input); } catch { /* fail open */ }
    try { if (r.stdout) process.stdout.write(r.stdout + '\n'); } catch { /* EPIPE at exit is not a failure */ }
    process.exit(r.exit);
  };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  setTimeout(finish, 1000).unref();
}
