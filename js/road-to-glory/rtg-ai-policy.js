(function (global) {
  "use strict";

  function moveChance(context={}){
    const {
      minute=0,
      score={ai:0,user:0},
      encounterKind="",
      baseProbabilityForAi=50,
      remainingUses=0,
      hasCompatibleMove=false,
    }=context;
    if(!hasCompatibleMove||Number(remainingUses)<=0) return 0;
    const base=Number(baseProbabilityForAi)||0;
    let chance=base>=75?15:base>=55?40:base>=45?60:base>=25?75:85;
    const aiScore=Number(score?.ai)||0,userScore=Number(score?.user)||0;
    const drawing=aiScore===userScore,losing=aiScore<userScore;
    if(Number(minute)>=75&&(drawing||losing)) chance+=10;
    if(Number(minute)>=85&&losing) chance+=10;
    if(Number(minute)>=80&&["shot","save"].includes(String(encounterKind))) chance+=5;
    if(Number(remainingUses)===1&&Number(minute)<60) chance-=10;
    return Math.max(0,Math.min(95,chance));
  }
  function chooseMove(context={},roll=0){
    const chance=moveChance(context);
    return (Number(roll)||0)<chance/100?"move":"normal";
  }

  global.RoadToGloryAiPolicy=Object.freeze({moveChance,chooseMove});
})(globalThis);
