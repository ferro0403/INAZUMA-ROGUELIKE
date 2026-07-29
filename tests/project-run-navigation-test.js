'use strict'; const assert=require('node:assert/strict'); const fs=require('node:fs'); const source=fs.readFileSync('js/app.js','utf8');
const nav=source.slice(source.indexOf('function bottomNav'),source.indexOf('function cssEscape'));
assert.match(nav,/\["project", "Progetto", "project"\]/); assert.match(nav,/aria-current/); assert.match(nav,/run\.phase = "project"/); assert.match(source,/if \(run\.phase === "project"\) return renderProjectPlayerPage/); assert.doesNotMatch(source.slice(source.indexOf('function homeActiveRunMarkup'),source.indexOf('function homeEmptyRunMarkup')),/projectHomeMarkup/); assert.match(source,/developmentCenterReturn = "project"/); assert.match(source,/renderProjectPlayerPage\(\) : renderHome/);
console.log('project-run-navigation-test: ok');
