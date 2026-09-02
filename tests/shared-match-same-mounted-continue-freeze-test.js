"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = roles.map((position, index) => ({ playerId: `p${index}`, profileId: `profile-${index}`, name: `P${index}`, position, category: "Normale", overall: 60, finalOverall: 60, stats: {} }));
const bossPlayers = roles.map((position, index) => ({ playerId: `b${index}`, profileId: `boss-profile-${index}`, name: `B${index}`, position, category: "Normale", overall: 55, finalOverall: 55, stats: {} }));
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: roles };
const special = { specialMatchId: "secondary", teamId: "secondary-team", teamName: "Secondary", matchLevel: 1, matchFormation: formation.id,
  startingXIPlayerIds: players.map(player => player.playerId), reward: { candidateCount: 1, guaranteedProfileId: "profile-0" } };
const seasonDb = { seasonId: "ie1", players: [...players, ...bossPlayers], profiles: [...players, ...bossPlayers], teams: [{ teamId: "boss", playerIds: bossPlayers.map(player => player.playerId) }], formations: { eleven: [formation] }, specialMatches: [special],
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: formation.id, bossLevel: 1, startingXIPlayerIds: bossPlayers.map(player => player.playerId), playerProfileIds: bossPlayers.map(player => player.profileId) }] };

const SpecialMatchRuntime = {
  byId: (_database, id) => String(id) === special.specialMatchId ? special : null,
  teamPlayers: () => players,
  eligibleProfile: () => true,
  complete: (run, _database, match, result) => {
    if (result !== "victory") return;
    if (!run.completedSpecialMatchIds.includes(special.specialMatchId)) run.completedSpecialMatchIds.push(special.specialMatchId);
    run.pendingSpecialMatchReward = { specialMatchId: special.specialMatchId, nodeId: match.nodeId, teamId: special.teamId, status: "pending", candidateProfileIds: [] };
  },
};
const FiveVFive = { formations: [], ensure: run => (run.fiveVFive ||= { formation: "none", slots: {} }), validate: () => ({ valid: true }), formationById: () => ({ slots: [] }) };

function simulation(seed) {
  return { valid: true, seed, state: "pre-match", winner: "user", resolutionApplied: false, revealedCount: 0,
    score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 }, timeline: [{ minute: 1, type: "goal", team: "user", text: "Gol" }],
    userStrength: {}, opponentStrength: {}, probabilities: {}, userSnapshot: { playerIds: players.map(player => player.playerId), players } };
}

function activeRun(type) {
  const nodeId = type === "boss" ? "boss-node" : "special-node";
  const match = { matchId: `pre-freeze-${type}`, type, nodeId, previousNodeId: "start", attemptNumber: 1, state: "pre-match", log: [], score: [0, 0] };
  if (type === "boss") match.bossIndex = 0;
  else Object.assign(match, { specialMatchId: special.specialMatchId, teamId: special.teamId, matchLevel: 1, matchFormation: formation.id });
  return { version: 2, runId: `same-dom-${type}`, seasonId: "ie1", phase: "match", lives: 2, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [], formationId: formation.id,
    fiveVFive: { formation: "none", slots: {} }, teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, activeMatch: match,
    currentZone: { bossIndex: 0, bossId: "boss", currentNodeId: nodeId, pendingNodeId: null, startNodeId: "start", path: ["start"], completedNodeIds: [],
      nodes: [{ id: "start", type: "start" }, { id: nodeId, type, specialMatchId: type === "special_match" ? special.specialMatchId : undefined }], edges: [["start", nodeId]] } };
}

function open(type) {
  const rt = load(new BudgetStorage(Infinity), { run: activeRun(type), seasonDb, contextOverrides: { FiveVFive, SpecialMatchRuntime } });
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  rt.context.MatchSimulator.simulate = ({ seed }) => simulation(seed);
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1000, playbackMs: 1000 };
  rt.context.DraftEngine.selectCandidates = candidates => candidates.slice(0, 3);
  rt.context.setTimeout = () => 1; rt.context.clearTimeout = () => {};
  rt.context.RunStatistics.createStableMatchId = (run, match) => `${run.runId}::${match.nodeId}::${match.type}::${match.attemptNumber}::${match.simulation?.seed || "preseed"}`;
  return rt;
}

for (const type of ["boss", "special_match"]) {
  const rt = open(type);
  rt.seam.renderMatch({ allowAutomaticResume: false });
  const sameMountedContinue = rt.context.document.getElementById("continue-match-result");
  const preStartMatchId = rt.seam.getRun().activeMatch.matchId;
  assert.strictEqual(rt.seam.startMatchSimulation(rt.seam.getRun().activeMatch).ok, true);
  const postFreezeMatchId = rt.canonical.activeMatch.matchId;
  assert.notStrictEqual(postFreezeMatchId, preStartMatchId, `${type}: freeze must demonstrate the matchId change`);
  rt.seam.stepMatchPlayback(); rt.seam.stepMatchPlayback();
  assert.strictEqual(rt.canonical.activeMatch.simulation.resolutionApplied, true);
  if (type === "special_match") assert.strictEqual(rt.canonical.activeMatch.pendingPostMatchAction.type, "special-reward");
  if (type === "boss") {
    rt.seam.getRun().postBossFlow.candidateIds = bossPlayers.slice(0, 3).map(player => player.playerId);
    rt.seam.getRun().pendingBossVictory.candidateIds = [...rt.seam.getRun().postBossFlow.candidateIds];
    rt.context.RunState.save(rt.seam.getRun());
  }
  sameMountedContinue.click();
  assert.strictEqual(rt.canonical.activeMatch, null, `${type}: the pre-match mounted Continue must survive start/freeze`);
  assert.strictEqual(rt.canonical.phase, type === "boss" ? "match" : "special-reward");
  if (type === "boss") assert.strictEqual(rt.canonical.postBossFlow.status, "reward");
  else assert.ok(rt.canonical.pendingSpecialMatchReward);
  console.log(`${type}: ${preStartMatchId} -> ${postFreezeMatchId}; same-mounted Continue OK`);
}
