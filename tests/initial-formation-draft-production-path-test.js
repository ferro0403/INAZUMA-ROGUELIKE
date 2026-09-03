"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load, PRODUCTION_MODULES } = require("./helpers/production-runtime");

assert(PRODUCTION_MODULES.indexOf("run-entry/initial-draft-view.js") < PRODUCTION_MODULES.indexOf("app.js"));
assert(PRODUCTION_MODULES.indexOf("run-entry/initial-draft-controller.js") < PRODUCTION_MODULES.indexOf("app.js"));

const formation = { id: "mini", name: "Mini", requirements: { GK: 1, DF: 1, MF: 1, FW: 1 }, slotRoles: ["GK", "DF", "MF", "FW"] };
const players = ["GK", "DF", "MF", "FW"].flatMap((position) => [1, 2, 3].map((n) => ({ playerId: `${position}-${n}`, name: `${position} ${n}`, position, category: "Normale", overall: 50 + n, finalOverall: 60 + n, stats: {}, source: "free_agents" })));
const seasonDb = { seasonId: "ie1", formations: { eleven: [formation] }, draftConfig: { freeAgentsOnly: true }, players: [], teams: [], bossOrder: [] };
const freeAgentsDb = { players };
const run = { saveVersion: 2, runId: "initial-draft-production", seasonId: "ie1", phase: "formation", teamIdentity: { name: "Draft" }, lives: 2, bossIndex: 0, roster: [], lineup: [], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], statistics: {}, activeMatch: null };
const storage = new BudgetStorage(1_000_000);
const runtime = load(storage, { fullRuntime: true, run, seasonId: "ie1", seasonDb, contextOverrides: {
  SeasonRegistry: { DEFAULT_SEASON_ID: "ie1", normalizeSeasonId: id => id || "ie1", activeId: () => "ie1", list: () => [{ id: "ie1" }], database: () => seasonDb, get: id => ({ id, name: id }), sourceForSeason: id => id, isSeasonSource: source => source === "ie1", setActive: id => ({ id }), loadDatabase: async () => seasonDb, player: () => null, playersIndex: () => new Map(), teamsIndex: () => new Map() },
  FiveVFive: { ensure: current => (current.fiveVFive ||= { formation: "diamond", assignments: {} }), formationById: id => ({ id: id || "diamond", slots: [] }), validate: () => ({ valid: true, messages: [], assignedCount: 0 }), assign: () => true },
} });
vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), runtime.context, { filename: "draft.js" });
runtime.context.RunStatistics.ACTIONS.PLAYER_RECRUITED = "PLAYER_RECRUITED";
const seam = runtime.context.__INAZUMA_INITIAL_DRAFT_TEST__;
seam.setContext({ run: runtime.canonical, seasonDb, freeAgentsDb });

const pureBefore = JSON.stringify(seam.getRun());
seam.renderFormationChoice();
assert(runtime.query(".formation-choice-screen"));
assert(runtime.query('[data-formation="mini"]'));
assert.strictEqual(JSON.stringify(seam.getRun()), pureBefore, "formation render is pure when already in formation");
runtime.query('[data-formation="mini"]').click();
assert.strictEqual(runtime.canonical.phase, "draft");
assert.strictEqual(runtime.canonical.formationId, "mini");
assert.strictEqual(runtime.canonical.draft.step, 0);
assert.strictEqual(runtime.canonical.draft.candidates.length, 3);
assert(runtime.query(".initial-draft-screen"));

const firstCandidate = runtime.canonical.draft.candidates[0];
runtime.query(`[data-player-id="${firstCandidate}"]`).click();
assert.strictEqual(runtime.canonical.phase, "draft");
assert.strictEqual(runtime.canonical.draft.step, 1);
assert.strictEqual(runtime.canonical.roster.length, 0, "DraftEngine materializes the roster only at completion");

while (runtime.canonical.phase === "draft") {
  const candidate = runtime.canonical.draft.candidates[0];
  runtime.query(`[data-player-id="${candidate}"]`).click();
}
assert.strictEqual(runtime.canonical.phase, "squad");
assert.strictEqual(runtime.canonical.roster.length, 4);
assert(runtime.canonical.fiveVFive);
for (const entry of runtime.canonical.roster) {
  assert(entry.firstJoinedAt);
  assert.strictEqual(entry.recruitmentSource, "initial_draft");
  assert.strictEqual(entry.recruitedAtLevel, 0);
  assert.notStrictEqual(entry.recruitedOverall, undefined);
}
assert(runtime.query(".squad-screen"));

