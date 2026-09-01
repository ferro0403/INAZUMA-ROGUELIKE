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
    return id(isSeasonProfileCandidate(player) ? player?.profileId : player?.playerId);
  }

  function candidateSource(player, seasonId = "ie1_s3") {
    return isSeasonProfileCandidate(player) ? seasonId : "free_agents";
  }

  global.PlayerIdentity = Object.freeze({
    id,
    isSeasonProfileCandidate,
    canonicalPlayerId,
    candidateKey,
    candidateSource,
  });
})(globalThis);
