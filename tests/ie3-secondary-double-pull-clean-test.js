"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const profiles = [
  { profileId: "a@one", playerId: "a" },
  { profileId: "b@one", playerId: "b" },
  { profileId: "b@alternate", playerId: "b" },
  { profileId: "c@one", playerId: "c" },
  { profileId: "d@one", playerId: "d" },
  { profileId: "e@one", playerId: "e" },
];
const profileMap = new Map(profiles.map((profile) => [profile.profileId, profile]));
const seeds = [];
const context = {
  globalThis: {
    ProfiledSeasonRuntime: {
      resolveProfile: (_seasonId, profileId) => profileMap.get(String(profileId)) || null,
      compareProfileProgression: () => 1,
      addLevelUnits: () => {},
      acquireOrUpgradeProfile: () => ({ status: "upgraded" }),
    },
    DraftEngine: {
      randomFromSeed: (seed) => {
        seeds.push(seed);
        return seed.endsWith(":2") ? () => 0.99 : () => 0.01;
      },
      shuffle: (values, random) => random() > 0.5 ? [...values].reverse() : [...values],
    },
  },
};
vm.runInNewContext(fs.readFileSync("js/special-match.js", "utf8"), context, { filename: "special-match.js" });
const runtime = context.globalThis.SpecialMatchRuntime;
const secondary = {
  specialMatchId: "secondary",
  teamId: "secondary_team",
  reward: {
    rewardFlow: "choose_one_of_three_from_defeated_secondary_team",
    candidateCount: 3,
    teamPullPoolProfileIds: profiles.map((profile) => profile.profileId),
  },
};
const ordinary = { ...secondary, specialMatchId: "ordinary", reward: { ...secondary.reward, rewardFlow: "other_flow" } };
const db = { seasonId: "ie1_s3", specialMatches: [secondary, ordinary] };
function freshRun(id = "run") {
  return { seasonId: "ie1_s3", runId: id, roster: [], bench: [], inventory: [], completedSpecialMatchIds: [], claimedSpecialMatchRewardIds: [], unlockedSpecialTeamIds: [], unlockedTeamIds: [] };
}
function win(run, special = secondary) {
  return runtime.complete(run, db, { specialMatchId: special.specialMatchId, nodeId: "node" }, "victory").pendingReward;
}
function saveAndReparse(run) {
  const reparsed = JSON.parse(JSON.stringify(run));
  Object.assign(run, reparsed);
}

// Regression: RunState.save reparses the run, so a callback may hold an old object reference.
const staleRun = freshRun("stale");
const stalePending = win(staleRun);
runtime.selectRewardCandidate(staleRun, stalePending.candidateProfileIds[0], stalePending);
saveAndReparse(staleRun);
assert.notStrictEqual(stalePending, staleRun.pendingSpecialMatchReward);
let staleResult = runtime.completeCurrentReward(staleRun, db, stalePending);
assert.strictEqual(staleResult.status, "next-reward");
assert.strictEqual(staleRun.pendingSpecialMatchReward.currentReward, 2);

// The native recruit/upgrade path acquires first, saves/reparses, then invokes its callback.
for (const acquisitionStatus of ["acquired", "upgraded"]) {
  const recruitRun = freshRun(`recruit-${acquisitionStatus}`);
  const callbackPending = win(recruitRun);
  runtime.selectRewardCandidate(recruitRun, callbackPending.candidateProfileIds[0], callbackPending);
  if (acquisitionStatus === "acquired") recruitRun.roster.push({ playerId: profileMap.get(callbackPending.selectedProfileId).playerId });
  else recruitRun.roster.push({ playerId: "owned", activeProfileId: callbackPending.selectedProfileId });
  saveAndReparse(recruitRun);
  const callbackResult = runtime.completeCurrentReward(recruitRun, db, recruitRun.pendingSpecialMatchReward);
  assert.strictEqual(callbackResult.status, "next-reward", `${acquisitionStatus} callback must open pull 2 after save`);
  assert.strictEqual(recruitRun.pendingSpecialMatchReward.currentReward, 2);
}

