"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const context={JSON,Math,Array,Object,String,Number,Map,Set,Promise,Error,TypeError};
context.globalThis=context;
context.RoadToGloryRng={int:()=>0};
vm.createContext(context);
for(const path of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-coaches.js",
 "js/road-to-glory/rtg-squad-auto-adapt.js","js/road-to-glory/rtg-route-view.js"])
 vm.runInContext(read(path),context,{filename:path});
const C=context.RoadToGloryConfig,coaches=context.RoadToGloryCoaches;
const adapted=context.RoadToGlorySquadAutoAdapt;
test("Rene Gadé is unlocked permanently after replaying completed Orion",()=>{
 const old={campaignId:"rtg-ares-orion",activeSeasonId:"orion",seasonComplete:true,
  seasonTransitionRewardedIds:["ie2->orion"],coachOwnedIds:[],tokens:900};
 assert.equal(coaches.status(old,"4761"),"available");
 const replay={...old,activeSeasonId:"ie2",seasonComplete:false,
  seasonTransitionRewardedIds:["ie2->orion","completion:orion"]};
 assert.equal(coaches.status(replay,"4761"),"available");
 assert.equal(coaches.eligible(replay).some(c=>c.id==="4761"),true);
 const pulled=coaches.draw(replay,{int:(_seed,_stream,_count,length)=>length-1});
 assert.equal(pulled.coach.id,"4761");
 assert.equal(pulled.state.coachOwnedIds.includes("4761"),true);
 assert.equal(coaches.status(pulled.state,"4761"),"owned");
 assert.equal(coaches.status({campaignId:"rtg-ares-orion",activeSeasonId:"ie2",seasonComplete:false,
  seasonTransitionRewardedIds:[],coachOwnedIds:[]},"4761"),"locked");
});
test("All completed Season maps keep their friendlies playable for farming",()=>{
 const view=context.RoadToGloryRouteView.create({escapeHtml:x=>String(x),header:()=>"",tabs:()=>"",
  seasonNumber:s=>C.season(s)?.seasonNumber||1,teamEmblemMarkup:()=>""});
 for(const sid of C.SEASON_IDS){
  const cfg=C.season(sid),nodes=C.buildSeasonNodes(sid),state={
   activeSeasonId:sid,seasonComplete:true,defeatedTeamIds:cfg.mainTeams,
   currentNodeId:nodes.at(-1).id,attemptsByNode:{},tokens:250};
  const html=view.runMarkup({state,nodes,seasonConfig:cfg,seasonDb:{teams:[],bossOrder:[]}});
  const lastFriendly=nodes.filter(n=>n.type==="secondary").at(-1);
  assert(lastFriendly,"all seasons must have a friendly before their final");
  assert(html.includes('data-rtg-node-id="'+lastFriendly.id+'"'));
  assert(html.includes('data-rtg-farmable="true"'));
  assert(html.includes("RIGIOCA"));
 }
 const controller=read("js/road-to-glory/rtg-controller.js");
 assert.match(controller,/campaign\.seasonComplete\|\|Number\(campaign\.attemptsByNode/);
 assert.match(controller,/current\.seasonComplete\|\|Number\(current\.attemptsByNode/);
});
function form(name,roles){return{id:name,slotRoles:roles,
 requirements:roles.reduce((acc,r)=>(acc[r]=(acc[r]||0)+1,acc),{})};}
const formation=form("4-4-2",["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"]);
const alternate=form("3-5-2",["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"]);
const entry=(id,role,ovr,recruit=false,recent=false)=>({playerId:id,role,
 contribution:ovr,overall:ovr,recruit,recent});
function verify({cap,minRecruit=0,recentCount=0,forced=""}={}){
 return squad=>{
  const cards=[...squad.lineup,...squad.bench],lookup=new Map(verify.currentPool.map(e=>[e.playerId,e]));
  const participants=cards.map(k=>lookup.get(k));
  const total=participants.reduce((n,e)=>n+e.contribution,0);
  const checked=participants.length===15&&cards.length===new Set(cards).size
   &&participants.filter(e=>e.recruit).length>=minRecruit
   &&participants.filter(e=>e.recent).length>=recentCount
   &&total/15<=cap+1e-8
   &&lookup.get(squad.lineup[0]).role==="GK"
   &&(!forced||squad.bench.includes(forced));
  return{eligible:checked,teamPower:Math.round(total/15*10)/10,cap};
 };
}
test("Auto-adapt can put a FW in midfield or defense if no natural MF/DF exists",()=>{
 const pool=[entry("keeper","GK",75),...Array.from({length:20},(_,i)=>entry("fw"+i,"FW",72+i%6))];
 verify.currentPool=pool;
 const plan=adapted.plan({pool,formations:[formation],constraint:{cap:77,minRecruit:0,recentCount:0},
  originalSquad:{lineup:[],bench:[],formationId:"4-4-2"},
  evaluate:verify({cap:77})});
 assert(plan?.eligibility?.eligible);
 assert.equal(plan.squad.lineup.length,11);
 assert.equal(plan.squad.bench.length,4);
 assert.equal(plan.squad.lineup[0],"keeper");
 assert(plan.squad.lineup.slice(1,9).every(k=>k.startsWith("fw")));
 assert.equal(new Set([...plan.squad.lineup,...plan.squad.bench]).size,15);
});
test("Auto-adapt meets both Season recruits and recent count, keeping Travis protected reserve",()=>{
 const pool=[
  entry("goalie","GK",76),
  entry("travis","FW",98,false,false),
  ...Array.from({length:8},(_,i)=>entry("recent"+i,i%2?"DF":"FW",75,true,true)),
  ...Array.from({length:6},(_,i)=>entry("season"+i,"MF",75,true,false)),
  ...Array.from({length:12},(_,i)=>entry("veteran"+i,"FW",73,false,false)),
 ];
 const capped=pool.map(x=>x.playerId==="travis"?{...x,contribution:60}:x);
 verify.currentPool=capped;
 const validator=verify({cap:76,minRecruit:8,recentCount:4,forced:"travis"});
 const plan=adapted.plan({pool:capped,formations:[formation,alternate],
  constraint:{cap:76,minRecruit:8,recentCount:4},fixedBenchId:"travis",
  originalSquad:{lineup:[],bench:["travis"],formationId:"4-4-2"},
  evaluate:validator});
 assert(plan?.eligibility?.eligible);
 assert(plan.squad.bench.includes("travis"));
 assert.equal(plan.squad.lineup[0],"goalie");
 assert(plan.squad.lineup.filter(x=>x==="travis").length===0);
 assert(plan.eligibility.teamPower<=76);
});
test("Auto-adapt never fabricates accessible cards or bypasses an impossible cap",()=>{
 const pool=[entry("keeper","GK",93),...Array.from({length:20},(_,i)=>entry("high"+i,"FW",95))];
 verify.currentPool=pool;
 assert.equal(adapted.plan({pool,formations:[formation],constraint:{cap:75,minRecruit:0,recentCount:0},
  originalSquad:{lineup:[],bench:[]},evaluate:verify({cap:75})}),null);
});
