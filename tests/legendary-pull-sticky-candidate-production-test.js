"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const freeAgents = require("../data/FREE_AGENTS_compact.json");
const seasons = [
  require("../data/IE1_season_compact.json"),
  require("../data/IE2_season_compact.json"),
];

function loadModule(context, file) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), context, { filename: file });
}

function makeRuntime(seasonDb) {
  const run = {
    runId: `legendary-sticky-${seasonDb.seasonId}`,
    seasonId: seasonDb.seasonId,
    bossIndex: 2,
    roster: [],
    inventory: [],
    currentZone: { seed: `legendary-sticky:${seasonDb.seasonId}:zone` },
  };
  const c = {
    console,
    structuredClone,
    DevelopmentRuntime: {
      resolveEffectiveMetadata: (_run, player) => player,
      effectiveAccountPotential: (player) => Number(player?.finalOverall || 0),
    },
    ProfiledSeasonRuntime: {},
    SpecialMatchRuntime: { eligibleProfile: () => true },
    SeasonRegistry: {
      sourceForSeason: (seasonId) => seasonId,
      isSeasonSource: () => true,
      database: () => seasonDb,
    },
    RoguelikeRules: {
      unlockedPullLevel: () => 0,
      unlockedTeamPullCategoryWeights: () => null,
    },
  };
  c.globalThis = c;
  vm.createContext(c);
  loadModule(c, "season1-config.js");
  loadModule(c, "recruitment/player-identity.js");
  loadModule(c, "recruitment-pool.js");
  loadModule(c, "pulls/pull-invariants.js");
  loadModule(c, "pulls/legendary-pull.js");
  loadModule(c, "draft.js");
  loadModule(c, "pulls/pull-pool.js");
  loadModule(c, "pulls/pull-candidates.js");

  const poolRuntime = c.PullPoolRuntime.create({
    getRun: () => run,
    getSeasonDb: () => seasonDb,
    getFreeAgentsDb: () => freeAgents,
    isProfileAwareSeason: () => false,
  });
  return { c, run, pool: poolRuntime.pullPool("pull_legendary") };
}

for (const seasonDb of seasons) {
  const { c, run, pool } = makeRuntime(seasonDb);
  const seasonal = pool.players.filter((player) => player.pullCandidateKind === "season_profile");
  assert(seasonal.length > 1, `${seasonDb.seasonId}: real legendary pool must contain multiple seasonal candidates`);

  const firstSeasonal = seasonal[0];
  const intendedSeasonal = seasonal[1];
  const firstKey = c.PlayerIdentity.candidateKey(firstSeasonal);
  const intendedKey = c.PlayerIdentity.candidateKey(intendedSeasonal);

  assert.notEqual(
    intendedKey,
    "",
    `${seasonDb.seasonId}: seasonal legendary candidate ${intendedSeasonal.name} must have a stable non-empty candidate key; first empty-key candidate is ${firstSeasonal.name}`,
  );
  assert.notEqual(firstKey, intendedKey, `${seasonDb.seasonId}: distinct seasonal players must not collapse to the same persisted candidate key`);

  const free = pool.players.filter((player) => player.pullCandidateKind === "free_agent").slice(0, 2);
  assert.equal(free.length, 2, `${seasonDb.seasonId}: fixture needs two free-agent legendary candidates`);
  const node = {
    id: `legendary-real-${seasonDb.seasonId}`,
    pullState: {
      pullType: "pull_legendary",
      rerolls: 0,
      excludedCandidateIds: [],
      candidateIds: [
        intendedKey,
        c.PlayerIdentity.candidateKey(free[0]),
        c.PlayerIdentity.candidateKey(free[1]),
      ],
    },
  };
  const resolved = c.PullCandidatesRuntime.resolveCandidateIds(run, pool, node).candidates;
  assert(
    resolved.some((player) => String(player.playerId) === String(intendedSeasonal.playerId)),
    `${seasonDb.seasonId}: persisted legendary offer must resolve the intended seasonal player instead of sticking to ${firstSeasonal.name}`,
  );
}

console.log("legendary pull candidate identity: IE1/IE2 seasonal offers persist and resolve their exact player without sticky first-candidate collapse");
