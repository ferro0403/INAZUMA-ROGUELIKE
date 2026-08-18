"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const profiles = [
  ...Array.from({ length: 9 }, (_, index) => ({
    playerId: String(index + 1),
    profileId: `${index + 1}@secondary`,
  })),
  { playerId: "1", profileId: "1@secondary-upgrade" },
];
const special = {
  specialMatchId: "secondary_ie3",
  teamId: "secondary_team",
  reward: { candidateCount: 3, teamPullPoolProfileIds: profiles.map((profile) => profile.profileId) },
};
const database = { seasonId: "ie1_s3", specialMatches: [special] };
const sandbox = { globalThis: {} };
sandbox.globalThis.SeasonRegistry = { database: () => database };
sandbox.globalThis.ProfiledSeasonRuntime = {
  resolveProfile: (_seasonId, profileId) => profiles.find((profile) => profile.profileId === profileId) || null,
  compareProfileProgression: (_seasonId, currentProfileId, candidateProfileId) => currentProfileId === candidateProfileId ? 0 : 1,
  addLevelUnits: () => {},
};
sandbox.globalThis.DraftEngine = {
  randomFromSeed: (seed) => () => seed.endsWith(":2") ? 0.75 : 0.25,
  shuffle: (values, random) => [...values].sort(() => random() - 0.5),
};
vm.runInNewContext(fs.readFileSync(path.join(root, "js", "special-match.js"), "utf8"), sandbox);
const runtime = sandbox.globalThis.SpecialMatchRuntime;

function makeRun() {
  return {
    seasonId: "ie1_s3",
    runId: "double-reward-run",
    roster: [],
    bench: [],
    completedSpecialMatchIds: [],
    claimedSpecialMatchRewardIds: [],
    unlockedSpecialTeamIds: [],
    unlockedTeamIds: [],
  };
}

const directExclusionRun = makeRun();
const directExclusion = runtime.rewardProfileIds(
  directExclusionRun,
  special,
  sandbox.globalThis.ProfiledSeasonRuntime,
  2,
  ["1@secondary"],
  ["1"]
);
assert(!directExclusion.includes("1@secondary-upgrade"), "player-level exclusion blocks alternate profiles of an already excluded player");

const run = makeRun();
const completion = runtime.complete(run, database, { specialMatchId: special.specialMatchId, nodeId: "node" }, "victory");
assert.strictEqual(completion.pendingReward.totalRewards, 2, "IE3 secondary victories grant exactly two pulls");
assert.strictEqual(completion.pendingReward.currentReward, 1);
assert.strictEqual(completion.pendingReward.candidateProfileIds.length, 3, "each pull keeps three candidates");
const firstCandidates = [...completion.pendingReward.candidateProfileIds];
const firstCandidatePlayerIds = firstCandidates.map((profileId) => runtime.playerIdForProfile(run, profileId));

const refreshedFirst = JSON.parse(JSON.stringify(run));
assert.deepStrictEqual(refreshedFirst.pendingSpecialMatchReward.candidateProfileIds, firstCandidates, "refresh keeps Pull 1 candidates");
const firstDecline = runtime.decline(run);
assert.strictEqual(firstDecline.status, "next-reward", "declining Pull 1 advances to Pull 2");
assert.strictEqual(run.pendingSpecialMatchReward.currentReward, 2);
assert.strictEqual(run.pendingSpecialMatchReward.candidateProfileIds.length, 3);
assert(run.pendingSpecialMatchReward.candidateProfileIds.every((id) => !firstCandidates.includes(id)), "Pull 2 excludes every profile shown in Pull 1");
const secondCandidatePlayerIds = run.pendingSpecialMatchReward.candidateProfileIds.map((profileId) => runtime.playerIdForProfile(run, profileId));
assert(secondCandidatePlayerIds.every((playerId) => !firstCandidatePlayerIds.includes(playerId)), "Pull 2 excludes every player shown in Pull 1, including alternate profiles");
assert.deepStrictEqual([...run.pendingSpecialMatchReward.excludedPlayerIds].sort(), [...new Set(firstCandidatePlayerIds)].sort(), "player exclusions are persisted explicitly");
assert.strictEqual(run.pendingSpecialMatchReward.actionId, `${run.runId}:${special.specialMatchId}:reward:2`, "Pull 2 receives its own action id");

const pullTwoSnapshot = JSON.parse(JSON.stringify(run.pendingSpecialMatchReward));
const refreshedSecond = JSON.parse(JSON.stringify(run));
assert.deepStrictEqual(refreshedSecond.pendingSpecialMatchReward, pullTwoSnapshot, "refresh between pulls neither rerolls nor duplicates rewards");

run.roster = Array.from({ length: 15 }, (_, index) => ({ playerId: `owned-${index}`, equippedItem: index === 14 ? { id: "boots" } : null }));
run.bench = run.roster.slice(11).map((entry) => entry.playerId);
const rosterBefore = JSON.stringify(run.roster);
const benchBefore = JSON.stringify(run.bench);
run.pendingSpecialMatchReward.selectedProfileId = run.pendingSpecialMatchReward.candidateProfileIds[0];
run.pendingSpecialMatchReward.replacementPendingProfileId = run.pendingSpecialMatchReward.selectedProfileId;
const replacementRefresh = JSON.parse(JSON.stringify(run));
assert.strictEqual(replacementRefresh.pendingSpecialMatchReward.replacementPendingProfileId, run.pendingSpecialMatchReward.selectedProfileId, "refresh preserves full-roster replacement state");
const secondDecline = runtime.decline(run);
assert.strictEqual(secondDecline.status, "declined", "declining Pull 2 completes the reward flow");
assert.strictEqual(run.pendingSpecialMatchReward, null);
assert.strictEqual(JSON.stringify(run.roster), rosterBefore, "replacement decline leaves roster and equipment untouched");
assert.strictEqual(JSON.stringify(run.bench), benchBefore, "replacement decline leaves bench untouched");
assert.deepStrictEqual(run.claimedSpecialMatchRewardIds, [special.specialMatchId]);

const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
assert.match(app, /if \(removedEntry\.equippedItem\) run\.inventory\.push\(removedEntry\.equippedItem\)/, "existing equipped-item return remains in replacement flow");
assert.match(app, /\{ allowCancel: true, recruitmentSource: "special_match_reward"/, "full-roster secondary recruitment uses the native cancellable replacement transition");
assert.match(app, /SpecialMatchRuntime\.completeCurrentReward\(run, pending\)/, "successful recruitment advances only the current reward");

const bridge = fs.readFileSync(path.join(root, "js", "special-reward-ui-bridge.js"), "utf8");
assert.match(bridge, /specialRewardDeclinePatched/, "replacement modal patch is idempotent and cannot loop on textContent mutations");

const ie2 = makeRun();
ie2.seasonId = "ie1_s2";
const otherPending = { specialMatchId: "other", candidateProfileIds: ["one"], selectedProfileId: null, status: "pending" };
ie2.pendingSpecialMatchReward = otherPending;
runtime.decline(ie2, otherPending);
assert.strictEqual(ie2.pendingSpecialMatchReward, null, "existing non-IE3 special reward remains a single pull");

console.log("ie3-secondary-double-reward-test: OK");
