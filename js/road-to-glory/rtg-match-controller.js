(function (global) {
  "use strict";

  function create(deps={}){
    function nodeById(nodeId){return Array.from(deps.config.buildSeasonNodes(deps.activeSeasonId())).find(node=>node.id===deps.id(nodeId))||null;}
    function canStartNode(node){
      if(!node)return false;
      if(node.id===deps.campaign.currentNodeId)return true;
      return node.type==="secondary"&&Number(deps.campaign.attemptsByNode?.[node.id]?.clears||0)>0;
    }
    function openNode(nodeId){
      const node=nodeById(nodeId);
      if(!node)return;
      const allowed=canStartNode(node);
      let body="";
      if(node.type==="main"){
        const eligibility=deps.squadRuntime.mainEligibility({teamId:node.teamId,state:deps.campaign,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(deps.campaign)});
        body=deps.runView.nodeModalMarkup
          ? deps.runView.nodeModalMarkup({node,eligibility,seasonDb:deps.seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>${deps.id(node.teamId)}</h2>${deps.runView.requirementsMarkup(eligibility)}<button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed||!eligibility.eligible?"disabled":""}>GIOCA</button></div>`;
      }else{
        body=deps.runView.nodeModalMarkup
          ? deps.runView.nodeModalMarkup({node,seasonDb:deps.seasonDb,allowed})
          : `<div class="rtg-node-modal"><h2>Partita secondaria</h2><p>Avversari svincolati casuali. Vittoria: 200 Gettoni RTG.</p><button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed?"disabled":""}>GIOCA</button></div>`;
      }
      deps.openModal?.(body,{className:"rtg-modal"});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-start-node]")?.addEventListener("click",()=>{deps.closeModal?.();startMatch(node.id);});
    }
    function teamRecordForId(teamId){return (deps.seasonDb?.teams||[]).find(team=>deps.id(team?.teamId||team?.id)===deps.id(teamId))||null;}
    function bossFor(teamId){return [...(deps.seasonDb?.bossOrder||[]),...(deps.seasonDb?.specialMatches||[])].find(boss=>deps.id(boss.teamId)===deps.id(teamId))||null;}
    function resolvedForTeam(playerId,teamId){
      const profile=(deps.seasonDb?.profiles||[]).find(entry=>deps.id(entry?.playerId)===deps.id(playerId)&&deps.id(entry?.teamId)===deps.id(teamId));
      const ref=profile?deps.cardIdentity?.cardIdForSeason?.(profile.profileId,deps.activeSeasonId()):playerId;
      return deps.resolvedStandard(ref||playerId);
    }
    function mainOpponent(node){
      const boss=bossFor(node.teamId);
      if(!boss)throw Object.assign(new Error("Boss RTG non trovato"),{code:"rtg-boss-missing"});
      const profileIds=Array.from(boss.startingXIProfileIds||[]);
      const lineup=profileIds.length
        ? profileIds.map(profileId=>deps.resolvedStandard(deps.cardIdentity?.cardIdForProfile?.(profileId,deps.activeSeasonId())||profileId)).filter(Boolean)
        : (boss.startingXIPlayerIds||[]).map(playerId=>resolvedForTeam(playerId,node.teamId)).filter(Boolean);
      return {formationId:boss.bossFormation||boss.matchFormation||null,lineup,bench:[],name:boss.teamName||node.teamId||"Avversario",teamId:node.teamId,seasonId:deps.activeSeasonId(),logoUrl:boss.logoUrl||teamRecordForId(node.teamId)?.logoUrl||null};
    }
    function secondaryOpponent(node,current,attemptNumber){
      const generated=deps.opponentGenerator.generate({seed:`${current.campaignSeed}:${node.id}`,attemptNumber,freeAgentsDb:deps.freeAgentsDb,formations:deps.seasonDb?.formations?.eleven||[],targetMin:node.opponentTargetMin,targetMax:node.opponentTargetMax,playerResolver:deps.playerResolver,seasonId:deps.id(current?.activeSeasonId||deps.activeSeasonId())});
      return {formationId:generated.formationId,lineup:generated.playerIds.map(playerId=>deps.resolvedStandard(playerId)).filter(Boolean),bench:[],teamPower:generated.teamPower,name:generated.name,specialType:"free-agents"};
    }
    async function startMatch(nodeId){
      const node=nodeById(nodeId);
      let started=null;
      deps.campaign=await deps.repository.update("rtg-start-match",current=>{
        if(current.activeMatch)throw Object.assign(new Error("Partita RTG già attiva"),{code:"rtg-match-already-active"});
        const allowed=node?.id===current.currentNodeId||(node?.type==="secondary"&&Number(current.attemptsByNode?.[node.id]?.clears||0)>0);
        if(!node||!allowed)throw Object.assign(new Error("Nodo RTG non disponibile"),{code:"rtg-node-not-available"});
        if(node.type==="main"){
          const eligibility=deps.squadRuntime.mainEligibility({teamId:node.teamId,state:current,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(current)});
          if(!eligibility.eligible)throw Object.assign(new Error("Requisiti RTG non rispettati"),{code:"rtg-main-ineligible",details:eligibility});
        }
        const previousAttempt=Math.max(0,Number(current.attemptsByNode?.[node.id]?.lastAttempt)||0);
        const attemptNumber=previousAttempt+1;
        current.attemptsByNode=current.attemptsByNode||{};
        current.attemptsByNode[node.id]={...(current.attemptsByNode[node.id]||{}),lastAttempt:attemptNumber};
        const userSquad=deps.resolvedSquad(current.squads[deps.id(current.activeSeasonId||deps.activeSeasonId())],current);
        const userMeta=deps.getUserTeamMeta?.()||{};
        userSquad.name=userMeta.name||userSquad.name||"La tua squadra";
        if(userMeta.teamIdentity)userSquad.teamIdentity=deps.clone(userMeta.teamIdentity);
        const opponentSquad=node.type==="main"?mainOpponent(node):secondaryOpponent(node,current,attemptNumber);
        const seed=`${current.campaignSeed}:${node.id}:${attemptNumber}`;
        const matchId=`rtg:${node.id}:${attemptNumber}`;
        let match=deps.matchEngine.createMatch({matchId,nodeId:node.id,matchType:node.type,attemptNumber,seed,userSquad,opponentSquad});
        match=deps.matchEngine.prepareNext(match);
        match.presentation={...(match.presentation||{}),preMatchSeen:false};
        current.activeMatch=match;started=deps.clone(match);return current;
      });
      return renderMatch(started||deps.campaign.activeMatch);
    }
    function findMatchPlayer(match,side,playerId){
      const squad=side==="user"?match.userSquad:match.opponentSquad;
      return [...(squad?.lineup||[]),...(squad?.bench||[])].find(player=>deps.id(player.cardId||player.playerId)===deps.id(playerId))||null;
    }
    function clearMatchFlowTimer(){
      if(deps.matchFlowTimer!=null&&typeof deps.cancelSchedule==="function")deps.cancelSchedule(deps.matchFlowTimer);
      deps.matchFlowTimer=null;
    }
    function bindMatchViewActions(){
      deps.matchView.bind(deps.app,{
        onOpenPlayerDetails:(playerId,side)=>deps.openRtgPlayerDetails(playerId,side),
        onPreMatchStart:()=>confirmPreMatch(),
        onEncounterChoice:(choice,isConfirm)=>handleEncounterChoiceTap(choice,isConfirm),
        onAbandon:()=>abandonMatch(),
        onHalftimeConfirm:()=>confirmHalftime(deps.halftimeDraft),
        onPenaltyDirection:direction=>choosePenalty({direction,useMove:false}),
        onPenaltyMove:()=>choosePenalty({direction:"center",useMove:true}),
      });
    }
    function showEncounterOverlay(match,selectedChoice=null){
      const overlay=deps.app?.querySelector?.("[data-rtg-match-overlay]");
      const pending=match?.pendingEncounter;
      if(!overlay||!pending)return;
      const encounterId=deps.id(pending.encounterId);
      if(deps.selectedEncounterId!==encounterId){
        deps.selectedEncounterId=encounterId;
        deps.selectedEncounterChoice=null;
      }
      if(["base","move"].includes(String(selectedChoice||"")))deps.selectedEncounterChoice=String(selectedChoice);
      const userPlayer=findMatchPlayer(match,"user",pending.userPlayerId);
      const opponentPlayer=findMatchPlayer(match,"opponent",pending.aiPlayerId||pending.opponentPlayerId);
      overlay.innerHTML=deps.matchView.encounterMarkup(match,{userPlayer,opponentPlayer,selectedChoice:deps.selectedEncounterChoice});
      bindMatchViewActions();
    }
    function handleEncounterChoiceTap(choice,isConfirm=false){
      const normalized=String(choice||"");
      const pending=deps.campaign?.activeMatch?.pendingEncounter;
      if(!pending||!["base","move"].includes(normalized))return;
      const encounterId=deps.id(pending.encounterId);

      // Confirmation is accepted only from a button that was rendered in the
      // selected state. A stale JS selection can therefore never resolve on
      // the first visible tap of a new/updated duel.
      if(isConfirm===true&&deps.selectedEncounterId===encounterId&&deps.selectedEncounterChoice===normalized){
        deps.selectedEncounterChoice=null;
        deps.selectedEncounterId=null;
        return chooseEncounter(normalized);
      }

      deps.selectedEncounterId=encounterId;
      deps.selectedEncounterChoice=normalized;
      return showEncounterOverlay(deps.campaign.activeMatch,normalized);
    }

    function renderMatch(match=deps.campaign?.activeMatch,options={}){
      clearMatchFlowTimer();
      if(!match)return deps.renderRun();
      if(match.presentation?.preMatchSeen===false){
        deps.displayedMinute=0;
        deps.renderHtml(deps.matchView.preMatchMarkup(match));
        bindMatchViewActions();
        deps.mountDevQuickTools();
        return match;
      }
      deps.renderHtml(deps.matchView.matchMarkup(match),{preserveMatchTimeline:true});
      const minute=deps.matchView.currentMinute?.(match)??0;
      deps.matchView.animateClock?.(deps.app,deps.displayedMinute,minute);
      deps.displayedMinute=minute;
      const overlay=deps.app?.querySelector?.("[data-rtg-match-overlay]");
      if(match.status==="halftime"){
        deps.halftimeDraft=deps.clone(match.userSquad);
        if(overlay)overlay.innerHTML=deps.matchView.halftimeMarkup(deps.halftimeDraft,{match});
        bindHalftimeEditor(match);
      }else if(match.status==="penalties"){
        const context=penaltyContext(match);
        if(overlay)overlay.innerHTML=deps.matchView.penaltyMarkup(match,context);
      }else if(match.pendingEncounter){
        if(options.delayEncounter&&typeof deps.schedule==="function"){
          if(overlay)overlay.innerHTML="";
          const matchId=match.matchId,encounterId=match.pendingEncounter.encounterId;
          deps.matchFlowTimer=deps.schedule(()=>{
            const live=deps.campaign?.activeMatch;
            if(live?.matchId===matchId&&live?.pendingEncounter?.encounterId===encounterId)showEncounterOverlay(live);
          },ENCOUNTER_REVEAL_DELAY_MS);
        }else showEncounterOverlay(match);
      }
      bindMatchViewActions();
      deps.mountDevQuickTools();
      return match;
    }
    async function confirmPreMatch(){
      deps.campaign=await deps.repository.update("rtg-prematch-start",current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        current.activeMatch.presentation={...(current.activeMatch.presentation||{}),preMatchSeen:true};
        return current;
      });
      deps.displayedMinute=0;
      return renderMatch(deps.campaign.activeMatch,{delayEncounter:true});
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
        next=outcome==="victory"?deps.progression.recordMainVictory(current,{teamId:nodeById(match.nodeId)?.teamId,matchId:match.matchId}):deps.progression.recordMainLoss(current,{nodeId:match.nodeId});
      }else{
        next=deps.progression.recordSecondaryResult(current,{nodeId:match.nodeId,result:outcome,attemptNumber:match.attemptNumber});
      }
      next.activeMatch=null;
      return next;
    }
    async function commitMatchState(label,mutator,renderOptions={}){
      let terminalSnapshot=null;
      deps.campaign=await deps.repository.update(label,current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        let match=mutator(deps.clone(current.activeMatch));
        if(["completed","completed-draw","abandoned"].includes(match.status)){
          terminalSnapshot=deps.clone(match);
          return applyTerminal(current,match);
        }
        current.activeMatch=match;return current;
      });
      if(terminalSnapshot)return showMatchResult(terminalSnapshot);
      return renderMatch(deps.campaign.activeMatch,renderOptions);
    }
    async function continueEncounterFlow(){
      let terminalSnapshot=null;
      deps.campaign=await deps.repository.update("rtg-encounter-continue",current=>{
        if(!current.activeMatch)throw Object.assign(new Error("Nessuna partita RTG attiva"),{code:"rtg-match-not-active"});
        let match=deps.clone(current.activeMatch);
        if(["completed","completed-draw"].includes(match.status)){
          terminalSnapshot=deps.clone(match);
          return applyTerminal(current,match);
        }
        if(match.status==="active")match=deps.matchEngine.prepareNext(match);
        if(["completed","completed-draw"].includes(match.status)){
          terminalSnapshot=deps.clone(match);
          return applyTerminal(current,match);
        }
        current.activeMatch=match;
        return current;
      });
      deps.selectedEncounterChoice=null;
      deps.selectedEncounterId=null;
      if(terminalSnapshot)return showMatchResult(terminalSnapshot);
      return renderMatch(deps.campaign.activeMatch,{delayEncounter:true});
    }
    async function chooseEncounter(choice){
      const before=deps.clone(deps.campaign.activeMatch?.pendingEncounter);
      const scoreBefore=deps.clone(deps.campaign.activeMatch?.score||{user:0,opponent:0});
      let resolvedMatch=null;
      deps.campaign=await deps.repository.update("rtg-encounter",current=>{
        const match=deps.matchEngine.resolvePendingEncounter(current.activeMatch,choice);
        resolvedMatch=deps.clone(match);
        current.activeMatch=match;
        return current;
      });
      const log=resolvedMatch?.log?.find?.(entry=>deps.id(entry.encounterId)===deps.id(before?.encounterId));
      if(before&&log){
        renderMatch(resolvedMatch);
        const overlay=deps.app?.querySelector?.("[data-rtg-match-overlay]");
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
          scoreBefore,scoreAfter:deps.clone(resolvedMatch.score||scoreBefore),
          goalSide:log.goalSide||null,
        };
        const revealResult=()=>{
          deps.matchFlowTimer=null;
          const live=deps.campaign?.activeMatch;
          if(!overlay||!live||deps.id(live.matchId)!==deps.id(resolvedMatch.matchId))return;
          overlay.innerHTML=deps.matchView.resolvedEncounterMarkup(presentation);
          overlay?.querySelector?.("[data-rtg-duel-continue]")?.addEventListener("click",()=>continueEncounterFlow());
        };
        if(overlay&&typeof deps.matchView.finalComparisonMarkup==="function"&&typeof deps.schedule==="function"){
          overlay.innerHTML=deps.matchView.finalComparisonMarkup(presentation);
          deps.matchFlowTimer=deps.schedule(revealResult,FINAL_COMPARISON_DELAY_MS);
        }else if(overlay&&typeof deps.matchView.resolvingEncounterMarkup==="function"&&typeof deps.schedule==="function"){
          overlay.innerHTML=deps.matchView.resolvingEncounterMarkup(presentation);
          deps.matchFlowTimer=deps.schedule(revealResult,DUEL_RESULT_REVEAL_DELAY_MS);
        }else revealResult();
        return resolvedMatch;
      }
      return continueEncounterFlow();
    }

    function bindHalftimeEditor(match,selectedPlayerId=null){
      const overlay=deps.app?.querySelector?.("[data-rtg-match-overlay]");
      const repaint=(nextSelected=null)=>{
        if(overlay)overlay.innerHTML=deps.matchView.halftimeMarkup(deps.halftimeDraft,{selectedPlayerId:nextSelected,match});
        bindHalftimeEditor(match,nextSelected);
      };
      overlay?.querySelectorAll?.("[data-rtg-half-lineup]")?.forEach(button=>button.addEventListener("click",()=>{
        const playerId=deps.id(button.dataset.rtgHalfLineup);
        repaint(selectedPlayerId===playerId?null:playerId);
      }));
      overlay?.querySelectorAll?.("[data-rtg-half-bench]")?.forEach(button=>button.addEventListener("click",()=>{
        if(!selectedPlayerId)return;
        const benchId=deps.id(button.dataset.rtgHalfBench);
        const firstIndex=deps.halftimeDraft.lineup.findIndex(player=>deps.id(player.cardId||player.playerId)===deps.id(selectedPlayerId));
        const secondIndex=deps.halftimeDraft.bench.findIndex(player=>deps.id(player.cardId||player.playerId)===benchId);
        const first=deps.halftimeDraft.lineup[firstIndex],second=deps.halftimeDraft.bench[secondIndex];
        const firstRole=String(first?.normalizedRole||first?.position||"").toUpperCase();
        const secondRole=String(second?.normalizedRole||second?.position||"").toUpperCase();
        if(firstIndex<0||secondIndex<0||!firstRole||firstRole!==secondRole){
          deps.toast?.("Cambio consentito solo ruolo per ruolo","error");
          return repaint(null);
        }
        deps.halftimeDraft.lineup[firstIndex]=second;
        deps.halftimeDraft.bench[secondIndex]=first;
        repaint(null);
      }));
      overlay?.querySelector?.("[data-rtg-half-confirm]")?.addEventListener("click",()=>confirmHalftime(deps.halftimeDraft));
    }
    async function confirmHalftime(nextSquad){
      return commitMatchState("rtg-halftime",match=>deps.matchEngine.confirmHalftime(match,nextSquad,{validateHalftime:(candidate)=>{
        const ids=candidate.lineup.map(player=>deps.id(player.cardId||player.playerId)),benchIds=candidate.bench.map(player=>deps.id(player.cardId||player.playerId));
        const candidateState=deps.clone(deps.campaign);candidateState.squads[deps.activeSeasonId()]={formationId:candidate.formationId,lineup:ids,bench:benchIds,activeRoleVariantByCardId:{...(candidate.activeRoleVariantByCardId||{})}};
        if(match.matchType==="secondary"){
          const validation=deps.squadRuntime.validateSquad({state:candidateState,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(candidateState)});
          return {eligible:validation.valid,reasons:validation.reasons||[]};
        }
        return deps.squadRuntime.mainEligibility({teamId:nodeById(match.nodeId)?.teamId,state:candidateState,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(candidateState)});
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
      const userKey=`user:${deps.id(userPlayer?.cardId||userPlayer?.playerId)}`;
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
        const aiDirection=deps.penaltyRuntime.aiDirection(previousUserDirections(match),`${match.seed}:penalty-ai`,kickIndex);
        const aiPlayer=ctx.attackingSide==="user"?ctx.keeper:ctx.shooter;
        const aiKind=ctx.attackingSide==="user"?"save":"shot";
        const aiMove=aiPlayer?.move&&String(aiPlayer.move.type)===aiKind?aiPlayer.move:null;
        const aiSide=ctx.attackingSide==="user"?"opponent":"opponent";
        const aiKey=`${aiSide}:${deps.id(aiPlayer?.cardId||aiPlayer?.playerId)}`;
        const aiUses=Number(match.moveUsesByPlayerId?.[aiKey]||0);
        const aiChoice=deps.aiPolicy.chooseMove({minute:120,score:{ai:match.shootout?.score?.opponent||0,user:match.shootout?.score?.user||0},encounterKind:aiKind,baseProbabilityForAi:50,remainingUses:aiUses,hasCompatibleMove:!!aiMove&&aiUses>0},deps.rng.float(match.seed,"penalty-ai-move",kickIndex));
        const userMove=useMove?ctx.userMove:null;
        const shooterMove=ctx.attackingSide==="user"?userMove:(aiChoice==="move"?aiMove:null);
        const goalkeeperMove=ctx.attackingSide==="user"?(aiChoice==="move"?aiMove:null):userMove;
        const result=deps.matchEngine.resolvePenaltyKick(match,{
          attackingSide:ctx.attackingSide,
          shooterPlayerId:deps.id(ctx.shooter?.cardId||ctx.shooter?.playerId),goalkeeperPlayerId:deps.id(ctx.keeper?.cardId||ctx.keeper?.playerId),
          shooterChoice:ctx.attackingSide==="user"?direction:aiDirection,
          goalkeeperChoice:ctx.attackingSide==="user"?aiDirection:direction,
          shooterMove,goalkeeperMove,
          encounterContext:{actor:ctx.shooter,opponent:ctx.keeper},
        });
        return result.state;
      });
    }
    async function abandonMatch(){return commitMatchState("rtg-abandon",match=>deps.matchEngine.abandon(match));}
    function showMatchResult(match){
      deps.renderRun();
      deps.openModal?.(deps.matchView.resultMarkup(match),{className:"rtg-modal rtg-result-modal",closeable:false});
      deps.getModalRoot?.()?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click",()=>{deps.closeModal?.();deps.renderRun();});
      return match;
    }
    return Object.freeze({nodeById,openNode,startMatch,confirmPreMatch,chooseEncounter,continueEncounterFlow,confirmHalftime,choosePenalty,abandonMatch,renderMatch,applyTerminal,showMatchResult,clearMatchFlowTimer});
  }
  global.RoadToGloryMatchController=Object.freeze({create});
})(globalThis);
