"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const engine=fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8");
assert.match(engine,/const possessionBefore=state\.possession/);
assert.match(engine,/if\(!manual&&!goalSide\)state\.possession=possessionBefore/);
assert.match(engine,/possessionBefore,possessionAfter:state\.possession/,"match log must persist the effective possession transition");

const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Date};
c.globalThis=c;
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);
const view=c.RoadToGloryMatchView.create({escapeHtml:s=>String(s)});
const p=(id,role)=>({playerId:id,name:id,position:role,normalizedRole:role,overall:80});
const roles=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"];
const user=roles.map((role,i)=>p("u"+i,role));
const opponent=roles.map((role,i)=>p("o"+i,role));
const base={
  period:"first_half",
  status:"active",
  score:{user:0,opponent:0},
  actionIndex:1,
  actionTarget:22,
  fieldZone:"midfield",
  pendingEncounter:null,
  userSquad:{name:"THOT-TEAM",formationId:"4-3-3",lineup:user,bench:[]},
  opponentSquad:{name:"Occult",formationId:"4-3-3",lineup:opponent,bench:[]},
};
const feed=(event)=>view.matchMarkup({...base,log:[event]});

const autoMid=feed({minute:12,actorSide:"opponent",actorPlayerId:"o5",opponentPlayerId:"u5",kind:"midfield",actorWon:false,manual:false,possessionBefore:"opponent",possessionAfter:"opponent"});
assert.match(autoMid,/possesso resta a Occult/i);
assert.doesNotMatch(autoMid,/conquista il possesso/i);

const autoDribble=feed({minute:18,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:false,possessionBefore:"opponent",possessionAfter:"opponent"});
assert.match(autoDribble,/Possesso invariato per Occult/i);
assert.doesNotMatch(autoDribble,/recupera palla/i);

const autoMoveStop=feed({minute:22,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:false,opponentMove:"The Wall",possessionBefore:"opponent",possessionAfter:"opponent"});
assert.match(autoMoveStop,/The Wall/);
assert.match(autoMoveStop,/possesso resta a Occult/i);
assert.doesNotMatch(autoMoveStop,/recupera palla/i);

const manualMid=feed({minute:27,actorSide:"opponent",actorPlayerId:"o5",opponentPlayerId:"u5",kind:"midfield",actorWon:false,manual:true,possessionBefore:"opponent",possessionAfter:"user"});
assert.match(manualMid,/conquista il possesso/i);

const manualDribble=feed({minute:31,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:true,possessionBefore:"opponent",possessionAfter:"user"});
assert.match(manualDribble,/recupera palla/i);

const snapshotWinsOverManualFlag=feed({minute:35,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:false,possessionBefore:"opponent",possessionAfter:"user"});
assert.match(snapshotWinsOverManualFlag,/recupera palla/i,"feed must trust the real possession transition over the manual flag");

const snapshotNoTurnoverEvenIfManual=feed({minute:38,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:true,possessionBefore:"opponent",possessionAfter:"opponent"});
assert.match(snapshotNoTurnoverEvenIfManual,/Possesso invariato per Occult/i,"feed must not invent a turnover when snapshots say possession stayed");

console.log("rtg-auto-possession-feed-test: PASS");
