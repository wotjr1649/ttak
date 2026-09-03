const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'docs');
const EN = path.join(DOCS, 'TTAK_Plugin_Product_Definition_v0.2_EN.md');
const KO = path.join(DOCS, 'TTAK_Plugin_Product_Definition_v0.2_KO.md');

// Requirement IDs appear as [FAMILY-NNN] at the start of a list item.
const ID_RE = /\[([A-Z][A-Z-]*-\d{3})\]/g;

function ids(file) {
  const text = fs.readFileSync(file, 'utf8');
  return new Set(Array.from(text.matchAll(ID_RE), (m) => m[1]));
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

const en = ids(EN);
const ko = ids(KO);
const onlyEn = diff(en, ko);
const onlyKo = diff(ko, en);

if (onlyEn.length || onlyKo.length) {
  if (onlyEn.length) console.error('Only in EN:', onlyEn.join(', '));
  if (onlyKo.length) console.error('Only in KO:', onlyKo.join(', '));
  process.exit(1);
}
console.log(`ID sets match: ${en.size} ids`);
