(function (global) {
  "use strict";
  const EVENT_ID = "halloween2026";
  const TEAM_ID = "occult-2";
  const EVENT_END_MS = Date.UTC(2026, 10, 4, 22, 59, 59);
  const MATCH_KEY = "local:halloween2026:match";
  const SQUAD_KEY = "local:halloween2026:squad";
  const SHARED_KEY = "shared:account";
  const PRICE = 200;
  const PRIZE = 300;
  const LUCKY_PRIZE = 600;
  const BANNER_URL = "https://img.magnific.com/foto-gratuito/illustrazione-digitale-di-halloween_23-2151822706.jpg?semt=ais_hybrid&w=740&q=80";
  const GRAVEYARD_URL = "https://static9.depositphotos.com/1014889/1236/i/450/depositphotos_12367834-stock-photo-halloween-background-spooky-graveyard.jpg";
  const PUMPKIN_URL = "https://static.vecteezy.com/ti/vettori-gratis/p1/3690657-halloween-zucca-disegno-halloween-zucca-vettore-isolare-su-sfondo-bianco-gratuito-vettoriale.jpg";
  const LOGO_URL = "https://dxi4wb638ujep.cloudfront.net/1/k/r/k/rk_nafgart8.webp";
  const SPECIAL = Object.freeze(["custom_0002", "custom_0001"]);
  const clone = x => JSON.parse(JSON.stringify(x));
  const asId = x => String(x == null ? "" : x).trim();
  const escape = x => String(x == null ? "" : x).replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
  const isOpen = () => Date.now() <= EVENT_END_MS;
  let assetsPromise = null;
  let assets = null;
  const fail = code => Object.assign(new Error(code), {code});

  function countdown() {
    const remaining = Math.max(0, EVENT_END_MS - Date.now());
    const units = [86400000, 3600000, 60000, 1000];
    const vals = [];
    let rest = remaining;
    for (const u of units) { vals.push(Math.floor(rest/u)); rest %= u; }
    return vals[0] + "g " + String(vals[1]).padStart(2,"0") + "h " + String(vals[2]).padStart(2,"0") + "m " + String(vals[3]).padStart(2,"0") + "s";
  }
  function eventCard() {
    return '<button type="button" class="rtg-campaign-card rtg-halloween-entry" data-rtg-halloween-open ' +
      (isOpen() ? '' : 'disabled aria-disabled="true" ') +
      '><img class="rtg-campaign-card__image" src="' + escape(BANNER_URL) + '" alt="">' +
      '<span class="rtg-campaign-shade"></span><span class="rtg-campaign-copy"><small>EVENTO LIMITATO · 2026</small>' +
      '<strong>🎃 EVENTO HALLOWEEN</strong><em><b>OCCULT HALLOWEEN</b></em>' +
      '<i data-halloween-countdown>' + (isOpen() ? countdown() : "EVENTO TERMINATO") + '</i></span></button>';
  }
  async function prepare(fetcher = global.fetch && global.fetch.bind(global)) {
    if (assets) return assets;
    if (!fetcher) throw fail("halloween-fetch-unavailable");
    if (!assetsPromise) assetsPromise = Promise.all([
      "data/rtg-halloween-occult-players.json",
      "data/rtg-halloween-occult-lineup.json",
      "data/rtg-halloween-occult-moves.json"
    ].map(async path => {
      const response = await fetcher(path, {cache:"no-store"});
      if (!response.ok) throw fail("halloween-asset-unavailable");
      return response.json();
    })).then(([teams, lineup, moves]) => {
      const team = teams[0], setup = lineup.teams[0], list = team.players || [];
      if (team.teamId !== TEAM_ID || asId(setup.teamId).replaceAll("_","-") !== TEAM_ID ||
        list.length !== 18 || setup.startingXI.length !== 11 ||
        new Set(setup.startingXI).size !== 11 ||
        list.some(p => !moves.players[asId(p.playerId)]?.moves?.length) ||
        setup.startingXI.some(pid => !list.some(p => asId(p.playerId) === asId(pid)))) throw fail("halloween-invalid-asset-contract");
      assets = Object.freeze({team, setup, moves, players:new Map(list.map(p=>[asId(p.playerId),p]))});
      return assets;
    }).catch(error => { assetsPromise = null; throw error; });
    return assetsPromise;
  }
  function player(pid) {
    const raw = assets?.players?.get(asId(pid));
    if (!raw) return null;
    const moves = assets.moves.players[asId(pid)]?.moves || [];
    const statKeys = ["attack","control","speed","grit","physical","stamina","defense","save"];
    const stats = Object.fromEntries(statKeys.map(k => [k, Math.max(0, Number(raw[k]||0)*10)]));
    return {
      ...raw, playerId:asId(raw.playerId), cardId:EVENT_ID+"::"+asId(raw.playerId),
      legacySeasonId:EVENT_ID, resolvedSeasonId:EVENT_ID, teamId:TEAM_ID,
      teamName:"Occult Halloween", level:20, stats, baseStats:stats,
      normalizedRole:raw.position, finalOverall:Number(raw.overall)||0,
      category:raw.category, finalRarity:raw.category, activeMove:moves[0] || null,
      halloweenMoves:moves, halloweenVampire:!SPECIAL.includes(asId(pid)),
      fullbodyUrl:raw.frontFullbodyUrl || raw.portraitUrl,
      portraitUrl:raw.portraitUrl
    };
  }
  function eventState(raw) {
    if (raw == null) return {pumpkins:0, ownedIds:[], pullCount:0, completedIds:[], luckyWins:0};
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      !Number.isSafeInteger(raw.pumpkins) || raw.pumpkins < 0 ||
      !Number.isSafeInteger(raw.pullCount) || raw.pullCount < 0 ||
      !Number.isSafeInteger(raw.luckyWins) || raw.luckyWins < 0 ||
      !Array.isArray(raw.ownedIds) || !Array.isArray(raw.completedIds) ||
      new Set(raw.ownedIds).size !== raw.ownedIds.length ||
      new Set(raw.completedIds).size !== raw.completedIds.length ||
      raw.ownedIds.some(id => !/^(?:[0-9]+|custom_000[12])$/.test(id)) ||
      raw.completedIds.some(id => typeof id !== "string" || !id || id.length > 120)) throw fail("halloween-invalid-account");
    return clone(raw);
  }
  function opponentOverall() {
    if (!assets) throw fail("halloween-assets-not-ready");
    const vals = assets.setup.startingXI.map(id => assets.players.get(asId(id))?.overall);
    return Math.round(vals.reduce((a,b)=>a+Number(b),0)/vals.length);
  }
  function ovr(lineup) {
    return !Array.isArray(lineup) || lineup.length !== 11 ? null :
      Math.round(lineup.reduce((sum,p)=>sum + Number(p?.overall ?? p?.finalOverall ?? 0), 0)/11);
  }
  function weightedPick(missing, random) {
    const pool = missing.map(pid => ({pid,weight:SPECIAL.includes(pid)?4:5.75}));
    const total = pool.reduce((n,item)=>n+item.weight,0);
    if (!pool.length || !Number.isFinite(random) || random < 0 || random >= 1) throw fail("halloween-invalid-pull");
    let n = random * total;
    for (const item of pool) { n -= item.weight; if (n < 0) return item.pid; }
    return pool[pool.length-1].pid;
  }
  function create(deps = {}) {
    const app = deps.app, storage = deps.storage || global.RoadToGloryStorage.create();
    const notify = deps.toast || (()=>{});
    let data = null, shared = null, localSquad = null, match = null, view = "match", busy = false;
    let tick = null, session = 0, search = "", detailPid = "", activeSquadSlot = 1, squadSlots = null;
    const assertCurrent = epoch => { if (epoch !== session) throw fail("halloween-stale-controller"); global.RoadToGloryPersistence?.assertWritable?.(); };
    function dispose() { session++; if (tick != null) global.clearInterval?.(tick); tick = null; }
    function listen() { if(tick!=null)global.clearInterval?.(tick);tick=global.setInterval?.(()=>{const el=app?.querySelector?.("[data-halloween-countdown]"); if(el)el.textContent=isOpen()?countdown():"EVENTO TERMINATO";if(!isOpen())app?.querySelectorAll?.("[data-halloween-start],[data-halloween-pull]")?.forEach(b=>b.disabled=true);},1000); }
    function readAccount(record) { const current = record || {}; return {...clone(current),tokens:current.tokens??0,gachaAcquiredCards:current.gachaAcquiredCards||[],developmentByCardId:current.developmentByCardId||{},coachOwnedIds:current.coachOwnedIds||[],halloween:eventState(current.halloween)}; }
    function lock() { global.RoadToGloryPersistence?.assertWritable?.(); global.PersistenceRecoveryGuard?.assertWritable?.(); }
    async function load() {
      const records = await storage.readMany([SHARED_KEY,SQUAD_KEY,MATCH_KEY]);
      shared = readAccount(records[SHARED_KEY]);
      const stored = records[SQUAD_KEY] || null;
      activeSquadSlot = Number(stored?.activeSquadSlot)||1;
      squadSlots = stored?.slots || null;
      localSquad = stored?.slots?.[activeSquadSlot] || stored || initialEventSquad();
      if (!localSquad?.formationId) localSquad = {...localSquad,formationId:"4-3-3",activeRoleVariantByCardId:{}};
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
          const before = readAccount(records[SHARED_KEY]), next = clone(before);
          const updated = handler(next, records);
          if (updated && typeof updated.then === "function") throw fail("halloween-async-mutation");
          eventState(next.halloween);
          const writes = {[SHARED_KEY]:next};
          if (updated?.writes) Object.assign(writes,updated.writes);
          return {writes,value:{account:next,match:updated?.match??null,selection:updated?.selection??null}};
        });
        assertCurrent(epoch);
        await load();
        return saved;
      } finally { busy = false; }
    }
    function userCards() {
      const r=global.RoadToGloryCardIdentity;
      const freeAgents=data.freeAgents?.players||[];
      const all=[...freeAgents.map(p=>r.cardIdForFreeAgent(p.playerId||p.id)),...(shared?.gachaAcquiredCards||[]).map(p=>p.cardId)];
      return Array.from(new Set(all)).filter(Boolean);
    }
    function resolveCard(cardId) {
      if(cardId.startsWith(EVENT_ID+"::"))return player(cardId.split("::")[1]);
      return global.RoadToGloryPlayerResolver?.resolveOwnedAtLevel20?.(cardId,"ie1",null,data.freeAgents,shared?.developmentByCardId||{})||null;
    }
    function resolvedUser() {
      const line=(localSquad?.lineup||[]).map(resolveCard);
      const bench=(localSquad?.bench||[]).map(resolveCard);
      if(line.length!==11 || line.some(p=>!p) || bench.length!==4 || bench.some(p=>!p) ||
         new Set([...(localSquad?.lineup||[]),...(localSquad?.bench||[])]).size!==15)return null;
      return {formationId:"4-4-2",seasonId:"ie1",lineup:line,bench:bench.filter(Boolean),coachId:localSquad?.coachId||""};
    }
    function opponent() {
      return {name:"Occult Halloween",teamId:TEAM_ID,logoUrl:LOGO_URL,seasonId:EVENT_ID,formationId:"4-4-2",
        lineup:assets.setup.startingXI.map(pid=>player(pid)),bench:Array.from(assets.players.keys()).filter(pid=>!assets.setup.startingXI.includes(pid)).map(pid=>player(pid))};
    }
    function currency(n) { return '<span class="halloween-currency"><img src="'+escape(PUMPKIN_URL)+'" alt="">'+escape(n)+'</span>'; }
    function isOwned(pid) { return shared?.halloween.ownedIds.includes(pid); }
    function initialEventSquad(previous={}) {
      const chosen=[...(previous.lineup||[]),...(previous.bench||[])];
      const assigned=new Set(chosen);
      const available=(data?.freeAgents?.players||[]).map(p=>({
        cardId:global.RoadToGloryCardIdentity.cardIdForFreeAgent(p.playerId||p.id),
        role:String(p.position||p.normalizedRole||p.role||"").toUpperCase(),
        overall:Number(p.overall??p.finalOverall??0)
      })).filter(x=>x.cardId&&!assigned.has(x.cardId)).sort((a,b)=>a.overall-b.overall);
      const lineup=[...(previous.lineup||[])],bench=[...(previous.bench||[])];
      const requirements={FW:3,MF:3,DF:4,GK:1};
      const slots=["FW","MF","DF","GK"];
      for(const role of slots) {
        let have=lineup.filter(cardId=>String(resolveCard(cardId)?.normalizedRole||resolveCard(cardId)?.position||"").toUpperCase()===role).length;
        while(have<requirements[role]&&lineup.length<11) {
          const i=available.findIndex(x=>x.role===role);
          if(i<0)break;const item=available.splice(i,1)[0];lineup.push(item.cardId);assigned.add(item.cardId);have++;
        }
      }
      while(lineup.length<11&&available.length)lineup.push(available.shift().cardId);
      while(bench.length<4&&available.length)bench.push(available.shift().cardId);
      return {formationId:previous.formationId||"4-3-3",lineup,bench,coachId:previous.coachId||"",activeRoleVariantByCardId:previous.activeRoleVariantByCardId||{}};
    }
    function activeEventSquad() {return {activeSeasonId:"ie1",gachaAcquiredCards:shared.gachaAcquiredCards,coachOwnedIds:shared.coachOwnedIds,squads:{ie1:localSquad}};}
    function nativeCard(p,opts={}) {
      const cls=opts.event&&p?.halloweenVampire?" halloween-vampire-card":"";
      const attr=opts.attr||"";
      return typeof deps.compactPlayerCardMarkup==="function"
        ? deps.compactPlayerCardMarkup(p,{level:20,overall:p?.overall??p?.finalOverall,
            dataAttr:attr,extraClass:"halloween-native-card"+cls})
        : '<button type="button" class="player-card player-card-compact '+cls+'" '+attr+'><span class="player-corner player-role">'+escape(p.position||"")+'</span><span class="player-corner player-overall">'+escape(p.overall||"")+'</span><img class="player-portrait" src="'+escape(p.portraitUrl||"")+'" alt=""><strong>'+escape(p.name||"")+'</strong></button>';
    }
    function openNativeDetail(cardId,albumUnlocked=false) {
      const p=resolveCard(cardId);
      if(!p)return;
      if(deps.openPlayerDetails) {
        deps.openPlayerDetails(cardId,"",{mode:albumUnlocked?"album":undefined,albumUnlocked});
      } else if(deps.showPlayerDetailsFor) {
        deps.showPlayerDetailsFor(p,{playerId:p.playerId,level:20,readOnly:true,rtgFourMoves:true,
          moveSeasonId:p.halloweenMoves?EVENT_ID:(p.resolvedSeasonId||p.legacySeasonId||"ie1"),
          rtgRarity:p.category,mode:albumUnlocked?"album":"current",albumUnlocked});
      }
      const modal=deps.getModalRoot?.();
      modal?.classList?.toggle("halloween-detail-native",Boolean(p.halloweenMoves));
      modal?.classList?.toggle("halloween-detail-vampire",Boolean(p.halloweenVampire));
    }
    function footer(active="run") {
      return '<nav class="bottom-nav rtg-bottom-nav" aria-label="Road to Glory Halloween">'+
      '<button type="button" data-halloween-tab="match" class="'+(active==="run"?"active":"")+'"><span class="nav-icon">▱</span><span class="nav-label">RUN</span></button>'+
      '<button type="button" data-halloween-tab="squad" class="'+(active==="squad"?"active":"")+'"><span class="nav-icon">♧</span><span class="nav-label">SQUADRA</span></button></nav>';
    }
    function shell(body) {
      return '<main class="screen rtg-run-screen rtg-halloween-run-screen halloween-screen">'+
       '<header class="topbar rtg-main-topbar halloween-original-topbar"><button type="button" class="btn rtg-home-button" data-halloween-back aria-label="Torna alle campagne"><span>←</span></button>'+
       '<div class="rtg-main-title"><p class="eyebrow">ROAD TO GLORY · EVENTO</p><strong class="brand">HALLOWEEN</strong><span data-halloween-countdown>'+(isOpen()?countdown():"EVENTO TERMINATO")+'</span></div>'+
       '<div class="status-strip"><span class="status-pill halloween-wallet">'+currency(shared?.halloween?.pumpkins||0)+'</span></div></header>'+
       '<div class="content narrow rtg-run-content halloween-original-content">'+body+'</div>'+footer("run")+'</main>';
    }
    function matchSection() {
      const target=opponentOverall(),ours=resolvedUser(),own=ovr(ours?.lineup),limit=target+1,can=Boolean(ours&&own!==null&&own<=limit);
      return '<section class="rtg-journey-summary halloween-journey-summary" aria-label="Prossima partita Evento Halloween">'+
        '<div class="rtg-journey-main"><div class="rtg-journey-copy"><p class="eyebrow">LA TUA PROSSIMA PARTITA</p><h1>OCCULT HALLOWEEN</h1>'+
        '<p>SFIDA EVENTO · OVR AVVERSARIO '+target+' · MASSIMO '+limit+'</p></div><div class="rtg-journey-opponent"><img src="'+escape(LOGO_URL)+'" alt="Occult"></div></div>'+
        '<button type="button" class="btn btn-yellow" data-halloween-start '+(!isOpen()||!can||match?'disabled':'')+'>PREPARA PARTITA →</button>'+
        (match?'<button type="button" class="btn btn-yellow" data-halloween-resume>RIPRENDI PARTITA →</button>':'')+
        (!can?'<p class="halloween-squad-requirement">La tua squadra: '+(own??"—")+' OVR · limite '+limit+' · 11 titolari e 4 riserve. <button data-halloween-tab="squad">GESTISCI SQUADRA →</button></p>':'')+
        '<div class="rtg-journey-progress" role="progressbar" aria-valuenow="1" aria-valuemin="0" aria-valuemax="1"><span style="width:100%"></span></div></section>'+
        '<section class="panel rtg-run-command halloween-original-command"><div><p class="eyebrow">LA TUA COLLEZIONE</p><h2>Rinforza la squadra</h2><p>Vittoria: '+currency(PRIZE)+' · bonus fortunato 10%: '+currency(LUCKY_PRIZE)+' totali</p></div>'+
        '<button type="button" class="btn btn-yellow rtg-vending-button" data-halloween-open-vending>DISTRIBUTORE HALLOWEEN <span>'+currency(PRICE)+'</span></button></section>'+
        '<section class="rtg-map rtg-halloween-map" aria-label="Partita nel cimitero"><div class="halloween-map-content"><span class="eyebrow">SFIDA A TEMPO · OCCULT</span>'+
        '<img class="halloween-map-crest" src="'+escape(LOGO_URL)+'" alt=""><h2>IL CIMITERO STREGATO</h2>'+
        '<p>Termina tra <strong data-halloween-countdown>'+(isOpen()?countdown():"EVENTO TERMINATO")+'</strong></p>'+
        '<button class="btn btn-yellow" data-halloween-start '+(!isOpen()||!can||match?'disabled':'')+'>GIOCA CONTRO OCCULT →</button></div></section>';
    }
    function squadSection() {
      const view=deps.squadView;
      if(!view?.renderModel||!view?.markup)return '<p>Layout RTG non disponibile</p>';
      const freeAgentIds=(data.freeAgents?.players||[]).map(p=>asId(p.playerId||p.id));
      const model=view.renderModel({state:activeEventSquad(),freeAgentIds,seasonDb:global.SeasonRegistry?.database?.("ie1")||{},
          freeAgentsDb:data.freeAgents,playerResolver:{resolveAtLevel20:cardId=>resolveCard(cardId)}});
      const meta=deps.getUserTeamMeta?.()||{};
      const name=meta.name||"La tua squadra";
      const squadOvr=ovr(resolvedUser()?.lineup);
      const requirement='<div class="rtg-requirements-list"><div class="rtg-requirement '+(squadOvr!=null&&squadOvr<=opponentOverall()+1?"ok":"bad")+'"><span>Overall max · Evento Halloween</span><strong>'+escape(squadOvr??"—")+' / '+(opponentOverall()+1)+'</strong></div></div>';
      return '<div class="rtg-halloween-mode halloween-squad-mode">'+
        view.markup(model,{teamName:name,teamIdentity:meta.teamIdentity,teamPower:squadOvr,activeSquadSlot,
          coachSlotMarkup:global.RoadToGloryCoachesView?.squadSlot?.(activeEventSquad(),localSquad.coachId)||"",
          requirementsMarkup:requirement,nextTeamName:"Occult Halloween",dirty:false})+'</div>';
    }
    function vendingSection() {
      const available=Array.from(assets.players.keys()).filter(pid=>!isOwned(pid)),enough=shared.halloween.pumpkins>=PRICE;
      const capsules=Array.from({length:12},(_,i)=>'<div class="rtg-vending-capsule-v9 c'+(i%6+1)+'" data-capsule-rarity="'+(i%2?"orange":"black")+'"></div>').join("");
      return '<div class="halloween-vending"><p class="eyebrow">CAPSULE STATION · HALLOWEEN</p><h2>IL DISTRIBUTORE STREGATO</h2>'+
        '<div class="rtg-vending halloween-vending-classic"><div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="Distributore Halloween">'+
        '<div class="rtg-vending-head-v9"><span>CAPSULE STATION</span><strong>OCCULT HALLOWEEN</strong></div>'+
        '<div class="rtg-vending-window-v9">'+capsules+'<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div>'+
        '<div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>'+PRICE+'</strong></div>'+
        '<div class="rtg-vending-crank-v9"><span></span></div><div class="rtg-vending-chute-v9"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9">🎃</div></div></div>'+
        '<button class="btn btn-yellow rtg-vending-pull halloween-action" data-halloween-pull '+(!isOpen()||!enough||available.length===0?"disabled":"")+'>GIRA · '+currency(PRICE)+'</button>'+
        '<div class="rtg-vending-wallet-chip"><span>ZUCCHE HALLOWEEN</span><strong>'+currency(shared.halloween.pumpkins)+'</strong></div></div></div>'+
        '<p>Samford e Nathan Swift: 4% ciascuno finché sono entrambi disponibili. Nessun duplicato.</p><p>Giocatori rimasti: '+available.length+' / 18</p></div>';
    }
    function albumSection() {
      const roster=Array.from(assets.players.keys()).map(pid=>player(pid));
      const owned=new Set(shared.halloween.ownedIds.map(pid=>EVENT_ID+"::"+pid));
      if(!deps.runView?.albumRosterMarkup) return '<p>Album RTG non disponibile</p>';
      return '<div class="rtg-halloween-mode halloween-album-mode">'+
        deps.runView.albumRosterMarkup({state:{activeSeasonId:"ie1"},seasonId:EVENT_ID,
          team:{teamId:TEAM_ID,teamName:"Occult Halloween",logoUrl:LOGO_URL},
          entries:roster.filter(p=>owned.has(p.cardId)),allEntries:roster,database:{players:roster}})+'</div>';
    }
    function detailMarkup(pid) {
      const p=player(pid)||resolveCard(pid);
      if(!p)return "";
      const isEvent=asId(p.cardId).startsWith(EVENT_ID+"::"),vampire=isEvent&&p.halloweenVampire;
      const keys=[["ATTACCO","attack"],["CONTROLLO","control"],["VELOCITÀ","speed"],["GRINTA","grit"],["FISICO","physical"],["RESISTENZA","stamina"],["DIFESA","defense"],["PARATA","save"]];
      return '<div class="halloween-detail-overlay"><section class="halloween-detail-sheet"><header><span>🎃 SCHEDA GIOCATORE · HALLOWEEN</span><button data-halloween-close-detail aria-label="Chiudi scheda">✕</button></header>'+
        '<div class="halloween-detail-hero"><div><h2>'+escape(p.name)+'</h2><div class="halloween-duel"><span>RUOLO <strong>'+escape(p.position||p.normalizedRole||"—")+'</strong></span><span>OVERALL <strong>'+escape(p.overall??p.finalOverall??"—")+'</strong></span></div><p>RARITÀ · '+escape(p.category||"Normale")+'</p></div><div class="halloween-detail-render '+(vampire?"halloween-vampiro":"")+'"><img src="'+escape(p.fullbodyUrl||p.portraitUrl||"")+'" alt="'+escape(p.name)+'"></div></div>'+
        '<h3>STATISTICHE</h3><div class="halloween-detail-stats">'+keys.map(([label,key])=>'<div><small>'+label+'</small><strong>'+escape(p.stats?.[key]??Number(p[key]||0)*10)+'</strong></div>').join("")+'</div>'+
        '<h3>TECNICHE</h3><div class="halloween-detail-moves">'+(p.halloweenMoves||[]).map(m=>'<span>'+escape(m.name)+' · '+escape(m.type)+' · PT '+escape(m.tension||m.power||0)+'</span>').join("")+'</div></section></div>';
    }
    function matchPitch(m,side){
      try{const view=global.RoadToGloryMatchView?.create?.({escapeHtml:escape});return view?.formationPitchMarkup?.(side==="user"?m.userSquad:m.opponentSquad,side,"live")||"";}
      catch(error){global.console?.warn?.("[Halloween] Pitch view fallback",error);return "";}
    }
    function pendingSection() {
      if(!match)return matchSection();
      const m=match,ended=["completed","completed-draw","abandoned"].includes(m.status);
      if(ended) return '<div class="halloween-graveyard"><div class="halloween-match-card"><h2>RISULTATO FINALE</h2><h1>'+escape(m.score.user)+' – '+escape(m.score.opponent)+'</h1><p>'+(m.status==="abandoned"?"Partita abbandonata":m.result?.winner==="user"?"VITTORIA!":"PARTITA CONCLUSA")+'</p><p>'+(m.halloweenAward?'Ricompensa accreditata: '+currency(m.halloweenAward):"")+'</p><button class="halloween-action" data-halloween-close-result>TORNA ALL’EVENTO</button></div></div>';
      const info=m.pendingEncounter,options=info?.userMoveOptions||[];
      const status=m.status==="halftime"?"INTERVALLO":m.status==="penalties"?"CALCI DI RIGORE":info?"AZIONE DECISIVA":"INCONTRO";
      const opponentActor=[...(m.opponentSquad?.lineup||[]),...(m.opponentSquad?.bench||[])].find(p=>asId(p.cardId||p.playerId)===asId(info?.aiPlayerId));
      const actorVisual=opponentActor?'<div class="halloween-match-actor"><div class="'+(opponentActor.halloweenVampire?'halloween-vampiro':'')+'"><img src="'+escape(opponentActor.fullbodyUrl||opponentActor.portraitUrl||'')+'" alt="'+escape(opponentActor.name||'')+'"></div><strong>'+escape(opponentActor.name||'')+'</strong></div>':'';
      return '<div class="halloween-graveyard"><div class="halloween-match-card"><div class="halloween-match-brand"><img class="halloween-crest halloween-vampiro" src="'+escape(LOGO_URL)+'" alt=""><div><h2>'+status+'</h2><p>Occult Halloween</p></div></div><h1>'+escape(m.score?.user||0)+' – '+escape(m.score?.opponent||0)+'</h1><div class="halloween-original-fields"><div class="halloween-pitch"><h3>LA TUA SQUADRA</h3>'+matchPitch(m,"user")+'</div><div class="halloween-pitch halloween-pitch--opponent"><h3>OCCULT HALLOWEEN</h3>'+matchPitch(m,"opponent")+'</div></div><p>'+escape(info?.kind||"")+' · '+escape(info?.userKind||"")+'</p>'+actorVisual+ (info?'<div class="halloween-choices"><button class="halloween-action" data-halloween-choice="base">AZIONE BASE</button>'+options.map((move,i)=>'<button data-halloween-choice="move:'+i+'">'+escape(move.name||move.moveId||"Tecnica")+' · PT '+escape(move.ptCost||move.power||0)+'</button>').join("")+'</div>':m.status==="halftime"?'<button class="halloween-action" data-halloween-halftime>RIPRENDI SECONDO TEMPO</button>':m.status==="penalties"?'<div class="halloween-choices">'+["left","center","right"].map(d=>'<button data-halloween-penalty="'+d+'">'+({left:"SINISTRA",center:"CENTRO",right:"DESTRA"}[d])+'</button>').join("")+'</div>':'<button class="halloween-action" data-halloween-next>PROSEGUI</button>')+'<p><button data-halloween-abandon>ABBANDONA PARTITA</button></p></div></div>';
    }
    function render() {
      if(!app)return;
      app.innerHTML=shell(match&&view==="match"?pendingSection():view==="squad"?squadSection():view==="vending"?vendingSection():view==="album"?albumSection():matchSection());
      app.querySelector("[data-halloween-back]")?.addEventListener("click",()=>{dispose();deps.onReturn?.();});
      app.querySelector("[data-halloween-close-detail]")?.addEventListener("click",()=>{detailPid="";render();});
      app.querySelectorAll("[data-player-card]").forEach(el=>el.addEventListener("click",event=>{if(el.closest?.("[data-halloween-pick]"))return;event.stopPropagation?.();detailPid=el.dataset.playerCard;render();}));
      app.querySelectorAll("[data-halloween-tab]").forEach(el=>el.addEventListener("click",()=>{view=el.dataset.halloweenTab;render();}));
      app.querySelector("[data-halloween-start]")?.addEventListener("click",()=>perform(startMatch));
      app.querySelector("[data-halloween-resume]")?.addEventListener("click",()=>{view="match";render();});
      app.querySelector("[data-halloween-next]")?.addEventListener("click",()=>perform(()=>stepMatch(null)));
      app.querySelectorAll("[data-halloween-choice]").forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch(el.dataset.halloweenChoice))));
      app.querySelector("[data-halloween-halftime]")?.addEventListener("click",()=>perform(()=>stepMatch("halftime")));
      app.querySelectorAll("[data-halloween-penalty]").forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch("penalty:"+el.dataset.halloweenPenalty))));
      app.querySelector("[data-halloween-abandon]")?.addEventListener("click",()=>perform(abandonMatch));
      app.querySelector("[data-halloween-close-result]")?.addEventListener("click",()=>perform(closeResult));
      app.querySelector("[data-halloween-pull]")?.addEventListener("click",()=>perform(pull));
      app.querySelectorAll("[data-halloween-remove]").forEach(el=>el.addEventListener("click",()=>perform(()=>editSquad("remove",el.dataset.halloweenRemove))));
      app.querySelectorAll("[data-halloween-pick]").forEach(el=>el.addEventListener("click",()=>perform(()=>editSquad("add",el.dataset.halloweenPick))));
      app.querySelector("[data-halloween-coach]")?.addEventListener("change",el=>perform(()=>editSquad("coach",el.target.value)));
      app.querySelector("[data-halloween-search]")?.addEventListener("change",el=>{search=el.target.value.trim();render();});
    }
    async function perform(op) {if(busy)return;try{await op();render();}catch(error){global.console?.error?.("[RTG Halloween]",error);notify("Operazione Halloween non riuscita. Nessuna modifica confermata.","error");}}
    async function editSquad(kind,cardId) {
      if(match)throw fail("halloween-active-match");
      lock();
      const allowed = new Set(userCards()), curr = clone(localSquad);
      if(kind==="add"){if(!allowed.has(cardId))throw fail("halloween-card-not-owned"); if(curr.lineup.includes(cardId)||curr.bench.includes(cardId))return; if(curr.lineup.length<11)curr.lineup.push(cardId); else if(curr.bench.length<4)curr.bench.push(cardId);else throw fail("halloween-squad-full");}
      else if(kind==="remove"){curr.lineup=curr.lineup.filter(x=>x!==cardId);curr.bench=curr.bench.filter(x=>x!==cardId);}
      else if(kind==="coach"){if(cardId&&!(shared.coachOwnedIds||[]).includes(cardId))throw fail("halloween-coach-unowned");curr.coachId=cardId;}
      const epoch=session;
      await storage.updateMany([SQUAD_KEY],()=>({writes:{[SQUAD_KEY]:curr},value:true}));
      assertCurrent(epoch);localSquad=curr;
    }
    async function startMatch() {
      if(!isOpen() || match)throw fail("halloween-event-closed-or-match-active");
      const squad=resolvedUser();if(!squad)throw fail("halloween-squad-incomplete");
      if(ovr(squad.lineup)>opponentOverall()+1)throw fail("halloween-overall-cap");
      if(global.RtgFourMovesRuntime && !(await global.RtgFourMovesRuntime.ready))throw fail("halloween-move-catalog-not-ready");
      const epoch=session;
      const matchId="halloween-2026:"+String(global.crypto?.randomUUID?.()||Date.now()+"-"+Math.random());
      const created=global.RoadToGloryMatchEngine.createMatch({seasonId:EVENT_ID,matchId,seed:matchId,nodeId:"event:occult-halloween",matchType:"event",attemptNumber:1,userSquad:squad,opponentSquad:opponent()});
      created.presentation={preMatchSeen:true};
      lock();
      await storage.updateMany([MATCH_KEY],records=>{if(records[MATCH_KEY]!=null)throw fail("halloween-active-match");return {writes:{[MATCH_KEY]:created},value:true};});
      assertCurrent(epoch);match=created;
    }
    async function finalizeIfNeeded(m) {
      const terminal=["completed","completed-draw"].includes(m.status);
      if(!terminal)return m;
      const {value}=await mutate("halloween-match-reward",(account,records)=>{
        const live=records[MATCH_KEY];if(!live||live.matchId!==m.matchId)throw fail("halloween-stale-match");
        const ledger=account.halloween.completedIds;
        const already=ledger.includes(m.matchId);
        const lucky=global.RoadToGloryRng.int(m.matchId,"halloween-lucky",0,100)<10 && m.result?.winner==="user";
        const award=already?Number(live.halloweenAward||0):(lucky?LUCKY_PRIZE:PRIZE);
        if(!already){account.halloween.pumpkins+=award;ledger.push(m.matchId);if(lucky)account.halloween.luckyWins++;}
        return {writes:{[MATCH_KEY]:{...m,halloweenAward:award}},match:m};
      },[SHARED_KEY,MATCH_KEY]);
      match=(await storage.read(MATCH_KEY))||m;
      return match;
    }
    async function stepMatch(choice) {
      if(!match || !isOpen())throw fail("halloween-match-unavailable");
      const epoch=session;
      let latest;
      await storage.updateMany([MATCH_KEY],records=>{
        const m=records[MATCH_KEY];if(!m||m.matchId!==match.matchId)throw fail("halloween-stale-match");
        if(choice==="halftime")latest=global.RoadToGloryMatchEngine.confirmHalftime(m,m.userSquad);
        else if(choice?.startsWith("penalty:")) {
          const n=m.shootout?.history?.length||0,side=n%2===0?"user":"opponent",direction=choice.slice(8);
          const ai=["left","center","right"][global.RoadToGloryRng.int(m.matchId,"halloween-penalty-ai",n,3)];
          latest=global.RoadToGloryMatchEngine.resolvePenaltyKick(m,{attackingSide:side,shooterChoice:side==="user"?direction:ai,goalkeeperChoice:side==="user"?ai:direction}).state;
        } else if(m.pendingEncounter)latest=global.RoadToGloryMatchEngine.resolvePendingEncounter(m,choice||"base");
        else latest=global.RoadToGloryMatchEngine.prepareNext(m);
        if(!latest || typeof latest!=="object")throw fail("halloween-invalid-match-step");
        return {writes:{[MATCH_KEY]:latest},value:true};
      });
      assertCurrent(epoch);match=latest;
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
      if(!isOpen()||match)throw fail("halloween-pull-unavailable");
      let selected="";
      await mutate("halloween-capsule",(account)=>{
        const ev=account.halloween;
        if(ev.pumpkins<PRICE)throw fail("halloween-insufficient-pumpkins");
        const missing=Array.from(assets.players.keys()).filter(id=>!ev.ownedIds.includes(id));
        if(!missing.length)throw fail("halloween-collection-completed");
        const random=global.crypto?.getRandomValues?global.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296:Math.random();
        selected=weightedPick(missing,random);
        const record=recordCard(selected);
        if(account.gachaAcquiredCards.some(c=>c.cardId===record.cardId))throw fail("halloween-existing-card");
        ev.pumpkins-=PRICE;ev.ownedIds.push(selected);ev.pullCount++;
        account.gachaAcquiredCards.push(record);
      });
      const p=player(selected);
      notify("🎃 Sbloccato: "+(p?.name||selected)+"! Disponibile in tutte le Season.");
    }
    async function open(initialView="match") {
      dispose();const epoch=session;
      await prepare();assertCurrent(epoch);
      const previous=global.SeasonRegistry?.activeId?.();
      const needed=["ie1","ie1_s2","ie1_s3","ie2","orion"];
      await Promise.all(needed.map(id=>global.SeasonRegistry?.loadDatabase?.(id).catch(()=>null)));
      if(previous)global.SeasonRegistry?.setActive?.(previous);
      const response=await global.fetch("data/FREE_AGENTS_compact.json");
      if(!response.ok)throw fail("halloween-free-agent-data-unavailable");
      const freeAgents=await response.json();assertCurrent(epoch);
      data={freeAgents};await load();assertCurrent(epoch);
      view=initialView==="album"?"album":"match";detailPid="";
      if(match&&["completed","completed-draw"].includes(match.status)&&!Number.isInteger(match.halloweenAward))await finalizeIfNeeded(match);
      assertCurrent(epoch);render();listen();
    }
    return Object.freeze({open,render,dispose,getState:()=>({shared:shared&&clone(shared),match:match&&clone(match)})});
  }
  global.RoadToGloryHalloween = Object.freeze({
    EVENT_ID,TEAM_ID,EVENT_END_MS,PRICE,PRIZE,LUCKY_PRIZE,isOpen,countdown,eventCard,prepare,
    eventPlayer:player,eventState,opponentOverall,weightedPick,create
  });
})(globalThis);
