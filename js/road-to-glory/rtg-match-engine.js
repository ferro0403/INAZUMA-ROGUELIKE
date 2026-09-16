(function (global) {
  "use strict";

  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const id=(value)=>String(value??"");
  const otherSide=(side)=>side==="user"?"opponent":"user";
  const actionLabel=(kind)=>({shot:"Tiro",save:"Parata",dribble:"Dribbling",defense:"Difesa",midfield:"Dribbling"}[kind]||"Dribbling");
  const playerRole=(player)=>String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
  const playerId=(player)=>id(player?.playerId||player?.id);
  const allPlayers=(squad)=>[...(squad?.lineup||[]),...(squad?.bench||[])];

  function moveForKind(player,kind){
    const move=player?.activeMove||player?.move||null;
    if(!move)return null;
    const type=String(move.type||"").toLowerCase();
    if(String(kind)==="midfield")return ["dribble","defense"].includes(type)?move:null;
    return type===String(kind)?move:null;
  }
  function moveKey(side,pid){return `${side}:${id(pid)}`;}
  function initialMoveUses(userSquad,opponentSquad){
    const uses={};
    for(const [side,squad] of [["user",userSquad],["opponent",opponentSquad]]){
      for(const player of allPlayers(squad)){
        if(player?.activeMove||player?.move||player?.roleMoves)uses[moveKey(side,playerId(player))]=2;
      }
    }
    return uses;
  }
  function deterministicManualIndexes(seed,actionTarget,manualTarget){
    return Array.from({length:actionTarget},(_,index)=>({index,roll:global.RoadToGloryRng.float(seed,"manual-index",index)}))
      .sort((a,b)=>a.roll-b.roll||a.index-b.index)
      .slice(0,manualTarget)
      .map(x=>x.index)
      .sort((a,b)=>a-b);
  }
  function createMatch(input={}){
    const seed=id(input.seed||input.matchId||"rtg-match");
    const actionTarget=20+global.RoadToGloryRng.int(seed,"action-target",0,9);
    const manualTarget=Math.min(actionTarget,16+global.RoadToGloryRng.int(seed,"manual-target",0,5));
    const userSquad=clone(input.userSquad||{lineup:[],bench:[]});
    const opponentSquad=clone(input.opponentSquad||{lineup:[],bench:[]});
    const possession=global.RoadToGloryRng.int(seed,"kickoff",0,2)===0?"user":"opponent";
    return {
      matchId:id(input.matchId),nodeId:id(input.nodeId),matchType:String(input.matchType||"main"),
      attemptNumber:Math.max(1,Number(input.attemptNumber)||1),seed,
      period:"first_half",status:"active",result:null,
      actionTarget,firstHalfTarget:Math.floor(actionTarget/2),manualTarget,
      manualIndexes:deterministicManualIndexes(seed,actionTarget,manualTarget),
      actionIndex:0,extraActionIndex:0,manualResolved:0,
      score:{user:0,opponent:0},possession,fieldZone:"midfield",
      userSquad,opponentSquad,
      userRosterIds:allPlayers(userSquad).map(playerId),
      moveUsesByPlayerId:initialMoveUses(userSquad,opponentSquad),
      pendingEncounter:null,recentParticipants:[],log:[],shootout:null,
    };
  }
  function squadFor(state,side){return side==="user"?state.userSquad:state.opponentSquad;}
  function lineupFor(state,side){return squadFor(state,side)?.lineup||[];}
  function findPlayer(state,side,pid){return allPlayers(squadFor(state,side)).find(p=>playerId(p)===id(pid))||null;}
  function preferredRoles(kind){
    if(kind==="save")return [["GK"]];
    if(kind==="defense")return [["DF"],["MF"],["FW"]];
    if(kind==="shot")return [["FW"],["MF"],["DF"]];
    if(kind==="dribble")return [["FW"],["MF"],["DF"]];
    return [["MF"],["FW","DF"]];
  }
  function pickPlayer(state,side,kind,stream){
    const lineup=lineupFor(state,side);
    let candidates=[];
    for(const roles of preferredRoles(kind)){
      candidates=lineup.filter(player=>roles.includes(playerRole(player)));
      if(candidates.length)break;
    }
    if(!candidates.length)candidates=lineup.filter(player=>playerRole(player)!=="GK");
    if(!candidates.length)candidates=lineup.slice();
    const recent=new Set((state.recentParticipants||[]).slice(-4));
    const entries=candidates.map(player=>{
      const repeated=recent.has(playerId(player));
      const strength=Math.max(1,global.RoadToGloryEncounterRuntime.specificAverage(player,kind));
      return {player,weight:strength*(repeated?0.25:1)};
    });
    return global.RoadToGloryRng.weightedPick(entries,e=>e.weight,global.RoadToGloryRng.float(state.seed,stream,state.actionIndex+state.extraActionIndex))?.player||candidates[0]||null;
  }
  function encounterKinds(zone){
    if(zone==="shot")return{actorKind:"shot",opponentKind:"save",kind:"shot"};
    if(zone==="attack")return{actorKind:"dribble",opponentKind:"defense",kind:"dribble"};
    return{actorKind:"midfield",opponentKind:"midfield",kind:"midfield"};
  }
  function minuteFor(state){
    if(state.period==="extra_first"||state.period==="extra_second")return 90+Math.round((Math.min(6,state.extraActionIndex)/6)*30);
    return Math.round((Math.min(state.actionTarget,state.actionIndex)/Math.max(1,state.actionTarget))*90);
  }
  function buildEncounter(state){
    const actorSide=state.possession,opponentSide=otherSide(actorSide);
    const {actorKind,opponentKind,kind}=encounterKinds(state.fieldZone);
    const actor=pickPlayer(state,actorSide,actorKind,`participant:actor:${actorSide}:${state.fieldZone}`);
    const opponent=pickPlayer(state,opponentSide,opponentKind,`participant:opponent:${opponentSide}:${state.fieldZone}`);
    if(!actor||!opponent)throw Object.assign(new Error("RTG encounter player unavailable"),{code:"rtg-match-player-unavailable"});
    const preview=global.RoadToGloryEncounterRuntime.probability({actor,opponent,actorKind,opponentKind});
    const userSide="user";
    const userIsActor=actorSide===userSide;
    const userPlayer=userIsActor?actor:opponent,userKind=userIsActor?actorKind:opponentKind;
    const aiPlayer=userIsActor?opponent:actor,aiKind=userIsActor?opponentKind:actorKind;
    const aiSide=userIsActor?opponentSide:actorSide;
    const userMove=moveForKind(userPlayer,userKind);
    const aiMove=moveForKind(aiPlayer,aiKind);
    const aiUses=Number(state.moveUsesByPlayerId[moveKey(aiSide,playerId(aiPlayer))]||0);
    const aiBaseProbability=aiSide===actorSide?preview.probability:100-preview.probability;
    const aiChoice=global.RoadToGloryAiPolicy.chooseMove({
      minute:minuteFor(state),period:state.period,
      score:{ai:Number(state.score[aiSide]||0),user:Number(state.score.user||0)},
      encounterKind:aiKind,baseProbabilityForAi:aiBaseProbability,
      remainingUses:aiUses,hasCompatibleMove:!!aiMove&&aiUses>0,
    },global.RoadToGloryRng.float(state.seed,`ai-choice:${state.period}:${state.actionIndex}:${state.extraActionIndex}`,0));
    return {
      encounterId:`${state.matchId}:${state.period}:${state.actionIndex}:${state.extraActionIndex}`,
      kind,actorKind,opponentKind,actorSide,opponentSide,
      actorPlayerId:playerId(actor),opponentPlayerId:playerId(opponent),
      normalPreviewProbability:preview.probability,
      userSide,userPlayerId:playerId(userPlayer),userKind,userBaseActionLabel:actionLabel(userKind),
      userMove:userMove?clone(userMove):null,
      aiSide,aiPlayerId:playerId(aiPlayer),aiKind,aiChoice,
      aiMove:aiChoice==="move"&&aiMove?clone(aiMove):null,
      preparedAtActionIndex:state.actionIndex,
    };
  }
  function applyEncounter(state,pending,{actorMove=null,opponentMove=null,manual=false}={}){
    const actor=findPlayer(state,pending.actorSide,pending.actorPlayerId);
    const opponent=findPlayer(state,pending.opponentSide,pending.opponentPlayerId);
    const calc=global.RoadToGloryEncounterRuntime.probability({
      actor,opponent,actorKind:pending.actorKind,opponentKind:pending.opponentKind,actorMove,opponentMove,
    });
    const roll=global.RoadToGloryRng.float(state.seed,`encounter-result:${pending.encounterId}`,0);
    const actorWon=roll<calc.probability/100;
    const zone=state.fieldZone;
    if(actorWon){
      if(zone==="midfield")state.fieldZone="attack";
      else if(zone==="attack")state.fieldZone="shot";
      else{
        state.score[pending.actorSide]=(Number(state.score[pending.actorSide])||0)+1;
        state.possession=pending.opponentSide;state.fieldZone="midfield";
      }
    }else{
      state.possession=pending.opponentSide;state.fieldZone="midfield";
    }
    state.recentParticipants=[...(state.recentParticipants||[]),pending.actorPlayerId,pending.opponentPlayerId].slice(-4);
    state.log.push({
      encounterId:pending.encounterId,period:state.period,minute:minuteFor(state),zone,
      actorSide:pending.actorSide,actorPlayerId:pending.actorPlayerId,opponentPlayerId:pending.opponentPlayerId,
      actorMove:actorMove?.name||null,opponentMove:opponentMove?.name||null,
      probability:calc.probability,roll,actorWon,manual,
      score:{...state.score},
    });
    if(state.period==="extra_first"||state.period==="extra_second")state.extraActionIndex+=1;
    else state.actionIndex+=1;
    return state;
  }
  function completeByScore(state){
    if(state.score.user>state.score.opponent){state.status="completed";state.result={winner:"user",score:{...state.score}};}
    else if(state.score.opponent>state.score.user){state.status="completed";state.result={winner:"opponent",score:{...state.score}};}
    else if(state.matchType==="secondary"){state.status="completed-draw";state.result={winner:null,score:{...state.score}};}
    else{state.period="extra_first";state.status="active";state.extraActionIndex=0;}
  }
  function ensureBoundary(state){
    if(state.status!=="active")return state;
    if(state.period==="first_half"&&state.actionIndex>=state.firstHalfTarget){
      state.period="halftime";state.status="halftime";return state;
    }
    if(state.period==="second_half"&&state.actionIndex>=state.actionTarget){completeByScore(state);return state;}
    if(state.period==="extra_first"&&state.extraActionIndex>=3){state.period="extra_second";return state;}
    if(state.period==="extra_second"&&state.extraActionIndex>=6){
      if(state.score.user!==state.score.opponent){completeByScore(state);}
      else{state.status="penalties";state.shootout=global.RoadToGloryPenaltyRuntime.createShootout(`${state.seed}:shootout`);}
    }
    return state;
  }
  function isManualSequence(state){
    if(state.period==="extra_first"||state.period==="extra_second")return true;
    return (state.manualIndexes||[]).includes(state.actionIndex);
  }
  function prepareNext(inputState){
    const state=clone(inputState);
    if(state.pendingEncounter||state.status==="halftime"||state.status==="penalties"||String(state.status).startsWith("completed")||state.status==="abandoned")return state;
    let guard=0;
    while(state.status==="active"&&!state.pendingEncounter&&guard++<64){
      ensureBoundary(state);
      if(state.status!=="active")break;
      const pending=buildEncounter(state);
      if(isManualSequence(state)){state.pendingEncounter=pending;break;}
      applyEncounter(state,pending,{manual:false});
    }
    return state;
  }
  function consumeMove(state,side,pid,move){
    if(!move)return;
    const key=moveKey(side,pid),uses=Number(state.moveUsesByPlayerId[key]||0);
    if(uses<=0)throw Object.assign(new Error("RTG move uses exhausted"),{code:"rtg-match-move-exhausted",playerId:id(pid),side});
    state.moveUsesByPlayerId[key]=uses-1;
  }
  function resolvePendingEncounter(inputState,userChoice="base"){
    const state=clone(inputState),pending=state.pendingEncounter;
    if(!pending)throw Object.assign(new Error("RTG pending encounter required"),{code:"rtg-match-no-pending-encounter"});
    const choice=String(userChoice||"base");
    if(!["base","move"].includes(choice))throw Object.assign(new Error("RTG user choice invalid"),{code:"rtg-match-choice-invalid"});
    if(choice==="move"&&!pending.userMove)throw Object.assign(new Error("RTG compatible move unavailable"),{code:"rtg-match-move-unavailable"});
    const userMove=choice==="move"?pending.userMove:null;
    const aiMove=pending.aiChoice==="move"?pending.aiMove:null;
    if(userMove)consumeMove(state,pending.userSide,pending.userPlayerId,userMove);
    if(aiMove)consumeMove(state,pending.aiSide,pending.aiPlayerId,aiMove);
    let actorMove=null,opponentMove=null;
    if(pending.userSide===pending.actorSide)actorMove=userMove;else opponentMove=userMove;
    if(pending.aiSide===pending.actorSide)actorMove=aiMove;else opponentMove=aiMove;
    state.pendingEncounter=null;
    state.manualResolved=(Number(state.manualResolved)||0)+1;
    applyEncounter(state,pending,{actorMove,opponentMove,manual:true});
    return prepareNext(state);
  }
  function validateHalftimeRoster(state,nextSquad){
    const all=allPlayers(nextSquad).map(playerId);
    if((nextSquad?.lineup||[]).length!==11||(nextSquad?.bench||[]).length!==4)return false;
    if(new Set(all).size!==15)return false;
    const original=new Set(state.userRosterIds||[]);
    return all.length===original.size&&all.every(pid=>original.has(pid));
  }
  function confirmHalftime(inputState,nextSquad,deps={}){
    const state=clone(inputState);
    if(state.status!=="halftime"||state.period!=="halftime")throw Object.assign(new Error("RTG halftime unavailable"),{code:"rtg-match-not-halftime"});
    if(!validateHalftimeRoster(state,nextSquad))throw Object.assign(new Error("RTG halftime roster invalid"),{code:"rtg-match-halftime-roster-invalid"});
    const external=typeof deps.validateHalftime==="function"?deps.validateHalftime(nextSquad,state):{eligible:true};
    if(external===false||external?.eligible===false)throw Object.assign(new Error("RTG halftime constraints invalid"),{code:"rtg-match-halftime-constraints-invalid",details:external});
    state.userSquad=clone(nextSquad);
    for(const player of allPlayers(state.userSquad)){
      if((player?.activeMove||player?.move||player?.roleMoves)&&state.moveUsesByPlayerId[moveKey("user",playerId(player))]==null)state.moveUsesByPlayerId[moveKey("user",playerId(player))]=2;
    }
    state.period="second_half";state.status="active";
    return prepareNext(state);
  }
  function resolvePenaltyKick(inputState,input={}){
    const state=clone(inputState);
    if(state.status!=="penalties"||!state.shootout)throw Object.assign(new Error("RTG penalties unavailable"),{code:"rtg-match-penalties-unavailable"});
    const result=global.RoadToGloryPenaltyRuntime.resolveKick(state.shootout,input);
    state.shootout=result.state;
    if(result.state.status==="completed"){
      state.status="completed";
      state.result={winner:result.state.winner,score:{...state.score},shootoutScore:{...result.state.score}};
    }
    return {state,outcome:result.outcome,reason:result.reason,probability:result.probability};
  }
  function abandon(inputState){
    const state=clone(inputState);state.pendingEncounter=null;state.status="abandoned";state.result={winner:"opponent",reason:"abandoned",score:{...state.score}};return state;
  }

  global.RoadToGloryMatchEngine=Object.freeze({
    createMatch,prepareNext,resolvePendingEncounter,confirmHalftime,resolvePenaltyKick,abandon,
  });
})(globalThis);
