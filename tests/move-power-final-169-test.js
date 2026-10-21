"use strict";
const assert=require("assert");
const fs=require("fs");
const target=JSON.parse(fs.readFileSync("data/RTG_move_power_targets_169.json","utf8"));
const files=["IE1_moves","IE1_S2_moves","IE1_S3_moves","IE2_moves","ORION_moves"];
const catalog=files.map(s=>JSON.parse(fs.readFileSync("data/"+s+".json","utf8")));
const values=target.powerByName;
assert.strictEqual(target.schemaVersion,1);
assert.strictEqual(target.maxPower,110);
assert.strictEqual(Object.keys(values).length,169);
assert(Object.values(values).every(x=>Number.isInteger(x)&&x>0&&x<=110));
const present=new Set();
for(const source of catalog)for(const group of[source.players||{},source.inheritedPlayers||{}]){
  for(const player of Object.values(group)){
    for(const move of[player,...Object.values(player.roleMoves||{})]){
      if(!move||!move.name||!Object.hasOwn(values,move.name))continue;
      present.add(move.name);
      assert.strictEqual(move.power,values[move.name],source.seasonId+" "+move.name);
    }
  }
}
const pending=Object.keys(values).filter(n=>!present.has(n)).sort((a,b)=>a.localeCompare(b));
assert.strictEqual(present.size,125);
assert.strictEqual(pending.length,44);
assert.deepStrictEqual(pending,target.pendingNames);
assert.strictEqual(values["Containment Field"],100);
assert.strictEqual(values["Inazuma Break"],100);
assert.strictEqual(values["The Earth"],110);
assert.strictEqual(values["High Voltage"],110);
assert.strictEqual(values["Beast Fang"],90);
assert.strictEqual(values["Killer Blade"],70);
assert.strictEqual(values["Cosmic Blaster"],110);
console.log("169 Power targets: 125 active catalog moves + 44 reserved, max 110, PASS");
