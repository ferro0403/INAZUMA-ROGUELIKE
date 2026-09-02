'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('js/home/home-controller.js','utf8');
const c={globalThis:null,console};c.globalThis=c;vm.createContext(c);vm.runInContext(source,c);
async function test(active,loaded,identity,expected){let id=active;const calls=[];c.TeamEmblems={parseTeamEmblemId:value=>{const m=/^team:([^:]+):/.exec(value||'');return m&&{seasonId:m[1]}}};c.SeasonRegistry={activeId:()=>id,setActive:value=>{id=value},isSeasonSource:()=>true,database:value=>loaded.includes(value)?{}:null,loadDatabase:async value=>{calls.push(value);id=value}};const controller=c.HomeController.create({});await controller.ensureHomeTeamEmblemSeasonLoaded(identity);assert.deepEqual(calls,expected);assert.equal(id,active)}
(async()=>{await test('ie1_s3',['ie1_s3'],{emblemId:'team:ie1:raimon'},['ie1']);await test('ie1',['ie1'],{emblemId:'team:ie1:raimon'},[]);await test('ie1',['ie1'],null,[]);assert.match(source,/await ensureHomeTeamEmblemSeasonLoaded/);console.log('home-team-emblem-preload-test: ok')})().catch(e=>{console.error(e);process.exit(1)});
