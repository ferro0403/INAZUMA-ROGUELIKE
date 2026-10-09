"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,console,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};
context.globalThis=context;vm.createContext(context);
for(const file of ["js/road-to-glory/rtg-album-controller.js","js/road-to-glory/rtg-vending-controller.js"]){
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
async function main(){
  const gate=deferred(),events=[],listeners={};
  const store=new Map(),localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))};
  const db={teams:[{teamId:"boss",name:"Boss",playerIds:["p"]}],profiles:[],requiresProfileAwareRuntime:false};
  context.SeasonRegistry={activeId:()=>"ie1",database:()=>db,setActive:()=>{}};
  const page={html:"ROUTE"};
  const element=(key,dataset={})=>({dataset,addEventListener:(name,fn)=>{if(name==="click")listeners[key]=fn;}});
  const app={
    querySelector(selector){
      if(selector===".rtg-album-collections-screen")return page.html.startsWith("COLLECTIONS")?{}:null;
      if(selector==="[data-rtg-home]"&&page.html.startsWith("COLLECTIONS"))return element("rootBack");
      if(selector==="[data-rtg-album-collection-back]"&&page.html.startsWith("TEAMS"))return element("collectionsBack");
      if(selector==="[data-rtg-album-back]"&&page.html.startsWith("ROSTER"))return element("rosterBack");
      if(selector==="[data-rtg-album-roster]")return {addEventListener:()=>{}};
      return null;
    },
    querySelectorAll(selector){
      if(selector==="[data-rtg-album-collection]"&&page.html.startsWith("COLLECTIONS")){
        return ["ie1","orion"].map(sid=>element("collection:"+sid,{rtgAlbumCollection:sid}));
      }
      if(selector==="[data-rtg-album-team]"&&page.html.startsWith("TEAMS")){
        return [element("team:boss",{rtgAlbumTeam:"boss"})];
      }
      return [];
    }
  };
  const view={
    albumCollectionMarkup:({collections})=>"COLLECTIONS "+JSON.stringify(collections),
    albumTeamsMarkup:({seasonId})=>"TEAMS "+seasonId,
    albumRosterMarkup:({seasonId})=>"ROSTER "+seasonId
  };
  let homeCount=0;
  const returnedModes=[];
  const album=context.RoadToGloryAlbumController.create({
    app,localStorage,id:String,cardMeta:ref=>({cardId:String(ref)}),
    acquiredCardIdSet:()=>new Set(),getCampaign:()=>({activeSeasonId:"orion"}),
    getSeasonDb:()=>db,getFreeAgentsDb:()=>({players:[]}),activeSeasonId:()=>"orion",
    config:{SEASON_IDS:["ie1","orion"],SEASON1:{mainTeams:["boss"]},season:()=>({mainTeams:["boss"]})},
    cardIdentity:{cardIdForSeason:(playerId,sid)=>sid+"::"+playerId},
    playerResolver:{resolveAtLevel20:cardId=>({cardId,playerId:cardId})},
    ensureSeason1Db:()=>Promise.resolve(db),ensureData:()=>gate.promise,
    renderHtml:(markup,options={})=>{page.html=markup;events.push("render:"+markup.split(" ")[0]+(options.preserveScroll?":preserve":""));},
    runView:view,mountDevQuickTools:()=>{},renderHome:()=>{homeCount++;page.html="HOME";},
    returnToVending:mode=>{returnedModes.push(mode);page.html="VENDING "+mode;},
    openPlayerDetails:()=>{}
  });
  const first=album.renderAlbum({source:"vending",mode:"recruitment"});
  assert(page.html.startsWith("COLLECTIONS"),"Album shell must paint synchronously while Season data is pending");
  assert(page.html.includes('"pending":true'),"cold collection list should show a loading state");
  assert.strictEqual(homeCount,0);
  listeners.rootBack();
  assert.strictEqual(page.html,"VENDING recruitment");
  gate.resolve();
  await first;
  assert.strictEqual(page.html,"VENDING recruitment","slow async results must not overwrite the returned vending machine");
  assert.deepStrictEqual(returnedModes,["recruitment"]);
  assert.strictEqual(homeCount,0);
  await album.renderAlbum({source:"vending",mode:"team"});
  assert(page.html.includes('"total":1'),"loaded collection counts should be available");
  await listeners["collection:orion"]();
  assert.strictEqual(page.html,"TEAMS orion");
  await listeners["team:boss"]();
  assert.strictEqual(page.html,"ROSTER orion");
  await listeners.rosterBack();
  assert.strictEqual(page.html,"TEAMS orion");
  await listeners.collectionsBack();
  assert(page.html.startsWith("COLLECTIONS"));
  listeners.rootBack();
  assert.deepStrictEqual(returnedModes,["recruitment","team"],"nested Album back must retain the originating vending mode");
  await album.renderAlbum();
  listeners.rootBack();
  assert.strictEqual(homeCount,1,"normal Album entry must return Home, not vending");
  assert.strictEqual(page.html,"HOME");
  const vendingAlbumButton={onclick:null};
  const vendingEvents=[];
  let capturedOrigin=null;
  const modalRoot={
    querySelector:selector=>selector==="[data-rtg-vending-album]"?vendingAlbumButton:null,
    querySelectorAll:()=>[]
  };
  const vending=context.RoadToGloryVendingController.create({
    getCampaign:()=>({tokens:900}),getSeasonDb:()=>db,activeSeasonId:()=>"orion",
    activeConfig:()=>({pullCost:300,recruitmentPullCost:150}),
    gacha:{previewPool:()=>({rarities:[],candidates:[]})},accessibleCards:()=>[],
    runView:{vendingMarkup:()=>"<main>distributore</main>"},
    openModal:()=>vendingEvents.push("opened"),getModalRoot:()=>modalRoot,
    closeModal:opts=>{assert.strictEqual(opts.invokeOnClose,false);vendingEvents.push("closed");},
    renderAlbum:origin=>{capturedOrigin=origin;vendingEvents.push("album");return Promise.resolve();}
  });
  vending.openVending("recruitment");
  await vendingAlbumButton.onclick({preventDefault(){},stopPropagation(){}});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(capturedOrigin)),{source:"vending",mode:"recruitment"});
  assert.deepStrictEqual(vendingEvents,["opened","closed","album"],"modal closes and Album mounts in the same click");
  assert.strictEqual(store.has("inazuma.rtg.album.v1"),false,"navigation and empty Album reads must not write permanent data");
  console.log("rtg-vending-album-navigation-test: immediate shell, stale loads, nested back, origin, mode, and storage PASS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
