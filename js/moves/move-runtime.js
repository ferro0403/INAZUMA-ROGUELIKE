(function (global) {
  "use strict";
  const MOVE_BONUS_DIVISOR=20;
  const MAX_MOVE_BONUS=4;
  function catalog(seasonId){return global.SeasonRegistry?.database?.(seasonId)?.moveCatalog||null;}
  function moveForPlayer(seasonId,playerId){
    const id=String(playerId??""), raw=catalog(seasonId)?.players?.[id];
    if(!raw)return null;
    const power=Number(raw.power);
    return{playerId:id,name:String(raw.name||""),type:String(raw.type||""),power:Number.isFinite(power)?Math.max(0,power):0};
  }
  function teamContribution(seasonId,players){
    const lineup=Array.isArray(players)?players:[];
    if(!lineup.length)return{score:0,bonus:0,mappedPlayers:0,totalPower:0};
    const moves=lineup.map((player)=>moveForPlayer(seasonId,player?.playerId??player?.id));
    const totalPower=moves.reduce((sum,move)=>sum+Number(move?.power||0),0), score=totalPower/lineup.length;
    return{score,bonus:Math.min(MAX_MOVE_BONUS,score/MOVE_BONUS_DIVISOR),mappedPlayers:moves.filter(Boolean).length,totalPower};
  }
  global.MatchMoveRuntime=Object.freeze({MOVE_BONUS_DIVISOR,MAX_MOVE_BONUS,moveForPlayer,teamContribution});
})(globalThis);
