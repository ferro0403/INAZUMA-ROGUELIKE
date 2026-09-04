"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: roles };
const player = (prefix, index) => ({ playerId: `${prefix}${index}`, name: `${prefix}${index}`, position: roles[index], overall: 60, finalOverall: 60, stats: {} });
const users = roles.map((_, index) => player("u", index));
const opponents = roles.map((_, index) => player("o", index));
const profiles = opponents.map((item, index) => ({ ...item, profileId: `op-${index}`, defaultRoleVariantId: roles[index].toLowerCase(), roleVariants: [] }));
const special = {
  specialMatchId: "secondary", teamId: "secondary-team", teamName: "Secondary XI", logoUrl: "secondary.svg",
  matchLevel: 3, matchFormation: formation.id,
  startingXI: profiles.map((profile) => ({ playerId: profile.playerId, profileId: profile.profileId })),
  reward: { rewardFlow: "choose_one_of_three_from_defeated_secondary_team", candidateCount: 3, teamPullPoolProfileIds: profiles.slice(0, 6).map((profile) => profile.profileId) },
};
const seasonDb = {
  seasonId: "ie1_s3", requiresProfileAwareRuntime: true, players: [...users, ...opponents], profiles,
  profileUpgradePaths: [], formations: { eleven: [formation] }, teams: [], bossOrder: [{ teamId: "future-boss", teamName: "Future Boss", bossFormation: formation.id, bossLevel: 4, startingXIPlayerIds: opponents.map((item) => item.playerId) }], specialMatches: [special],
};
const FiveVFive = { formations: [], ensure: (run) => (run.fiveVFive ||= { formation: "none", slots: {} }), validate: () => ({ valid: true }), formationById: () => ({ slots: [] }), removeUnavailable() {} };

function initialRun({ pending = true } = {}) {
  const node = { id: "special-node", type: "special_match", specialMatchId: special.specialMatchId, teamId: special.teamId, teamName: special.teamName, logoUrl: special.logoUrl, matchLevel: special.matchLevel, matchFormation: special.matchFormation };
  return {
    version: 2, runId: `special-domain-${Math.random()}`, seasonId: seasonDb.seasonId, phase: "map", lives: 2, gameOver: false,
    bossIndex: 0, consecutiveLosses: 0, completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [],
    unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], processedLevelUnitActionIds: [], permanentEffectOutbox: [],
    roster: users.map((item) => ({ playerId: item.playerId, source: seasonDb.seasonId, level: 0, levelUnits: 0, equippedItem: null })),
    lineup: users.map((item) => item.playerId), bench: [], inventory: [], formationId: formation.id, fiveVFive: { formation: "none", slots: {} },
    teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, teamLevelUnits: 0, activeMatch: null,
    currentZone: { startNodeId: "start", currentNodeId: "start", pendingNodeId: pending ? node.id : null, path: ["start"], completedNodeIds: [], nodes: [{ id: "start", type: "start" }, node], edges: [["start", node.id]] },
  };
}

function open(run = initialRun()) {
  const storage = new BudgetStorage(Infinity);
  const RunStatistics = {
    ACTIONS: { PLAYER_RECRUITED: "PLAYER_RECRUITED", NODE_COMPLETED: "NODE_COMPLETED" },
    createStableMatchId: (current, match) => `${current.runId}::${match.nodeId}::${match.type}::${match.attemptNumber || 1}`,
    recordRunAction: (current, type, details) => { current.statistics.actions ||= []; if (!current.statistics.actions.some((action) => action.actionId === details.actionId)) current.statistics.actions.push({ type, ...details }); },
    applyCompletedMatchStatistics: () => {},
    buildHallOfFameStatisticsSnapshot: () => ({ runStatistics: {}, playerStatistics: {}, matchHistory: [], awards: [] }), snapshotFinalPlayerStats: () => {},
  };
  const SmartLineup = { optimizeLineupsForNewPlayer: () => ({ elevenChanged: false, fiveChanged: false }) };
  const RoguelikeRules = { isProfileAwareRosterEntry: () => true, applyEquipment: (stats) => stats, removeUnavailable: () => {}, resolveDevelopmentEffectiveMetadata: () => ({}) };
  const rt = load(storage, { run, seasonDb, useProductionSpecialMatchRuntime: true, contextOverrides: { FiveVFive, RunStatistics, SmartLineup, RoguelikeRules } });
  rt.context.SeasonRegistry.player = (id) => seasonDb.players.find((item) => String(item.playerId) === String(id));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => true;
  rt.context.DraftEngine.randomFromSeed = (seed) => seed.endsWith(":2") ? () => 0.99 : () => 0.01;
  rt.context.DraftEngine.shuffle = (values, random) => random() > 0.5 ? [...values].reverse() : [...values];
  return { rt, storage };
}

