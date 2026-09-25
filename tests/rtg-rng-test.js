"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const c = { globalThis:null, Math, String, Number, Object, Array };
c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-rng.js","utf8"), c);

const a = c.RoadToGloryRng.float("campaign-A","gacha",0);
const b = c.RoadToGloryRng.float("campaign-A","gacha",0);
const other = c.RoadToGloryRng.float("campaign-A","gacha",1);
assert.strictEqual(a,b);
assert.notStrictEqual(a,other);
assert(a >= 0 && a < 1);

const picked = c.RoadToGloryRng.weightedPick(
  [{id:"a",w:40},{id:"b",w:60}],
  x => x.w,
  0.41
);
assert.strictEqual(picked.id,"b");
assert.strictEqual(c.RoadToGloryRng.weightedPick([{id:"x",w:0}], x=>x.w, 0.5), null);
assert.strictEqual(c.RoadToGloryRng.int("campaign-A","int",0,10) >= 0, true);
assert.strictEqual(c.RoadToGloryRng.int("campaign-A","int",0,10) < 10, true);
console.log("rtg-rng-test: PASS");
