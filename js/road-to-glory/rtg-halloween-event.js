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
  const HALLOWEEN_COACH_ID = "halloween-coach-54";
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
  function ovr(lineup,discount=null) {
    return !Array.isArray(lineup) || lineup.length !== 11 ? null :
      Math.round((lineup.reduce((sum,p)=>{
        const value=Math.max(0,Number(p?.overall ?? p?.finalOverall ?? 0));
        return sum+(p?.cardId===discount?.cardId?Math.max(0,value-Math.max(0,Number(discount.amount)||0)):value);
      }, 0)/11)*10)/10;
  }
  function weightedPick(missing, random) {
    const pool = missing.map(pid => ({pid,weight:pid===HALLOWEEN_COACH_ID||SPECIAL.includes(pid)?4:5.75}));
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
    let data = null, shared = null, localSquad = null, match = null, view = "match", busy = false;
    let tick = null, matchTimer = null, session = 0, search = "", detailPid = "", activeSquadSlot = 1, squadSlots = null;
    let halftimeDraft=null,halfSelected="",encounterSelection="",encounterKey="",lastResolution=null,lastResolutionStage="resolved",pendingRevealHidden=false;
    let selectedAlbumTeamId=TEAM_ID;
    let vendingMotion=null;
    const assertCurrent = epoch => { if (epoch !== session) throw fail("halloween-stale-controller"); global.RoadToGloryPersistence?.assertWritable?.(); };
    function dispose() { session++; if (tick != null) global.clearInterval?.(tick); tick = null;
      if(matchTimer!=null)global.clearTimeout?.(matchTimer);matchTimer=null;
      vendingMotion?.stop?.();vendingMotion=null;lastResolution=null;lastResolutionStage="resolved";pendingRevealHidden=false;
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
      const savedCards=[...(localSquad?.lineup||[]),...(localSquad?.bench||[])];
      if ((localSquad?.lineup||[]).length!==11||(localSquad?.bench||[]).length!==4||
          new Set(savedCards).size!==15||savedCards.some(cardId=>!resolveCard(cardId)))
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
      return {name:"Occult Halloween",teamId:TEAM_ID,logoUrl:LOGO_URL,seasonId:EVENT_ID,formationId:"4-4-2",
        lineup:assets.setup.startingXI.map(pid=>player(pid)),bench:Array.from(assets.players.keys()).filter(pid=>!assets.setup.startingXI.includes(pid)).map(pid=>player(pid))};
    }
    function currency(n) { return '<span class="halloween-currency"><img src="'+escape(PUMPKIN_URL)+'" alt="">'+escape(n)+'</span>'; }
    function isOwned(pid) { return shared?.halloween.ownedIds.includes(pid); }
    function halloweenPrizeIds(account) {
      const missing=Array.from(assets.players.keys()).filter(pid=>!account.halloween.ownedIds.includes(pid));
      if(!account.coachOwnedIds.includes(HALLOWEEN_COACH_ID))missing.push(HALLOWEEN_COACH_ID);
      return missing;
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
    function nativeCard(p,opts={}) {
      const cls=opts.event&&p?.halloweenVampire?" halloween-vampire-card":"";
      const attr=opts.attr||"";
      return typeof deps.compactPlayerCardMarkup==="function"
        ? deps.compactPlayerCardMarkup(p,{level:20,overall:p?.overall??p?.finalOverall,
            dataAttr:attr,extraClass:"halloween-native-card"+cls})
        : '<button type="button" class="player-card player-card-compact '+cls+'" '+attr+'><span class="player-corner player-role">'+escape(p.position||"")+'</span><span class="player-corner player-overall">'+escape(p.overall||"")+'</span><img class="player-portrait" src="'+escape(p.portraitUrl||"")+'" alt=""><strong>'+escape(p.name||"")+'</strong></button>';
    }
    function openNativeDetail(cardId,albumUnlocked=false,fromAlbum=false) {
      const p=resolveCard(cardId);
      if(!p)return;
      // The generic RTG detail resolver cannot resolve an unowned event card.
      // Use this event player's canonical render directly, even when locked.
      if(deps.showPlayerDetailsFor) {
        deps.showPlayerDetailsFor(p,{playerId:p.playerId,level:20,readOnly:true,rtgFourMoves:true,
          moveSeasonId:p.halloweenMoves?EVENT_ID:(p.resolvedSeasonId||p.legacySeasonId||"ie1"),
          rtgRarity:p.category,mode:fromAlbum?"album":"current",albumUnlocked});
      } else if(deps.openPlayerDetails) {
        deps.openPlayerDetails(cardId,"",{mode:fromAlbum?"album":undefined,albumUnlocked});
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
      return '<section class="rtg-journey-summary halloween-journey-summary halloween-event-hero" aria-label="Prossima partita Halloween">'+
        '<div class="halloween-event-hero-top"><div class="halloween-event-hero-copy">'+
        '<p class="eyebrow">SFIDA EVENTO · IL CIMITERO STREGATO</p><h1>OCCULT<br>HALLOWEEN</h1>'+
        '<p>Completa la partita: +'+PRIZE+' zucche.</p></div>'+
        '<img class="halloween-event-hero-crest" src="'+escape(LOGO_URL)+'" alt="Stemma Occult Halloween"></div>'+
        '<div class="halloween-event-ovr-strip" aria-label="Requisiti overall">'+
        '<div><span>OVR AVVERSARIO</span><strong>'+target+'</strong></div>'+
        '<div><span>OVR MASSIMO</span><strong>'+limit+'</strong></div>'+
        '<div class="'+(overLimit?"is-over-limit":!ours?"is-incomplete":"is-eligible")+'"><span>LA TUA SQUADRA</span><strong>'+escape(own??"—")+'</strong></div></div>'+
        '<div class="halloween-event-status '+(overLimit||!ours?"is-warning":"is-ready")+'"><strong>'+status+'</strong><span>'+statusMessage+'</span></div>'+
        mainAction+'</section>'+
        '<section class="panel rtg-run-command halloween-vending-banner halloween-vending-teaser" aria-label="Distributore stregato">'+
        '<div class="halloween-vending-teaser-copy"><span class="eyebrow">CAPSULE HALLOWEEN</span>'+
        '<h2>DISTRIBUTORE STREGATO</h2><p>1 capsula · '+PRICE+' zucche</p></div>'+
        '<button type="button" class="btn btn-yellow rtg-vending-button" data-halloween-open-vending>APRI DISTRIBUTORE →</button>'+
        '</section>';
    }
    function squadSection() {
      const view=deps.squadView;
      if(!view?.renderModel||!view?.markup)return '<p>Layout RTG non disponibile</p>';
      const freeAgentIds=(data.freeAgents?.players||[]).map(p=>asId(p.playerId||p.id));
      const model=tacticalLineupModel(view.renderModel({state:activeEventSquad(),freeAgentIds,seasonDb:global.SeasonRegistry?.database?.("ie1")||{},
          freeAgentsDb:data.freeAgents,playerResolver:{resolveAtLevel20:cardId=>resolveCard(cardId)}}));
      const meta=deps.getUserTeamMeta?.()||{};
      const name=meta.name||"La tua squadra";
      const squadOvr=ovr(resolvedUser()?.lineup,eventOverallDiscount());
      const coachDiscount=eventOverallDiscount(),coachTarget=coachDiscount&&resolveCard(coachDiscount.cardId);
      const coachNote=coachTarget?'<p class="rtg-coach-cap-note">Maschera Maledetta attiva · '+
        escape(coachTarget.name||coachTarget.playerId||"Titolare Halloween")+
        ': −15 OVR solo per i requisiti, non in partita.</p>':"";
      const requirement='<div class="rtg-requirements-list"><div class="rtg-requirement '+(squadOvr!=null&&squadOvr<=opponentOverall()+1?"ok":"bad")+'"><span>Overall max · Evento Halloween</span><strong>'+escape(squadOvr??"—")+' / '+(opponentOverall()+1)+'</strong></div>'+coachNote+'</div>';
      return '<div class="rtg-halloween-mode halloween-squad-mode">'+
        view.markup(model,{teamName:name,teamIdentity:meta.teamIdentity,teamPower:squadOvr,activeSquadSlot,
          coachSlotMarkup:global.RoadToGloryCoachesView?.squadSlot?.(
            activeEventSquad(),localSquad.coachId,localSquad.coachPowerSelection)||"",
          requirementsMarkup:requirement,nextTeamName:"Occult Halloween",dirty:false})+'</div>';
    }
    function vendingSection() {
      const available=halloweenPrizeIds(shared),enough=shared.halloween.pumpkins>=PRICE;
      const capsules=Array.from({length:12},(_,i)=>'<div class="rtg-vending-capsule-v9 c'+(i%6+1)+'" data-capsule-rarity="'+(i%2?"orange":"black")+'"></div>').join("");
      return '<div class="halloween-vending"><button type="button" class="halloween-vending-close" data-halloween-close-vending aria-label="Chiudi distributore">×</button><p class="eyebrow">CAPSULE STATION · HALLOWEEN</p><h2>IL DISTRIBUTORE STREGATO</h2>'+
        '<div class="rtg-vending halloween-vending-classic"><div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="Distributore Halloween">'+
        '<div class="rtg-vending-head-v9"><span>CAPSULE STATION</span><strong>OCCULT HALLOWEEN</strong></div>'+
        '<div class="rtg-vending-window-v9">'+capsules+'<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div>'+
        '<div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>'+PRICE+'</strong></div>'+
        '<div class="rtg-vending-crank-v9"><span></span></div><div class="rtg-vending-chute-v9"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9">🎃</div></div></div>'+
        '<button class="btn btn-yellow rtg-vending-pull halloween-action" data-halloween-pull '+(!isOpen()||!enough||available.length===0?"disabled":"")+'>GIRA · '+currency(PRICE)+'</button>'+
        '<div class="rtg-vending-wallet-chip"><span>ZUCCHE HALLOWEEN</span><strong>'+currency(shared.halloween.pumpkins)+'</strong></div></div></div>'+
        '</div>';
    }
    function eventAlbumTeams() {
      // Single event team today; future event teams can be added to this
      // collection without replacing the native RTG teams/roster screens.
      const teamRecords=[assets.team];
      return teamRecords.filter(Boolean).map(team=>{
        const roster=(team.players||[]).map(raw=>isOwned(asId(raw.playerId))
          ?resolveCard(EVENT_ID+"::"+asId(raw.playerId)):player(raw.playerId)).filter(Boolean);
        return {teamId:asId(team.teamId),teamName:asId(team.teamName||team.name)||"Occult Halloween",
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
            .replace(/(<p class="eyebrow">)ALBUM → [^<]+/,'$1ALBUM → EVENTO HALLOWEEN')+
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
      if(["completed","completed-draw","abandoned"].includes(match.status)&&!lastResolution){
        const award=Number.isInteger(match.halloweenAward)?match.halloweenAward:0;
        const rewardHtml='<div class="halloween-final-award" role="status"><span>'+
          (match.status==="abandoned"?"PARTITA ABBANDONATA · NESSUN PREMIO":"PREMIO HALLOWEEN ACCREDITATO")+
          '</span><strong>'+(match.status==="abandoned"?"0":"+"+escape(award))+' ZUCCHE</strong></div>';
        const result=v.resultMarkup(match,null).replace(/(<button[^>]*data-rtg-result-continue)/,rewardHtml+'$1');
        return '<main class="screen rtg-match-shell halloween-native-match"><div class="content narrow">'+result+'</div></main>';
      }
      if(match.presentation?.preMatchSeen===false)return v.preMatchMarkup(match).replace('<main class="screen','<main class="screen halloween-native-match');
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
          await storage.updateMany([MATCH_KEY],records=>{
            if(records[MATCH_KEY]?.matchId!==id)throw fail("halloween-stale-match");
            return {writes:{[MATCH_KEY]:chosen},value:true};
          });
          assertCurrent(epoch);match=chosen;
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
        value:id,label:({ie1:"Season 1",ie1_s2:"Season 2",ie1_s3:"Season 3",ie2:"Ares",orion:"Orion",free_agents:"Svincolati",[EVENT_ID]:"Evento Halloween"})[id]||id
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
      function select(id){if(selecting)return;selecting=true;return perform(async()=>{
        try{await editSquad("replace",{from:cardId,to:id});deps.closeModal?.();}
        finally{selecting=false;}
      });}
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
      const seasonName={ie1:"Season 1",ie1_s2:"Season 2",ie1_s3:"Season 3",ie2:"Ares",orion:"Orion",free_agents:"Svincolati",[EVENT_ID]:"Halloween"};
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
      const seasonOptions=[{value:"all",label:"Tutte"},...Array.from(new Set(catalog.map(x=>x.seasonId))).map(value=>({value,label:seasonName[value]||value}))];
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
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native","halloween-detail-vampire");
      const ui=global.RoadToGloryCoachSquadPowerUi;
      if(match||!ui?.open)return;
      const currentState=()=>activeEventSquad(),resolver={resolveAtLevel20:id=>resolveCard(id)};
      const model=()=>tacticalLineupModel(deps.squadView?.renderModel?.({
        state:currentState(),freeAgentIds:(data.freeAgents?.players||[]).map(p=>asId(p.playerId||p.id)),
        seasonDb:global.SeasonRegistry?.database?.("ie1")||{},freeAgentsDb:data.freeAgents,playerResolver:resolver
      })||{});
      ui.open({getCampaign:currentState,getSquadDraft:()=>localSquad,seasonId:()=>"ie1",
        resolve:resolveCard,openModal:deps.openModal,getModalRoot:deps.getModalRoot,
        closeModal:deps.closeModal,toast:notify,squadView:deps.squadView,getModel:model,
        saveSquad:async draft=>editSquad("coachPower",draft),
        openPlayerDetails:key=>openNativeDetail(key),
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
      deps.getModalRoot?.()?.classList?.remove?.("halloween-detail-native","halloween-detail-vampire");
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
        '<summary>DEV HALLOWEEN</summary><div class="halloween-dev-quick-content">'+
        '<p>Zucche: <b>'+escape(shared?.halloween?.pumpkins||0)+'</b></p>'+
        '<button type="button" data-halloween-dev-pumpkins aria-label="Imposta almeno 99.999 zucche Halloween per test">🎃 99.999 ZUCCHE</button>'+
        '</div></details>';
    }
    async function grantDevPumpkins(){
      if(!devMode)throw fail("halloween-dev-unavailable");
      await mutate("halloween-dev-pumpkins",account=>{
        account.halloween.pumpkins=Math.max(account.halloween.pumpkins,99999);
      });
      notify("DEV: 99.999 zucche Halloween disponibili");
    }
    function render() {
      if(!app)return;
      if(matchTimer!=null){global.clearTimeout?.(matchTimer);matchTimer=null;}
      if(view!=="vending"){vendingMotion?.stop?.();vendingMotion=null;}
      if(view==="squad")app.innerHTML=squadSection();
      else if(view==="album"||view==="album-roster")app.innerHTML=albumSection();
      else if(match&&view==="match"&&deps.matchView)app.innerHTML=nativeMatchMarkup();
      else app.innerHTML=shell(view==="vending"?vendingSection():match?pendingSection():matchSection());
      if(devMode)app.innerHTML+=devToolsMarkup();
      if(devMode)app.querySelector?.("[data-halloween-dev-pumpkins]")?.addEventListener("click",event=>{
        const button=event.currentTarget;
        if(button.disabled)return;
        button.disabled=true;
        return perform(grantDevPumpkins).finally(()=>{if(button.isConnected)button.disabled=false;});
      });
      app.querySelectorAll?.("[data-halloween-back],[data-rtg-home]")?.forEach(el=>el.addEventListener("click",()=>{if(view==="match"){dispose();deps.onReturn?.();}else {view="match";render();}}));
      app.querySelector?.("[data-rtg-album-collection-back]")?.addEventListener("click",()=>{dispose();deps.onReturn?.();});
      app.querySelectorAll?.("[data-rtg-album-team]")?.forEach(button=>button.addEventListener("click",()=>{
        const id=asId(button.dataset.rtgAlbumTeam);
        if(!eventAlbumTeams().some(team=>team.teamId===id))return;
        selectedAlbumTeamId=id;view="album-roster";render();
      }));
      app.querySelector?.("[data-rtg-album-back]")?.addEventListener("click",()=>{view="album";render();});
      app.querySelectorAll?.("[data-halloween-tab],[data-rtg-tab]")?.forEach(el=>el.addEventListener("click",()=>{
        const target=el.dataset.halloweenTab || el.dataset.rtgTab;
        if(target==="squad"||target==="run"||target==="match"){view=target==="squad"?"squad":"match";render();}
      }));
      app.querySelector?.("[data-halloween-open-vending]")?.addEventListener("click",()=>{view="vending";render();});
       app.querySelector?.("[data-halloween-close-vending]")?.addEventListener("click",()=>{view="match";render();});
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
          const drawn=await pull(); // Account debit and card acquisition already committed.
          if((!drawn?.player&&!drawn?.coach)||!drawn?.result)return;
          const machine=app.querySelector?.("[data-rtg-vending-machine]");
          const rarity=String(drawn.result.rarity||"").toLowerCase();
          const capsuleColour=rarity==="leggenda"||rarity==="elite"?"orange":"black";
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
            ?global.RoadToGloryCoachesView?.result?.(drawn.coach)?.replace("ROAD TO GLORY · STAFF","OCCULT · HALLOWEEN")
            :deps.runView.pullResultMarkup(drawn.result,drawn.player,{teams:[{teamId:TEAM_ID,teamName:"Occult Halloween",logoUrl:LOGO_URL}]});
          if(!markup)return;
          if(!isCoach)markup=markup.replace("SALDO RTG","ZUCCHE HALLOWEEN")
            .replace(/(<div class="rtg-pull-balance">[\s\S]*?<strong>)[\s\S]*?(<\/strong>)/,
               (_all,before,after)=>before+'<img class="halloween-reveal-currency-icon" src="'+escape(PUMPKIN_URL)+'" alt="Zucca Halloween"> '+escape(drawn.result.balanceAfter)+' ZUCCHE'+after)
            .replace(/ROAD TO GLORY · LEGACY [^<]*/,"OCCULT · HALLOWEEN");
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
    }
    async function perform(op) {if(busy)return;try{await op();render();}catch(error){global.console?.error?.("[RTG Halloween]",error);const reasons={"halloween-pull-unavailable":"Concludi la partita prima di usare il distributore","halloween-insufficient-pumpkins":"Zucca insufficienti per il distributore","halloween-squad-incomplete":"La squadra deve avere 11 titolari e 4 riserve","halloween-overall-cap":"La formazione supera l’OVR massimo dell’evento","halloween-active-match":"Non puoi modificare la squadra durante la partita","halloween-card-identity-invalid":"Errore identità carta evento"};notify(reasons[error?.code]||("Operazione Halloween fallita: "+(error?.code||error?.message||"errore sconosciuto")),"error");}}
    async function editSquad(kind,arg) {
      if(match)throw fail("halloween-active-match");
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
        if(curr.coachPowerSelection&&!global.RoadToGloryCoachPowerRuntime?.validConfig?.(
          curr,curr.lineup,"ie1",curr.bench))throw fail("halloween-coach-selection-invalid");
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
      // An off-field Halloween target no longer reduces the OVR. Expire it
      // visibly during the SAME atomic edit rather than leaving a stale power.
      if(["replace","adapt","formation"].includes(kind)&&
         nextSquad.coachId===HALLOWEEN_COACH_ID&&nextSquad.coachPowerSelection&&
         !global.RoadToGloryCoachPowerRuntime?.validConfig?.(
           nextSquad,nextSquad.lineup,"ie1",nextSquad.bench)){
        nextSquad.coachPowerSelection=null;
        const message="Maschera Maledetta: seleziona di nuovo un titolare Halloween.";
        adaptMessage=adaptMessage?adaptMessage+" "+message:message;
      }
      nextSlots[nextSlot]=clone(nextSquad);
      const epoch=session;
      const saved={...nextSquad,activeSquadSlot:nextSlot,slots:nextSlots};
      await storage.updateMany([SQUAD_KEY],()=>({writes:{[SQUAD_KEY]:saved},value:true}));
      assertCurrent(epoch);
      // Only advance the visible squad once the canonical event save commits.
      activeSquadSlot=nextSlot;localSquad=nextSquad;squadSlots=nextSlots;
      if(adaptMessage)notify(adaptMessage);
    }
    async function startMatch() {
      if(!isOpen() || match)throw fail("halloween-event-closed-or-match-active");
      const squad=resolvedUser();if(!squad)throw fail("halloween-squad-incomplete");
      if(ovr(squad.lineup,eventOverallDiscount())>opponentOverall()+1)throw fail("halloween-overall-cap");
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
        const missing=halloweenPrizeIds(account);
        if(!missing.length)throw fail("halloween-collection-completed");
        const random=global.crypto?.getRandomValues?global.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296:Math.random();
        selected=weightedPick(missing,random);
        if(selected===HALLOWEEN_COACH_ID){
          if(account.coachOwnedIds.includes(selected))throw fail("halloween-coach-already-owned");
          // Existing RTG shared account persists coaches for BOTH campaigns.
          // Debit and coach grant commit in the SAME canonical transaction.
          ev.pumpkins-=PRICE;ev.pullCount++;account.coachOwnedIds.push(selected);
        }else{
          const record=recordCard(selected);
          if(account.gachaAcquiredCards.some(c=>c.cardId===record.cardId))throw fail("halloween-existing-card");
          ev.pumpkins-=PRICE;ev.ownedIds.push(selected);ev.pullCount++;
          account.gachaAcquiredCards.push(record);
        }
      });
      if(selected===HALLOWEEN_COACH_ID)
        return {coach:global.RoadToGloryCoaches?.BY_ID?.[selected],result:{
          coachId:selected,rarity:"Leggenda",balanceAfter:shared.halloween.pumpkins}};
      const p=player(selected);
      return {player:p,result:{cardId:EVENT_ID+"::"+selected,playerId:selected,legacySeasonId:EVENT_ID,rarity:p?.category||"Normale",balanceAfter:shared.halloween.pumpkins}};
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
      view=initialView==="album"?"album":"match";selectedAlbumTeamId=TEAM_ID;detailPid="";
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
