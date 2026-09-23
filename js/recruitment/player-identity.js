(function (global) {
  "use strict";

  const id = (value) => String(value ?? "");

  function isSeasonProfileCandidate(player) {
    return /_recruitment_profile$/.test(String(player?.sourceKind || ""))
      || player?.pullCandidateKind === "season_profile"
      || (player?.pullCandidateKind !== "free_agent" && Boolean(player?.profileId));
  }

  function canonicalPlayerId(player) {
    return id(player?.playerId);
  }

  function candidateKey(player) {
    if (!player) return "";
    if (isSeasonProfileCandidate(player)) {
      const profileId = id(player?.profileId);
      if (profileId) return profileId;
    }
    return canonicalPlayerId(player);
  }

  function candidateSource(player, seasonId = "ie1_s3") {
    return isSeasonProfileCandidate(player) ? seasonId : "free_agents";
  }

  function normalizeSeasonId(value) {
    const raw = id(value).trim();
    if (!raw) return "";
    return id(global.SeasonRegistry?.normalizeSeasonId?.(raw) || raw).trim();
  }

  function legacySeasonId(player, fallbackSeasonId = null) {
    const explicit = id(
      player?.legacySeasonId
      || player?.legacySeason
      || player?.cardSeasonId
    ).trim();
    if (explicit) return normalizeSeasonId(explicit);

    const source = id(player?.source).trim();
    if (source && global.SeasonRegistry?.isSeasonSource?.(source)) {
      return normalizeSeasonId(source);
    }

    return normalizeSeasonId(fallbackSeasonId);
  }

  function canonicalPlayerIdForCard(player, fallbackSeasonId = null) {
    const rawPlayerId = canonicalPlayerId(player);
    if (!rawPlayerId) return "";
    const seasonId = legacySeasonId(player, fallbackSeasonId);
    if (!seasonId) return rawPlayerId;

    return id(
      global.ProfiledSeasonRuntime?.canonicalPlayerId?.(seasonId, rawPlayerId)
      || global.SeasonRegistry?.player?.(rawPlayerId, seasonId)?.legacyCanonicalPlayerId
      || rawPlayerId
    );
  }

  function cardId(player, fallbackSeasonId = null) {
    const explicit = id(player?.cardId).trim();
    if (explicit) return explicit;

    const playerId = canonicalPlayerIdForCard(player, fallbackSeasonId);
    if (!playerId) return "";

    const seasonId = legacySeasonId(player, fallbackSeasonId);
    return seasonId ? `${seasonId}::${playerId}` : playerId;
  }

  function cardIdentity(player, fallbackSeasonId = null) {
    return Object.freeze({
      cardId: cardId(player, fallbackSeasonId),
      playerId: canonicalPlayerId(player),
      legacySeasonId: legacySeasonId(player, fallbackSeasonId) || null,
    });
  }

  function withCardIdentity(player, fallbackSeasonId = null) {
    if (!player || typeof player !== "object") return player;
    const identity = cardIdentity(player, fallbackSeasonId);
    return {
      ...player,
      cardId: identity.cardId,
      legacySeasonId: identity.legacySeasonId,
    };
  }

  function sameCard(left, right, leftFallbackSeasonId = null, rightFallbackSeasonId = leftFallbackSeasonId) {
    const leftCardId = cardId(left, leftFallbackSeasonId);
    const rightCardId = cardId(right, rightFallbackSeasonId);
    return Boolean(leftCardId && rightCardId && leftCardId === rightCardId);
  }

  global.PlayerIdentity = Object.freeze({
    id,
    isSeasonProfileCandidate,
    canonicalPlayerId,
    candidateKey,
    candidateSource,
    normalizeSeasonId,
    legacySeasonId,
    canonicalPlayerIdForCard,
    cardId,
    cardIdentity,
    withCardIdentity,
    sameCard,
  });
})(globalThis);
