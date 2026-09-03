"use strict";

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("js/match/match-presentation.js", "utf8");
assert(!/RunState\.save|GameplayPersistence|Firebase|Firestore|CloudSave|CloudRestore/.test(source), "presentation runtime must not own persistence/cloud");

const context = {
  console,
  Map,
  Set,
  Math,
  Number,
  String,
  Object,
  Array,
  ProfiledSeasonRuntime: { resolveProfile: () => null },
  InazumaProgression: { getPlayerAtLevel: (player, level) => ({ ...player, level, overall: Number(player.finalOverall || player.overall || 0) + level }) },
  SeasonRegistry: { sourceForSeason: (id) => id },
  FormationLayout: {
    displayRows: () => [
      { role: "FW", count: 1 },
      { role: "MF", count: 1 },
      { role: "DF", count: 1 },
      { role: "GK", count: 1 },
    ],
  },
  MatchSimulator: {
    formationTactic: () => ({ name: "Equilibrato", description: "Test", modifiers: { attack: 0.1, defense: -0.05 } }),
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "match-presentation.js" });

let run = {
  seasonId: "ie1",
  lineup: ["1", "2"],
  formationId: "4-3-3",
  teamLevel: 7,
  teamIdentity: { name: "Raimon" },
  bossIndex: 2,
};
let ui = { bossMatchLog: [], bossMatchState: "pre-match", bossMatchTab: "user" };
let seasonDb = { bossOrder: [{}, {}, {}] };
let players = new Map([
  ["1", { playerId: "1", name: "Axel Blaze", position: "FW", overall: 70, finalOverall: 70 }],
  ["2", { playerId: "2", name: "Mark Evans", position: "GK", overall: 68, finalOverall: 68 }],
]);
let teams = new Map([["boss", { teamId: "boss", logoUrl: "boss.png" }]]);
const roster = new Map([["1", { playerId: "1", equippedItem: { id: "boots" } }]]);

const documentRef = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const modalRoot = { querySelectorAll() { return []; } };
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const runtime = context.MatchPresentationRuntime.create({
  getRun: () => run,
  getUi: () => ui,
  getSeasonDb: () => seasonDb,
  getSeasonPlayersById: () => players,
  getSeasonTeamsById: () => teams,
  isProfileAwareSeason: () => false,
  formationById: () => ({ id: "4-3-3" }),
  resolvedRosterPlayer: (id) => players.get(String(id)),
  rosterEntry: (id) => roster.get(String(id)) || null,
  compactPlayerCardMarkup: (player, options) => `${player.name}|${options.level}|${options.overall}|${options.equipment?.id || "none"}|${options.dataAttr}`,
  normalizeTeamIdentity: (identity) => identity || {},
  escapeHtml,
  matchEventSideClass: (side) => `side-${side}`,
  openModal() {},
  closeModal() {},
  scrollSnapshot: () => ({ top: 12 }),
  showPlayerDetailsFor() {},
  bossNodeIconMarkup: () => "BOSS",
  modalRoot,
  document: documentRef,
});

assert.strictEqual(runtime.shortName("Axel Blaze"), "A. Blaze");
assert.strictEqual(runtime.teamById("boss").logoUrl, "boss.png");
assert.deepStrictEqual(Array.from(runtime.userTeamPlayers(), (player) => player.playerId), ["1", "2"]);

const bossPlayers = runtime.bossTeamPlayers({ bossLevel: 3, startingXIPlayerIds: ["1", "2"] });
assert.strictEqual(bossPlayers.length, 2);
assert.strictEqual(bossPlayers[0].displayLevel, 3);
assert.strictEqual(bossPlayers[0].source, "ie1");

const meta = runtime.bossMatchTeamMeta({ teamId: "boss", teamName: "Royal", bossFormation: "4-4-2", bossLevel: 15 });
assert.strictEqual(meta.user.name, "Raimon");
assert.strictEqual(meta.boss.name, "Royal");
assert.strictEqual(meta.boss.logoUrl, "boss.png");
assert.strictEqual(runtime.bossMatchAverage([{ overall: 70 }, { overall: 72 }]), 71);

const rows = runtime.formationRows("4-3-3", [
  { playerId: "f", position: "FW" },
  { playerId: "m", position: "MF" },
  { playerId: "d", position: "DF" },
  { playerId: "g", position: "GK" },
]);
assert.deepStrictEqual(Array.from(rows, (row) => row.role), ["FW", "MF", "DF", "GK"]);

const tactic = runtime.tacticPanelMarkup("4-3-3", { strength: { averageOverall: 70, final: 75 }, probability: 61 });
assert(tactic.includes("Attacco +10%"));
assert(tactic.includes("Difesa -5%"));
assert(tactic.includes("Probabilità <strong>61%</strong>"));

const card = runtime.matchFormationCard({ playerId: "1", name: "Axel Blaze", displayLevel: 4, overall: 74 }, { side: "user", showEquipment: true });
assert(card.includes("Axel Blaze|4|74|boots"));
assert(card.includes('data-boss-player="1"'));

const field = runtime.renderMatchFormation({
  players: [{ playerId: "1", name: "Axel Blaze", position: "FW", overall: 74, displayLevel: 4 }],
  formationId: "4-3-3",
  side: "boss",
  hidden: true,
});
assert(field.includes('data-boss-team="boss"'));
assert(field.includes(" hidden"));

assert(runtime.bossMatchTimeline().includes("Formazioni pronte"));
ui.bossMatchLog = [{ minute: 12, icon: "⚽", text: "Gol", side: "user" }];
assert(runtime.bossMatchTimeline().includes("side-user"));
assert.strictEqual(runtime.bossMatchStatusText(), "Pre-partita");
ui.bossMatchState = "completed-victory";
assert.strictEqual(runtime.bossMatchStatusText(), "Vittoria completata");

// Dynamic getters: replacing runtime state after construction must be observed immediately.
run = { ...run, lineup: ["2"], teamIdentity: { name: "Zeus" } };
teams = new Map([["boss", { teamId: "boss", logoUrl: "new-boss.png" }]]);
assert.deepStrictEqual(Array.from(runtime.userTeamPlayers(), (player) => player.playerId), ["2"]);
assert.strictEqual(runtime.bossMatchTeamMeta({ teamId: "boss" }).user.name, "Zeus");
assert.strictEqual(runtime.teamById("boss").logoUrl, "new-boss.png");

console.log("match presentation domain test: PASS");
