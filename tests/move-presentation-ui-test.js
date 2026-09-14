"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={console};c.globalThis=c;
c.SeasonRegistry={database:()=>({moveCatalog:{players:{"2":{name:"Fire Tornado",type:"shot",element:"Fire",power:80}}}}),isSeasonSource:(value)=>value==="ie1"};
vm.runInNewContext(fs.readFileSync("js/moves/move-runtime.js","utf8"),c);
vm.runInNewContext(fs.readFileSync("js/moves/move-presentation.js","utf8"),c);
const move=c.MatchMoveRuntime.moveForPlayer("ie1","2");
assert.deepStrictEqual(JSON.parse(JSON.stringify(move)),{playerId:"2",name:"Fire Tornado",type:"shot",element:"Fire",power:80});
const rich=c.MovePresentationRuntime.eventTextMarkup({text:"Axel Blaze tira con Fire Tornado.",moveName:"Fire Tornado",moveElement:"Fire"},(value)=>String(value));
assert.strictEqual(rich,'Axel Blaze tira con <strong class="match-move-name move-element--fire">Fire Tornado</strong>.');
for(const type of ["dribble","recovery","key_pass","build_up"])assert.notStrictEqual(c.MovePresentationRuntime.eventIcon(type),"•");
assert.strictEqual(c.MovePresentationRuntime.typeLabel("shot"),"Tiro");
assert.strictEqual(c.MovePresentationRuntime.typeLabel("save"),"Parata");
const decorated=c.MovePresentationRuntime.decorateEventVisual({playerId:"2",icon:"⚽"},()=>({cardImageUrl:"https://example.com/axel.png",cardFallbacks:["https://example.com/axel.png","fallback.png"]}));
assert.strictEqual(decorated.portraitUrl,"https://example.com/axel.png");
const marker=c.MovePresentationRuntime.eventMarkerMarkup(decorated,(value)=>String(value));
assert(marker.includes("match-event-avatar"));assert(marker.includes("<img"));assert(!marker.includes("⚽"));
const card=c.MovePresentationRuntime.detailMarkup(move,(value)=>String(value));
for(const token of ["player-move-card","Fire Tornado","Fuoco","Tiro","Potenza","80","move-category--shot"])assert(card.includes(token),`move card includes ${token}`);
const vc={console,SeasonRegistry:c.SeasonRegistry,MatchMoveRuntime:c.MatchMoveRuntime,MovePresentationRuntime:c.MovePresentationRuntime};vc.globalThis=vc;
vm.runInNewContext(fs.readFileSync("js/player/player-view.js","utf8"),vc);
const view=vc.PlayerView.create({
  visuals:{resolve:()=>({detailImageUrl:null,detailImageKind:"fullbody",detailFallbacks:[]}),imageFallbackAttributes:()=>"",portraitUrl:()=>""},
  escapeHtml:(value)=>String(value),resolveItem:()=>null,itemIcon:()=>"",
  getProgression:()=>({getPlayerAtLevel:(player)=>({...player,overall:80,potential:80,stats:player.stats,baseStats:player.stats})}),
  applyEquipment:(stats)=>stats,formatLevel:(level)=>String(level),getSeasonId:()=>"ie1",
  sourcePlayer:()=>null,playerTeamIdentity:()=>({}),historicalTeamIdentity:()=>({}),teamLogoMarkup:()=>"",playerStatsMarkup:()=>"",
});
const player={playerId:"2",name:"Axel Blaze",position:"FW",element:"Fuoco",category:"Elite",finalOverall:80,stats:{attack:80,control:80,speed:80,grit:80,physical:80,stamina:80,defense:20,save:10}};
const html=view.detailMarkup(player,{playerId:"2",level:20,database:{}});
assert(html.includes("player-detail-move"));assert(html.indexOf("player-detail-move")<html.indexOf("player-detail-equipment"));assert(html.includes("Fire Tornado"));
const css=fs.readFileSync("css/move-presentation.css","utf8");
for(const token of [".move-element--fire",".move-element--wind",".move-element--mountain",".move-element--forest","move-category--save","move-category--defense","move-category--dribble","move-category--shot","match-event-avatar"])assert(css.includes(token),`move css includes ${token}`);
assert(!css.includes(".player-move-card{--move-accent:#4e535c"),"element accent must not be overridden by the gray fallback");
const controller=fs.readFileSync("js/match/match-controller.js","utf8");
assert(controller.includes("playerId: ev.playerId != null ? String(ev.playerId) : null"));
assert(controller.includes("decorateEventVisual?.(event, resolvePlayerVisual)"));
assert(!controller.includes("portraitFallbacks: visual.cardFallbacks"),"portrait URLs/fallbacks must not be persisted in the match log");
const app=fs.readFileSync("js/app.js","utf8");
assert((app.match(/resolvePlayerVisual:/g)||[]).length>=2,"visual resolver is wired to match presentation and controller");
console.log("move presentation UI: element card colors, Nintendo category colors, timeline portraits and player detail move card OK");
