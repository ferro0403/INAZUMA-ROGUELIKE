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
    return Object.freeze({enterNextSeason});
  }

  global.RoadToGlorySeasonTransitionController=Object.freeze({create});
})(globalThis);
