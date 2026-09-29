const fs = require('fs');
const path = require('path');

const cssDir = path.resolve('css');
const files = fs.readdirSync(cssDir).filter((name) => name.endsWith('.css'));
const missing = [];
let checked = 0;

for (const name of files) {
  const filePath = path.join(cssDir, name);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const raw = match[2].trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//') || raw.includes('var(')) continue;
    const clean = raw.split('?')[0].split('#')[0];
    if (!clean) continue;
    const resolved = clean.startsWith('/') ? path.resolve(clean.slice(1)) : path.resolve(path.dirname(filePath), clean);
    checked++;
    if (!fs.existsSync(resolved)) missing.push({ css: name, reference: raw, resolved: path.relative(process.cwd(), resolved) });
  }
}

if (missing.length) {
  console.error('Missing local CSS url() references:');
  for (const item of missing) console.error(`${item.css}: ${item.reference} -> ${item.resolved}`);
  process.exit(1);
}
console.log(`Verified ${checked} local CSS url() references across ${files.length} stylesheets`);
