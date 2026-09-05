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

// Two different questions, and only lstat answers the first one.
//
//   "does this name exist"        -> lstatSync, which does not follow links
//   "can I walk through it"       -> statSync, which does
//
// statSync alone conflates them: it reports ENOENT both for a name that is
// free and for a name occupied by something unwalkable. On Windows an
// ancestor that is a plain file gives ENOENT rather than ENOTDIR, and a
// dangling directory junction -- an ordinary unprivileged NTFS shape -- gives
// ENOENT while the name is plainly taken. Reading either as "free" hands back
// 'absent', which the status prompt reports as a confident OFF for a path
// nothing can ever be written to. So ask both: walk up past names that do not
// exist, and stop at the first one that does. Creates nothing.
function nearestExistingStat(p) {
  for (let d = p, prev = null; d !== prev; prev = d, d = path.dirname(d)) {
    try { fs.lstatSync(d); }
    catch (e) { if (e.code === 'ENOENT') continue; return null; }
    try { return fs.statSync(d); }
    catch { return null; }
  }
  return null;
}

function readState() {
  const p = statePath();
  if (!p) return { status: 'unavailable' };
  const leaf = path.dirname(p);
  let leafStat = null;
  try { leafStat = fs.statSync(leaf); }
  catch (e) {
    if (e.code !== 'ENOENT') return { status: 'unavailable' };
    // Absent however many levels are missing, but only when what does exist
    // above them is a directory. Codex 0.153.4 creates no part of
    // <CODEX_HOME>/plugins/data/, so requiring the immediate parent made a
    // fresh Codex profile read 'unavailable', suppressed the first-session
    // notice and made 'ttak on' fail forever. Accepting every ENOENT instead
    // made a file-for-an-ancestor read 'absent', which the status prompt
    // reports as a confident OFF for a path nothing can ever be written to.
    const anc = nearestExistingStat(leaf);
    return anc && anc.isDirectory() ? { status: 'absent' } : { status: 'unavailable' };
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
      // Create the whole path. Codex never creates <CODEX_HOME>/plugins/data/,
      // so refusing a missing parent meant 'ttak on' could never succeed on a
      // fresh Codex profile (observed, docs/analysis/codex-cli/). The safety
      // this once protected is held by dataRoot(): it returns null unless the
      // host named a root, so a recursive create only ever happens under a
      // directory the host chose. Reads still never create.
      // Still a refusal, not a crash, when what exists above the missing
      // levels is not a directory -- mkdirSync would throw and the catch-all
      // would drop the `refused` flag readState and the caller rely on.
      const anc = nearestExistingStat(leaf);
      if (!anc || !anc.isDirectory()) return { ok: false, refused: true };
      fs.mkdirSync(leaf, { recursive: true });
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
// Frozen because it is exported: the suite asserts its own hand-written scope
// model against this one instead of hand-copying it, and this object decides
// what text gets injected, so the export is read-only.
const SCOPES = Object.freeze({ __proto__: null,
  main: Object.freeze(['precedence', 'invariants', 'contract']),
  subagent: Object.freeze(['precedence', 'invariants']) });

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
module.exports.SCOPES = SCOPES;

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
        // Some hosts never pre-create anything under their plugin data root
        // on a fresh profile — Codex creates neither the leaf nor its parent.
        // The notice is a deliberate one-time write, exempt from "reads never
        // create", and follows the same rule writeState uses: create the whole
        // path under the host-named root. Without this the notice never fires
        // on a fresh Codex profile, and the notice is the plugin's only
        // discovery path.
        if (!fs.existsSync(leaf)) {
          fs.mkdirSync(leaf, { recursive: true });
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
    if (r.stdout) process.stdout.write(r.stdout + '\n');
    process.exit(r.exit);
  };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  setTimeout(finish, 1000).unref();
}
