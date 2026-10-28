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
  const EVENT_FULLBODY_URLS = Object.freeze({"38":"https://dxi4wb638ujep.cloudfront.net/1/k/y/z/yz3gzfs1bku_r0_fullbody.webp","39":"https://dxi4wb638ujep.cloudfront.net/1/k/4/c/4cuzgcn9uqk_r0_fullbody.webp","40":"https://dxi4wb638ujep.cloudfront.net/1/k/j/0/j0lsn9bhdzm_r0_fullbody.webp","41":"https://dxi4wb638ujep.cloudfront.net/1/k/l/v/lviojktrgfm_r0_fullbody.webp","42":"https://dxi4wb638ujep.cloudfront.net/1/k/6/9/69tvob1rrsk_r0_fullbody.webp","43":"https://dxi4wb638ujep.cloudfront.net/1/k/a/s/aswadgazemu_r0_fullbody.webp","44":"https://dxi4wb638ujep.cloudfront.net/1/k/r/6/r6b7w5mjz_8_r0_fullbody.webp","45":"https://dxi4wb638ujep.cloudfront.net/1/k/f/q/fq-jb0lbuau_r0_fullbody.webp","46":"https://dxi4wb638ujep.cloudfront.net/1/k/u/4/u4pcsld75z8_r0_fullbody.webp","47":"https://dxi4wb638ujep.cloudfront.net/1/k/a/q/aqup2kkyyfc_r0_fullbody.webp","48":"https://dxi4wb638ujep.cloudfront.net/1/k/x/4/x4lub1si1s0_r0_fullbody.webp","49":"https://dxi4wb638ujep.cloudfront.net/1/k/r/x/rxgbiozaame_r0_fullbody.webp","50":"https://dxi4wb638ujep.cloudfront.net/1/k/g/_/g_36lx_6t_s_r0_fullbody.webp","51":"https://dxi4wb638ujep.cloudfront.net/1/k/i/e/iewmlotwo5s_r0_fullbody.webp","52":"https://dxi4wb638ujep.cloudfront.net/1/k/t/2/t2bhmxlsfke_r0_fullbody.webp","53":"https://dxi4wb638ujep.cloudfront.net/1/k/z/z/zziy1s-kwq0_r0_fullbody.webp"});
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
      ...raw, ...stats, playerId:asId(raw.playerId), cardId:EVENT_ID+"::"+asId(raw.playerId),
      legacySeasonId:EVENT_ID, resolvedSeasonId:EVENT_ID, teamId:TEAM_ID,
      teamName:"Occult Halloween", teamLogoUrl:LOGO_URL, level:20, stats, baseStats:stats,
      normalizedRole:raw.position, finalOverall:Number(raw.overall)||0,
      category:raw.category, finalRarity:raw.category, activeMove:moves[0] || null,
      halloweenMoves:moves, halloweenVampire:!SPECIAL.includes(asId(pid)),
      frontFullbodyUrl:raw.frontFullbodyUrl || EVENT_FULLBODY_URLS[asId(pid)] || null,
      fullbodyUrl:raw.frontFullbodyUrl || EVENT_FULLBODY_URLS[asId(pid)] || null,
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
      Math.round((lineup.reduce((sum,p)=>sum + Number(p?.overall ?? p?.finalOverall ?? 0), 0)/11)*10)/10;
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
    let tick = null, matchTimer = null, session = 0, search = "", detailPid = "", activeSquadSlot = 1, squadSlots = null;
    let halftimeDraft=null,halfSelected="",encounterSelection="",encounterKey="",lastResolution=null;
    let vendingMotion=null;
    const assertCurrent = epoch => { if (epoch !== session) throw fail("halloween-stale-controller"); global.RoadToGloryPersistence?.assertWritable?.(); };
    function dispose() { session++; if (tick != null) global.clearInterval?.(tick); tick = null;
      if(matchTimer!=null)global.clearTimeout?.(matchTimer);matchTimer=null;
      vendingMotion?.stop?.();vendingMotion=null;lastResolution=null;
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native","halloween-detail-vampire");
    }
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
      if (!match && (localSquad.lineup?.length<11||localSquad.bench?.length<4)) localSquad=initialEventSquad(localSquad);
      if (!localSquad?.formationId) localSquad = {...localSquad,formationId:"4-3-3",activeRoleVariantByCardId:{}};
      if(!match && localSquad.lineup?.length===11) localSquad.lineupOrderedBySlot=true;
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
      const formationId=localSquad?.formationId||"4-3-3";
      const formation=(global.RoadToGloryConfig?.season?.("ie1")?.formations||[]).find(f=>asId(f.id)===formationId);
      const slots=Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11?formation.slotRoles:null;
      return {formationId,seasonId:"ie1",lineup:line.map((p,i)=>({...p,tacticalRole:slots?.[i]||p.tacticalRole||p.normalizedRole||p.position})),bench:bench.filter(Boolean),coachId:localSquad?.coachId||""};
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
      return {formationId:previous.formationId||"4-3-3",lineup,bench,lineupOrderedBySlot:true,coachId:previous.coachId||"",activeRoleVariantByCardId:previous.activeRoleVariantByCardId||{}};
    }
    function activeEventSquad() {return {...shared,activeSeasonId:"ie1",gachaAcquiredCards:shared.gachaAcquiredCards,coachOwnedIds:shared.coachOwnedIds,squads:{ie1:localSquad}};}
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
        '<section class="panel rtg-run-command halloween-original-command halloween-vending-banner">'+
        '<button type="button" class="btn btn-yellow rtg-vending-button" data-halloween-open-vending>DISTRIBUTORE HALLOWEEN</button></section>'+
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
      if(["completed","completed-draw","abandoned"].includes(match.status))
        return '<main class="screen rtg-match-shell halloween-native-match"><div class="content narrow">'+v.resultMarkup(match,null)+
          '<p class="halloween-event-reward">'+(match.status==="abandoned"?"Partita abbandonata · nessuna ricompensa":"🎃 "+(Number.isInteger(match.halloweenAward)?match.halloweenAward:0)+" ZUCCHE HALLOWEEN")+'</p></div></main>';
      if(match.presentation?.preMatchSeen===false)return v.preMatchMarkup(match).replace('<main class="screen','<main class="screen halloween-native-match');
      return v.matchMarkup(match).replace('<main class="screen','<main class="screen halloween-native-match');
    }
    function bindNativeMatch(){
      const v=deps.matchView,m=match;
      if(!v||!m)return;
      const done=["completed","completed-draw","abandoned"].includes(m.status);
      if(!done&&m.presentation?.preMatchSeen!==false){
        const overlay=app.querySelector?.("[data-rtg-match-overlay]");
        if(overlay){
          if(m.status==="halftime"){
            if(!halftimeDraft)halftimeDraft=clone(m.userSquad);
            overlay.innerHTML=v.halftimeMarkup(halftimeDraft,{match:m,selectedPlayerId:halfSelected});
          }else if(m.status==="penalties")overlay.innerHTML=v.penaltyMarkup(m,nativePenaltyContext(m));
          else if(lastResolution){
            overlay.innerHTML=v.resolvedEncounterMarkup(lastResolution);
          }else if(m.pendingEncounter){
            const pending=m.pendingEncounter;
            if(encounterKey!==asId(pending.encounterId)){encounterKey=asId(pending.encounterId);encounterSelection="";}
            const user=findNativeMatchPlayer("user",pending.userPlayerId),opp=findNativeMatchPlayer("opponent",pending.aiPlayerId||pending.opponentPlayerId);
            overlay.innerHTML=v.encounterMarkup(m,{userPlayer:user,opponentPlayer:opp,selectedChoice:encounterSelection});
          }
        }
      }
      v.bind(app,{
        onOpenPlayerDetails:(id,side)=>{
          const p=findNativeMatchPlayer(side,id);
          if(p&&side==="opponent")openNativeDetail(asId(p.cardId||p.playerId));
          else if(p)openNativeDetail(asId(p.cardId||p.playerId));
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
      if(!done&&m.status==="halftime"){
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
      app.querySelector?.("[data-rtg-duel-continue]")?.addEventListener("click",()=>{lastResolution=null;perform(()=>stepMatch(null));});
      if(!done && m.status==="active" && !m.pendingEncounter && !lastResolution && m.presentation?.preMatchSeen===true && typeof global.setTimeout==="function"){
        const activeId=m.matchId,epoch=session;
        matchTimer=global.setTimeout(()=>{
          matchTimer=null;
          if(epoch===session&&view==="match"&&match?.matchId===activeId&&!busy)perform(()=>stepMatch(null));
        },550);
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
          await storage.updateMany([MATCH_KEY],records=>{
            if(records[MATCH_KEY]?.matchId!==id)throw fail("halloween-stale-match");
            return {writes:{[MATCH_KEY]:chosen},value:true};
          });
          assertCurrent(epoch);match=chosen;
        },
        render:()=>render()});
    }

    function modalRoot(){return deps.getModalRoot?.() || app;}
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
      const all=userCards().filter(id=>id!==cardId&&!roster.has(id)).map(id=>{
        const p=resolveCard(id),sid=id.split("::")[0];
        return p?{cardId:id,playerId:id,source:sid==="free_agents"?"Svincolato":"RTG",seasonId:sid,player:p,
          role:String(p.normalizedRole||p.position||"").toUpperCase(),
          rarity:String(p.finalRarity||p.category||"Normale"),
          overall:Number(p.overall??p.finalOverall??0),
          teams:Array.from(new Set([p.teamName,...(p.teams||[]),...(p.teamIds||[])].map(asId).filter(Boolean)))
        }:null;
      }).filter(Boolean);
      const seasons=[{value:"all",label:"Tutte"},...Array.from(new Set(all.map(e=>e.seasonId))).map(id=>({
        value:id,label:({ie1:"Season 1",ie1_s2:"Season 2",ie1_s3:"Season 3",ie2:"Ares",orion:"Orion",free_agents:"Svincolati",[EVENT_ID]:"Evento Halloween"})[id]||id
      }))];
      const rarities=Array.from(new Set(all.map(e=>e.rarity))).sort((a,b)=>a.localeCompare(b,"it"));
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
      function select(id){return perform(async()=>{
        await editSquad("replace",{from:cardId,to:id});deps.closeModal?.();
      });}
      function wireResults(){
        modalRoot()?.querySelectorAll?.("[data-rtg-picker-player]")?.forEach(b=>b.addEventListener("click",()=>select(b.dataset.rtgPickerPlayer)));
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
      if(!deps.openModal||!deps.squadView?.catalogMarkup)return;
      const entries=(shared.gachaAcquiredCards||[]).map(meta=>({
        cardId:meta.cardId,playerId:meta.playerId,source:"RTG",player:resolveCard(meta.cardId)
      })).filter(x=>x.player);
      let query="",role="all";
      function matchList(){return entries.filter(e=>(!query||String(e.player.name||"").toLowerCase().includes(query.toLowerCase()))
        &&(role==="all"||String(e.player.normalizedRole||e.player.position||"").toUpperCase()===role));}
      function bindCards(){
        modalRoot()?.querySelectorAll?.("[data-rtg-catalog-player]")?.forEach(btn=>btn.addEventListener("click",()=>openNativeDetail(btn.dataset.rtgCatalogPlayer)));
      }
      function updateResults(){
        const list=matchList(),target=modalRoot()?.querySelector?.("[data-rtg-catalog-results]");
        if(target){target.innerHTML=deps.squadView.catalogResultsMarkup({entries:list.slice(0,80),total:list.length});bindCards();}
      }
      deps.openModal(deps.squadView.catalogMarkup({entries,total:entries.length}),{className:"rtg-modal rtg-halloween-picker"});
      bindCards();
      modalRoot()?.querySelector?.("[data-rtg-catalog-search]")?.addEventListener("input",e=>{query=e.target.value.trim();updateResults();});
      modalRoot()?.querySelectorAll?.("[data-rtg-catalog-role]")?.forEach(b=>b.addEventListener("click",()=>{role=b.dataset.rtgCatalogRole;updateResults();}));
    }
    function openNativeCoachPower(){
      const ui=global.RoadToGloryCoachSquadPowerUi;
      if(match||!ui?.open)return;
      const currentState=()=>activeEventSquad(),resolver={resolveAtLevel20:id=>resolveCard(id)};
      const model=()=>deps.squadView?.renderModel?.({
        state:currentState(),freeAgentIds:(data.freeAgents?.players||[]).map(p=>asId(p.playerId||p.id)),
        seasonDb:global.SeasonRegistry?.database?.("ie1")||{},freeAgentsDb:data.freeAgents,playerResolver:resolver
      })||{};
      ui.open({getCampaign:currentState,getSquadDraft:()=>localSquad,seasonId:()=>"ie1",
        resolve:resolveCard,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
        closeModal:deps.closeModal,toast:notify,squadView:deps.squadView,getModel:model,
        saveSquad:async draft=>editSquad("coachPower",draft),
        openPlayerDetails:key=>openNativeDetail(key),
        previewSquadOverall:()=>({before:ovr(resolvedUser()?.lineup),after:ovr(resolvedUser()?.lineup)})
      });
    }
    function openCoaches() {
      const view=global.RoadToGloryCoachesView;
      if(!deps.openModal||!view?.markup)return notify("Catalogo allenatori RTG non disponibile","error");
      function openCollection(){
        deps.openModal(view.markup(activeEventSquad(),{tab:"collection",equippedId:localSquad.coachId||""}),
          {className:"rtg-modal rtg-coaches-modal rtg-halloween-picker"});
        const root=modalRoot();
        root?.querySelectorAll?.("[data-rtg-coaches-equip]")?.forEach(btn=>btn.addEventListener("click",()=>perform(async()=>{
          await editSquad("coach",btn.dataset.rtgCoachesEquip);deps.closeModal?.();
        })));
        root?.querySelectorAll?.("[data-rtg-coach-detail]")?.forEach(btn=>btn.addEventListener("click",()=>{
          const id=btn.dataset.rtgCoachDetail;
          deps.openModal(view.detail(activeEventSquad(),id,{equippedId:localSquad.coachId||""}),
            {className:"rtg-modal rtg-coach-detail-modal rtg-halloween-picker"});
          modalRoot()?.querySelectorAll?.("[data-rtg-coaches-equip]")?.forEach(b=>b.addEventListener("click",()=>perform(async()=>{
            await editSquad("coach",b.dataset.rtgCoachesEquip);deps.closeModal?.();
          })));
        }));
      }
      openCollection();
    }
    function render() {
      if(!app)return;
      if(matchTimer!=null){global.clearTimeout?.(matchTimer);matchTimer=null;}
      if(view!=="vending"){vendingMotion?.stop?.();vendingMotion=null;}
      if(view==="squad")app.innerHTML=squadSection();
      else if(view==="album")app.innerHTML=albumSection();
      else if(match&&view==="match"&&deps.matchView)app.innerHTML=nativeMatchMarkup();
      else app.innerHTML=shell(view==="vending"?vendingSection():match?pendingSection():matchSection());
      app.querySelectorAll?.("[data-halloween-back],[data-rtg-home]")?.forEach(el=>el.addEventListener("click",()=>{if(view==="match"){dispose();deps.onReturn?.();}else {view="match";render();}}));
      app.querySelector?.("[data-rtg-album-back]")?.addEventListener("click",()=>{dispose();deps.onReturn?.();});
      app.querySelectorAll?.("[data-halloween-tab],[data-rtg-tab]")?.forEach(el=>el.addEventListener("click",()=>{
        const target=el.dataset.halloweenTab || el.dataset.rtgTab;
        if(target==="squad"||target==="run"||target==="match"){view=target==="squad"?"squad":"match";render();}
      }));
      app.querySelector?.("[data-halloween-open-vending]")?.addEventListener("click",()=>{view="vending";render();});
      app.querySelectorAll?.("[data-halloween-start]")?.forEach(el=>el.addEventListener("click",()=>perform(startMatch)));
      app.querySelector?.("[data-halloween-resume]")?.addEventListener("click",()=>{view="match";render();});
      app.querySelector?.("[data-halloween-next]")?.addEventListener("click",()=>perform(()=>stepMatch(null)));
      app.querySelectorAll?.("[data-halloween-choice]")?.forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch(el.dataset.halloweenChoice))));
      app.querySelector?.("[data-halloween-halftime]")?.addEventListener("click",()=>perform(()=>stepMatch("halftime")));
      app.querySelectorAll?.("[data-halloween-penalty]")?.forEach(el=>el.addEventListener("click",()=>perform(()=>stepMatch("penalty:"+el.dataset.halloweenPenalty))));
      app.querySelector?.("[data-halloween-abandon]")?.addEventListener("click",()=>perform(abandonMatch));
      app.querySelector?.("[data-halloween-close-result]")?.addEventListener("click",()=>perform(closeResult));
      if(view==="vending")vendingMotion=global.RoadToGloryVendingMotion?.mount?.(app.querySelector?.("[data-rtg-vending-machine]"))||null;
      app.querySelector?.("[data-halloween-pull]")?.addEventListener("click",event=>{
        const button=event.currentTarget;
        if(button.disabled)return;
        button.disabled=true;
        return perform(async()=>{
          await pull();
          if(vendingMotion){
            try{await vendingMotion.play("orange");}catch(error){global.console?.warn?.("[Halloween] Animazione distributore",error);}
          }
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
      if(view==="album")app.querySelectorAll?.("[data-rtg-album-player-entry]").forEach(entry=>{
        if(entry.dataset.albumUnlocked!=="true")return;
        entry.querySelector?.("[data-rtg-album-player-card]")?.addEventListener("click",()=>openNativeDetail(entry.dataset.rtgAlbumPlayerEntry,true));
      });
    }
    async function perform(op) {if(busy)return;try{await op();render();}catch(error){global.console?.error?.("[RTG Halloween]",error);const reasons={"halloween-pull-unavailable":"Concludi la partita prima di usare il distributore","halloween-insufficient-pumpkins":"Zucca insufficienti per il distributore","halloween-squad-incomplete":"La squadra deve avere 11 titolari e 4 riserve","halloween-overall-cap":"La formazione supera l’OVR massimo dell’evento","halloween-active-match":"Non puoi modificare la squadra durante la partita","halloween-card-identity-invalid":"Errore identità carta evento"};notify(reasons[error?.code]||("Operazione Halloween fallita: "+(error?.code||error?.message||"errore sconosciuto")),"error");}}
    async function editSquad(kind,arg) {
      if(match)throw fail("halloween-active-match");
      lock();
      const curr=clone(localSquad);
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
        const savedSlots=clone(squadSlots||{"1":curr,"2":curr,"3":curr});
        savedSlots[activeSquadSlot]=curr;
        activeSquadSlot=slot;
        localSquad=clone(savedSlots[slot]||curr);squadSlots=savedSlots;
      } else if(kind==="coach"){
        if(arg&&!shared.coachOwnedIds.includes(arg))throw fail("halloween-coach-unowned");
        curr.coachId=arg;curr.coachPowerSelection=null;
      } else if(kind==="coachPower"){
        if(arg?.coachId!==curr.coachId)throw fail("halloween-coach-invalid");
        curr.coachPowerSelection=clone(arg.coachPowerSelection||null);
      } else if(kind==="adapt"||kind==="formation"){
        const formationId=kind==="formation"?asId(arg):curr.formationId;
        const formations=global.RoadToGloryConfig?.season?.("ie1")?.formations||[];
        const formation=formations.find(f=>asId(f.id)===formationId);
        if(!formation&&kind==="formation")throw fail("halloween-formation-unavailable");
        const roles=formation?.requirements||{FW:3,MF:3,DF:4,GK:1};
        const owned=userCards().map(id=>({id,p:resolveCard(id)})).filter(x=>x.p)
          .sort((a,b)=>Number(b.p.overall??b.p.finalOverall??0)-Number(a.p.overall??a.p.finalOverall??0));
        const previous=[...curr.lineup,...curr.bench],line=[];
        for(const role of ["FW","MF","DF","GK"]){
          const count=Number(roles[role]||0);let picks=0;
          for(const id of [...previous,...owned.map(x=>x.id)]) {
            if(picks>=count)break;
            if(line.includes(id)||!allowed.has(id))continue;
            const p=resolveCard(id);
            if(String(p?.normalizedRole||p?.position||"").toUpperCase()!==role)continue;
            line.push(id);picks++;
          }
        }
        if(line.length!==11)throw fail("halloween-formation-insufficient-players");
        const bench=[...previous,...owned.map(x=>x.id)].filter((id,i,all)=>!line.includes(id)&&all.indexOf(id)===i).slice(0,4);
        if(bench.length!==4)throw fail("halloween-bench-insufficient");
        curr.lineup=line;curr.bench=bench;curr.formationId=formationId;
      }
      if(kind!=="slot")localSquad=curr;
      squadSlots=clone(squadSlots||{"1":curr,"2":curr,"3":curr});
      squadSlots[activeSquadSlot]=clone(localSquad);
      const epoch=session;
      const saved={...localSquad,activeSquadSlot,slots:squadSlots};
      await storage.updateMany([SQUAD_KEY],()=>({writes:{[SQUAD_KEY]:saved},value:true}));
      assertCurrent(epoch);
    }
    async function startMatch() {
      if(!isOpen() || match)throw fail("halloween-event-closed-or-match-active");
      const squad=resolvedUser();if(!squad)throw fail("halloween-squad-incomplete");
      if(ovr(squad.lineup)>opponentOverall()+1)throw fail("halloween-overall-cap");
      if(global.RtgFourMovesRuntime && !(await global.RtgFourMovesRuntime.ready))throw fail("halloween-move-catalog-not-ready");
      const epoch=session;
      const matchId="halloween-2026:"+String(global.crypto?.randomUUID?.()||Date.now()+"-"+Math.random());
      const meta=deps.getUserTeamMeta?.()||{};
      squad.name=meta.name||"La tua squadra";
      if(meta.teamIdentity)squad.teamIdentity=clone(meta.teamIdentity);
      let created=global.RoadToGloryMatchEngine.createMatch({seasonId:EVENT_ID,matchId,seed:matchId,nodeId:"event:occult-halloween",matchType:"event",attemptNumber:1,userSquad:squad,opponentSquad:opponent()});
      const state=activeEventSquad(),coach=global.RoadToGloryCoachPreMatchRuntime?.coachFor?.(state,"ie1")||"";
      created=global.RoadToGloryCoachPowerRuntime?.applyToMatch?.(created,localSquad,state,{
        upgradeRarity:(player,targetRarity,cardId)=>global.RoadToGloryCoachRarityPower?.upgrade?.({
          player,targetRarity,cardId,playerResolver:global.RoadToGloryPlayerResolver,
          freeAgentsDb:data.freeAgents,seasonId:"ie1",squad:localSquad
        })
      })||created;
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
      lastResolution=null;
      const log=before?.encounterId&&latest?.log?.find?.(entry=>asId(entry.encounterId)===asId(before.encounterId));
      if(before&&log&&latest.status==="active"){
        const userPlayer=findNativeMatchPlayer("user",before.userPlayerId);
        const opponentPlayer=findNativeMatchPlayer("opponent",before.aiPlayerId||before.opponentPlayerId);
        const userWon=before.userSide===before.actorSide?!!log.actorWon:!log.actorWon;
        const selectedMove=choice?.startsWith("move:")?before.userMoveOptions?.[Number(choice.slice(5))]:null;
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
          opponentLabel:latest.opponentSquad?.name||"Occult Halloween"
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
