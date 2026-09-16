"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);
const view=c.RoadToGloryMatchView.create({escapeHtml:s=>String(s)});
const p=(id,name,role)=>({playerId:id,name,normalizedRole:role,position:role,overall:80});
const user=[p("u1","Axel","FW")],opp=[p("o1","Shadow","DF")];
const match={period:"first_half",score:{user:1,opponent:0},possession:"user",fieldZone:"attack",actionIndex:5,actionTarget:20,userSquad:{lineup:user,bench:[]},opponentSquad:{name:"Occult",lineup:opp,bench:[]},log:[
 {minute:10,zone:"midfield",actorSide:"user",actorPlayerId:"u1",opponentPlayerId:"o1",actorWon:true,manual:false,score:{user:0,opponent:0}},
 {minute:18,zone:"attack",actorSide:"user",actorPlayerId:"u1",opponentPlayerId:"o1",actorWon:true,manual:false,score:{user:0,opponent:0}},
 {minute:24,zone:"shot",actorSide:"user",actorPlayerId:"u1",opponentPlayerId:"o1",actorWon:true,manual:false,score:{user:1,opponent:0}}
]};
const html=view.matchMarkup(match);
assert.match(html,/Ultime azioni/i);
assert.match(html,/Axel/);
assert.match(html,/GOAL/i);
assert.match(html,/24'/);
console.log("rtg-match-ticker-test: PASS");