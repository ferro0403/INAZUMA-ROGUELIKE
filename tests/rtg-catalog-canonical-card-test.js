"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
c.RoadToGlorySquadView=Object.freeze({create(){return Object.freeze({
  catalogResultsMarkup(){return '<div><button class="CANONICAL squad-player-card rtg-squad-player-card rtg-prematch-player-card rtg-picker-player-card rtg-catalog-player-card" data-rtg-catalog-player="p1">Player One</button></div>';},
  catalogMarkup(){return '<section><button class="CANONICAL squad-player-card rtg-squad-player-card rtg-prematch-player-card rtg-picker-player-card rtg-catalog-player-card" data-rtg-catalog-player="p1">Player One</button></section>';}
});}});
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view-catalog-canonical.js","utf8"),c);
const view=c.RoadToGlorySquadView.create({});
for(const catalog of [view.catalogResultsMarkup({}),view.catalogMarkup({})]){
  assert.match(catalog,/CANONICAL/);
  assert.match(catalog,/squad-player-card/);
  assert.match(catalog,/rtg-squad-player-card/);
  assert.match(catalog,/data-rtg-catalog-player="p1"/);
  assert.doesNotMatch(catalog,/rtg-prematch-player-card|rtg-picker-player-card|rtg-catalog-player-card/);
}
const loader=fs.readFileSync("js/road-to-glory/rtg-squad-view.js","utf8");
assert.match(loader,/rtg-squad-view-catalog-canonical\.js/);
console.log("rtg-catalog-canonical-card-test: PASS");
