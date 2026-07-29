'use strict';
const assert = require('node:assert/strict');
global.InazumaProgression = require('../js/roguelike_progression.js');
global.ProjectConfig = require('../js/project-config.js');
const Project = require('../js/project-system.js');
const player = { playerId:'p', position:'FW', category:'Elite', finalOverall:84 };
const freeAgents = { players:[player] }; const run = { runId:'r', version:2, roster:[{playerId:'p'}], lineup:['p'], initialLives:2 };
Project.select(run, player, { freeAgents, developmentCenter:{players:{}} });
function match(id, lineup, completed=true) { const snapshot = Project.snapshotMatch(run,{matchId:id,type:'boss',bossId:id,lineup}); return Project.processMatch(run,snapshot,{official:true,completed,won:true,goalsFor:2,goalsAgainst:0,scorers:[]}); }
match('old-1',['p']); match('old-2',['p']); match('old-3',['p']);
assert.equal(Project.importantStarts(run,'p',3),3,'the latest three important starts qualify');
match('latest-bench',[]);
assert.equal(Project.importantStarts(run,'p',3),0,'an older trio cannot hide a later bench appearance');
const ledger=run.projectSystem.importantMatchParticipation;
assert.equal(ledger.at(-1).started,false); assert.equal(ledger.at(-1).playerId,'p');
const migrated={projectSystem:{schemaVersion:1,players:{},importantMatchesStarted:['legacy']}}; Project.migrateRun(migrated); assert.deepEqual(migrated.projectSystem.importantMatchParticipation,[],'legacy saves receive no invented participation');
console.log('project-important-matches-test: ok');
