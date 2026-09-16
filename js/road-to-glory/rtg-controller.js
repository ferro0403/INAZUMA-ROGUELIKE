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
    const rng=deps.rng||global.RoadToGloryRng;
    const aiPolicy=deps.aiPolicy||global.RoadToGloryAiPolicy;
    const penaltyRuntime=deps.penaltyRuntime||global.RoadToGloryPenaltyRuntime;
    const clone=(value)=>JSON.parse(JSON.stringify(value));
    const id=(value)=>String(value??"");

    let seasonDb=null;
    let freeAgentsDb=null;
    let campaign=null;
    let freeAgentIds=[];
    let squadDraft=null;
    let halftimeDraft=null;
    let rawPlayerById=new Map();
    let lastRenderedHtml="";
    const SQUAD_PICKER_PAGE_SIZE=24;

    function renderHtml(html){
      lastRenderedHtml=String(html||"");
      if(app)app.innerHTML=lastRenderedHtml;
      deps.resetRenderedViewScroll?.();
      return lastRenderedHtml;
    }
    function getRenderedHtml(){return app?.innerHTML||lastRenderedHtml;}

    async function ensureData(){
      seasonDb=seasonDb||await deps.ensureSeason1Db();
      freeAgentsDb=deps.getFreeAgentsDb?.()||freeAgentsDb||{players:[]};
      if(!rawPlayerById.size){
        rawPlayerById=new Map();
        for(const player of freeAgentsDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
        for(const player of seasonDb?.players||[])rawPlayerById.set(id(player.playerId||player.id),player);
      }
      return {seasonDb,freeAgentsDb};
    }
    function rawPlayer(playerId){return rawPlayerById.get(id(playerId))||null;}
    function rawRole(playerId){
      const player=rawPlayer(playerId);
      const role=String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
      return role||String(resolved(playerId)?.normalizedRole||resolved(playerId)?.position||"").toUpperCase();
    }
    function rawOverall(playerId){
      const player=rawPlayer(playerId);
      const value=Number(player?.overall??player?.finalOverall??player?.baseOverall);
      return Number.isFinite(value)?value:Number(resolved(playerId)?.overall||0);
    }
    function rawName(playerId){return String(rawPlayer(playerId)?.name||playerId);}
    function sourceForDraftPlayer(playerId){
      return (campaign?.gachaAcquiredPlayerIds||[]).map(id).includes(id(playerId))?"RTG":"Svincolato";
    }
    function refreshEntitlements(){
      const albumProgress=deps.getAlbumProgress?.();
      const access=entitlements.accessStatus({albumProgress,freeAgentsDb,formations:seasonDb?.formations?.eleven||[]});
      freeAgentIds=entitlements.unlockedFreeAgentIds({albumProgress,freeAgentsDb});
      return access;
    }
    function resolved(playerId,roleVariantId=null){
      const player=playerResolver.resolveAtLevel20(playerId,"ie1",roleVariantId,freeAgentsDb);
      if(!player)return null;
      const stats=player.stats||player.finalStats||{};
      const normalized={...player,...stats,playerId:id(player.playerId||playerId),overall:Number(player.overall??player.finalOverall??0),level:20};
      const role=normalized.normalizedRole||normalized.position||normalized.role;
      const move=playerResolver.resolveMove(playerId,"ie1",role,freeAgentsDb);
      return move?{...normalized,move:clone(move)}:{...normalized,move:null};
    }
    function resolvedSquad(snapshot){
      const variants=snapshot?.activeRoleVariantByPlayerId||{};
      return {
        formationId:snapshot?.formationId||null,
        lineup:(snapshot?.lineup||[]).map(playerId=>resolved(playerId,variants[playerId]||null)).filter(Boolean),
        bench:(snapshot?.bench||[]).map(playerId=>resolved(playerId,variants[playerId]||null)).filter(Boolean),
        activeRoleVariantByPlayerId:{...variants},
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
        for(const playerId of freeAgentIds){const role=rawRole(playerId);if(counts[role]!=null)counts[role]++;}
        return Object.entries(item.requirements||{}).every(([role,n])=>counts[String(role).toUpperCase()]>=Number(n||0));
      })||formations[0];
      if(!formation)throw Object.assign(new Error("Nessun modulo RTG disponibile"),{code:"rtg-squad-no-formation"});
      const accessible=squadRuntime.accessiblePlayerIds({freeAgentIds,state}).map(id);
      const selected=[];
      for(const [role,count] of Object.entries(formation.requirements||{})){
        const candidates=bestPlayerIdsForRole(accessible,String(role).toUpperCase()).filter(playerId=>!selected.includes(playerId));
        if(candidates.length<Number(count||0))throw Object.assign(new Error("Rosa RTG insufficiente per il modulo"),{code:"rtg-squad-default-unavailable"});
        selected.push(...candidates.slice(0,Number(count||0)));
      }
      const remaining=accessible.filter(playerId=>!selected.includes(playerId)).sort((a,b)=>rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
      if(remaining.length<4)throw Object.assign(new Error("Servono 4 panchinari RTG"),{code:"rtg-squad-bench-unavailable"});
      return {formationId:id(formation.id),lineup:selected.slice(0,11),bench:remaining.slice(0,4),activeRoleVariantByPlayerId:{}};
    }
    async function ensureInitialSquad(){
      const squad=campaign?.squads?.ie1;
      if(squad?.formationId&&squad.lineup?.length===11&&squad.bench?.length===4)return campaign;
      campaign=await repository.update("rtg-initial-squad",current=>{
        const existing=current.squads?.ie1;
        if(existing?.formationId&&existing.lineup?.length===11&&existing.bench?.length===4)return current;
        current.squads=current.squads||{};
        current.squads.ie1=buildDefaultSquad(current);
        return current;
      });
      return campaign;
    }
    function bindHomeAndTabs(){
      app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.());
      app?.querySelector?.('[data-rtg-tab="run"]')?.addEventListener("click",()=>renderRun());
      app?.querySelector?.('[data-rtg-tab="squad"]')?.addEventListener("click",()=>renderSquad());
    }
    function bindRun(){
      bindHomeAndTabs();
      app?.querySelector?.("[data-rtg-open-vending]")?.addEventListener("click",()=>openVending());
      app?.querySelectorAll?.("[data-rtg-node-id]")?.forEach(button=>button.addEventListener("click",()=>openNode(button.dataset.rtgNodeId)));
    }
    function renderRun(){
      const nodes=config.buildSeasonNodes("ie1");
      renderHtml(runView.runMarkup({state:campaign,nodes,seasonDb}));
      bindRun();
      return campaign;
    }
    function draftState(){
      const state=clone(campaign);
      state.squads.ie1=clone(squadDraft||campaign.squads.ie1);
      return state;
    }
    function draftRosterIds(){
      return Array.from(new Set([...(squadDraft?.lineup||[]),...(squadDraft?.bench||[])].map(id)));
    }
    function roleOfDraftPlayer(playerId){
      const variant=squadDraft?.activeRoleVariantByPlayerId?.[id(playerId)]||null;
      const player=resolved(playerId,variant);
      return String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
    }
    function canUseDraftFormation(formation){
      if(!formation)return false;
      const counts={GK:0,DF:0,MF:0,FW:0};
      for(const playerId of draftRosterIds()){
        const role=roleOfDraftPlayer(playerId);
        if(Object.prototype.hasOwnProperty.call(counts,role))counts[role]+=1;
      }
      return Object.entries(formation.requirements||{}).every(([role,amount])=>Number(counts[String(role).toUpperCase()]||0)>=Number(amount||0));
    }
    function arrangeDraftForFormation(formation){
      if(!formation||!canUseDraftFormation(formation))return{ok:false,reason:"formation-incompatible"};
      const available=draftRosterIds().map(playerId=>({playerId,role:roleOfDraftPlayer(playerId)}));
      const used=new Set(),lineup=[];
      const slotRoles=Array.isArray(formation.slotRoles)&&formation.slotRoles.length
        ? formation.slotRoles.map(role=>String(role).toUpperCase())
        : Object.entries(formation.requirements||{}).flatMap(([role,amount])=>Array.from({length:Number(amount)||0},()=>String(role).toUpperCase()));
      for(const role of slotRoles){
        const candidate=available.find(entry=>entry.role===role&&!used.has(entry.playerId));
        if(!candidate)return{ok:false,reason:"formation-incompatible"};
        used.add(candidate.playerId);lineup.push(candidate.playerId);
      }
      if(lineup.length!==11)return{ok:false,reason:"formation-invalid-slots"};
      squadDraft={...squadDraft,formationId:id(formation.id),lineup,bench:available.map(entry=>entry.playerId).filter(playerId=>!used.has(playerId)),activeRoleVariantByPlayerId:{...(squadDraft?.activeRoleVariantByPlayerId||{})}};
      return{ok:true};
    }
    function openFormationSelector(model){
      const body=`<div class="modal-head squad-formation-modal-head"><div><p class="eyebrow">Assetto tattico RTG</p><h2>Modifica modulo</h2><p class="muted">Come nelle run normali, puoi scegliere solo moduli coperti dai 15 giocatori della rosa attiva.</p></div></div>${squadView.formationOptionsMarkup(model,canUseDraftFormation)}`;
      deps.openModal?.(body,{className:"squad-formation-modal rtg-formation-modal"});
      deps.getModalRoot?.()?.querySelectorAll?.("[data-rtg-formation-option]")?.forEach(button=>button.addEventListener("click",()=>{
        if(button.disabled)return;
        const formation=(model.formations||[]).find(item=>id(item.id)===id(button.dataset.rtgFormationOption));
        const result=arrangeDraftForFormation(formation);
        if(!result.ok){deps.toast?.("La rosa attiva non copre questo modulo","error");return;}
        deps.closeModal?.();
        renderSquad();
      }));
    }
    function squadPickerCandidateIds(targetId,role){
      const accessible=squadRuntime.accessiblePlayerIds({freeAgentIds,state:draftState()}).map(id);
      return accessible
        .filter(playerId=>playerId!==id(targetId))
        .filter(playerId=>rawRole(playerId)===role)
        .sort((a,b)=>rawOverall(b)-rawOverall(a)||rawName(a).localeCompare(rawName(b),"it"));
    }
    function openSquadPlayerPicker(targetId){
      const targetLoc=locationInDraft(targetId);
      if(!targetLoc)return;
      const role=roleOfDraftPlayer(targetId);
      if(!role)return deps.toast?.("Ruolo giocatore non disponibile","error");
      const candidateIds=squadPickerCandidateIds(targetId,role);
      let visibleCount=Math.min(SQUAD_PICKER_PAGE_SIZE,candidateIds.length);
      const targetPlayer=resolved(targetId,squadDraft?.activeRoleVariantByPlayerId?.[id(targetId)]||null);
      const target={playerId:id(targetId),source:sourceForDraftPlayer(targetId),player:targetPlayer};
      const entries=()=>candidateIds.slice(0,visibleCount).map(playerId=>({
        playerId,
        source:sourceForDraftPlayer(playerId),
        player:resolved(playerId,squadDraft?.activeRoleVariantByPlayerId?.[playerId]||null),
      })).filter(entry=>entry.player);
      const renderResults=()=>{
        const modal=deps.getModalRoot?.();
        const results=modal?.querySelector?.("[data-rtg-picker-results]");
        if(results)results.innerHTML=squadView.replacementPickerResultsMarkup({entries:entries(),total:candidateIds.length,visibleCount});
        bindResults();
      };
      const bindResults=()=>{
        const modal=deps.getModalRoot?.();
        modal?.querySelectorAll?.("[data-rtg-picker-player]")?.forEach(button=>button.addEventListener("click",()=>{
          const candidateId=id(button.dataset.rtgPickerPlayer);
          const result=swapSquadDraft(targetId,candidateId,{render:false});
          if(!result.ok)return deps.toast?.("Cambio non disponibile","error");
          deps.closeModal?.();
          renderSquad();
        }));
        modal?.querySelector?.("[data-rtg-picker-load-more]")?.addEventListener("click",()=>{
          visibleCount=Math.min(candidateIds.length,visibleCount+SQUAD_PICKER_PAGE_SIZE);
          renderResults();
        });
      };
      deps.openModal?.(squadView.replacementPickerMarkup({target,role,entries:entries(),total:candidateIds.length,visibleCount}),{className:"rtg-modal rtg-squad-picker-modal"});
      bindResults();
    }
    function renderSquad(){
      squadDraft=clone(squadDraft||campaign.squads.ie1);
      const model=squadView.renderModel({state:draftState(),freeAgentIds,seasonDb,freeAgentsDb});
      renderHtml(squadView.markup(model));
      bindHomeAndTabs();
      squadView.bind(app,{
        onOpenFormation:()=>openFormationSelector(model),
        onOpenPlayer:(playerId)=>openSquadPlayerPicker(playerId),
        onSave:()=>saveSquad(squadDraft),
      });
      return model;
    }
    function locationInDraft(playerId){
      const idValue=id(playerId);
      const lineupIndex=(squadDraft?.lineup||[]).map(id).indexOf(idValue),benchIndex=(squadDraft?.bench||[]).map(id).indexOf(idValue);
      return lineupIndex>=0?{area:"lineup",index:lineupIndex}:benchIndex>=0?{area:"bench",index:benchIndex}:null;
    }
    function swapSquadDraft(firstId,secondId,options={}){
      const first=id(firstId),second=id(secondId);
      if(!first||!second||first===second)return{ok:false,reason:"same-player"};
      const accessible=new Set(squadRuntime.accessiblePlayerIds({freeAgentIds,state:draftState()}).map(id));
      if(!accessible.has(first)||!accessible.has(second))return{ok:false,reason:"inaccessible-player"};
      const firstRole=roleOfDraftPlayer(first),secondRole=roleOfDraftPlayer(second);
      if(!firstRole||firstRole!==secondRole)return{ok:false,reason:"role-mismatch"};
      const firstLoc=locationInDraft(first),secondLoc=locationInDraft(second);
      if(!firstLoc&&!secondLoc)return{ok:false,reason:"collection-only"};
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
    async function saveSquad(nextSquad=squadDraft){
      const candidate=clone(nextSquad);
      campaign=await repository.update("rtg-save-squad",current=>{
        const probe=clone(current);probe.squads.ie1=candidate;
        const validation=squadRuntime.validateSquad({state:probe,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
        if(!validation.valid)throw Object.assign(new Error("Squadra RTG non valida"),{code:"rtg-squad-invalid",reasons:validation.reasons});
        current.squads.ie1=candidate;return current;
      });
      squadDraft=clone(campaign.squads.ie1);
      deps.toast?.("Squadra Road to Glory salvata");
      return renderSquad();
    }
    function nodeById(nodeId){return Array.from(config.buildSeasonNodes("ie1")).find(node=>node.id===id(nodeId))||null;}
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
    function bossFor(teamId){return (seasonDb?.bossOrder||[]).find(boss=>id(boss.teamId)===id(teamId))||null;}
    function mainOpponent(node){
      const boss=bossFor(node.teamId);
      if(!boss)throw Object.assign(new Error("Boss RTG non trovato"),{code:"rtg-boss-missing"});
      return {formationId:boss.bossFormation||null,lineup:(boss.startingXIPlayerIds||[]).map(playerId=>resolved(playerId)).filter(Boolean),bench:[]};
    }
    function secondaryOpponent(node,current,attemptNumber){
      const generated=opponentGenerator.generate({seed:`${current.campaignSeed}:${node.id}`,attemptNumber,freeAgentsDb,formations:seasonDb?.formations?.eleven||[],targetMin:node.opponentTargetMin,targetMax:node.opponentTargetMax,playerResolver});
      return {formationId:generated.formationId,lineup:generated.playerIds.map(playerId=>resolved(playerId)).filter(Boolean),bench:[],teamPower:generated.teamPower,name:generated.name};
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
        const userSquad=resolvedSquad(current.squads.ie1);
        const opponentSquad=node.type==="main"?mainOpponent(node):secondaryOpponent(node,current,attemptNumber);
        const seed=`${current.campaignSeed}:${node.id}:${attemptNumber}`;
        const matchId=`rtg:${node.id}:${attemptNumber}`;
        let match=matchEngine.createMatch({matchId,nodeId:node.id,matchType:node.type,attemptNumber,seed,userSquad,opponentSquad});
        match=matchEngine.prepareNext(match);
        current.activeMatch=match;started=clone(match);return current;
      });
      return renderMatch(started||campaign.activeMatch);
    }
    function findMatchPlayer(match,side,playerId){
      const squad=side==="user"?match.userSquad:match.opponentSquad;
      return [...(squad?.lineup||[]),...(squad?.bench||[])].find(player=>id(player.playerId)===id(playerId))||null;
    }
    function renderMatch(match=campaign?.activeMatch){
      if(!match)return renderRun();
      renderHtml(matchView.matchMarkup(match));
      const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
      if(match.status==="halftime"){
        halftimeDraft=clone(match.userSquad);
        if(overlay)overlay.innerHTML=matchView.halftimeMarkup(halftimeDraft);
        bindHalftimeEditor(match);
      }else if(match.status==="penalties"){
        const context=penaltyContext(match);
        if(overlay)overlay.innerHTML=matchView.penaltyMarkup(match,context);
      }else if(match.pendingEncounter){
        const pending=match.pendingEncounter;
        const userPlayer=findMatchPlayer(match,"user",pending.userPlayerId);
        const opponentPlayer=findMatchPlayer(match,"opponent",pending.aiPlayerId||pending.opponentPlayerId);
        if(overlay)overlay.innerHTML=matchView.encounterMarkup(match,{userPlayer,opponentPlayer});
      }
      matchView.bind(app,{onEncounterChoice:choice=>chooseEncounter(choice),onAbandon:()=>abandonMatch(),onHalftimeConfirm:()=>confirmHalftime(halftimeDraft),onPenaltyDirection:direction=>choosePenalty({direction,useMove:false}),onPenaltyMove:()=>choosePenalty({direction:"center",useMove:true})});
      return match;
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
    async function commitMatchState(label,mutator){
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
      return renderMatch(campaign.activeMatch);
    }
    async function chooseEncounter(choice){
      const before=clone(campaign.activeMatch?.pendingEncounter);
      let resolvedMatch=null;
      campaign=await repository.update("rtg-encounter",current=>{
        let match=matchEngine.resolvePendingEncounter(current.activeMatch,choice);
        resolvedMatch=clone(match);
        if(["completed","completed-draw"].includes(match.status))return applyTerminal(current,match);
        current.activeMatch=match;return current;
      });
      if(!campaign.activeMatch&&resolvedMatch)return showMatchResult(resolvedMatch);
      const log=resolvedMatch?.log?.at?.(-1);
      if(before&&log){
        renderMatch(resolvedMatch);
        const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
        const userWon=before.userSide===before.actorSide?!!log.actorWon:!log.actorWon;
        const userProbability=before.userSide===before.actorSide?Number(log.probability):100-Number(log.probability);
        const userPlayer=findMatchPlayer(resolvedMatch,"user",before.userPlayerId);
        const aiPlayer=findMatchPlayer(resolvedMatch,"opponent",before.aiPlayerId||before.opponentPlayerId);
        const userChoiceLabel=choice==="move"?(before.userMove?.name||"Mossa"):(before.userBaseActionLabel||"Azione base");
        const aiChoiceLabel=before.aiChoice==="move"?(before.aiMove?.name||"Mossa"):(before.aiKind==="save"?"Parata":before.aiKind==="defense"?"Difesa":before.aiKind==="shot"?"Tiro":"Dribbling");
        if(overlay)overlay.innerHTML=matchView.resolvedEncounterMarkup({
          userWon,probability:userProbability,
          userPlayerName:userPlayer?.name||before.userPlayerId,
          aiPlayerName:aiPlayer?.name||before.aiPlayerId,
          userChoiceLabel,aiChoiceLabel,
        });
        overlay?.querySelector?.("[data-rtg-duel-continue]")?.addEventListener("click",()=>renderMatch(campaign.activeMatch));
        return resolvedMatch;
      }
      return renderMatch(campaign.activeMatch);
    }
    function bindHalftimeEditor(match,selectedPlayerId=null){
      const overlay=app?.querySelector?.("[data-rtg-match-overlay]");
      const repaint=(nextSelected=null)=>{
        if(overlay)overlay.innerHTML=matchView.halftimeMarkup(halftimeDraft,{selectedPlayerId:nextSelected});
        bindHalftimeEditor(match,nextSelected);
      };
      overlay?.querySelectorAll?.("[data-rtg-half-lineup]")?.forEach(button=>button.addEventListener("click",()=>{
        const playerId=id(button.dataset.rtgHalfLineup);
        repaint(selectedPlayerId===playerId?null:playerId);
      }));
      overlay?.querySelectorAll?.("[data-rtg-half-bench]")?.forEach(button=>button.addEventListener("click",()=>{
        if(!selectedPlayerId)return;
        const benchId=id(button.dataset.rtgHalfBench);
        const firstIndex=halftimeDraft.lineup.findIndex(player=>id(player.playerId)===id(selectedPlayerId));
        const secondIndex=halftimeDraft.bench.findIndex(player=>id(player.playerId)===benchId);
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
        const ids=candidate.lineup.map(player=>id(player.playerId)),benchIds=candidate.bench.map(player=>id(player.playerId));
        const candidateState=clone(campaign);candidateState.squads.ie1={formationId:candidate.formationId,lineup:ids,bench:benchIds,activeRoleVariantByPlayerId:{...(candidate.activeRoleVariantByPlayerId||{})}};
        if(match.matchType==="secondary"){
          const validation=squadRuntime.validateSquad({state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
          return {eligible:validation.valid,reasons:validation.reasons||[]};
        }
        return squadRuntime.mainEligibility({teamId:nodeById(match.nodeId)?.teamId,state:candidateState,seasonDb,freeAgentIds,freeAgentsDb,playerResolver});
      }}));
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
      const userKey=`user:${id(userPlayer?.playerId)}`;
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
        const aiKey=`${aiSide}:${id(aiPlayer?.playerId)}`;
        const aiUses=Number(match.moveUsesByPlayerId?.[aiKey]||0);
        const aiChoice=aiPolicy.chooseMove({minute:120,score:{ai:match.shootout?.score?.opponent||0,user:match.shootout?.score?.user||0},encounterKind:aiKind,baseProbabilityForAi:50,remainingUses:aiUses,hasCompatibleMove:!!aiMove&&aiUses>0},rng.float(match.seed,"penalty-ai-move",kickIndex));
        const userMove=useMove?ctx.userMove:null;
        const shooterMove=ctx.attackingSide==="user"?userMove:(aiChoice==="move"?aiMove:null);
        const goalkeeperMove=ctx.attackingSide==="user"?(aiChoice==="move"?aiMove:null):userMove;
        const result=matchEngine.resolvePenaltyKick(match,{
          attackingSide:ctx.attackingSide,
          shooterPlayerId:id(ctx.shooter?.playerId),goalkeeperPlayerId:id(ctx.keeper?.playerId),
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
      deps.openModal?.(matchView.resultMarkup(match),{className:"rtg-modal rtg-result-modal"});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click",()=>{deps.closeModal?.();renderRun();});
      return match;
    }
    function openVending(){
      const pool=gacha.previewPool(campaign,seasonDb);
      deps.openModal?.(runView.vendingMarkup({...pool,tokens:campaign.tokens}),{className:"rtg-modal rtg-vending-modal"});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-pull]")?.addEventListener("click",()=>pull());
    }
    async function pull(){
      let result=null;
      campaign=await repository.update("rtg-gacha-pull",current=>{
        const pulled=gacha.pull(current,{seasonDb,accessiblePlayerIds:squadRuntime.accessiblePlayerIds({freeAgentIds,state:current})});
        result=pulled.result;return pulled.state;
      });
      if(!result)return campaign;
      const player=(seasonDb?.players||[]).find(p=>id(p.playerId)===id(result.playerId))||{playerId:result.playerId,name:result.playerId};
      deps.openModal?.(runView.pullResultMarkup(result,player),{className:"rtg-modal rtg-pull-modal"});
      return result;
    }
    async function open(){
      deps.closeModal?.({invokeOnClose:false});
      await ensureData();
      const access=refreshEntitlements();
      if(!access.unlocked){
        renderHtml(runView.lockedMarkup(access));
        app?.querySelector?.("[data-rtg-home]")?.addEventListener("click",()=>deps.renderHome?.());
        return {locked:true,access};
      }
      campaign=await repository.ensureCampaign();
      await ensureInitialSquad();
      if(campaign.activeMatch){
        const status=campaign.activeMatch.status;
        if(["completed","completed-draw","abandoned"].includes(status)){
          let snapshot=clone(campaign.activeMatch);
          campaign=await repository.update("rtg-resume-terminal",current=>applyTerminal(current,current.activeMatch));
          return showMatchResult(snapshot);
        }
        return renderMatch(campaign.activeMatch);
      }
      return renderRun();
    }

    return Object.freeze({
      open,renderRun,renderSquad,openNode,startMatch,chooseEncounter,confirmHalftime,choosePenalty,abandonMatch,openVending,pull,saveSquad,
      swapSquadDraft,canUseDraftFormation,arrangeDraftForFormation,openSquadPlayerPicker,
      getDraftSquad:()=>clone(squadDraft),getState:()=>clone(campaign),getRenderedHtml,
    });
  }

  global.RoadToGloryController=Object.freeze({create});
})(globalThis);
