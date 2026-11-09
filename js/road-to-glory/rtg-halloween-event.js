(function (global) {
  "use strict";
  // Passo 3: i dati di Halloween (date, prezzi, squadra, carte, allenatore, immagini) arrivano dal manifest
  // data/events/<id>.json tramite il registro eventi (js/events/event-registry.js). Qui sotto solo la
  // lettura dei campi; la logica dell'evento resta quella di prima.
  function install(manifest) {
  const EVENT_ID = manifest.id;
  const TEAM_ID = manifest.team.teamId;
  const EVENT_START_MS = Date.parse(manifest.window.start);
  const EVENT_END_MS = Date.parse(manifest.window.end);
  const MATCH_KEY = manifest.save.matchKey;
  const SQUAD_KEY = manifest.save.squadKey;
  // Evento finto (solo sviluppo): legge e scrive solo chiavi locali "dev:<id>:...", mai shared:account e quindi
  // mai il cloud. Alla prima apertura parte da una copia dell'account vero, letto e non modificato.
  const REAL_SHARED_KEY = "shared:account";
  const SANDBOX = manifest.dev === true;
  const SHARED_KEY = SANDBOX ? manifest.save.storagePrefix + "shared:account" : REAL_SHARED_KEY;
  const PRICE = manifest.economy.pullPrice;
  const PRIZE = manifest.economy.winPrize;
  const LUCKY_PRIZE = manifest.economy.luckyPrize;
  const LUCKY_CHANCE_PERCENT = manifest.economy.luckyChancePercent;
  // Parte 2 (a): un evento puo' avere piu' squadre (la prima e' team) e piu' monete (la prima e' currency).
  const TEAMS = global.GameEvents?.teamsOf?.(manifest) || [manifest.team];
  const ROSTER_SIZE = TEAMS.reduce((sum, entry) => sum + Number(entry.rosterSize || 0), 0);
  const TEAM_VENDING = TEAMS.length > 1 && TEAMS.every(t => !!t.currencyId);
  const STARTERS_SIZE = manifest.team.startersSize;
  const BANNER_URL = manifest.assets.banner;
  const GRAVEYARD_URL = manifest.assets.background;
  const PUMPKIN_URL = manifest.currency.icon;
  const LOGO_URL = manifest.team.logo;
  // Passo 4.4: testi dal file dell'evento (labels.ui, currency, team.name). Halloween: gli stessi testi di prima.
  const UI = manifest.labels.ui;
  const TEAM_NAME = manifest.team.name;
  const uiText = key => escape(UI[key]);
  const CURRENCIES = global.GameEvents?.currenciesOf?.(manifest) ||
    [{ ...manifest.currency, field: manifest.save.currencyField || "balance" }];
  const CUR = CURRENCIES[0];
  const fieldOf = currencyId => (CURRENCIES.find(c => c.id === currencyId) || CURRENCIES[0]).field;
  const PULL_FIELD = fieldOf(manifest.economy.pullCurrency);
  const WIN_FIELD = fieldOf(manifest.economy.winCurrency);
  const LUCKY_FIELD = fieldOf(manifest.economy.luckyCurrency || manifest.economy.winCurrency);
  // Stato dell'evento nel salvataggio: shared.halloween per Halloween, shared.events.<id> per gli eventi nuovi.
  const CURRENCY = manifest.save.currencyField || "balance"; // moneta principale (la prima)
  const OWNED_ID = new RegExp(manifest.save.ownedIdPattern || "^[A-Za-z0-9_]+$");
  const ledger = account => global.GameEvents.ledger(account, manifest);
  // Carte senza lo stile "vampiro" (le due speciali).
  const SPECIAL = Object.freeze(manifest.cards.filter(card => !card.vampire).map(card => card.playerId));
  const HALLOWEEN_COACH_ID = manifest.coaches?.[0]?.id || "";
  const PULL_WEIGHTS = new Map(manifest.cards.filter(card=>card.pullWeight !== undefined).map(card=>[card.playerId,card.pullWeight]));
  // La valuta per squadra e' opzionale: Halloween usa sempre i campi storici.
  const currencyForTeam = teamId => TEAMS.find(t=>t.teamId===teamId)?.currencyId || "";
  const pullFieldForTeam = teamId => currencyForTeam(teamId)?fieldOf(currencyForTeam(teamId)):PULL_FIELD;
  const rewardFieldForTeam = (teamId,lucky=false) => currencyForTeam(teamId)
    ?fieldOf(currencyForTeam(teamId)):(lucky?LUCKY_FIELD:WIN_FIELD);
  const EVENT_FULLBODY_URLS = Object.freeze(Object.fromEntries(
    manifest.cards.filter(card => card.fullbody).map(card => [card.playerId, card.fullbody])));
  const clone = x => JSON.parse(JSON.stringify(x));
  const asId = x => String(x == null ? "" : x).trim();
  const escape = x => String(x == null ? "" : x).replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
  // Ora degli eventi dal registro (spostabile solo in sviluppo con ?oraEvento=).
  const eventNow = () => global.GameEvents?.now?.() ?? Date.now();
  const isOpen = () => eventNow() >= EVENT_START_MS && eventNow() <= EVENT_END_MS;
  // Nome della provenienza di una carta: Season dal registro unico, poi Svincolati ed evento.
  const sourceLabel = (id, eventLabel) => global.RoadToGloryConfig?.seasonLabel?.(id) ||
    ({free_agents:"Svincolati", [EVENT_ID]:eventLabel})[id] || "";
  let assetsPromise = null;
  let assets = null;
  const fail = code => Object.assign(new Error(code), {code});

  function countdown() {
    const remaining = Math.max(0, EVENT_END_MS - eventNow());
    const units = [86400000, 3600000, 60000, 1000];
    const vals = [];
    let rest = remaining;
    for (const u of units) { vals.push(Math.floor(rest/u)); rest %= u; }
    return vals[0] + "g " + String(vals[1]).padStart(2,"0") + "h " + String(vals[2]).padStart(2,"0") + "m " + String(vals[3]).padStart(2,"0") + "s";
  }
  function eventCard() {
    return '<button type="button" class="rtg-campaign-card rtg-halloween-entry" data-rtg-halloween-open data-rtg-event-open="' +
      escape(EVENT_ID) + '" style="' + (global.GameEvents?.themeStyle?.(EVENT_ID) || "") + '" ' +
      (isOpen() ? '' : 'disabled aria-disabled="true" ') +
      '><img class="rtg-campaign-card__image" src="' + escape(BANNER_URL) + '" alt="">' +
      '<span class="rtg-campaign-shade"></span><span class="rtg-campaign-copy"><small>' + uiText("entryEyebrow") + '</small>' +
      '<strong>' + uiText("entryTitle") + '</strong><em><b>' + uiText("entrySubtitle") + '</b></em>' +
      '<i data-halloween-countdown>' + (isOpen() ? countdown() : "EVENTO TERMINATO") + '</i></span></button>';
  }
  async function prepare(fetcher = global.fetch && global.fetch.bind(global)) {
    if (assets) return assets;
    if (!fetcher) throw fail("halloween-fetch-unavailable");
    if (!assetsPromise) assetsPromise = Promise.all(TEAMS.map(config => Promise.all([
      config.files.players,
      config.files.lineup,
      config.files.moves
    ].map(async path => {
      const response = await fetcher(path, {cache:"no-store"});
      if (!response.ok) throw fail("halloween-asset-unavailable");
      return response.json();
    })).then(([teams, lineup, moves]) => {
      const team = teams[0], setup = lineup.teams[0], list = team.players || [];
      if (team.teamId !== config.teamId || asId(setup.teamId).replaceAll("_","-") !== config.teamId ||
        list.length !== config.rosterSize || setup.startingXI.length !== config.startersSize ||
        new Set(setup.startingXI).size !== config.startersSize ||
        !setup.bossFormation || (global.RoadToGloryConfig?.season?.("ie1")?.formations &&
          !global.RoadToGloryConfig.season("ie1").formations.some(f => f.id === setup.bossFormation)) ||
        list.some(p => !moves.players[asId(p.playerId)]?.moves?.length) ||
        setup.startingXI.some(pid => !list.some(p => asId(p.playerId) === asId(pid)))) throw fail("halloween-invalid-asset-contract");
      return Object.freeze({config, team, setup, moves, players:new Map(list.map(p=>[asId(p.playerId),p]))});
    }))).then(teamAssets => {
      // La prima squadra resta quella di sempre (avversario predefinito); giocatori e mosse di tutte le squadre insieme.
      const first = teamAssets[0];
      const players = new Map(teamAssets.flatMap(entry => Array.from(entry.players.entries())));
      const teamOf = new Map(teamAssets.flatMap(entry => Array.from(entry.players.keys()).map(pid => [pid, entry])));
      const moves = teamAssets.length === 1 ? first.moves :
        {...first.moves, players:Object.assign({}, ...teamAssets.map(entry => entry.moves.players))};
      assets = Object.freeze({team:first.team, setup:first.setup, moves, players, teams:teamAssets, teamOf});
      return assets;
    }).catch(error => { assetsPromise = null; throw error; });
    return assetsPromise;
  }
  function player(pid) {
    if (asId(pid) === global.RoadToGloryHalloweenCompletion?.PLAYER_ID)
      return global.RoadToGloryHalloweenCompletion.player();
    const raw = assets?.players?.get(asId(pid));
    if (!raw) return null;
    const moves = assets.moves.players[asId(pid)]?.moves || [];
    const teamConfig = assets.teamOf?.get(asId(pid))?.config || manifest.team;
    const statKeys = ["attack","control","speed","grit","physical","stamina","defense","save"];
    const stats = Object.fromEntries(statKeys.map(k => [k, Math.max(0, Number(raw[k]||0)*10)]));
    return {
      ...raw, ...stats, playerId:asId(raw.playerId), cardId:EVENT_ID+"::"+asId(raw.playerId),
      legacySeasonId:EVENT_ID, resolvedSeasonId:EVENT_ID, teamId:teamConfig.teamId,
      teamName:teamConfig.name, teamLogoUrl:teamConfig.logo || LOGO_URL, level:20, stats, baseStats:stats,
      normalizedRole:raw.position, finalOverall:Number(raw.overall)||0,
      category:raw.category, finalRarity:raw.category, activeMove:moves[0] || null,
      halloweenMoves:moves, halloweenVampire:!SPECIAL.includes(asId(pid)),
      frontFullbodyUrl:raw.frontFullbodyUrl || EVENT_FULLBODY_URLS[asId(pid)] || null,
      fullbodyUrl:raw.frontFullbodyUrl || EVENT_FULLBODY_URLS[asId(pid)] || null,
      portraitUrl:raw.portraitUrl
    };
  }
  function eventState(raw) {
    if (raw == null) return {...Object.fromEntries(CURRENCIES.map(c => [c.field, 0])), ownedIds:[], pullCount:0, completedIds:[], luckyWins:0};
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      !Number.isSafeInteger(raw[CURRENCY]) || raw[CURRENCY] < 0 ||
      !Number.isSafeInteger(raw.pullCount) || raw.pullCount < 0 ||
      !Number.isSafeInteger(raw.luckyWins) || raw.luckyWins < 0 ||
      !Array.isArray(raw.ownedIds) || !Array.isArray(raw.completedIds) ||
      new Set(raw.ownedIds).size !== raw.ownedIds.length ||
      new Set(raw.completedIds).size !== raw.completedIds.length ||
      raw.ownedIds.some(id => !OWNED_ID.test(id)) ||
      raw.completedIds.some(id => typeof id !== "string" || !id || id.length > 120) ||
      CURRENCIES.slice(1).some(c => raw[c.field] !== undefined && (!Number.isSafeInteger(raw[c.field]) || raw[c.field] < 0)))
      throw fail("halloween-invalid-account");
    // Monete in piu' (Parte 2 a): uno stato vecchio senza il loro campo parte da 0.
    return {...Object.fromEntries(CURRENCIES.slice(1).map(c => [c.field, 0])), ...clone(raw)};
  }
  function opponentOverall(teamId=TEAM_ID) {
    if (!assets) throw fail("halloween-assets-not-ready");
    const team=assets.teams?.find(entry=>entry.config.teamId===teamId)||assets.teams?.[0];
    const vals=(team?.setup||assets.setup).startingXI.map(id=>assets.players.get(asId(id))?.overall);
    return Math.round(vals.reduce((a,b)=>a+Number(b),0)/vals.length);
  }
  function ovr(lineup,discount=null) {
    return !Array.isArray(lineup) || lineup.length !== 11 ? null :
      Math.round((lineup.reduce((sum,p)=>{
        const value=Math.max(0,Number(p?.overall ?? p?.finalOverall ?? 0));
        return sum+(p?.cardId===discount?.cardId?Math.max(0,value-Math.max(0,Number(discount.amount)||0)):value);
      }, 0)/11)*10)/10;
  }
  function weightedPick(missing, random) {
    const pool = missing.map(pid => ({pid,weight:PULL_WEIGHTS.get(pid) ??
      (pid===HALLOWEEN_COACH_ID||SPECIAL.includes(pid)?4:5.75)}));
    const total = pool.reduce((n,item)=>n+item.weight,0);
    if (!pool.length || !Number.isFinite(random) || random < 0 || random >= 1) throw fail("halloween-invalid-pull");
    let n = random * total;
    for (const item of pool) { n -= item.weight; if (n < 0) return item.pid; }
    return pool[pool.length-1].pid;
  }
  function create(deps = {}) {
    const app = deps.app, storage = deps.storage || global.RoadToGloryStorage.create();
    const notify = deps.toast || (()=>{});
    const devMode = deps.devMode === true;
    let data = null, shared = null, localSquad = null, match = null, view = "match", busy = false, squadEditPending = false, actionPending = false;
    let tick = null, matchTimer = null, session = 0, search = "", detailPid = "", activeSquadSlot = 1, squadSlots = null;
    let halftimeDraft=null,halfSelected="",encounterSelection="",encounterKey="",lastResolution=null,lastResolutionStage="resolved",pendingRevealHidden=false;
    let selectedAlbumTeamId=TEAM_ID;
    let selectedVendingTeamId=TEAM_ID;
    let challengeTeamId=TEAM_ID; // squadra da sfidare (la home di un evento puo' sceglierla)
    let sandboxSeed=null;
    // Classi in piu' sulla finestra della scheda, dal pezzo aggiuntivo dell'evento (Halloween: vampiro).
    let modalExtraClass="";
    function setModalExtraClass(p){
      const modal=deps.getModalRoot?.();
      if(modalExtraClass)modal?.classList?.remove?.(...modalExtraClass.split(" ").filter(Boolean));
      modalExtraClass=String(global.GameEvents?.hook?.(EVENT_ID,"classes",p,"detail-modal")||"");
      if(modalExtraClass)modal?.classList?.add?.(...modalExtraClass.split(" ").filter(Boolean));
    }
    let vendingMotion=null;
    let lastPresentedView=null;
    const assertCurrent = epoch => { if (epoch !== session) throw fail("halloween-stale-controller"); global.RoadToGloryPersistence?.assertWritable?.(); };
    function dispose() { session++; if (tick != null) global.clearInterval?.(tick); tick = null;
      if(matchTimer!=null)global.clearTimeout?.(matchTimer);matchTimer=null;
      vendingMotion?.stop?.();vendingMotion=null;lastResolution=null;lastResolutionStage="resolved";pendingRevealHidden=false;lastPresentedView=null;
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native");setModalExtraClass(null);
      // Passo 3.6: i colori dell'evento valgono solo mentre l'evento e' aperto.
      global.GameEvents?.clearTheme?.(app);global.GameEvents?.clearTheme?.(deps.getModalRoot?.());
    }
    function listen() { if(tick!=null)global.clearInterval?.(tick);tick=global.setInterval?.(()=>{const el=app?.querySelector?.("[data-halloween-countdown]"); if(el)el.textContent=isOpen()?countdown():"EVENTO TERMINATO";if(!isOpen())app?.querySelectorAll?.("[data-halloween-start],[data-halloween-pull]")?.forEach(b=>b.disabled=true);},1000); }
    function readAccount(record) { const current = record || {}; return {...clone(current),tokens:current.tokens??0,gachaAcquiredCards:current.gachaAcquiredCards||[],developmentByCardId:current.developmentByCardId||{},coachOwnedIds:current.coachOwnedIds||[],
      ...global.GameEvents.withLedger(current,manifest,eventState(ledger(current)))}; }
    function lock() { global.RoadToGloryPersistence?.assertWritable?.(); global.PersistenceRecoveryGuard?.assertWritable?.(); }
    async function load() {
      const records = await storage.readMany([SHARED_KEY,SQUAD_KEY,MATCH_KEY]);
      if (SANDBOX && records[SHARED_KEY] == null) sandboxSeed = clone((await storage.readMany([REAL_SHARED_KEY]))[REAL_SHARED_KEY] || {});
      shared = readAccount(records[SHARED_KEY] ?? (SANDBOX ? sandboxSeed : null));
      const stored = records[SQUAD_KEY] || null;
      activeSquadSlot = Number(stored?.activeSquadSlot)||1;
      squadSlots = stored?.slots || null;
      localSquad = stored?.slots?.[activeSquadSlot] || stored || initialEventSquad();
      const savedCards=[...(localSquad?.lineup||[]),...(localSquad?.bench||[])];
      const accessible=new Set(userCards());
      if ((localSquad?.lineup||[]).length!==11||(localSquad?.bench||[]).length!==4||
          new Set(savedCards).size!==15||
          savedCards.some(cardId=>!accessible.has(cardId)||!resolveCard(cardId)))
        localSquad=initialEventSquad(localSquad);
      if (!localSquad?.formationId) localSquad = {...localSquad,formationId:"4-3-3",activeRoleVariantByCardId:{}};
      localSquad=orderedEventSquad(localSquad);
      match = records[MATCH_KEY] || null;
    }
    function recordCard(pid) {
      const meta=global.RoadToGloryCardIdentity?.record({playerId:pid,legacySeasonId:EVENT_ID});
      if (!meta?.cardId || meta.cardId !== EVENT_ID+"::"+pid) throw fail("halloween-card-identity-invalid");
      return clone(meta);
    }
    async function mutate(label, handler, keys=[SHARED_KEY]) {
      if (busy) throw fail("halloween-busy");
      busy = true;
      try {
        lock();
        const epoch = session;
        const saved = await storage.updateMany(keys, records => {
          const before = readAccount(records[SHARED_KEY] ?? (SANDBOX ? sandboxSeed : null)), next = clone(before);
          const updated = handler(next, records);
          if (updated && typeof updated.then === "function") throw fail("halloween-async-mutation");
          eventState(ledger(next));
          const writes = {[SHARED_KEY]:next};
          if (updated?.writes) Object.assign(writes,updated.writes);
          return {writes,value:{account:next,match:updated?.match??null,selection:updated?.selection??null}};
        });
        assertCurrent(epoch);
        await load();
        return saved;
      } finally { busy = false; }
    }
    function unlockedFreeAgentIds(){
      // Identical canonical unlock source as normal RTG. DEV pumpkins never
      // grant free agents. Missing album metadata must fail closed.
      return global.RoadToGloryEntitlements?.unlockedFreeAgentIds?.({
        albumProgress:deps.getAlbumProgress?.()||global.AlbumProgress,freeAgentsDb:data.freeAgents
      })||[];
    }
    function userCards() {
      const r=global.RoadToGloryCardIdentity;
      const all=[...unlockedFreeAgentIds().map(pid=>r.cardIdForFreeAgent(pid)),
        ...(shared?.gachaAcquiredCards||[]).map(p=>p.cardId)];
      return Array.from(new Set(all)).filter(Boolean);
    }
    function eligibleFreeAgentIds(){return unlockedFreeAgentIds();}

    function resolveCard(cardId) {
      if(cardId.startsWith(EVENT_ID+"::"))return global.RoadToGloryPlayerResolver?.resolveOwnedAtLevel20?.(
        cardId,"ie1",null,data?.freeAgents,shared?.developmentByCardId||{}
      ) || player(cardId.split("::")[1]);
      return global.RoadToGloryPlayerResolver?.resolveOwnedAtLevel20?.(cardId,"ie1",null,data.freeAgents,shared?.developmentByCardId||{})||null;
    }
    function resolvedUser() {
      const line=(localSquad?.lineup||[]).map(resolveCard);
      const bench=(localSquad?.bench||[]).map(resolveCard);
      if(line.length!==11 || line.some(p=>!p) || bench.length!==4 || bench.some(p=>!p) ||
         new Set([...(localSquad?.lineup||[]),...(localSquad?.bench||[])]).size!==15)return null;
      const formationId=localSquad?.formationId||"4-3-3";
      const formation=(global.RoadToGloryConfig?.season?.("ie1")?.formations||[]).find(f=>asId(f.id)===formationId);
      const slots=Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11?formation.slotRoles:null;
      return {formationId,seasonId:"ie1",lineup:line.map((p,i)=>({...p,tacticalRole:slots?.[i]||p.tacticalRole||p.normalizedRole||p.position})),bench:bench.filter(Boolean),coachId:localSquad?.coachId||""};
    }
    function opponent() {
      // Formazione avversaria dal file della formazione dell'evento (bossFormation: Halloween 4-4-2, prova 4-2-4).
      // Avversario: una squadra dell'evento (la prima se non scelta; piu' squadre dalla Parte 2 a).
      const opponentTeam=(assets.teams||[]).find(entry=>entry.config.teamId===challengeTeamId)||assets.teams?.[0]||{config:manifest.team,setup:assets.setup,players:assets.players};
      const xi=opponentTeam.setup.startingXI;
      return {name:opponentTeam.config.name,teamId:opponentTeam.config.teamId,logoUrl:opponentTeam.config.logo||LOGO_URL,seasonId:EVENT_ID,formationId:opponentTeam.setup.bossFormation,
        lineup:xi.map(pid=>player(pid)),bench:Array.from(opponentTeam.players.keys()).filter(pid=>!xi.includes(pid)).map(pid=>player(pid))};
    }
    function currency(n,cur=CUR) { return '<span class="halloween-currency"><img src="'+escape(cur.icon||PUMPKIN_URL)+'" alt="">'+escape(n)+'</span>'; }
    // Portafoglio: una pillola per moneta (Halloween: una sola, come prima).
    const curOf = field => CURRENCIES.find(c => c.field === field) || CUR;
    const walletPills = () => CURRENCIES.map(c => currency(ledger(shared)?.[c.field]||0, c)).join("");
    function isOwned(pid) {
      if(asId(pid)===global.RoadToGloryHalloweenCompletion?.PLAYER_ID)
        return global.RoadToGloryHalloweenCompletion.owns(shared);
      return ledger(shared).ownedIds.includes(pid);
    }
    function halloweenPrizeIds(account,teamId=selectedVendingTeamId) {
      const split=Boolean(currencyForTeam(teamId));
      const missing=Array.from(assets.players.keys()).filter(pid=>
        !ledger(account).ownedIds.includes(pid) &&
        (!split||assets.teamOf?.get(pid)?.config?.teamId===teamId));
      if(HALLOWEEN_COACH_ID&&!account.coachOwnedIds.includes(HALLOWEEN_COACH_ID))
        missing.push(HALLOWEEN_COACH_ID);
      return missing;
    }
    async function grantCompletionReward() {
      const bonus=global.RoadToGloryHalloweenCompletion;
      // Il premio finale appartiene solo all'evento che lo ha nel suo file (Halloween: Shawn).
      if (!manifest.completionReward || !isOpen() || !bonus?.eligible?.(shared,assets?.players) || bonus.owns(shared)) return false;
      let granted=false;
      await mutate("halloween-completion-reward",account=>{
        granted=bonus.grant(account,assets.players);
      });
      return granted;
    }
    function showCompletionReward() {
      const bonus=global.RoadToGloryHalloweenCompletion;
      const p=bonus?.player?.();
      if(!p||!deps.openModal||!deps.runView?.pullResultMarkup)return;
      const result={cardId:bonus.CARD_ID,playerId:bonus.PLAYER_ID,
        legacySeasonId:EVENT_ID,rarity:p.category};
      const original=deps.runView.pullResultMarkup(result,p,{
        teams:[{teamId:TEAM_ID,teamName:TEAM_NAME,logoUrl:LOGO_URL}]
      });
      const native=original.replace(/<div class="rtg-pull-balance">[\s\S]*?<\/div>/,"")
        .replace("NUOVO GIOCATORE","PREMIO SEGRETO")
        .replace(/ROAD TO GLORY · LEGACY [^<]*/,UI.tag);
      const html='<div class="halloween-completion-reward">'+
        '<div class="halloween-completion-heading"><span>'+uiText("completionTitle")+'</span>'+
        '<h2>PREMIO PER IL COMPLETAMENTO DELL\'EVENTO</h2>'+
        '<p>Hai ottenuto tutti i '+ROSTER_SIZE+' giocatori e l\'allenatore '+uiText("short")+'!</p></div>'+
        native+'</div>';
      deps.openModal(html,{className:"rtg-modal rtg-pull-modal rtg-halloween-pull-modal rtg-halloween-completion-modal"});
      modalRoot()?.querySelector?.("[data-rtg-pull-continue]")?.addEventListener("click",()=>deps.closeModal?.());
      modalRoot()?.querySelector?.("[data-rtg-pull-player-detail]")?.addEventListener("click",()=>openNativeDetail(bonus.CARD_ID));
    }
    function returnToEventHome() {
      let awarded=false;
      return perform(async()=>{
        awarded=await grantCompletionReward();
        view="match";
      }).then(()=>{if(awarded)showCompletionReward();});
    }
    // Same positional XI contract as ordinary Road to Glory. A card's
    // natural role must never decide whether it is visible on the field.
    // Older valid Halloween squads can be converted in RAM, without writes.
    function tacticalSlotRoles(formationId){
      const formation=(global.RoadToGloryConfig?.season?.("ie1")?.formations||[])
        .find(f=>asId(f.id)===asId(formationId||"4-3-3"));
      const slots=Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11
        ? formation.slotRoles
        : Object.entries(formation?.requirements||{FW:3,MF:3,DF:4,GK:1})
          .flatMap(([role,count])=>Array.from({length:Number(count)||0},()=>role));
      if(slots.length!==11)throw fail("halloween-invalid-formation-slots");
      return slots.map(role=>asId(role).toUpperCase());
    }
    function orderedEventSquad(input){
      const squad=clone(input);
      if(squad.lineupOrderedBySlot===true||!Array.isArray(squad.lineup)||squad.lineup.length!==11)
        return squad;
      const remaining=[...squad.lineup];
      const lineup=tacticalSlotRoles(squad.formationId).map(role=>{
        const index=remaining.findIndex(cardId=>
          asId(resolveCard(cardId)?.normalizedRole||resolveCard(cardId)?.position).toUpperCase()===role);
        return remaining.splice(index>=0?index:0,1)[0];
      });
      return {...squad,lineup,lineupOrderedBySlot:true};
    }
    // Keep the original RTG cards and pitch; assign the XI to tactical rows
    // by POSITION, never by the player's natural role. This makes off-role
    // swaps visible even for legacy or previously converted Halloween saves.
    function tacticalLineupModel(model){
      const lineup=model?.lineup||[];
      if(lineup.length!==11)throw fail("halloween-squad-incomplete");
      const formation=model?.formation || (global.RoadToGloryConfig?.season?.("ie1")?.formations||[])
        .find(f=>asId(f.id)===asId(localSquad?.formationId)) ||
        {requirements:{FW:3,MF:3,DF:4,GK:1}};
      const rows=global.FormationLayout?.displayRows?.(formation) ||
        ["FW","MF","DF","GK"].map(role=>({
          role,count:Number(formation?.requirements?.[role]||0)
        })).filter(row=>row.count);
      if(rows.reduce((n,row)=>n+Number(row.count||0),0)!==11)
        throw fail("halloween-invalid-formation-slots");
      let index=0;
      const lineupRows=rows.map(row=>{
        const entries=lineup.slice(index,index+Number(row.count));
        index+=Number(row.count);
        return {...row,entries};
      });
      if(index!==11||new Set(lineupRows.flatMap(row=>row.entries.map(entry=>asId(entry?.cardId||entry?.playerId||entry)))).size!==11)
        throw fail("halloween-squad-incomplete");
      return {...model,lineupRows};
    }
    function assertEventSquadIntegrity(squad){
      const all=[...(squad?.lineup||[]),...(squad?.bench||[])];
      if(squad?.lineup?.length!==11||squad?.bench?.length!==4||
         new Set(all).size!==15||squad.lineupOrderedBySlot!==true)
        throw fail("halloween-squad-incomplete");
      const allowed=new Set(userCards());
      if(all.some(cardId=>!allowed.has(cardId)||!resolveCard(cardId)))
        throw fail("halloween-squad-incomplete");
      tacticalSlotRoles(squad.formationId);
    }
    function initialEventSquad(previous={}) {
      const chosenLine=Array.isArray(previous.lineup)?previous.lineup.map(asId):[];
      const chosenBench=Array.isArray(previous.bench)?previous.bench.map(asId):[];
      const allowed=new Set(userCards());
      const valid=id=>allowed.has(id)&&!!resolveCard(id);
      const unique=ids=>Array.from(new Set(ids.filter(valid)));
      const line=unique(chosenLine),bench=unique(chosenBench).filter(id=>!line.includes(id));
      const formationId=previous.formationId||"4-3-3";
      const formation=(global.RoadToGloryConfig?.season?.("ie1")?.formations||[]).find(f=>asId(f.id)===formationId);
      if(line.length===11&&bench.length===4){
        return orderedEventSquad({...previous,formationId,lineup:line,bench,
          activeRoleVariantByCardId:previous.activeRoleVariantByCardId||{}});
      }
      const roles=Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11
        ?formation.slotRoles.map(role=>asId(role).toUpperCase())
        :Object.entries(formation?.requirements||{FW:3,MF:3,DF:4,GK:1})
          .flatMap(([role,count])=>Array.from({length:Number(count)||0},()=>role));
      if(roles.length!==11)throw fail("halloween-invalid-formation-slots");
      const pool=unique([...line,...bench,...userCards()]);
      // Preserve every still-owned starter of an old incomplete/duplicate save.
      // The normal RTG editor permits an off-role starter on any tactical slot,
      // so never discard a selected player merely to fill natural-role quotas.
      const picked=[...line].slice(0,11),used=new Set(picked);
      const roleFor=id=>asId(resolveCard(id)?.normalizedRole||resolveCard(id)?.position).toUpperCase();
      const rolesToFill=[...roles];
      for(const id of picked){
        const index=rolesToFill.indexOf(roleFor(id));
        if(index>=0)rolesToFill.splice(index,1);
      }
      for(const role of rolesToFill){
        if(picked.length>=11)break;
        const candidate=pool.find(id=>!used.has(id)&&roleFor(id)===role)||pool.find(id=>!used.has(id));
        if(!candidate)throw fail("halloween-squad-insufficient-players");
        used.add(candidate);picked.push(candidate);
      }
      const reserves=unique([...bench,...line,...pool]).filter(id=>!used.has(id)).slice(0,4);
      if(reserves.length!==4)throw fail("halloween-bench-insufficient");
      return orderedEventSquad({...previous,formationId,lineup:picked,bench:reserves,
        lineupOrderedBySlot:false,coachId:previous.coachId||"",
        activeRoleVariantByCardId:previous.activeRoleVariantByCardId||{}});
    }
    function activeEventSquad() {return {...shared,activeSeasonId:"ie1",gachaAcquiredCards:shared.gachaAcquiredCards,coachOwnedIds:shared.coachOwnedIds,squads:{ie1:localSquad}};}
    function eventOverallDiscount(squad=localSquad){
      return global.RoadToGloryCoachPowerRuntime?.overallDiscountFor?.(squad,activeEventSquad())||null;
    }
    function upgradeEventCoachRarity(player,targetRarity,cardId){
      if(!asId(cardId).startsWith(EVENT_ID+"::"))return null;
      // Unlike the ordinary Season resolver, event cards have no progression
      // database. Work solely on the temporary snapshot; use the same
      // canonical stat-growth oracle and rarity thresholds as normal RTG.
      const progression=global.InazumaProgression;
      const threshold=progression?.RARITY_THRESHOLDS?.find?.(
        row=>row.category===targetRarity)?.min;
      const current=Number(player?.overall??player?.finalOverall);
      const next=Math.min(99,Math.max(current+1,Number(threshold)));
      if(!Number.isFinite(current)||!Number.isInteger(threshold)||
         !Number.isFinite(next)||next<=current)return null;
      const before=player.stats||player.baseStats;
      const stats=progression?.growPlayerStatsToTargetOverall?.({
        role:player.position||player.normalizedRole,
        originalStats:before,currentStats:before,
        currentOverall:current,targetOverall:next
      });
      if(!stats||typeof stats!=="object")return null;
      return {...player,...stats,stats,overall:next,finalOverall:next,
        category:targetRarity,finalRarity:targetRarity,potential:next};
    }
    function resolvedPowerRoster(squad){
      // Coach validation needs the resolved 15 cards, not raw saved ID strings.
      // Never modify canonical lineup, bench or player development here.
      const unpack=keys=>(keys||[]).map(cardId=>{
        const p=resolveCard(cardId);
        return p?{...p,cardId}:null;
      });
      return {lineup:unpack(squad?.lineup),bench:unpack(squad?.bench)};
    }
    // Only the Squadra player detail gets the saved, currently valid power
    // projection. Album, collection, prizes and match details remain independent.
    function squadCoachDetailPreview(cardId,player){
      if(view!=="squad"||!localSquad?.coachPowerSelection||
         ![...(localSquad.lineup||[]),...(localSquad.bench||[])].includes(cardId))
        return null;
      const rules=global.RoadToGloryCoachPowerRuntime;
      const coachId=asId(localSquad.coachId);
      if(!shared?.coachOwnedIds?.includes(coachId))return null;
      const roster=resolvedPowerRoster(localSquad);
      const config=rules?.validConfig?.(localSquad,roster.lineup,"ie1",roster.bench);
      if(!config||!config.cardIds?.includes(cardId))return null;
      if(global.RoadToGloryCoachPowerTypes?.typeOf?.(coachId)==="rarityUpgrade"&&cardId.startsWith(EVENT_ID+"::")){
        // Event cards have no Season progression source. Reuse the exact
        // temporary upgrade used at Halloween kickoff, only for this preview.
        const nextRarity=rules?.nextRarity?.(rules.rarityOf(player));
        const upgraded=nextRarity&&upgradeEventCoachRarity(player,nextRarity,cardId);
        if(!upgraded)return null;
        const labels={attack:"Tiro",control:"Controllo",speed:"Velocità",
          stamina:"Resistenza",grit:"Grinta",defense:"Difesa",
          physical:"Fisico",save:"Parata"};
        const stats=Object.keys(labels).map(k=>({
          label:labels[k],before:Number(player.stats?.[k]||0),
          after:Number(upgraded.stats?.[k]||0)
        })).filter(item=>item.after>item.before);
        return {coachId,original:player,player:upgraded,stats,costs:{},moveElements:{},
          pt:global.RtgFourMovesRuntime?.ptBreakdown?.(upgraded.stats,nextRarity)||null,
          note:"POTENZIALE RISVEGLIATO · "+rules.rarityOf(player)+" → "+
            nextRarity+" · OVR "+Number(player.overall)+" → "+Number(upgraded.overall)+
            " in partita. Nessun cambiamento permanente; requisiti invariati."};
      }
      if(coachId===HALLOWEEN_COACH_ID){
        return {coachId,original:player,player,stats:[],costs:{},moveElements:{},
          note:"MASCHERA MALEDETTA · questo giocatore conta 15 OVR in meno "+
            "soltanto per i requisiti dell'evento. Statistiche e partita invariati."};
      }
      return global.RoadToGloryCoachSquadPreview?.projected?.({
        player,cardId,squad:localSquad,state:activeEventSquad(),
        seasonId:"ie1",playerResolver:global.RoadToGloryPlayerResolver,
        freeAgentsDb:data.freeAgents
      })||null;
    }
    function nativeCard(p,opts={}) {
      const eventCardClass=opts.event?global.GameEvents?.hook?.(EVENT_ID,"classes",p,"event-card")||"":"";
      const cls=eventCardClass?" "+eventCardClass:"";
      const attr=opts.attr||"";
      return typeof deps.compactPlayerCardMarkup==="function"
        ? deps.compactPlayerCardMarkup(p,{level:20,overall:p?.overall??p?.finalOverall,
            dataAttr:attr,extraClass:"halloween-native-card"+cls})
        : '<button type="button" class="player-card player-card-compact '+cls+'" '+attr+'><span class="player-corner player-role">'+escape(p.position||"")+'</span><span class="player-corner player-overall">'+escape(p.overall||"")+'</span><img class="player-portrait" src="'+escape(p.portraitUrl||"")+'" alt=""><strong>'+escape(p.name||"")+'</strong></button>';
    }
    function openNativeDetail(cardId,albumUnlocked=false,fromAlbum=false,matchPlayer=null) {
      // The match owns the snapshot of temporary powers. Squadra shows the
      // configured preview without ever altering the canonical owned card.
      const original=matchPlayer?.cardId===cardId?matchPlayer:resolveCard(cardId);
      if(!original)return;
      const info=!fromAlbum&&!matchPlayer?squadCoachDetailPreview(cardId,original):null;
      const p=info?.player||original;
      // The generic RTG detail resolver cannot resolve an unowned event card.
      // Use this event player's canonical render directly, even when locked.
      if(deps.showPlayerDetailsFor) {
        deps.showPlayerDetailsFor(p,{playerId:p.playerId,level:20,readOnly:true,rtgFourMoves:true,
          moveSeasonId:p.halloweenMoves?EVENT_ID:(p.resolvedSeasonId||p.legacySeasonId||"ie1"),
          rtgRarity:p.category,mode:fromAlbum?"album":"current",albumUnlocked});
        if(info)global.RoadToGloryCoachSquadPreview?.decorateDetail?.({
          root:deps.getModalRoot?.(),info
        });
      } else if(deps.openPlayerDetails) {
        deps.openPlayerDetails(cardId,"",{mode:fromAlbum?"album":undefined,albumUnlocked});
      }
      const modal=deps.getModalRoot?.();
      modal?.classList?.toggle("halloween-detail-native",Boolean(p.halloweenMoves));
      setModalExtraClass(p);
    }
    function footer(active="run") {
      return '<nav class="bottom-nav rtg-bottom-nav" aria-label="'+uiText("appAria")+'">'+
      '<button type="button" data-halloween-tab="match" class="'+(active==="run"?"active":"")+'"><span class="nav-icon">▱</span><span class="nav-label">RUN</span></button>'+
      '<button type="button" data-halloween-tab="squad" class="'+(active==="squad"?"active":"")+'"><span class="nav-icon">♧</span><span class="nav-label">SQUADRA</span></button></nav>';
    }
    function shell(body) {
      return '<main class="screen rtg-run-screen rtg-halloween-run-screen halloween-screen">'+
       '<header class="topbar rtg-main-topbar halloween-original-topbar"><button type="button" class="btn rtg-home-button" data-halloween-back aria-label="Torna alle campagne"><span>←</span></button>'+
       '<div class="rtg-main-title"><p class="eyebrow">ROAD TO GLORY · EVENTO</p><strong class="brand">'+uiText("brand")+'</strong><span data-halloween-countdown>'+(isOpen()?countdown():"EVENTO TERMINATO")+'</span></div>'+
       '<div class="status-strip"><span class="status-pill halloween-wallet">'+walletPills()+'</span></div></header>'+
       '<div class="content narrow rtg-run-content halloween-original-content">'+body+'</div>'+footer("run")+'</main>';
    }
    function matchSection() {
      const target=opponentOverall(),ours=resolvedUser(),own=ovr(ours?.lineup,eventOverallDiscount()),limit=target+1;
      const eligible=Boolean(ours&&own!==null&&own<=limit),active=Boolean(match),open=isOpen();
      const overLimit=own!==null&&own>limit;
      const status=active?"PARTITA IN CORSO":!ours?"FORMAZIONE INCOMPLETA":overLimit?"LIMITE SUPERATO":"PRONTA PER LA SFIDA";
      const statusMessage=overLimit?"Riduci l'OVR a "+limit+" per accedere alla sfida.":!ours?"Servono 11 titolari e 4 riserve.":active?"Riprendi la partita dal punto in cui l'hai lasciata.":"Formazione valida · 11 titolari e 4 riserve.";
      const mainAction=active
        ? '<button type="button" class="btn btn-yellow halloween-event-main-cta" data-halloween-resume>RIPRENDI PARTITA →</button>'
        :eligible&&open
          ? '<button type="button" class="btn btn-yellow halloween-event-main-cta" data-halloween-start>PREPARA PARTITA →</button>'
          :!open
            ? '<button type="button" class="btn btn-yellow halloween-event-main-cta" disabled>EVENTO TERMINATO</button>'
            : '<button type="button" class="btn btn-yellow halloween-event-main-cta" data-halloween-tab="squad">SISTEMA LA SQUADRA →</button>';
      return '<section class="rtg-journey-summary halloween-journey-summary halloween-event-hero" aria-label="'+uiText("nextMatchAria")+'">'+
        '<div class="halloween-event-hero-top"><div class="halloween-event-hero-copy">'+
        '<p class="eyebrow">'+uiText("challengeEyebrow")+'</p><h1>'+UI.challengeTitle.map(escape).join("<br>")+'</h1>'+
        '<p>Vinci la partita: +'+PRIZE+' '+escape(CUR.unit)+'.</p></div>'+
        '<img class="halloween-event-hero-crest" src="'+escape(LOGO_URL)+'" alt="Stemma '+escape(TEAM_NAME)+'"></div>'+
        '<div class="halloween-event-ovr-strip" aria-label="Requisiti overall">'+
        '<div><span>OVR AVVERSARIO</span><strong>'+target+'</strong></div>'+
        '<div><span>OVR MASSIMO</span><strong>'+limit+'</strong></div>'+
        '<div class="'+(overLimit?"is-over-limit":!ours?"is-incomplete":"is-eligible")+'"><span>LA TUA SQUADRA</span><strong>'+escape(own??"—")+'</strong></div></div>'+
        '<div class="halloween-event-status '+(overLimit||!ours?"is-warning":"is-ready")+'"><strong>'+status+'</strong><span>'+statusMessage+'</span></div>'+
        mainAction+'</section>'+
        // Riquadro in piu' dal pezzo aggiuntivo dell'evento (se ce l'ha), prima del distributore.
        String(global.GameEvents?.hook?.(EVENT_ID,"homeSection",{eventId:EVENT_ID,labels:manifest.labels,escape})||"")+
        '<section class="panel rtg-run-command halloween-vending-banner halloween-vending-teaser" aria-label="'+uiText("vendingAria")+'">'+
        '<div class="halloween-vending-teaser-copy"><span class="eyebrow">'+uiText("capsuleEyebrow")+'</span>'+
        '<h2>'+uiText("vendingTitle")+'</h2><p>1 capsula · '+PRICE+' '+escape(CUR.unit)+'</p></div>'+
        '<button type="button" class="btn btn-yellow rtg-vending-button" data-halloween-open-vending>APRI DISTRIBUTORE →</button>'+
        '</section>'+opponentPreviewSection();
    }
    function opponentPreviewSection() {
      // Reuse the native prematch pitch and cards as a read-only projection.
      // No opponent regeneration, match mutations or new persistence keys.
      const formation=opponent();
      const pitch=deps.matchView?.formationPitchMarkup?.(formation,"opponent","prematch");
      if(!pitch)return "";
      return '<section class="halloween-opponent-preview halloween-native-match" aria-label="Formazione '+escape(TEAM_NAME)+'">'+
        '<header class="halloween-opponent-preview-head"><div><span class="eyebrow">SCOPRI GLI AVVERSARI</span><h2>FORMAZIONE '+escape(TEAM_NAME.toUpperCase())+'</h2></div>'+
        '<div class="halloween-opponent-preview-stats"><span>'+escape(formation.formationId)+'</span><strong>OVR '+escape(opponentOverall())+'</strong></div></header>'+
        '<div class="halloween-opponent-preview-field rtg-prematch-shell development-squad-card-scope">'+pitch+'</div>'+
        '<p class="halloween-opponent-preview-note">11 titolari · Stesse carte e posizioni del preview partita</p></section>';
    }
    function squadSection() {
      const view=deps.squadView;
      if(!view?.renderModel||!view?.markup)return '<p>Layout RTG non disponibile</p>';
      const freeAgentIds=eligibleFreeAgentIds();
      const model=tacticalLineupModel(view.renderModel({state:activeEventSquad(),freeAgentIds,seasonDb:global.SeasonRegistry?.database?.("ie1")||{},
          freeAgentsDb:data.freeAgents,playerResolver:{resolveAtLevel20:cardId=>resolveCard(cardId)}}));
      const meta=deps.getUserTeamMeta?.()||{};
      const name=meta.name||"La tua squadra";
      const squadOvr=ovr(resolvedUser()?.lineup,eventOverallDiscount());
      const requirement='<div class="rtg-requirements-list"><div class="rtg-requirement '+(squadOvr!=null&&squadOvr<=opponentOverall()+1?"ok":"bad")+'"><span>Overall max · '+escape(manifest.labels.source)+'</span><strong>'+escape(squadOvr??"—")+' / '+(opponentOverall()+1)+'</strong></div></div>';
      return '<div class="rtg-halloween-mode halloween-squad-mode">'+
        view.markup(model,{teamName:name,teamIdentity:meta.teamIdentity,teamPower:squadOvr,activeSquadSlot,
          coachSlotMarkup:global.RoadToGloryCoachesView?.squadSlot?.(
            activeEventSquad(),localSquad.coachId,
            localSquad.coachId===HALLOWEEN_COACH_ID&&!eventOverallDiscount()
              ?null:localSquad.coachPowerSelection)||"",
          requirementsMarkup:requirement,nextTeamName:TEAM_NAME,dirty:false})+'</div>';
    }
    function vendingSection() {
      const team=TEAMS.find(entry=>entry.teamId===selectedVendingTeamId)||TEAMS[0];
      const field=pullFieldForTeam(selectedVendingTeamId),coin=curOf(field);
      const available=halloweenPrizeIds(shared),enough=ledger(shared)[field]>=PRICE;
      const colors=team.theme?.colors||{};
      const teamStyle=["primary","secondary","accent","text","ink","surface","background"]
        .filter(key=>/^#[0-9a-fA-F]{6}$/.test(colors[key]||""))
        .map(key=>`--event-${key}:${colors[key]}`).join(";");
      const switchMarkup=TEAM_VENDING
        ?'<div class="event-vending-switch" role="group" aria-label="Scegli distributore">'+
          TEAMS.map(entry=>'<button type="button" data-event-vending-team="'+escape(entry.teamId)+'" '+
            'aria-pressed="'+(entry.teamId===selectedVendingTeamId?'true':'false')+'" '+
            (entry.teamId===selectedVendingTeamId?'class="active"':'')+'>'+escape(entry.name)+'</button>').join("")+'</div>'
        :"";
      const capsules=Array.from({length:12},(_,i)=>'<div class="rtg-vending-capsule-v9 c'+(i%6+1)+'" data-capsule-rarity="'+(i%2?"orange":"black")+'"></div>').join("");
      const teamBalance=TEAM_VENDING
        ?'<div class="vf-vending-balance"><img src="'+escape(coin.icon)+'" alt="">'+
          '<span>'+escape(coin.unitUpper)+'<small>SALDO DISPONIBILE</small></span>'+
          '<strong>'+escape(ledger(shared)[field])+'</strong></div>':'';
      const eventHeader=TEAM_VENDING
        ?'<header class="vf-vending-top"><div><small>EVENTO · DUE ELEMENTI</small><strong>'+escape(manifest.name)+'</strong></div>'+
          '<div class="vf-wallet">'+walletPills()+'</div></header>':'';
      return '<div class="halloween-vending '+(TEAM_VENDING?'vf-vending':'')+'" style="'+escape(teamStyle)+'">'+eventHeader+'<button type="button" class="halloween-vending-close" data-halloween-close-vending aria-label="Chiudi distributore">×</button><p class="eyebrow">'+uiText("vendingStation")+'</p><h2>'+uiText("vendingTitleLong")+'</h2>'+switchMarkup+teamBalance+
        '<div class="rtg-vending halloween-vending-classic"><div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="'+uiText("vendingAria")+'">'+
        '<div class="rtg-vending-head-v9"><span>CAPSULE STATION</span><strong>'+(TEAM_VENDING?escape(team.name):uiText("entrySubtitle"))+'</strong></div>'+
        '<div class="rtg-vending-window-v9">'+capsules+'<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div>'+
        '<div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>'+PRICE+'</strong></div>'+
        '<div class="rtg-vending-crank-v9"><span></span></div><div class="rtg-vending-chute-v9"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9">'+uiText("icon")+'</div></div></div>'+
        '<button class="btn btn-yellow rtg-vending-pull halloween-action" data-halloween-pull '+(!isOpen()||!enough||available.length===0?"disabled":"")+'>GIRA · '+currency(PRICE,coin)+'</button>'+
        (TEAM_VENDING?'':'<div class="rtg-vending-wallet-chip"><span>'+uiText("walletTitle")+'</span><strong>'+currency(ledger(shared)[field],coin)+'</strong></div>')+'</div></div>'+
        '</div>';
    }
    function eventAlbumTeams() {
      // Single event team today; future event teams can be added to this
      // collection without replacing the native RTG teams/roster screens.
      const teamRecords=(assets.teams||[{team:assets.team}]).map(entry=>entry.team);
      return teamRecords.filter(Boolean).map((team,index)=>{
        const bonus=global.RoadToGloryHalloweenCompletion;
        const extra=index===0&&manifest.completionReward&&bonus?.owns?.(shared)?[player(bonus.PLAYER_ID)]:[];
        const roster=[...(team.players||[]).map(raw=>isOwned(asId(raw.playerId))
          ?resolveCard(EVENT_ID+"::"+asId(raw.playerId)):player(raw.playerId)),...extra].filter(Boolean);
        return {teamId:asId(team.teamId),teamName:asId(team.teamName||team.name)||TEAM_NAME,
          logoUrl:team.logoUrl||LOGO_URL,roster,
          total:roster.length,unlocked:roster.filter(p=>isOwned(asId(p.playerId))).length};
      });
    }
    function albumSection() {
      const teams=eventAlbumTeams();
      const state={activeSeasonId:EVENT_ID};
      if(view==="album"){
        if(!deps.runView?.albumTeamsMarkup)return '<p>Album squadre RTG non disponibile</p>';
        return '<div class="rtg-halloween-mode halloween-album-mode">'+
          deps.runView.albumTeamsMarkup({state,seasonId:EVENT_ID,teams})
            .replace('<main class="album-screen album-teams-screen','<main class="album-screen halloween-event-album-teams album-teams-screen')
            .replace(/(<p class="eyebrow">)ALBUM → [^<]+/,(_all,open)=>open+uiText("albumPath"))+
          '</div>';
      }
      const team=teams.find(item=>item.teamId===selectedAlbumTeamId)||teams[0];
      if(!team||!deps.runView?.albumRosterMarkup)return '<p>Album giocatori non disponibile</p>';
      const entries=team.roster.filter(p=>isOwned(asId(p.playerId)));
      return '<div class="rtg-halloween-mode halloween-album-mode">'+
        deps.runView.albumRosterMarkup({
          state,seasonId:EVENT_ID,team,entries,allEntries:team.roster,
          database:{players:team.roster}
        }).replace('<main class="album-screen album-roster-screen','<main class="album-screen halloween-event-album-roster album-roster-screen')+
        '</div>';
    }

    function matchPitch(m,side){
      try{const view=global.RoadToGloryMatchView?.create?.({escapeHtml:escape});return view?.formationPitchMarkup?.(side==="user"?m.userSquad:m.opponentSquad,side,"live")||"";}
      catch(error){global.console?.warn?.("[Halloween] Pitch view fallback",error);return "";}
    }
    function pendingSection() {
      if(!match)return matchSection();
      const m=match,ended=["completed","completed-draw","abandoned"].includes(m.status);
      if(ended) return '<div class="halloween-graveyard"><div class="halloween-match-card"><h2>RISULTATO FINALE</h2><h1>'+escape(m.score.user)+' – '+escape(m.score.opponent)+'</h1><p>'+(m.status==="abandoned"?"Partita abbandonata":m.result?.winner==="user"?"VITTORIA!":"PARTITA CONCLUSA")+'</p><p>'+(m.status==="abandoned"?"":m.result?.winner==="user"&&m.halloweenAward?"Ricompensa accreditata: "+currency(m.halloweenAward):"Nessuna zucca ottenuta")+'</p><button class="halloween-action" data-halloween-close-result>TORNA ALL’EVENTO</button></div></div>';
      const info=m.pendingEncounter,options=info?.userMoveOptions||[];
      const status=m.status==="halftime"?"INTERVALLO":m.status==="penalties"?"CALCI DI RIGORE":info?"AZIONE DECISIVA":"INCONTRO";
      const opponentActor=[...(m.opponentSquad?.lineup||[]),...(m.opponentSquad?.bench||[])].find(p=>asId(p.cardId||p.playerId)===asId(info?.aiPlayerId));
      const actorVisual=opponentActor?'<div class="halloween-match-actor"><div class="'+escape(global.GameEvents?.hook?.(EVENT_ID,"classes",opponentActor,"actor")||'')+'"><img src="'+escape(opponentActor.fullbodyUrl||opponentActor.portraitUrl||'')+'" alt="'+escape(opponentActor.name||'')+'"></div><strong>'+escape(opponentActor.name||'')+'</strong></div>':'';
      return '<div class="halloween-graveyard"><div class="halloween-match-card"><div class="halloween-match-brand"><img class="halloween-crest '+escape(global.GameEvents?.hook?.(EVENT_ID,"classes",null,"crest")||"")+'" src="'+escape(LOGO_URL)+'" alt=""><div><h2>'+status+'</h2><p>'+escape(TEAM_NAME)+'</p></div></div><h1>'+escape(m.score?.user||0)+' – '+escape(m.score?.opponent||0)+'</h1><div class="halloween-original-fields"><div class="halloween-pitch"><h3>LA TUA SQUADRA</h3>'+matchPitch(m,"user")+'</div><div class="halloween-pitch halloween-pitch--opponent"><h3>OCCULT HALLOWEEN</h3>'+matchPitch(m,"opponent")+'</div></div><p>'+escape(info?.kind||"")+' · '+escape(info?.userKind||"")+'</p>'+actorVisual+ (info?'<div class="halloween-choices"><button class="halloween-action" data-halloween-choice="base">AZIONE BASE</button>'+options.map((move,i)=>'<button data-halloween-choice="move:'+i+'">'+escape(move.name||move.moveId||"Tecnica")+' · PT '+escape(move.ptCost||move.power||0)+'</button>').join("")+'</div>':m.status==="halftime"?'<button class="halloween-action" data-halloween-halftime>RIPRENDI SECONDO TEMPO</button>':m.status==="penalties"?'<div class="halloween-choices">'+["left","center","right"].map(d=>'<button data-halloween-penalty="'+d+'">'+({left:"SINISTRA",center:"CENTRO",right:"DESTRA"}[d])+'</button>').join("")+'</div>':'<button class="halloween-action" data-halloween-next>PROSEGUI</button>')+'<p><button data-halloween-abandon>ABBANDONA PARTITA</button></p></div></div>';
    }
    function findNativeMatchPlayer(side,key){
      const team=side==="opponent"?match?.opponentSquad:match?.userSquad;
      return [...(team?.lineup||[]),...(team?.bench||[])].find(p=>asId(p.cardId||p.playerId)===asId(key))||null;
    }
    function nativePenaltyContext(m){
      const attackingSide=(m.shootout?.history?.length||0)%2===0?"user":"opponent";
      const attackers=(attackingSide==="user"?m.userSquad:m.opponentSquad)?.lineup||[];
      const defender=(attackingSide==="user"?m.opponentSquad:m.userSquad)?.lineup||[];
      const shooter=attackers.find(p=>String(p.tacticalRole||p.position)!=="GK")||attackers[0];
      const keeper=defender.find(p=>String(p.tacticalRole||p.position)==="GK")||defender[0];
      const userRole=attackingSide==="user"?"shot":"save";
      const userPlayer=attackingSide==="user"?shooter:keeper;
      const rules=global.RoadToGloryMatchPtRuntime,ptMode=rules?.inMatch?.(m)===true;
      const userOptions=ptMode?rules.compatible(m,"user",asId(userPlayer?.cardId||userPlayer?.playerId),userRole):[];
      return {attackingSide,shooter,keeper,userRole,ptMode,userOptions,userMove:userOptions[0]||null,userMoveAvailable:userOptions.length>0,
        userPt:rules?.pt?.(m,"user",asId(userPlayer?.cardId||userPlayer?.playerId))||null};
    }
    function nativeMatchMarkup(){
      const v=deps.matchView;if(!v||!match)return pendingSection();
      if(["completed","completed-draw","abandoned"].includes(match.status)&&!lastResolution){
        const award=Number.isInteger(match.halloweenAward)?match.halloweenAward:0;
        const won=match.status!=="abandoned"&&match.result?.winner==="user";
        const rewardCurrency=curOf(rewardFieldForTeam(match.opponentSquad?.teamId));
        const rewardHtml='<div class="halloween-final-award" role="status"><span>'+
          (match.status==="abandoned"?"PARTITA ABBANDONATA · NESSUN PREMIO":won?uiText("prizeCredited"):"SCONFITTA O PAREGGIO · NESSUN PREMIO")+
          '</span><strong>'+(won&&award>0?"+"+escape(award):"0")+' '+escape(rewardCurrency.unitUpper)+'</strong></div>';
        const result=v.resultMarkup(match,null).replace(/(<button[^>]*data-rtg-result-continue)/,rewardHtml+'$1');
        return '<main class="screen rtg-match-shell halloween-native-match"><div class="content narrow">'+result+'</div></main>';
      }
      if(match.presentation?.preMatchSeen===false)
        return v.preMatchMarkup(match).replace('<main class="screen','<main class="screen halloween-native-match');
      const presented=lastResolution&&["halftime","penalties","completed","completed-draw"].includes(match.status)?{...match,status:"active"}:match;
      return v.matchMarkup(presented).replace('<main class="screen','<main class="screen halloween-native-match');
    }
    function bindNativeMatch(){
      const v=deps.matchView,m=match;
      if(!v||!m)return;
      const done=["completed","completed-draw","abandoned"].includes(m.status);
      if((!done||lastResolution)&&m.presentation?.preMatchSeen!==false){
        const overlay=app.querySelector?.("[data-rtg-match-overlay]");
        if(overlay){
          // The native RTG controller always reveals the committed encounter
          // before showing halftime/penalties/final. The Halloween controller
          // must not let a terminal status cover that last duel result.
          if(lastResolution){
            overlay.innerHTML=lastResolutionStage==="comparison"&&v.finalComparisonMarkup?v.finalComparisonMarkup(lastResolution)
              :lastResolutionStage==="resolving"&&v.resolvingEncounterMarkup?v.resolvingEncounterMarkup(lastResolution)
              :v.resolvedEncounterMarkup(lastResolution);
          }else if(m.status==="halftime"){
            if(!halftimeDraft)halftimeDraft=clone(m.userSquad);
            overlay.innerHTML=v.halftimeMarkup(halftimeDraft,{match:m,selectedPlayerId:halfSelected});
          }else if(m.status==="penalties")overlay.innerHTML=v.penaltyMarkup(m,nativePenaltyContext(m));
          else if(m.pendingEncounter){
            if(pendingRevealHidden){overlay.innerHTML="";}else{
            const pending=m.pendingEncounter;
            if(encounterKey!==asId(pending.encounterId)){encounterKey=asId(pending.encounterId);encounterSelection="";}
            const user=findNativeMatchPlayer("user",pending.userPlayerId),opp=findNativeMatchPlayer("opponent",pending.aiPlayerId||pending.opponentPlayerId);
            overlay.innerHTML=v.encounterMarkup(m,{userPlayer:user,opponentPlayer:opp,selectedChoice:encounterSelection});
            }
          }
        }
      }
      v.bind(app,{
        onOpenPlayerDetails:(id,side)=>{
          const p=findNativeMatchPlayer(side,id);
          if(p)openNativeDetail(asId(p.cardId||p.playerId),false,false,p);
        },
        onPreMatchStart:()=>m.presentation?.preMatchPowerStatus==="pending"?openNativePreMatchCoachPower():perform(()=>stepMatch("prematch")),
        onPreMatchCoachPower:()=>openNativePreMatchCoachPower(),
        onEncounterChoice:(choice,confirm)=>{
          if(!m.pendingEncounter)return;
          if(choice==="list"){encounterSelection=choice;render();return;}
          if(confirm&&encounterSelection===choice){encounterSelection="";return perform(()=>stepMatch(choice));}
          encounterSelection=choice;render();
        },
        onAbandon:()=>perform(abandonMatch),
        onHalftimeConfirm:()=>perform(()=>stepMatch("halftime")),
        onPenaltyDirection:direction=>perform(()=>stepMatch("penalty:"+direction)),
        onPenaltyMove:index=>perform(()=>stepMatch("penalty-move:"+index)),
        onContinue:()=>perform(closeResult),
      });
      if(!done&&m.presentation?.preMatchPowerStatus==="pending"&&m.presentation?.preMatchSeen===false)openNativePreMatchCoachPower();
      if(!done&&m.status==="halftime"&&!lastResolution){
        app.querySelectorAll?.("[data-rtg-half-lineup]")?.forEach(b=>b.addEventListener("click",()=>{
          halfSelected=halfSelected===b.dataset.rtgHalfLineup?"":b.dataset.rtgHalfLineup;render();
        }));
        app.querySelectorAll?.("[data-rtg-half-bench]")?.forEach(b=>b.addEventListener("click",()=>{
          if(!halfSelected)return;
          const li=halftimeDraft.lineup.findIndex(p=>asId(p.cardId||p.playerId)===halfSelected);
          const bi=halftimeDraft.bench.findIndex(p=>asId(p.cardId||p.playerId)===b.dataset.rtgHalfBench);
          if(li<0||bi<0)return;
          const prior=halftimeDraft.lineup[li],next=halftimeDraft.bench[bi];
          halftimeDraft.lineup[li]={...next,tacticalRole:prior.tacticalRole||prior.normalizedRole||prior.position};
          halftimeDraft.bench[bi]={...prior};delete halftimeDraft.bench[bi].tacticalRole;
          halfSelected="";render();
        }));
      }
      app.querySelector?.("[data-rtg-duel-continue]")?.addEventListener("click",()=>{
        if(lastResolutionStage!=="resolved")return;
        lastResolution=null;
        // The terminal encounter has already been committed and awarded.
        // Keep its native duel result visible until the player continues.
        // Non-active statuses are already committed by the match engine:
        // acknowledge the duel, then reveal the native interval/final UI.
        if(match?.status!=="active")return render();
        return perform(()=>stepMatch(null));
      });
      if(lastResolution&&lastResolutionStage!=="resolved"&&typeof global.setTimeout==="function"){
        const epoch=session,stage=lastResolutionStage;
        matchTimer=global.setTimeout(()=>{matchTimer=null;if(epoch!==session||!lastResolution||lastResolutionStage!==stage)return;
          lastResolutionStage="resolved";render();
        },1700);
      }
      if(!done&&pendingRevealHidden&&m.pendingEncounter&&m.presentation?.preMatchSeen===true&&typeof global.setTimeout==="function"){
        const epoch=session,encounter=asId(m.pendingEncounter.encounterId);
        matchTimer=global.setTimeout(()=>{matchTimer=null;
          if(epoch!==session||asId(match?.pendingEncounter?.encounterId)!==encounter)return;
          pendingRevealHidden=false;render();
        },2200);
      }
      if(!done && m.status==="active" && !m.pendingEncounter && !lastResolution && m.presentation?.preMatchSeen===true && typeof global.setTimeout==="function"){
        const activeId=m.matchId,epoch=session;
        matchTimer=global.setTimeout(()=>{
          matchTimer=null;
          if(epoch===session&&view==="match"&&match?.matchId===activeId&&!busy)perform(()=>stepMatch(null));
        },50);
      }
    }
    function openNativePreMatchCoachPower(){
      if(!match||match.presentation?.preMatchPowerStatus!=="pending")return;
      const ui=global.RoadToGloryCoachPreMatchUi;
      ui?.open?.({getMatch:()=>match,squadView:deps.squadView,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
        closeModal:deps.closeModal,toast:notify,openPlayerDetails:(key,side)=>openNativeDetail(key),
        commit:async(id,selection,skip)=>{
          const epoch=session;
          const curr=match;
          const chosen=skip?global.RoadToGloryCoachPreMatchRuntime.skip(curr):
            global.RoadToGloryCoachPreMatchRuntime.apply(curr,curr.preMatchCoachId,selection);
          // Match the canonical RTG pre-match controller: invalid selection
          // must never persist a null match, and the next encounter is
          // prepared from the powered snapshot BEFORE the one atomic write.
          if(!chosen)throw fail("halloween-coach-selection-invalid");
          const prepared=global.RoadToGloryMatchEngine.prepareNext(chosen);
          await storage.updateMany([MATCH_KEY],records=>{
            if(records[MATCH_KEY]?.matchId!==id)throw fail("halloween-stale-match");
            return {writes:{[MATCH_KEY]:prepared},value:true};
          });
          assertCurrent(epoch);match=prepared;
        },
        render:()=>render()});
    }

    function modalRoot(){return deps.getModalRoot?.() || app;}
    // Keep the Halloween squad picker aligned with the canonical RTG team
    // labels. Raw team IDs such as "ace_invaders" and "alpine" are aliases,
    // not additional teams alongside "Ace Invaders" and "Alpine".
    function pickerTeamLabels(p,seasonId) {
      const db=global.SeasonRegistry?.database?.(seasonId);
      const teamNames=new Map((db?.teams||[]).map(team=>[
        asId(team?.teamId||team?.id),asId(team?.teamName||team?.name)
      ]).filter(([id,name])=>id&&name));
      const normalize=name=>asId(name).replace(/[_-]+/g," ").replace(/\s+/g," ").trim().toLocaleLowerCase("it");
      const labels=new Map();
      const raw=[p.teamName,...(p.teams||[]),p.resolvedTeamId,p.teamId,...(p.teamIds||[])];
      for(const item of raw){
        if(typeof item!=="string")continue;
        const value=asId(item);if(!value)continue;
        const canonical=teamNames.get(value);
        const label=canonical|| (value.includes("_") ? value.split("_").filter(Boolean)
          .map(word=>word[0].toLocaleUpperCase("it")+word.slice(1)).join(" ") : value);
        const key=normalize(label);if(!key)continue;
        if(!labels.has(key)||canonical)labels.set(key,label);
      }
      return [...labels.values()];
    }
    function openPicker(cardId) {
      if(match)return notify("Non puoi modificare la squadra durante la partita","error");
      const v=deps.squadView;
      if(!v?.replacementPickerMarkup||!deps.openModal)return;
      const current=resolveCard(cardId);
      if(!current)return;
      const roster=new Set([...(localSquad.lineup||[]),...(localSquad.bench||[])]);
      const quick=(localSquad.lineup.includes(cardId)?localSquad.bench:[]).map(id=>({
        cardId:id,playerId:id,source:id.startsWith("free_agents::")?"Svincolato":"RTG",player:resolveCard(id)
      })).filter(e=>e.player);
      // Include owned cards already assigned to a different starting position.
      // The canonical replace mutation swaps roster entries atomically.
      // Previously excluding the entire roster hid Nathan (or any other
      // event card) from the picker in one saved slot but not another.
      const quickIds=new Set(quick.map(entry=>entry.cardId));
      const all=userCards().filter(id=>id!==cardId&&!quickIds.has(id)).map(id=>{
        const p=resolveCard(id),sid=id.split("::")[0];
        return p?{cardId:id,playerId:id,source:sid==="free_agents"?"Svincolato":"RTG",seasonId:sid,player:p,
          role:String(p.normalizedRole||p.position||"").toUpperCase(),
          rarity:String(p.finalRarity||p.category||"Normale"),
          overall:Number(p.overall??p.finalOverall??0),
          teams:pickerTeamLabels(p,sid)
        }:null;
      }).filter(Boolean);
      const seasons=[{value:"all",label:"Tutte"},...Array.from(new Set(all.map(e=>e.seasonId))).map(id=>({
        value:id,label:sourceLabel(id,manifest.labels.source)||id
      }))];
      const rarityOrder=["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"];
      const rarityRank=value=>{const n=rarityOrder.findIndex(v=>v.toLocaleLowerCase("it")===asId(value).toLocaleLowerCase("it"));return n<0?rarityOrder.length:n;};
      const rarities=Array.from(new Set(all.map(e=>e.rarity))).sort((a,b)=>rarityRank(a)-rarityRank(b)||a.localeCompare(b,"it"));
      let query="",sourceFilter="all",roleFilter="all",rarityFilter="all",seasonFilter="all",teamFilter="all",descending=true,visibleCount=12;
      const teams=()=>Array.from(new Set(all.filter(e=>seasonFilter==="all"||e.seasonId===seasonFilter).flatMap(e=>e.teams))).sort((a,b)=>a.localeCompare(b,"it")).map(t=>({value:t,label:t}));
      const filtered=()=>all.filter(e=>(!query||e.player.name?.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")))
        &&(sourceFilter==="all"||(sourceFilter==="free"?e.source==="Svincolato":e.source==="RTG"))
        &&(roleFilter==="all"||e.role===roleFilter)
        &&(rarityFilter==="all"||e.rarity===rarityFilter)
        &&(seasonFilter==="all"||e.seasonId===seasonFilter)
        &&(teamFilter==="all"||e.teams.includes(teamFilter)))
        .sort((a,b)=>(descending?b.overall-a.overall:a.overall-b.overall)||a.player.name.localeCompare(b.player.name,"it"));
      const shown=list=>list.slice(0,visibleCount);
      let selecting=false;
      function select(id){
        if(selecting||busy||squadEditPending||actionPending)return;
        selecting=true;
        return perform(async()=>{
          await editSquad("replace",{from:cardId,to:id});
          deps.closeModal?.();
        }).finally(()=>{selecting=false;});
      }
      function wireResults(){
        modalRoot()?.querySelector?.("[data-rtg-picker-results]")?.querySelectorAll?.("[data-rtg-picker-player]")?.forEach(b=>b.addEventListener("click",()=>select(b.dataset.rtgPickerPlayer)));
        modalRoot()?.querySelector?.("[data-rtg-picker-load-more]")?.addEventListener("click",()=>{visibleCount+=12;paint();});
      }
      function paint(){
        const list=filtered(),target=modalRoot()?.querySelector?.("[data-rtg-picker-results]");
        if(target){target.innerHTML=v.replacementPickerResultsMarkup({entries:shown(list),total:list.length,visibleCount});wireResults();}
        modalRoot()?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(b=>b.classList?.toggle("active",b.dataset.rtgPickerSource===sourceFilter));
        modalRoot()?.querySelector?.("[data-rtg-picker-sort]")?.setAttribute?.("aria-pressed",descending?"true":"false");
        const arrow=modalRoot()?.querySelector?.("[data-rtg-picker-sort-arrow]");if(arrow)arrow.textContent=descending?"↓":"↑";
      }
      const list=filtered();
      deps.openModal(v.replacementPickerMarkup({
        target:{cardId,playerId:cardId,source:cardId.startsWith("free_agents::")?"Svincolato":"RTG",player:current},
        role:String(current.normalizedRole||current.position||""),allowAnyRole:true,quickEntries:quick,
        entries:shown(list),total:list.length,visibleCount,rarityOptions:rarities,
        seasonOptions:seasons,teamOptions:teams()
      }),{className:"rtg-modal rtg-squad-picker-modal rtg-halloween-picker"});
      wireResults();
      modalRoot()?.querySelectorAll?.(".rtg-picker-quick-bench [data-rtg-picker-player]")?.forEach(b=>b.addEventListener("click",()=>select(b.dataset.rtgPickerPlayer)));
      modalRoot()?.querySelector?.("[data-rtg-picker-search]")?.addEventListener("input",e=>{query=e.target.value.trim();visibleCount=12;paint();});
      modalRoot()?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(b=>b.addEventListener("click",()=>{sourceFilter=b.dataset.rtgPickerSource;visibleCount=12;paint();}));
      modalRoot()?.querySelectorAll?.("[data-rtg-picker-role]")?.forEach(b=>b.addEventListener("click",()=>{
        roleFilter=b.dataset.rtgPickerRole;visibleCount=12;
        modalRoot()?.querySelectorAll?.("[data-rtg-picker-role]")?.forEach(x=>x.classList.toggle("active",x===b));paint();
      }));
      modalRoot()?.querySelector?.("[data-rtg-picker-season]")?.addEventListener("change",e=>{
        seasonFilter=e.target.value;teamFilter="all";visibleCount=12;
        const select=modalRoot()?.querySelector?.("[data-rtg-picker-team]");
        if(select)select.innerHTML=v.filterOptionsMarkup([{value:"all",label:"Tutte"},...teams()],"all");paint();
      });
      modalRoot()?.querySelector?.("[data-rtg-picker-team]")?.addEventListener("change",e=>{teamFilter=e.target.value;visibleCount=12;paint();});
      modalRoot()?.querySelector?.("[data-rtg-picker-rarity]")?.addEventListener("change",e=>{rarityFilter=e.target.value;visibleCount=12;paint();});
      modalRoot()?.querySelector?.("[data-rtg-picker-sort]")?.addEventListener("click",()=>{descending=!descending;paint();});
    }
    function openFormation() {
      if(match||!deps.openModal||!deps.squadView?.formationOptionsMarkup)return;
      const config=global.RoadToGloryConfig?.season?.("ie1")||{};
      const formations=config.formations||global.SeasonRegistry?.database?.("ie1")?.formations?.eleven||[];
      deps.openModal(deps.squadView.formationOptionsMarkup({formations,formationId:localSquad.formationId},()=>true),
        {className:"rtg-modal rtg-halloween-picker"});
      modalRoot()?.querySelectorAll?.("[data-rtg-formation-option]")?.forEach(btn=>btn.addEventListener("click",()=>perform(async()=>{
        await editSquad("formation",btn.dataset.rtgFormationOption);deps.closeModal?.();
      })));
    }
    function openCatalog() {
      const view=deps.squadView;
      if(!deps.openModal||!view?.catalogMarkup)return;
      const catalog=(shared.gachaAcquiredCards||[]).map(meta=>{
        const cardId=asId(meta.cardId),p=resolveCard(cardId),sid=cardId.split("::")[0];
        if(!p)return null;
        const db=global.SeasonRegistry?.database?.(sid);
        const teamIds=[p.resolvedTeamId,p.teamId,...(p.teamIds||[])].map(asId).filter(Boolean);
        const teamLabels=Array.from(new Set([p.teamName,...(p.teams||[]),...teamIds.flatMap(id=>{
          const item=(db?.teams||[]).find(t=>asId(t.teamId||t.id)===id);
          return item?[asId(item.teamName||item.name)]:[];
        })].map(asId).filter(Boolean)));
        return {cardId,playerId:cardId,source:"RTG",player:p,seasonId:sid,role:asId(p.normalizedRole||p.position).toUpperCase(),teamLabels};
      }).filter(Boolean);
      const seasonOptions=[{value:"all",label:"Tutte"},...Array.from(new Set(catalog.map(x=>x.seasonId))).map(value=>({value,label:sourceLabel(value,manifest.labels.collection)||value}))];
      let query="",seasonFilter="all",teamFilter="all",roleFilter="all",visibleCount=16;
      const teamOptions=()=>[{value:"all",label:"Tutte"},...Array.from(new Set(catalog.filter(e=>seasonFilter==="all"||e.seasonId===seasonFilter).flatMap(e=>e.teamLabels)))
        .sort((a,b)=>a.localeCompare(b,"it")).map(value=>({value,label:value}))];
      const filtered=()=>catalog.filter(e=>(seasonFilter==="all"||e.seasonId===seasonFilter)
        &&(teamFilter==="all"||e.teamLabels.includes(teamFilter))
        &&(roleFilter==="all"||e.role===roleFilter)
        &&(!query||asId(e.player.name).toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it"))))
        .sort((a,b)=>a.role.localeCompare(b.role)||Number(b.player.overall??b.player.finalOverall??0)-Number(a.player.overall??a.player.finalOverall??0)||a.player.name.localeCompare(b.player.name,"it"));
      function bindCards(){
        modalRoot()?.querySelector?.("[data-rtg-catalog-results]")?.querySelectorAll?.("[data-rtg-catalog-player]")?.forEach(btn=>
          btn.addEventListener("click",()=>openNativeDetail(btn.dataset.rtgCatalogPlayer)));
        modalRoot()?.querySelector?.("[data-rtg-catalog-load-more]")?.addEventListener("click",()=>{
          visibleCount+=24;updateResults();
        });
      }
      function updateResults(){
        const list=filtered(),target=modalRoot()?.querySelector?.("[data-rtg-catalog-results]");
        if(target){target.innerHTML=view.catalogResultsMarkup({entries:list.slice(0,visibleCount),total:list.length});bindCards();}
      }
      const first=filtered();
      deps.openModal(view.catalogMarkup({entries:first.slice(0,visibleCount),total:catalog.length,
        seasonOptions,teamOptions:teamOptions()}),{className:"rtg-modal rtg-player-catalog-modal rtg-halloween-picker"});
      bindCards();
      modalRoot()?.querySelector?.("[data-rtg-catalog-search]")?.addEventListener("input",e=>{
        query=asId(e.target.value);visibleCount=16;updateResults();
      });
      modalRoot()?.querySelectorAll?.("[data-rtg-catalog-role]")?.forEach(button=>button.addEventListener("click",()=>{
        roleFilter=button.dataset.rtgCatalogRole||"all";
        modalRoot()?.querySelectorAll?.("[data-rtg-catalog-role]")?.forEach(item=>{
          const active=item.dataset.rtgCatalogRole===roleFilter;
          item.classList.toggle("active",active);item.setAttribute("aria-pressed",active?"true":"false");
        });visibleCount=16;updateResults();
      }));
      modalRoot()?.querySelector?.("[data-rtg-catalog-season]")?.addEventListener("change",e=>{
        seasonFilter=e.target.value||"all";teamFilter="all";visibleCount=16;
        const select=modalRoot()?.querySelector?.("[data-rtg-catalog-team]");
        if(select)select.innerHTML=view.filterOptionsMarkup(teamOptions(),"all");
        updateResults();
      });
      modalRoot()?.querySelector?.("[data-rtg-catalog-team]")?.addEventListener("change",e=>{
        teamFilter=e.target.value||"all";visibleCount=16;updateResults();
      });
    }
    function openNativeCoachPower(){
      // Clear the player-only modal skin before opening native coach UI.
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native");setModalExtraClass(null);
      const ui=global.RoadToGloryCoachSquadPowerUi;
      if(match||!ui?.open)return;
      // Refresh the underlying OVR and requirements AFTER the coach modal
      // closes, based only on the committed squad (not the draft selection).
      let coachPowerCommitted=false;
      const closePowerModal=()=>{
        deps.closeModal?.();
        if(coachPowerCommitted){coachPowerCommitted=false;render();}
      };
      const currentState=()=>activeEventSquad(),resolver={resolveAtLevel20:id=>resolveCard(id)};
      const model=()=>tacticalLineupModel(deps.squadView?.renderModel?.({
        state:currentState(),freeAgentIds:eligibleFreeAgentIds(),
        seasonDb:global.SeasonRegistry?.database?.("ie1")||{},freeAgentsDb:data.freeAgents,playerResolver:resolver
      })||{});
      ui.open({getCampaign:currentState,getSquadDraft:()=>localSquad,seasonId:()=>"ie1",
        resolve:resolveCard,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
        closeModal:closePowerModal,toast:notify,squadView:deps.squadView,getModel:model,
        saveSquad:async draft=>{
          await editSquad("coachPower",draft);
          coachPowerCommitted=true;
        },
        openPlayerDetails:key=>openNativeDetail(key),
        previewChoice:(key,selection)=>{
          const p=resolveCard(key);
          if(!p)return null;
          if(global.RoadToGloryCoachPowerTypes?.typeOf?.(localSquad.coachId)==="rarityUpgrade"&&asId(key).startsWith(EVENT_ID+"::")){
            const rarityRules=global.RoadToGloryCoachPowerRuntime;
            const nextRarity=rarityRules?.nextRarity?.(rarityRules.rarityOf(p));
            const upgraded=nextRarity&&selection?.cardIds?.includes(key)
              ?upgradeEventCoachRarity(p,nextRarity,key):null;
            if(!upgraded)return null;
            const label={attack:"Tiro",control:"Controllo",speed:"Velocità",
              stamina:"Resistenza",grit:"Grinta",defense:"Difesa",
              physical:"Fisico",save:"Parata"};
            const stats=Object.keys(label).map(k=>({
              label:label[k],before:Number(p.stats?.[k]||0),
              after:Number(upgraded.stats?.[k]||0)
            })).filter(v=>v.after>v.before);
            return {original:p,player:upgraded,stats};
          }
          return global.RoadToGloryCoachSquadPreview?.projected?.({
            player:p,cardId:key,squad:{...localSquad,coachPowerSelection:selection},
            state:activeEventSquad(),seasonId:"ie1",
            playerResolver:global.RoadToGloryPlayerResolver,freeAgentsDb:data.freeAgents
          })||null;
        },
        previewSquadOverall:selection=>{
          const line=resolvedUser()?.lineup;
          return {before:ovr(line),after:ovr(line,
            localSquad.coachId===HALLOWEEN_COACH_ID&&selection?.cardIds?.length===1
              ?{cardId:selection.cardIds[0],amount:15}:eventOverallDiscount())};
        }
      });
    }
    function openCoaches() {
      // The player detail modal root is reused. Its Halloween-only class
      // must never leak to coaches from normal Seasons.
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native");setModalExtraClass(null);
      const view=global.RoadToGloryCoachesView;
      if(!deps.openModal||!view?.markup)return notify("Catalogo allenatori RTG non disponibile","error");
      function openCollection(){
        deps.openModal(view.markup(activeEventSquad(),{tab:"collection",equippedId:localSquad.coachId||"",eventId:EVENT_ID}),
          {className:"rtg-modal rtg-coaches-modal rtg-halloween-picker"});
        const root=modalRoot();
        root?.querySelectorAll?.("[data-rtg-coaches-equip]")?.forEach(btn=>btn.addEventListener("click",()=>perform(async()=>{
          await editSquad("coach",btn.dataset.rtgCoachesEquip);deps.closeModal?.();
        })));
        root?.querySelectorAll?.("[data-rtg-coach-detail]")?.forEach(btn=>btn.addEventListener("click",()=>{
          const id=btn.dataset.rtgCoachDetail;
          // Standard coaches must get the IDENTICAL detail modal frame used
          // by the canonical RTG coaches controller (player-detail-modal).
          // Hekyll alone retains the custom Halloween modal appearance.
          const coachDetailClassName=id===HALLOWEEN_COACH_ID
            ?"rtg-modal rtg-coach-detail-modal rtg-halloween-picker"
            :"rtg-modal player-detail-modal rtg-coaches-modal";
          deps.openModal(view.detail(activeEventSquad(),id,{equippedId:localSquad.coachId||""}),
            {className:coachDetailClassName});
          modalRoot()?.querySelectorAll?.("[data-rtg-coaches-equip]")?.forEach(b=>b.addEventListener("click",()=>perform(async()=>{
            await editSquad("coach",b.dataset.rtgCoachesEquip);deps.closeModal?.();
          })));
        }));
      }
      openCollection();
    }
    // Debug-only overlay: shares the existing Halloween account transaction
    // instead of touching localStorage, Firebase or the pull reward ledger.
    function devToolsMarkup(){
      return '<details class="halloween-dev-quick-tools" data-halloween-dev-tools>'+
        '<summary>'+uiText("devTitle")+'</summary><div class="halloween-dev-quick-content">'+
        '<p>'+escape(CUR.name)+': <b>'+escape(ledger(shared)?.[CURRENCY]||0)+'</b></p>'+
        '<button type="button" data-halloween-dev-pumpkins aria-label="Imposta almeno 99.999 '+escape(CUR.unit)+' '+uiText("short")+' per test">'+uiText("icon")+' 99.999 '+escape(CUR.unitUpper)+'</button>'+
        '</div></details>';
    }
    async function grantDevPumpkins(){
      if(!devMode)throw fail("halloween-dev-unavailable");
      await mutate("halloween-dev-pumpkins",account=>{
        for(const c of CURRENCIES)ledger(account)[c.field]=Math.max(Number(ledger(account)[c.field])||0,99999);
      });
      notify("DEV: 99.999 "+CUR.unit+" "+UI.short+" disponibili");
    }
    // Parte 2 (b): home e schermate proprie di un evento (pezzo aggiuntivo: home, screens). La parte comune offre
    // solo strumenti; sezione Squadra, partita e distributore restano quelli comuni (pulsanti data-event-action).
    const customPart=name=>name==="home"?global.GameEvents?.extensionPart?.(EVENT_ID,"home"):
      (global.GameEvents?.extensionPart?.(EVENT_ID,"screens")||{})[name]||null;
    let customHomeFailed=false;
    const tools=Object.freeze({
      eventId:EVENT_ID,labels:manifest.labels,escape,text:key=>uiText(key),
      isOpen,countdown,
      currencies:()=>CURRENCIES.map(c=>({id:c.id,name:c.name,unit:c.unit,icon:c.icon})),
      balance:currencyId=>Number(ledger(shared)?.[fieldOf(currencyId)]||0),
      coin:(amount,currencyId)=>currency(amount,curOf(fieldOf(currencyId))),
      wallet:()=>walletPills(),
      teams:()=>TEAMS.map(t=>({teamId:t.teamId,name:t.name,logo:t.logo||LOGO_URL,colors:t.theme?.colors||null})),
      player:pid=>player(asId(pid)),
      // Carte possedute di questo evento; con {from:"<id>"} quelle di un altro evento, solo se il file lo permette
      // (uses.cardsFrom). Le carte di un altro evento sono in sola lettura: niente poteri o stato di quell'evento.
      ownedCards:({from=EVENT_ID}={})=>{
        if(from===EVENT_ID)return manifest.cards.map(card=>card.playerId).filter(pid=>isOwned(pid))
          .map(pid=>({playerId:pid,cardId:EVENT_ID+"::"+pid,player:player(pid)}));
        if(!global.GameEvents?.canUseCardsFrom?.(EVENT_ID,from))return [];
        const other=global.GameEvents.get(from),module=global.GameEvents.module?.(from);
        const prefix=other?.save?.cardIdPrefix||"";
        return (shared?.gachaAcquiredCards||[]).map(card=>asId(card?.cardId)).filter(id=>prefix&&id.startsWith(prefix))
          .map(cardId=>({playerId:cardId.slice(prefix.length),cardId,eventId:from,readOnly:true,
            player:module?.eventPlayer?.(cardId.slice(prefix.length))||null}));
      },
      data:()=>clone(ledger(shared)?.extra||{}),
      // Salva dati propri dell'evento (solo dati semplici) nello stato dell'evento, campo extra.
      save:updater=>perform(()=>mutate("event-extra",account=>{
        const l=ledger(account);const next=updater(clone(l.extra||{}));
        if(!next||typeof next!=="object"||Array.isArray(next))throw fail("event-extra-invalid");
        l.extra=JSON.parse(JSON.stringify(next));
      })),
      toast:message=>notify(message),
      go:name=>{view=name==="home"?"match":"screen:"+name;render();},
      openSquad:()=>{view="squad";render();},
      openAlbum:()=>{view="album";render();},
      openVending:teamId=>{if(TEAMS.some(t=>t.teamId===teamId))selectedVendingTeamId=teamId;view="vending";render();},
      startMatch:teamId=>{if(TEAMS.some(t=>t.teamId===teamId))challengeTeamId=teamId;return perform(startMatch);},
      exit:()=>{dispose();deps.onReturn?.();},
    });
    function customPageMarkup(name){
      const part=customPart(name);
      if(!part||typeof part.render!=="function")return null;
      try{return String(part.render(tools)||"");}
      catch(error){global.console?.warn?.(`[eventi] pagina ${name} di ${EVENT_ID} non riuscita`,error);return null;}
    }
    function bindCustomPage(name){
      const part=customPart(name);
      try{part?.bind?.(app,tools);}catch(error){global.console?.warn?.(`[eventi] pagina ${name} di ${EVENT_ID}`,error);}
    }
    function bindEventActions(){
      app.querySelectorAll?.("[data-event-action]")?.forEach(el=>el.addEventListener("click",()=>{
        const action=el.dataset.eventAction;
        if(action==="pull")tools.openVending(el.dataset.eventTeam);
        else if(action==="squad")tools.openSquad();
        else if(action==="album")tools.openAlbum();
        else if(action==="start")tools.startMatch(el.dataset.eventTeam||TEAM_ID);
        else if(action==="screen")tools.go(el.dataset.eventScreen||"home");
        else if(action==="home")tools.go("home");
        else if(action==="exit")tools.exit();
      }));
    }
    function render() {
      if(!app)return;
      const resetScrollOnNavigation=lastPresentedView!==view;
      lastPresentedView=view;
      if(matchTimer!=null){global.clearTimeout?.(matchTimer);matchTimer=null;}
      if(view!=="vending"){vendingMotion?.stop?.();vendingMotion=null;}
      const customName=view.startsWith("screen:")?view.slice(7):(view==="match"&&!match&&!customHomeFailed?"home":"");
      const customMarkup=customName?customPageMarkup(customName):null;
      if(customName==="home"&&customMarkup===null&&customPart("home"))customHomeFailed=true;
      if(customMarkup!==null)app.innerHTML=customMarkup+(customName==="home"&&TEAM_VENDING?footer("run"):"");
      else if(view.startsWith("screen:")){view="match";return render();}
      else if(view==="squad")app.innerHTML=squadSection();
      else if(view==="album"||view==="album-roster")app.innerHTML=albumSection();
      else if(match&&view==="match"&&deps.matchView)app.innerHTML=nativeMatchMarkup();
      else if(view==="vending"&&TEAM_VENDING)app.innerHTML='<main class="screen vf-vending-screen">'+vendingSection()+'</main>';
      else app.innerHTML=shell(view==="vending"?vendingSection():match?pendingSection():matchSection());
      if(devMode)app.innerHTML+=devToolsMarkup();
      bindEventActions();
      if(customMarkup!==null)bindCustomPage(customName);
      if(devMode)app.querySelector?.("[data-halloween-dev-pumpkins]")?.addEventListener("click",event=>{
        const button=event.currentTarget;
        if(button.disabled)return;
        button.disabled=true;
        return perform(grantDevPumpkins).finally(()=>{if(button.isConnected)button.disabled=false;});
      });
      app.querySelectorAll?.("[data-halloween-back],[data-rtg-home]")?.forEach(el=>el.addEventListener("click",()=>{if(view==="match"){dispose();deps.onReturn?.();}else returnToEventHome();}));
      app.querySelector?.("[data-rtg-album-collection-back]")?.addEventListener("click",()=>{dispose();deps.onReturn?.();});
      app.querySelectorAll?.("[data-rtg-album-team]")?.forEach(button=>button.addEventListener("click",()=>{
        const id=asId(button.dataset.rtgAlbumTeam);
        if(!eventAlbumTeams().some(team=>team.teamId===id))return;
        selectedAlbumTeamId=id;view="album-roster";render();
      }));
      app.querySelector?.("[data-rtg-album-back]")?.addEventListener("click",()=>{view="album";render();});
      app.querySelectorAll?.("[data-halloween-tab],[data-rtg-tab]")?.forEach(el=>el.addEventListener("click",()=>{
        const target=el.dataset.halloweenTab || el.dataset.rtgTab;
        if(target==="squad"){view="squad";render();}
        else if(target==="run"||target==="match")return returnToEventHome();
      }));
      // Read-only opponent XI: use the album's real card detail, including
      // locked Halloween players. Never send a preview tap to startMatch.
      app.querySelector?.(".halloween-opponent-preview-field")?.addEventListener("click",event=>{
        const target=event.target?.closest?.("[data-rtg-prematch-player]");
        if(!target||!event.currentTarget.contains(target))return;
        const rawId=asId(target.dataset.rtgPrematchPlayer);
        const pid=rawId.startsWith(EVENT_ID+"::")?rawId.slice(EVENT_ID.length+2):rawId;
        if(!assets?.setup?.startingXI?.some(id=>asId(id)===pid))return;
        event.preventDefault?.();
        openNativeDetail(EVENT_ID+"::"+pid,isOwned(pid),true);
      });
      app.querySelector?.("[data-halloween-open-vending]")?.addEventListener("click",()=>{view="vending";render();});
       app.querySelector?.("[data-halloween-close-vending]")?.addEventListener("click",returnToEventHome);
      app.querySelectorAll?.("[data-halloween-start]")?.forEach(el=>el.addEventListener("click",()=>perform(startMatch)));
      app.querySelector?.("[data-halloween-resume]")?.addEventListener("click",()=>{view="match";render();});
      app.querySelector?.("[data-halloween-next]")?.addEventListener("click",()=>perform(()=>stepMatch(null)));
      app.querySelectorAll?.("[data-halloween-choice]")?.forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch(el.dataset.halloweenChoice))));
      app.querySelector?.("[data-halloween-halftime]")?.addEventListener("click",()=>perform(()=>stepMatch("halftime")));
      app.querySelectorAll?.("[data-halloween-penalty]")?.forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch("penalty:"+el.dataset.halloweenPenalty))));
      app.querySelector?.("[data-halloween-abandon]")?.addEventListener("click",()=>perform(abandonMatch));
      app.querySelector?.("[data-halloween-close-result]")?.addEventListener("click",()=>perform(closeResult));
      app.querySelectorAll?.("[data-event-vending-team]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy||actionPending||match)return;
        const id=button.dataset.eventVendingTeam;
        if(id!==selectedVendingTeamId&&TEAMS.some(t=>t.teamId===id)){
          selectedVendingTeamId=id;render();
        }
      }));
      if(view==="vending")vendingMotion=global.RoadToGloryVendingMotion?.mount?.(app.querySelector?.("[data-rtg-vending-machine]"))||null;
      app.querySelector?.("[data-halloween-pull]")?.addEventListener("click",event=>{
        const button=event.currentTarget;
        if(button.disabled)return;
        button.disabled=true;
        return perform(async()=>{
          const drawn=await pull(); // Account debit and card acquisition already committed.
          if((!drawn?.player&&!drawn?.coach)||!drawn?.result)return;
          const machine=app.querySelector?.("[data-rtg-vending-machine]");
          const rarity=String(drawn.result.rarity||"").toLowerCase();
          const capsuleColour=rarity==="leggenda"||rarity==="elite"?"orange":"black";
          // The static chute prize must match the capsule that was drawn,
          // including the reduced-motion fallback (not always silver).
          machine?.setAttribute?.("data-halloween-prize-color",capsuleColour);
          if(vendingMotion){
            try{await vendingMotion.play(capsuleColour);}
            catch(error){global.console?.warn?.("[Halloween] Animazione distributore",error);}
          }else if(machine){
            machine.classList?.add?.("is-turning");
            if(typeof global.setTimeout==="function")await new Promise(resolve=>global.setTimeout(resolve,620));
          }
          if(machine?.classList)machine.classList.add("is-revealing");
          if(typeof global.setTimeout==="function")await new Promise(resolve=>global.setTimeout(resolve,980));
          if(!deps.runView?.pullResultMarkup||!deps.openModal)return;
          const isCoach=Boolean(drawn.coach);
          let markup=isCoach
            ?global.RoadToGloryCoachesView?.result?.(drawn.coach)?.replace("ROAD TO GLORY · STAFF",UI.tag)
            :deps.runView.pullResultMarkup(drawn.result,drawn.player,{teams:TEAMS.map(entry=>({teamId:entry.teamId,teamName:entry.name,logoUrl:entry.logo||LOGO_URL}))});
          if(!markup)return;
          if(!isCoach)markup=markup.replace("SALDO RTG",()=>uiText("walletTitle"))
            .replace(/(<div class="rtg-pull-balance">[\s\S]*?<strong>)[\s\S]*?(<\/strong>)/,
               (_all,before,after)=>before+'<img class="halloween-reveal-currency-icon" src="'+escape(curOf(PULL_FIELD).icon||PUMPKIN_URL)+'" alt="'+escape(curOf(PULL_FIELD).iconAlt||CUR.iconAlt)+'"> '+escape(drawn.result.balanceAfter)+' '+escape(CUR.unitUpper)+after)
            .replace(/ROAD TO GLORY · LEGACY [^<]*/,UI.tag);
          deps.openModal(markup,{className:"rtg-modal rtg-pull-modal rtg-halloween-pull-modal"});
          modalRoot()?.querySelectorAll?.("[data-rtg-pull-continue],[data-rtg-coaches-collection]")?.forEach(btn=>btn.addEventListener("click",()=>deps.closeModal?.()));
          modalRoot()?.querySelector?.("[data-rtg-pull-player-detail]")?.addEventListener("click",()=>openNativeDetail(drawn.result.cardId));
          if(isCoach)modalRoot()?.querySelector?.("[data-rtg-coach-detail]")?.addEventListener("click",()=>{
            deps.openModal(global.RoadToGloryCoachesView.detail(activeEventSquad(),HALLOWEEN_COACH_ID,{equippedId:localSquad.coachId||""}),
              {className:"rtg-modal rtg-coach-detail-modal rtg-halloween-picker"});
            modalRoot()?.querySelector?.("[data-rtg-coaches-back]")?.addEventListener("click",()=>deps.closeModal?.());
          });
        }).finally?.(()=>{if(button.isConnected)button.disabled=false;});
      });
      if(match&&view==="match"&&deps.matchView)bindNativeMatch();
      if(view==="squad"&&deps.squadView?.bind) {
        deps.squadView.bind(app,{
          onOpenDetails:cardId=>openNativeDetail(cardId),
          onOpenPlayer:cardId=>openPicker(cardId),
          onOpenFormation:openFormation,onOpenCatalog:openCatalog,onOpenCoaches:openCoaches,
          onOpenCoachDetails:openCoaches,onConfigureCoachPower:openNativeCoachPower,
          onAdaptRequirements:()=>perform(()=>editSquad("adapt")),
          onSave:()=>notify("Squadra evento salvata"),
          onSelectSquadSlot:slot=>perform(()=>editSquad("slot",slot))
        });
      }
      if(view==="album-roster"){
        const roster=app.querySelector?.("[data-rtg-album-roster]");
        roster?.addEventListener("click",event=>{
          const origin=typeof event.target?.closest==="function"?event.target:event.target?.parentElement;
          const entry=origin?.closest?.("[data-rtg-album-player-entry]")||
            origin?.closest?.("[data-rtg-album-player-card]")?.closest?.("[data-rtg-album-player-entry]");
          const cardId=asId(entry?.dataset?.rtgAlbumPlayerEntry);
          if(!cardId||!cardId.startsWith(EVENT_ID+"::"))return;
          event.preventDefault?.();
          openNativeDetail(cardId,entry.dataset.albumUnlocked==="true",true);
        });
      }
      // Halloween switches HTML views without the common router. Only reset on
      // navigation; in-match repaints must keep the current timeline position.
      if(resetScrollOnNavigation){
        const resetTop=()=>{
          try{global.scrollTo?.({top:0,left:0,behavior:"auto"});}catch(_){}
          for(const element of [global.document?.scrollingElement,global.document?.documentElement,global.document?.body,app,app.querySelector?.("main")]){
            if(element)element.scrollTop=0;
          }
        };
        resetTop();
        global.requestAnimationFrame?.(()=>global.requestAnimationFrame?.(resetTop));
      }
    }
    async function perform(op) {
      // Protect match progression, roster edits and capsule actions against
      // competing taps. squadEditPending alone only protects editSquad().
      if(busy||squadEditPending||actionPending)return;
      actionPending=true;
      try {await op();render();}
      catch(error){
        global.console?.error?.("[RTG Halloween]",error);
        const reasons={"halloween-pull-unavailable":"Concludi la partita prima di usare il distributore","halloween-insufficient-pumpkins":"Zucca insufficienti per il distributore","halloween-squad-incomplete":"La squadra deve avere 11 titolari e 4 riserve","halloween-overall-cap":"La formazione supera l’OVR massimo dell’evento","halloween-active-match":"Non puoi modificare la squadra durante la partita","halloween-card-identity-invalid":"Errore identità carta evento","halloween-coach-selection-invalid":"Selezione potere allenatore non valida: riconfiguralo in Squadra","halloween-coach-power-not-applied":"Il potere allenatore non è stato applicato: verifica i PT e riconfiguralo","halloween-squad-busy":"Cambio squadra già in corso"};
        notify(reasons[error?.code]||("Operazione "+UI.short+" fallita: "+(error?.code||error?.message||"errore sconosciuto")),"error");
      } finally {actionPending=false;}
    }
    async function editSquad(kind,arg) {
      if(squadEditPending)throw fail("halloween-squad-busy");
      if(match)throw fail("halloween-active-match");
      squadEditPending=true;
      try{
      lock();
      const curr=orderedEventSquad(localSquad);
      let nextSlot=activeSquadSlot,nextSquad=curr;
      let adaptMessage="";
      const nextSlots=clone(squadSlots||{"1":curr,"2":curr,"3":curr});
      const allowed=new Set(userCards());
      if(kind==="replace"){
        if(!allowed.has(arg.to)||arg.to===arg.from)return;
        const area=curr.lineup.includes(arg.from)?"lineup":"bench";
        const other=area==="lineup"?"bench":"lineup",i=curr[area].indexOf(arg.from);
        if(i<0)throw fail("halloween-card-not-in-squad");
        if(curr[other].includes(arg.to)){
          const j=curr[other].indexOf(arg.to);curr[other][j]=arg.from;
        }else if(curr[area].includes(arg.to)){
          const j=curr[area].indexOf(arg.to);curr[area][j]=arg.from;
        }
        curr[area][i]=arg.to;
      } else if(kind==="slot") {
        const slot=Number(arg);if(![1,2,3].includes(slot))throw fail("halloween-invalid-slot");
        nextSlots[activeSquadSlot]=curr;
        nextSlot=slot;
        nextSquad=initialEventSquad(clone(nextSlots[slot]||curr));
      } else if(kind==="coach"){
        if(arg&&!shared.coachOwnedIds.includes(arg))throw fail("halloween-coach-unowned");
        curr.coachId=arg;curr.coachPowerSelection=null;
      } else if(kind==="coachPower"){
        if(arg?.coachId!==curr.coachId)throw fail("halloween-coach-invalid");
        curr.coachPowerSelection=clone(arg.coachPowerSelection||null);
        if(curr.coachPowerSelection){
          const roster=resolvedPowerRoster(curr);
          if(!global.RoadToGloryCoachPowerRuntime?.validConfig?.(
              curr,roster.lineup,"ie1",roster.bench))
            throw fail("halloween-coach-selection-invalid");
        }
      } else if(kind==="adapt"||kind==="formation"){
        const cap=opponentOverall()+1,limit=Math.floor(cap*11);
        const formationId=kind==="formation"?asId(arg):curr.formationId;
        const formations=global.RoadToGloryConfig?.season?.("ie1")?.formations||[];
        const formation=formations.find(f=>asId(f.id)===formationId);
        if(!formation&&kind==="formation")throw fail("halloween-formation-unavailable");
        const roles=formation?.requirements||{FW:3,MF:3,DF:4,GK:1};
        const previous=[...curr.lineup,...curr.bench],previousSet=new Set(curr.lineup);
        const discount=eventOverallDiscount(curr);
        const owned=userCards().map(id=>({id,p:resolveCard(id)})).filter(x=>x.p)
          .map(x=>{
            const actualOverall=Math.round(Number(x.p.overall??x.p.finalOverall??0));
            return {...x,actualOverall,overall:x.id===discount?.cardId
              ?Math.max(0,actualOverall-Math.max(0,Number(discount.amount)||0)):actualOverall,
              role:asId(x.p.normalizedRole||x.p.position||x.p.role).toUpperCase()};
          }).filter(x=>Number.isFinite(x.overall));
        let line=[];
        if(kind==="adapt"){
          // Exact bounded knapsack on the REAL RTG owned-card pool. For each
          // tactical role count retain achievable sums and prefer already
          // selected cards on equal totals; maximize average <= enemy+1.
          // Unlike the old algorithm, this also upgrades an OVR-75 lineup.
          const groupTotals=[];
          for(const role of ["FW","MF","DF","GK"]){
            const need=Number(roles[role]||0);
            if(!need)continue;
            const candidates=owned.filter(x=>x.role===role);
            if(candidates.length<need)throw fail("halloween-formation-insufficient-players");
            // Cards with equal rating are interchangeable for this problem:
            // retain up to need of each rating, prioritizing owned starters.
            const byOverall=new Map();
            for(const entry of candidates){
              const bucket=byOverall.get(entry.overall)||[];
              bucket.push(entry);byOverall.set(entry.overall,bucket);
            }
            const reduced=Array.from(byOverall.values()).flatMap(bucket=>bucket
              .sort((a,b)=>Number(previousSet.has(b.id))-Number(previousSet.has(a.id))||a.id.localeCompare(b.id))
              .slice(0,need));
            const dp=Array.from({length:need+1},()=>new Map());
            dp[0].set(0,{ids:[],changes:0});
            for(const item of reduced){
              for(let count=need;count>=1;count--){
                for(const [sum,path] of dp[count-1]){
                  const total=sum+item.overall;
                  if(total>limit)continue;
                  const changes=path.changes+(previousSet.has(item.id)?0:1);
                  const old=dp[count].get(total);
                  if(!old||changes<old.changes)
                    dp[count].set(total,{ids:[...path.ids,item.id],changes});
                }
              }
            }
            if(!dp[need].size)throw fail("halloween-overall-cap");
            groupTotals.push(dp[need]);
          }
          let combined=new Map([[0,{ids:[],changes:0}]]);
          for(const group of groupTotals){
            const next=new Map();
            for(const [sum,chosen] of combined){
              for(const [extra,choice] of group){
                const total=sum+extra;if(total>limit)continue;
                const changes=chosen.changes+choice.changes;
                const old=next.get(total);
                if(!old||changes<old.changes)next.set(total,{ids:[...chosen.ids,...choice.ids],changes});
              }
            }
            if(!next.size)throw fail("halloween-overall-cap");
            combined=next;
          }
          const target=Math.max(...combined.keys());
          line=combined.get(target)?.ids||[];
          adaptMessage="Squadra ottimizzata: "+(Math.round(target/11*10)/10)+
            " / "+cap+" OVR (massimo raggiungibile con i giocatori disponibili).";
        }else{
          for(const role of ["FW","MF","DF","GK"]){
            const need=Number(roles[role]||0);
            for(const id of [...previous,...owned.map(x=>x.id)]){
              if(line.filter(k=>asId(resolveCard(k)?.normalizedRole||resolveCard(k)?.position).toUpperCase()===role).length>=need)break;
              if(line.includes(id)||!allowed.has(id))continue;
              const p=resolveCard(id);
              if(asId(p?.normalizedRole||p?.position).toUpperCase()===role)line.push(id);
            }
          }
        }
        if(line.length!==11)throw fail("halloween-formation-insufficient-players");
        const bench=[...curr.bench,...curr.lineup,...owned.map(x=>x.id)]
          .filter((id,i,arr)=>!line.includes(id)&&arr.indexOf(id)===i).slice(0,4);
        if(bench.length!==4)throw fail("halloween-bench-insufficient");
        curr.lineup=line;curr.bench=bench;curr.formationId=formationId;
        curr.lineupOrderedBySlot=false;
        nextSquad=orderedEventSquad(curr);
      }
      assertEventSquadIntegrity(nextSquad);
      // Keep all configured squad powers in sync with the saved XI. A changed
      // player can invalidate Hillman/Yi just as it can invalidate Hekyll.
      // Clear only an invalid selection during this SAME atomic squad write.
      if(["replace","adapt","formation"].includes(kind)&&nextSquad.coachPowerSelection){
        const roster=resolvedPowerRoster(nextSquad);
        if(!global.RoadToGloryCoachPowerRuntime?.validConfig?.(
            nextSquad,roster.lineup,"ie1",roster.bench)){
          const message=nextSquad.coachId===HALLOWEEN_COACH_ID
            ?manifest.coaches[0].power.name+": seleziona di nuovo un titolare "+UI.short+"."
            :"Potere allenatore: seleziona di nuovo i giocatori interessati.";
          nextSquad.coachPowerSelection=null;
          adaptMessage=adaptMessage?adaptMessage+" "+message:message;
        }
      }
      nextSlots[nextSlot]=clone(nextSquad);
      const epoch=session;
      const saved={...nextSquad,activeSquadSlot:nextSlot,slots:nextSlots};
      await storage.updateMany([SQUAD_KEY],()=>({writes:{[SQUAD_KEY]:saved},value:true}));
      assertCurrent(epoch);
      // Only advance the visible squad once the canonical event save commits.
      activeSquadSlot=nextSlot;localSquad=nextSquad;squadSlots=nextSlots;
      if(adaptMessage)notify(adaptMessage);
      } finally { squadEditPending=false; }
    }
    async function startMatch() {
      if(squadEditPending)throw fail("halloween-squad-busy");
      if(!isOpen() || match)throw fail("halloween-event-closed-or-match-active");
      const squad=resolvedUser();if(!squad)throw fail("halloween-squad-incomplete");
      const allowed=new Set(userCards());
      if([...localSquad.lineup,...localSquad.bench].some(cardId=>!allowed.has(cardId)))
        throw fail("halloween-squad-incomplete");
      if(ovr(squad.lineup,eventOverallDiscount())>opponentOverall(challengeTeamId)+1)throw fail("halloween-overall-cap");
      if(global.RtgFourMovesRuntime && !(await global.RtgFourMovesRuntime.ready))throw fail("halloween-move-catalog-not-ready");
      const epoch=session;
      const matchId=manifest.save.matchIdPrefix+String(global.crypto?.randomUUID?.()||Date.now()+"-"+Math.random());
      const meta=deps.getUserTeamMeta?.()||{};
      squad.name=meta.name||"La tua squadra";
      if(meta.teamIdentity)squad.teamIdentity=clone(meta.teamIdentity);
      let created=global.RoadToGloryMatchEngine.createMatch({seasonId:EVENT_ID,matchId,seed:matchId,nodeId:manifest.save.matchNodeId,matchType:"event",attemptNumber:1,userSquad:squad,opponentSquad:opponent()});
      const state=activeEventSquad(),coach=global.RoadToGloryCoachPreMatchRuntime?.coachFor?.(state,"ie1")||"";
      const coachRules=global.RoadToGloryCoachPowerRuntime;
      const selectedPower=coachRules?.selected?.(localSquad);
      const ownedCoach=!!selectedPower&&shared.coachOwnedIds.includes(selectedPower.coachId);
      const powerConfig=ownedCoach?coachRules.validConfig(
        localSquad,created.userSquad.lineup,EVENT_ID,created.userSquad.bench):null;
      if(ownedCoach&&!powerConfig)throw fail("halloween-coach-selection-invalid");
      // Hillman, Schiller and Arrows depend on PT initialization. An outdated
      // or unavailable PT runtime must never silently start a legacy match.
      const configuredPower=powerConfig&&global.RoadToGloryCoachPowerTypes?.powerFor?.(powerConfig.coachId);
      if(configuredPower?.phase==="squad"&&configuredPower.requiresPtMode&&
         created.ptModeVersion!==1)throw fail("halloween-coach-power-not-applied");
      created=coachRules?.applyToMatch?.(created,localSquad,state,{
        upgradeRarity:(player,targetRarity,cardId)=>{
          if(asId(cardId).startsWith(EVENT_ID+"::"))
            return upgradeEventCoachRarity(player,targetRarity,cardId);
          return global.RoadToGloryCoachRarityPower?.upgrade?.({
            player,targetRarity,cardId,playerResolver:global.RoadToGloryPlayerResolver,
            freeAgentsDb:data.freeAgents,seasonId:"ie1",squad:localSquad
          });
        }
      })||created;
      // A saved power must never silently disappear in the match snapshot.
      // Hekyll is intentionally eligibility-only and has no combat effect.
      if(powerConfig&&powerConfig.coachId!==HALLOWEEN_COACH_ID&&
         created.coachPowerEffect?.coachId!==powerConfig.coachId)
        throw fail("halloween-coach-power-not-applied");
      if(coach){created.preMatchCoachId=coach;created.presentation={...(created.presentation||{}),preMatchPowerStatus:"pending"};}
      else created=global.RoadToGloryMatchEngine.prepareNext(created);
      created.presentation={...(created.presentation||{}),preMatchSeen:false};
      lock();
      await storage.updateMany([MATCH_KEY],records=>{if(records[MATCH_KEY]!=null)throw fail("halloween-active-match");return {writes:{[MATCH_KEY]:created},value:true};});
      assertCurrent(epoch);match=created;
    }
    async function finalizeIfNeeded(m) {
      const terminal=["completed","completed-draw"].includes(m.status);
      if(!terminal)return m;
      const {value}=await mutate("halloween-match-reward",(account,records)=>{
        const live=records[MATCH_KEY];if(!live||live.matchId!==m.matchId)throw fail("halloween-stale-match");
        const completed=ledger(account).completedIds;
        const already=completed.includes(m.matchId);
        const won=m.result?.winner==="user";
        const lucky=won&&global.RoadToGloryRng.int(m.matchId,"halloween-lucky",0,100)<LUCKY_CHANCE_PERCENT;
        const award=already?Number(live.halloweenAward||0):!won?0:(lucky?LUCKY_PRIZE:PRIZE);
        if(!already){ledger(account)[rewardFieldForTeam(live.opponentSquad?.teamId,lucky)]+=award;completed.push(m.matchId);if(lucky)ledger(account).luckyWins++;}
        return {writes:{[MATCH_KEY]:{...m,halloweenAward:award}},match:m};
      },[SHARED_KEY,MATCH_KEY]);
      match=(await storage.read(MATCH_KEY))||m;
      return match;
    }
    async function stepMatch(choice) {
      if(!match || !isOpen())throw fail("halloween-match-unavailable");
      const epoch=session;
      let latest,before=null,scoreBefore=null;
      await storage.updateMany([MATCH_KEY],records=>{
        const m=records[MATCH_KEY];if(!m||m.matchId!==match.matchId)throw fail("halloween-stale-match");
        if(choice==="prematch"){if(m.presentation?.preMatchPowerStatus==="pending")throw fail("halloween-coach-power-pending");latest={...m,presentation:{...(m.presentation||{}),preMatchSeen:true}};}
        else if(choice==="halftime")latest=global.RoadToGloryMatchEngine.confirmHalftime(m,halftimeDraft||m.userSquad);
        else if(choice?.startsWith("penalty:")||choice?.startsWith("penalty-move:")) {
          const n=m.shootout?.history?.length||0,side=n%2===0?"user":"opponent",direction=choice.slice(8);
          const ai=["left","center","right"][global.RoadToGloryRng.int(m.matchId,"halloween-penalty-ai",n,3)];
          latest=global.RoadToGloryMatchEngine.resolvePenaltyKick(m,{attackingSide:side,shooterChoice:side==="user"?direction:ai,goalkeeperChoice:side==="user"?ai:direction}).state;
        } else if(m.pendingEncounter){before=clone(m.pendingEncounter);scoreBefore=clone(m.score||{});latest=global.RoadToGloryMatchEngine.resolvePendingEncounter(m,choice||"base");}
        else latest=global.RoadToGloryMatchEngine.prepareNext(m);
        if(!latest || typeof latest!=="object")throw fail("halloween-invalid-match-step");
        return {writes:{[MATCH_KEY]:latest},value:true};
      });
      assertCurrent(epoch);match=latest;
      if(choice==="halftime"){halftimeDraft=null;halfSelected="";}
      pendingRevealHidden=!!latest?.pendingEncounter&&(choice==="prematch"||choice==null);
      lastResolution=null;lastResolutionStage="resolved";
      const log=before?.encounterId&&latest?.log?.find?.(entry=>asId(entry.encounterId)===asId(before.encounterId));
      if(before&&log){
        const userPlayer=findNativeMatchPlayer("user",before.userPlayerId);
        const opponentPlayer=findNativeMatchPlayer("opponent",before.aiPlayerId||before.opponentPlayerId);
        const userWon=before.userSide===before.actorSide?!!log.actorWon:!log.actorWon;
        const selectedMove=choice?.startsWith("move:")?before.userMoveOptions?.[Number(choice.slice(5))]:null;
        lastResolutionStage="comparison";
        lastResolution={
          userWon,actorSide:before.actorSide,userKind:before.userKind,aiKind:before.aiKind,
          userPlayer,opponentPlayer,userPlayerName:userPlayer?.name,aiPlayerName:opponentPlayer?.name,
          probability:before.userSide===before.actorSide?Number(log.probability):100-Number(log.probability),
          userChoiceLabel:selectedMove?.name||before.userBaseActionLabel||"Azione base",
          aiChoiceLabel:before.aiChoice==="move"?before.aiMove?.name:null,
          userUsedMove:!!selectedMove,aiUsedMove:before.aiChoice==="move",
          userMovePower:selectedMove?.power,aiMovePower:before.aiMove?.power,
          userMoveType:selectedMove?.type,aiMoveType:before.aiMove?.type,
          userMoveElement:selectedMove?.element,aiMoveElement:before.aiMove?.element,
          scoreBefore,scoreAfter:clone(latest.score||scoreBefore),goalSide:log.goalSide||null,
          opponentLabel:latest.opponentSquad?.name||TEAM_NAME
        };
      }
      await finalizeIfNeeded(latest);
    }
    async function abandonMatch() {
      if(!match) return;
      const epoch=session,abandoned=global.RoadToGloryMatchEngine.abandon(match);
      await storage.updateMany([MATCH_KEY],records=>{if(records[MATCH_KEY]?.matchId!==match.matchId)throw fail("halloween-stale-match");return {writes:{[MATCH_KEY]:abandoned},value:true};});
      assertCurrent(epoch);match=abandoned;
    }
    async function closeResult() {
      if(!match||!["completed","completed-draw","abandoned"].includes(match.status))return;
      if(["completed","completed-draw"].includes(match.status)&&!Number.isInteger(match.halloweenAward))await finalizeIfNeeded(match);
      const epoch=session,id=match.matchId;
      await storage.updateMany([MATCH_KEY],records=>{if(records[MATCH_KEY]?.matchId!==id)throw fail("halloween-stale-match");return {deletes:[MATCH_KEY],writes:{},value:true};});
      assertCurrent(epoch);match=null;
    }
    async function pull() {
      if(!isOpen()||(match&&!["completed","completed-draw","abandoned"].includes(match.status)))throw fail("halloween-pull-unavailable");
      let selected="";
      const selectedField=pullFieldForTeam(selectedVendingTeamId);
      await mutate("halloween-capsule",(account)=>{
        const ev=ledger(account);
        if(ev[selectedField]<PRICE)throw fail("halloween-insufficient-pumpkins");
        const missing=halloweenPrizeIds(account);
        if(!missing.length)throw fail("halloween-collection-completed");
        const random=global.crypto?.getRandomValues?global.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296:Math.random();
        selected=weightedPick(missing,random);
        if(selected===HALLOWEEN_COACH_ID){
          if(account.coachOwnedIds.includes(selected))throw fail("halloween-coach-already-owned");
          // Existing RTG shared account persists coaches for BOTH campaigns.
          // Debit and coach grant commit in the SAME canonical transaction.
          ev[selectedField]-=PRICE;ev.pullCount++;account.coachOwnedIds.push(selected);
        }else{
          const record=recordCard(selected);
          if(account.gachaAcquiredCards.some(c=>c.cardId===record.cardId))throw fail("halloween-existing-card");
          ev[selectedField]-=PRICE;ev.ownedIds.push(selected);ev.pullCount++;
          account.gachaAcquiredCards.push(record);
        }
      });
      if(selected===HALLOWEEN_COACH_ID)
        return {coach:global.RoadToGloryCoaches?.lookup?.(selected),result:{
          coachId:selected,rarity:"Leggenda",balanceAfter:ledger(shared)[selectedField]}};
      const p=player(selected);
      return {player:p,result:{cardId:EVENT_ID+"::"+selected,playerId:selected,legacySeasonId:EVENT_ID,rarity:p?.category||"Normale",balanceAfter:ledger(shared)[selectedField]}};
    }
    async function open(initialView="match") {
      dispose();const epoch=session;
      await prepare();assertCurrent(epoch);
      // Parte 2 (c): i dati delle carte degli eventi che questo evento puo' usare (uses.cardsFrom).
      await Promise.all((manifest.uses?.cardsFrom||[]).map(id=>global.GameEvents?.module?.(id)?.prepare?.()?.catch?.(()=>null)));
      assertCurrent(epoch);
      global.GameEvents?.applyTheme?.(app,EVENT_ID);global.GameEvents?.applyTheme?.(deps.getModalRoot?.(),EVENT_ID);
      const previous=global.SeasonRegistry?.activeId?.();
      const needed=Array.from(global.RoadToGloryConfig?.SEASON_IDS||[]); // tutte le Season, dal registro
      await Promise.all(needed.map(id=>global.SeasonRegistry?.loadDatabase?.(id).catch(()=>null)));
      if(previous)global.SeasonRegistry?.setActive?.(previous);
      const response=await global.fetch("data/FREE_AGENTS_compact.json");
      if(!response.ok)throw fail("halloween-free-agent-data-unavailable");
      const freeAgents=await response.json();assertCurrent(epoch);
      data={freeAgents};await load();assertCurrent(epoch);
      view=initialView==="album"?"album":"match";selectedAlbumTeamId=TEAM_ID;selectedVendingTeamId=TEAM_ID;detailPid="";
      if(match&&["completed","completed-draw"].includes(match.status)&&!Number.isInteger(match.halloweenAward))await finalizeIfNeeded(match);
      const rewardGranted=view==="match"?await grantCompletionReward():false;
      assertCurrent(epoch);render();listen();
      if(rewardGranted)showCompletionReward();
    }
    return Object.freeze({open,render,dispose,getState:()=>({shared:shared&&clone(shared),match:match&&clone(match)})});
  }
  const api = Object.freeze({
    EVENT_ID,TEAM_ID,EVENT_END_MS,PRICE,PRIZE,LUCKY_PRIZE,LABELS:manifest.labels,isOpen,countdown,eventCard,prepare,
    eventPlayer:player,eventState,opponentOverall,weightedPick,pullFieldForTeam,rewardFieldForTeam,create
  });
  // Passo 4.3: un'istanza per ogni evento attivo, registrata nel registro eventi (GameEvents.module/moduleForCard).
  // RoadToGloryHalloween resta il nome dell'istanza dell'evento vero, come prima: chi lo usa non cambia.
  global.GameEvents?.registerModule?.(EVENT_ID, api);
  if (manifest.dev !== true && !global.RoadToGloryHalloween) global.RoadToGloryHalloween = api;
  }
  // Si installa per ogni evento a capsule attivo (kind "capsuleEvent" nel file dell'evento): gli eventi veri e,
  // con ?dev=1&evento=<id>, anche l'evento finto, accanto agli altri.
  global.GameEvents?.onAnyLoad?.(manifest => {
    if (manifest.kind === "capsuleEvent" && global.GameEvents.isActive(manifest.id)) install(manifest);
  });
})(globalThis);
