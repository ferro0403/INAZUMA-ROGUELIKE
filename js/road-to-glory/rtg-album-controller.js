(function (global) {
  "use strict";

  const RTG_ALBUM_STORAGE_KEY="inazuma.rtg.album.v1";
  function create(deps={}){
    const id=deps.id;
    let selectedAlbumSeasonId="ie1";
    function readRtgAlbum(){
      try{
        const raw=deps.localStorage?.getItem?.(RTG_ALBUM_STORAGE_KEY);
        const parsed=raw?JSON.parse(raw):{};
        return {cardIds:Array.from(new Set(Array.isArray(parsed?.cardIds)?parsed.cardIds.map(id).filter(Boolean):[]))};
      }catch(_error){return {cardIds:[]};}
    }
    function writeRtgAlbum(cardIds){
      const normalized=Array.from(new Set(Array.from(cardIds||[]).map(id).filter(Boolean)));
      try{deps.localStorage?.setItem?.(RTG_ALBUM_STORAGE_KEY,JSON.stringify({version:1,cardIds:normalized}));}catch(_error){}
      return normalized;
    }
    function rememberRtgAlbumCard(cardRef){
      const cardId=deps.cardMeta(cardRef).cardId;
      if(!cardId)return readRtgAlbum().cardIds;
      return writeRtgAlbum([...readRtgAlbum().cardIds,cardId]);
    }
    function syncCurrentPullsIntoAlbum(){
      const current=Array.from(deps.acquiredCardIdSet(deps.getCampaign()));
      if(!current.length)return readRtgAlbum().cardIds;
      return writeRtgAlbum([...readRtgAlbum().cardIds,...current]);
    }
    function rtgAlbumEntries(){
      syncCurrentPullsIntoAlbum();
      return readRtgAlbum().cardIds.map(cardId=>deps.playerResolver.resolveAtLevel20(cardId,deps.getCampaign()?.activeSeasonId||"ie1",null,deps.getFreeAgentsDb())).filter(Boolean);
    }
    function rtgAlbumUnlockedSet(){
      return new Set(readRtgAlbum().cardIds.map(id));
    }
    async function ensureAlbumSeasonDb(seasonId){
      const sid=deps.id(seasonId||"ie1");
      const previous=global.SeasonRegistry?.activeId?.();
      let db=global.SeasonRegistry?.database?.(sid)||null;
      if(!db){
        db=sid==="ie1"
          ? await deps.ensureSeason1Db?.()
          : await global.SeasonRegistry?.loadDatabase?.(sid);
      }
      if(previous&&previous!==sid)global.SeasonRegistry?.setActive?.(previous);
      return db;
    }
    function albumConfigFor(seasonId){
      const sid=deps.id(seasonId||"ie1");
      return deps.config?.season?.(sid)||deps.config.SEASON1;
    }
    function rtgAlbumTeams(seasonId=selectedAlbumSeasonId,albumDb=null){
      const sid=deps.id(seasonId||"ie1");
      const db=albumDb||global.SeasonRegistry?.database?.(sid)||(sid===deps.activeSeasonId()?deps.getSeasonDb():null);
      const unlocked=rtgAlbumUnlockedSet();
      const configured=Array.from(albumConfigFor(sid)?.mainTeams||[]);
      return configured.map(teamId=>{
        const team=(db?.teams||[]).find(entry=>deps.id(entry?.teamId||entry?.id)===deps.id(teamId));
        if(!team)return null;
        const playerIds=Array.from(team?.playerIds||[]).map(id).filter(Boolean);
        const profileIds=db?.requiresProfileAwareRuntime
          ? Array.from(db?.profiles||[]).filter(profile=>deps.id(profile?.teamId)===deps.id(teamId)).map(profile=>deps.id(profile?.profileId||profile?.id)).filter(Boolean)
          : [];
        const sourceIds=profileIds.length?profileIds:playerIds;
        const cardIds=sourceIds.map(playerId=>db?.requiresProfileAwareRuntime
          ? (deps.cardIdentity?.cardIdForProfile?.(playerId,sid)||playerId)
          : (deps.cardIdentity?.cardIdForSeason?.(playerId,sid)||playerId));
        return {seasonId:sid,teamId:deps.id(teamId),teamName:team?.teamName||team?.name||teamId,logoUrl:team?.logoUrl||"",playerIds,profileIds,cardIds,total:cardIds.length,unlocked:cardIds.filter(cardId=>unlocked.has(cardId)).length};
      }).filter(team=>team&&team.total>0);
    }
    function rtgAlbumTeamPlayers(team,seasonId=selectedAlbumSeasonId){
      const sid=deps.id(seasonId||team?.seasonId||"ie1");
      return Array.from(team?.cardIds||[]).map(cardId=>deps.playerResolver.resolveAtLevel20(cardId,sid,null,deps.getFreeAgentsDb())).filter(Boolean);
    }
    async function albumCollectionSummary(seasonId){
      const sid=deps.id(seasonId||"ie1");
      const db=await ensureAlbumSeasonDb(sid);
      const teams=rtgAlbumTeams(sid,db);
      return {
        seasonId:sid,
        unlocked:teams.reduce((sum,team)=>sum+(Number(team.unlocked)||0),0),
        total:teams.reduce((sum,team)=>sum+(Number(team.total)||0),0),
      };
    }
    async function renderAlbum(){
      const campaign=deps.getCampaign();
      await deps.ensureData();
      syncCurrentPullsIntoAlbum();
      const collections=await Promise.all((deps.config.SEASON_IDS||["ie1"]).map(albumCollectionSummary));
      deps.renderHtml(deps.runView.albumCollectionMarkup({state:campaign,collections}));
      deps.app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
      deps.app?.querySelectorAll?.("[data-rtg-album-collection]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumTeams(button.dataset.rtgAlbumCollection)));
      deps.mountDevQuickTools();
      return campaign;
    }
    async function renderAlbumTeams(seasonId=selectedAlbumSeasonId){
      const campaign=deps.getCampaign();
      await deps.ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=(deps.config.SEASON_IDS||[]).includes(deps.id(seasonId))?deps.id(seasonId):deps.activeSeasonId();
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      deps.renderHtml(deps.runView.albumTeamsMarkup({state:{...(campaign||{}),activeSeasonId:sid},seasonId:sid,teams:rtgAlbumTeams(sid,db)}));
      deps.app?.querySelector?.("[data-rtg-album-collection-back]")?.addEventListener("click",()=>renderAlbum());
      deps.app?.querySelectorAll?.("[data-rtg-album-team]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumRoster(button.dataset.rtgAlbumTeam,sid)));
      deps.mountDevQuickTools();
      return campaign;
    }
    async function renderAlbumRoster(teamId,seasonId=selectedAlbumSeasonId){
      const campaign=deps.getCampaign();
      await deps.ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=(deps.config.SEASON_IDS||[]).includes(deps.id(seasonId))?deps.id(seasonId):selectedAlbumSeasonId;
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      const team=rtgAlbumTeams(sid,db).find(entry=>deps.id(entry.teamId)===deps.id(teamId));
      if(!team)return renderAlbumTeams(sid);
      const unlocked=rtgAlbumUnlockedSet();
      const allEntries=rtgAlbumTeamPlayers(team,sid);
      const entries=allEntries.filter(player=>unlocked.has(deps.id(player?.cardId||player?.playerId||player?.id)));
      deps.renderHtml(deps.runView.albumRosterMarkup({state:{...(campaign||{}),activeSeasonId:sid},seasonId:sid,team,entries,allEntries,database:db}));
      deps.app?.querySelector?.("[data-rtg-album-back]")?.addEventListener("click",()=>renderAlbumTeams(sid));
      const albumRoster=deps.app?.querySelector?.("[data-rtg-album-roster]");
      albumRoster?.addEventListener("click",event=>{
        const origin=typeof event.target?.closest==="function"?event.target:event.target?.parentElement;
        const entry=origin?.closest?.("[data-rtg-album-player-entry]");
        const cardButton=origin?.closest?.("[data-rtg-album-player-card]");
        if(!entry&&!cardButton)return;
        const wrapper=entry||cardButton?.closest?.("[data-rtg-album-player-entry]");
        const cardId=deps.id(wrapper?.dataset?.rtgAlbumPlayerEntry);
        if(!cardId)return;
        event.preventDefault?.();
        deps.openPlayerDetails(cardId,"",{mode:"album",albumUnlocked:unlocked.has(cardId)});
      });
      deps.mountDevQuickTools();
      return campaign;
    }

    return Object.freeze({rememberRtgAlbumCard,syncCurrentPullsIntoAlbum,renderAlbum,renderAlbumTeams,renderAlbumRoster,setSelectedSeason:(seasonId)=>{selectedAlbumSeasonId=id(seasonId||"ie1");}});
  }
  global.RoadToGloryAlbumController=Object.freeze({create});
})(globalThis);
