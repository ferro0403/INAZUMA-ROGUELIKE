(function (global) {
  "use strict";
  // Completion-only reward: never part of the original 18-player capsule pool.
  const EVENT_ID="halloween2026";
  const PLAYER_ID="custom_0003";
  const CARD_ID=EVENT_ID+"::"+PLAYER_ID;
  const COACH_ID="halloween-coach-54";
  const RAW_PLAYER=Object.freeze({"playerId":"custom_0003","id":"custom_0003","name":"Shawn Froste","portraitUrl":"assets/rtg/halloween-shawn-portrait.webp","position":"FW","ratingRole":"FW","element":"Wind","type":"Wind","teamIds":["occult-2"],"teams":["Occult Halloween"],"custom":true,"attack":10,"physical":9,"stamina":10,"control":10,"defense":9,"speed":10,"grit":9,"save":1,"overall":97,"category":"Leggenda","defaultRoleVariantId":"fw","roleSwitchEnabled":false,"roleVariants":[{"variantId":"fw","position":"FW","attack":10,"physical":9,"stamina":10,"control":10,"defense":9,"speed":10,"grit":9,"save":1,"overall":97,"portraitUrl":"assets/rtg/halloween-shawn-portrait.webp","frontFullbodyUrl":"assets/rtg/halloween-shawn-portrait.webp","evaluated":true,"updatedAt":"2026-11-02T01:37:09.900Z"}],"frontFullbodyUrl":"assets/rtg/halloween-shawn-portrait.webp","fullbodyUrl":"assets/rtg/halloween-shawn-portrait.webp"});
  const MOVES=Object.freeze([{"moveId":"4285_3","name":"Legendary Wolf","jpName":"ウルフレジェンド","type":"shot","element":"Wind","power":85,"tension":85,"source":"manual","ptCost":85},{"moveId":"3667_5","name":"Werewolf Howl","jpName":"ビーストロード","type":"shot","element":"Fire","power":100,"tension":100,"source":"manual","ptCost":100},{"moveId":"1244_2","name":"Frosticle","jpName":"ホワイトブレード","type":"dribble","element":"Wind","power":60,"tension":60,"source":"manual","ptCost":60},{"moveId":"279_1","name":"Land of Ice","jpName":"アイスグランド","type":"defense","element":"Wind","power":85,"tension":85,"source":"manual","ptCost":85}].map(move=>Object.freeze(move)));
  const STATS=Object.freeze(Object.fromEntries(
    ["attack","control","speed","grit","physical","stamina","defense","save"]
      .map(key=>[key,Number(RAW_PLAYER[key])*10])
  ));
  function player() {
    // Match/coach effects must work with independent, mutable player snapshots.
    const stats={...STATS};
    const moves=MOVES.map(move=>({...move}));
    return {...RAW_PLAYER,...stats,playerId:PLAYER_ID,cardId:CARD_ID,
      legacySeasonId:EVENT_ID,resolvedSeasonId:EVENT_ID,
      teamId:"occult-2",teamName:"Occult Halloween",
      teamLogoUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/r/k/rk_nafgart8.webp",
      level:20,stats,baseStats:{...stats},normalizedRole:"FW",
      finalOverall:97,category:"Leggenda",finalRarity:"Leggenda",
      activeMove:moves[0],halloweenMoves:moves,halloweenVampire:false};
  }
  function owns(account) {
    return Array.isArray(account?.gachaAcquiredCards)&&
      account.gachaAcquiredCards.some(card=>card?.cardId===CARD_ID);
  }
  function eligible(account,originalPlayers) {
    if (!originalPlayers||typeof originalPlayers.keys!=="function"||originalPlayers.size!==18) return false;
    if(!Array.isArray(account?.halloween?.ownedIds)||
      !Array.isArray(account?.coachOwnedIds)||
      !Array.isArray(account?.gachaAcquiredCards)||
      !account.coachOwnedIds.includes(COACH_ID))return false;
    const owned=new Set(account.halloween.ownedIds);
    const cards=new Set(account.gachaAcquiredCards.map(card=>card?.cardId));
    return Array.from(originalPlayers.keys()).every(id=>
      owned.has(id)&&cards.has(EVENT_ID+"::"+id));
  }
  // Grant is invoked ONLY inside the canonical shared:account atomic transaction.
  // The acquired card itself is the durable, cloud-synchronized idempotency ledger.
  function grant(account,originalPlayers) {
    if(owns(account)||!global.RoadToGloryHalloween?.isOpen?.()||
      !eligible(account,originalPlayers))return false;
    const meta=global.RoadToGloryCardIdentity?.record?.({
      playerId:PLAYER_ID,legacySeasonId:EVENT_ID});
    if(!meta||meta.cardId!==CARD_ID)throw Object.assign(
      new Error("halloween-completion-card-identity-invalid"),
      {code:"halloween-completion-card-identity-invalid"});
    account.gachaAcquiredCards.push(JSON.parse(JSON.stringify(meta)));
    return true;
  }
  global.RoadToGloryHalloweenCompletion=Object.freeze({
    PLAYER_ID,CARD_ID,player,owns,eligible,grant
  });
})(globalThis);
