(function (global) {
  "use strict";

  const RTG_ALBUM_STORAGE_KEY="inazuma.rtg.album.v1";
  function create(deps={}){
    const id=deps.id;
    let selectedAlbumSeasonId="ie1";
    let albumReturnContext=null;
    let albumNavigationEpoch=0;
    let cachedCollections=null;
    let cachedCollectionsForCards=null;
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
      // Build indexes once per collection rather than scanning all players/profiles per team.
      const teamsById=new Map((db?.teams||[]).map(team=>[deps.id(team?.teamId||team?.id),team]));
      const profilesByTeam=new Map();
      if(db?.requiresProfileAwareRuntime){
        for(const profile of db?.profiles||[]){
          const teamId=deps.id(profile?.teamId);
          if(!profilesByTeam.has(teamId))profilesByTeam.set(teamId,[]);
          profilesByTeam.get(teamId).push(profile);
        }
      }
      const configured=Array.from(albumConfigFor(sid)?.mainTeams||[]);
      return configured.map(teamId=>{
        const team=teamsById.get(deps.id(teamId));
        if(!team)return null;
        const playerIds=Array.from(team?.playerIds||[]).map(id).filter(Boolean);
        const profileIds=db?.requiresProfileAwareRuntime
          ? Array.from(profilesByTeam.get(deps.id(teamId))||[]).map(profile=>deps.id(profile?.profileId||profile?.id)).filter(Boolean)
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
    function leaveAlbum(){
      // The return destination belongs to the current UI visit, never to persisted state.
      ++albumNavigationEpoch;
      const origin=albumReturnContext;
      albumReturnContext=null;
      if(origin?.source==="vending"&&typeof deps.returnToVending==="function"){
        return deps.returnToVending(origin.mode);
      }
      return deps.renderHome?.({initialPage:"rtg"});
    }
    function showAlbumCollections(campaign,collections,preserveScroll=false){
      deps.renderHtml(deps.runView.albumCollectionMarkup({state:campaign,collections}),{preserveScroll});
      deps.app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",leaveAlbum);
      deps.app?.querySelectorAll?.("[data-rtg-album-collection]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumTeams(button.dataset.rtgAlbumCollection)));
      deps.mountDevQuickTools();
    }
    async function renderAlbum(options={}){
      if(!options?.preserveOrigin){
        albumReturnContext=options?.source==="vending"
          ?{source:"vending",mode:options.mode==="recruitment"?"recruitment":"team"}
          :null;
      }
      const epoch=++albumNavigationEpoch;
      const campaign=deps.getCampaign();
      const seasonIds=deps.config.SEASON_IDS||["ie1"];
      const initialCollections=cachedCollections||seasonIds.map(seasonId=>({seasonId,pending:true}));
      // Paint synchronously BEFORE loading Season databases: no exposed route behind the modal.
      showAlbumCollections(campaign,initialCollections);
      try{
        await deps.ensureData();
        syncCurrentPullsIntoAlbum();
        const cardKey=JSON.stringify(readRtgAlbum().cardIds);
        if(!cachedCollections||cachedCollectionsForCards!==cardKey){
          const collections=await Promise.all((deps.config.SEASON_IDS||["ie1"]).map(albumCollectionSummary));
          cachedCollections=collections;
          cachedCollectionsForCards=cardKey;
        }
        // A slow Season response must not replace a team view or a closed Album.
        if(epoch===albumNavigationEpoch&&deps.app?.querySelector?.(".rtg-album-collections-screen")&&initialCollections!==cachedCollections){
          showAlbumCollections(campaign,cachedCollections,true);
        }
      }catch(error){
        global.console?.error?.("[RTG] Album collections unavailable",error);
        if(epoch===albumNavigationEpoch&&deps.app?.querySelector?.(".rtg-album-collections-screen")&&!cachedCollections){
          showAlbumCollections(campaign,seasonIds.map(seasonId=>({seasonId,error:true})),true);
        }
      }
      return campaign;
    }
    async function renderAlbumTeams(seasonId=selectedAlbumSeasonId){
      const epoch=++albumNavigationEpoch;
      const campaign=deps.getCampaign();
      await deps.ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=(deps.config.SEASON_IDS||[]).includes(deps.id(seasonId))?deps.id(seasonId):deps.activeSeasonId();
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      if(epoch!==albumNavigationEpoch)return campaign;
      deps.renderHtml(deps.runView.albumTeamsMarkup({state:{...(campaign||{}),activeSeasonId:sid},seasonId:sid,teams:rtgAlbumTeams(sid,db)}));
      deps.app?.querySelector?.("[data-rtg-album-collection-back]")?.addEventListener("click",()=>renderAlbum({preserveOrigin:true}));
      deps.app?.querySelectorAll?.("[data-rtg-album-team]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumRoster(button.dataset.rtgAlbumTeam,sid)));
      deps.mountDevQuickTools();
      return campaign;
    }
    async function renderAlbumRoster(teamId,seasonId=selectedAlbumSeasonId){
      const epoch=++albumNavigationEpoch;
      const campaign=deps.getCampaign();
      await deps.ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=(deps.config.SEASON_IDS||[]).includes(deps.id(seasonId))?deps.id(seasonId):selectedAlbumSeasonId;
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      if(epoch!==albumNavigationEpoch)return campaign;
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
