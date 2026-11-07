(function coachModel(global) {
  "use strict";
  const COST = 900;
  // power: tipo e parametri del potere (registro dei tipi: rtg-coach-power-types.js). L'allenatore di un evento
  // (eventCoach) prende il potere dal file dell'evento in data/events/.
  const CATALOG = Object.freeze([
    {id:"36",power:{type:"swapOpponentStarter",params:{picks:2},ui:{title:"CAMBIO FORZATO",note:"Seleziona un titolare avversario e la riserva che entrerà al suo posto. Il portiere si sostituisce solo con un altro portiere; gli altri giocatori di movimento possono avere ruoli differenti."}},powerName:"Cambio forzato",powerDescription:"Scegli un titolare avversario e lo sostituisci con una riserva della squadra avversaria, scelta sempre da te. Se sostituisci un portiere, la riserva deve essere un portiere; per i giocatori di movimento puoi scegliere una riserva di qualsiasi ruolo di movimento.",name:"Ray Dark",seasonId:"ie1",season:"Season 1",team:"Royal Academy",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/e/e3/Teikoku_Gakuen_emblem_%28VR%29.png/revision/latest?cb=20260214134442",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/8/w/8wocttgsuu0.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/l/d/ldnqtojaamc_r0_fullbody.webp"},
    {id:"208",power:{type:"ptBoost",params:{picks:2,amount:100},ui:{title:"FIDUCIA NEI CAMPIONI",note:"Tocca due titolari direttamente sul campo. Entrambi riceveranno +100 PT iniziali e massimi."}},powerName:"Fiducia nei campioni",powerDescription:"Scegli 2 tuoi titolari: entrambi ricevono +100 ai PT iniziali e massimi.",name:"Seymour Hillman",seasonId:"ie1",season:"Season 1",team:"Raimon",teamLogoUrl:"https://i.namu.wiki/i/4ldvWxMwQZ5E4vwoKkQ1_zo7q1XYu_nD3pMg4NQ9AzVTndTqr2l6HMC9r3xzQMf9ZBJDKlySI8ISXdM8lIlqSg.webp",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/v/v/vvrzhm1aiie.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/y/c/yc4lhjcswqs_r0_fullbody.webp"},
    {id:"1225",power:{type:"borrowOpponentReserve",params:{picks:2},ui:{title:"PRESTITO A SORPRESA",note:"Scegli una riserva avversaria da prendere in prestito e una delle tue 4 riserve da sostituire per questa partita."}},powerName:"Prestito a sorpresa",powerDescription:"Scegli una riserva avversaria e la inserisci temporaneamente nella tua panchina, al posto di una delle tue 4 riserve.",name:"Nerina Hartland",seasonId:"ie1_s2",season:"Season 2",team:"Super Triple C",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/5/5b/Triple_C.png/revision/latest?cb=20240418082803&path-prefix=de",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/u/g/ugcf748fkgm.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/z/1/z11x79vpq4k_r0_fullbody.webp"},
    {id:"1329",power:{type:"halveMoveCost",params:{picks:1,divisor:2},ui:{title:"ALLENAMENTO SPECIALIZZATO",note:"Tocca un titolare sul campo: tutte le sue mosse speciali disponibili costeranno la metà dei PT."}},powerName:"Allenamento specializzato",powerDescription:"Scegli un tuo titolare: il costo in PT di tutte le sue mosse speciali disponibili viene dimezzato, arrotondando per eccesso.",name:"Aquilina Schiller",seasonId:"ie1_s2",season:"Season 2",team:"Raimon",teamLogoUrl:"https://i.namu.wiki/i/4ldvWxMwQZ5E4vwoKkQ1_zo7q1XYu_nD3pMg4NQ9AzVTndTqr2l6HMC9r3xzQMf9ZBJDKlySI8ISXdM8lIlqSg.webp",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/g/-/g-obvenkgrc.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/x/n/xnbtvbk8uz0_r0_fullbody.webp"},
    {id:"1275",power:{type:"drainOpponentPt",params:{picks:2,divisor:4},ui:{title:"ESAURIMENTO OSCURO",note:"Seleziona 2 titolari avversari. Inizieranno con il 25% dei PT normali (-75%), mantenendo invariati i PT massimi."}},powerName:"Esaurimento oscuro",powerDescription:"Scegli 2 titolari avversari. Entrambi iniziano la partita con il 25% dei loro PT normali (-75%). I PT massimi rimangono invariati.",name:"Godric Wyles",seasonId:"ie1_s2",season:"Season 2",team:"Dark Emperors",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/3/39/Dark_Emperors_emblem_%28S%29.png/revision/latest/scale-to-width-down/250?cb=20230726183312",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/f/u/futkwhaljtk.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/o/d/ode2wczt9lm_r0_fullbody.webp"},
    {id:"1777",power:{type:"benchCapOverride",params:{picks:1,cap:60},ui:{title:"FUORI QUOTA",pickerTitle:"SCEGLI UNA RISERVA",previewNote:"La media resta su 15 giocatori. Solo la riserva scelta pesa al massimo 60.",note:"Tocca una riserva sulla panchina: nel calcolo dell'overall squadra conterà al massimo 60. I valori reali non cambiano."}},powerName:"Fuori quota",powerDescription:"Scegli una delle tue 4 riserve. Il suo contributo viene escluso dal conteggio dell'overall utilizzato per verificare i requisiti massimi di accesso alla partita. La riserva resta in panchina, mantiene statistiche e overall effettivi ed è normalmente utilizzabile.",name:"Percival Travis",seasonId:"ie1_s3",season:"Season 3",team:"Inazuma National",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/8/8c/Inazuma_Japan_emblem_%28VR%29.png/revision/latest/scale-to-width-down/200?cb=20251118151807",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/b/w/bwxwy2_pw90.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/2/d/2d-eyzw5elc_r0_fullbody.webp"},
    {id:"1940",power:{type:"blockOpponentMoves",params:{picks:1},ui:{title:"TECNICA PROIBITA",note:"Seleziona un titolare avversario: bloccherai tutte le sue mosse speciali disponibili."}},powerName:"Tecnica proibita",powerDescription:"Scegli un titolare avversario e blocchi tutte le sue mosse speciali disponibili per tutta la partita.",name:"Zoolan Rice",seasonId:"ie1_s3",season:"Season 3",team:"The Kingdom",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/c/c3/The_Kingdom_emblem_%28VR%29.png/revision/latest?cb=20251118151832",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/k/7/k7o456ppquc.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/9/i/9inq5_a5e20_r0_fullbody.webp"},
    {id:"1974",power:{type:"rarityUpgrade",params:{picks:2},ui:{title:"POTENZIALE RISVEGLIATO",note:"Scegli 2 giocatori, titolari o riserve: entrambi salgono temporaneamente di 1 rarità. Puoi vedere le statistiche potenziate qui sotto."}},powerName:"Potenziale risvegliato",powerDescription:"Scegli 2 tuoi giocatori, titolari o riserve: entrambi salgono temporaneamente di 1 rarità, fino ad Aurico, ottenendo i relativi aumenti reali delle statistiche. Ai soli fini del conteggio dell'overall e dei requisiti massimi di accesso alla partita, ciascuno viene considerato con la rarità e l'overall precedenti al potenziamento.",name:"David Arrows",seasonId:"ie1_s3",season:"Season 3",team:"Little Gigantes",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/c/c4/Little_Gigant_emblem_%28S%29.png/revision/latest/scale-to-width-down/250?cb=20210830174846",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/k/t/ktv1j7gglc8.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/t/g/tg8nj-jw_au_r0_fullbody.webp"},
    {id:"4401",power:{type:"elementTransform",params:{picks:2},ui:{title:"TRASFORMAZIONE TOTALE",note:"Scegli 2 titolari. Per ognuno imposta un elemento diverso dall'originale: tutte le sue mosse speciali disponibili cambiano nello stesso elemento. Potenza e costo PT non cambiano."}},powerName:"Trasformazione totale",powerDescription:"Scegli 2 tuoi titolari. Per ciascuno cambi temporaneamente l'elemento in uno dei tre diversi dall'originale (Fuoco, Vento, Albero o Montagna) e trasformi anche tutte le sue mosse speciali disponibili nello stesso elemento. La Potenza e il costo in PT delle mosse rimangono invariati.",name:"Mister Yi",seasonId:"ie2",season:"Ares",team:"Raimon",teamLogoUrl:"https://static.wikia.nocookie.net/inazumaelevenwiki-italia/images/3/3e/Raimon_Go_simbolo.png/revision/latest?cb=20130411084426&path-prefix=it",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/v/x/vxsjctiezes.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/y/k/yk7bcwhytce_r0_fullbody.webp"},
    {id:"halloween-coach-54",zukanId:"54",powerName:"Maschera Maledetta",powerDescription:"Scegli un tuo titolare della collezione Halloween. Per i soli requisiti OVR della squadra, il suo contributo vale 15 punti in meno. Overall reale, statistiche, mosse e partita non cambiano.",name:"Hekyll Jyde",seasonId:"halloween2026",season:"Halloween",team:"Occult Halloween",teamLogoUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/r/k/rk_nafgart8.webp",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/p/5/p54_qlu6ghc.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/4/k/4krtqo9my50_r0_fullbody.webp",eventCoach:true},
    {id:"4761",power:{type:"swapOpponentPositions",params:{picks:2},ui:{title:"DISORDINE TATTICO",note:"Scegli 2 giocatori di movimento avversari: si scambieranno le posizioni tattiche iniziali. Il portiere non può essere selezionato."}},powerName:"Disordine tattico",powerDescription:"Scegli 2 giocatori di movimento avversari e scambi le loro posizioni tattiche nella formazione iniziale.",zukanId:"4763",name:"René Gadé",seasonId:"orion",season:"Orion",team:"Ace Invaders",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/9/95/Navy_Invader_emblem.png/revision/latest/scale-to-width-down/200?cb=20251118122113",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.png",imageFallbackUrls:["https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.webp"],frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/3/e/3e1faym7pbe_r0_fullbody.webp"},
  ].map(c=>Object.freeze(c)));
  const BY_ID = Object.freeze(Object.fromEntries(CATALOG.map(c=>[c.id,c])));
  // Campagne dal registro unico (rtg-config.js), letto quando serve.
  const campaignSeasons=()=>global.RoadToGloryConfig?.CAMPAIGN_SEASONS||global.RoadToGloryState?.CAMPAIGN_SEASONS||{};
  const error=(code,message)=>Object.assign(new Error(message),{code});
  const order=(state)=>campaignSeasons()[state?.campaignId]||[];
  function seasonCompleted(state,seasonId){
    const seasons=order(state),required=seasons.indexOf(seasonId),current=seasons.indexOf(String(state?.activeSeasonId||""));
    if(required<0||current<0)return false;
    // Replay restores the first Season, but never revokes an earned coach unlock.
    // Completion markers are stored in the existing canonical season reward ledger.
    const ledger=state?.seasonTransitionRewardedIds||[];
    if(ledger.includes("completion:"+seasonId))return true;
    if(current>required)return true;
    if(current===required&&state?.seasonComplete===true)return true;
    return (state?.seasonTransitionRewardedIds||[]).some(entry=>String(entry).startsWith(seasonId+"->"));
  }
  // Allenatori degli eventi FINTI (solo ?dev=1&evento=<id>, Passo 4.1): non entrano mai in CATALOG/BY_ID, che sono il
  // catalogo reale usato anche dal salvataggio (rtg-state.js tiene solo gli allenatori di BY_ID). Si vedono solo
  // dentro il loro evento finto, che salva nelle chiavi locali "dev:".
  function devCoaches(eventId=""){
    return (global.GameEvents?.all?.()||[]).filter(event=>event.dev===true&&(!eventId||event.id===eventId))
      .flatMap(event=>(event.coaches||[]).map(coach=>Object.freeze({id:String(coach.id),zukanId:String(coach.zukanId||""),
        powerName:coach.power.name,powerDescription:coach.power.description,name:coach.name,seasonId:event.id,
        season:event.labels.collection,team:event.team.name,teamLogoUrl:event.team.logo,imageUrl:coach.imageUrl||"",
        frontFullbodyUrl:coach.frontFullbodyUrl||coach.imageUrl||"",eventCoach:true,devCoach:true})));
  }
  // Allenatore per id: catalogo reale, poi gli allenatori degli eventi finti caricati.
  const lookup=coachId=>BY_ID[String(coachId)]||devCoaches().find(c=>c.id===String(coachId))||null;
  // Always show all ten coaches in either RTG campaign; inside a fake event also its own coach.
  function catalog(_state,{eventId=""}={}){return [...CATALOG,...(eventId?devCoaches(eventId):[])];}
  function owned(state){return new Set((Array.isArray(state?.coachOwnedIds)?state.coachOwnedIds:[]).map(String));}
  function eligible(state){const have=owned(state);return catalog(state).filter(c=>!c.eventCoach&&seasonCompleted(state,c.seasonId)&&!have.has(c.id));}
  function status(state,coachId){
    const c=lookup(coachId);
    if(!c)return "locked";
    // Ownership belongs to the RTG account; only the draw pool depends on campaign.
    if(owned(state).has(c.id))return "owned";
    if(c.eventCoach)return "locked"; // Halloween capsule only, never the normal 900-token coach gacha.
    if(!order(state).includes(c.seasonId))return "locked";
    return seasonCompleted(state,c.seasonId)?"available":"locked";
  }
  function draw(source,rng=global.RoadToGloryRng){
    const state=JSON.parse(JSON.stringify(source||{})),pool=eligible(state);
    if(!pool.length)throw error("rtg-coaches-empty","Non ci sono nuovi allenatori disponibili.");
    if(!Number.isSafeInteger(Number(state.tokens))||Number(state.tokens)<COST)throw error("rtg-coaches-tokens","Gettoni RTG insufficienti.");
    const index=rng?.int?.(state.campaignSeed,"rtg-coaches-draw",Number(state.coachPullCount)||0,pool.length);
    if(!Number.isInteger(index)||index<0||index>=pool.length)throw error("rtg-coaches-rng","Estrazione allenatore non valida.");
    const coach=pool[index];
    state.tokens-=COST;
    state.coachOwnedIds=[...(state.coachOwnedIds||[]),coach.id];
    state.coachPullCount=(Number(state.coachPullCount)||0)+1;
    return {state,coach};
  }
  global.RoadToGloryCoaches=Object.freeze({COST,CATALOG,BY_ID,lookup,
    get CAMPAIGN_SEASONS(){return campaignSeasons();},catalog,seasonCompleted,owned,eligible,status,draw});
})(globalThis);
