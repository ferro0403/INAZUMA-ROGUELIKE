const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const refs = [];
for (const m of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)) {
  const raw = m[1];
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//') || raw.startsWith('data:')) continue;
  const clean = raw.split('?')[0].split('#')[0].replace(/^\//, '');
  if (!clean || !(clean.endsWith('.js') || clean.endsWith('.css'))) continue;
  refs.push(clean);
}
const unique = [...new Set(refs)];
const missing = unique.filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('Missing local index references:\n' + missing.join('\n'));
  process.exit(1);
}
console.log('Verified ' + unique.length + ' local JS/CSS references from index.html');
