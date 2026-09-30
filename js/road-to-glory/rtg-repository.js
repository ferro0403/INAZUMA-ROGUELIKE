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

    async function sharedFor(state){
      let shared=await storage.read(SHARED_KEY);
      if(!shared){
        const legacy=await storage.read("state");
        const source=legacy&&typeof legacy==="object"?legacy:state;
        shared={
          tokens:Math.max(0,Number(source?.tokens||0)),
          gachaAcquiredCards:Array.isArray(source?.gachaAcquiredCards)?stateApi.clone(source.gachaAcquiredCards):[],
        };
        await storage.write(shared,SHARED_KEY);
      }
      return shared;
    }
    function applyShared(state,shared){
      if(!state)return state;
      state.tokens=Math.max(0,Number(shared?.tokens||0));
      state.gachaAcquiredCards=Array.isArray(shared?.gachaAcquiredCards)?stateApi.clone(shared.gachaAcquiredCards):[];
      return stateApi.validate(state);
    }
    async function persistShared(state){
      await storage.write({
        tokens:Math.max(0,Number(state?.tokens||0)),
        gachaAcquiredCards:Array.isArray(state?.gachaAcquiredCards)?stateApi.clone(state.gachaAcquiredCards):[],
      },SHARED_KEY);
    }

    async function read() {
      const raw = await storage.read(campaignKey());
      if(raw==null)return null;
      const state=stateApi.validate(raw);
      return applyShared(state,await sharedFor(state));
    }

    async function ensureCampaign() {
      let result=await storage.update((currentRaw) => {
        if (currentRaw != null) {
          const current = stateApi.validate(currentRaw);
          const match = current.activeMatch;
          const matchEngine = global.RoadToGloryMatchEngine;
          if (match && match.status === "active" && match.presentation?.preMatchSeen !== false && !match.pendingEncounter && typeof matchEngine?.prepareNext === "function") {
            current.activeMatch = matchEngine.prepareNext(stateApi.clone(match));
          }
          return stateApi.validate(current);
        }
        return stateApi.validate(stateApi.createInitial({ campaignSeed: seedFactory(), campaignId:selectedCampaignId }));
      },campaignKey());
      result=applyShared(result,await sharedFor(result));
      await storage.write(result,campaignKey());
      return result;
    }

    async function update(label, updater) {
      if (typeof updater !== "function") throw new TypeError("RTG updater required");
      const shared=await sharedFor(null);
      const result=await storage.update((currentRaw) => {
        let current = currentRaw == null
          ? stateApi.createInitial({ campaignSeed: seedFactory(), campaignId:selectedCampaignId })
          : stateApi.validate(currentRaw);
        current=applyShared(current,shared);
        const next = updater(stateApi.clone(current));
        if (next && typeof next.then === "function") {
          throw Object.assign(new Error("Async RTG updater not supported"), { code: "rtg-async-updater-not-supported", label });
        }
        return stateApi.validate(next == null ? current : next);
      },campaignKey());
      await persistShared(result);
      return result;
    }

    return Object.freeze({ read, ensureCampaign, update, selectCampaign, activeCampaignId });
  }

  global.RoadToGloryRepository = Object.freeze({ create });
})(globalThis);