const reopened = runtime.reopen({ seasonDb, contextOverrides: runtime.contextOverrides });
assert.strictEqual(reopened.canonical.phase, "squad", "completed draft reopens in Squad");

// Pool parity, including numeric/string identity and both legacy validation failures.
seam.setContext({ run: seam.getRun(), seasonDb, freeAgentsDb: { players: [{ playerId: 7, position: "GK", source: "free_agents" }] } });
assert.strictEqual(seam.players()[0].playerId, 7);
seam.setContext({ freeAgentsDb: { players: [{ playerId: "bad-profile", profileId: "p", source: "free_agents" }] } });
assert.throws(() => seam.players(), /Draft corrotto: candidato bad-profile/);
seam.setContext({ freeAgentsDb: { players: [{ playerId: "bad-season", source: "ie1" }] } });
assert.throws(() => seam.players(), /Draft corrotto: candidato bad-season/);
seam.setContext({ freeAgentsDb: {} });
assert.throws(() => seam.players(), /Draft ie1: database svincolati non disponibile/);

console.log("initial formation/draft production path: ok");

function failureRuntime(phase = "formation") {
  const failureStorage = new BudgetStorage(1_000_000);
  const nextRun = { ...structuredClone(run), runId: `failure-${phase}`, phase, draft: undefined, roster: [], lineup: [], bench: [], fiveVFive: undefined };
  const value = load(failureStorage, { fullRuntime: true, run: nextRun, seasonId: "ie1", seasonDb, contextOverrides: {
    SeasonRegistry: { DEFAULT_SEASON_ID: "ie1", normalizeSeasonId: id => id || "ie1", activeId: () => "ie1", list: () => [{ id: "ie1" }], database: () => seasonDb, get: id => ({ id, name: id }), sourceForSeason: id => id, isSeasonSource: source => source === "ie1", setActive: id => ({ id }), loadDatabase: async () => seasonDb, player: () => null, playersIndex: () => new Map(), teamsIndex: () => new Map() },
    FiveVFive: { ensure: current => (current.fiveVFive ||= { formation: "diamond", assignments: {} }), formationById: id => ({ id: id || "diamond", slots: [] }), validate: () => ({ valid: true, messages: [], assignedCount: 0 }), assign: () => true },
  } });
  vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), value.context, { filename: "draft.js" });
  value.context.RunStatistics.ACTIONS.PLAYER_RECRUITED = "PLAYER_RECRUITED";
  value.context.__INAZUMA_INITIAL_DRAFT_TEST__.setContext({ run: value.canonical, seasonDb, freeAgentsDb });
  return value;
}

function failNextSave(runtimeValue) {
  const original = runtimeValue.context.RunState.save;
  let failed = false;
  runtimeValue.context.RunState.save = (...args) => {
    if (!failed) { failed = true; throw new Error("injected initial draft persistence failure"); }
    return original(...args);
  };
  return () => { runtimeValue.context.RunState.save = original; };
}

const phaseFailure = failureRuntime("squad");
phaseFailure.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
const restorePhaseSave = failNextSave(phaseFailure);
phaseFailure.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderFormationChoice();
assert.strictEqual(phaseFailure.canonical.phase, "squad");
assert(!phaseFailure.query(".formation-choice-screen"), "failed formation entry follows the Home failure route");
restorePhaseSave();
phaseFailure.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderFormationChoice();
assert.strictEqual(phaseFailure.canonical.phase, "formation", "formation entry retries against canonical state");

const startFailure = failureRuntime();
startFailure.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderFormationChoice();
const restoreStartSave = failNextSave(startFailure);
startFailure.query('[data-formation="mini"]').click();
assert.strictEqual(startFailure.canonical.phase, "formation");
assert.strictEqual(startFailure.canonical.draft, undefined);
assert(startFailure.query(".formation-choice-screen"));
restoreStartSave();
startFailure.query('[data-formation="mini"]').click();
assert.strictEqual(startFailure.canonical.phase, "draft", "same logical formation selection retries");

