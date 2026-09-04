"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
  console,
  SEASON1_CONFIG: { categoryRanks: { Normale: 0, Elite: 3 } },
  SpecialMatchRuntime: { eligibleProfile: () => true },
  DraftEngine: {
    randomFromSeed: () => () => 0,
    selectCandidates: (available, _random, count) => available.slice(0, count),
    selectWeightedCandidates: (available, _random, _weights, count) => available.slice(0, count),
    selectLegendaryCandidates: (available, _random, _rank, _elite, count) => available.slice(0, count),
    shuffle: (available) => available.slice(),
  },
};
context.globalThis = context;
vm.createContext(context);
for (const file of [
  "js/recruitment/player-identity.js",
  "js/recruitment/roster-invariants.js",
  "js/recruitment-pool.js",
  "js/pulls/pull-invariants.js",
  "js/pulls/pull-candidates.js",
  "js/pulls/pull-items.js",
]) vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });

const antoniA = { playerId: "antoni", profileId: "antoni-a", pullCandidateKind: "season_profile", category: "Elite", position: "MF" };
const antoniB = { playerId: "antoni", profileId: "antoni-b", pullCandidateKind: "season_profile", category: "Elite", position: "MF" };
const antoniC = { playerId: "antoni", profileId: "antoni-c", pullCandidateKind: "season_profile", category: "Elite", position: "MF" };
const bob = { playerId: "bob", category: "Elite", position: "DF", pullCandidateKind: "free_agent" };
const carl = { playerId: "carl", category: "Elite", position: "FW", pullCandidateKind: "free_agent" };
const dave = { playerId: "dave", category: "Elite", position: "GK", pullCandidateKind: "free_agent" };
const run = (roster = []) => ({ roster, currentZone: { seed: "seed" } });
const node = (excludedCandidateIds = [], candidateIds = []) => ({ id: "pull", pullState: { pullType: "pull_legendary", rerolls: 0, excludedCandidateIds, candidateIds } });
const pool = (players, profileAware = true) => ({ players, profileAware });
const ids = (players) => players.map(context.PlayerIdentity.canonicalPlayerId);

// Legendary variants are collapsed before selection, rather than after three slots were spent.
let result = context.PullCandidatesRuntime.generatedPullCandidates(run(), pool([antoniA, antoniB, antoniC, bob, carl]), node());
assert.deepStrictEqual(Array.from(ids(result)), ["antoni", "bob", "carl"]);
assert.strictEqual(result.length, 3);

// Mixed free-agent/profile representations remain one canonical candidate.
const antoniFree = { playerId: "antoni", pullCandidateKind: "free_agent", category: "Elite", position: "MF" };
result = context.PullCandidatesRuntime.generatedPullCandidates(run(), pool([antoniFree, antoniA, bob, carl]), node());
assert.strictEqual(new Set(ids(result)).size, 3);

// Canonical ownership excludes a season profile even though its candidate key differs.
assert.strictEqual(context.RecruitmentPoolRuntime.eligible(run([{ playerId: "antoni" }]), antoniA), false);
result = context.PullCandidatesRuntime.generatedPullCandidates(run([{ playerId: "antoni" }]), pool([antoniA, bob, carl, dave]), node());
assert(!ids(result).includes("antoni"));

// Legacy Scout Token candidate-key exclusions derive a canonical exclusion.
result = context.PullCandidatesRuntime.generatedPullCandidates(run(), pool([antoniA, antoniB, bob, carl, dave]), node(["antoni-a"]));
assert(!ids(result).includes("antoni"));
const canonicalExclusionNode = node();
canonicalExclusionNode.pullState.excludedCanonicalPlayerIds = ["antoni"];
result = context.PullCandidatesRuntime.generatedPullCandidates(run(), pool([antoniB, bob, carl, dave]), canonicalExclusionNode);
assert(!ids(result).includes("antoni"), "new saves retain canonical exclusion even when the original profile leaves the pool");

// Lucky Charm refuses an existing variant as an "upgrade" and keeps final candidates unique.
const items = context.PullItemsRuntime.create({ canonicalCandidatePlayerId: context.PlayerIdentity.canonicalPlayerId });
const upgrades = items.buildLuckyCharmUpgrades([antoniA, bob, carl], [antoniB, dave], () => 0);
assert(upgrades);
assert.strictEqual(new Set(ids(upgrades.candidates)).size, 3);
assert.strictEqual(upgrades.candidates.some((candidate) => candidate === antoniB), false);

// New ownership and formation writes are rejected; corrupt legacy state is diagnosed, not deleted.
assert.throws(() => context.RosterInvariants.assertCanOwn(run([{ playerId: "antoni", activeProfileId: "antoni-a" }]), antoniB), /already owned/);
const corrupt = { roster: [{ playerId: "antoni", activeProfileId: "antoni-a" }, { playerId: "antoni", activeProfileId: "antoni-b" }], lineup: ["antoni"], bench: ["antoni"] };
const diagnosis = context.RosterInvariants.inspect(corrupt);
assert.strictEqual(diagnosis.valid, false);
assert(diagnosis.errors.includes("roster-duplicate-canonical-player"));
assert(diagnosis.errors.includes("lineup-bench-canonical-overlap"));
assert.throws(() => context.RosterInvariants.assertValid(corrupt), /Roster invariant violated/);
assert.strictEqual(corrupt.roster.length, 2, "inspection is non-destructive for legacy saves");

// Three genuinely distinct candidates still work normally.
result = context.PullCandidatesRuntime.generatedPullCandidates(run(), pool([antoniA, bob, carl]), node());
assert.deepStrictEqual(Array.from(ids(result)), ["antoni", "bob", "carl"]);

// Persisted duplicate candidate keys are repaired deterministically, preserving the first variant.
const legacyNode = node([], ["antoni-a", "antoni-b", "bob"]);
const recovery = context.PullCandidatesRuntime.resolveCandidateIds(run(), pool([antoniA, antoniB, bob, carl]), legacyNode);
assert.strictEqual(recovery.repaired, true);
assert.deepStrictEqual(Array.from(recovery.candidateIds), ["antoni-a", "bob", "carl"]);
assert.deepStrictEqual(Array.from(ids(recovery.candidates)), ["antoni", "bob", "carl"]);

const recruitment = fs.readFileSync("js/recruitment/recruitment-controller.js", "utf8");
assert.match(recruitment, /rosterInvariants\.assertCanOwn\(current, player\)/, "recruitment write boundary gates canonical ownership");
assert.match(recruitment, /rosterInvariants\.assertValid\(current\)/, "recruitment mutations enforce the roster/formation invariant");
console.log("canonical pull, ownership, recruitment, roster, formation and legacy recovery invariants passed");
