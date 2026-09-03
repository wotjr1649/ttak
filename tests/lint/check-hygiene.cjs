const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'assets', '.claude', '.superpowers']);
const TEXT_EXT = new Set(['.md', '.json', '.cjs', '.js', '.py', '.jsonl', '.yaml', '.yml', '']);
const PROVIDER_WORDS = /\b(Claude|Anthropic|OpenAI|Codex)\b/;
// Instruction text must stay provider-neutral. README and manifests may name hosts.
const NEUTRAL_GLOBS = [/^policy[/\\]/, /^skills[/\\].*SKILL\.md$/];

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
    }
    if (rel.endsWith('SKILL.md')) {
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      if (fm && /^license:/m.test(fm[1]) && !/^license:\s*MIT\s*$/m.test(fm[1])) {
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
