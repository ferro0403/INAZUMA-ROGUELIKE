"use strict";
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const values=new Map(),writes=[];
const legacy={'1':{formationId:'4-4-2',lineup:['ie1::a'],bench:['ie1::b'],coachId:'36',activeRoleVariantByCardId:{'ie1::a':'FW'}},'2':{formationId:'4-3-3'},'3':{formationId:'4-5-1'}};
values.set('inazuma.rtg.squad-slots.v1',JSON.stringify(legacy));
const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push(key);values.set(key,String(value));}};
const context={localStorage};vm.createContext(context);
vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-squad-slot-runtime.js','utf8'),context);
let season='ie1';
const slots=context.RoadToGlorySquadSlotRuntime.create({localStorage,id:String,clone:value=>JSON.parse(JSON.stringify(value)),activeSeasonId:()=>season});
// The superseded source assertion required a setItem inside readSquadSlots.
// Reads now preserve the legacy content in RAM and cannot mutate during restore.
assert.deepStrictEqual(JSON.parse(JSON.stringify(slots.readSquadSlots())),legacy);
assert.deepStrictEqual(writes,[]);assert.equal(values.has('inazuma.rtg.squad-slots.v2.ie1'),false);
season='ie1_s2';assert.deepStrictEqual(JSON.parse(JSON.stringify(slots.readSquadSlots())),{});
assert.deepStrictEqual(writes,[],'S2 never inherits or migrates the unsuffixed S1 key');
season='ie1';slots.storeSquadSlot(2,{formationId:'4-2-3-1'});
assert.deepStrictEqual(writes,['inazuma.rtg.squad-slots.v2.ie1'],'only the next explicit write persists the migration');
assert.deepStrictEqual(JSON.parse(values.get('inazuma.rtg.squad-slots.v2.ie1')),{
  '1':legacy['1'],'2':{formationId:'4-2-3-1'},'3':legacy['3']
});
assert.deepStrictEqual(JSON.parse(values.get('inazuma.rtg.squad-slots.v1')),legacy,'legacy source remains intact');
console.log('rtg-squad-slot-v1-migration-test: PASS (read-only legacy S1 bridge, no S2 inheritance, explicit next-write persistence)');
