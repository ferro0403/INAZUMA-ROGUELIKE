(function (global) {
  "use strict";

  const ASSET_ROOT = "assets/emblems/";
  const DEFINITIONS = Object.freeze({
    "default-lightning": Object.freeze({ id: "default-lightning", type: "local", src: `${ASSET_ROOT}default-lightning.svg` }),
    "free-agents": Object.freeze({ id: "free-agents", type: "local", src: `${ASSET_ROOT}free-agents.svg?v=20260811-no-yellow-accent-1` }),
    "neutral-team": Object.freeze({ id: "neutral-team", type: "fallback", src: `${ASSET_ROOT}neutral-team.svg` }),
  });

  function getDefinition(emblemId) { return DEFINITIONS[String(emblemId || "")] || null; }
  function getFallback(kind = "neutral") { return getDefinition(kind === "user" ? "default-lightning" : kind === "free-agents" ? "free-agents" : "neutral-team"); }
  function parseTeamEmblemId(emblemId) { const match = /^team:([^:]+):(.+)$/.exec(String(emblemId || "")); return match ? { seasonId: match[1], teamId: match[2] } : null; }
  function resolveTeamById(teamId, seasonId, options = {}) {
    const team = options.team || global.SeasonRegistry?.team?.(teamId, seasonId) || null;
    const fallback = getFallback(options.fallbackKind);
    if (team?.logoUrl) return { src: team.logoUrl, type:"remote-team", emblemId:`team:${seasonId}:${teamId}`, teamId:String(teamId), seasonId:String(seasonId), fallbackSrc:fallback.src, isFallback:false };
    return { ...fallback, emblemId:`team:${seasonId}:${teamId}`, teamId:String(teamId), seasonId:String(seasonId), fallbackSrc:fallback.src, isFallback:true };
  }
  function resolveTeamEmblem(options = {}) {
    if (options.specialType === "free-agents") { const emblem=getDefinition("free-agents"); return { ...emblem, fallbackSrc:emblem.src, isFallback:false }; }
    const identityId=options.teamIdentity?.emblemId;
    const encodedTeam=parseTeamEmblemId(identityId);
    const teamId=options.teamId || encodedTeam?.teamId;
    const seasonId=encodedTeam?.seasonId || options.seasonId || global.SeasonRegistry?.activeId?.() || "ie1";
    if (teamId) return resolveTeamById(teamId,seasonId,{ team:options.team,fallbackKind:options.fallbackKind });
    const definition=getDefinition(identityId);
    if (definition) { const fallback=getFallback(options.fallbackKind || (identityId === "free-agents" ? "free-agents" : "user")); return { ...definition,fallbackSrc:fallback.src,isFallback:false }; }
    const fallback=getFallback(options.fallbackKind); return { ...fallback,fallbackSrc:fallback.src,isFallback:true };
  }
  function teamEmblemMarkup(resolved, options = {}) {
    const escape=options.escape || ((value)=>String(value ?? "")); const className=options.className || "team-emblem";
    return `<img class="${escape(className)}" src="${escape(resolved.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-emblem-fallback="${escape(resolved.fallbackSrc || getFallback().src)}" onerror="globalThis.TeamEmblems.handleImageError(this)" />`;
  }
  function handleImageError(image) { if (!image || image.dataset.emblemFallbackApplied === "true") return; image.dataset.emblemFallbackApplied="true"; image.src=image.dataset.emblemFallback || getFallback().src; }

  function syncPenaltyHistoryEmblems(root = document) {
    const history=root.querySelector?.(".rtg-penalty-history"); if (!history) return;
    const rows=history.querySelectorAll(":scope > div"); if (rows.length < 2) return;
    const sources=[document.querySelector(".rtg-score-team--user .rtg-score-emblem, .rtg-score-team--user img"),document.querySelector(".rtg-score-team--opponent .rtg-score-emblem, .rtg-score-team--opponent img")];
    rows.forEach((row,index)=>{
      const label=row.querySelector("b"), source=sources[index]; if (!label || !source?.src) return;
      let image=label.querySelector(".rtg-penalty-team-emblem");
      if (!image) { label.textContent=""; image=document.createElement("img"); image.className="rtg-penalty-team-emblem"; image.alt=""; image.setAttribute("aria-hidden","true"); label.appendChild(image); }
      Object.assign(label.style,{width:"54px",height:"38px",display:"grid",placeItems:"center",padding:"0",overflow:"visible"});
      Object.assign(image.style,{width:"38px",height:"38px",maxWidth:"38px",maxHeight:"38px",objectFit:"contain",display:"block"});
      image.src=source.src; image.dataset.emblemFallback=source.dataset?.emblemFallback || getFallback(index === 0 ? "user" : "neutral").src; image.onerror=()=>handleImageError(image);
    });
  }

  function installPenaltyHistoryEmblems() {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const sync=()=>syncPenaltyHistoryEmblems(document);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",sync,{once:true}); else sync();
    const observer=new MutationObserver((mutations)=>{ if (mutations.some((mutation)=>Array.from(mutation.addedNodes || []).some((node)=>node?.nodeType === 1 && (node.matches?.(".rtg-penalty-panel") || node.querySelector?.(".rtg-penalty-panel"))))) sync(); });
    const start=()=>document.body && observer.observe(document.body,{childList:true,subtree:true});
    if (document.body) start(); else document.addEventListener("DOMContentLoaded",start,{once:true});
  }

  global.TeamEmblems={ DEFINITIONS,getDefinition,getFallback,parseTeamEmblemId,resolveTeamById,resolveTeamEmblem,teamEmblemMarkup,handleImageError,syncPenaltyHistoryEmblems };
  installPenaltyHistoryEmblems();
})(globalThis);
