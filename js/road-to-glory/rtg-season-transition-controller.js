(function (global) {
  "use strict";

  function create(deps={}){
    async function enterNextSeason(){
      const campaign=deps.getCampaign();
      const fromId=deps.activeSeasonId(),fromConfig=deps.config.season?.(fromId),nextSeasonId=deps.id(fromConfig?.nextSeasonId);
      if(!nextSeasonId||!campaign?.seasonComplete)return campaign;
      const nextConfig=deps.config.season?.(nextSeasonId);
      const nextDb=await global.SeasonRegistry?.loadDatabase?.(nextSeasonId);
      if(!nextDb||!nextConfig)throw new Error(`Database ${nextSeasonId} non disponibile`);
      const firstNode=deps.config.buildSeasonNodes(nextSeasonId)?.[0]?.id;
      let transitionRewarded=false;
      const nextCampaign=await deps.repository.update("rtg-enter-next-season",current=>{
        if(deps.id(current.activeSeasonId)!==fromId||!current.seasonComplete)return current;
        const rewardId=`${fromId}->${nextSeasonId}`;
        current.seasonTransitionRewardedIds=Array.from(new Set(current.seasonTransitionRewardedIds||[]));
        if(!current.seasonTransitionRewardedIds.includes(rewardId)){
          current.tokens=Math.max(0,Number(current.tokens)||0)+Number(deps.config.SEASON_TRANSITION_REWARD||1000);
          current.seasonTransitionRewardedIds.push(rewardId);transitionRewarded=true;
        }
        const previous=deps.clone(current.squads?.[fromId]||{formationId:null,lineup:[],bench:[],activeRoleVariantByCardId:{}});
        current.activeSeasonId=nextSeasonId;current.seasonComplete=false;
        current.lives=Number(nextConfig.livesPerCheckpoint)||2;current.checkpointMainIndex=-1;
        current.currentNodeId=firstNode;current.furthestNodeIndex=0;current.defeatedTeamIds=[];
        current.firstClearMatchIds=[];current.attemptsByNode={};current.activeMatch=null;
        current.squads=current.squads||{};
        current.squads[nextSeasonId]=current.squads[nextSeasonId]?.lineup?.length?current.squads[nextSeasonId]:previous;
        return current;
      });
      deps.applyTransition({campaign:nextCampaign,seasonDb:nextDb,nextSeasonId,transitionRewarded});
      return deps.renderRun();
    }
    async function restartCompletedCampaign(){
      const campaign=deps.getCampaign(),fromId=deps.activeSeasonId();
      const terminal=campaign?.campaignId==="rtg-ares-orion"?"orion":"ie1_s3";
      const first=campaign?.campaignId==="rtg-ares-orion"?"ie2":"ie1";
      if(fromId!==terminal||!campaign?.seasonComplete||campaign?.activeMatch)
        throw Object.assign(new Error("La campagna deve essere completata prima di ricominciare"),{code:"rtg-replay-unavailable"});
      const firstConfig=deps.config.season?.(first);
      const firstNode=deps.config.buildSeasonNodes(first)?.[0]?.id;
      const firstDb=await global.SeasonRegistry?.loadDatabase?.(first);
      if(!firstConfig||!firstNode||!firstDb)throw new Error("Dati iniziali della campagna non disponibili");
      const nextCampaign=await deps.repository.update("rtg-restart-completed-campaign",current=>{
        if(current.activeSeasonId!==terminal||!current.seasonComplete||current.activeMatch||
           current.campaignId!==campaign.campaignId)
          throw Object.assign(new Error("Il completamento della campagna non è più valido"),{code:"rtg-replay-stale"});
        // Existing transition IDs also document first clears in old saves.
        const paid=new Set(current.seasonTransitionRewardedIds||[]);
        for(const entry of [...paid]){
          const match=String(entry).match(/^(.+)->(.+)$/);
          if(match)paid.add("completion:"+match[1]);
        }
        paid.add("completion:"+terminal);
        current.seasonTransitionRewardedIds=Array.from(paid);
        current.activeSeasonId=first;
        current.seasonComplete=false;
        current.lives=Number(firstConfig.livesPerCheckpoint)||2;
        current.checkpointMainIndex=-1;
        current.currentNodeId=firstNode;
        current.furthestNodeIndex=0;
        current.defeatedTeamIds=[];
        current.firstClearMatchIds=[];
        current.attemptsByNode={};
        current.activeMatch=null;
        // Cards, team builds, tokens, owned coaches and development are permanent.
        return current;
      });
      deps.applyTransition({campaign:nextCampaign,seasonDb:firstDb,nextSeasonId:first,transitionRewarded:false});
      return deps.renderRun();
    }
    return Object.freeze({enterNextSeason,restartCompletedCampaign});
  }

  global.RoadToGlorySeasonTransitionController=Object.freeze({create});
})(globalThis);
