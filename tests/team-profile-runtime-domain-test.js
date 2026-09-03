"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/profile/team-profile-runtime.js", "utf8");
assert(source.includes("global.TeamProfileRuntime"));
assert(!source.includes("RunState.save("), "team profile runtime must not save gameplay run state");
assert(!/RunStorage|Firebase|Firestore|CloudSave|CloudRestore/.test(source), "team profile runtime must not own run/cloud persistence");
assert(source.includes("saveProfileTeamIdentity"));
assert(source.includes("Team name edit changed run progress"));
assert(source.includes("default-lightning"));

let profile = { teamIdentity: null };
let saved = [];
let currentRun = { teamIdentity: { name: "Legacy Eleven" }, roster: ["p1"], lineup: ["p1"], bench: [], bossIndex: 2, currentZone: { id: "z" } };
let writesAllowed = false;

const context = {
  console,
  globalThis: null,
  document: {},
  matchMedia: () => ({ matches: false }),
  SeasonRegistry: {
    get(id) { return id === "ie1" ? { name: "Inazuma Eleven 1" } : null; },
  },
  RunState: {
    normalizeTeamIdentity(identity) { return { name: String(identity.name || "").trim(), emblemId: identity.emblemId || "default-lightning" }; },
    loadProfile() { return profile; },
    validTeamName(value) { return String(value || "").trim(); },
    saveProfileTeamIdentity(identity) { saved.push(identity); profile = { ...profile, teamIdentity: { ...identity } }; return profile.teamIdentity; },
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "team-profile-runtime.js" });

const runtime = context.TeamProfileRuntime.create({
  getRun: () => currentRun,
  persistenceWritesAllowed: () => writesAllowed,
  openModal() {},
  closeModal() {},
  renderSettings() {},
  startRunWithIdentity() {},
  escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); },
  inazumaLogoMarkup(className) { return `<logo class="${className}"></logo>`; },
});

assert.deepStrictEqual(JSON.parse(JSON.stringify(runtime.validateTeamName("  Raimon  "))), { valid: true, name: "Raimon" });
assert.strictEqual(runtime.validateTeamName("").valid, false);
assert.strictEqual(runtime.validateTeamName("A").valid, false);
assert.strictEqual(runtime.validateTeamName("A".repeat(25)).valid, false);
assert.strictEqual(runtime.validateTeamName("Bad!Name").valid, false);
assert.strictEqual(runtime.validateTeamName("Royal Academy-1").valid, true);

assert.strictEqual(runtime.seasonDisplayName("ie1"), "Inazuma Eleven 1");
assert.strictEqual(runtime.seasonDisplayName("unknown", "Fallback"), "Fallback");
assert.strictEqual(runtime.normalizedHallSeasonName({ seasonId: "ie1" }), "Inazuma Eleven 1");
assert.strictEqual(runtime.normalizedHallSeasonName({ modeId: "unknown", modeName: "Legacy Mode" }), "Legacy Mode");

const blockedMigration = runtime.migrateTeamIdentityProfile();
assert.deepStrictEqual(JSON.parse(JSON.stringify(blockedMigration)), { name: "Legacy Eleven", emblemId: "default-lightning" });
assert.strictEqual(saved.length, 0, "blocked persistence must not write profile identity");

writesAllowed = true;
const persistedMigration = runtime.migrateTeamIdentityProfile();
assert.deepStrictEqual(JSON.parse(JSON.stringify(persistedMigration)), { name: "Legacy Eleven", emblemId: "default-lightning" });
assert.strictEqual(saved.length, 1);
assert.deepStrictEqual(saved[0], { name: "Legacy Eleven", emblemId: "default-lightning" });
assert.deepStrictEqual(JSON.parse(JSON.stringify(runtime.savedTeamIdentity())), { name: "Legacy Eleven", emblemId: "default-lightning" });

profile = { teamIdentity: { name: "<Raimon>", emblemId: "x" } };
const summary = runtime.savedTeamSummaryMarkup();
assert(summary.includes("Profilo squadra"));
assert(summary.includes("&lt;Raimon&gt;"));
assert(summary.includes("inazuma-logo--small"));

currentRun = null;
profile = { teamIdentity: null };
assert.strictEqual(runtime.migrateTeamIdentityProfile(), null);
assert.strictEqual(runtime.savedTeamSummaryMarkup(), "");

console.log("team-profile-runtime-domain-test: PASS");
