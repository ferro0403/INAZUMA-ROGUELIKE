"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);
const view=c.RoadToGloryMatchView.create({escapeHtml:s=>String(s)});
const p=(id,name,role)=>({playerId:id,name,position:role,normalizedRole:role,overall:80});
const shooter=p("s1","Axel","FW"),keeper=p("g1","Mark","GK");
const match={shootout:{history:[
 {attackingSide:"user",outcome:"goal"},{attackingSide:"opponent",outcome:"save"},
 {attackingSide:"user",outcome:"save"},{attackingSide:"opponent",outcome:"goal"}
],score:{user:1,opponent:1},kicks:{user:2,opponent:2},status:"regulation-pens"}};
const html=view.penaltyMarkup(match,{attackingSide:"user",shooter,keeper,userRole:"shot",userMove:{name:"Fire Tornado",power:80},userMoveAvailable:true,userMoveUses:1});
assert.match(html,/Axel/);assert.match(html,/Mark/);
assert.match(html,/1 - 1/);
assert.match(html,/Fire Tornado/);
assert.match(html,/1\/2/);
assert.match(html,/data-rtg-penalty-direction="left"/);
assert.match(html,/rtg-penalty-history/);
assert.match(html,/GOAL|PARATA/);
const result=view.resolvedEncounterMarkup({userWon:false,probability:41.2,userPlayerName:"Chauncey Slim",aiPlayerName:"Shadow",userChoiceLabel:"Difesa",aiChoiceLabel:"Shadow Stitch",userUsedMove:true,userMovePower:80});
assert.match(result,/Chauncey Slim/);assert.match(result,/Shadow/);assert.doesNotMatch(result,/Shadow Stitch/);assert.match(result,/data-rtg-duel-continue/);
const source=fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8");assert.doesNotMatch(source,/GOL CONVALIDATO/);console.log("rtg-gameplay-clarity-view-test: PASS");