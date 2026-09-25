(function (global) {
  "use strict";

  const SEP = "::";
  const FREE_AGENTS = "free_agents";
  const SEASON_ORDER = Object.freeze(["ie1", "ie1_s2", "ie1_s3"]);
  const id = (value) => String(value ?? "").trim();

  function normalizeSeasonId(value) {
    const raw = id(value);
    if (!raw || raw === FREE_AGENTS) return raw;
    return id(global.SeasonRegistry?.normalizeSeasonId?.(raw) || raw);
  }

  function canonicalPlayerId(seasonId, playerId) {
    const sid = normalizeSeasonId(seasonId);
    const pid = id(playerId);
    if (!pid) return "";
    if (!sid || sid === FREE_AGENTS) return pid;
    const explicitProfile = pid.includes("@") ? global.ProfiledSeasonRuntime?.resolveProfile?.(sid,pid) : null;
    if (explicitProfile) return id(explicitProfile.playerId || pid);
    return id(
      global.ProfiledSeasonRuntime?.canonicalPlayerId?.(sid, pid)
      || global.SeasonRegistry?.player?.(pid, sid)?.legacyCanonicalPlayerId
      || pid
    );
  }

  function cardIdForSeason(playerId, seasonId) {
    const sid = normalizeSeasonId(seasonId);
    const pid = canonicalPlayerId(sid, playerId);
    return sid && pid ? `${sid}${SEP}${pid}` : "";
  }

  function cardIdForProfile(profileId, seasonId) {
    const sid = normalizeSeasonId(seasonId);
    const pid = id(profileId);
    return sid && pid ? `${sid}${SEP}${pid}` : "";
  }

  function cardIdForFreeAgent(playerId) {
    const pid = id(playerId);
    return pid ? `${FREE_AGENTS}${SEP}${pid}` : "";
  }

  function isCardId(value) {
    const raw = id(value);
    const split = raw.indexOf(SEP);
    return split > 0 && split < raw.length - SEP.length;
  }

  function parse(value, fallbackSeasonId = null) {
    if (value && typeof value === "object") {
      const explicit = id(value.cardId);
      if (explicit) return parse(explicit, fallbackSeasonId);
      const playerId = id(value.playerId || value.id);
      const source = normalizeSeasonId(value.legacySeasonId || value.cardSeasonId || value.sourceKind || value.source || fallbackSeasonId);
      if (source === FREE_AGENTS) {
        return Object.freeze({ cardId: cardIdForFreeAgent(playerId), playerId, legacySeasonId: FREE_AGENTS, sourceKind: FREE_AGENTS });
      }
      if (source && playerId) {
        const profile = playerId.includes("@") ? global.ProfiledSeasonRuntime?.resolveProfile?.(source, playerId) : null;
        const canonical = canonicalPlayerId(source, playerId);
        const exactPlayerId = profile?.profileId || playerId;
        return Object.freeze({
          cardId: profile ? cardIdForProfile(exactPlayerId, source) : cardIdForSeason(canonical, source),
          playerId: profile ? exactPlayerId : canonical,
          profileId: profile?.profileId || null,
          canonicalPlayerId: profile?.playerId || canonical,
          legacySeasonId: source,
          sourceKind: "season"
        });
      }
      return Object.freeze({ cardId: playerId, playerId, legacySeasonId: null, sourceKind: "legacy" });
    }

    const raw = id(value);
    if (!raw) return Object.freeze({ cardId: "", playerId: "", legacySeasonId: null, sourceKind: "legacy" });
    if (isCardId(raw)) {
      const split = raw.indexOf(SEP);
      const source = normalizeSeasonId(raw.slice(0, split));
      const rawPlayerId = id(raw.slice(split + SEP.length));
      if (source === FREE_AGENTS) {
        return Object.freeze({ cardId: cardIdForFreeAgent(rawPlayerId), playerId: rawPlayerId, legacySeasonId: FREE_AGENTS, sourceKind: FREE_AGENTS });
      }
      const profile = rawPlayerId.includes("@") ? global.ProfiledSeasonRuntime?.resolveProfile?.(source, rawPlayerId) : null;
      const canonical = canonicalPlayerId(source, rawPlayerId);
      const exactPlayerId = profile?.profileId || rawPlayerId;
      return Object.freeze({
        cardId: profile ? cardIdForProfile(exactPlayerId, source) : cardIdForSeason(canonical, source),
        playerId: profile ? exactPlayerId : canonical,
        profileId: profile?.profileId || (rawPlayerId.includes("@") ? rawPlayerId : null),
        canonicalPlayerId: profile?.playerId || canonical,
        legacySeasonId: source,
        sourceKind: "season"
      });
    }

    const fallback = normalizeSeasonId(fallbackSeasonId);
    if (fallback === FREE_AGENTS) {
      return Object.freeze({ cardId: cardIdForFreeAgent(raw), playerId: raw, legacySeasonId: FREE_AGENTS, sourceKind: FREE_AGENTS });
    }
    if (fallback) {
      const canonical = canonicalPlayerId(fallback, raw);
      return Object.freeze({ cardId: cardIdForSeason(canonical, fallback), playerId: canonical, legacySeasonId: fallback, sourceKind: "season" });
    }
    return Object.freeze({ cardId: raw, playerId: raw, legacySeasonId: null, sourceKind: "legacy" });
  }

  function versionGroupKey(value, fallbackSeasonId = null) {
    const parsed = parse(value, fallbackSeasonId);
    if (parsed.sourceKind === "season") {
      const canonical = id(parsed.canonicalPlayerId || canonicalPlayerId(parsed.legacySeasonId, parsed.profileId || parsed.playerId) || parsed.playerId);
      return canonical ? `season${SEP}${canonical}` : `card${SEP}${parsed.cardId}`;
    }
    return `card${SEP}${parsed.cardId || parsed.playerId || id(value)}`;
  }
  function record(value, fallbackSeasonId = null) {
    const parsed = parse(value, fallbackSeasonId);
    return Object.freeze({
      cardId: parsed.cardId,
      playerId: parsed.playerId,
      profileId: parsed.profileId || undefined,
      canonicalPlayerId: parsed.canonicalPlayerId || parsed.playerId,
      legacySeasonId: parsed.legacySeasonId,
      sourceKind: parsed.sourceKind,
    });
  }

  function legacyLabel(value) {
    const seasonId = typeof value === "object" ? parse(value).legacySeasonId : normalizeSeasonId(value);
    return ({
      ie1: "S1",
      ie1_s2: "S2",
      ie1_s3: "S3",
      [FREE_AGENTS]: "FA",
    })[seasonId] || (seasonId ? seasonId.toUpperCase() : "");
  }

  global.RoadToGloryCardIdentity = Object.freeze({
    SEP,
    FREE_AGENTS,
    SEASON_ORDER,
    id,
    normalizeSeasonId,
    canonicalPlayerId,
    cardIdForSeason,
    cardIdForProfile,
    cardIdForFreeAgent,
    isCardId,
    parse,
    versionGroupKey,
    record,
    legacyLabel,
  });
})(globalThis);
