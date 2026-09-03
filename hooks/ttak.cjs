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
  if (!p) return { ok: false };
  const leaf = path.dirname(p);
  try {
    if (!fs.existsSync(leaf)) {
      // Only create the leaf, and only when its parent already exists.
      if (!fs.statSync(path.dirname(leaf)).isDirectory()) return { ok: false };
      fs.mkdirSync(leaf);
    } else if (!fs.statSync(leaf).isDirectory()) {
      return { ok: false };
    }
    if (fs.existsSync(p) && !fs.statSync(p).isFile()) return { ok: false };

    const tmp = path.join(leaf, `.state.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify({ enabled }) + '\n', 'utf8');
    fs.renameSync(tmp, p);
    const back = readState();
    return { ok: back.status === (enabled ? 'on' : 'off') };
  } catch { return { ok: false }; }
}

module.exports = { dataRoot, statePath, readState, writeState };
