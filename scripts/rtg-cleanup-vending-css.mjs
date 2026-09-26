import fs from 'node:fs';

const path = 'css/road-to-glory.css';
const text = fs.readFileSync(path, 'utf8');
const needles = [
  '.rtg-vending',
  '.rtg-machine-',
  '.rtg-capsule',
  '.rtg-ball',
  '.rtg-pull-',
  '.modal.rtg-pull-modal',
  '.modal-backdrop:has(.rtg-pull-modal)'
];

function matchingBrace(source, openIndex) {
  let depth = 1;
  let quote = null;
  let comment = false;
  for (let i = openIndex + 1; i < source.length; i += 1) {
    if (comment) {
      if (source.startsWith('*/', i)) { comment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (source[i] === '\\') { i += 1; continue; }
      if (source[i] === quote) quote = null;
      continue;
    }
    if (source.startsWith('/*', i)) { comment = true; i += 1; continue; }
    if (source[i] === '"' || source[i] === "'") quote = source[i];
    else if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unbalanced CSS braces');
}

function cleanBlock(source) {
  let out = '';
  let pos = 0;
  while (pos < source.length) {
    const openIndex = source.indexOf('{', pos);
    if (openIndex < 0) return out + source.slice(pos);
    const closeIndex = matchingBrace(source, openIndex);
    const lastBrace = source.lastIndexOf('}', openIndex - 1);
    const lastSemi = source.lastIndexOf(';', openIndex - 1);
    const preludeStart = Math.max(pos, Math.max(lastBrace, lastSemi) + 1);
    out += source.slice(pos, preludeStart);
    const prelude = source.slice(preludeStart, openIndex);
    const selector = prelude.trim();
    const body = source.slice(openIndex + 1, closeIndex);

    if (/^@(media|supports|layer)\b/.test(selector)) {
      const cleanedBody = cleanBlock(body);
      if (cleanedBody.trim()) out += `${prelude}{${cleanedBody}}`;
    } else if (selector.startsWith('@')) {
      out += `${prelude}{${body}}`;
    } else if (!needles.some((needle) => selector.includes(needle))) {
      out += `${prelude}{${body}}`;
    }
    pos = closeIndex + 1;
  }
  return out;
}

const cleaned = cleanBlock(text);
fs.writeFileSync(path, cleaned);
console.log(`road-to-glory.css: ${text.length} -> ${cleaned.length} chars`);
