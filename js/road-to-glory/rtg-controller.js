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
    let selectedEncounterChoice=null;
    let selectedEncounterId=null;
    let selectedAlbumSeasonId="ie1";
    let selectedDevelopmentCardId=null;
    let developmentQuery="";
    let developmentRarity="Tutti";
    const SQUAD_PICKER_PAGE_SIZE=24;
    const ENCOUNTER_REVEAL_DELAY_MS=2200;
    const FINAL_COMPARISON_DELAY_MS=1700;
    const DUEL_RESULT_REVEAL_DELAY_MS=1150;
    const schedule=deps.setTimeout||global.setTimeout;
    const cancelSchedule=deps.clearTimeout||global.clearTimeout;
    const DEV_MODE=deps.devMode===true||(typeof global.URLSearchParams==="function"&&new global.URLSearchParams(global.location?.search||"").get("dev")==="1");
    const RTG_ALBUM_STORAGE_KEY="inazuma.rtg.album.v1";
    const RTG_SQUAD_SLOTS_KEY="inazuma.rtg.squad-slots.v2";
    const RTG_LEGACY_SQUAD_SLOTS_KEY="inazuma.rtg.squad-slots.v1";
    let activeSquadSlot=1;
    const RTG_ACTIVE_SQUAD_SLOT_KEY="inazuma.rtg.active-squad-slot.v1";
    function squadSlotsKey(seasonId=activeSeasonId()){return `${RTG_SQUAD_SLOTS_KEY}.${id(seasonId||"ie1")}`;}
    function readSquadSlots(seasonId=activeSeasonId()){
      try{
        const sid=id(seasonId||"ie1"),key=squadSlotsKey(sid),raw=global.localStorage?.getItem?.(key);
        if(raw){const parsed=JSON.parse(raw);return parsed&&typeof parsed==="object"?parsed:{};}
        // One-time compatibility bridge: old previews stored all three S1 slots
        // in the unsuffixed v1 key. Import them only into S1; never into S2.
        if(sid==="ie1"){
          const legacyRaw=global.localStorage?.getItem?.(RTG_LEGACY_SQUAD_SLOTS_KEY);
          if(legacyRaw){
            const legacy=JSON.parse(legacyRaw);
            if(legacy&&typeof legacy==="object"){
              global.localStorage?.setItem?.(key,JSON.stringify(legacy));
              return legacy;
            }
          }
        }
        return{};
      }catch(_e){return{}}
    }
    function writeSquadSlots(slots,seasonId=activeSeasonId()){try{global.localStorage?.setItem?.(squadSlotsKey(seasonId),JSON.stringify(slots||{}));}catch(_e){}}
    function storeSquadSlot(slot,squad){const slots=readSquadSlots();slots[String(slot)]=clone(squad);writeSquadSlots(slots);}
    function readActiveSquadSlot(){try{return Math.max(1,Math.min(3,Number(global.localStorage?.getItem?.(RTG_ACTIVE_SQUAD_SLOT_KEY))||1));}catch(_e){return 1}}
    function writeActiveSquadSlot(slot){try{global.localStorage?.setItem?.(RTG_ACTIVE_SQUAD_SLOT_KEY,String(slot));}catch(_e){}}
    function squadForSlot(slot){
      const slots=readSquadSlots();
      const saved=slots?.[String(slot)];
      if(saved)return clone(saved);
      /* Only slot 1 inherits the legacy campaign squad. New slots must start as
         independent snapshots, never aliases of whatever squad is currently official. */
      if(Number(slot)===1)return clone(activeSquad(campaign)||squadDraft);
      return clone(slots?.["1"]||activeSquad(campaign)||squadDraft);
    }
    async function selectSquadSlot(slot){
      const next=Math.max(1,Math.min(3,Number(slot)||1));
      if(next===activeSquadSlot)return;
      storeSquadSlot(activeSquadSlot,squadDraft||activeSquad(campaign));
      activeSquadSlot=next;
      writeActiveSquadSlot(next);
      squadDraft=squadForSlot(next);
      return renderSquad();
    }

    function readRtgAlbum(){
      try{
        const raw=global.localStorage?.getItem?.(RTG_ALBUM_STORAGE_KEY);
        const parsed=raw?JSON.parse(raw):{};
        return {cardIds:Array.from(new Set(Array.isArray(parsed?.cardIds)?parsed.cardIds.map(id).filter(Boolean):[]))};
      }catch(_error){return {cardIds:[]};}
    }
    function writeRtgAlbum(cardIds){
      const normalized=Array.from(new Set(Array.from(cardIds||[]).map(id).filter(Boolean)));
      try{global.localStorage?.setItem?.(RTG_ALBUM_STORAGE_KEY,JSON.stringify({version:1,cardIds:normalized}));}catch(_error){}
      return normalized;
    }
    function rememberRtgAlbumCard(cardRef){
      const cardId=cardMeta(cardRef).cardId;
      if(!cardId)return readRtgAlbum().cardIds;
      return writeRtgAlbum([...readRtgAlbum().cardIds,cardId]);
    }
    function syncCurrentPullsIntoAlbum(){
      const current=Array.from(acquiredCardIdSet(campaign));
      if(!current.length)return readRtgAlbum().cardIds;
      return writeRtgAlbum([...readRtgAlbum().cardIds,...current]);
    }

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
      }else{
        deps.resetRenderedViewScroll?.();
      }
      return lastRenderedHtml;
    }
    function getRenderedHtml(){return app?.innerHTML||lastRenderedHtml;}

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
        const previousSeasonButton=!active&&activeSeasonId()==="ie1_s2"
          ? '<button type="button" data-dev-rtg="previous-season">TORNA ALLA SEASON 1</button>'
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
          if(activeSeasonId()!=="ie1_s2")return;
          const previousDb=global.SeasonRegistry?.database?.("ie1")||await global.SeasonRegistry?.loadDatabase?.("ie1");
          const previousNodes=Array.from(config.buildSeasonNodes?.("ie1")||[]);
          campaign=await repository.update("rtg-dev-return-season1",state=>{
            state.activeSeasonId="ie1";
            state.currentNodeId=previousNodes.at(-1)?.id||"main:raimon";
            state.furthestNodeIndex=Math.max(0,previousNodes.length-1);
            state.seasonComplete=true;
            state.defeatedTeamIds=Array.from(config.SEASON1?.mainTeams||[]);
            state.lives=Number(config.SEASON1?.livesPerCheckpoint)||2;
            state.activeMatch=null;
            return state;
          });
          seasonDb=previousDb;
          selectedAlbumSeasonId="ie1";
          initSquadDraft();
          deps.toast?.("DEV: ritorno alla Season 1");
          renderRun();
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
    function resolvedSquad(snapshot){
      const variants=snapshot?.activeRoleVariantByCardId||{};
      return {
        formationId:snapshot?.formationId||null,
        lineup:(snapshot?.lineup||[]).map(cardId=>resolved(cardId,variants[cardId]||null)).filter(Boolean),
        bench:(snapshot?.bench||[]).map(cardId=>resolved(cardId,variants[cardId]||null)).filter(Boolean),
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
      app?.querySelectorAll?.("[data-rtg-enter-season2]")?.forEach(button=>button.addEventListener("click",()=>enterSeason2()));
      mountDevQuickTools();
      return campaign;
    }
    async function enterSeason2(){
      if(activeSeasonId()!=="ie1"||!campaign?.seasonComplete)return campaign;
      const nextDb=await global.SeasonRegistry?.loadDatabase?.("ie1_s2");
      if(!nextDb)throw new Error("Database Season 2 non disponibile");
      campaign=await repository.update("rtg-enter-season2",current=>{
        if(id(current.activeSeasonId)!=="ie1"||!current.seasonComplete)return current;
        const previous=clone(current.squads?.ie1||{formationId:null,lineup:[],bench:[],activeRoleVariantByCardId:{}});
        current.activeSeasonId="ie1_s2";
        current.seasonComplete=false;
        current.lives=Number(config.SEASON2?.livesPerCheckpoint)||2;
        current.checkpointMainIndex=-1;
        current.currentNodeId="main:secret_service";
        current.furthestNodeIndex=0;
        current.defeatedTeamIds=[];
        current.firstClearMatchIds=[];
        current.attemptsByNode={};
        current.activeMatch=null;
        current.squads=current.squads||{};
        current.squads.ie1_s2=current.squads.ie1_s2?.lineup?.length?current.squads.ie1_s2:previous;
        return current;
      });
      seasonDb=nextDb; rawPlayerById=new Map();
      for(const player of seasonDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
      for(const profile of seasonDb?.profiles||[])rawPlayerById.set(id(profile.profileId||profile.id),profile);
      progression?.setSeasonContext?.(campaign);
      // Seed the three S2 slots once from the squad carried over from S1.
      // Afterwards every slot is an independent S2 snapshot.
      const season2Slots=readSquadSlots("ie1_s2");
      if(!season2Slots["1"]){
        const carried=clone(activeSquad(campaign));
        writeSquadSlots({"1":carried,"2":clone(carried),"3":clone(carried)},"ie1_s2");
      }
      activeSquadSlot=1;
      writeActiveSquadSlot(1);
      squadDraft=squadForSlot(1);
      return renderRun();
    }
    function rtgAlbumEntries(){
      syncCurrentPullsIntoAlbum();
      return readRtgAlbum().cardIds.map(cardId=>playerResolver.resolveAtLevel20(cardId,campaign?.activeSeasonId||"ie1",null,freeAgentsDb)).filter(Boolean);
    }
    function rtgAlbumUnlockedSet(){
      return new Set(readRtgAlbum().cardIds.map(id));
    }
    async function ensureAlbumSeasonDb(seasonId){
      const sid=id(seasonId||"ie1");
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
      const sid=id(seasonId||"ie1");
      return config?.season?.(sid)||(sid==="ie1_s2"?config.SEASON2:config.SEASON1);
    }
    function rtgAlbumTeams(seasonId=selectedAlbumSeasonId,albumDb=null){
      const sid=id(seasonId||"ie1");
      const db=albumDb||global.SeasonRegistry?.database?.(sid)||(sid===activeSeasonId()?seasonDb:null);
      const unlocked=rtgAlbumUnlockedSet();
      const configured=Array.from(albumConfigFor(sid)?.mainTeams||[]);
      return configured.map(teamId=>{
        const team=(db?.teams||[]).find(entry=>id(entry?.teamId||entry?.id)===id(teamId));
        if(!team)return null;
        const playerIds=Array.from(team?.playerIds||[]).map(id).filter(Boolean);
        const profileIds=db?.requiresProfileAwareRuntime
          ? Array.from(db?.profiles||[]).filter(profile=>id(profile?.teamId)===id(teamId)).map(profile=>id(profile?.profileId||profile?.id)).filter(Boolean)
          : [];
        const sourceIds=profileIds.length?profileIds:playerIds;
        const cardIds=sourceIds.map(playerId=>db?.requiresProfileAwareRuntime
          ? (cardIdentity?.cardIdForProfile?.(playerId,sid)||playerId)
          : (cardIdentity?.cardIdForSeason?.(playerId,sid)||playerId));
        return {seasonId:sid,teamId:id(teamId),teamName:team?.teamName||team?.name||teamId,logoUrl:team?.logoUrl||"",playerIds,profileIds,cardIds,total:cardIds.length,unlocked:cardIds.filter(cardId=>unlocked.has(cardId)).length};
      }).filter(team=>team&&team.total>0);
    }
    function rtgAlbumTeamPlayers(team,seasonId=selectedAlbumSeasonId){
      const sid=id(seasonId||team?.seasonId||"ie1");
      return Array.from(team?.cardIds||[]).map(cardId=>playerResolver.resolveAtLevel20(cardId,sid,null,freeAgentsDb)).filter(Boolean);
    }
    async function albumCollectionSummary(seasonId){
      const sid=id(seasonId||"ie1");
      const db=await ensureAlbumSeasonDb(sid);
      const teams=rtgAlbumTeams(sid,db);
      return {
        seasonId:sid,
        unlocked:teams.reduce((sum,team)=>sum+(Number(team.unlocked)||0),0),
        total:teams.reduce((sum,team)=>sum+(Number(team.total)||0),0),
      };
    }
    async function renderAlbum(){
      await ensureData();
      syncCurrentPullsIntoAlbum();
      const collections=await Promise.all(["ie1","ie1_s2"].map(albumCollectionSummary));
      renderHtml(runView.albumCollectionMarkup({state:campaign,collections}));
      app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
      app?.querySelectorAll?.("[data-rtg-album-collection]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumTeams(button.dataset.rtgAlbumCollection)));
      mountDevQuickTools();
      return campaign;
    }
    async function renderAlbumTeams(seasonId=selectedAlbumSeasonId){
      await ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=["ie1","ie1_s2"].includes(id(seasonId))?id(seasonId):activeSeasonId();
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      renderHtml(runView.albumTeamsMarkup({state:{...(campaign||{}),activeSeasonId:sid},seasonId:sid,teams:rtgAlbumTeams(sid,db)}));
      app?.querySelector?.("[data-rtg-album-collection-back]")?.addEventListener("click",()=>renderAlbum());
      app?.querySelectorAll?.("[data-rtg-album-team]")?.forEach(button=>button.addEventListener("click",()=>renderAlbumRoster(button.dataset.rtgAlbumTeam,sid)));
      mountDevQuickTools();
      return campaign;
    }
    async function renderAlbumRoster(teamId,seasonId=selectedAlbumSeasonId){
      await ensureData();
      syncCurrentPullsIntoAlbum();
      const sid=["ie1","ie1_s2"].includes(id(seasonId))?id(seasonId):selectedAlbumSeasonId;
      selectedAlbumSeasonId=sid;
      const db=await ensureAlbumSeasonDb(sid);
      const team=rtgAlbumTeams(sid,db).find(entry=>id(entry.teamId)===id(teamId));
      if(!team)return renderAlbumTeams(sid);
      const unlocked=rtgAlbumUnlockedSet();
      const allEntries=rtgAlbumTeamPlayers(team,sid);
      const entries=allEntries.filter(player=>unlocked.has(id(player?.cardId||player?.playerId||player?.id)));
      renderHtml(runView.albumRosterMarkup({state:{...(campaign||{}),activeSeasonId:sid},seasonId:sid,team,entries,allEntries,database:db}));
      app?.querySelector?.("[data-rtg-album-back]")?.addEventListener("click",()=>renderAlbumTeams(sid));
      const albumRoster=app?.querySelector?.("[data-rtg-album-roster]");
      albumRoster?.addEventListener("click",event=>{
        const origin=typeof event.target?.closest==="function"?event.target:event.target?.parentElement;
        const entry=origin?.closest?.("[data-rtg-album-player-entry]");
        const cardButton=origin?.closest?.("[data-rtg-album-player-card]");
        if(!entry&&!cardButton)return;
        const wrapper=entry||cardButton?.closest?.("[data-rtg-album-player-entry]");
        const cardId=id(wrapper?.dataset?.rtgAlbumPlayerEntry);
        if(!cardId)return;
        event.preventDefault?.();
        openRtgPlayerDetails(cardId,"",{mode:"album",albumUnlocked:unlocked.has(cardId)});
      });
      mountDevQuickTools();
      return campaign;
    }

    function draftState(){
      const state=clone(campaign);
      state.squads[activeSeasonId()]=clone(squadDraft||activeSquad(campaign));
      return state;
    }
    function draftRosterIds(){
      return Array.from(new Set([...(squadDraft?.lineup||[]),...(squadDraft?.bench||[])].map(id)));
    }
    function roleOfDraftPlayer(playerId){
      const variant=squadDraft?.activeRoleVariantByCardId?.[id(playerId)]||null;
      const player=resolved(playerId,variant);
      return String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
    }
    function accessibleDraftIds(){
      return accessibleCards(draftState()).map(id);
    }
    function canUseDraftFormation(formation){
      if(!formation)return false;
      const counts={GK:0,DF:0,MF:0,FW:0};
      for(const playerId of accessibleDraftIds()){
        const role=rawRole(playerId);
        if(Object.prototype.hasOwnProperty.call(counts,role))counts[role]+=1;
      }
      return Object.entries(formation.requirements||{}).every(([role,amount])=>Number(counts[String(role).toUpperCase()]||0)>=Number(amount||0));
    }
    function arrangeDraftForFormation(formation){
      if(!formation||!canUseDraftFormation(formation))return{ok:false,reason:"formation-incompatible"};
      const currentLineup=new Set((squadDraft?.lineup||[]).map(id));
      const currentBench=new Set((squadDraft?.bench||[]).map(id));
      const accessible=accessibleDraftIds().map(playerId=>({
        playerId,
        role:rawRole(playerId),
        overall:rawOverall(playerId),
        priority:currentLineup.has(playerId)?0:currentBench.has(playerId)?1:2,
      })).filter(entry=>["GK","DF","MF","FW"].includes(entry.role));
      accessible.sort((a,b)=>a.priority-b.priority||b.overall-a.overall||rawName(a.playerId).localeCompare(rawName(b.playerId),"it"));
      const slotRoles=Array.isArray(formation.slotRoles)&&formation.slotRoles.length
        ? formation.slotRoles.map(role=>String(role).toUpperCase())
        : Object.entries(formation.requirements||{}).flatMap(([role,amount])=>Array.from({length:Number(amount)||0},()=>String(role).toUpperCase()));
      const used=new Set(),lineup=[];
      for(const role of slotRoles){
        const candidate=accessible.find(entry=>entry.role===role&&!used.has(entry.playerId));
        if(!candidate)return{ok:false,reason:"formation-incompatible"};
        used.add(candidate.playerId);lineup.push(candidate.playerId);
      }
      if(lineup.length!==11)return{ok:false,reason:"formation-invalid-slots"};
      const remaining=accessible.filter(entry=>!used.has(entry.playerId)).sort((a,b)=>{
        const preserveA=currentLineup.has(a.playerId)||currentBench.has(a.playerId)?0:1;
        const preserveB=currentLineup.has(b.playerId)||currentBench.has(b.playerId)?0:1;
        return preserveA-preserveB||b.overall-a.overall||rawName(a.playerId).localeCompare(rawName(b.playerId),"it");
      });
      const bench=remaining.slice(0,4).map(entry=>entry.playerId);
      if(bench.length!==4)return{ok:false,reason:"bench-unavailable"};
      squadDraft={...squadDraft,formationId:id(formation.id),lineup,bench,activeRoleVariantByCardId:{...(squadDraft?.activeRoleVariantByCardId||{})}};
      return{ok:true};
    }
    function openFormationSelector(model){
      const body=`<div class="modal-head squad-formation-modal-head"><div><p class="eyebrow">Assetto tattico RTG</p><h2>Modifica modulo</h2><p class="muted">Scegli il modulo. I giocatori già in rosa hanno la precedenza; i posti mancanti vengono coperti dalla tua collezione.</p></div></div>${squadView.formationOptionsMarkup(model,canUseDraftFormation)}`;
      deps.openModal?.(body,{className:"squad-formation-modal rtg-formation-modal"});
      deps.getModalRoot?.()?.querySelectorAll?.("[data-rtg-formation-option]")?.forEach(button=>button.addEventListener("click",()=>{
        if(button.disabled)return;
        const formation=(model.formations||[]).find(item=>id(item.id)===id(button.dataset.rtgFormationOption));
        const result=arrangeDraftForFormation(formation);
        if(!result.ok){deps.toast?.("Non ci sono abbastanza giocatori sbloccati nei ruoli richiesti","error");return;}
        deps.closeModal?.();
        renderSquad();
      }));
    }
    function squadPickerCandidateIds(targetId,role,{benchTarget=false}={}){
      const accessible=accessibleCards(draftState()).map(id);
      const rosterIds=new Set(draftRosterIds());
      return accessible
        .filter(playerId=>playerId!==id(targetId))
        .filter(playerId=>!benchTarget||!rosterIds.has(playerId))
        .filter(playerId=>!role||rawRole(playerId)===role)
        .sort((a,b)=>rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
    }
    function squadPickerRarity(playerId){
      return String(
        playerResolver.rarity?.(playerId,"ie1",freeAgentsDb)
        || rawPlayer(playerId)?.category
        || resolved(playerId,squadDraft?.activeRoleVariantByCardId?.[id(playerId)]||null)?.category
        || ""
      ).trim();
    }
    function squadPickerRarityOptions(){
      return ["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"];
    }

    function openSquadPlayerPicker(targetId){
      const targetLoc=locationInDraft(targetId);
      if(!targetLoc)return;
      const strictRole=targetLoc.area==="lineup";
      const role=strictRole?roleOfDraftPlayer(targetId):"";
      if(strictRole&&!role)return deps.toast?.("Ruolo giocatore non disponibile","error");
      const quickEntries=strictRole
        ? (squadDraft?.bench||[]).map(id).filter(playerId=>roleOfDraftPlayer(playerId)===role).map(playerId=>({
            playerId,
            source:sourceForDraftPlayer(playerId),
            player:resolved(playerId,squadDraft?.activeRoleVariantByCardId?.[playerId]||null),
          })).filter(entry=>entry.player)
        : [];
      const quickIds=new Set(quickEntries.map(entry=>id(entry.playerId)));
      // The full picker keeps one lightweight representative per canonical player.
      // Other S1/S2 versions are resolved/rendered only when that grouped card is opened.
      let candidateGroups=[];
      let visibleCount=0;
      let query="";
      let sourceFilter="all";
      let rarityFilter="all";
      let overallDescending=true;
      const rarityOptions=squadPickerRarityOptions();
      const targetPlayer=resolved(targetId,squadDraft?.activeRoleVariantByCardId?.[id(targetId)]||null);
      const target={playerId:id(targetId),source:sourceForDraftPlayer(targetId),player:targetPlayer};
      const buildGroups=(cardIds)=>Array.from(groupVersionCards(cardIds).entries()).map(([key,cardIds])=>({
        key,
        cardIds,
        representativeId:preferredVersionCardId(cardIds),
      })).filter(group=>group.representativeId);
      const filteredGroups=()=>candidateGroups.filter(group=>{
        const playerId=group.representativeId;
        const source=sourceForDraftPlayer(playerId);
        if(sourceFilter==="free"&&source!=="Svincolato")return false;
        if(sourceFilter==="rtg"&&source!=="RTG")return false;
        if(rarityFilter!=="all"&&!group.cardIds.some(cardId=>squadPickerRarity(cardId).toLocaleLowerCase("it")===rarityFilter.toLocaleLowerCase("it")))return false;
        const needle=query.trim().toLocaleLowerCase("it");
        if(needle&&!rawName(playerId).toLocaleLowerCase("it").includes(needle))return false;
        return true;
      }).sort((a,b)=>{
        const delta=rawOverall(b.representativeId)-rawOverall(a.representativeId);
        return (overallDescending?delta:-delta)||rawName(a.representativeId).localeCompare(rawName(b.representativeId),"it");
      });
      const entries=()=>{
        const groups=filteredGroups();
        return groups.slice(0,visibleCount).map(group=>({
          cardId:group.representativeId,
          playerId:group.representativeId,
          source:sourceForDraftPlayer(group.representativeId),
          versionCount:group.cardIds.length,
          player:resolved(group.representativeId,squadDraft?.activeRoleVariantByCardId?.[group.representativeId]||null),
        })).filter(entry=>entry.player);
      };
      const chooseCandidate=(candidateId)=>{
        const result=swapSquadDraft(targetId,candidateId,{render:false});
        if(!result.ok)return deps.toast?.("Cambio non disponibile","error");
        deps.closeModal?.();
        renderSquad();
        return result;
      };
      const renderResults=()=>{
        const modal=deps.getModalRoot?.();
        const groups=filteredGroups();
        const results=modal?.querySelector?.("[data-rtg-picker-results]");
        if(results)results.innerHTML=squadView.replacementPickerResultsMarkup({entries:entries(),total:groups.length,visibleCount});
        modal?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(button=>button.classList.toggle("active",button.dataset.rtgPickerSource===sourceFilter));
        bindResults();
      };
      const bindResults=()=>{
        const modal=deps.getModalRoot?.();
        modal?.querySelectorAll?.("[data-rtg-picker-player]")?.forEach(button=>button.addEventListener("click",()=>{
          const representativeId=id(button.dataset.rtgPickerPlayer);
          if(!representativeId)return;
          const group=candidateGroups.find(entry=>entry.key===versionGroupKey(representativeId));
          const versions=group?.cardIds||[representativeId];
          if(versions.length>1){
            openRtgVersionPicker(versions,{onSelect:chooseCandidate});
            return;
          }
          chooseCandidate(representativeId);
        }));
        modal?.querySelector?.("[data-rtg-picker-load-more]")?.addEventListener("click",()=>{
          visibleCount=Math.min(filteredGroups().length,visibleCount+SQUAD_PICKER_PAGE_SIZE);
          renderResults();
        });
      };
      if(!deps.getModalRoot){
        const candidateIds=squadPickerCandidateIds(targetId,role,{benchTarget:!strictRole}).filter(playerId=>!quickIds.has(id(playerId)));
        candidateGroups=buildGroups(candidateIds);
        visibleCount=Math.min(SQUAD_PICKER_PAGE_SIZE,candidateGroups.length);
      }
      deps.openModal?.(squadView.replacementPickerMarkup({target,role,allowAnyRole:!strictRole,quickEntries,entries:deps.getModalRoot?[]:entries(),total:deps.getModalRoot?0:candidateGroups.length,visibleCount:deps.getModalRoot?0:visibleCount,query,sourceFilter,rarityFilter,rarityOptions}),{className:"rtg-modal rtg-squad-picker-modal"});
      const modal=deps.getModalRoot?.();
      modal?.querySelector?.("[data-rtg-picker-search]")?.addEventListener("input",event=>{
        query=String(event.target?.value||"");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(button=>button.addEventListener("click",()=>{
        sourceFilter=String(button.dataset.rtgPickerSource||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      }));
      modal?.querySelector?.("[data-rtg-picker-rarity]")?.addEventListener("change",event=>{
        rarityFilter=String(event.target?.value||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelector?.("[data-rtg-picker-sort]")?.addEventListener("click",event=>{
        overallDescending=!overallDescending;
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        const button=event.currentTarget;
        button.textContent=overallDescending?"OVR ↓":"OVR ↑";
        button.setAttribute("aria-label",overallDescending?"Ordina per overall decrescente":"Ordina per overall crescente");
        button.setAttribute("aria-pressed",overallDescending?"true":"false");
        renderResults();
      });
      bindResults();
      const hydratePicker=()=>{
        const candidateIds=squadPickerCandidateIds(targetId,role,{benchTarget:!strictRole}).filter(playerId=>!quickIds.has(id(playerId)));
        candidateGroups=buildGroups(candidateIds);
        visibleCount=Math.min(SQUAD_PICKER_PAGE_SIZE,candidateGroups.length);
        renderResults();
      };
      if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>typeof setTimeout==="function"?setTimeout(hydratePicker,0):hydratePicker());
      else if(typeof setTimeout==="function")setTimeout(hydratePicker,0);
      else hydratePicker();
    }
    function canonicalCardPlayerId(cardRef){
      const meta=cardMeta(cardRef);
      return id(meta.canonicalPlayerId||global.ProfiledSeasonRuntime?.canonicalPlayerId?.(meta.legacySeasonId,meta.profileId||meta.playerId)||meta.playerId);
    }
    function versionGroupKey(cardRef){
      return id(cardIdentity?.versionGroupKey?.(cardRef,activeSeasonId())||`card::${cardMeta(cardRef).cardId||id(cardRef)}`);
    }
    function groupVersionCards(cardIds=[]){
      const groups=new Map();
      for(const cardId of Array.from(new Set(cardIds.map(id))).filter(Boolean)){
        const key=versionGroupKey(cardId);
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(cardId);
      }
      return groups;
    }
    function preferredVersionCardId(cardIds=[]){
      const versions=Array.from(new Set(cardIds.map(id))).filter(Boolean);
      const active=activeSeasonId();
      return versions.find(cardId=>id(cardMeta(cardId).legacySeasonId)===active)||versions[0]||"";
    }
    function openRtgVersionPicker(cardIds=[],options={}){
      const versions=Array.from(new Set(cardIds.map(id))).filter(Boolean);
      const onSelect=typeof options.onSelect==="function"?options.onSelect:null;
      if(versions.length<=1){
        const only=versions[0];
        if(!only)return null;
        return onSelect?onSelect(only):openRtgPlayerDetails(only);
      }
      // Resolve/render every version only after the unified player card is opened.
      const entries=versions.map(cardId=>({
        cardId,
        playerId:cardId,
        source:"RTG",
        player:resolved(cardId,squadDraft?.activeRoleVariantByCardId?.[cardId]||null),
      })).filter(entry=>entry.player);
      deps.openModal?.(
        squadView.versionPickerMarkup
          ? squadView.versionPickerMarkup({entries,mode:onSelect?"select":"details"})
          : `<section class="rtg-version-picker"><div class="modal-head"><div><p class="eyebrow">Versioni possedute</p><h2>Scegli la versione</h2></div></div></section>`,
        {className:"rtg-modal rtg-version-picker-modal"}
      );
      const modal=deps.getModalRoot?.();
      modal?.querySelectorAll?.("[data-rtg-version-card]")?.forEach(button=>button.addEventListener("click",()=>{
        const selected=id(button.dataset.rtgVersionCard);
        if(!selected)return;
        deps.closeModal?.();
        if(onSelect){
          onSelect(selected);
          return;
        }
        const open=()=>openRtgPlayerDetails(selected);
        if(typeof setTimeout==="function")setTimeout(open,0);else open();
      }));
      return {count:versions.length};
    }
    function openRtgCatalog(){
      const owned=Array.from(acquiredCardIdSet()).filter(Boolean);
      const groups=groupVersionCards(owned);
      const representatives=Array.from(groups.values()).map(preferredVersionCardId)
        .filter(Boolean)
        .sort((a,b)=>rawRole(a).localeCompare(rawRole(b))||rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
      let query="";
      let visibleCount=Math.min(SQUAD_PICKER_PAGE_SIZE,representatives.length);
      const filtered=()=>representatives.filter(cardId=>{
        const needle=query.trim().toLocaleLowerCase("it");
        return !needle||rawName(cardId).toLocaleLowerCase("it").includes(needle);
      });
      const entries=()=>filtered().slice(0,visibleCount).map(cardId=>({
        cardId,
        playerId:cardId,
        source:"RTG",
        versionCount:(groups.get(versionGroupKey(cardId))||[cardId]).length,
        player:resolved(cardId,squadDraft?.activeRoleVariantByCardId?.[cardId]||null),
      })).filter(entry=>entry.player);
      const bindCatalog=()=>{
        const modal=deps.getModalRoot?.();
        modal?.querySelectorAll?.("[data-rtg-catalog-player]")?.forEach(button=>button.addEventListener("click",()=>{
          const cardId=id(button.dataset.rtgCatalogPlayer);
          if(!cardId)return;
          openRtgVersionPicker(groups.get(versionGroupKey(cardId))||[cardId]);
        }));
        modal?.querySelector?.("[data-rtg-catalog-load-more]")?.addEventListener("click",()=>{
          visibleCount=Math.min(filtered().length,visibleCount+SQUAD_PICKER_PAGE_SIZE);
          renderCatalogResults();
        });
      };
      const renderCatalogResults=()=>{
        const modal=deps.getModalRoot?.();
        const results=modal?.querySelector?.("[data-rtg-catalog-results]");
        const ids=filtered();
        if(results)results.innerHTML=squadView.catalogResultsMarkup({entries:entries(),total:ids.length});
        bindCatalog();
      };
      deps.openModal?.(squadView.catalogMarkup({entries:entries(),total:representatives.length,query}),{className:"rtg-modal rtg-player-catalog-modal"});
      const modal=deps.getModalRoot?.();
      modal?.querySelector?.("[data-rtg-catalog-search]")?.addEventListener("input",event=>{
        query=String(event.target?.value||"");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderCatalogResults();
      });
      bindCatalog();
      return {count:representatives.length,versionCount:owned.length};
    }

    function currentRequirementTeamId(){
      const node=nodeById(campaign?.currentNodeId);
      if(!node)return null;
      if(node.type==="main")return id(node.teamId);
      if(node.type==="secondary")return id(node.beforeTeamId);
      return null;
    }
    function seasonTeamIdsForPlayer(cardRef){
      const parsed=cardIdentity?.parse?.(cardRef,activeSeasonId())||{};
      const player=playerResolver.resolveVersion?.(cardRef,campaign?.activeSeasonId||"ie1",freeAgentsDb)?.player||rawPlayer(cardRef);
      const profileId=id(parsed.profileId||parsed.playerId);
      const profile=(seasonDb?.profiles||[]).find(entry=>id(entry?.profileId||entry?.id)===profileId);
      const canonicalId=id(profile?.playerId||parsed.canonicalPlayerId||parsed.playerId).split("@")[0];
      const canonical=(seasonDb?.players||[]).find(entry=>id(entry?.playerId||entry?.id)===canonicalId);
      return [player?.teamId,...(player?.teamIds||[]),profile?.teamId,...(profile?.teamIds||[]),canonical?.teamId,...(canonical?.teamIds||[])].filter(Boolean).map(id);
    }
    function requirementPool(teamId){
      const constraint=activeConfig()?.constraints?.[teamId];
      if(!constraint)return[];
      const recruitSet=acquiredCardIdSet();
      const recentTeams=new Set(squadRuntime.recentDefeatedTeamIds(teamId,draftState(),constraint.recentWindow));
      return accessibleDraftIds().map(playerId=>{
        const player=resolved(playerId,squadDraft?.activeRoleVariantByCardId?.[playerId]||null);
        if(!player)return null;
        const role=String(player.normalizedRole||player.position||player.role||rawRole(playerId)).toUpperCase();
        if(!["GK","DF","MF","FW"].includes(role))return null;
        const move=playerResolver.resolveMove?.(playerId,activeSeasonId(),role,freeAgentsDb,squadDraft?.activeRoleVariantByCardId?.[playerId]||null)||null;
        const movePower=Number(move?.power);
        const contribution=Number(player.overall||0)+(Number.isFinite(movePower)?Math.max(0,Math.min(2,(movePower-50)/30)):0);
        const recruit=recruitSet.has(playerId);
        const recent=recruit&&seasonTeamIdsForPlayer(playerId).some(team=>recentTeams.has(team));
        return{playerId,role,overall:Number(player.overall||0),contribution,recruit,recent};
      }).filter(Boolean);
    }
    function buildRequirementCandidate(formation,teamId,pool){
      const constraint=activeConfig()?.constraints?.[teamId];
      if(!formation||!constraint)return null;
      const candidates=Array.from(pool||[]);
      const targetPower=Number(constraint.cap);
      const required={GK:0,DF:0,MF:0,FW:0,...(formation.requirements||{})};
      const left={GK:Number(required.GK)||0,DF:Number(required.DF)||0,MF:Number(required.MF)||0,FW:Number(required.FW)||0};
      const selected=[],used=new Set();
      const distanceToTarget=entry=>Math.abs(Number(entry.contribution||0)-targetPower);
      const balanced=(a,b)=>{
        const distanceDelta=distanceToTarget(a)-distanceToTarget(b);
        if(Math.abs(distanceDelta)>1e-9)return distanceDelta;
        const aAbove=Number(a.contribution)>targetPower?1:0;
        const bAbove=Number(b.contribution)>targetPower?1:0;
        if(aAbove!==bAbove)return aAbove-bAbove;
        return Number(b.contribution)-Number(a.contribution)||a.playerId.localeCompare(b.playerId);
      };
      const addLineupFrom=(source,needed)=>{
        for(const entry of source){
          if(needed<=0)break;
          if(used.has(entry.playerId)||left[entry.role]<=0)continue;
          selected.push(entry);used.add(entry.playerId);left[entry.role]-=1;needed-=1;
        }
        return needed;
      };
      // Composition requirements apply to all 15 active players. Only the amount
      // that cannot fit on the four-player bench is forced into the XI.
      const minFieldRecent=Math.max(0,Number(constraint.recentCount||0)-4);
      const minFieldRecruit=Math.max(0,Number(constraint.minRecruit||0)-4);
      if(addLineupFrom(candidates.filter(entry=>entry.recent).sort(balanced),minFieldRecent)>0)return null;
      const fieldRecruitNow=selected.filter(entry=>entry.recruit).length;
      if(addLineupFrom(candidates.filter(entry=>entry.recruit).sort(balanced),Math.max(0,minFieldRecruit-fieldRecruitNow))>0)return null;
      for(const role of ["GK","DF","MF","FW"]){
        if(addLineupFrom(candidates.filter(entry=>entry.role===role).sort(balanced),left[role])>0)return null;
      }
      if(selected.length!==11)return null;

      const bench=[];
      const benchUsed=new Set(used);
      const addBenchFrom=(source,needed)=>{
        for(const entry of source){
          if(needed<=0||bench.length>=4)break;
          if(benchUsed.has(entry.playerId))continue;
          bench.push(entry);benchUsed.add(entry.playerId);needed-=1;
        }
        return needed;
      };
      const fieldRecruitCount=selected.filter(entry=>entry.recruit).length;
      const fieldRecentCount=selected.filter(entry=>entry.recent).length;
      if(addBenchFrom(candidates.filter(entry=>entry.recent).sort(balanced),Math.max(0,Number(constraint.recentCount||0)-fieldRecentCount))>0)return null;
      const activeRecruitAfterRecent=fieldRecruitCount+bench.filter(entry=>entry.recruit).length;
      if(addBenchFrom(candidates.filter(entry=>entry.recruit).sort(balanced),Math.max(0,Number(constraint.minRecruit||0)-activeRecruitAfterRecent))>0)return null;
      addBenchFrom(candidates.sort(balanced),4-bench.length);
      if(bench.length!==4)return null;

      // Prefer players individually close to the requested level. Afterwards,
      // use any remaining cap headroom while keeping the roster as homogeneous
      // as possible. This avoids solutions such as a few 86 OVR players mixed
      // with many 70 OVR players when 75 OVR alternatives are available.
      const capTotal=targetPower*15;
      const roster=()=>[...selected,...bench];
      const spreadOf=entries=>entries.reduce((sum,entry)=>{
        const delta=Number(entry.contribution||0)-targetPower;
        return sum+(delta*delta);
      },0);
      const metric=(total,spread)=>({
        overage:Math.max(0,total-capTotal),
        shortfall:Math.max(0,capTotal-total),
        spread,
      });
      const betterMetric=(candidate,current)=>{
        if(candidate.overage!==current.overage)return candidate.overage<current.overage;
        if(candidate.shortfall!==current.shortfall)return candidate.shortfall<current.shortfall;
        if(Math.abs(candidate.spread-current.spread)>1e-9)return candidate.spread<current.spread;
        return false;
      };
      let active=roster();
      let total=active.reduce((sum,entry)=>sum+entry.contribution,0);
      let spread=spreadOf(active);
      let currentMetric=metric(total,spread);

      let guard=0;
      while(guard++<180){
        active=roster();
        const activeRecruitCount=active.filter(entry=>entry.recruit).length;
        const activeRecentCount=active.filter(entry=>entry.recent).length;
        const activeIds=new Set(active.map(entry=>entry.playerId));
        let best=null;
        for(let index=0;index<active.length;index++){
          const outgoing=active[index];
          const isLineup=index<selected.length;
          for(const incoming of candidates){
            if(activeIds.has(incoming.playerId))continue;
            if(isLineup&&incoming.role!==outgoing.role)continue;
            const nextRecruit=activeRecruitCount-(outgoing.recruit?1:0)+(incoming.recruit?1:0);
            const nextRecent=activeRecentCount-(outgoing.recent?1:0)+(incoming.recent?1:0);
            if(nextRecruit<Number(constraint.minRecruit||0)||nextRecent<Number(constraint.recentCount||0))continue;
            const nextTotal=total-outgoing.contribution+incoming.contribution;
            const outgoingDelta=Number(outgoing.contribution||0)-targetPower;
            const incomingDelta=Number(incoming.contribution||0)-targetPower;
            const nextSpread=spread-(outgoingDelta*outgoingDelta)+(incomingDelta*incomingDelta);
            const nextMetric=metric(nextTotal,nextSpread);
            if(!betterMetric(nextMetric,currentMetric))continue;
            if(!best||betterMetric(nextMetric,best.metric))best={index,incoming,nextTotal,nextSpread,metric:nextMetric};
          }
        }
        if(!best)break;
        if(best.index<selected.length)selected[best.index]=best.incoming;
        else bench[best.index-selected.length]=best.incoming;
        total=best.nextTotal;
        spread=best.nextSpread;
        currentMetric=best.metric;
      }
      if(total>capTotal+1e-9)return null;

      const state=clone(draftState());
      state.squads[activeSeasonId()]={
        formationId:id(formation.id),
        lineup:selected.map(entry=>entry.playerId),
        bench:bench.map(entry=>entry.playerId),
        activeRoleVariantByCardId:{...(squadDraft?.activeRoleVariantByCardId||{})},
      };
      const eligibility=squadRuntime.mainEligibility({teamId,state,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
      if(!eligibility.eligible)return null;
      return{
        squad:state.squads[activeSeasonId()],
        eligibility,
        targetShortfall:Math.max(0,capTotal-total),
        balanceSpread:spread,
      };
    }
    function adaptSquadToCurrentRequirements(){
      const teamId=currentRequirementTeamId();
      if(!teamId){deps.toast?.("Nessun requisito principale attivo","error");return{ok:false,reason:"no-target"};}
      const formations=activeConfig()?.formations||seasonDb?.formations?.eleven||[];
      const pool=requirementPool(teamId);
      const currentId=id(squadDraft?.formationId||activeSquad(campaign)?.formationId);
      const ordered=[...formations].sort((a,b)=>(id(a.id)===currentId?-1:0)-(id(b.id)===currentId?-1:0));
      let best=null;
      for(const formation of ordered){
        const candidate=buildRequirementCandidate(formation,teamId,pool);
        if(!candidate)continue;
        if(!best||candidate.targetShortfall<best.targetShortfall-1e-9||(Math.abs(candidate.targetShortfall-best.targetShortfall)<=1e-9&&candidate.balanceSpread<best.balanceSpread-1e-9))best=candidate;
      }
      if(!best){deps.toast?.("Non riesco a costruire automaticamente una squadra valida con i giocatori disponibili","error");return{ok:false,reason:"no-valid-squad"};}
      squadDraft=clone(best.squad);
      renderSquad();
      deps.toast?.(`Squadra adattata: Potenza ${best.eligibility.teamPower} / ${best.eligibility.cap}`);
      return{ok:true,teamId,eligibility:best.eligibility,squad:clone(squadDraft)};
    }

    function renderSquad(){
      squadDraft=clone(squadDraft||activeSquad(campaign));
      const model=squadView.renderModel({state:draftState(),freeAgentIds,seasonDb,freeAgentsDb});
      const teamId=currentRequirementTeamId();
      const eligibility=teamId?squadRuntime.mainEligibility?.({teamId,state:draftState(),seasonDb,freeAgentIds,freeAgentsDb,playerResolver}):null;
      const nextTeam=(seasonDb?.teams||[]).find(team=>id(team.teamId||team.id)===teamId);
      const userMeta=deps.getUserTeamMeta?.()||{};
      renderHtml(squadView.markup(model,{
        teamName:userMeta.name||"La tua squadra",
        teamIdentity:userMeta.teamIdentity||null,
        nextTeamName:nextTeam?.name||nextTeam?.teamName||teamId,
        requirementsMarkup:eligibility?runView.requirementsMarkup(eligibility):"",
        teamPower:eligibility?.teamPower ?? squadRuntime.teamPower?.({lineup:squadDraft.lineup||[],activeSeasonId:campaign.activeSeasonId||"ie1",playerResolver,freeAgentsDb,activeRoleVariantByCardId:squadDraft.activeRoleVariantByCardId||{}}) ?? null,
        dirty:JSON.stringify(squadDraft)!==JSON.stringify(activeSquad(campaign)),
        activeSquadSlot,
      }));
      bindHomeAndTabs();
      squadView.bind(app,{
        onOpenFormation:()=>openFormationSelector(model),
        onOpenPlayer:(playerId)=>openSquadPlayerPicker(playerId),
        onOpenDetails:(playerId)=>openRtgPlayerDetails(playerId,"",{allowRoleSwitch:true}),
        onOpenCatalog:()=>openRtgCatalog(),
        onAdaptRequirements:()=>adaptSquadToCurrentRequirements(),
        onSave:()=>saveSquad(squadDraft),
        onSelectSquadSlot:(slot)=>selectSquadSlot(slot),
      });
      mountDevQuickTools();
      return model;
    }
    function switchBenchRole(cardRef,options={}){
      const cardId=id(cardRef),loc=locationInDraft(cardId);
      if(!loc||loc.area!=="bench")return deps.toast?.("Il ruolo si può cambiare solo dalla panchina","error");
      const current=resolved(cardId,squadDraft?.activeRoleVariantByCardId?.[cardId]||null);
      const variants=Array.from(current?.roleVariants||[]);
      if(variants.length<2)return deps.toast?.("Questo giocatore non ha un secondo ruolo","error");
      const active=id(squadDraft?.activeRoleVariantByCardId?.[cardId]||current?.roleVariantId||current?.defaultRoleVariantId);
      const next=variants.find(v=>id(v?.roleVariantId||v?.variantId)!==active)||variants[0];
      const nextId=id(next?.roleVariantId||next?.variantId);
      if(!nextId)return deps.toast?.("Ruolo alternativo non disponibile","error");
      squadDraft={...squadDraft,activeRoleVariantByCardId:{...(squadDraft?.activeRoleVariantByCardId||{}),[cardId]:nextId}};
      if(options.render!==false)renderSquad();
      return {ok:true,cardId,roleVariantId:nextId};
    }
    function locationInDraft(playerId){
      const idValue=id(playerId);
      const lineupIndex=(squadDraft?.lineup||[]).map(id).indexOf(idValue),benchIndex=(squadDraft?.bench||[]).map(id).indexOf(idValue);
      return lineupIndex>=0?{area:"lineup",index:lineupIndex}:benchIndex>=0?{area:"bench",index:benchIndex}:null;
    }
    function swapSquadDraft(firstId,secondId,options={}){
      const first=id(firstId),second=id(secondId);
      if(!first||!second||first===second)return{ok:false,reason:"same-player"};
      const accessible=new Set(accessibleCards(draftState()).map(id));
      if(!accessible.has(first)||!accessible.has(second))return{ok:false,reason:"inaccessible-player"};
      const firstRole=roleOfDraftPlayer(first),secondRole=roleOfDraftPlayer(second);
      const firstLoc=locationInDraft(first),secondLoc=locationInDraft(second);
      if(!firstLoc&&!secondLoc)return{ok:false,reason:"collection-only"};
      // The XI must preserve the role required by the formation. Bench slots are
      // role-free: replacing a bench DF with a FW/MF/GK is always allowed.
      if(firstLoc?.area==="lineup"&&(!secondRole||secondRole!==firstRole))return{ok:false,reason:"role-mismatch"};
      if(secondLoc?.area==="lineup"&&(!firstRole||firstRole!==secondRole))return{ok:false,reason:"role-mismatch"};
      if(firstLoc&&secondLoc){
        squadDraft[firstLoc.area][firstLoc.index]=second;
        squadDraft[secondLoc.area][secondLoc.index]=first;
      }else{
        const loc=firstLoc||secondLoc;
        const incoming=firstLoc?second:first;
        squadDraft[loc.area][loc.index]=incoming;
      }
      if(options.render!==false)renderSquad();
      return{ok:true};
    }
    async function saveSquad(nextSquad=squadDraft,options={}){
      const candidate=clone(nextSquad);
      campaign=await repository.update("rtg-save-squad",current=>{
        const probe=clone(current);probe.squads[activeSeasonId()]=candidate;
        const validation=squadRuntime.validateSquad({state:probe,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
        if(!validation.valid)throw Object.assign(new Error("Squadra RTG non valida"),{code:"rtg-squad-invalid",reasons:validation.reasons});
        current.squads[id(current.activeSeasonId||activeSeasonId())]=candidate;return current;
      });
      squadDraft=clone(candidate);
      storeSquadSlot(activeSquadSlot,squadDraft);
      if(!options.quiet)deps.toast?.(`Squadra ${activeSquadSlot} salvata`);
      return renderSquad();
    }
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
        const eligibility=squadRuntime.mainEligibility({teamId:node.teamId,state:campaign,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
        body=runView.nodeModalMarkup
          ? runView.nodeModalMarkup({node,eligibility,seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>${id(node.teamId)}</h2>${runView.requirementsMarkup(eligibility)}<button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed||!eligibility.eligible?"disabled":""}>GIOCA</button></div>`;
      }else{
        body=runView.nodeModalMarkup
          ? runView.nodeModalMarkup({node,seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>Partita secondaria</h2><p>Avversari svincolati casuali. Vittoria: 100–150 Gettoni RTG.</p><button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed?"disabled":""}>GIOCA</button></div>`;
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
        ? profileIds.map(profileId=>resolvedStandard(cardIdentity?.cardIdForSeason?.(profileId,activeSeasonId())||profileId)).filter(Boolean)
        : (boss.startingXIPlayerIds||[]).map(playerId=>resolvedForTeam(playerId,node.teamId)).filter(Boolean);
      return {formationId:boss.bossFormation||boss.matchFormation||null,lineup,bench:[],name:boss.teamName||node.teamId||"Avversario",teamId:node.teamId,seasonId:activeSeasonId(),logoUrl:boss.logoUrl||teamRecordForId(node.teamId)?.logoUrl||null};
    }
    function secondaryOpponent(node,current,attemptNumber){
      const generated=opponentGenerator.generate({seed:`${current.campaignSeed}:${node.id}`,attemptNumber,freeAgentsDb,formations:seasonDb?.formations?.eleven||[],targetMin:node.opponentTargetMin,targetMax:node.opponentTargetMax,playerResolver});
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
          const eligibility=squadRuntime.mainEligibility({teamId:node.teamId,state:current,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
          if(!eligibility.eligible)throw Object.assign(new Error("Requisiti RTG non rispettati"),{code:"rtg-main-ineligible",details:eligibility});
        }
        const previousAttempt=Math.max(0,Number(current.attemptsByNode?.[node.id]?.lastAttempt)||0);
        const attemptNumber=previousAttempt+1;
        current.attemptsByNode=current.attemptsByNode||{};
        current.attemptsByNode[node.id]={...(current.attemptsByNode[node.id]||{}),lastAttempt:attemptNumber};
        const userSquad=resolvedSquad(current.squads[id(current.activeSeasonId||activeSeasonId())]);
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
          const validation=squadRuntime.validateSquad({state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
          return {eligible:validation.valid,reasons:validation.reasons||[]};
        }
        return squadRuntime.mainEligibility({teamId:nodeById(match.nodeId)?.teamId,state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
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
    function openVending(){
      const pool=gacha.previewPool(campaign,seasonDb);
      deps.openModal?.(runView.vendingMarkup({...pool,tokens:campaign.tokens,seasonId:activeSeasonId()}),{className:"rtg-modal rtg-vending-modal"});
      const modalRoot=deps.getModalRoot?.();
      const albumButton=modalRoot?.querySelector?.("[data-rtg-vending-album]");
      if(albumButton)albumButton.onclick=async(event)=>{
        event?.preventDefault?.();
        event?.stopPropagation?.();
        deps.closeModal?.({invokeOnClose:false});
        await renderAlbum();
      };
      modalRoot?.querySelector?.("[data-rtg-pull]")?.addEventListener("click",async(event)=>{
        const button=event.currentTarget;
        if(button?.disabled)return;
        const machine=modalRoot?.querySelector?.("[data-rtg-vending-machine]");
        button.disabled=true;
        machine?.classList?.add("is-turning");
        try{
          const preparedPromise=pull({reveal:false});
          await new Promise(resolve=>setTimeout(resolve,620));
          const prepared=await preparedPromise;
          if(!prepared?.result||!prepared?.player)return;
          const rarityKey=String(prepared.result.rarity||prepared.player.category||"normale").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-");
          if(machine){
            const capsules=Array.from(machine.querySelectorAll?.("[data-capsule-rarity]")||[]);
            capsules.forEach(capsule=>capsule.classList.remove("is-selected"));
            const matching=capsules.filter(capsule=>capsule.dataset.capsuleRarity===rarityKey);
            const choices=matching.length?matching:capsules;
            const selected=choices.length?choices[Math.floor(Math.random()*choices.length)]:null;
            if(selected){
              selected.dataset.capsuleRarity=rarityKey;
              selected.classList.add("is-selected");
            }
            machine.dataset.pullRarity=rarityKey;
            machine.classList.add("is-revealing");
          }
          await new Promise(resolve=>setTimeout(resolve,980));
          showPullResult(prepared.result,prepared.player);
        }finally{
          machine?.classList?.remove("is-turning","is-revealing");
          if(button?.isConnected)button.disabled=false;
        }
      });
    }
    function showPullResult(result,player){
      if(!result||!player)return null;
      deps.openModal?.(runView.pullResultMarkup(result,player,seasonDb),{
        className:"rtg-modal rtg-pull-modal",
        onClose:()=>openVending(),
      });
      const modalRoot=deps.getModalRoot?.();
      modalRoot?.querySelector?.("[data-rtg-pull-player-detail]")?.addEventListener("click",event=>{
        const playerId=id(event.currentTarget?.dataset?.rtgPullPlayerDetail||result.playerId);
        if(!playerId)return;
        openRtgPlayerDetails(playerId,"",{
          onClose:()=>showPullResult(result,player),
        });
      });
      modalRoot?.querySelector?.("[data-rtg-pull-continue]")?.addEventListener("click",()=>{
        deps.closeModal?.();
      });
      return result;
    }
    async function pull(options={}){
      let result=null;
      campaign=await repository.update("rtg-gacha-pull",current=>{
        const pulled=gacha.pull(current,{seasonDb,accessibleCardIds:accessibleCards(current)});
        result=pulled.result;return pulled.state;
      });
      if(!result)return campaign;
      rememberRtgAlbumCard(result.cardId||result.playerId);
      const player=playerResolver.resolveAtLevel20(result.cardId,campaign?.activeSeasonId||"ie1",null,freeAgentsDb)||{playerId:result.playerId,cardId:result.cardId,legacySeasonId:result.legacySeasonId,name:result.playerId};
      if(options?.reveal===false)return {result,player};
      showPullResult(result,player);
      return result;
    }
    async function open(options={}){
      deps.closeModal?.({invokeOnClose:false});
      await ensureData();
      const access=refreshEntitlements();
      if(!access.unlocked){
        renderHtml(runView.lockedMarkup(access));
        app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
        return {locked:true,access};
      }
      campaign=await repository.ensureCampaign();
      progression?.setSeasonContext?.(campaign);
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
      return renderRun();
    }

    return Object.freeze({
      open,renderRun,renderSquad,renderAlbum,renderAlbumRoster,openNode,startMatch,confirmPreMatch,chooseEncounter,continueEncounterFlow,confirmHalftime,choosePenalty,abandonMatch,openVending,pull,saveSquad,openRtgPlayerDetails,openRtgCatalog,
      swapSquadDraft,canUseDraftFormation,arrangeDraftForFormation,openSquadPlayerPicker,adaptSquadToCurrentRequirements,
      getDraftSquad:()=>clone(squadDraft),getState:()=>clone(campaign),getRenderedHtml,
    });
  }

  global.RoadToGloryController=Object.freeze({create});
})(globalThis);
