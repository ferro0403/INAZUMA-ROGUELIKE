"use strict";
// Keep EVERY Vento-Fuoco move's displayed Power and RTG PT cost aligned
// with the user's approved 169-value table and the canonical RTG catalog.
// Non-cataloged moves retain their event-authored values (never guess).
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),"utf8"));
const approved=read("data/RTG_move_power_targets_169.json").powerByName;
const catalogPaths=[
  "data/IE1_moves.json","data/IE1_S2_moves.json","data/IE1_S3_moves.json",
  "data/IE2_moves.json","data/ORION_moves.json"
];
const canonical=new Map();
for(const filename of catalogPaths){
  const db=read(filename);
  for(const player of [...Object.values(db.players||{}),...Object.values(db.inheritedPlayers||{})]){
    for(const m of [player,...Object.values(player.roleMoves||{})]){
      if(!m?.name||!Number.isInteger(m.power)||m.power<=0)continue;
      if(!canonical.has(m.name))canonical.set(m.name,new Set());
      canonical.get(m.name).add(m.power);
    }
  }
}
const eventFiles=[
  "data/events/vento_fuoco/fire-team-moves.json",
  "data/events/vento_fuoco/blizzard-team-moves.json",
  "data/events/vento_fuoco/miximax-fire-moves.json",
  "data/events/vento_fuoco/miximax-wind-moves.json"
];
const all=new Map();
let total=0,fromApproved=0,fromCanonical=0,unlisted=0;
for(const filename of eventFiles){
  const db=read(filename);
  const ids=Object.keys(db.players||{});
  assert.equal(ids.length,filename.includes("miximax")?2:19,filename);
  for(const [playerId,record] of Object.entries(db.players)){
    assert.equal(record.moves.length,4,filename+" "+playerId);
    for(const move of record.moves){
      total++;
      assert.ok(move.moveId&&move.jpName&&move.name,filename+" "+playerId+" missing move metadata");
      assert.ok(["shot","save","defense","dribble"].includes(move.type),move.name+" type");
      assert.ok(Number.isInteger(move.power)&&move.power>=1&&move.power<=110,
        filename+" "+playerId+" "+move.name+" must have a nonzero Power");
      assert.ok(Number.isFinite(move.tension)&&move.tension>0,
        filename+" "+playerId+" "+move.name+" must not have a missing tension");
      all.set(move.name,(all.get(move.name)||0)+1);
      if(Object.hasOwn(approved,move.name)){
        assert.equal(move.power,approved[move.name],filename+" "+playerId+" "+move.name+" approved Power");
        fromApproved++;
      }else{
        const values=canonical.get(move.name);
        if(values?.size===1){
          assert.equal(move.power,[...values][0],filename+" "+playerId+" "+move.name+" canonical Power");
          fromCanonical++;
        }else{
          // Event-only technique: preserve its supplied nonzero Power.
          unlisted++;
        }
      }
    }
  }
}
const move=(filename,playerId,name)=>read("data/events/vento_fuoco/"+filename).players[playerId].moves.find(m=>m.name===name);
assert.equal(move("blizzard-team-moves.json","4538","Land of Ice").power,85);
assert.equal(move("blizzard-team-moves.json","1156","Land of Ice").power,85);
assert.equal(move("miximax-wind-moves.json","9900002","Land of Ice").power,85);
assert.equal(move("miximax-wind-moves.json","9900002","Triple Blizzard").power,105);
assert.equal(move("miximax-wind-moves.json","9900001","Icebreaker").power,105);
assert.equal(move("miximax-wind-moves.json","9900002","Triple Blizzard").tension,100);
assert.equal(move("miximax-wind-moves.json","9900001","Icebreaker").tension,100);
assert.equal(move("miximax-fire-moves.json","9900002","Cross Fire").power,105);
assert.equal(move("fire-team-moves.json","1105","Fire Blizzard").power,90);
const playerView=fs.readFileSync(path.join(root,"js/player/player-view.js"),"utf8");
assert.match(playerView,/const cost = Number\.isFinite\(power\) && power > 0 && power <= 110 \? Math\.round\(power\) : null/,
  "RTG sheet PT cost must use final event Power, never legacy tension");
assert.equal(total,168);
assert.equal(all.size,101);
assert.ok(fromApproved>0&&fromCanonical>0&&unlisted>0);
console.log("Vento-Fuoco Power parity PASS:",total,"moves,",
  fromApproved,"approved,",fromCanonical,"catalogued,",unlisted,"event-only; PT=Power");
