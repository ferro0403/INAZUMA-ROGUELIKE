const fs = require('fs');
const { execFileSync } = require('child_process');

const path = 'index.html';
const baselineRef = 'db49969ad97761034ae7ba41a9e61e3a0ebbcfc8';
const anchor = '    <script src="js/moves/move-presentation.js?v=20260914-season-visual-fix-1"></script>\n';
const end = '  </body>';

const current = fs.readFileSync(path, 'utf8');
const baseline = execFileSync('git', ['show', baselineRef + ':index.html'], { encoding: 'utf8' });

const currentStart = current.indexOf(anchor);
const currentEnd = current.indexOf(end, currentStart);
const baselineStart = baseline.indexOf(anchor);
const baselineEnd = baseline.indexOf(end, baselineStart);

if ([currentStart, currentEnd, baselineStart, baselineEnd].some((n) => n < 0)) {
  throw new Error('Unable to locate bootstrap tail boundaries');
}

const baselineTail = baseline.slice(baselineStart, baselineEnd);
const repaired = current.slice(0, currentStart) + baselineTail + current.slice(currentEnd);

const required = [
  'js/app/app-bootstrap.js',
  'js/home/home-controller.js',
  'js/app.js',
  'js/run/run-roster-runtime.js',
  'js/player/player-detail-controller.js'
];
for (const item of required) {
  if (!repaired.includes(item)) throw new Error('Missing restored bootstrap dependency: ' + item);
}

fs.writeFileSync(path, repaired, 'utf8');
console.log('Restored application bootstrap tail from pre-regression commit ' + baselineRef);
// diagnostic rerun 2
