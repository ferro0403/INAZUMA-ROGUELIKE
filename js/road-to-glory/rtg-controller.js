(function (global) {
  "use strict";

  function create(deps={}){
    const app=deps.app;
    const repository=deps.repository;
    const runView=deps.runView;
    const squadView=deps.squadView;
    const matchView=deps.matchView;
    const entitlements=deps.entitlements||global.RoadToGloryEntitlements;
    const config=deps.config||global.RoadToGloryConfig;
    const progression=deps.progression||global.RoadToGloryProgression;
    const gacha=deps.gacha||global.RoadToGloryGacha;
    const squadRuntime=deps.squadRuntime||global.RoadToGlorySquadRuntime;
    const matchEngine=deps.matchEngine||global.RoadToGloryMatchEngine;
    const opponentGenerator=deps.opponentGenerator||global.RoadToGloryOpponentGenerator;
    const playerResolver=deps.playerResolver||global.RoadToGloryPlayerResolver;
    const economy=deps.economy||global.RoadToGloryEconomy;
    const economyView=deps.economyView||null;
    const cardIdentity=deps.cardIdentity||global.RoadToGloryCardIdentity;
    const rng=deps.rng||global.RoadToGloryRng;
    const aiPolicy=deps.aiPolicy||global.RoadToGloryAiPolicy;
    const penaltyRuntime=deps.penaltyRuntime||global.RoadToGloryPenaltyRuntime;
    const clone=(value)=>JSON.parse(JSON.stringify(value));
    const id=(value)=>String(value??"");
    const activeSeasonId=()=>id(campaign?.activeSeasonId||"ie1");
    const activeConfig=()=>config?.season?.(activeSeasonId())||config.SEASON1;
    const activeSquad=(state=campaign)=>state?.squads?.[id(state?.activeSeasonId||activeSeasonId())]||state?.squads?.ie1;

    let seasonDb=null;
    let freeAgentsDb=null;
    let campaign=null;
    let freeAgentIds=[];
    let squadDraft=null;
    let halftimeDraft=null;
    let rawPlayerById=new Map();
    let lastRenderedHtml="";
    let matchFlowTimer=null;
    let displayedMinute=0;
    let aresRouteMapPromise=null;
    let selectedEncounterChoice=null;
    let selectedEncounterId=null;
    const SQUAD_PICKER_PAGE_SIZE=24;
    const ENCOUNTER_REVEAL_DELAY_MS=2200;
    const FINAL_COMPARISON_DELAY_MS=1700;
    const DUEL_RESULT_REVEAL_DELAY_MS=1150;
    const schedule=deps.setTimeout||global.setTimeout;
    const cancelSchedule=deps.clearTimeout||global.clearTimeout;
    const DEV_MODE=deps.devMode===true||(typeof global.URLSearchParams==="function"&&new global.URLSearchParams(global.location?.search||"").get("dev")==="1");
    let activeSquadSlot=1;
    let squadSlotRuntime=null;
    function getSquadSlotRuntime(){
      if(!squadSlotRuntime)squadSlotRuntime=global.RoadToGlorySquadSlotRuntime.create({
        localStorage:global.localStorage,id,clone,activeSeasonId,activeSquad,getCampaign:()=>campaign,getSquadDraft:()=>squadDraft,
      });
      return squadSlotRuntime;
    }
    function readSquadSlots(seasonId){return getSquadSlotRuntime().readSquadSlots(seasonId);}
    function writeSquadSlots(slots,seasonId){return getSquadSlotRuntime().writeSquadSlots(slots,seasonId);}
    function storeSquadSlot(slot,squad){return getSquadSlotRuntime().storeSquadSlot(slot,squad);}
    function readActiveSquadSlot(){return getSquadSlotRuntime().readActiveSquadSlot();}
    function writeActiveSquadSlot(slot){return getSquadSlotRuntime().writeActiveSquadSlot(slot);}
    function squadForSlot(slot){return getSquadSlotRuntime().squadForSlot(slot);}
    async function selectSquadSlot(slot){
      const next=Math.max(1,Math.min(3,Number(slot)||1));
      if(next===activeSquadSlot)return;
      storeSquadSlot(activeSquadSlot,squadDraft||activeSquad(campaign));
      activeSquadSlot=next;
      writeActiveSquadSlot(next);
      squadDraft=squadForSlot(next);
      return renderSquad();
    }


    let albumController=null;
    function getAlbumController(){
      if(!albumController)albumController=global.RoadToGloryAlbumController.create({
        app,localStorage:global.localStorage,id,cardMeta,acquiredCardIdSet,getCampaign:()=>campaign,
        getSeasonDb:()=>seasonDb,getFreeAgentsDb:()=>freeAgentsDb,activeSeasonId,config,cardIdentity,
        playerResolver,ensureSeason1Db:deps.ensureSeason1Db,ensureData,renderHtml,runView,
        mountDevQuickTools,renderHome:deps.renderHome,openPlayerDetails:openRtgPlayerDetails,
      });
      return albumController;
    }
    function rememberRtgAlbumCard(cardRef){return getAlbumController().rememberRtgAlbumCard(cardRef);}
    function syncCurrentPullsIntoAlbum(){return getAlbumController().syncCurrentPullsIntoAlbum();}
    function renderAlbum(){return getAlbumController().renderAlbum();}
    function renderAlbumTeams(seasonId){return getAlbumController().renderAlbumTeams(seasonId);}
    function renderAlbumRoster(teamId,seasonId){return getAlbumController().renderAlbumRoster(teamId,seasonId);}

    function matchTimelineAnchor(){
      if(!app)return null;
      const items=app.querySelectorAll?.(".rtg-match-ticker-item, .rtg-match-log-item, [data-rtg-log-entry]")||[];
      return items.length ? items[items.length-1] : (app.querySelector?.(".rtg-match-ticker, .rtg-match-log, .rtg-match-timeline")||null);
    }
    function keepLatestMatchActionVisible(){
      const anchor=matchTimelineAnchor();
      if(!anchor)return;
      const rect=anchor.getBoundingClientRect?.();
      const viewport=global.innerHeight||global.document?.documentElement?.clientHeight||0;
      if(rect&&viewport&&rect.bottom>viewport-24){
        global.scrollBy?.({top:rect.bottom-(viewport-24),behavior:"auto"});
      }else if(rect&&rect.top<8){
        global.scrollBy?.({top:rect.top-8,behavior:"auto"});
      }
    }
    function renderHtml(html,options={}){
      lastRenderedHtml=String(html||"");
      if(app)app.innerHTML=lastRenderedHtml;
      if(options.preserveMatchTimeline===true){
        global.requestAnimationFrame?.(()=>keepLatestMatchActionVisible());
      }else if(options.preserveScroll!==true){
        deps.resetRenderedViewScroll?.();
      }
      return lastRenderedHtml;
    }
    function getRenderedHtml(){return app?.innerHTML||lastRenderedHtml;}

    async function ensureAresRouteMap(){
      if(global.__RTG_ARES_ROUTE_MAP_DATA_URL)return global.__RTG_ARES_ROUTE_MAP_DATA_URL;
      if(aresRouteMapPromise)return aresRouteMapPromise;
      const fetcher=deps.fetch||global.fetch;
      if(typeof fetcher!=="function")throw new Error("RTG Ares route map fetch unavailable");
      const partUrls=Array.from({length:9},(_,index)=>`assets/rtg/ares-map/part-${String(index).padStart(2,"0")}.txt?v=20260930-ares-route-1`);
      aresRouteMapPromise=(async()=>{
        const parts=await Promise.all(partUrls.map(async(url)=>{
          const response=await fetcher(url);
          if(!response?.ok)throw new Error(`RTG Ares route map asset missing: ${url}`);
          return String(await response.text()).trim();
        }));
        const payload=parts.join("");
        if(!payload.startsWith("UklGR"))throw new Error("RTG Ares route map asset invalid");
        const dataUrl=`data:image/webp;base64,${payload}`;
        global.__RTG_ARES_ROUTE_MAP_DATA_URL=dataUrl;
        return dataUrl;
      })().catch((error)=>{
        aresRouteMapPromise=null;
        throw error;
      });
      return aresRouteMapPromise;
    }

    async function ensureData(){
      const sid=activeSeasonId();
      seasonDb=global.SeasonRegistry?.database?.(sid)||seasonDb;
      if(!seasonDb||id(seasonDb?.seasonId||"ie1")!==sid){
        seasonDb=sid==="ie1"?await deps.ensureSeason1Db():await global.SeasonRegistry?.loadDatabase?.(sid);
      }
      freeAgentsDb=deps.getFreeAgentsDb?.()||freeAgentsDb||{players:[]};
      if(!rawPlayerById.size){
        rawPlayerById=new Map();
        for(const player of freeAgentsDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
        for(const player of seasonDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
        for(const profile of seasonDb?.profiles||[])rawPlayerById.set(id(profile.profileId||profile.id),profile);
      }
      return {seasonDb,freeAgentsDb};
    }
    function cardMeta(cardRef){return cardIdentity?.parse?.(cardRef)||{cardId:id(cardRef),playerId:id(cardRef),legacySeasonId:null,sourceKind:"legacy"};}
    function freeAgentCardId(playerId){return cardIdentity?.cardIdForFreeAgent?.(playerId)||id(playerId);}
    function accessibleCards(state){
      const args={freeAgentIds,state};
      const direct=squadRuntime?.accessibleCardIds?.(args);
      if(Array.isArray(direct))return direct.map(id);
      return (squadRuntime?.accessiblePlayerIds?.(args)||freeAgentIds).map(freeAgentCardId);
    }
    function rawPlayer(cardRef){
      const meta=cardMeta(cardRef);
      if(meta.sourceKind===cardIdentity?.FREE_AGENTS)return (freeAgentsDb?.players||[]).find(player=>id(player?.playerId||player?.id)===id(meta.playerId))||null;
      if(meta.legacySeasonId){
        const db=global.SeasonRegistry?.database?.(meta.legacySeasonId)||(meta.legacySeasonId==="ie1"?seasonDb:null);
        const profileId=id(meta.profileId||meta.playerId);
        const profile=(db?.profiles||[]).find(entry=>id(entry?.profileId||entry?.id)===profileId);
        if(profile)return profile;
        const canonicalId=id(meta.canonicalPlayerId||meta.playerId);
        return (db?.players||[]).find(player=>id(player?.playerId||player?.id)===canonicalId)||null;
      }
      return rawPlayerById.get(id(meta.playerId))||null;
    }
    function rawRole(cardRef){const player=resolved(cardRef)||rawPlayer(cardRef);return String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();}
    function rawOverall(cardRef){const player=resolved(cardRef)||rawPlayer(cardRef);const value=Number(player?.overall??player?.finalOverall??player?.baseOverall);return Number.isFinite(value)?value:0;}
    function rawName(cardRef){const meta=cardMeta(cardRef);return String((resolved(cardRef)||rawPlayer(cardRef))?.name||meta.playerId||cardRef);}
    function acquiredCardIdSet(state=campaign){
      const modern=(state?.gachaAcquiredCards||[]).map(entry=>cardIdentity?.parse?.(entry)?.cardId||id(entry?.cardId||entry?.playerId||entry));
      const legacy=(state?.gachaAcquiredPlayerIds||[]).map(playerId=>cardIdentity?.cardIdForSeason?.(playerId,state?.activeSeasonId||"ie1")||id(playerId));
      return new Set([...modern,...legacy].filter(Boolean));
    }
    function sourceForDraftPlayer(cardRef){return acquiredCardIdSet().has(cardMeta(cardRef).cardId)?"RTG":"Svincolato";}
    function detailDatabaseFor(cardRef){
      const resolvedVersion=playerResolver.resolveVersion?.(cardRef,campaign?.activeSeasonId||"ie1",freeAgentsDb);
      if(resolvedVersion?.seasonId==="free_agents")return freeAgentsDb;
      if(resolvedVersion?.seasonId)return global.SeasonRegistry?.database?.(resolvedVersion.seasonId)||seasonDb;
      const meta=cardMeta(cardRef);
      if(meta.sourceKind===cardIdentity?.FREE_AGENTS)return freeAgentsDb;
      if(!meta.legacySeasonId&&(freeAgentsDb?.players||[]).some(player=>id(player?.playerId||player?.id)===id(meta.playerId)))return freeAgentsDb;
      return global.SeasonRegistry?.database?.(meta.legacySeasonId)||seasonDb;
    }
    function openRtgPlayerDetails(cardRef,side="",options={}){
      const key=id(cardRef);
      let player=null;
      if(side&&campaign?.activeMatch)player=findMatchPlayer(campaign.activeMatch,side,key);
      player=player||resolved(key,squadDraft?.activeRoleVariantByCardId?.[key]||null);
      if(!player)return deps.toast?.("Giocatore non disponibile","error");
      const detailPlayer=player?.stats&&!player?.baseStats
        ? {...player,baseStats:{...player.stats}}
        : player;
      const detailMeta=cardMeta(player?.cardId||key);
      const rtgLegacyLabel=detailMeta.sourceKind==="season"
        ? (cardIdentity?.legacyLabel?.(detailMeta.legacySeasonId)||"")
        : "";
      const draftLocation=!side?locationInDraft(key):null;
      const canSwitchRole=options?.allowRoleSwitch===true
        && draftLocation?.area==="bench"
        && Array.isArray(player?.roleVariants)
        && player.roleVariants.length>1;
      const reopenOptions={...options,allowRoleSwitch:true};
      return deps.showPlayerDetailsFor?.(detailPlayer,{
        playerId:id(detailMeta.canonicalPlayerId||player.playerId||detailMeta.playerId),
        level:20,
        database:detailDatabaseFor(key),
        equipment:null,
        rtgLegacyLabel,
        rtgRoleSwitch:canSwitchRole?{enabled:true}:null,
        onRtgRoleSwitch:canSwitchRole?()=>{
          const switched=switchBenchRole(key,{render:false});
          if(!switched?.ok)return switched;
          deps.closeModal?.({invokeOnClose:false});
          renderSquad();
          return openRtgPlayerDetails(key,"",reopenOptions);
        }:null,
        moveSeasonId:id(detailMeta.legacySeasonId||player.resolvedSeasonId||campaign?.activeSeasonId||"ie1"),
        readOnly:true,
        mode:options?.mode||undefined,
        albumUnlocked:options?.albumUnlocked,
        preserveScroll:true,
        onClose:typeof options?.onClose==="function"?options.onClose:null,
      });
    }
    function refreshEntitlements(){
      const albumProgress=deps.getAlbumProgress?.();
      const access=entitlements.accessStatus({albumProgress,freeAgentsDb,formations:seasonDb?.formations?.eleven||[]});
      freeAgentIds=entitlements.unlockedFreeAgentIds({albumProgress,freeAgentsDb});
      if(!DEV_MODE||access.unlocked)return access;
      freeAgentIds=Array.from(new Set((freeAgentsDb?.players||[]).map(player=>id(player?.playerId||player?.id)).filter(Boolean)));
      return Object.freeze({
        unlocked:true,
        count:freeAgentIds.length,
        reason:"dev-bypass",
        formationIds:Object.freeze((seasonDb?.formations?.eleven||[]).map(formation=>id(formation?.id)).filter(Boolean)),
      });
    }

    function devRenderCurrentSurface(){
      if(campaign?.activeMatch)return renderMatch(campaign.activeMatch);
      if(app?.querySelector?.(".rtg-squad-shell"))return renderSquad();
      return renderRun();
    }
    async function devUpdateCampaign(label,mutator,message){
      if(!DEV_MODE||!campaign)return campaign;
      campaign=await repository.update(label,current=>{
        mutator?.(current);
        return current;
      });
      if(message)deps.toast?.(message);
      return devRenderCurrentSurface();
    }
    async function devJumpMatchBoundary(kind){
      if(!DEV_MODE||!campaign?.activeMatch)return campaign;
      campaign=await repository.update(`rtg-dev-${kind}`,current=>{
        const match=clone(current.activeMatch);
        if(!match)return current;
        const tiedScore=Math.max(0,Number(match.score?.user)||0,Number(match.score?.opponent)||0);
        match.presentation={...(match.presentation||{}),preMatchSeen:true};
        match.pendingEncounter=null;
        match.result=null;
        match.score={user:tiedScore,opponent:tiedScore};
        if(kind==="halftime"){
          match.period="halftime";
          match.status="halftime";
          match.shootout=null;
        }else if(kind==="extra"){
          match.period="extra_first";
          match.status="active";
          match.extraActionIndex=0;
          match.shootout=null;
          current.activeMatch=matchEngine.prepareNext(match);
          return current;
        }else if(kind==="penalties"){
          match.period="extra_second";
          match.status="penalties";
          match.extraActionIndex=6;
          match.shootout=penaltyRuntime.createShootout(`${match.seed}:shootout:dev`);
        }
        current.activeMatch=match;
        return current;
      });
      displayedMinute=kind==="halftime"?45:kind==="penalties"?120:90;
      deps.toast?.(kind==="halftime"?"Intervallo DEV":kind==="extra"?"Supplementari DEV":"Rigori DEV");
      return renderMatch(campaign.activeMatch);
    }
    async function devForceMatchOutcome(winner){
      if(!DEV_MODE||!campaign?.activeMatch)return campaign;
      const side=winner==="opponent"?"opponent":"user";
      return commitMatchState(`rtg-dev-force-${side}`,match=>{
        match.presentation={...(match.presentation||{}),preMatchSeen:true};
        match.pendingEncounter=null;
        match.status="completed";
        const user=Math.max(0,Number(match.score?.user)||0);
        const opponent=Math.max(0,Number(match.score?.opponent)||0);
        match.score=side==="user"
          ?{user:Math.max(user,opponent+1),opponent}
          :{user,opponent:Math.max(opponent,user+1)};
        match.result={winner:side,score:{...match.score},devForced:true};
        return match;
      });
    }
    function mountDevQuickTools(){
      if(!DEV_MODE||!global.document||!campaign)return;
      const mount=()=>{
        const doc=global.document;
        doc.getElementById("run-dev-quick-tools")?.remove();
        doc.getElementById("rtg-dev-quick-tools")?.remove();
        const panel=doc.createElement("details");
        panel.id="rtg-dev-quick-tools";
        panel.className="run-dev-quick-tools";
        panel.dataset.rtgDevTools="true";
        const active=campaign?.activeMatch;
        const previousSeasonId=activeConfig()?.previousSeasonId;
        const previousSeasonButton=!active&&previousSeasonId
          ? `<button type="button" data-dev-rtg="previous-season">TORNA ALLA SEASON ${config.season(previousSeasonId)?.seasonNumber||"PRECEDENTE"}</button>`
          : "";
        const routeButtons=active?"":`<button type="button" data-dev-rtg="next-node">TAPPA SUCCESSIVA</button>${previousSeasonButton}`;
        const matchButtons=!active?"":'<button type="button" data-dev-rtg="halftime">VAI ALL\'INTERVALLO</button><button type="button" data-dev-rtg="extra">VAI AI SUPPLEMENTARI</button><button type="button" data-dev-rtg="penalties">VAI AI RIGORI</button><button type="button" data-dev-rtg="moves">RICARICA MOSSE</button><button type="button" data-dev-rtg="win">FORZA VITTORIA</button><button type="button" class="danger" data-dev-rtg="loss">FORZA SCONFITTA</button>';
        panel.innerHTML=`<summary>DEV RTG</summary><div><p><b>Gettoni: ${Number(campaign.tokens)||0}</b><br>Vite: ${Number(campaign.lives)||0}${active?` · ${active.status} / ${active.period}`:""}</p><button type="button" data-dev-rtg="tokens">999.999 GETTONI</button><button type="button" data-dev-rtg="lives">RIPRISTINA VITE</button><button type="button" data-dev-rtg="pool">SBLOCCA TUTTO IL POOL</button>${routeButtons}${matchButtons}</div>`;
        doc.body?.appendChild(panel);

        panel.querySelector('[data-dev-rtg="tokens"]')?.addEventListener("click",()=>devUpdateCampaign("rtg-dev-tokens",state=>{state.tokens=999999;},"Gettoni RTG portati a 999.999"));
        panel.querySelector('[data-dev-rtg="lives"]')?.addEventListener("click",()=>devUpdateCampaign("rtg-dev-lives",state=>{state.lives=Number(activeConfig()?.livesPerCheckpoint)||2;},"Vite RTG ripristinate"));
        panel.querySelector('[data-dev-rtg="pool"]')?.addEventListener("click",()=>devUpdateCampaign("rtg-dev-pool",state=>{state.defeatedTeamIds=Array.from(new Set(activeConfig()?.mainTeams||[]));},"Pool distributore RTG sbloccato"));
        panel.querySelector('[data-dev-rtg="next-node"]')?.addEventListener("click",()=>devUpdateCampaign("rtg-dev-next-node",state=>{
          const nodes=Array.from(config.buildSeasonNodes?.(activeSeasonId())||[]);
          const currentIndex=nodes.findIndex(node=>id(node.id)===id(state.currentNodeId));
          const next=nodes[Math.min(nodes.length-1,Math.max(0,currentIndex+1))];
          if(next){
            state.currentNodeId=next.id;
            state.furthestNodeIndex=Math.max(Number(state.furthestNodeIndex)||0,Math.max(0,currentIndex+1));
          }
        },"Avanzamento RTG spostato alla tappa successiva"));
        panel.querySelector('[data-dev-rtg="previous-season"]')?.addEventListener("click",async()=>{
          const previousId=activeConfig()?.previousSeasonId;if(!previousId)return;
          const previousConfig=config.season(previousId),previousDb=global.SeasonRegistry?.database?.(previousId)||await global.SeasonRegistry?.loadDatabase?.(previousId);
          const previousNodes=Array.from(config.buildSeasonNodes?.(previousId)||[]);
          campaign=await repository.update("rtg-dev-return-previous-season",state=>{
            state.activeSeasonId=previousId;state.currentNodeId=previousNodes.at(-1)?.id||`main:${previousConfig.mainTeams.at(-1)}`;
            state.furthestNodeIndex=Math.max(0,previousNodes.length-1);state.seasonComplete=true;
            state.defeatedTeamIds=Array.from(previousConfig.mainTeams||[]);state.lives=Number(previousConfig.livesPerCheckpoint)||2;state.activeMatch=null;return state;
          });
          seasonDb=previousDb;getAlbumController().setSelectedSeason(previousId);initSquadDraft();deps.toast?.(`DEV: ritorno alla Season ${previousConfig.seasonNumber}`);renderRun();
        });
        panel.querySelector('[data-dev-rtg="halftime"]')?.addEventListener("click",()=>devJumpMatchBoundary("halftime"));
        panel.querySelector('[data-dev-rtg="extra"]')?.addEventListener("click",()=>devJumpMatchBoundary("extra"));
        panel.querySelector('[data-dev-rtg="penalties"]')?.addEventListener("click",()=>devJumpMatchBoundary("penalties"));
        panel.querySelector('[data-dev-rtg="moves"]')?.addEventListener("click",()=>devUpdateCampaign("rtg-dev-moves",state=>{
          const uses=state.activeMatch?.moveUsesByPlayerId||{};
          Object.keys(uses).forEach(key=>{uses[key]=2;});
        },"Mosse RTG ricaricate"));
        panel.querySelector('[data-dev-rtg="win"]')?.addEventListener("click",()=>devForceMatchOutcome("user"));
        panel.querySelector('[data-dev-rtg="loss"]')?.addEventListener("click",()=>devForceMatchOutcome("opponent"));
      };
      if(typeof schedule==="function")schedule(mount,0);else mount();
    }
    function normalizeResolvedPlayer(cardRef,player,roleVariantId=null){
      if(!player)return null;
      const stats=player.stats||player.finalStats||{};
      const meta=cardMeta(player.cardId||cardRef);
      const normalized={...player,...stats,playerId:id(player.playerId||meta.playerId),cardId:id(player.cardId||meta.cardId),legacySeasonId:player.legacySeasonId||meta.legacySeasonId,overall:Number(player.overall??player.finalOverall??0),level:20};
      const role=normalized.normalizedRole||normalized.position||normalized.role;
      const move=playerResolver.resolveMove(cardRef,campaign?.activeSeasonId||"ie1",role,freeAgentsDb,roleVariantId);
      return move?{...normalized,move:clone(move)}:{...normalized,move:null};
    }
    function resolvedWithDevelopment(cardRef,roleVariantId=null,developmentByCardId=null){
      let player;
      if(typeof playerResolver.resolveOwnedAtLevel20==="function"){
        player=playerResolver.resolveOwnedAtLevel20(cardRef,campaign?.activeSeasonId||"ie1",roleVariantId,freeAgentsDb,developmentByCardId||{});
      }else{
        player=playerResolver.resolveAtLevel20(cardRef,campaign?.activeSeasonId||"ie1",roleVariantId,freeAgentsDb);
      }
      if(!player&&!cardIdentity){
        const fallback=cardMeta(cardRef).playerId;
        player=playerResolver.resolveAtLevel20(fallback,campaign?.activeSeasonId||"ie1",roleVariantId,freeAgentsDb);
      }
      return normalizeResolvedPlayer(cardRef,player,roleVariantId);
    }
    function resolved(cardRef,roleVariantId=null){
      return resolvedWithDevelopment(cardRef,roleVariantId,campaign?.developmentByCardId||{});
    }
    function resolvedStandard(cardRef,roleVariantId=null){
      let player;
      if(typeof playerResolver.resolveStandardAtLevel20==="function"){
        player=playerResolver.resolveStandardAtLevel20(cardRef,campaign?.activeSeasonId||"ie1",roleVariantId,freeAgentsDb);
      }else{
        player=playerResolver.resolveAtLevel20(cardRef,campaign?.activeSeasonId||"ie1",roleVariantId,freeAgentsDb);
      }
      return normalizeResolvedPlayer(cardRef,player,roleVariantId);
    }
    function playerResolverForState(state=campaign){
      if(typeof playerResolver.resolveOwnedAtLevel20!=="function")return playerResolver;
      return {
        ...playerResolver,
        resolveAtLevel20:(cardRef,seasonId,roleVariantId,database)=>playerResolver.resolveOwnedAtLevel20(
          cardRef,
          seasonId,
          roleVariantId,
          database,
          state?.developmentByCardId||{}
        ),
      };
    }
    function resolvedSquad(snapshot,state=campaign){
      const variants=snapshot?.activeRoleVariantByCardId||{};
      return {
        formationId:snapshot?.formationId||null,
        lineup:(snapshot?.lineup||[]).map(cardId=>resolvedWithDevelopment(cardId,variants[cardId]||null,state?.developmentByCardId||{})).filter(Boolean),
        bench:(snapshot?.bench||[]).map(cardId=>resolvedWithDevelopment(cardId,variants[cardId]||null,state?.developmentByCardId||{})).filter(Boolean),
        activeRoleVariantByCardId:{...variants},
      };
    }
    function bestPlayerIdsForRole(ids,role){
      const target=String(role||"").toUpperCase();
      return ids.map(id).filter(playerId=>rawRole(playerId)===target).sort((a,b)=>rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
    }
    function buildDefaultSquad(state,formationId=null){
      const formations=seasonDb?.formations?.eleven||[];
      const formation=formations.find(item=>id(item.id)===id(formationId))||formations.find(item=>{
        const counts={GK:0,DF:0,MF:0,FW:0};
        for(const playerId of freeAgentIds){const role=rawRole(freeAgentCardId(playerId));if(counts[role]!=null)counts[role]++;}
        return Object.entries(item.requirements||{}).every(([role,n])=>counts[String(role).toUpperCase()]>=Number(n||0));
      })||formations[0];
      if(!formation)throw Object.assign(new Error("Nessun modulo RTG disponibile"),{code:"rtg-squad-no-formation"});
      const accessible=accessibleCards(state).map(id);
      const selected=[];
      for(const [role,count] of Object.entries(formation.requirements||{})){
        const candidates=bestPlayerIdsForRole(accessible,String(role).toUpperCase()).filter(playerId=>!selected.includes(playerId));
        if(candidates.length<Number(count||0))throw Object.assign(new Error("Rosa RTG insufficiente per il modulo"),{code:"rtg-squad-default-unavailable"});
        selected.push(...candidates.slice(0,Number(count||0)));
      }
      const remaining=accessible.filter(playerId=>!selected.includes(playerId)).sort((a,b)=>rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
      if(remaining.length<4)throw Object.assign(new Error("Servono 4 panchinari RTG"),{code:"rtg-squad-bench-unavailable"});
      return {formationId:id(formation.id),lineup:selected.slice(0,11),bench:remaining.slice(0,4),activeRoleVariantByCardId:{}};
    }
    async function ensureInitialSquad(){
      const squad=activeSquad(campaign);
      if(squad?.formationId&&squad.lineup?.length===11&&squad.bench?.length===4)return campaign;
      campaign=await repository.update("rtg-initial-squad",current=>{
        const existing=current.squads?.[id(current.activeSeasonId||activeSeasonId())];
        if(existing?.formationId&&existing.lineup?.length===11&&existing.bench?.length===4)return current;
        current.squads=current.squads||{};
        current.squads[id(current.activeSeasonId||activeSeasonId())]=buildDefaultSquad(current);
        return current;
      });
      return campaign;
    }
    let developmentController=null;
    function getDevelopmentController(){
      if(!developmentController)developmentController=global.RoadToGloryDevelopmentController.create({
        app,economy,economyView,repository,id,getCampaign:()=>campaign,setCampaign:(next)=>{campaign=next;},
        getSquadDraft:()=>squadDraft,activeSquad,resolved,resolvedStandard,resolvedWithDevelopment,
        renderRun,renderHtml,mountDevQuickTools,openPlayerDetails:openRtgPlayerDetails,
        renderHome:deps.renderHome,toast:deps.toast,openModal:deps.openModal,getModalRoot:deps.getModalRoot,closeModal:deps.closeModal,
      });
      return developmentController;
    }
    function renderShop(options={}){return getDevelopmentController().renderShop(options);}
    function renderDevelopment(tab="players"){return getDevelopmentController().renderDevelopment(tab);}

    function bindHomeAndTabs(){
      app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
      app?.querySelector?.('[data-rtg-tab="run"]')?.addEventListener("click",()=>renderRun());
      app?.querySelector?.('[data-rtg-tab="squad"]')?.addEventListener("click",()=>renderSquad());
      app?.querySelector?.('[data-rtg-tab="album"]')?.addEventListener("click",()=>renderAlbum());
    }
    function bindRun(){
      bindHomeAndTabs();
      app?.querySelector?.("[data-rtg-open-vending]")?.addEventListener("click",()=>openVending());
      app?.querySelector?.("[data-rtg-current-node]")?.addEventListener("click",event=>openNode(event.currentTarget.dataset.rtgCurrentNode));
      app?.querySelectorAll?.("[data-rtg-node-id]")?.forEach(button=>button.addEventListener("click",()=>openNode(button.dataset.rtgNodeId)));
    }
    function renderRun(){
      const nodes=config.buildSeasonNodes(activeSeasonId());
      renderHtml(runView.runMarkup({state:campaign,nodes,seasonDb,seasonConfig:activeConfig()}));
      bindRun();
      app?.querySelectorAll?.("[data-rtg-enter-next-season]")?.forEach(button=>button.addEventListener("click",()=>enterNextSeason()));
      mountDevQuickTools();
      return campaign;
    }
    let seasonTransitionController=null;
    function enterNextSeason(){
      if(!seasonTransitionController)seasonTransitionController=global.RoadToGlorySeasonTransitionController.create({
        getCampaign:()=>campaign,activeSeasonId,config,id,repository,clone,renderRun,
        applyTransition:({campaign:nextCampaign,seasonDb:nextDb,nextSeasonId,transitionRewarded})=>{
          campaign=nextCampaign;seasonDb=nextDb;rawPlayerById=new Map();
          for(const player of seasonDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
          for(const profile of seasonDb?.profiles||[])rawPlayerById.set(id(profile.profileId||profile.id),profile);
          progression?.setSeasonContext?.(campaign);
          const nextSlots=readSquadSlots(nextSeasonId);
          if(!nextSlots["1"]){const carried=clone(activeSquad(campaign));writeSquadSlots({"1":carried,"2":clone(carried),"3":clone(carried)},nextSeasonId);}
          activeSquadSlot=1;writeActiveSquadSlot(1);squadDraft=squadForSlot(1);
          if(transitionRewarded)deps.toast?.(`BONUS SEASON: +${Number(config.SEASON_TRANSITION_REWARD||1000)} GETTONI RTG`);
        },
      });
      return seasonTransitionController.enterNextSeason();
    }


    let squadController=null;
    function getSquadController(){
      if(!squadController){
        const context={
          app,config,squadRuntime,runView,squadView,economy,repository,cardIdentity,playerResolver,
          clone,id,activeSeasonId,activeConfig,activeSquad,resolved,resolvedStandard,resolvedWithDevelopment,resolvedSquad,playerResolverForState,bestPlayerIdsForRole,
          rawRole,rawOverall,rawName,rawPlayer,cardMeta,accessibleCards,acquiredCardIdSet,sourceForDraftPlayer,detailDatabaseFor,openRtgPlayerDetails,
          renderHtml,bindHomeAndTabs,mountDevQuickTools,readSquadSlots,writeSquadSlots,storeSquadSlot,readActiveSquadSlot,
          writeActiveSquadSlot,squadForSlot,selectSquadSlot,freeAgentCardId,nodeById,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
          closeModal:deps.closeModal,toast:deps.toast,renderHome:deps.renderHome,getUserTeamMeta:deps.getUserTeamMeta,compactPlayerCardMarkup:deps.compactPlayerCardMarkup,
        };
        Object.defineProperties(context,{
          campaign:{get:()=>campaign,set:value=>{campaign=value;}},squadDraft:{get:()=>squadDraft,set:value=>{squadDraft=value;}},
          activeSquadSlot:{get:()=>activeSquadSlot,set:value=>{activeSquadSlot=value;}},seasonDb:{get:()=>seasonDb},
          freeAgentsDb:{get:()=>freeAgentsDb},entitlementStatus:{get:()=>entitlementStatus},freeAgentIds:{get:()=>freeAgentIds},
        });
        squadController=global.RoadToGlorySquadController.create(context);
      }
      return squadController;
    }
    function renderSquad(){return getSquadController().renderSquad();}
    function saveSquad(nextSquad=squadDraft,options={}){return getSquadController().saveSquad(nextSquad,options);}
    function swapSquadDraft(firstId,secondId,options={}){return getSquadController().swapSquadDraft(firstId,secondId,options);}
    function canUseDraftFormation(formation){return getSquadController().canUseDraftFormation(formation);}
    function arrangeDraftForFormation(formation){return getSquadController().arrangeDraftForFormation(formation);}
    function openSquadPlayerPicker(targetId){return getSquadController().openSquadPlayerPicker(targetId);}
    function openRtgCatalog(){return getSquadController().openRtgCatalog();}
    function locationInDraft(playerId){return getSquadController().locationInDraft(playerId);}
    function switchBenchRole(cardRef,options={}){return getSquadController().switchBenchRole(cardRef,options);}
    function adaptSquadToCurrentRequirements(){return getSquadController().adaptSquadToCurrentRequirements();}

    function nodeById(nodeId){return Array.from(config.buildSeasonNodes(activeSeasonId())).find(node=>node.id===id(nodeId))||null;}
    function canStartNode(node){
      if(!node)return false;
      if(node.id===campaign.currentNodeId)return true;
      return node.type==="secondary"&&Number(campaign.attemptsByNode?.[node.id]?.clears||0)>0;
    }
    function openNode(nodeId){
      const node=nodeById(nodeId);
      if(!node)return;
      const allowed=canStartNode(node);
      let body="";
      if(node.type==="main"){
        const eligibility=squadRuntime.mainEligibility({teamId:node.teamId,state:campaign,seasonDb,freeAgentIds,freeAgentsDb,playerResolver:playerResolverForState(campaign)});
        body=runView.nodeModalMarkup
          ? runView.nodeModalMarkup({node,eligibility,seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>${id(node.teamId)}</h2>${runView.requirementsMarkup(eligibility)}<button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed||!eligibility.eligible?"disabled":""}>GIOCA</button></div>`;
      }else{
        body=runView.nodeModalMarkup
          ? runView.nodeModalMarkup({node,seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>Partita secondaria</h2><p>Avversari svincolati casuali. Vittoria: 200 Gettoni RTG.</p><button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed?"disabled":""}>GIOCA</button></div>`;
      }
      deps.openModal?.(body,{className:"rtg-modal"});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-start-node]")?.addEventListener("click",()=>{deps.closeModal?.();startMatch(node.id);});
    }
    function teamRecordForId(teamId){return (seasonDb?.teams||[]).find(team=>id(team?.teamId||team?.id)===id(teamId))||null;}
    function bossFor(teamId){return [...(seasonDb?.bossOrder||[]),...(seasonDb?.specialMatches||[])].find(boss=>id(boss.teamId)===id(teamId))||null;}
    function resolvedForTeam(playerId,teamId){
      const profile=(seasonDb?.profiles||[]).find(entry=>id(entry?.playerId)===id(playerId)&&id(entry?.teamId)===id(teamId));
      const ref=profile?cardIdentity?.cardIdForSeason?.(profile.profileId,activeSeasonId()):playerId;
      return resolvedStandard(ref||playerId);
    }
    function mainOpponent(node){
      const boss=bossFor(node.teamId);
      if(!boss)throw Object.assign(new Error("Boss RTG non trovato"),{code:"rtg-boss-missing"});
      const profileIds=Array.from(boss.startingXIProfileIds||[]);
      const lineup=profileIds.length
        ? profileIds.map(profileId=>resolvedStandard(cardIdentity?.cardIdForProfile?.(profileId,activeSeasonId())||profileId)).filter(Boolean)
        : (boss.startingXIPlayerIds||[]).map(playerId=>resolvedForTeam(playerId,node.teamId)).filter(Boolean);
      return {formationId:boss.bossFormation||boss.matchFormation||null,lineup,bench:[],name:boss.teamName||node.teamId||"Avversario",teamId:node.teamId,seasonId:activeSeasonId(),logoUrl:boss.logoUrl||teamRecordForId(node.teamId)?.logoUrl||null};
    }
    function secondaryOpponent(node,current,attemptNumber){
      const generated=opponentGenerator.generate({seed:`${current.campaignSeed}:${node.id}`,attemptNumber,freeAgentsDb,formations:seasonDb?.formations?.eleven||[],targetMin:node.opponentTargetMin,targetMax:node.opponentTargetMax,playerResolver,seasonId:id(current?.activeSeasonId||activeSeasonId())});
      return {formationId:generated.formationId,lineup:generated.playerIds.map(playerId=>resolvedStandard(playerId)).filter(Boolean),bench:[],teamPower:generated.teamPower,name:generated.name,specialType:"free-agents"};
    }
    async function startMatch(nodeId){
      const node=nodeById(nodeId);
      let started=null;
      campaign=await repository.update("rtg-start-match",current=>{
        if(current.activeMatch)throw Object.assign(new Error("Partita RTG già attiva"),{code:"rtg-match-already-active"});
        const allowed=node?.id===current.currentNodeId||(node?.type==="secondary"&&Number(current.attemptsByNode?.[node.id]?.clears||0)>0);
        if(!node||!allowed)throw Object.assign(new Error("Nodo RTG non disponibile"),{code:"rtg-node-not-available"});
        if(node.type==="main"){
          const eligibility=squadRuntime.mainEligibility({teamId:node.teamId,state:current,seasonDb,freeAgentIds,freeAgentsDb,playerResolver:playerResolverForState(current)});
          if(!eligibility.eligible)throw Object.assign(new Error("Requisiti RTG non rispettati"),{code:"rtg-main-ineligible",details:eligibility});
        }
        const previousAttempt=Math.max(0,Number(current.attemptsByNode?.[node.id]?.lastAttempt)||0);
        const attemptNumber=previousAttempt+1;
        current.attemptsByNode=current.attemptsByNode||{};
        current.attemptsByNode[node.id]={...(current.attemptsByNode[node.id]||{}),lastAttempt:attemptNumber};
        const userSquad=resolvedSquad(current.squads[id(current.activeSeasonId||activeSeasonId())],current);
        const userMeta=deps.getUserTeamMeta?.()||{};
        userSquad.name=userMeta.name||userSquad.name||"La tua squadra";
        if(userMeta.teamIdentity)userSquad.teamIdentity=clone(userMeta.teamIdentity);
        const opponentSquad=node.type==="main"?mainOpponent(node):secondaryOpponent(node,current,attemptNumber);
        const seed=`${current.campaignSeed}:${node.id}:${attemptNumber}`;
        const matchId=`rtg:${node.id}:${attemptNumber}`;
        let match=matchEngine.createMatch({matchId,nodeId:node.id,matchType:node.type,attemptNumber,seed,userSquad,opponentSquad});
        match=matchEngine.prepareNext(match);
        match.presentation={...(match.presentation||{}),preMatchSeen:false};
        current.activeMatch=match;started=clone(match);return current;
      });
      return renderMatch(started||campaign.activeMatch);
    }
    function findMatchPlayer(match,side,playerId){
      const squad=side==="user"?match.userSquad:match.opponentSquad;
      return [...(squad?.lineup||[]),...(squad?.bench||[])].find(player=>id(player.cardId||player.playerId)===id(playerId))||null;
    }
    function clearMatchFlowTimer(){
      if(matchFlowTimer!=null&&typeof cancelSchedule==="function")cancelSchedule(matchFlowTimer);
      matchFlowTimer=null;
    }
    function bindMatchViewActions(){
      matchView.bind(app,{
        onOpenPlayerDetails:(playerId,side)=>openRtgPlayerDetails(playerId,side),
        onPreMatchStart:()=>confirmPreMatch(),
        onEncounterChoice:(choice,isConfirm)=>handleEncounterChoiceTap(choice,isConfirm),
        onAbandon:()=>abandonMatch(),
        onHalftimeConfirm:()=>confirmHalftime(halftimeDraft),
        onPenaltyDirection:direction=>choosePenalty({direction,useMove:false}),
        onPenaltyMove:()=>choosePenalty({direction:"center",useMove:true}),
      });
    }
    function showEncounterOverlay(match,selectedChoice=null){
      const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
      const pending=match?.pendingEncounter;
      if(!overlay||!pending)return;
      const encounterId=id(pending.encounterId);
      if(selectedEncounterId!==encounterId){
        selectedEncounterId=encounterId;
        selectedEncounterChoice=null;
      }
      if(["base","move"].includes(String(selectedChoice||"")))selectedEncounterChoice=String(selectedChoice);
      const userPlayer=findMatchPlayer(match,"user",pending.userPlayerId);
      const opponentPlayer=findMatchPlayer(match,"opponent",pending.aiPlayerId||pending.opponentPlayerId);
      overlay.innerHTML=matchView.encounterMarkup(match,{userPlayer,opponentPlayer,selectedChoice:selectedEncounterChoice});
      bindMatchViewActions();
    }
    function handleEncounterChoiceTap(choice,isConfirm=false){
      const normalized=String(choice||"");
      const pending=campaign?.activeMatch?.pendingEncounter;
      if(!pending||!["base","move"].includes(normalized))return;
      const encounterId=id(pending.encounterId);

      // Confirmation is accepted only from a button that was rendered in the
      // selected state. A stale JS selection can therefore never resolve on
      // the first visible tap of a new/updated duel.
      if(isConfirm===true&&selectedEncounterId===encounterId&&selectedEncounterChoice===normalized){
        selectedEncounterChoice=null;
        selectedEncounterId=null;
        return chooseEncounter(normalized);
      }

      selectedEncounterId=encounterId;
      selectedEncounterChoice=normalized;
      return showEncounterOverlay(campaign.activeMatch,normalized);
    }

    function renderMatch(match=campaign?.activeMatch,options={}){
      clearMatchFlowTimer();
      if(!match)return renderRun();
      if(match.presentation?.preMatchSeen===false){
        displayedMinute=0;
        renderHtml(matchView.preMatchMarkup(match));
        bindMatchViewActions();
        mountDevQuickTools();
        return match;
      }
      renderHtml(matchView.matchMarkup(match),{preserveMatchTimeline:true});
      const minute=matchView.currentMinute?.(match)??0;
      matchView.animateClock?.(app,displayedMinute,minute);
      displayedMinute=minute;
      const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
      if(match.status==="halftime"){
        halftimeDraft=clone(match.userSquad);
        if(overlay)overlay.innerHTML=matchView.halftimeMarkup(halftimeDraft,{match});
        bindHalftimeEditor(match);
      }else if(match.status==="penalties"){
        const context=penaltyContext(match);
        if(overlay)overlay.innerHTML=matchView.penaltyMarkup(match,context);
      }else if(match.pendingEncounter){
        if(options.delayEncounter&&typeof schedule==="function"){
          if(overlay)overlay.innerHTML="";
          const matchId=match.matchId,encounterId=match.pendingEncounter.encounterId;
          matchFlowTimer=schedule(()=>{
            const live=campaign?.activeMatch;
            if(live?.matchId===matchId&&live?.pendingEncounter?.encounterId===encounterId)showEncounterOverlay(live);
          },ENCOUNTER_REVEAL_DELAY_MS);
        }else showEncounterOverlay(match);
      }
      bindMatchViewActions();
      mountDevQuickTools();
      return match;
    }
    async function confirmPreMatch(){
      campaign=await repository.update("rtg-prematch-start",current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        current.activeMatch.presentation={...(current.activeMatch.presentation||{}),preMatchSeen:true};
        return current;
      });
      displayedMinute=0;
      return renderMatch(campaign.activeMatch,{delayEncounter:true});
    }
    function terminalKind(match){
      if(match.matchType==="main")return match.result?.winner==="user"?"victory":"loss";
      if(match.status==="completed-draw"||!match.result?.winner)return"draw";
      return match.result?.winner==="user"?"victory":"loss";
    }
    function applyTerminal(current,match){
      const outcome=terminalKind(match);
      let next=current;
      if(match.matchType==="main"){
        next=outcome==="victory"?progression.recordMainVictory(current,{teamId:nodeById(match.nodeId)?.teamId,matchId:match.matchId}):progression.recordMainLoss(current,{nodeId:match.nodeId});
      }else{
        next=progression.recordSecondaryResult(current,{nodeId:match.nodeId,result:outcome,attemptNumber:match.attemptNumber});
      }
      next.activeMatch=null;
      return next;
    }
    async function commitMatchState(label,mutator,renderOptions={}){
      let terminalSnapshot=null;
      campaign=await repository.update(label,current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        let match=mutator(clone(current.activeMatch));
        if(["completed","completed-draw","abandoned"].includes(match.status)){
          terminalSnapshot=clone(match);
          return applyTerminal(current,match);
        }
        current.activeMatch=match;return current;
      });
      if(terminalSnapshot)return showMatchResult(terminalSnapshot);
      return renderMatch(campaign.activeMatch,renderOptions);
    }
    async function continueEncounterFlow(){
      let terminalSnapshot=null;
      campaign=await repository.update("rtg-encounter-continue",current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        let match=clone(current.activeMatch);
        if(["completed","completed-draw"].includes(match.status)){
          terminalSnapshot=clone(match);
          return applyTerminal(current,match);
        }
        if(match.status==="active")match=matchEngine.prepareNext(match);
        if(["completed","completed-draw"].includes(match.status)){
          terminalSnapshot=clone(match);
          return applyTerminal(current,match);
        }
        current.activeMatch=match;
        return current;
      });
      selectedEncounterChoice=null;
      selectedEncounterId=null;
      if(terminalSnapshot)return showMatchResult(terminalSnapshot);
      return renderMatch(campaign.activeMatch,{delayEncounter:true});
    }
    async function chooseEncounter(choice){
      const before=clone(campaign.activeMatch?.pendingEncounter);
      const scoreBefore=clone(campaign.activeMatch?.score||{user:0,opponent:0});
      let resolvedMatch=null;
      campaign=await repository.update("rtg-encounter",current=>{
        const match=matchEngine.resolvePendingEncounter(current.activeMatch,choice);
        resolvedMatch=clone(match);
        current.activeMatch=match;
        return current;
      });
      const log=resolvedMatch?.log?.find?.(entry=>id(entry.encounterId)===id(before?.encounterId));
      if(before&&log){
        renderMatch(resolvedMatch);
        const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
        const userWon=before.userSide===before.actorSide?!!log.actorWon:!log.actorWon;
        const userProbability=before.userSide===before.actorSide?Number(log.probability):100-Number(log.probability);
        const userPlayer=findMatchPlayer(resolvedMatch,"user",before.userPlayerId);
        const aiPlayer=findMatchPlayer(resolvedMatch,"opponent",before.aiPlayerId||before.opponentPlayerId);
        const userChoiceLabel=choice==="move"?(before.userMove?.name||"Mossa"):(before.userBaseActionLabel||"Azione base");
        const aiChoiceLabel=before.aiChoice==="move"?(before.aiMove?.name||"Mossa"):null;
        const outcomeLabel=before.userKind==="shot"
          ?(userWon?"GOAL!":"Tiro fermato")
          :before.userKind==="save"
            ?(userWon?"PARATA!":"Gol subito")
            :before.userKind==="defense"
              ?(userWon?"Palla recuperata":"Avversario superato")
              :before.userKind==="dribble"
                ?(userWon?"Dribbling riuscito":"Palla persa")
                :(userWon?"Duello a centrocampo vinto":"Duello a centrocampo perso");
        const userIsActor=before.userSide===before.actorSide;
        const previewActor=userIsActor?userPlayer:aiPlayer;
        const previewOpponent=userIsActor?aiPlayer:userPlayer;
        const previewUserMove=choice==="move"?before.userMove:null;
        const previewCalc=global.RoadToGloryEncounterRuntime?.probability?.({
          actor:previewActor,
          opponent:previewOpponent,
          actorKind:before.actorKind,
          opponentKind:before.opponentKind,
          actorMove:userIsActor?previewUserMove:null,
          opponentMove:userIsActor?null:previewUserMove,
        });
        const previewActorProbability=Number(previewCalc?.probability ?? before.normalPreviewProbability ?? 50);
        const previewUserProbability=userIsActor?previewActorProbability:100-previewActorProbability;
        const presentation={
          userWon,probability:userProbability,previewProbability:previewUserProbability,outcomeLabel,userKind:before.userKind,
          userPlayerName:userPlayer?.name||before.userPlayerId,
          aiPlayerName:aiPlayer?.name||before.aiPlayerId,
          userPlayer,opponentPlayer:aiPlayer,
          opponentLabel:resolvedMatch.opponentSquad?.name||"AVVERSARIO",
          actorSide:before.actorSide,
          aiKind:before.aiKind,
          userChoiceLabel,aiChoiceLabel,
          userUsedMove:choice==="move",
          aiUsedMove:before.aiChoice==="move",
          userMovePower:choice==="move" ? (before.userMove?.power ?? null) : null,
          aiMovePower:before.aiChoice==="move" ? (before.aiMove?.power ?? null) : null,
          userMoveType:choice==="move" ? (before.userMove?.type || before.userKind || null) : null,
          aiMoveType:before.aiChoice==="move" ? (before.aiMove?.type || before.aiKind || null) : null,
          userMoveElement:choice==="move" ? (before.userMove?.element || null) : null,
          aiMoveElement:before.aiChoice==="move" ? (before.aiMove?.element || null) : null,
          scoreBefore,scoreAfter:clone(resolvedMatch.score||scoreBefore),
          goalSide:log.goalSide||null,
        };
        const revealResult=()=>{
          matchFlowTimer=null;
          const live=campaign?.activeMatch;
          if(!overlay||!live||id(live.matchId)!==id(resolvedMatch.matchId))return;
          overlay.innerHTML=matchView.resolvedEncounterMarkup(presentation);
          overlay?.querySelector?.("[data-rtg-duel-continue]")?.addEventListener("click",()=>continueEncounterFlow());
        };
        if(overlay&&typeof matchView.finalComparisonMarkup==="function"&&typeof schedule==="function"){
          overlay.innerHTML=matchView.finalComparisonMarkup(presentation);
          matchFlowTimer=schedule(revealResult,FINAL_COMPARISON_DELAY_MS);
        }else if(overlay&&typeof matchView.resolvingEncounterMarkup==="function"&&typeof schedule==="function"){
          overlay.innerHTML=matchView.resolvingEncounterMarkup(presentation);
          matchFlowTimer=schedule(revealResult,DUEL_RESULT_REVEAL_DELAY_MS);
        }else revealResult();
        return resolvedMatch;
      }
      return continueEncounterFlow();
    }

    function bindHalftimeEditor(match,selectedPlayerId=null){
      const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
      const repaint=(nextSelected=null)=>{
        if(overlay)overlay.innerHTML=matchView.halftimeMarkup(halftimeDraft,{selectedPlayerId:nextSelected,match});
        bindHalftimeEditor(match,nextSelected);
      };
      overlay?.querySelectorAll?.("[data-rtg-half-lineup]")?.forEach(button=>button.addEventListener("click",()=>{
        const playerId=id(button.dataset.rtgHalfLineup);
        repaint(selectedPlayerId===playerId?null:playerId);
      }));
      overlay?.querySelectorAll?.("[data-rtg-half-bench]")?.forEach(button=>button.addEventListener("click",()=>{
        if(!selectedPlayerId)return;
        const benchId=id(button.dataset.rtgHalfBench);
        const firstIndex=halftimeDraft.lineup.findIndex(player=>id(player.cardId||player.playerId)===id(selectedPlayerId));
        const secondIndex=halftimeDraft.bench.findIndex(player=>id(player.cardId||player.playerId)===benchId);
        const first=halftimeDraft.lineup[firstIndex],second=halftimeDraft.bench[secondIndex];
        const firstRole=String(first?.normalizedRole||first?.position||"").toUpperCase();
        const secondRole=String(second?.normalizedRole||second?.position||"").toUpperCase();
        if(firstIndex<0||secondIndex<0||!firstRole||firstRole!==secondRole){
          deps.toast?.("Cambio consentito solo ruolo per ruolo","error");
          return repaint(null);
        }
        halftimeDraft.lineup[firstIndex]=second;
        halftimeDraft.bench[secondIndex]=first;
        repaint(null);
      }));
      overlay?.querySelector?.("[data-rtg-half-confirm]")?.addEventListener("click",()=>confirmHalftime(halftimeDraft));
    }
    async function confirmHalftime(nextSquad){
      return commitMatchState("rtg-halftime",match=>matchEngine.confirmHalftime(match,nextSquad,{validateHalftime:(candidate)=>{
        const ids=candidate.lineup.map(player=>id(player.cardId||player.playerId)),benchIds=candidate.bench.map(player=>id(player.cardId||player.playerId));
        const candidateState=clone(campaign);candidateState.squads[activeSeasonId()]={formationId:candidate.formationId,lineup:ids,bench:benchIds,activeRoleVariantByCardId:{...(candidate.activeRoleVariantByCardId||{})}};
        if(match.matchType==="secondary"){
          const validation=squadRuntime.validateSquad({state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver:playerResolverForState(candidateState)});
          return {eligible:validation.valid,reasons:validation.reasons||[]};
        }
        return squadRuntime.mainEligibility({teamId:nodeById(match.nodeId)?.teamId,state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver:playerResolverForState(candidateState)});
      }}),{delayEncounter:true});
    }
    function penaltyContext(match){
      const history=match.shootout?.history||[];
      const attackingSide=history.length%2===0?"user":"opponent";
      const defendingSide=attackingSide==="user"?"opponent":"user";
      const attackers=(attackingSide==="user"?match.userSquad:match.opponentSquad).lineup.filter(player=>String(player.normalizedRole||player.position)!=="GK");
      const shooter=attackers[(match.shootout?.kicks?.[attackingSide]||0)%Math.max(1,attackers.length)]||attackers[0];
      const keeper=(defendingSide==="user"?match.userSquad:match.opponentSquad).lineup.find(player=>String(player.normalizedRole||player.position)==="GK");
      const userPlayer=attackingSide==="user"?shooter:keeper;
      const userKind=attackingSide==="user"?"shot":"save";
      const userMove=userPlayer?.move&&String(userPlayer.move.type)===userKind?userPlayer.move:null;
      const userKey=`user:${id(userPlayer?.cardId||userPlayer?.playerId)}`;
      const userMoveUses=Number(match.moveUsesByPlayerId?.[userKey]||0);
      return {attackingSide,defendingSide,shooter,keeper,userRole:userKind,userMove,userMoveUses,userMoveAvailable:!!userMove&&userMoveUses>0};
    }
    function previousUserDirections(match){
      return (match.shootout?.history||[]).map(item=>({userDirection:item.attackingSide==="user"?item.shooterChoice:item.goalkeeperChoice})).filter(item=>item.userDirection);
    }
    async function choosePenalty({direction,useMove}={}){
      return commitMatchState("rtg-penalty",match=>{
        const ctx=penaltyContext(match);
        const kickIndex=match.shootout?.history?.length||0;
        const aiDirection=penaltyRuntime.aiDirection(previousUserDirections(match),`${match.seed}:penalty-ai`,kickIndex);
        const aiPlayer=ctx.attackingSide==="user"?ctx.keeper:ctx.shooter;
        const aiKind=ctx.attackingSide==="user"?"save":"shot";
        const aiMove=aiPlayer?.move&&String(aiPlayer.move.type)===aiKind?aiPlayer.move:null;
        const aiSide=ctx.attackingSide==="user"?"opponent":"opponent";
        const aiKey=`${aiSide}:${id(aiPlayer?.cardId||aiPlayer?.playerId)}`;
        const aiUses=Number(match.moveUsesByPlayerId?.[aiKey]||0);
        const aiChoice=aiPolicy.chooseMove({minute:120,score:{ai:match.shootout?.score?.opponent||0,user:match.shootout?.score?.user||0},encounterKind:aiKind,baseProbabilityForAi:50,remainingUses:aiUses,hasCompatibleMove:!!aiMove&&aiUses>0},rng.float(match.seed,"penalty-ai-move",kickIndex));
        const userMove=useMove?ctx.userMove:null;
        const shooterMove=ctx.attackingSide==="user"?userMove:(aiChoice==="move"?aiMove:null);
        const goalkeeperMove=ctx.attackingSide==="user"?(aiChoice==="move"?aiMove:null):userMove;
        const result=matchEngine.resolvePenaltyKick(match,{
          attackingSide:ctx.attackingSide,
          shooterPlayerId:id(ctx.shooter?.cardId||ctx.shooter?.playerId),goalkeeperPlayerId:id(ctx.keeper?.cardId||ctx.keeper?.playerId),
          shooterChoice:ctx.attackingSide==="user"?direction:aiDirection,
          goalkeeperChoice:ctx.attackingSide==="user"?aiDirection:direction,
          shooterMove,goalkeeperMove,
          encounterContext:{actor:ctx.shooter,opponent:ctx.keeper},
        });
        return result.state;
      });
    }
    async function abandonMatch(){return commitMatchState("rtg-abandon",match=>matchEngine.abandon(match));}
    function showMatchResult(match){
      renderRun();
      deps.openModal?.(matchView.resultMarkup(match),{className:"rtg-modal rtg-result-modal",closeable:false});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click",()=>{deps.closeModal?.();renderRun();});
      return match;
    }
    let vendingRuntime=null;
    function getVendingRuntime(){
      if(!vendingRuntime)vendingRuntime=global.RoadToGloryVendingController.create({
        getCampaign:()=>campaign,getSeasonDb:()=>seasonDb,activeSeasonId,activeConfig,
        gacha,accessibleCards,runView,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
        closeModal:deps.closeModal,renderAlbum,pull,id,openPlayerDetails:openRtgPlayerDetails,
      });
      return vendingRuntime;
    }
    function openVending(mode="team"){return getVendingRuntime().openVending(mode);}
    function showPullResult(result,player,mode="team"){return getVendingRuntime().showPullResult(result,player,mode);}

    async function pull(options={}){
      let result=null;const mode=options?.mode==="recruitment"?"recruitment":"team";
      campaign=await repository.update("rtg-gacha-pull",current=>{
        const pulled=gacha.pull(current,{seasonDb,accessibleCardIds:accessibleCards(current),mode});
        result=pulled.result;return pulled.state;
      });
      if(!result)return campaign;
      rememberRtgAlbumCard(result.cardId||result.playerId);
      const player=playerResolver.resolveAtLevel20(result.cardId,campaign?.activeSeasonId||"ie1",null,freeAgentsDb)||{playerId:result.playerId,cardId:result.cardId,legacySeasonId:result.legacySeasonId,name:result.playerId};
      if(options?.reveal===false)return {result,player};
      showPullResult(result,player);
      return result;
    }
    function renderCampaignSelect(){
      renderHtml(runView.campaignSelectorMarkup());
      app?.querySelector?.("[data-rtg-campaign-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
      app?.querySelectorAll?.("[data-rtg-campaign]")?.forEach(button=>button.addEventListener("click",async()=>{
        const campaignId=id(button.dataset.rtgCampaign);
        repository.selectCampaign?.(campaignId);
        campaign=null;seasonDb=null;rawPlayerById=new Map();squadSlotRuntime=null;albumController=null;vendingRuntime=null;
        await open({destination:"run"});
      }));
      return {selector:true};
    }
    async function open(options={}){
      deps.closeModal?.({invokeOnClose:false});
      if(options?.destination==="campaigns")return renderCampaignSelect();
      if(options?.campaignId)repository.selectCampaign?.(options.campaignId);
      await ensureData();
      const access=refreshEntitlements();
      if(!access.unlocked){
        renderHtml(runView.lockedMarkup(access));
        app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
        return {locked:true,access};
      }
      campaign=await repository.ensureCampaign();
      progression?.setSeasonContext?.(campaign);
      if(activeSeasonId()==="ie2"){
        try{await ensureAresRouteMap();}
        catch(error){global.console?.error?.("[RTG] Impossibile caricare lo sfondo Ares",error);}
      }
      if(activeSeasonId()!=="ie1"){
        seasonDb=await global.SeasonRegistry?.loadDatabase?.(activeSeasonId());
        rawPlayerById=new Map();
        for(const player of seasonDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
        for(const profile of seasonDb?.profiles||[])rawPlayerById.set(id(profile.profileId||profile.id),profile);
      }
      await ensureInitialSquad();
      activeSquadSlot=readActiveSquadSlot();
      const existingSlots=readSquadSlots();
      if(!existingSlots["1"])storeSquadSlot(1,activeSquad(campaign));
      squadDraft=squadForSlot(activeSquadSlot);
      if(campaign.activeMatch){
        const status=campaign.activeMatch.status;
        if(["completed","completed-draw","abandoned"].includes(status)){
          let snapshot=clone(campaign.activeMatch);
          campaign=await repository.update("rtg-resume-terminal",current=>applyTerminal(current,current.activeMatch));
          return showMatchResult(snapshot);
        }
        return renderMatch(campaign.activeMatch);
      }
      const destination=String(options?.destination||"run");
      if(destination==="squad")return renderSquad();
      if(destination==="catalog"){
        renderSquad();
        openRtgCatalog();
        return campaign;
      }
      if(destination==="vending"){
        renderRun();
        openVending();
        return campaign;
      }
      if(destination==="album")return renderAlbum();
      if(destination==="shop")return renderShop();
      if(destination==="development")return renderDevelopment("players");
      return renderRun();
    }

    return Object.freeze({
      open,renderRun,renderSquad,renderAlbum,renderAlbumRoster,renderShop,renderDevelopment,openNode,startMatch,confirmPreMatch,chooseEncounter,continueEncounterFlow,confirmHalftime,choosePenalty,abandonMatch,openVending,pull,saveSquad,openRtgPlayerDetails,openRtgCatalog,
      swapSquadDraft,canUseDraftFormation,arrangeDraftForFormation,openSquadPlayerPicker,adaptSquadToCurrentRequirements,
      getDraftSquad:()=>clone(squadDraft),getState:()=>clone(campaign),getRenderedHtml,
    });
  }

  global.RoadToGloryController=Object.freeze({create});
})(globalThis);
