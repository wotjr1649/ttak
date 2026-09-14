'use strict';
const fs = require('node:fs');
const path = require('node:path');

function dataRoot() {
  const root = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA;
  return root && path.isAbsolute(root) ? root : null;
}

function statePath() {
  const root = dataRoot();
  return root ? path.join(root, 'state.json') : null;
}

function safePath(p) {
  for (let d = p, prev = null; d !== prev; prev = d, d = path.dirname(d)) {
    try { if (fs.lstatSync(d).isSymbolicLink()) return false; }
    catch (e) { if (e.code !== 'ENOENT') return false; }
  }
  return true;
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
  if (!p || !safePath(p)) return { status: 'unavailable' };
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
  if (!st.isFile() || st.size > 4096) return { status: 'unavailable' };

  let raw;
  try { raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); }
  catch { return { status: 'unavailable' }; }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { status: 'invalid' }; }
  if (!parsed || typeof parsed.enabled !== 'boolean' || Object.keys(parsed).length !== 1) return { status: 'invalid' };
  return { status: parsed.enabled ? 'on' : 'off' };
}

function writeState(enabled) {
  const p = statePath();
  if (typeof enabled !== 'boolean' || !p || !safePath(p) ||
      !['on', 'off', 'absent'].includes(readState().status)) return { ok: false, refused: true };
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

    const tmp = path.join(leaf, `.state.${process.pid}.${require('node:crypto').randomUUID()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify({ enabled }) + '\n', { encoding: 'utf8', flag: 'wx' });
    // Only the rename makes the write visible; until it succeeds the temp file
    // is ours alone ('wx' failed if the name was taken) and nothing else will
    // ever collect it. A read-only state.json is enough to fail the rename on
    // Windows, so without this every retry would leave another orphan in the
    // host's data root. Failure still reports no successful change.
    try { fs.renameSync(tmp, p); }
    catch (e) { try { fs.rmSync(tmp, { force: true }); } catch {} throw e; }
    const back = readState();
    return { ok: back.status === (enabled ? 'on' : 'off') };
  } catch { return { ok: false }; }
}

module.exports = { dataRoot, statePath, readState, writeState };
