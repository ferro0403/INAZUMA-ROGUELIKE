"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");const c={console};c.globalThis=c;for(const f of["js/match-simulator-config.js","js/match-simulator.js"])vm.runInNewContext(fs.readFileSync(f,"utf8"),c);
for(const[mode,u,o]of[["eleven",70,70],["eleven",75,70],["eleven",60,70],["five",73,70],["five",67,70]]){const chance=c.MatchSimulator.getMatchWinProbabilities(mode,u,o,2).userChance;let wins=0;for(let i=0;i<10000;i++){const rng=c.MatchSimulator.createRng(`stat:${mode}:${u}:${o}:${i}`);if(c.MatchSimulator.determineUserWins(chance,rng))wins++;}assert(Math.abs(wins/10000-chance/100)<.02);}
console.log("match V2 statistical regression: 10,000 seeded trials per scenario within tolerance");
