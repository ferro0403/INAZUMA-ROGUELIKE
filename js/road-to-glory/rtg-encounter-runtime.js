(function (global) {
  "use strict";

  const STAT_GROUPS=Object.freeze({
    shot:Object.freeze(["attack","control","grit"]),
    dribble:Object.freeze(["control","speed","grit"]),
    defense:Object.freeze(["defense","physical","grit"]),
    save:Object.freeze(["save","physical","grit"]),
    midfield:Object.freeze(["control","stamina","grit"]),
  });
  const ELEMENT_ALIASES=Object.freeze({
    fuoco:"fire",fire:"fire",
    albero:"forest",forest:"forest",wood:"forest",tree:"forest",
    vento:"wind",wind:"wind",
    montagna:"mountain",mountain:"mountain",
  });
  const BEATS=Object.freeze({fire:"forest",forest:"wind",wind:"mountain",mountain:"fire"});

  function numericStat(player,stat){
    const direct=Number(player?.[stat]);
    if(Number.isFinite(direct)) return direct;
    const nested=Number(player?.stats?.[stat] ?? player?.finalStats?.[stat]);
    return Number.isFinite(nested)?nested:0;
  }
  function overallOf(player){
    const value=Number(player?.overall ?? player?.displayOverall ?? player?.finalOverall);
    return Number.isFinite(value)?value:0;
  }
  function specificAverage(player,kind){
    const stats=STAT_GROUPS[String(kind||"")]||[];
    if(!stats.length) return 0;
    return stats.reduce((sum,stat)=>sum+numericStat(player,stat),0)/stats.length;
  }
  function baseStrength(player,kind){
    return 0.5*overallOf(player)+0.5*specificAverage(player,kind);
  }
  function moveBonus(power){
    const numeric=Math.max(50,Math.min(110,Number(power)||50));
    return 5+((numeric-50)*7/60);
  }
  function normalizeElement(value){return ELEMENT_ALIASES[String(value||"").trim().toLowerCase()]||"";}
  function elementModifier(actorElement,opponentElement){
    const actor=normalizeElement(actorElement),opponent=normalizeElement(opponentElement);
    if(!actor||!opponent||actor===opponent) return 0;
    if(BEATS[actor]===opponent) return 5;
    if(BEATS[opponent]===actor) return -5;
    return 0;
  }
  function clampProbability(value){return Math.max(10,Math.min(90,Number(value)||0));}
  function compatibleMoveTypes(actorKind,opponentKind){
    return Object.freeze({actor:String(actorKind||""),opponent:String(opponentKind||"")});
  }
  function probability({actor,opponent,actorKind,opponentKind,actorMove=null,opponentMove=null}={}){
    const actorBase=baseStrength(actor,actorKind);
    const opponentBase=baseStrength(opponent,opponentKind);
    const actorMoveBonus=actorMove?moveBonus(actorMove.power):0;
    const opponentMoveBonus=opponentMove?moveBonus(opponentMove.power):0;
    const actorEffectiveStrength=actorBase+actorMoveBonus;
    const opponentEffectiveStrength=opponentBase+opponentMoveBonus;
    const scoreDelta=actorEffectiveStrength-opponentEffectiveStrength;
    const baseProbability=50+(2.5*scoreDelta);
    const playerElementModifier=elementModifier(actor?.element ?? actor?.type,opponent?.element ?? opponent?.type);
    const moveElementModifier=actorMove&&opponentMove?elementModifier(actorMove.element,opponentMove.element):0;
    const finalProbability=clampProbability(baseProbability+playerElementModifier+moveElementModifier);
    return Object.freeze({
      probability:finalProbability,
      baseProbability,
      scoreDelta,
      actorBase,
      opponentBase,
      actorMoveBonus,
      opponentMoveBonus,
      actorEffectiveStrength,
      opponentEffectiveStrength,
      playerElementModifier,
      moveElementModifier,
    });
  }

  global.RoadToGloryEncounterRuntime=Object.freeze({
    STAT_GROUPS,specificAverage,baseStrength,moveBonus,normalizeElement,elementModifier,compatibleMoveTypes,probability,
  });
})(globalThis);
