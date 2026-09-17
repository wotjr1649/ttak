'use strict';
// Mechanical boundaries only; preserve every source code unit, including whitespace.
function textAnchors(text, limit = 4096) {
  if (typeof text !== 'string' || text.length > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 4096) {
    throw new Error('invalid_source_anchor_text');
  }
  const anchors = []; let start = 0, offset = 0;
  const emit = end => {
    const part = text.slice(start, end);
    if (!part.trim() && anchors.length) {
      anchors.at(-1).end = end; anchors.at(-1).text += part;
    } else {
      if (anchors.length >= limit) throw new Error('too_many_source_anchors');
      anchors.push({ start, end, text: part });
    }
    start = end;
  };
  for (const char of text) {
    offset += char.length;
    const next = text[offset];
    if (char === '\n' || char === '\r' && next !== '\n' ||
        /[.!?。！？]/u.test(char) && (next === undefined || /\s/u.test(next))) emit(offset);
  }
  if (start < text.length) emit(text.length);
  return anchors;
}
module.exports = { textAnchors };
