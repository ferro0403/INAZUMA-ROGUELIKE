"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");

const c={console};
c.globalThis=c;
vm.createContext(c);
for(const path of [
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-squad-runtime.js",
  "js/road-to-glory/rtg-opponent-generator.js"
])vm.runInContext(fs.readFileSync(path,"utf8"),c,{filename:path});

const db=JSON.parse(fs.readFileSync("data/FREE_AGENTS_compact.json","utf8"));
const byId=new Map(db.players.map(player=>[String(player.playerId),player]));
const resolver={
  resolveAtLevel20:ref=>{
    const player=byId.get(String(ref));
    return player?{...player,overall:Number(player.finalOverall),level:20}:null;
  },
  resolveMove:()=>null,
};
const json=x=>JSON.parse(JSON.stringify(x));
const roles=ids=>ids.map(key=>byId.get(String(key))?.normalizedRole);
for(const sid of c.RoadToGloryConfig.SEASON_IDS){
  test("RTG "+sid+": every real Free Agent match can start (including unreachable late bands)",()=>{
    const season=c.RoadToGloryConfig.season(sid);
    const secondary=c.RoadToGloryConfig.buildSeasonNodes(sid).filter(node=>node.type==="secondary");
    assert(secondary.length>0);
    let unreachable=0;
    for(const node of secondary){
      const input={
        seed:"rtg-regression-real-fa:"+sid+":"+node.id,
        attemptNumber:1,freeAgentsDb:db,formations:season.formations,
        targetMin:node.opponentTargetMin,targetMax:node.opponentTargetMax,
        playerResolver:resolver,seasonId:sid,
      };
      const opponent=c.RoadToGloryOpponentGenerator.generate(input);
      assert(opponent,"Missing opponent for "+node.id);
      assert.equal(opponent.playerIds.length,11,node.id);
      assert.equal(new Set(opponent.playerIds).size,11,node.id);
      assert(Number.isFinite(opponent.teamPower),node.id);
      assert(opponent.teamPower>0,node.id);
      const formation=season.formations.find(item=>item.id===opponent.formationId);
      assert(formation,node.id);
      const assigned=roles(opponent.playerIds);
      assert.deepEqual(json(assigned),Array.from(formation.slotRoles),node.id+" incompatible slot roles");
      if(opponent.teamPower<node.opponentTargetMin||opponent.teamPower>node.opponentTargetMax){
        unreachable++;
        assert(opponent.teamPower<node.opponentTargetMin,
          "All known high-band fallbacks should remain below the requested band: "+node.id);
        const duplicate=c.RoadToGloryOpponentGenerator.generate(input);
        assert.deepEqual(json(duplicate),json(opponent),
          node.id+" must be fully deterministic across reload/retry");
      }
    }
    if(sid==="orion")assert(unreachable>0,"The real Orion high-power ceiling must be covered");
  });
}
