"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const orion=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8"));
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),c);
const actual=Array.from(c.RoadToGloryConfig.SEASON1.formations||[]).map(f=>({
  id:String(f.id),
  requirements:{...f.requirements},
  slotRoles:Array.from(f.slotRoles||[]),
  displayRows:f.displayRows?Array.from(f.displayRows).map(r=>({...r})):undefined
}));
const expected=Array.from(orion.formations?.eleven||orion.formations||[]).map(f=>({
  id:String(f.id),
  requirements:{...f.requirements},
  slotRoles:Array.from(f.slotRoles||[]),
  displayRows:f.displayRows?Array.from(f.displayRows).map(r=>({...r})):undefined
}));
assert.deepStrictEqual(actual,expected);
assert.strictEqual(actual.length,12);
console.log("rtg-orion-formation-catalog-test: PASS");