// Basic flow, distinct deterministic seeds, per-player dedupe and persistence.
const basic = freshRun("basic");
let pending = win(basic);
assert.strictEqual(pending.totalRewards, 2);
assert.strictEqual(pending.currentReward, 1);
assert.strictEqual(pending.candidateProfileIds.length, 3);
assert.strictEqual(new Set(pending.candidateProfileIds.map((id) => profileMap.get(id).playerId)).size, 3, "one pull must dedupe profile variants by canonical playerId");
const pullOneCandidates = [...pending.candidateProfileIds];
const selected = pullOneCandidates[1];
runtime.selectRewardCandidate(basic, selected, pending);
const savedPullOne = JSON.parse(JSON.stringify(pending));
assert.deepStrictEqual(savedPullOne.candidateProfileIds, pullOneCandidates, "reload data must preserve pull 1 candidates");
let transition = runtime.completeCurrentReward(basic, db, pending);
assert.strictEqual(transition.status, "next-reward");
assert.strictEqual(pending.currentReward, 2);
assert(seeds.some((seed) => seed.endsWith(":reward:1")) && seeds.some((seed) => seed.endsWith(":reward:2")), "pulls must use different indexed seeds");
assert.notDeepStrictEqual(pending.candidateProfileIds, pullOneCandidates, "pull 2 must be regenerated, not reused");
const selectedPlayerId = profileMap.get(selected).playerId;
assert.deepStrictEqual(Array.from(pending.excludedPlayerIds), [selectedPlayerId], "only the selected canonical player is excluded");
assert(!pending.candidateProfileIds.some((id) => profileMap.get(id).playerId === selectedPlayerId), "all selected-player profile variants must be excluded");
for (const id of pullOneCandidates.filter((id) => id !== selected)) assert(!pending.excludedPlayerIds.includes(profileMap.get(id).playerId), "merely displayed candidates stay eligible");
const savedPullTwo = JSON.parse(JSON.stringify(pending));
assert.strictEqual(savedPullTwo.currentReward, 2);
assert.deepStrictEqual(savedPullTwo.candidateProfileIds, pending.candidateProfileIds);
assert.deepStrictEqual(savedPullTwo.excludedPlayerIds, Array.from(pending.excludedPlayerIds));
const resumed = runtime.complete(basic, db, { specialMatchId: secondary.specialMatchId, nodeId: "node" }, "victory").pendingReward;
assert.strictEqual(resumed, pending, "replayed completion must preserve the persisted pull 2 object");
assert.deepStrictEqual(Array.from(resumed.candidateProfileIds), savedPullTwo.candidateProfileIds, "replayed completion must not reroll pull 2");
transition = runtime.completeCurrentReward(basic, db, pending);
assert.strictEqual(transition.status, "completed");
assert.strictEqual(basic.pendingSpecialMatchReward, null);
assert.deepStrictEqual(Array.from(basic.claimedSpecialMatchRewardIds), ["secondary"]);

// Direct decline advances without excluding any displayed candidate.
const declined = freshRun("decline");
pending = win(declined);
const declineResult = runtime.decline(declined, pending, db);
assert.strictEqual(declineResult.transition.status, "next-reward");
assert.strictEqual(declined.pendingSpecialMatchReward.currentReward, 2);
assert.deepStrictEqual(Array.from(declined.pendingSpecialMatchReward.excludedPlayerIds), []);
assert(!declined.claimedSpecialMatchRewardIds.includes("secondary"));

// Full-roster replacement callback: replacement mechanics remain intact, then the one transition advances.
const replaceRun = freshRun("replace");
replaceRun.roster = Array.from({ length: 15 }, (_, index) => ({ playerId: `roster-${index}`, equippedItem: index === 14 ? "boots" : null }));
replaceRun.bench = ["roster-11", "roster-12", "roster-13", "roster-14"];
pending = win(replaceRun);
const replacementPick = pending.candidateProfileIds[0];
runtime.selectRewardCandidate(replaceRun, replacementPick, pending);
assert.strictEqual(pending.replacementPendingProfileId, null, "candidate selection alone must not imply replacement state");
const removed = replaceRun.roster.find((entry) => entry.playerId === "roster-14");
if (removed.equippedItem) replaceRun.inventory.push(removed.equippedItem);
replaceRun.roster = replaceRun.roster.filter((entry) => entry.playerId !== removed.playerId);
replaceRun.bench = replaceRun.bench.filter((id) => id !== removed.playerId);
replaceRun.roster.push({ playerId: profileMap.get(replacementPick).playerId });
replaceRun.bench.push(profileMap.get(replacementPick).playerId);
saveAndReparse(replaceRun);
transition = runtime.completeCurrentReward(replaceRun, db, replaceRun.pendingSpecialMatchReward);
assert.strictEqual(replaceRun.roster.length, 15);
assert(!replaceRun.roster.some((entry) => entry.playerId === removed.playerId));
assert(replaceRun.roster.some((entry) => entry.playerId === profileMap.get(replacementPick).playerId));
assert(replaceRun.inventory.includes("boots"));
assert.strictEqual(transition.status, "next-reward");
assert(replaceRun.pendingSpecialMatchReward.excludedPlayerIds.includes(profileMap.get(replacementPick).playerId));

