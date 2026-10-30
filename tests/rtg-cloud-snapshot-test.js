"use strict";
const assert = require("assert");
const snapshot = require("../js/road-to-glory/rtg-cloud-snapshot.js");
const policy = require("../js/cloud-write-failure-policy.js");

function campaign(campaignId, seasonId) {
  return {
    schemaVersion: 3, campaignId, campaignSeed: campaignId + "-seed",
    activeSeasonId: seasonId, seasonComplete: false,
    seasonTransitionRewardedIds: ["season-win-1"], projects: { Buono: 2, Elite: 1 },
    coachPullCount: 7, lives: 2, checkpointMainIndex: 3,
    currentNodeId: "main:occult", furthestNodeIndex: 5,
    defeatedTeamIds: ["team-a"], firstClearMatchIds: ["match-1"],
    attemptsByNode: { "main:occult": 2 }, gacha: { pullCount: 4, uiTab: "temporary" },
    tokens: 25, gachaAcquiredCards: [{ cardId: "legacy-copy" }],
    developmentByCardId: { "legacy-copy": { targetPotential: 50 } },
    coachOwnedIds: ["coach-one"],
    squads: { [seasonId]: { formationId: "4-4-2", lineup: ["a"], bench: ["b"], coachId: "coach-one", coachPowerSelection: { cardIds: ["c"] } } },
    activeMatch: null,
  };
}
function fixture() {
  return {
    trilogy: campaign("rtg-ie-trilogy", "ie1_s3"),
    aresOrion: campaign("rtg-ares-orion", "orion"),
    shared: { tokens: 900, gachaAcquiredCards: [{ cardId: "ie1::player-a", playerId: "player-a" }], developmentByCardId: { "ie1::player-a": { targetPotential: 70, currentRarity: "Forte", evolutionCount: 2 } }, coachOwnedIds: ["coach-two"] },
    album: { version: 1, cardIds: ["ie1::player-a", "old-album-only"] },
  };
}
function rejects(code, call) { assert.throws(call, (error) => error.code === code, code); }

