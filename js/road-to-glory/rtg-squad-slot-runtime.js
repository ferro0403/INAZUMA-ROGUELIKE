(function (global) {
  "use strict";

  const RTG_SQUAD_SLOTS_KEY="inazuma.rtg.squad-slots.v2";
  const RTG_LEGACY_SQUAD_SLOTS_KEY="inazuma.rtg.squad-slots.v1";
  const RTG_ACTIVE_SQUAD_SLOT_KEY="inazuma.rtg.active-squad-slot.v1";
  function create(deps={}){
    function squadSlotsKey(seasonId=deps.activeSeasonId()){return `${RTG_SQUAD_SLOTS_KEY}.${deps.id(seasonId||"ie1")}`;}
    function readSquadSlots(seasonId=deps.activeSeasonId()){
      try{
        const sid=deps.id(seasonId||"ie1"),key=squadSlotsKey(sid),raw=deps.localStorage?.getItem?.(key);
        if(raw){const parsed=JSON.parse(raw);return parsed&&typeof parsed==="object"?parsed:{};}
        // One-time compatibility bridge: old previews stored all three S1 slots
        // in the unsuffixed v1 key. Import them only into S1; never into S2.
        if(sid==="ie1"){
          const legacyRaw=deps.localStorage?.getItem?.(RTG_LEGACY_SQUAD_SLOTS_KEY);
          if(legacyRaw){
            const legacy=JSON.parse(legacyRaw);
            if(legacy&&typeof legacy==="object"){
              deps.localStorage?.setItem?.(key,JSON.stringify(legacy));
              return legacy;
            }
          }
        }
        return{};
      }catch(_e){return{}}
    }
    function writeSquadSlots(slots,seasonId=deps.activeSeasonId()){try{deps.localStorage?.setItem?.(squadSlotsKey(seasonId),JSON.stringify(slots||{}));}catch(_e){}}
    function storeSquadSlot(slot,squad){const slots=readSquadSlots();slots[String(slot)]=deps.clone(squad);writeSquadSlots(slots);}
    function readActiveSquadSlot(){try{return Math.max(1,Math.min(3,Number(deps.localStorage?.getItem?.(RTG_ACTIVE_SQUAD_SLOT_KEY))||1));}catch(_e){return 1}}
    function writeActiveSquadSlot(slot){try{deps.localStorage?.setItem?.(RTG_ACTIVE_SQUAD_SLOT_KEY,String(slot));}catch(_e){}}
    function squadForSlot(slot){
      const slots=readSquadSlots();
      const saved=slots?.[String(slot)];
      if(saved)return deps.clone(saved);
      /* Only slot 1 inherits the legacy campaign squad. New slots must start as
         independent snapshots, never aliases of whatever squad is currently official. */
      if(Number(slot)===1)return deps.clone(deps.activeSquad(deps.getCampaign())||deps.getSquadDraft());
      return deps.clone(slots?.["1"]||deps.activeSquad(deps.getCampaign())||deps.getSquadDraft());
    }

    return Object.freeze({readSquadSlots,writeSquadSlots,storeSquadSlot,readActiveSquadSlot,writeActiveSquadSlot,squadForSlot});
  }
  global.RoadToGlorySquadSlotRuntime=Object.freeze({create});
})(globalThis);
