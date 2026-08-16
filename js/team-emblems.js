(function (global) {
  "use strict";

  const ASSET_ROOT = "assets/emblems/";
  const DEFINITIONS = Object.freeze({
    "default-lightning": Object.freeze({ id: "default-lightning", type: "local", src: `${ASSET_ROOT}default-lightning.svg` }),
    "free-agents": Object.freeze({ id: "free-agents", type: "local", src: `${ASSET_ROOT}free-agents.svg?v=20260811-no-yellow-accent-1` }),
    "neutral-team": Object.freeze({ id: "neutral-team", type: "fallback", src: `${ASSET_ROOT}neutral-team.svg` }),
  });

  function getDefinition(emblemId) { return DEFINITIONS[String(emblemId || "")] || null; }
  function getFallback(kind = "neutral") {
    return getDefinition(kind === "user" ? "default-lightning" : kind === "free-agents" ? "free-agents" : "neutral-team");
  }
  function parseTeamEmblemId(emblemId) {
    const match = /^team:([^:]+):(.+)$/.exec(String(emblemId || ""));
    return match ? { seasonId: match[1], teamId: match[2] } : null;
  }
  function resolveTeamById(teamId, seasonId, options = {}) {
    const team = options.team || global.SeasonRegistry?.team?.(teamId, seasonId) || null;
    const fallback = getFallback(options.fallbackKind);
    if (team?.logoUrl) return { src: team.logoUrl, type: "remote-team", emblemId: `team:${seasonId}:${teamId}`, teamId: String(teamId), seasonId: String(seasonId), fallbackSrc: fallback.src, isFallback: false };
    return { ...fallback, emblemId: `team:${seasonId}:${teamId}`, teamId: String(teamId), seasonId: String(seasonId), fallbackSrc: fallback.src, isFallback: true };
  }
  function resolveTeamEmblem(options = {}) {
    if (options.specialType === "free-agents") {
      const emblem = getDefinition("free-agents");
      return { ...emblem, fallbackSrc: emblem.src, isFallback: false };
    }
    const identityId = options.teamIdentity?.emblemId;
    const encodedTeam = parseTeamEmblemId(identityId);
    const teamId = options.teamId || encodedTeam?.teamId;
    // If the selected emblem encodes its source season (team:<seasonId>:<teamId>),
    // that source season must win over the current run season. Otherwise a crest
    // bought in IE1 and used in IE2/IE3/Ares is looked up in the wrong database
    // and falls back to the default lightning emblem.
    const seasonId = encodedTeam?.seasonId || options.seasonId || global.SeasonRegistry?.activeId?.() || "ie1";
    if (teamId) return resolveTeamById(teamId, seasonId, { team: options.team, fallbackKind: options.fallbackKind });
    const definition = getDefinition(identityId);
    if (definition) {
      const fallback = getFallback(options.fallbackKind || (identityId === "free-agents" ? "free-agents" : "user"));
      return { ...definition, fallbackSrc: fallback.src, isFallback: false };
    }
    const fallback = getFallback(options.fallbackKind);
    return { ...fallback, fallbackSrc: fallback.src, isFallback: true };
  }
  function teamEmblemMarkup(resolved, options = {}) {
    const escape = options.escape || ((value) => String(value ?? ""));
    const className = options.className || "team-emblem";
    return `<img class="${escape(className)}" src="${escape(resolved.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-emblem-fallback="${escape(resolved.fallbackSrc || getFallback().src)}" onerror="globalThis.TeamEmblems.handleImageError(this)" />`;
  }
  function handleImageError(image) {
    if (!image || image.dataset.emblemFallbackApplied === "true") return;
    image.dataset.emblemFallbackApplied = "true";
    image.src = image.dataset.emblemFallback || getFallback().src;
  }

  global.TeamEmblems = { DEFINITIONS, getDefinition, getFallback, parseTeamEmblemId, resolveTeamById, resolveTeamEmblem, teamEmblemMarkup, handleImageError };
})(globalThis);
