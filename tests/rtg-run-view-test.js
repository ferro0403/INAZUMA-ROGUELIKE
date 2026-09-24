"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8"),c);
const nodes=[];const teams=["occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"];
teams.forEach((teamId,i)=>{nodes.push({id:`main:${teamId}`,type:"main",teamId,mainIndex:i,checkpointAfter:[2,5,8].includes(i)});if(i<9)for(let slot=1;slot<=2;slot++)nodes.push({id:`secondary:${teamId}:${teams[i+1]}:${slot}`,type:"secondary",afterTeamId:teamId,beforeTeamId:teams[i+1],slot});});
const playerCardCalls=[];
const view=c.RoadToGloryRunView.create({
  escapeHtml:s=>String(s),
  teamEmblemMarkup:teamId=>`<i data-emblem="${teamId}"></i>`,
  playerCardMarkup:(player,options)=>{playerCardCalls.push({player,options});return `<button type="button" data-rtg-album-player-card><img src="${player.portraitUrl||"fallback"}"></button>`;},
});
assert.match(view.lockedMarkup({count:7}),/Road to Glory/);assert.match(view.lockedMarkup({count:7}),/15 svincolati/);
const state={tokens:600,lives:2,currentNodeId:"secondary:occult:wild:2",furthestNodeIndex:2,defeatedTeamIds:["occult"],attemptsByNode:{"secondary:occult:wild:1":{clears:2}},seasonComplete:false};
const html=view.runMarkup({state,nodes,seasonDb:{teams:teams.map(teamId=>({teamId,name:teamId}))}});
assert.strictEqual((html.match(/data-rtg-tab=/g)||[]).length,2);
assert.match(html,/>Run</);assert.match(html,/>Squadra</);
assert.match(html,/600/);assert.match(html,/2 vite/);
assert.match(html,/rtg-token-icon/);assert.match(html,/zqioogobuek\.png/);assert.doesNotMatch(html,/◈/);
assert.strictEqual((html.match(/data-rtg-node-id=/g)||[]).length,28);
assert.strictEqual((html.match(/class="rtg-map-block /g)||[]).length,4);
for(const team of["brainwashing","farm","zeus"])assert.match(html,new RegExp(`data-rtg-checkpoint="${team}"`));
assert.match(html,/data-emblem="occult"/);
assert.match(html,/rtg-free-agent-mark/);
assert.match(html,/data-rtg-farmable="true"/);
assert.match(html,/data-rtg-state="locked"[^>]*disabled/);
assert.doesNotMatch(html,/>Negozio</);
const completedHtml=view.runMarkup({state:{...state,currentNodeId:"main:raimon",seasonComplete:true},nodes,seasonDb:{teams:teams.map(teamId=>({teamId,name:teamId}))}});
assert.match(completedHtml,/rtg-run-screen--complete/);
assert.match(completedHtml,/rtg-season-complete-footer__badge/);
assert.match(completedHtml,/Continua il viaggio/);
assert.strictEqual((completedHtml.match(/data-rtg-enter-season2/g)||[]).length,2);
const albumHtml=view.albumCollectionMarkup({state:{activeSeasonId:"ie1"},collections:[
  {seasonId:"ie1",unlocked:3,total:10},
  {seasonId:"ie1_s2",unlocked:0,total:230},
]});
assert.match(albumHtml,/ALBUM/);
assert.match(albumHtml,/Inazuma Eleven 1/);
assert.match(albumHtml,/Inazuma Eleven 2/);
assert.strictEqual((albumHtml.match(/data-rtg-album-collection=/g)||[]).length,2);
assert.match(albumHtml,/data-rtg-album-collection="ie1"/);
assert.match(albumHtml,/data-rtg-album-collection="ie1_s2"/);
assert.match(albumHtml,/wallpapers_inazuma11_1_1024x768\.jpg/);
assert.match(albumHtml,/Aliea_Gakuen_captains\.jpg/);
const albumTeamsHtml=view.albumTeamsMarkup({state:{activeSeasonId:"ie1"},teams:[{teamId:"raimon",teamName:"Raimon",logoUrl:"https://assets.test/raimon.png",total:2,unlocked:1}]});
assert.match(albumTeamsHtml,/data-rtg-album-team="raimon"/);
assert.match(albumTeamsHtml,/https:\/\/assets\.test\/raimon\.png/);
const albumDb={seasonId:"ie1_s2"};
const albumRosterHtml=view.albumRosterMarkup({
  team:{teamId:"raimon",teamName:"Raimon"},
  database:albumDb,
  entries:[{cardId:"ie1::mark",name:"Mark",category:"Forte",normalizedRole:"GK",overall:80,portraitUrl:"mark.png"}],
  allEntries:[
    {cardId:"ie1::mark",name:"Mark",category:"Forte",normalizedRole:"GK",overall:80,portraitUrl:"mark.png"},
    {cardId:"ie1::axel",name:"Axel",category:"Elite",normalizedRole:"FW",overall:84,frontFullbodyUrl:"axel.png"},
  ],
});
assert.match(albumRosterHtml,/data-rtg-album-player-entry="ie1::mark"/);
assert.match(albumRosterHtml,/data-rtg-album-player-entry="ie1::axel"/);
assert.match(albumRosterHtml,/data-rtg-album-player-card/);
assert.match(albumRosterHtml,/rarity-forte/);
assert.match(albumRosterHtml,/NON SBLOCCATO/);
assert.strictEqual(playerCardCalls.length,2);
assert.strictEqual(playerCardCalls[0].options.database,albumDb);
assert.strictEqual(playerCardCalls[1].options.resolvedPlayer.cardId,"ie1::axel");
console.log("rtg-run-view-test: PASS");
