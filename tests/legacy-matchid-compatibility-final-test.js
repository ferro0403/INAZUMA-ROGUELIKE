"use strict";
const assert=require("assert");
const fs=require("fs");
const app=fs.readFileSync("js/app.js","utf8");
const special=fs.readFileSync("js/special-match.js","utf8");
assert.ok((app.match(/match\.matchId = global\.RunStatistics\?\.createStableMatchId\?\.\(activeRun, match\) \|\| null;/g)||[]).length >= 2,"Boss/5v5 constructors must retain stable matchId creation");
assert.match(special,/match\.matchId = \[run\.runId, node\.id, "special_match", attemptNumber\]\.join\("::"\);/,"Special constructor must retain historical stable matchId");
assert.doesNotMatch(app,/if \(!currentMatch\.matchId\).*createStableMatchId/s,"Do not invent a new matchId during transactional retry");
console.log("legacy matchId compatibility: historically supported constructors already persist stable ids; no preventive migration added");
