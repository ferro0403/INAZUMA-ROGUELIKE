(function coachModel(global) {
  "use strict";
  const COST = 900;
  const CATALOG = Object.freeze([
    {id:"36",name:"Ray Dark",seasonId:"ie1",season:"Season 1",team:"Royal Academy",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/e/e3/Teikoku_Gakuen_emblem_%28VR%29.png/revision/latest?cb=20260214134442",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/8/w/8wocttgsuu0.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/l/d/ldnqtojaamc_r0_fullbody.webp"},
    {id:"208",name:"Seymour Hillman",seasonId:"ie1",season:"Season 1",team:"Raimon",teamLogoUrl:"https://i.namu.wiki/i/4ldvWxMwQZ5E4vwoKkQ1_zo7q1XYu_nD3pMg4NQ9AzVTndTqr2l6HMC9r3xzQMf9ZBJDKlySI8ISXdM8lIlqSg.webp",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/v/v/vvrzhm1aiie.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/y/c/yc4lhjcswqs_r0_fullbody.webp"},
    {id:"1225",name:"Nerina Hartland",seasonId:"ie1_s2",season:"Season 2",team:"Super Triple C",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/5/5b/Triple_C.png/revision/latest?cb=20240418082803&path-prefix=de",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/u/g/ugcf748fkgm.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/z/1/z11x79vpq4k_r0_fullbody.webp"},
    {id:"1329",name:"Aquilina Schiller",seasonId:"ie1_s2",season:"Season 2",team:"Raimon",teamLogoUrl:"https://i.namu.wiki/i/4ldvWxMwQZ5E4vwoKkQ1_zo7q1XYu_nD3pMg4NQ9AzVTndTqr2l6HMC9r3xzQMf9ZBJDKlySI8ISXdM8lIlqSg.webp",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/g/-/g-obvenkgrc.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/x/n/xnbtvbk8uz0_r0_fullbody.webp"},
    {id:"1275",name:"Godric Wyles",seasonId:"ie1_s2",season:"Season 2",team:"Dark Emperors",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/3/39/Dark_Emperors_emblem_%28S%29.png/revision/latest/scale-to-width-down/250?cb=20230726183312",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/f/u/futkwhaljtk.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/o/d/ode2wczt9lm_r0_fullbody.webp"},
    {id:"1777",name:"Percival Travis",seasonId:"ie1_s3",season:"Season 3",team:"Inazuma National",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/8/8c/Inazuma_Japan_emblem_%28VR%29.png/revision/latest/scale-to-width-down/200?cb=20251118151807",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/b/w/bwxwy2_pw90.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/2/d/2d-eyzw5elc_r0_fullbody.webp"},
    {id:"1940",name:"Zoolan Rice",seasonId:"ie1_s3",season:"Season 3",team:"The Kingdom",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/c/c3/The_Kingdom_emblem_%28VR%29.png/revision/latest?cb=20251118151832",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/k/7/k7o456ppquc.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/9/i/9inq5_a5e20_r0_fullbody.webp"},
    {id:"1974",name:"David Arrows",seasonId:"ie1_s3",season:"Season 3",team:"Little Gigantes",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/c/c4/Little_Gigant_emblem_%28S%29.png/revision/latest/scale-to-width-down/250?cb=20210830174846",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/k/t/ktv1j7gglc8.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/t/g/tg8nj-jw_au_r0_fullbody.webp"},
    {id:"4401",name:"Mister Yi",seasonId:"ie2",season:"Ares",team:"Raimon",teamLogoUrl:"https://static.wikia.nocookie.net/inazumaelevenwiki-italia/images/3/3e/Raimon_Go_simbolo.png/revision/latest?cb=20130411084426&path-prefix=it",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/v/x/vxsjctiezes.png",frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/y/k/yk7bcwhytce_r0_fullbody.webp"},
    {id:"4761",name:"René Gadé",seasonId:"orion",season:"Orion",team:"Ace Invaders",teamLogoUrl:"https://static.wikia.nocookie.net/inazuma-eleven/images/9/95/Navy_Invader_emblem.png/revision/latest/scale-to-width-down/200?cb=20251118122113",imageUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.webp",imageFallbackUrls:["https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.png"],frontFullbodyUrl:"https://dxi4wb638ujep.cloudfront.net/1/k/3/e/3e1faym7pbe_r0_fullbody.webp"},
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
  function catalog(_state){return CATALOG.slice();} // Always show all ten coaches in either RTG campaign.
  function owned(state){return new Set((Array.isArray(state?.coachOwnedIds)?state.coachOwnedIds:[]).map(String));}
  function eligible(state){const have=owned(state);return catalog(state).filter(c=>seasonCompleted(state,c.seasonId)&&!have.has(c.id));}
  function status(state,coachId){
    const c=BY_ID[String(coachId)];
    if(!c)return "locked";
    // Ownership belongs to the RTG account; only the draw pool depends on campaign.
    if(owned(state).has(c.id))return "owned";
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
  global.RoadToGloryCoaches=Object.freeze({COST,CATALOG,BY_ID,CAMPAIGN_SEASONS,catalog,seasonCompleted,owned,eligible,status,draw});
})(globalThis);
