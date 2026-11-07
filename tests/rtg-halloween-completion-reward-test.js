const { withLiteralTokens } = require("./helpers/css-tokens");
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const { loadEvents } = require("./helpers/events");

const targets=JSON.parse(fs.readFileSync("data/RTG_move_power_targets_169.json","utf8")).powerByName;
const context={RoadToGloryCardIdentity:{
  record:({playerId,legacySeasonId})=>({
    playerId,legacySeasonId,cardId:legacySeasonId+"::"+playerId,profileId:undefined,sourceKind:"season"
  })
}};
let open=true;
context.RoadToGloryHalloween={isOpen:()=>open};
// Il premio finale arriva dal file dell'evento (data/events/halloween2026.json), come nel gioco.
vm.createContext(context);
loadEvents(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-halloween-completion-reward.js","utf8"),context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-cloud-snapshot.js","utf8"),context);
const api=context.RoadToGloryHalloweenCompletion;
const player=api.player();
assert.equal(player.playerId,"custom_0003");
assert.equal(player.cardId,"halloween2026::custom_0003");
assert.equal(player.teamId,"occult-2");
assert.equal(player.overall,97);
assert.equal(player.category,"Leggenda");
assert.equal(player.halloweenMoves.length,4);
const mutable=api.player();
mutable.stats.attack=1;
mutable.halloweenMoves[0].power=1;
assert.equal(api.player().stats.attack,100,"Coach snapshots must not mutate canonical stats");
assert.equal(api.player().halloweenMoves[0].power,85,"Coach snapshots must not mutate canonical moves");
assert.equal(player.portraitUrl,"assets/rtg/halloween-shawn-portrait.webp");
assert.equal(player.frontFullbodyUrl,"assets/rtg/halloween-shawn-fullbody.webp");
assert.equal(player.fullbodyUrl,player.frontFullbodyUrl);
assert.equal(player.roleVariants[0].frontFullbodyUrl,player.frontFullbodyUrl);
assert.equal(player.roleVariants[0].portraitUrl,player.portraitUrl);
assert.notEqual(player.portraitUrl,player.frontFullbodyUrl,"Portrait and user fullbody MUST be distinct");
const renderBytes=fs.readFileSync(player.frontFullbodyUrl);
assert.equal(renderBytes.subarray(0,4).toString(),"RIFF");
assert.equal(renderBytes.subarray(8,12).toString(),"WEBP");
assert.equal(renderBytes.subarray(12,16).toString(),"VP8X");
const webpWidth=1+renderBytes.readUIntLE(24,3);
const webpHeight=1+renderBytes.readUIntLE(27,3);
assert.equal(webpWidth,1097,"Use original user fullbody dimensions");
assert.equal(webpHeight,1434,"Use original user fullbody dimensions");
assert.ok((renderBytes[20]&0x10)!==0,"The fullbody image must retain an alpha channel");
const referenceRule=withLiteralTokens(fs.readFileSync("css/rtg-halloween-event.css","utf8"));
assert.match(referenceRule,/img\.player-fullbody--fullbody\[src\$="halloween-shawn-fullbody\.webp"\]/);
assert.match(referenceRule,/height:69%!important;/,"Shawn must share Nathan and Samford fullbody geometry");

assert.equal(player.halloweenMoves.find(m=>m.name==="Land of Ice").power,targets["Land of Ice"]);
assert.equal(player.halloweenMoves.find(m=>m.name==="Land of Ice").ptCost,85);
assert.equal(player.halloweenMoves.find(m=>m.name==="Legendary Wolf").power,targets["Legendary Wolf"]);
assert.equal(player.halloweenMoves.find(m=>m.name==="Werewolf Howl").power,100);
assert.equal(player.halloweenMoves.find(m=>m.name==="Frosticle").power,60);
assert.equal(fs.readFileSync(player.portraitUrl).subarray(0,4).toString(),"RIFF");
const originals=JSON.parse(fs.readFileSync("data/rtg-halloween-occult-players.json","utf8"))[0].players;
assert.equal(originals.length,18);
assert.ok(!originals.some(p=>p.playerId==="custom_0003"),"Bonus absent from vending");
const originalMap=new Map(originals.map(p=>[String(p.playerId),p]));
function legacyAccount(){return{
  tokens:0,
  halloween:{pumpkins:0,ownedIds:originals.map(p=>String(p.playerId)),pullCount:18,completedIds:[],luckyWins:0},
  coachOwnedIds:["halloween-coach-54"],
  gachaAcquiredCards:originals.map(p=>({cardId:"halloween2026::"+p.playerId,playerId:String(p.playerId)})),
  developmentByCardId:{}
};}
const account=legacyAccount();
assert.equal(api.eligible(account,originalMap),true,"Existing completed account eligible");
assert.equal(api.grant(account,originalMap),true);
assert.equal(api.owns(account),true);
assert.equal(account.gachaAcquiredCards.length,19);
assert.equal(Object.hasOwn(account.gachaAcquiredCards[18],"profileId"),false,"Canonical card must not persist undefined metadata");
assert.equal(account.halloween.ownedIds.length,18,"Cloud's strict Halloween count unchanged");
assert.equal(api.grant(account,originalMap),false,"Retry must not duplicate");
assert.equal(account.gachaAcquiredCards.length,19);
const cloud=context.RoadToGloryCloudSnapshot.project({shared:account,trilogy:null,aresOrion:null,album:null});
assert.equal(cloud.shared.gachaAcquiredCards.length,19);
assert.equal(cloud.shared.halloween.ownedIds.length,18);
const restored=context.RoadToGloryCloudSnapshot.validate(cloud);
assert.equal(api.owns(restored.shared),true,"Cloud restore retains bonus");
assert.equal(api.grant(restored.shared,originalMap),false,"Cloud restore must not duplicate");
const missingCoach=legacyAccount();missingCoach.coachOwnedIds=[];
assert.equal(api.grant(missingCoach,originalMap),false);
const missingPlayer=legacyAccount();missingPlayer.halloween.ownedIds.pop();
assert.equal(api.grant(missingPlayer,originalMap),false);
const incompleteLedger=legacyAccount();incompleteLedger.gachaAcquiredCards.pop();
assert.equal(api.grant(incompleteLedger,originalMap),false);
open=false;
const expired=legacyAccount();
assert.equal(api.grant(expired,originalMap),false,"No new rewards after Nov 6 deadline");
assert.equal(api.owns(expired),false);
assert.equal(api.owns(account),true,"Existing reward stays available after deadline");
open=true;
const failedCommit=legacyAccount();
const before=JSON.stringify(failedCommit);
const draft=JSON.parse(before);
assert.equal(api.grant(draft,originalMap),true);
assert.equal(JSON.stringify(failedCommit),before,"Discarding an uncommitted draft leaves the account unchanged");
const css=withLiteralTokens(fs.readFileSync("css/rtg-halloween-event.css","utf8"));
const event=fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8");
const html=fs.readFileSync("index.html","utf8");
assert.match(css,/\.player-card\.halloween-event-card/);
assert.match(event,/grantCompletionReward/);
assert.match(event,/returnToEventHome/);
assert.match(event,/eventAlbumTeams/);
assert.match(html,/rtg-halloween-completion-reward\.js/);
console.log("Halloween secret reward: ownership, 18+coach gate, moves, asset, cloud, expiry, retry PASS");