(function run() {
  const original = fixture(), unmodified = JSON.stringify(original);
  const projected = snapshot.project(original);
  assert.strictEqual(snapshot.SNAPSHOT_VERSION, 1);
  assert.strictEqual(projected.schemaVersion, 1);
  assert.deepStrictEqual(Object.keys(projected.campaigns), ["rtg-ie-trilogy", "rtg-ares-orion"]);
  assert.strictEqual(projected.campaigns["rtg-ie-trilogy"].activeSeasonId, "ie1_s3");
  assert.strictEqual(projected.campaigns["rtg-ares-orion"].activeSeasonId, "orion");
  assert.deepStrictEqual(projected.campaigns["rtg-ie-trilogy"].gacha, { pullCount: 4 });
  assert.deepStrictEqual(projected.campaigns["rtg-ie-trilogy"].projects, { Buono: 2, Elite: 1 });
  assert.strictEqual(projected.campaigns["rtg-ie-trilogy"].coachPullCount, 7);
  assert.deepStrictEqual(projected.campaigns["rtg-ie-trilogy"].seasonTransitionRewardedIds, ["season-win-1"]);
  assert.deepStrictEqual(projected.shared.coachOwnedIds, ["coach-two", "coach-one"]);
  assert.strictEqual(projected.shared.tokens, 900);
  assert.strictEqual(projected.shared.developmentByCardId["ie1::player-a"].evolutionCount, 2);
  assert.deepStrictEqual(projected.album.cardIds, ["ie1::player-a", "old-album-only"]);
  for (const value of Object.values(projected.campaigns)) {
    for (const localField of ["squads", "activeMatch", "tokens", "gachaAcquiredCards", "developmentByCardId", "coachOwnedIds"]) {
      assert.ok(!(localField in value), "No local/shared field " + localField + " in campaign");
    }
  }
  assert.strictEqual(JSON.stringify(original), unmodified, "project must never mutate the source");
  assert.deepStrictEqual(snapshot.validate(projected), projected, "roundtrip cloud payload");
  // rtg-progression.recordSecondaryResult() persists structured attempts,
  // not numeric counters. This real gameplay shape must roundtrip intact.
  const secondary = fixture();
  secondary.trilogy.attemptsByNode["secondary:training"] = {
    lastAttempt: 3, lastResult: "victory", clears: 2,
  };
  const secondaryBefore = JSON.stringify(secondary);
  const secondaryProjected = snapshot.project(secondary);
  assert.deepStrictEqual(secondaryProjected.campaigns["rtg-ie-trilogy"].attemptsByNode["secondary:training"],
    { lastAttempt: 3, lastResult: "victory", clears: 2 });
  assert.deepStrictEqual(snapshot.validate(secondaryProjected), secondaryProjected);
  assert.strictEqual(JSON.stringify(secondary), secondaryBefore, "secondary result projection stays read-only");
  // rtg-controller.startMatch() records {lastAttempt} in BOTH main and
  // secondary nodes. Main nodes never acquire the secondary-only fields;
  // unfinished secondary nodes have them added only at result resolution.
  const started = fixture();
  started.trilogy.attemptsByNode["main:occult"] = { lastAttempt: 4 };
  started.trilogy.attemptsByNode["secondary:occult:wild:1"] = { lastAttempt: 1 };
  const startedCopy = JSON.stringify(started);
  const startedProjected = snapshot.project(started);
  assert.deepStrictEqual(startedProjected.campaigns["rtg-ie-trilogy"].attemptsByNode["main:occult"],
    { lastAttempt: 4 });
  assert.deepStrictEqual(startedProjected.campaigns["rtg-ie-trilogy"].attemptsByNode["secondary:occult:wild:1"],
    { lastAttempt: 1 });
  assert.deepStrictEqual(snapshot.validate(startedProjected), startedProjected);
  assert.strictEqual(JSON.stringify(started), startedCopy, "unfinished/main history is read-only");

  // Historic numeric attempts stay supported. Optional gameplay fields may
  // be absent but present values must be valid; never coerce broken counters.
  for (const invalidAttempt of [
    { lastAttempt: 3, lastResult: "victory", clears: "2" },
    { lastAttempt: -1, lastResult: "victory", clears: 2 },
    { lastAttempt: 3.25 },
    { lastAttempt: 3, lastResult: 7 },
    { lastAttempt: null },
    { lastResult: "victory", clears: 1 },
  ]) {
    const invalidSecondary = fixture();
    invalidSecondary.trilogy.attemptsByNode["secondary:training"] = invalidAttempt;
    rejects("rtg-cloud-invalid-campaign", () => snapshot.project(invalidSecondary));
  }

  const recruitment = fixture();
  recruitment.trilogy.gacha.recruitmentPullCount = 17;
  const recruitmentSnapshot = snapshot.project(recruitment);
  assert.deepStrictEqual(recruitmentSnapshot.campaigns["rtg-ie-trilogy"].gacha,
    { pullCount: 4, recruitmentPullCount: 17 });
  assert.deepStrictEqual(snapshot.validate(recruitmentSnapshot), recruitmentSnapshot);
  const reordered = { album: { cardIds: [...projected.album.cardIds], version: 1 }, shared: projected.shared, campaigns: projected.campaigns, schemaVersion: 1 };
  assert.deepStrictEqual(snapshot.validate(reordered), projected, "Firestore map property ordering must not matter");

  const active = fixture(); active.trilogy.activeMatch = { status: "active", score: { user: 0, opponent: 0 } };
  rejects("rtg-cloud-match-in-progress", () => snapshot.project(active));
  const anotherActive = fixture(); anotherActive.aresOrion.activeMatch = { status: "finished" };
  rejects("rtg-cloud-match-in-progress", () => snapshot.project(anotherActive));
  assert.strictEqual(JSON.stringify(active.trilogy.activeMatch), '{"status":"active","score":{"user":0,"opponent":0}}');

  const missingShared = fixture(); missingShared.shared = null;
  rejects("rtg-cloud-shared-missing", () => snapshot.project(missingShared));
  const invalidCards = fixture(); invalidCards.shared.gachaAcquiredCards.push({ cardId: "ie1::player-a" });
  rejects("rtg-cloud-invalid-card-collection", () => snapshot.project(invalidCards));
  const invalidId = fixture(); invalidId.trilogy.campaignId = "rtg-ares-orion";
  rejects("rtg-cloud-invalid-campaign", () => snapshot.project(invalidId));
  const invalidSeason = fixture(); invalidSeason.trilogy.activeSeasonId = "orion";
  rejects("rtg-cloud-invalid-campaign", () => snapshot.project(invalidSeason));
  assert.throws(() => snapshot.project(invalidSeason), error =>
    error.code === "rtg-cloud-invalid-campaign" &&
    error.detail === "rtg-ie-trilogy:activeSeasonId");
  const invalidAttempts = fixture();
  invalidAttempts.trilogy.attemptsByNode["secondary:training"] = { lastAttempt: 3, lastResult: "victory", clears: -1 };
  assert.throws(() => snapshot.project(invalidAttempts), error =>
    error.code === "rtg-cloud-invalid-campaign" &&
    error.detail === "rtg-ie-trilogy:attemptsByNode");
  const diagnosed = policy.classifyCloudWriteFailure({ code: "rtg-cloud-invalid-campaign",
    problemSector: "rtg", detail: "rtg-ie-trilogy:attemptsByNode" });
  assert.strictEqual(diagnosed.errorDetail, "rtg-ie-trilogy:attemptsByNode");
  assert.strictEqual(policy.classifyCloudWriteFailure({ code: "permission-denied",
    problemSector: "rtg", detail: "rtg-ie-trilogy:private<value>" }).errorDetail, null);

  const invalidAlbum = fixture(); invalidAlbum.album.cardIds.push("old-album-only");
  rejects("rtg-cloud-invalid-ids", () => snapshot.project(invalidAlbum));
  const invalidCount = fixture(); invalidCount.aresOrion.coachPullCount = -1;
  rejects("rtg-cloud-invalid-campaign", () => snapshot.project(invalidCount));
  const invalidShared = fixture(); invalidShared.shared.tokens = NaN;
  rejects("rtg-cloud-invalid-shared", () => snapshot.project(invalidShared));
  const invalidSchema = fixture(); invalidSchema.trilogy.schemaVersion = 4;
  rejects("rtg-cloud-invalid-campaign", () => snapshot.project(invalidSchema));

  const cloudWithSquad = snapshot.project(fixture());
  cloudWithSquad.campaigns["rtg-ie-trilogy"].squads = { ie1: { coachId: "coach-one" } };
  rejects("rtg-cloud-noncanonical-snapshot", () => snapshot.validate(cloudWithSquad));
  const cloudWithActiveMatch = snapshot.project(fixture());
  cloudWithActiveMatch.campaigns["rtg-ie-trilogy"].activeMatch = { status: "active" };
  rejects("rtg-cloud-match-in-progress", () => snapshot.validate(cloudWithActiveMatch));
  const future = snapshot.project(fixture()); future.schemaVersion = 2;
  rejects("rtg-cloud-unsupported-snapshot", () => snapshot.validate(future));

  const empty = snapshot.project({ trilogy: null, aresOrion: null, shared: null, album: null });
  assert.strictEqual(empty.shared, null);
  assert.strictEqual(empty.campaigns["rtg-ie-trilogy"], null);
  assert.deepStrictEqual(snapshot.validate(empty), empty);
  const legacy = fixture(); legacy.trilogy.schemaVersion = 1;
  assert.strictEqual(snapshot.project(legacy).campaigns["rtg-ie-trilogy"].schemaVersion, 1);

  const circular = fixture(); circular.trilogy.projects.self = circular.trilogy.projects;
  rejects("rtg-cloud-invalid-projects", () => snapshot.project(circular));
  console.log("PASS rtg-cloud-snapshot-test: safe projection, both campaigns, ownership, exclusion, validation and failure cases");
})();
