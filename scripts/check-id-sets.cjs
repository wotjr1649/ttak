const fs = require('node:fs');
const path = require('node:path');

// Requirement definitions are list items of the form `- [ID]`. Prose
// cross-references to the same IDs are not definitions and MUST NOT count:
// 16 IDs occur 2-4 times per document, so matching every bracketed
// occurrence let a deleted requirement hide behind an unchanged total.
const ID_RE = /^- \[([A-Z][A-Z-]*-\d{3})\]/gm;

function docs(dir) {
  const d = dir || path.join(__dirname, '..', 'docs');
  return {
    EN: path.join(d, 'TTAK_Plugin_Product_Definition_v0.2_EN.md'),
    KO: path.join(d, 'TTAK_Plugin_Product_Definition_v0.2_KO.md'),
  };
}

function ids(file) {
  const text = fs.readFileSync(file, 'utf8');
  return new Set(Array.from(text.matchAll(ID_RE), (m) => m[1]));
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

function check(dir) {
  const { EN, KO } = docs(dir);
  const en = ids(EN);
  const ko = ids(KO);
  const onlyEn = diff(en, ko);
  const onlyKo = diff(ko, en);

  if (onlyEn.length || onlyKo.length) {
    if (onlyEn.length) console.error('Only in EN:', onlyEn.join(', '));
    if (onlyKo.length) console.error('Only in KO:', onlyKo.join(', '));
    return 1;
  }
  console.log(`ID sets match: ${en.size} ids`);
  return 0;
}

if (require.main === module) {
  // exitCode, not exit(): lets stdout flush before the process ends.
  process.exitCode = check(process.argv[2]);
}

module.exports = { ids, docs, check };
