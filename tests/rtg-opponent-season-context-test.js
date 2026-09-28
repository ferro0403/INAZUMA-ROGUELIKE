"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const seen=[];const context={globalThis:null,RoadToGloryRng:{float:()=>0,int:()=>0},RoadToGlorySquadRuntime:{teamPower:squad=>{seen.push(squad.activeSeasonId);return 80;}}};context.globalThis=context;
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-opponent-generator.js","utf8"),context);
const players=[];for(const [role,count] of [["GK",1],["DF",4],["MF",3],["FW",3]])for(let i=0;i<count;i++)players.push({playerId:`${role}${i}`,normalizedRole:role,overall:80});
const args={seed:"x",freeAgentsDb:{players},formations:[{id:"f",slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]}],targetMin:80,targetMax:80,playerResolver:{}};
context.RoadToGloryOpponentGenerator.generate({...args,seasonId:"ie1"});context.RoadToGloryOpponentGenerator.generate({...args,seasonId:"ie1_s2"});context.RoadToGloryOpponentGenerator.generate({...args,seasonId:"ie1_s3"});
assert.deepStrictEqual(seen,["ie1","ie1_s2","ie1_s3"]);console.log("RTG opponent season context tests passed");
