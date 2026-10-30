"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const runtimeCode=fs.readFileSync("js/road-to-glory/rtg-four-moves-runtime.js","utf8");
const context={console, Uint8Array, atob, Blob, Response, DecompressionStream};
context.globalThis=context;
vm.runInNewContext(runtimeCode,context);
(async()=>{
  const runtime=context.RtgFourMovesRuntime;
  assert.equal(await runtime.ready,true,"static four-move data must decode");
  assert.equal(runtime.ptMax({stamina:70,grit:70,control:70,physical:70}),206);
  assert.equal(runtime.ptMax({stamina:100,grit:100,control:100,physical:100}),260);
  assert.equal(runtime.ptMax({stamina:0,grit:0,control:0,physical:0}),120);
  const rarityBonuses={Scarso:0,Debole:2,Normale:4,Buono:6,Forte:8,Elite:10,Mondiale:12,Leggenda:15,Aurico:20};
  for (const [rarity, bonus] of Object.entries(rarityBonuses)) {
    assert.equal(runtime.ptBonusForRarity(rarity),bonus,'rarity '+rarity);
    assert.equal(runtime.ptBreakdown({stamina:100,grit:100,control:100,physical:100},rarity).total,260+bonus);
  }
  assert.equal(runtime.ptBonusForRarity('non-valid'),0,'unknown rarity has no bonus');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.ptBreakdown({stamina:70,grit:70,control:70,physical:70},'Leggenda'))),{base:206,bonus:15,total:221});
  assert.equal(runtime.ptBreakdown({stamina:100,grit:100,control:100,physical:100},'Aurico').total,280,'rarity exceeds base cap');
  // A rarity upgrade adds only the delta; the stat-driven PT base must not change.
  assert.equal(runtime.ptBreakdown({stamina:70,grit:70,control:70,physical:70},'Aurico').total
    - runtime.ptBreakdown({stamina:70,grit:70,control:70,physical:70},'Leggenda').total,5);
  const bySeason={ie1:157,ie1_s2:203,ie1_s3:296,ie2:156,orion:180};
  for (const [season,expected] of Object.entries(bySeason)) {
    // Inspect encoded data independently to validate completeness.
    const zlib=require('node:zlib');
    const encoded=runtimeCode.match(/const PACKED = "([A-Za-z0-9+/=]+)";/)?.[1];
    const data=JSON.parse(zlib.inflateSync(Buffer.from(encoded,'base64')));
    assert.equal(Object.keys(data.s[season]).length,expected,season+' canonical source players');
    for (const [id,list] of Object.entries(data.s[season])) {
      assert(list.length>=1&&list.length<=4,season+' '+id+' slot bound');
      const moves=runtime.movesFor(season,id);
      assert.equal(moves.length,list.length);
      for (const move of moves) {
        if(move.ptCost!==null) assert.equal(move.ptCost,move.power);
        assert(!Number.isInteger(move.power)||move.power<=110);
      }
    }
  }
  assert.deepEqual(Array.from(runtime.movesFor('ie1','1'),m=>m.name),["God Hand","Fireball Knuckle","Majin the Hand","Triple Defence"]);
  assert.equal(runtime.movesFor('orion','4539').find(m=>m.name==='Icebreaker')?.ptCost,105);
  assert.equal(runtime.movesFor('orion','4538').find(m=>m.name==='Triple Blizzard')?.ptCost,105);
  assert.equal(runtime.movesFor('orion','4417').find(m=>m.name==='Beyond the Death Zone')?.ptCost,105);
  assert.equal(runtime.movesFor('orion','4390')[0].element,"Void");
  assert.equal(runtime.movesFor('orion','4390')[0].power,110);
  assert.equal(runtime.movesFor('orion','4410').find(m=>m.name==="Containment Field")?.power,100);
  assert.equal(runtime.movesFor('ie1_s2','1').find(m=>m.name==="The Earth")?.power,110);
  // Orion recruits inherit their four source moves from Ares; IE3 inherits IE2/IE1.
  assert.deepEqual(Array.from(runtime.movesFor('orion','4400'),m=>m.name),Array.from(runtime.movesFor('ie2','4400'),m=>m.name));
  // Characterization: S1/S2 source JSONs provide distinct techniques for every player.
  // Never add the primary technique twice when regenerating the compressed catalog.
  const fullCatalog = JSON.parse(require('node:zlib').inflateSync(Buffer.from(
    runtimeCode.match(/const PACKED = "([A-Za-z0-9+/=]+)";/)[1], 'base64'
  )));
  for (const season of ["ie1", "ie1_s2"]) {
    const source = fullCatalog.s[season];
    for (const [id, indices] of Object.entries(source)) {
      const names = indices.map(index => fullCatalog.d[index][0]);
      assert.equal(new Set(names).size, names.length, season + " " + id + " must not repeat techniques");
    }
  }
  const correctedExamples = {
    ie1: {
      9: ["Cyclone", "Shooting Star", "Rolling Kick", "Revolution V"],
      14: ["Spectacle Crash", "Divine Arrows", "Optimal Trajectory", "Future Eye"],
      28: ["Death Zone", "Wrath Shot", "Emperor Penguin No. 2", "Killer Slide"]
    },
    ie1_s2: {
      176: ["Gigant Wall", "Tsunami Wall", "Colosseum Guard", "Sumo Stomp"],
      1059: ["Black Hole", "Wormhole", "Drill Smasher", "Earthquake"]
    }
  };
  for (const [season, entries] of Object.entries(correctedExamples)) {
    for (const [id, expected] of Object.entries(entries)) {
      assert.deepEqual(Array.from(runtime.movesFor(season, id), m => m.name), expected, season + " " + id + " original order");
    }
  }
  // Ares source review (2026-10-30): restore 12 verified moves for four
  // players. Orion shares Ares moves only where no Orion-specific list exists.
  const repairedAres = {
    "4408": ["Flame Dance", "Divine Dummy", "Illusory Ball", "Frosticle"],
    "4425": ["Lunar Eclipse", "Grabber Arm", "Shot Pocket", "Shadow Catch"],
    "4442": ["Toughness Block", "Burnout", "Power Shield", "Infinite Wall"],
    "4446": ["The Wall", "Stone Wall", "Mega Quake", "Super Armadillo"]
  };
  for (const [id, names] of Object.entries(repairedAres)) {
    assert.deepEqual(Array.from(runtime.movesFor("ie2", id), m => m.name), names,
      "Ares original techniques restored for " + id);
  }
  for (const id of ["4408", "4442", "4446"]) {
    assert.deepEqual(Array.from(runtime.movesFor("orion", id), m => m.name),
      Array.from(runtime.movesFor("ie2", id), m => m.name),
      "Orion inherits repaired Ares techniques for " + id);
  }
  assert.deepEqual(Array.from(runtime.movesFor("ie2", "4425"), m => m.name),
    repairedAres["4425"], "Ares-only goalkeeper must have four moves");
  assert.equal(runtime.movesFor("ie2", "4425")[1].ptCost, 100,
    "Restored Grabber Arm retains its verified power");
  const remainingAres = {
    "4395": 2, "4409": 3, "4418": 3, "4426": 3, "4430": 3,
    "4448": 3, "4502": 3, "4524": 3, "4559": 3
  };
  const actualRemainingAres = Object.fromEntries(
    Object.entries(fullCatalog.s.ie2).filter(([, list]) => list.length !== 4)
      .map(([id, list]) => [id, list.length])
  );
  assert.deepEqual(actualRemainingAres, remainingAres,
    "Only explicitly incomplete Ares source records remain incomplete");
  for (const [id, indices] of Object.entries(fullCatalog.s.ie2)) {
    const names = indices.map(index => fullCatalog.d[index][0]);
    assert.equal(new Set(names).size, names.length,
      "Ares source must not repeat techniques for " + id);
  }
  const aresRoster=JSON.parse(fs.readFileSync("data/IE2_season_compact.json","utf8")).players;
  const absentAres=aresRoster.filter(p => !Object.hasOwn(fullCatalog.s.ie2,String(p.playerId)))
    .map(p => String(p.playerId));
  assert.deepEqual(absentAres, ["4441"],
    "Curt Gale is still absent in the provided Ares source; do not invent techniques");
  const orionRoster=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8")).players;
  const orionIncomplete=orionRoster.filter(p => runtime.movesFor("orion",p.playerId).length < 4);
  assert.equal(orionIncomplete.length,11,
    "Orion should inherit the three repaired Ares players, keeping its own unique lists");
  // Player details are opt-in: all classic / historical views still use a single move.
  vm.runInNewContext(fs.readFileSync('js/moves/move-presentation.js','utf8'),context);
  context.MatchMoveRuntime={moveForPlayer:()=>({name:'God Hand',type:'save',element:'Mountain',power:65})};
  context.SeasonRegistry={isSeasonSource:()=>true};
  vm.runInNewContext(fs.readFileSync('js/player/player-view.js','utf8'),context);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const view=context.PlayerView.create({
    visuals:{resolve:()=>({detailImageUrl:null})},escapeHtml:esc,
    getProgression:()=>({getPlayerAtLevel:p=>p}),getSeasonId:()=>"ie1",
    sourcePlayer:()=>null,playerTeamIdentity:()=>({name:""}),historicalTeamIdentity:()=>({name:""}),
    teamLogoMarkup:()=>"",playerStatsMarkup:()=>"",resolveItem:()=>null,itemIcon:()=>"",
    applyEquipment:stats=>stats,formatLevel:()=>"20",
  });
  const p={playerId:'1',name:'Mark Evans',stats:{stamina:70,grit:70,control:70,physical:70},baseStats:{stamina:70,grit:70,control:70,physical:70},position:'GK',category:'Leggenda',element:'Mountain',overall:90,potential:92};
  const rtg=view.detailMarkup(p,{playerId:'1',rtgFourMoves:true,moveSeasonId:'ie1'});
  assert.equal((rtg.match(/class="player-move-card /g)||[]).length,4,"RTG shows all four full-size cards");
  assert.match(rtg,/221\s*<small>PT<\/small>/);
  assert.match(rtg,/PT base<\/span><strong>206 PT<\/strong>/);
  assert.match(rtg,/Bonus rarità · Leggenda<\/span><strong>\+15 PT<\/strong>/);
  const evolved=view.detailMarkup(p,{playerId:'1',rtgFourMoves:true,moveSeasonId:'ie1',rtgRarity:'Aurico'});
  assert.match(evolved,/226\s*<small>PT<\/small>/);
  assert.match(evolved,/Bonus rarità · Aurico<\/span><strong>\+20 PT<\/strong>/);
  assert.match(evolved,/<small>Rarità<\/small><strong>Aurico<\/strong>/);
  assert.equal((rtg.match(/class="rtg-pt-cost"/g)||[]).length,4);
  const classic=view.detailMarkup(p,{playerId:'1',moveSeasonId:'ie1'});
  assert.equal((classic.match(/class="player-move-card /g)||[]).length,1,"classic keeps one move");
  assert.doesNotMatch(classic,/rtg-pt-panel|rtg-four-moves-stack/);
  console.log('RTG four moves + personal PT (display-only): PASS');
})().catch(error=>{console.error(error);process.exitCode=1});