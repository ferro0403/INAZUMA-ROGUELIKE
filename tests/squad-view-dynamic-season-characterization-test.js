"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { globalThis: null, __INAZUMA_TEST_MODE__: true, document: { querySelectorAll: () => [], getElementById: () => null, querySelector: () => null, createElement: () => ({}) } };
context.globalThis = context; vm.createContext(context);
vm.runInContext(fs.readFileSync("js/squad/squad-view.js", "utf8"), context, { filename: "squad-view.js" });
let seasonDb = null; let modalMarkup = ""; let previewDatabase = null;
const run = { seasonId: "season-a", formationId: "A", roster: [{ playerId: "bench" }], lineup: [], bench: ["bench"] };
const ui = { selectedSquadPlayerId: "bench" };
const modalRoot = { querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
const profiledSeasonRuntime = {
  canSwitchRole: () => true,
  resolveOwnedPlayerProfile: () => ({ name: "Bench", roleVariants: [{ roleVariantId: "old", position: "MF" }, { roleVariantId: "new", position: "FW" }] }),
  resolveEffectivePlayerAtLevel: (_entry, options) => { previewDatabase = options.database; return { overall: 77 }; },
  switchBenchRole() {},
};
const view = context.SquadViewRuntime.create({
  getRun: () => run, getUi: () => ui, getSeasonDb: () => seasonDb,
  seasonFormations: () => seasonDb?.formations?.eleven || [],
  controller: { canUseFormation: () => true, validitySummary: () => ({ starters: 0, bench: 1 }), changeFormation() {}, swapPlayers() {} },
  formationById: id => seasonDb?.formations?.eleven?.find(item => item.id === id), effectiveRosterRole: () => "MF",
  rosterEntry: () => ({ playerId: "bench", activeRoleVariantId: "old" }), sourcePlayer: () => ({}), resolvedRosterPlayer: () => ({ name: "Bench", position: "MF" }),
  compactPlayerCardMarkup: () => "", escapeHtml: value => String(value ?? ""), tacticSummary: id => ({ name: `Tactic ${id}`, description: "", modifiers: {} }), tacticLabels: {},
  formationLayout: { displayRows: () => [] },
  openModal: html => { modalMarkup = html; }, closeModal() {}, modalRoot, scrollSnapshot: () => ({}), toast() {}, runKeepingScroll: fn => fn(),
  app: {}, topbar: () => "", bottomNav: () => "", resetRenderedViewScroll() {}, bindSectionRootNav() {}, bindBottomNav() {}, showPlayerDetails() {}, resumePostBossFlowOrMap() {},
  profiledSeasonRuntime, persistGameplayMutation() {}, fiveVFive: { removeUnavailable() {} }, cssEscape: value => value,
});
// A: create before the asynchronous season load, then consume the newly loaded formations.
seasonDb = { seasonId: "season-a", formations: { eleven: [{ id: "A", name: "Modulo A" }] }, players: [{ playerId: "a" }] };
view.openFormationSelector();
assert.match(modalMarkup, /Modulo A/); assert.doesNotMatch(modalMarkup, /Modulo B/);
// B: the same view must resolve a replacement season dynamically, not retain Season A.
seasonDb = { seasonId: "season-b", formations: { eleven: [{ id: "B", name: "Modulo B" }] }, players: [{ playerId: "b" }] };
run.seasonId = "season-b"; run.formationId = "B"; view.openFormationSelector();
assert.match(modalMarkup, /Modulo B/); assert.doesNotMatch(modalMarkup, /Modulo A/);
// C: role previews receive the exact, complete, current database object.
view.openRoleSwitch(); assert.strictEqual(previewDatabase, seasonDb);
console.log("squad view dynamic season: delayed load, season switch and current role database OK");
