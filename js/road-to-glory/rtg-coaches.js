(function coachModel(global) {
  "use strict";
  const COST = 900;
  const CATALOG = Object.freeze([
    {id:"36",name:"Ray Dark",seasonId:"ie1",season:"Season 1",team:"Royal Academy",portrait:"https://dxi4wb638ujep.cloudfront.net/1/k/j/m/jme8fhk0ewk_r0.webp"},
    {id:"208",name:"Seymour Hillman",seasonId:"ie1",season:"Season 1",team:"Raimon",portrait:"https://dxi4wb638ujep.cloudfront.net/1/k/o/i/oiykbb0f6qu_r0.webp"},
    {id:"1225",name:"Nerina Hartland",seasonId:"ie1_s2",season:"Season 2",team:"Super Triple C",portrait:""},
    {id:"1329",name:"Aquilina Schiller",seasonId:"ie1_s2",season:"Season 2",team:"Raimon",portrait:"https://ami.animecharactersdatabase.com/uploads/chars/29848-2116535746.jpg"},
    {id:"1275",name:"Godric Wyles",seasonId:"ie1_s2",season:"Season 2",team:"Dark Emperors",portrait:""},
    {id:"1777",name:"Percival Travis",seasonId:"ie1_s3",season:"Season 3",team:"Inazuma National",portrait:""},
    {id:"1940",name:"Zoolan Rice",seasonId:"ie1_s3",season:"Season 3",team:"The Kingdom",portrait:"https://inazuma-eleven-legends.vercel.app/images/characters/char_zoolan-rice.png"},
    {id:"1974",name:"David Arrows",seasonId:"ie1_s3",season:"Season 3",team:"Little Gigantes",portrait:""},
    {id:"4401",name:"Mister Yi",seasonId:"ie2",season:"Ares",team:"Raimon",portrait:"https://ami.animecharactersdatabase.com/uploads/chars/38910-1301320284.png"},
    {id:"4761",name:"René Gadé",seasonId:"orion",season:"Orion",team:"Ace Invaders",portrait:""}
  ].map(c=>Object.freeze(c)));
  const BY_ID = Object.freeze(Object.fromEntries(CATALOG.map(c=>[c.id,c])));
  const CAMPAIGN_SEASONS = Object.freeze({"rtg-ie-trilogy":["ie1","ie1_s2","ie1_s3"],"rtg-ares-orion":["ie2","orion"]});
  const error=(code,message)=>Object.assign(new Error(message),{code});
  const order=(state)=>CAMPAIGN_SEASONS[state?.campaignId]||[];
  function seasonCompleted(state,seasonId){
    const seasons=order(state),required=seasons.indexOf(seasonId),current=seasons.indexOf(String(state?.activeSeasonId||""));
    if(required<0||current<0)return false;
    if(current>required)return true;
    if(current===required&&state?.seasonComplete===true)return true;
    return (state?.seasonTransitionRewardedIds||[]).some(entry=>String(entry).startsWith(seasonId+"->"));
  }
  function catalog(state){return CATALOG.filter(c=>order(state).includes(c.seasonId));}
  function owned(state){return new Set((Array.isArray(state?.coachOwnedIds)?state.coachOwnedIds:[]).map(String));}
  function eligible(state){const have=owned(state);return catalog(state).filter(c=>seasonCompleted(state,c.seasonId)&&!have.has(c.id));}
  function status(state,coachId){
    const c=BY_ID[String(coachId)];
    if(!c||!order(state).includes(c.seasonId))return "other-campaign";
    if(owned(state).has(c.id))return "owned";
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
  global.RoadToGloryCoaches=Object.freeze({COST,CATALOG,BY_ID,CAMPAIGN_SEASONS,catalog,seasonCompleted,owned,eligible,status,draw});
})(globalThis);