// Native done(false): no roster/bench/inventory mutation, but a selected player resolves and is excluded.
const cancelRun = freshRun("cancel");
cancelRun.roster = Array.from({ length: 15 }, (_, index) => ({ playerId: `full-${index}`, equippedItem: index === 14 ? "gloves" : null }));
cancelRun.bench = ["full-11", "full-12", "full-13", "full-14"];
cancelRun.inventory = ["existing"];
pending = win(cancelRun);
const cancelledPick = pending.candidateProfileIds[0];
runtime.selectRewardCandidate(cancelRun, cancelledPick, pending);
const beforeCancel = JSON.stringify({ roster: cancelRun.roster, bench: cancelRun.bench, inventory: cancelRun.inventory });
transition = runtime.completeCurrentReward(cancelRun, db, pending); // recruitPlayer's native done(false) callback
assert.strictEqual(transition.status, "next-reward");
assert.strictEqual(JSON.stringify({ roster: cancelRun.roster, bench: cancelRun.bench, inventory: cancelRun.inventory }), beforeCancel);
assert(cancelRun.pendingSpecialMatchReward.excludedPlayerIds.includes(profileMap.get(cancelledPick).playerId));
assert.strictEqual(cancelRun.pendingSpecialMatchReward.currentReward, 2);
assert(cancelRun.pendingSpecialMatchReward);
const pullTwoPick = cancelRun.pendingSpecialMatchReward.candidateProfileIds[0];
runtime.selectRewardCandidate(cancelRun, pullTwoPick, cancelRun.pendingSpecialMatchReward);
transition = runtime.completeCurrentReward(cancelRun, db, cancelRun.pendingSpecialMatchReward); // pull 2 done(false)
assert.strictEqual(transition.status, "completed");
assert.strictEqual(cancelRun.pendingSpecialMatchReward, null);

// Other special rewards stay single-pull.
const otherRun = freshRun("other");
pending = win(otherRun, ordinary);
assert.strictEqual(pending.totalRewards, 1);
runtime.completeCurrentReward(otherRun, db, pending);
assert.strictEqual(otherRun.pendingSpecialMatchReward, null);

// Integration/source contract: recruitment and reward completion share one canonical transaction.
const appSource = fs.readFileSync("js/app.js", "utf8");
const bridgeSource = fs.readFileSync("js/special-reward-ui-bridge.js", "utf8");
assert(appSource.includes('allowCancel: true,'), "special reward must request recruitPlayer's native cancel");
assert(appSource.includes('transactionMutate: (current) => { transition = global.SpecialMatchRuntime.completeCurrentReward(current'), "recruit and special reward completion must be atomic");
assert(appSource.includes('id="cancel-recruit"'), "recruitPlayer must render its native cancel control");
assert(appSource.includes('complete("cancelled")'), "native cancel must expose the structured cancelled result");
assert(!bridgeSource.includes("SpecialMatchRuntime?.decline?."), "bridge must not resolve replacement rewards");
assert(!bridgeSource.includes('phase = "map"'), "bridge must not force map phase");
assert(!bridgeSource.includes("returnToMapWithoutReload"), "bridge must not navigate replacement cancellation");
assert(!bridgeSource.includes("data-decline-special-reward-full-roster"), "bridge must not add a parallel decline button");

console.log("ie3-secondary-double-pull-clean-test: OK");
