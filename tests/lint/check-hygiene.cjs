const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'assets', '.claude', '.superpowers']);
const TEXT_EXT = new Set(['.md', '.json', '.cjs', '.js', '.py', '.jsonl', '.yaml', '.yml', '']);
const PROVIDER_WORDS = /\b(Claude|Anthropic|OpenAI|Codex)\b/;
// Instruction text must stay provider-neutral. README and manifests may name hosts.
// walk() normalises every path to forward slashes, so a backslash alternative
// here would be unreachable on every platform. Do not add one.
const NEUTRAL_GLOBS = [/^policy\//, /^skills\/.*SKILL\.md$/];

function walk(dir, root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), root, out);
    } else {
      out.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join('/'));
    }
  }
  return out;
}

function checkHygiene(root) {
  const files = walk(root, root);
  const crFiles = [];
  const licenseMismatch = [];
  const providerLeaks = [];

  for (const rel of files) {
    const ext = path.extname(rel);
    if (!TEXT_EXT.has(ext)) continue;
    const buf = fs.readFileSync(path.join(root, rel));
    if (buf.includes(0x0d)) crFiles.push(rel);
    const text = buf.toString('utf8');

    if (ext === '.json') {
      const declared = text.match(/"license"\s*:\s*"([^"]*)"/g) || [];
      for (const d of declared) if (!/"MIT"/.test(d)) licenseMismatch.push(`${rel}: ${d}`);
      // A plugin manifest must declare a license; iterating only what matched
      // above means a manifest that omits the key entirely is never examined
      // (the same "declared implies checked" gap the frontmatter branch had).
      if (path.basename(rel) === 'plugin.json' && declared.length === 0) {
        licenseMismatch.push(`${rel}: missing license`);
      }
    }
    if (rel.endsWith('SKILL.md')) {
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      if (fm && !/^license:\s*MIT\s*$/m.test(fm[1])) {
        licenseMismatch.push(`${rel}: frontmatter license`);
      }
    }
    if (NEUTRAL_GLOBS.some((g) => g.test(rel)) && PROVIDER_WORDS.test(text)) {
      providerLeaks.push(rel);
    }
  }
  return { crFiles, licenseMismatch, providerLeaks };
}

module.exports = { checkHygiene };

function checkManifests(root) {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const claude = read('.claude-plugin/plugin.json');
  const codex = read('.codex-plugin/plugin.json');
  const cMkt = read('.claude-plugin/marketplace.json');
  const aMkt = read('.agents/plugins/marketplace.json');
  const mismatches = [];

  if (claude.name !== codex.name) mismatches.push('name: claude vs codex');
  if (claude.version !== codex.version) mismatches.push('version: claude vs codex');
  if (claude.license !== 'MIT' || codex.license !== 'MIT') mismatches.push('license is not MIT');

  const entry = (m) => (m.plugins || []).find((p) => p.name === claude.name);
  if (!entry(cMkt)) mismatches.push('claude marketplace has no entry for the plugin');
  if (!entry(aMkt)) mismatches.push('agents marketplace has no entry for the plugin');

  const a = entry(aMkt);
  if (a && (!a.policy || !a.policy.installation || !a.policy.authentication || !a.category)) {
    mismatches.push('agents marketplace entry is missing required policy/category fields');
  }
  return { mismatches };
}
module.exports.checkManifests = checkManifests;