function failNextWrite(storage, name) {
  const original = storage.setItem.bind(storage);
  let pending = true;
  storage.setItem = (key, value) => {
    if (pending) { pending = false; const error = new Error(name); error.name = name === "QuotaExceededError" ? name : "Error"; error.code = name; throw error; }
    return original(key, value);
  };
  return () => { storage.setItem = original; };
}

function rewardUi(rt, profileId) {
  const modal = rt.context.document.getElementById("modal-root");
  const card = rt.context.document.createElement("button");
  const profile = rt.context.ProfiledSeasonRuntime.resolveProfile(seasonDb.seasonId, profileId);
  card.dataset.playerId = profile.playerId;
  modal.querySelectorAll = (selector) => selector === "[data-player-id]" ? [card] : [];
  rt.context.__INAZUMA_RECRUITMENT_TEST__.showSpecialMatchReward();
  return { modal, card, claim: rt.context.document.getElementById("claim-special-reward"), decline: rt.context.document.getElementById("decline-special-reward") };
}

// Production entry/recovery and read-model parity.
{
  const { rt } = open();
  assert.strictEqual(rt.seam.recoverInterruptedSpecialMatchAccess(), true);
  const canonical = rt.canonical;
  assert.deepStrictEqual({ type: canonical.activeMatch.type, specialMatchId: canonical.activeMatch.specialMatchId, nodeId: canonical.activeMatch.nodeId, teamId: canonical.activeMatch.teamId, matchLevel: canonical.activeMatch.matchLevel, matchFormation: canonical.activeMatch.matchFormation, attemptNumber: canonical.activeMatch.attemptNumber, phase: canonical.phase },
    { type: "special_match", specialMatchId: special.specialMatchId, nodeId: "special-node", teamId: special.teamId, matchLevel: 3, matchFormation: formation.id, attemptNumber: 1, phase: "match" });
  assert.ok(canonical.activeMatch.matchId);
  const readModel = rt.seam.specialMatchOpponentMeta(canonical.activeMatch);
  assert.deepStrictEqual({ name: readModel.name, logoUrl: readModel.logoUrl, formation: readModel.formation, level: readModel.level }, { name: special.teamName, logoUrl: special.logoUrl, formation: special.matchFormation, level: special.matchLevel });
  assert.strictEqual(readModel.players.length, 11);
  assert.deepStrictEqual(readModel.players.map((item) => item.playerId), opponents.map((item) => item.playerId));

  const live = rt.seam.getRun();
  live.activeMatch.simulation = { valid: true, state: "completed", winner: "user", resolutionApplied: false, score: { user: 2, opponent: 1 }, displayedScore: { user: 2, opponent: 1 }, timeline: [], revealedCount: 0 };
  rt.context.RunState.save(live); rt.seam.setContext({ run: rt.context.RunState.load(), seasonDb });
  rt.seam.completeSpecialMatch("victory");
  const won = rt.canonical;
  assert.strictEqual(won.activeMatch.simulation.resolutionApplied, true);
  assert.strictEqual(won.activeMatch.result, "victory");
  assert.strictEqual(won.activeMatch.pendingPostMatchAction.type, "special-reward");
  assert.ok(won.pendingSpecialMatchReward);
  assert.ok(won.currentZone.completedNodeIds.includes("special-node"));
  assert.strictEqual(won.teamLevel, 1);
  assert.deepStrictEqual(won.completedSpecialMatchIds, [special.specialMatchId]);
  assert.deepStrictEqual(won.unlockedSpecialTeamIds, [special.teamId]);
  rt.seam.completeSpecialMatch("victory");
  assert.strictEqual(rt.canonical.teamLevel, 1);
  assert.deepStrictEqual(rt.canonical.completedSpecialMatchIds, [special.specialMatchId]);
}

function pendingRun(id) {
  const run = initialRun({ pending: false });
  run.runId = id; run.phase = "special-reward";
  const pending = { specialMatchId: special.specialMatchId, nodeId: "special-node", teamId: special.teamId, totalRewards: 1, currentReward: 1, indexedSeed: false, candidateProfileIds: profiles.slice(0, 3).map((item) => item.profileId), selectedProfileId: null, excludedPlayerIds: [], replacementPendingProfileId: null, status: "pending", actionId: `${id}:secondary:reward` };
  run.pendingSpecialMatchReward = pending;
  return run;
}

// Real controller selection, stale callback rejection, quota/stale-write rollback and retry.
for (const failure of ["QuotaExceededError", "stale-write"]) {
  const { rt, storage } = open(pendingRun(`select-${failure}`));
  const ui = rewardUi(rt, profiles[0].profileId);
  const restoreWrite = failNextWrite(storage, failure);
  ui.card.click();
  assert.strictEqual(rt.canonical.pendingSpecialMatchReward.selectedProfileId, null);
  assert.ok(ui.modal.innerHTML.includes("SCELTA GIOCATORE DISPONIBILE"));
  restoreWrite();
  ui.card.click();
  assert.strictEqual(rt.canonical.pendingSpecialMatchReward.selectedProfileId, profiles[0].profileId);
}
{
  const { rt } = open(pendingRun("stale-callback"));
  const ui = rewardUi(rt, profiles[0].profileId);
  const changed = rt.canonical;
  Object.assign(changed.pendingSpecialMatchReward, { currentReward: 2, actionId: "reward-two", candidateProfileIds: [profiles[4].profileId], selectedProfileId: null });
  rt.context.RunState.save(changed); rt.seam.setContext({ run: rt.context.RunState.load(), seasonDb });
  ui.card.click();
  assert.deepStrictEqual(rt.canonical.pendingSpecialMatchReward, changed.pendingSpecialMatchReward);
}

