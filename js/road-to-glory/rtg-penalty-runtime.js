(function (global) {
  "use strict";

  const DIRECTIONS=Object.freeze(["left","center","right"]);
  const clone=(value)=>JSON.parse(JSON.stringify(value));

  function createShootout(seed){
    return {seed:String(seed??""),history:[],score:{user:0,opponent:0},kicks:{user:0,opponent:0},status:"regulation-pens",winner:null};
  }
  function updateCompletion(state){
    const userRemaining=Math.max(0,5-state.kicks.user);
    const opponentRemaining=Math.max(0,5-state.kicks.opponent);
    if(state.kicks.user<5||state.kicks.opponent<5){
      if(state.score.user>state.score.opponent+opponentRemaining){state.status="completed";state.winner="user";return;}
      if(state.score.opponent>state.score.user+userRemaining){state.status="completed";state.winner="opponent";return;}
      return;
    }
    if(state.kicks.user===state.kicks.opponent){
      if(state.score.user!==state.score.opponent){
        state.status="completed";state.winner=state.score.user>state.score.opponent?"user":"opponent";
      }else{
        state.status="sudden-death";
      }
    }else{
      state.status="sudden-death";
    }
  }
  function resolveKick(inputState,input={}){
    const state=clone(inputState||createShootout(""));
    if(state.status==="completed")throw Object.assign(new Error("RTG shootout already completed"),{code:"rtg-penalty-completed"});
    const attackingSide=String(input.attackingSide||"");
    if(!["user","opponent"].includes(attackingSide))throw Object.assign(new Error("Invalid penalty side"),{code:"rtg-penalty-side-invalid"});
    const kickIndex=state.history.length;
    const shooterMove=input.shooterMove||null,goalkeeperMove=input.goalkeeperMove||null;
    let outcome,reason,probability=null;
    if(shooterMove&&!goalkeeperMove){outcome="goal";reason="shooter-move-only";}
    else if(!shooterMove&&goalkeeperMove){outcome="save";reason="goalkeeper-move-only";}
    else if(shooterMove&&goalkeeperMove){
      const context=input.encounterContext||{};
      const calculation=global.RoadToGloryEncounterRuntime.probability({
        actor:context.actor,opponent:context.opponent,
        actorKind:"shot",opponentKind:"save",
        actorMove:shooterMove,opponentMove:goalkeeperMove,
      });
      probability=calculation.probability;
      const roll=global.RoadToGloryRng.float(state.seed,"penalty-move-duel",kickIndex);
      outcome=roll<probability/100?"goal":"save";reason="move-duel";
    }else{
      const shot=String(input.shooterChoice||""),save=String(input.goalkeeperChoice||"");
      if(!DIRECTIONS.includes(shot)||!DIRECTIONS.includes(save))throw Object.assign(new Error("Penalty direction required"),{code:"rtg-penalty-direction-invalid"});
      outcome=shot===save?"save":"goal";reason="direction";
    }
    state.kicks[attackingSide]+=1;
    if(outcome==="goal")state.score[attackingSide]+=1;
    state.history.push({
      kickIndex,attackingSide,outcome,reason,
      shooterChoice:input.shooterChoice||null,goalkeeperChoice:input.goalkeeperChoice||null,
      shooterMove:shooterMove?{...shooterMove}:null,goalkeeperMove:goalkeeperMove?{...goalkeeperMove}:null,
      probability,
    });
    updateCompletion(state);
    return {state,outcome,reason,probability};
  }
  function aiDirection(history,seed,kickIndex){
    const counts={left:0,center:0,right:0};
    for(const item of Array.isArray(history)?history:[]){
      const direction=String(item?.userDirection||item?.shooterChoice||"");
      if(Object.prototype.hasOwnProperty.call(counts,direction))counts[direction]+=1;
    }
    const weighted=DIRECTIONS.map(direction=>({direction,weight:1+(counts[direction]*2)}));
    return global.RoadToGloryRng.weightedPick(weighted,item=>item.weight,global.RoadToGloryRng.float(seed,"penalty-ai-direction",kickIndex))?.direction||"center";
  }

  global.RoadToGloryPenaltyRuntime=Object.freeze({DIRECTIONS,createShootout,resolveKick,aiDirection});
})(globalThis);
