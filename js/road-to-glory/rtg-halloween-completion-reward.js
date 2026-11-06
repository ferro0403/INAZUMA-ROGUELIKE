(function (global) {
  "use strict";
  // Premio finale di un evento (completionReward nel file dell'evento, data/events/<id>.json): non fa mai parte
  // delle capsule. Si installa quando il registro eventi ha caricato il file (stesso id del modulo dell'evento).
  function install(manifest) {
  const reward=manifest.completionReward;
  const EVENT_ID=manifest.id;
  const PLAYER_ID=reward.playerId;
  const CARD_ID=manifest.save.cardIdPrefix+PLAYER_ID;
  const COACH_ID=reward.requires?.coachId||"";
  const RAW_PLAYER=Object.freeze({...reward.player});
  const MOVES=Object.freeze(reward.moves.map(move=>Object.freeze({...move})));
  const ledger=account=>global.GameEvents.ledger(account,manifest);
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
      teamId:manifest.team.teamId,teamName:manifest.team.name,
      teamLogoUrl:manifest.team.logo,
      level:reward.level,stats,baseStats:{...stats},normalizedRole:reward.role,
      finalOverall:reward.overall,category:reward.rarity,finalRarity:reward.rarity,
      activeMove:moves[0],halloweenMoves:moves,halloweenVampire:false};
  }
  function owns(account) {
    return Array.isArray(account?.gachaAcquiredCards)&&
      account.gachaAcquiredCards.some(card=>card?.cardId===CARD_ID);
  }
  function eligible(account,originalPlayers) {
    if (!originalPlayers||typeof originalPlayers.keys!=="function"||originalPlayers.size!==manifest.team.rosterSize) return false;
    if(!Array.isArray(ledger(account)?.ownedIds)||
      !Array.isArray(account?.coachOwnedIds)||
      !Array.isArray(account?.gachaAcquiredCards)||
      !account.coachOwnedIds.includes(COACH_ID))return false;
    const owned=new Set(ledger(account).ownedIds);
    const cards=new Set(account.gachaAcquiredCards.map(card=>card?.cardId));
    return Array.from(originalPlayers.keys()).every(id=>
      owned.has(id)&&cards.has(manifest.save.cardIdPrefix+id));
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
  }
  // Evento con un premio finale, gia' caricato o caricato all'avvio del gioco.
  global.GameEvents?.onAnyLoad?.(manifest=>{if(manifest.completionReward?.player)install(manifest);});
})(globalThis);
