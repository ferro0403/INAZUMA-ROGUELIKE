"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};context.globalThis=context;vm.createContext(context);
for(const file of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-run-view.js"])vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
const C=context.RoadToGloryConfig,V=context.RoadToGloryRunView.create({escapeHtml:String,teamEmblemMarkup:id=>`<i>${id}</i>`});
assert.strictEqual(C.SEASON1.routeBackground,"assets/rtg/rtg-season1-route-map-v3.jpg");assert(C.SEASON1.albumCover.includes("wallpapers_inazuma11_1_1024x768"));assert(C.SEASON2.albumCover.includes("Aliea_Gakuen_captains"));
assert.strictEqual(C.SEASON2.routeBackground,"assets/rtg/rtg-season2-route-map-user.webp?v=20260924-s2-map-hq-1");
assert.strictEqual(C.SEASON3.routeBackground,"assets/rtg/rtg-season3-route-map-user.webp");
assert(C.SEASON3.albumCover.includes("Inazuma-boys-inazuma-eleven-35597232-1600-1200"));assert.notStrictEqual(C.SEASON3.albumCover,C.SEASON3.routeBackground);
function route(seasonId){const cfg=C.season(seasonId),nodes=Array.from(C.buildSeasonNodes(seasonId));return V.runMarkup({state:{activeSeasonId:seasonId,currentNodeId:nodes[0].id,tokens:1000,lives:2,attemptsByNode:{},defeatedTeamIds:[]},nodes,seasonDb:{teams:[]},seasonConfig:cfg});}
const s2=route("ie1_s2"),s3=route("ie1_s3");assert(s2.includes("--rtg-route-image:url('/assets/rtg/rtg-season2-route-map-user.webp?v=20260924-s2-map-hq-1')"));assert(s3.includes("--rtg-route-image:url('/assets/rtg/rtg-season3-route-map-user.webp')"));
assert(s3.match(/main:big_waves[^>]+data-rtg-state="reachable"/));assert(s3.match(/main:neo_national[^>]+data-rtg-state="locked"/));
const album=V.albumCollectionMarkup({collections:[{seasonId:"ie1_s3",unlocked:1,total:10}]});assert(album.includes(C.SEASON3.albumCover));assert(!album.includes(C.SEASON3.routeBackground));
const candidates=[{cardId:"x",category:"Normale"}],rarities=[{rarity:"Normale",weight:100}];
const team=V.vendingMarkup({seasonId:"ie1_s3",mode:"team",cost:300,tokens:300,candidates,rarities});assert(team.includes('data-rtg-vending-mode="team" class="active" aria-pressed="true"'));assert(team.includes("GIRA · 300"));assert(team.includes("<strong>300</strong>"));
const recruitment=V.vendingMarkup({seasonId:"ie1_s3",mode:"recruitment",cost:150,tokens:150,candidates,rarities});assert(recruitment.includes('data-rtg-vending-mode="recruitment" class="active" aria-pressed="true"'));assert(recruitment.includes("GIRA · 150"));assert(recruitment.includes("<strong>150</strong>"));
const controller=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");assert(controller.includes('openVending(toggle.dataset.rtgVendingMode)'));assert(controller.includes('gacha.previewPool(campaign,seasonDb,accessibleCards(campaign),selectedMode)'));
const css=fs.readFileSync("css/rtg-theme.css","utf8");assert(css.includes('background:#ffd21f!important'));assert(css.includes('.rtg-vending-stage>.rtg-vending-pull{margin-top:18px!important;}'));
console.log("RTG Season 3 preview visual regression tests passed");
