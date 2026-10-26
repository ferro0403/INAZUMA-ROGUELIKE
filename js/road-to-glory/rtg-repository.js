(function (global) {
  "use strict";

  function create({ storage, stateApi = global.RoadToGloryState, seedFactory } = {}) {
    if (!storage) throw new TypeError("RTG storage required");
    if (!stateApi) throw new TypeError("RTG state API required");
    if (typeof seedFactory !== "function") throw new TypeError("RTG seed factory required");

    const TRILOGY_ID="rtg-ie-trilogy";
    const ARES_ORION_ID="rtg-ares-orion";
    const SHARED_KEY="shared:account";
    let selectedCampaignId=TRILOGY_ID;
    const normalizeCampaignId=value=>value===ARES_ORION_ID?ARES_ORION_ID:TRILOGY_ID;
    const campaignKey=()=>selectedCampaignId===TRILOGY_ID?"state":`state:${selectedCampaignId}`;

    function selectCampaign(campaignId){
      selectedCampaignId=normalizeCampaignId(campaignId);
      return selectedCampaignId;
    }
    function activeCampaignId(){return selectedCampaignId;}

    function normalizeDevelopmentRecord(record){
      if(!record||typeof record!=="object"||Array.isArray(record))return null;
      const targetPotential=Number(record.targetPotential);
      const evolutionCount=Number(record.evolutionCount);
      const rarity=String(record.currentRarity||"");
      const rarities=Array.from(stateApi.DEVELOPMENT_RARITIES||["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
      if(!Number.isInteger(targetPotential)||targetPotential<1||targetPotential>99||!rarities.includes(rarity))return null;
      return{
        targetPotential,
        currentRarity:rarity,
        evolutionCount:Number.isInteger(evolutionCount)&&evolutionCount>=0?evolutionCount:0,
        updatedAt:record.updatedAt?String(record.updatedAt):null,
      };
    }
    function developmentRecordWins(candidate,current){
      if(!current)return true;
      const rarities=Array.from(stateApi.DEVELOPMENT_RARITIES||["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
      const candidateRank=rarities.indexOf(candidate.currentRarity);
      const currentRank=rarities.indexOf(current.currentRarity);
      if(candidateRank!==currentRank)return candidateRank>currentRank;
      if(candidate.targetPotential!==current.targetPotential)return candidate.targetPotential>current.targetPotential;
      if(candidate.evolutionCount!==current.evolutionCount)return candidate.evolutionCount>current.evolutionCount;
      return String(candidate.updatedAt||"")>String(current.updatedAt||"");
    }
    function mergeDevelopmentMaps(...sources){
      const merged={};
      for(const source of sources){
        if(!source||typeof source!=="object"||Array.isArray(source))continue;
        for(const [cardId,rawRecord] of Object.entries(source)){
          const key=String(cardId||"");
          const record=normalizeDevelopmentRecord(rawRecord);
          if(!key||!record)continue;
          if(developmentRecordWins(record,merged[key]))merged[key]=record;
        }
      }
      return merged;
    }

    // A non-destructive union of every previously acquired coach. Legacy saves
    // retain their lists in each campaign; reads never migrate or erase them.
    const mergeCoaches=(...lists)=>Array.from(new Set(lists.flatMap(ids=>Array.isArray(ids)?ids:[])
      .map(String).filter(id=>!!global.RoadToGloryCoaches?.BY_ID?.[id])));
    const squadsKey=campaignId=>`local:squads:${campaignId}`;
    const allKeys=()=>["state",`state:${ARES_ORION_ID}`,SHARED_KEY,squadsKey(TRILOGY_ID),squadsKey(ARES_ORION_ID)];

    function validate(raw){
      const result=stateApi.validate(raw);
      if(raw?.localSquadsPreserved===true){
        result.squads=stateApi.clone(raw.squads);
        result.localSquadsPreserved=true;
      }
      return result;
    }
    function initialCampaign(records,campaignId){
      const state=stateApi.createInitial({campaignSeed:seedFactory(),campaignId});
      const squads=records[squadsKey(campaignId)];
      if(squads!=null){state.squads=stateApi.clone(squads);state.localSquadsPreserved=true;}
      return validate(state);
    }

    // Derive legacy account ownership in memory. A read never migrates or
    // writes any IndexedDB record (important during cloud restore/recovery).
    function sharedForRecords(records,state){
      let shared=records[SHARED_KEY];
      const legacyShared=!shared||!Object.prototype.hasOwnProperty.call(shared,"developmentByCardId");
      const trilogy=records.state;
      const aresOrion=records[`state:${ARES_ORION_ID}`];
      if(!shared){
        const source=trilogy&&typeof trilogy==="object"?trilogy:state;
        shared={
          tokens:Math.max(0,Number(source?.tokens||0)),
          gachaAcquiredCards:Array.isArray(source?.gachaAcquiredCards)?stateApi.clone(source.gachaAcquiredCards):[],
        };
      }
      if(legacyShared){
        shared={
          ...shared,
          developmentByCardId:mergeDevelopmentMaps(
            trilogy?.developmentByCardId,
            aresOrion?.developmentByCardId,
            state?.developmentByCardId
          ),
        };
      }
      return {
        ...shared,
        coachOwnedIds:mergeCoaches(shared.coachOwnedIds,trilogy?.coachOwnedIds,aresOrion?.coachOwnedIds,state?.coachOwnedIds),
      };
    }
    function applyShared(state,shared){
      if(!state)return state;
      state.tokens=Math.max(0,Number(shared?.tokens||0));
      state.gachaAcquiredCards=Array.isArray(shared?.gachaAcquiredCards)?stateApi.clone(shared.gachaAcquiredCards):[];
      state.developmentByCardId=mergeDevelopmentMaps(shared?.developmentByCardId);
      state.coachOwnedIds=mergeCoaches(shared?.coachOwnedIds,state.coachOwnedIds);
      return validate(state);
    }
    function sharedRecord(state,shared){
      return {
        tokens:Math.max(0,Number(state?.tokens||0)),
        gachaAcquiredCards:Array.isArray(state?.gachaAcquiredCards)?stateApi.clone(state.gachaAcquiredCards):[],
        developmentByCardId:mergeDevelopmentMaps(state?.developmentByCardId),
        coachOwnedIds:mergeCoaches(shared.coachOwnedIds,state?.coachOwnedIds),
      };
    }

    async function read() {
      const key=campaignKey();
      const records=await storage.readMany(allKeys());
      const raw=records[key];
      if(raw==null)return null;
      const state=validate(raw);
      return applyShared(state,sharedForRecords(records,state));
    }

    async function ensureCampaign(options = {}) {
      const campaignId=selectedCampaignId;
      const key=campaignKey();
      return storage.updateMany(allKeys(),records=>{
        const currentRaw=records[key];
        let current=currentRaw!=null
          ? validate(currentRaw)
          : initialCampaign(records,campaignId);
        const shared=sharedForRecords(records,current);
        current=applyShared(current,shared);
        const match=current.activeMatch;
        const matchEngine=global.RoadToGloryMatchEngine;
        if(currentRaw!=null&&match&&match.status==="active"&&match.presentation?.preMatchSeen!==false&&!match.pendingEncounter&&typeof matchEngine?.prepareNext==="function"){
          current.activeMatch=matchEngine.prepareNext(stateApi.clone(match));
        }
        const result=validate(current);
        return {writes:{[key]:result,[SHARED_KEY]:sharedRecord(result,shared)},value:result};
      },options);
    }

    async function update(label,updater,options = {}) {
      const campaignId=selectedCampaignId;
      if(typeof updater!=="function")throw new TypeError("RTG updater required");
      const key=campaignKey();
      return storage.updateMany(allKeys(),records=>{
        const currentRaw=records[key];
        let current=currentRaw==null
          ? initialCampaign(records,campaignId)
          : validate(currentRaw);
        const shared=sharedForRecords(records,null);
        current=applyShared(current,shared);
        const next=updater(stateApi.clone(current));
        if(next&&typeof next.then==="function"){
          throw Object.assign(new Error("Async RTG updater not supported"),{code:"rtg-async-updater-not-supported",label});
        }
        const result=validate(next==null?current:next);
        return {writes:{[key]:result,[SHARED_KEY]:sharedRecord(result,shared)},value:result};
      },options);
    }

    return Object.freeze({ read, ensureCampaign, update, selectCampaign, activeCampaignId });
  }

  global.RoadToGloryRepository = Object.freeze({ create });
})(globalThis);
