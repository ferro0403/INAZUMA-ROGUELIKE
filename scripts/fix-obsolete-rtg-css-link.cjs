const fs = require('fs');
const path = 'index.html';
const source = fs.readFileSync(path, 'utf8');
const target = /^\s*<link rel="stylesheet" href="css\/road-to-glory\.css[^\n]*\n/m;
if (!target.test(source)) {
  console.error('road-to-glory.css link not found');
  process.exit(1);
}
const updated = source.replace(target, '');
fs.writeFileSync(path, updated, 'utf8');
console.log('Removed obsolete road-to-glory.css link from index.html');
// workflow trigger
