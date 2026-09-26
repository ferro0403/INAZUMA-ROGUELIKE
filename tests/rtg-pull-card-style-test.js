"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
let opts=null,emblemTeam=null;
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8"),c);
const view=c.RoadToGloryRunView.create({
  escapeHtml:s=>String(s),
  teamEmblemMarkup:teamId=>{emblemTeam=teamId;return `<img data-team-logo="${teamId}">`;},
  compactPlayerCardMarkup:(player,o)=>{opts=o;return `<button class="${o.extraClass||""}">${player.name}</button>`;}
});
const html=view.pullResultMarkup(
  {rarity:"Forte",duplicate:false,balanceAfter:70},
  {playerId:"p1",name:"Johan",finalOverall:81,category:"Forte",normalizedRole:"MF",teamId:"brainwashing",teamName:"Brainwashing"}
);
assert(opts);
assert.match(opts.extraClass,/squad-player-card/);
assert.match(opts.extraClass,/rtg-picker-squad-card/);
assert.match(opts.extraClass,/rtg-pull-player-card/);
assert.doesNotMatch(opts.extraClass,/rtg-penalty-player-card/);
assert.strictEqual(opts.detailLayout,undefined);
assert.strictEqual(opts.trailingMarkup,"");
assert.match(opts.dataAttr,/data-rtg-pull-player-detail="p1"/);
assert.match(opts.dataAttr,/aria-label="Apri scheda di Johan"/);
assert.strictEqual(opts.overall,81);
assert.strictEqual(emblemTeam,"brainwashing");
view.pullResultMarkup(
  {rarity:"Elite",duplicate:false,balanceAfter:70},
  {playerId:"23",name:"Peter Drent",finalOverall:88,category:"Elite",normalizedRole:"DF",teamId:"royal-academy",teamIds:["royal"],teamName:"Royal Academy"}
);
assert.strictEqual(emblemTeam,"royal");
const s2Html=view.pullResultMarkup(
  {rarity:"Elite",duplicate:false,balanceAfter:70},
  {playerId:"s2",name:"S2 Player",finalOverall:80,category:"Elite",normalizedRole:"MF",teamId:"gemini_storm",teamName:"Gemini Storm"},
  {teams:[{teamId:"gemini_storm",teamName:"Gemini Storm",logoUrl:"https://assets.test/gemini.png"}]}
);
assert.match(s2Html,/https:\/\/assets\.test\/gemini\.png/);
assert.match(html,/development-squad-card-scope/);
assert.match(html,/rtg-pull-result--forte/);
assert.match(html,/rtg-pull-card-stage rtg-picker-grid/);
assert.match(html,/data-team-logo="brainwashing"/);
assert.match(html,/Brainwashing/);
assert.match(html,/rtg-pull-role">MF</);
assert.match(html,/NUOVO GIOCATORE/);
assert.match(html,/data-rtg-pull-continue/);
assert.match(html,/>CONTINUA<\/button>/);
assert.doesNotMatch(html,/>SBLOCCATO</);
assert.doesNotMatch(html,/Sbloccato e aggiunto alla collezione Road to Glory/);
console.log("rtg-pull-card-style-test: PASS");
