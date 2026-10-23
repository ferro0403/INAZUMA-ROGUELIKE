(function(global){
  "use strict";
  // Re-use the game's production progression oracle, including profile-aware
  // Season resolution and already earned RTG/account evolution.
  // Never write a Development V2/V3 profile or touch the account ledger.
  const id=value=>String(value??"");
  function upgrade({player,targetRarity,cardId,playerResolver,freeAgentsDb,seasonId,squad}={}){
    if(!player||!playerResolver||!cardId)return null;
    const threshold=global.InazumaProgression?.RARITY_THRESHOLDS
      ?.find(entry=>entry.category===targetRarity)?.min;
    if(!Number.isInteger(threshold))return null;
    const originalRarity=global.RoadToGloryCoachPowerRuntime?.rarityOf?.(player);
    if(global.RoadToGloryCoachPowerRuntime?.nextRarity?.(originalRarity)!==targetRarity)return null;
    const version=playerResolver.resolveVersion?.(cardId,seasonId,freeAgentsDb);
    const basePotential=Number(version?.player?.finalOverall);
    const currentPotential=Number(player?.potential??player?.finalOverall??player?.overall);
    if(!Number.isInteger(basePotential)||!Number.isFinite(currentPotential))return null;
    const desired=Math.max(threshold,currentPotential);
    if(!Number.isInteger(desired)||desired>99||desired<basePotential)return null;
    const boost=desired-basePotential;
    const variant=squad?.activeRoleVariantByCardId?.[id(cardId)]||null;
    const options={
      potentialBoost:boost,currentOverallBoost:boost,
      potentialBoostApplications:boost?[{amount:boost,appliedLevel:0,permanent:true}]:[],
    };
    const result=playerResolver.resolveBaseAtLevel20?.(cardId,seasonId,variant,freeAgentsDb,options);
    if(!result||result.category!==targetRarity||!result.stats||
       !Number.isFinite(Number(result.overall))||
       Number(result.overall)<Number(player.overall||0))return null;
    return result;
  }
  global.RoadToGloryCoachRarityPower=Object.freeze({upgrade});
})(globalThis);
