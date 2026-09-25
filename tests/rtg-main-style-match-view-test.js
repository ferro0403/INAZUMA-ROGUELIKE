"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const compact=(player,opts={})=>`<button class="player-card player-card-compact ${opts.extraClass||""}" ${opts.dataAttr||""}><strong>${player.name||player.playerId}</strong></button>`;
const formationLayout={displayRows:formation=>[
 {role:"FW",count:3},{role:"MF",count:3},{role:"DF",count:4},{role:"GK",count:1}
]};
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);
const view=c.RoadToGloryMatchView.create({escapeHtml:s=>String(s),compactPlayerCardMarkup:compact,formationLayout,formationById:()=>({requirements:{FW:3,MF:3,DF:4,GK:1}})});
const p=(id,role)=>({playerId:id,name:id,position:role,normalizedRole:role,overall:80,category:"Buono"});
const lineup=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"].map((role,i)=>p("u"+i,role));
const opp=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"].map((role,i)=>p("o"+i,role));
const match={period:"first_half",score:{user:1,opponent:0},userSquad:{formationId:"4-3-3",lineup},opponentSquad:{formationId:"4-3-3",lineup:opp},moveUsesByPlayerId:{"user:u8":2},pendingEncounter:{userPlayerId:"u8",opponentPlayerId:"o1",userBaseActionLabel:"Tiro",normalPreviewProbability:62.5,userMove:{name:"Fire Tornado",power:80}}};
const html=view.matchMarkup(match);
assert.match(html,/class="screen rtg-match-shell[^"]*boss-match-screen[^"]*"/);
assert.match(html,/data-rtg-live-field="user"/);
assert.match(html,/data-rtg-live-field="opponent"/);
assert.strictEqual((html.match(/player-card player-card-compact/g)||[]).length,22);
const duel=view.encounterMarkup(match,{userPlayer:lineup[8],opponentPlayer:opp[1]});
assert.match(duel,/rtg-duel-versus-board/);
assert.match(duel,/rtg-duel-visual/);
assert.match(duel,/rtg-duel-story/);
assert.match(duel,/rtg-duel-possession/);
assert.match(duel,/rtg-duel-choice-card/);
console.log("rtg-main-style-match-view-test: PASS");
