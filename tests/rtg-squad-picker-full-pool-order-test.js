"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

function makeHarness(overalls){
  const context={
    globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError,
    SeasonRegistry:{
      database:()=>({teams:[{teamId:"raimon",teamName:"Raimon"}]}),
      team:()=>({teamId:"raimon",teamName:"Raimon"}),
      get:sid=>({name:String(sid)}),
      activeId:()=>"ie1",
      setActive:()=>{},
    },
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8"),context,{filename:"rtg-squad-controller.js"});

  const targetId="ie1::target";
  const candidateIds=overalls.map((_,index)=>`ie1::p${index}`);
  const overallById=new Map(candidateIds.map((cardId,index)=>[cardId,Number(overalls[index])]));
  overallById.set(targetId,99);

  const squad={formationId:"test",lineup:[],bench:[targetId],activeRoleVariantByCardId:{}};
  const campaign={activeSeasonId:"ie1",squads:{ie1:squad}};
  let latestEntries=[];
  let clickSort=null;
  const arrow={textContent:"↓"};
  const sortButton={
    textContent:"",
    attrs:{},
    addEventListener(type,fn){if(type==="click")clickSort=fn;},
    setAttribute(name,value){this.attrs[name]=String(value);},
    querySelector(selector){return selector==="[data-rtg-picker-sort-arrow]"?arrow:null;},
  };
  const resultsNode={innerHTML:""};
  const modal={
    querySelector(selector){
      if(selector==="[data-rtg-picker-sort]")return sortButton;
      if(selector==="[data-rtg-picker-results]")return resultsNode;
      return null;
    },
    querySelectorAll(){return[];},
  };
  const id=value=>String(value??"");
  const cardMeta=cardId=>{
    const raw=id(cardId),parts=raw.split("::");
    return{cardId:raw,playerId:parts[1]||raw,canonicalPlayerId:parts[1]||raw,legacySeasonId:parts[0]||"ie1",sourceKind:"season"};
  };
  const playerFor=cardId=>{
    const meta=cardMeta(cardId),overall=overallById.get(id(cardId))||0;
    return{cardId:id(cardId),playerId:meta.playerId,name:meta.playerId,normalizedRole:"DF",position:"DF",overall,finalOverall:overall,category:"Normale",teamId:"raimon",teamIds:["raimon"],resolvedTeamId:"raimon",teamName:"Raimon"};
  };
  const squadView={
    replacementPickerMarkup:()=>"<picker></picker>",
    replacementPickerResultsMarkup:({entries})=>{latestEntries=entries.map(entry=>entry.player);return"<results></results>";},
    filterOptionsMarkup:()=>"",
  };
  const controller=context.RoadToGlorySquadController.create({
    id,
    clone:value=>JSON.parse(JSON.stringify(value)),
    campaign,
    squadDraft:squad,
    activeSeasonId:()=>"ie1",
    activeSquad:()=>squad,
    accessibleCards:()=>[targetId,...candidateIds],
    config:{SEASON_IDS:["ie1","ie1_s2","ie1_s3","ie2"]},
    cardIdentity:{versionGroupKey:cardId=>`card::${cardId}`},
    cardMeta,
    rawPlayer:playerFor,
    resolved:playerFor,
    rawRole:()=>"DF",
    rawOverall:cardId=>overallById.get(id(cardId))||0,
    rawName:cardId=>cardMeta(cardId).playerId,
    sourceForDraftPlayer:()=>"Svincolato",
    playerResolver:{rarity:()=>"Normale"},
    freeAgentsDb:{players:[]},
    squadView,
    openModal:()=>{},
    getModalRoot:()=>modal,
  });

  const opened=controller.openSquadPlayerPicker(targetId);
  assert.notStrictEqual(opened?.loading,true,"preloaded filter DBs must keep the picker synchronous");
  assert.strictEqual(typeof clickSort,"function","OVR button click listener must be bound");
  return{
    ascending(){
      clickSort({currentTarget:sortButton});
      return latestEntries.map(player=>Number(player.overall));
    },
    arrow:()=>arrow.textContent,
    aria:()=>sortButton.attrs["aria-label"],
  };
}

const few=makeHarness([69,68]);
assert.deepStrictEqual(few.ascending(),[68,69],"ascending OVR must reorder even a two-player result set");
assert.strictEqual(few.arrow(),"↑");
assert.strictEqual(few.aria(),"Ordina per overall crescente");

const manyInput=[...Array.from({length:28},(_,index)=>70+(index%9)),69,68];
const many=makeHarness(manyInput);
const visible=many.ascending();
assert.strictEqual(visible.length,24,"picker pagination must still render only the first page");
assert.deepStrictEqual(visible.slice(0,4),[68,69,70,70],"weakest players must be selected before pagination, not hidden below a page of 70 OVR cards");
for(let index=1;index<visible.length;index++)assert(visible[index-1]<=visible[index],"visible ascending page must be globally sorted");

console.log("RTG squad picker full-pool OVR ordering contract OK");