const pickFailure = failureRuntime();
pickFailure.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderFormationChoice();
pickFailure.query('[data-formation="mini"]').click();
const failedCandidate = pickFailure.canonical.draft.candidates[0];
const restorePickSave = failNextSave(pickFailure);
pickFailure.query(`[data-player-id="${failedCandidate}"]`).click();
assert.strictEqual(pickFailure.canonical.draft.step, 0);
assert.deepStrictEqual(pickFailure.canonical.roster, []);
assert(pickFailure.query(".initial-draft-screen"));
restorePickSave();
pickFailure.query(`[data-player-id="${failedCandidate}"]`).click();
assert.strictEqual(pickFailure.canonical.draft.step, 1, "failed intermediate pick retries once");
while (pickFailure.canonical.draft.step < pickFailure.canonical.draft.roles.length - 1) {
  pickFailure.query(`[data-player-id="${pickFailure.canonical.draft.candidates[0]}"]`).click();
}
const lastStep = pickFailure.canonical.draft.step;
const lastCandidate = pickFailure.canonical.draft.candidates[0];
const restoreFinalSave = failNextSave(pickFailure);
pickFailure.query(`[data-player-id="${lastCandidate}"]`).click();
assert.strictEqual(pickFailure.canonical.phase, "draft");
assert.strictEqual(pickFailure.canonical.draft.step, lastStep);
assert.strictEqual(pickFailure.canonical.roster.length, 0);
assert.strictEqual(pickFailure.canonical.fiveVFive, undefined);
restoreFinalSave();
pickFailure.query(`[data-player-id="${lastCandidate}"]`).click();
assert.strictEqual(pickFailure.canonical.phase, "squad");
assert.strictEqual(pickFailure.canonical.roster.length, 4);

const profileRuntime = failureRuntime();
const profiledSeason = { ...seasonDb, requiresProfileAwareRuntime: true, recruitmentPool: { entries: [{}] } };
let effectiveCalls = 0;
let eligibleCalls = 0;
const profiledCandidates = [{ playerId: "eligible" }];
profileRuntime.context.SeasonRegistry.database = () => profiledSeason;
profileRuntime.context.RecruitmentPoolRuntime.effectiveProfiledPlayers = () => { effectiveCalls += 1; return [{ playerId: "raw" }]; };
profileRuntime.context.RecruitmentPoolRuntime.eligibleInitialDraftPlayers = () => { eligibleCalls += 1; return profiledCandidates; };
profileRuntime.context.__INAZUMA_INITIAL_DRAFT_TEST__.setContext({ seasonDb: profiledSeason, freeAgentsDb });
assert.strictEqual(profileRuntime.context.__INAZUMA_INITIAL_DRAFT_TEST__.players(), profiledCandidates);
assert.strictEqual(effectiveCalls, 1);
assert.strictEqual(eligibleCalls, 1);

console.log("initial formation/draft failure and pool production paths: ok");

const reopenDraft = failureRuntime();
reopenDraft.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderFormationChoice();
reopenDraft.query('[data-formation="mini"]').click();
const startSnapshot = structuredClone(reopenDraft.canonical.draft);
const reopenedAtStart = reopenDraft.reopen({ seasonDb });
vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), reopenedAtStart.context, { filename: "draft.js" });
reopenedAtStart.context.RunStatistics.ACTIONS.PLAYER_RECRUITED = "PLAYER_RECRUITED";
assert.strictEqual(reopenedAtStart.canonical.phase, "draft");
assert.deepStrictEqual(reopenedAtStart.canonical.draft, startSnapshot);
reopenedAtStart.context.__INAZUMA_INITIAL_DRAFT_TEST__.setContext({ run: reopenedAtStart.canonical, seasonDb, freeAgentsDb });
reopenedAtStart.context.__INAZUMA_INITIAL_DRAFT_TEST__.renderDraft();
const mountedCandidate = reopenedAtStart.query(`[data-player-id="${reopenedAtStart.canonical.draft.candidates[0]}"]`);
mountedCandidate.click();
mountedCandidate.click();
assert.strictEqual(reopenedAtStart.canonical.draft.step, 1, "same mounted candidate double click advances one logical step");
const midSnapshot = structuredClone(reopenedAtStart.canonical.draft);
const reopenedMid = reopenedAtStart.reopen({ seasonDb });
assert.strictEqual(reopenedMid.canonical.phase, "draft");
assert.deepStrictEqual(reopenedMid.canonical.draft, midSnapshot);
console.log("initial formation/draft reopen and double-click production paths: ok");
