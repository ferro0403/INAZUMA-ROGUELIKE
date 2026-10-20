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
  assert.equal(runtime.ptMax({stamina:70,grit:70,control:70,physical:70}),185);
  assert.equal(runtime.ptMax({stamina:100,grit:100,control:100,physical:100}),230);
  assert.equal(runtime.ptMax({stamina:0,grit:0,control:0,physical:0}),120);
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
  assert.match(rtg,/185\s*<small>PT<\/small>/);
  assert.equal((rtg.match(/class="rtg-pt-cost"/g)||[]).length,4);
  const classic=view.detailMarkup(p,{playerId:'1',moveSeasonId:'ie1'});
  assert.equal((classic.match(/class="player-move-card /g)||[]).length,1,"classic keeps one move");
  assert.doesNotMatch(classic,/rtg-pt-panel|rtg-four-moves-stack/);
  console.log('RTG four moves + personal PT (display-only): PASS');
})().catch(error=>{console.error(error);process.exitCode=1});