// Decline rollback and retry use the canonical pending checkpoint.
{
  const { rt, storage } = open(pendingRun("decline-failure"));
  const ui = rewardUi(rt, profiles[0].profileId);
  const restoreWrite = failNextWrite(storage, "QuotaExceededError"); ui.decline.clickLatest();
  assert.ok(rt.canonical.pendingSpecialMatchReward);
  assert.strictEqual(rt.canonical.phase, "special-reward");
  assert.deepStrictEqual(rt.canonical.claimedSpecialMatchRewardIds, []);
  restoreWrite(); ui.decline.disabled = false; ui.decline.clickLatest();
  assert.strictEqual(rt.canonical.pendingSpecialMatchReward, null);
  assert.strictEqual(rt.canonical.phase, "map");
}

// Recruitment and reward completion share one failed/successful commit; canonical identity stays unique.
{
  const { rt, storage } = open(pendingRun("claim-atomic"));
  let ui = rewardUi(rt, profiles[0].profileId); ui.card.click();
  ui = rewardUi(rt, profiles[0].profileId);
  const restoreWrite = failNextWrite(storage, "QuotaExceededError"); ui.claim.clickLatest();
  assert.ok(rt.canonical.pendingSpecialMatchReward);
  assert.ok(!rt.canonical.roster.some((entry) => entry.playerId === profiles[0].playerId));
  restoreWrite(); ui.claim.disabled = false; ui.claim.clickLatest();
  const canonical = rt.canonical;
  assert.strictEqual(canonical.pendingSpecialMatchReward, null);
  assert.strictEqual(canonical.roster.filter((entry) => entry.playerId === profiles[0].playerId).length, 1);
  assert.strictEqual(canonical.statistics.actions.filter((action) => action.actionId === "claim-atomic:secondary:reward").length, 1);
}

// Real IE1 S3 1/2 -> 2/2 flow and all three refresh checkpoints.
{
  const run = initialRun({ pending: false }); run.runId = "double-reward"; run.phase = "special-reward";
  const bootstrap = open(run); const runtime = bootstrap.rt.context.SpecialMatchRuntime;
  runtime.complete(bootstrap.rt.seam.getRun(), seasonDb, { specialMatchId: special.specialMatchId, nodeId: "special-node" }, "victory");
  bootstrap.rt.context.RunState.save(bootstrap.rt.seam.getRun());
  let refreshed = bootstrap.rt.reopen();
  let first = refreshed.canonical.pendingSpecialMatchReward;
  assert.strictEqual(first.currentReward, 1); rewardUi(refreshed, first.candidateProfileIds[0]);
  let ui = rewardUi(refreshed, first.candidateProfileIds[0]); ui.card.click(); ui = rewardUi(refreshed, first.candidateProfileIds[0]); ui.claim.clickLatest();
  const second = refreshed.canonical.pendingSpecialMatchReward;
  assert.strictEqual(second.currentReward, 2);
  assert.notStrictEqual(second.actionId, first.actionId);
  assert.notDeepStrictEqual(second.candidateProfileIds, first.candidateProfileIds);
  const selectedPlayer = refreshed.context.ProfiledSeasonRuntime.resolveProfile(seasonDb.seasonId, first.candidateProfileIds[0]).playerId;
  assert.ok(second.excludedPlayerIds.includes(selectedPlayer));
  assert.ok(!second.candidateProfileIds.some((id) => refreshed.context.ProfiledSeasonRuntime.resolveProfile(seasonDb.seasonId, id).playerId === selectedPlayer));
  refreshed = refreshed.reopen();
  assert.strictEqual(refreshed.canonical.pendingSpecialMatchReward.currentReward, 2);
  ui = rewardUi(refreshed, refreshed.canonical.pendingSpecialMatchReward.candidateProfileIds[0]); ui.decline.clickLatest();
  assert.strictEqual(refreshed.canonical.pendingSpecialMatchReward, null);
  assert.ok(refreshed.canonical.claimedSpecialMatchRewardIds.includes(special.specialMatchId));
  assert.strictEqual(refreshed.canonical.phase, "map");
  refreshed = refreshed.reopen();
  assert.strictEqual(refreshed.canonical.pendingSpecialMatchReward, null);
  assert.strictEqual(refreshed.canonical.phase, "map");
}

console.log("special match extraction: entry, view parity, resolution, reward transactions, stale callbacks, IE1 S3 double reward and refresh OK");
