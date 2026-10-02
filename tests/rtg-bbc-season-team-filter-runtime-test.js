"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

(async()=>{
  const databases=new Map();
  const source={
    ie1:{seasonId:"ie1",teams:[{teamId:"raimon",teamName:"Raimon"},{teamId:"royal",teamName:"Royal Academy"}],players:[{playerId:"mark",name:"Mark",teamId:"raimon",teamIds:["raimon"],normalizedRole:"GK",overall:80}]},
    ie1_s2:{seasonId:"ie1_s2",teams:[{teamId:"gemini_storm",teamName:"Gemini Storm"},{teamId:"alpine_ie2",teamName:"Alpine"}],players:[{playerId:"janus",name:"Janus",teamId:"gemini_storm",teamIds:["gemini_storm"],normalizedRole:"MF",overall:81}]},
    ie1_s3:{seasonId:"ie1_s3",teams:[{teamId:"fire_dragon",teamName:"Fire Dragon"},{teamId:"orpheus",teamName:"Orpheus"}],players:[{playerId:"torch",name:"Torch",teamId:"fire_dragon",teamIds:["fire_dragon"],normalizedRole:"FW",overall:82}]},
    ie2:{seasonId:"ie2",teams:[{teamId:"polestar_academy",teamName:"Polestar Academy"},{teamId:"lunar_prime_academy",teamName:"Lunar Prime Academy"}],players:[{playerId:"heath",name:"Heath",teamId:"polestar_academy",teamIds:["polestar_academy"],normalizedRole:"DF",overall:83}]},
  };
  let active="ie1";
  const SeasonRegistry={
    activeId:()=>active,
    setActive:(sid)=>{active=String(sid);},
    database:(sid)=>databases.get(String(sid))||null,
    async loadDatabase(sid){databases.set(String(sid),source[String(sid)]);active=String(sid);return source[String(sid)];},
    team:(teamId,sid)=>(databases.get(String(sid))?.teams||[]).find(team=>team.teamId===String(teamId))||null,
    get:(sid)=>({name:String(sid)}),
  };
  const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,SeasonRegistry};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8"),context,{filename:"rtg-squad-view-base.js"});
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8"),context,{filename:"rtg-squad-controller.js"});

  const id=value=>String(value??"");
  const cards=[
    "ie1::mark","ie1_s2::janus","ie1_s3::torch","ie2::heath"
  ];
  const playerFor=(cardId)=>{
    const [sid,pid]=String(cardId).split("::");
    return source[sid].players.find(player=>player.playerId===pid)||null;
  };
  const view=context.RoadToGlorySquadView.create({escapeHtml:id});
  let html="";
  const controller=context.RoadToGlorySquadController.create({
    id,
    clone:value=>JSON.parse(JSON.stringify(value)),
    config:{SEASON_IDS:["ie1","ie1_s2","ie1_s3","ie2"]},
    cardIdentity:{versionGroupKey:cardId=>`card::${cardId}`},
    cardMeta:cardId=>{const [sid,pid]=String(cardId).split("::");return{cardId:String(cardId),playerId:pid,canonicalPlayerId:pid,legacySeasonId:sid,sourceKind:"season"};},
    acquiredCardIdSet:()=>new Set(cards),
    activeSeasonId:()=>"ie1",
    rawPlayer:playerFor,
    resolved:cardId=>{const p=playerFor(cardId);return p?{...p,cardId:String(cardId),resolvedTeamId:p.teamId}:null;},
    rawRole:cardId=>playerFor(cardId)?.normalizedRole||"",
    rawOverall:cardId=>playerFor(cardId)?.overall||0,
    rawName:cardId=>playerFor(cardId)?.name||"",
    sourceForDraftPlayer:()=>"RTG",
    squadDraft:{activeRoleVariantByCardId:{}},
    squadView:view,
    openModal:markup=>{html=String(markup);},
  });

  const result=await controller.openRtgCatalog();
  assert.strictEqual(result.count,4,"Tutte must keep every owned RTG player group");
  assert.strictEqual(active,"ie1","loading filter databases must restore the registry active season");
  for(const label of["Season 1","Season 2","Season 3","Ares"])assert(html.includes(label),`missing season option: ${label}`);
  for(const team of["Raimon","Royal Academy","Gemini Storm","Alpine","Fire Dragon","Orpheus","Polestar Academy","Lunar Prime Academy"]){
    assert(html.includes(team),`Tutte must expose every team, including unowned teams: ${team}`);
  }
  assert((html.match(/data-rtg-catalog-player=/g)||[]).length===4,"all four season cards must resolve after filter hydration");
  console.log("rtg-bbc-season-team-filter-runtime-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
