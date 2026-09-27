const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const refs = [];
for (const m of html.matchAll(/<(?:script|link)\\b[^>]+(?:src|href)="([^"]+)"/g)) {
  const raw = m[1];
  if (/^(?:https?:)?\\/\\//.test(raw) || raw.startsWith('data:')) continue;
  const clean = raw.split('?')[0].split('#')[0].replace(/^\\//, '');
  if (!clean || !/\\.(?:js|css)$/.test(clean)) continue;
  refs.push(clean);
}
const missing = [...new Set(refs)].filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('Missing local index references:\n' + missing.join('\n'));
  process.exit(1);
}
console.log('Verified ' + new Set(refs).size + ' local JS/CSS references from index.html');
