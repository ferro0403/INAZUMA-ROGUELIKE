"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const engine=fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8");
const theme=fs.readFileSync("css/rtg-theme.css","utf8");
assert.match(engine,/const possessionBefore=state\.possession/,"secondary encounters must snapshot possession");
assert.match(engine,/if\(!manual&&!goalSide\)state\.possession=possessionBefore/,"automatic secondary actions must restore possession");
assert.match(engine,/17\+global\.RoadToGloryRng\.int\(seed,"manual-target",0,5\)/,"matches should expose a few more manual choices");

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

const automaticMidfieldLoss=feed({minute:12,actorSide:"opponent",actorPlayerId:"o5",opponentPlayerId:"u5",kind:"midfield",actorWon:false,manual:false});
assert.match(automaticMidfieldLoss,/possesso resta a Occult/i);
assert.doesNotMatch(automaticMidfieldLoss,/conquista il possesso/i);

const automaticDribbleLoss=feed({minute:18,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:false});
assert.match(automaticDribbleLoss,/Possesso invariato per Occult/i);
assert.doesNotMatch(automaticDribbleLoss,/recupera palla/i);

const automaticMoveStop=feed({minute:22,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:false,opponentMove:"The Wall"});
assert.match(automaticMoveStop,/The Wall/);
assert.match(automaticMoveStop,/possesso resta a Occult/i);
assert.doesNotMatch(automaticMoveStop,/recupera palla/i);

const manualMidfieldLoss=feed({minute:27,actorSide:"opponent",actorPlayerId:"o5",opponentPlayerId:"u5",kind:"midfield",actorWon:false,manual:true});
assert.match(manualMidfieldLoss,/conquista il possesso/i);

const manualDribbleLoss=feed({minute:31,actorSide:"opponent",actorPlayerId:"o8",opponentPlayerId:"u1",kind:"dribble",actorWon:false,manual:true});
assert.match(manualDribbleLoss,/recupera palla/i);

assert.match(theme,/\.is-auto\.match-event-type--recovery/,"legacy presentation guard remains available");
assert.match(theme,/Possesso invariato/,"legacy presentation guard must stay truthful");
console.log("rtg-secondary-possession-policy-test: PASS");
