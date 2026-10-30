"use strict";
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function campaign(campaignId = "rtg-ie-trilogy") {
  const trilogy = campaignId === "rtg-ie-trilogy";
  return { schemaVersion: 3, campaignId, campaignSeed: `seed-${campaignId}`,
    activeSeasonId: trilogy ? "ie1" : "ie2", seasonComplete: false,
    seasonTransitionRewardedIds: [], projects: { Buono: 0, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0, Aurico: 0 },
    coachPullCount: 0, lives: 2, checkpointMainIndex: -1,
    currentNodeId: trilogy ? "main:occult" : "main:rampart_junior_high", furthestNodeIndex: 0,
    defeatedTeamIds: [], firstClearMatchIds: [], attemptsByNode: {},
    gacha: { pullCount: 4, recruitmentPullCount: 9 }, tokens: 900,
    gachaAcquiredCards: [{ cardId: "ie1::hero", playerId: "hero", legacySeasonId: "ie1", sourceKind: "season" }],
    developmentByCardId: {}, coachOwnedIds: ["36"],
    squads: { [trilogy ? "ie1" : "ie2"]: { formationId: "4-4-2", lineup: [], bench: [], activeRoleVariantByCardId: {}, coachId: "36" } }, activeMatch: null };
}
function input() {
  return { trilogy: campaign(), aresOrion: campaign("rtg-ares-orion"),
    shared: { tokens: 900, gachaAcquiredCards: campaign().gachaAcquiredCards, developmentByCardId: {}, coachOwnedIds: ["36"] },
    album: { version: 1, cardIds: ["ie1::hero", "ie1::historic"] } };
}
function account(rtg) {
  return { profile: { teamIdentity: { name: "Test" } }, album: {}, development: {},
    hallOfFame: { archiveSchemaVersion: 1, updatedAt: null, teams: [], index: [] }, ...(rtg ? { rtg: clone(rtg) } : {}) };
}
module.exports = { clone, campaign, input, account };
