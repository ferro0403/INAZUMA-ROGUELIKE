"use strict";

const assert = require("assert");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
const V2 = require("../js/development-v2.js");
const V3 = require("../js/development-v3.js");
global.DevelopmentV3 = V3;
const Runtime = require("../js/development-runtime.js");
require("../js/game-rules.js");
const Rules = global.RoguelikeRules;
const database = require("../data/FREE_AGENTS_compact.json");
Runtime.registerDatabase("free-agents", database);

const base = database.players.find((player) => player.category === "Forte" && Number(player.finalOverall) === 80);
assert(base, "real Forte 80 fixture required");
const profile = (potential, category) => V3.materializeProfile({ basePlayer: base, targetPotential: potential, category, database, progression });
const snapshot = (materialized) => ({ schemaVersion: 1, profileFormatVersion: V3.PROFILE_FORMAT_VERSION, players: { [base.playerId]: { profile: materialized } } });
const runWith = (materialized) => ({ seasonId: "ie1", developmentV3PlayerSnapshot: snapshot(materialized), developmentPlayerSnapshot: {}, roster: [] });
const entry = (boost = 0) => ({ playerId: String(base.playerId), source: "free_agents", level: 1, levelUnits: 5, potentialBoost: boost, currentOverallBoost: boost, potentialBoostApplications: boost ? [{ amount: boost, appliedLevel: 0, legacy: true }] : [] });
const meta = (run, rosterEntry) => Rules.tradeOutgoingEffectiveMetadata(Runtime.resolveRosterPlayer(run, base, rosterEntry, database));

// Frozen permanent Elite uses potential 85 even when low-level current OVR is lower.
const elite85 = profile(85, "Elite"), run85 = runWith(elite85), lowEntry = entry();
const lowResolved = Runtime.resolveRosterPlayer(run85, base, lowEntry, database), threshold85 = meta(run85, lowEntry);
assert.equal(threshold85.finalOverall, 85); assert(lowResolved.overall < 85); assert.equal(threshold85.position, String(lowResolved.position).toUpperCase());
const candidate80 = { playerId: "candidate-80", position: threshold85.position, finalOverall: 80 };
const candidate85 = { playerId: "candidate-85", position: threshold85.position, finalOverall: 85 };
let candidates = Rules.getTradeCandidates({ outgoingPlayer: threshold85, rosterIds: [base.playerId], freeAgents: [candidate80, candidate85], seasonPlayers: [], unlockedTeamIds: [], teams: [] });
assert.deepStrictEqual(candidates.map((candidate) => candidate.player.playerId), ["candidate-85"]);

// Permanent 85 plus run-local Intensive Training 3 is exactly 88.
const trainedEntry = entry(3), threshold88 = meta(run85, trainedEntry);
assert.equal(threshold88.finalOverall, 88);
const candidate88 = { playerId: "candidate-88", position: threshold88.position, finalOverall: 88 };
candidates = Rules.getTradeCandidates({ outgoingPlayer: threshold88, rosterIds: [base.playerId], freeAgents: [candidate85, candidate88], seasonPlayers: [], unlockedTeamIds: [], teams: [] });
assert.deepStrictEqual(candidates.map((candidate) => candidate.player.playerId), ["candidate-88"], "85 is rejected against 88 while 88 is accepted");

// Final execution uses the same metadata boundary as preview.
const incoming = (player) => ({ player, playerId: player.playerId, source: "free_agents" });
let tradeRun = { seasonId: "ie1", roster: [trainedEntry], lineup: [String(base.playerId)], bench: [], inventory: [] };
let result = Rules.executeProfileAwareTrade(tradeRun, base.playerId, incoming(candidate85), { resolveOutgoingBase: () => threshold88, resolveIncomingCandidate: (player) => player });
assert.equal(result.status, "ineligible"); assert.equal(result.reason, "trade-conditions-changed");
tradeRun = { seasonId: "ie1", roster: [trainedEntry], lineup: [String(base.playerId)], bench: [], inventory: [] };
result = Rules.executeProfileAwareTrade(tradeRun, base.playerId, incoming(candidate88), { resolveOutgoingBase: () => threshold88, resolveIncomingCandidate: (player) => player });
assert.equal(result.status, "acquired");

// Base-only and legacy V2 roster semantics remain BASE + local/snapshotted boost.
const baseOnly = { seasonId: "ie1", roster: [] };
assert.equal(meta(baseOnly, entry(3)).finalOverall, 83);
const legacyRun = { seasonId: "ie1", developmentPlayerSnapshot: { [base.playerId]: { permanentTargetPotential: 85 } }, roster: [] };
const legacyEntry = entry(8); assert.equal(meta(legacyRun, legacyEntry).finalOverall, 88);

// Run freeze: A remains Forte 80 while a later B snapshot sees Elite 85/88.
const runA = runWith(profile(80, "Forte")), runB = runWith(elite85);
assert.equal(meta(runA, entry()).finalOverall, 80); assert.equal(meta(runB, entry()).finalOverall, 85); assert.equal(meta(runB, entry(3)).finalOverall, 88); assert.equal(meta(runA, entry()).finalOverall, 80);

// Incoming Free Agent metadata also comes from the frozen run snapshot.
assert.equal(Runtime.resolveEffectiveMetadata(runB, base, database).finalOverall, 85);

console.log("trade effective runtime V3 potential, training, parity, legacy and freeze tests passed");
