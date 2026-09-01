const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
  console,
  globalThis: null,
  DevelopmentRuntime: null,
  DevelopmentAccountV3: null,
  ProfiledSeasonRuntime: null,
  SpecialMatchRuntime: null,
  SeasonRegistry: null,
};
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/recruitment/player-identity.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/recruitment-pool.js", "utf8"), context);

const identity = context.PlayerIdentity;
const pool = context.RecruitmentPoolRuntime;
assert(identity, "PlayerIdentity runtime is exposed");
assert(pool, "RecruitmentPoolRuntime remains exposed");

const cases = [
  { player: { playerId: 101, profileId: "ignored-profile", pullCandidateKind: "free_agent" }, profile: false, canonical: "101", key: "101", source: "free_agents" },
  { player: { playerId: 101, profileId: "profile-101", pullCandidateKind: "season_profile" }, profile: true, canonical: "101", key: "profile-101", source: "ie1_s3" },
  { player: { playerId: "202", profileId: "profile-202", sourceKind: "ie1_s3_recruitment_profile" }, profile: true, canonical: "202", key: "profile-202", source: "ie1_s3" },
  { player: { playerId: "303", profileId: "profile-303" }, profile: true, canonical: "303", key: "profile-303", source: "ie1_s3" },
];

for (const test of cases) {
  assert.strictEqual(identity.isSeasonProfileCandidate(test.player), test.profile);
  assert.strictEqual(identity.canonicalPlayerId(test.player), test.canonical);
  assert.strictEqual(identity.candidateKey(test.player), test.key);
  assert.strictEqual(identity.candidateSource(test.player, "ie1_s3"), test.source);

  assert.strictEqual(pool.isSeasonProfileCandidate(test.player), test.profile);
  assert.strictEqual(pool.canonicalPlayerId(test.player), test.canonical);
  assert.strictEqual(pool.candidateKey(test.player), test.key);
  assert.strictEqual(pool.candidateSource(test.player, "ie1_s3"), test.source);
}

assert.strictEqual(identity.id(null), "");
assert.strictEqual(identity.id(undefined), "");

console.log("player identity extraction: RecruitmentPoolRuntime parity passed");
