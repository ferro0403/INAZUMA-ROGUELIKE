(function(global){
  "use strict";
  // One canonical commit transitions pending -> selected/skipped -> prepared.
  // No pre-commit UI success and no advancement on persistence failure.
  async function commit({repository,matchEngine,matchId,selection,skip=false}={}){
    const runtime=global.RoadToGloryCoachPreMatchRuntime;
    if(!runtime||!repository?.update)throw new Error("Configurazione prepartita indisponibile");
    return repository.update("rtg-prematch-coach-power",current=>{
      const live=current?.activeMatch;
      if(!live||String(live.matchId)!==String(matchId)||
         live.presentation?.preMatchPowerStatus!=="pending")
        throw Object.assign(new Error("Prepartita non più disponibile"),{code:"rtg-prematch-coach-stale"});
      const chosen=skip?runtime.skip(live):runtime.apply(live,live.preMatchCoachId,selection);
      if(!chosen)throw Object.assign(new Error("Selezione allenatore non valida"),{code:"rtg-prematch-coach-invalid"});
      current.activeMatch=matchEngine.prepareNext(chosen);
      return current;
    });
  }
  global.RoadToGloryCoachPreMatchController=Object.freeze({commit});
})(globalThis);
