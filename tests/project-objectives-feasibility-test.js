'use strict';
const assert=require('node:assert/strict');
global.InazumaProgression=require('../js/roguelike_progression.js');
const Config=require('../js/project-config.js');
const Project=require('../js/project-system.js');
const theoretical={wins:70,bossWins:10,bossStreak:10,firstAttempts:10,role:{FW:20,MF:40,DF:30,GK:30},lives:2,importantStarts:3};
for(const stage of Config.stages){
 assert.ok(stage.wins<=theoretical.wins,`${stage.id}: wins feasible`); assert.ok(stage.bossWins<=theoretical.bossWins,`${stage.id}: bosses feasible`);
 assert.ok((stage.bossStreak||0)<=theoretical.bossStreak); assert.ok((stage.firstAttempts||0)<=theoretical.firstAttempts);
 for(const [role,target] of Object.entries(stage.role)) assert.ok(target<=theoretical.role[role],`${stage.id}: ${role} points feasible`);
 assert.ok((stage.minLives||0)<=theoretical.lives); assert.ok((stage.importantStarts||0)<=theoretical.importantStarts);
}
for(const [role,expected] of Object.entries({FW:2,MF:4,DF:3,GK:3})) { const value=Project.rolePoints({role,playerId:'p'},{won:true,goalsFor:2,goalsAgainst:0,matchType:'boss',scorers:['p']}); assert.equal(value,expected,`${role} uses structured result fields`); }
console.log('project-objectives-feasibility-test: ok');
