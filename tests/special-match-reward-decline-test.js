"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "js", "special-match.js"), "utf8");
const sandbox = { globalThis: {} };
vm.runInNewContext(runtimeSource, sandbox, { filename: "special-match.js" });
const runtime = sandbox.globalThis.SpecialMatchRuntime;
assert(runtime && typeof runtime.decline === "function", "SpecialMatchRuntime.decline must exist");

const pending = {
  specialMatchId: "special_alpine_ie2",
  selectedProfileId: "1166@alpine_ie2",
  status: "pending",
};
const run = {
  pendingSpecialMatchReward: pending,
  claimedSpecialMatchRewardIds: [],
  roster: [{ playerId: "1", activeProfileId: "1@raimon_inazuma_eleven_2" }],
  bench: ["1"],
};
const rosterBefore = JSON.stringify(run.roster);
const benchBefore = JSON.stringify(run.bench);

const first = runtime.decline(run, pending);
assert.strictEqual(first.status, "declined");
assert.strictEqual(run.pendingSpecialMatchReward, null);
assert.deepStrictEqual(run.claimedSpecialMatchRewardIds, ["special_alpine_ie2"]);
assert.strictEqual(JSON.stringify(run.roster), rosterBefore, "Decline must not change roster");
assert.strictEqual(JSON.stringify(run.bench), benchBefore, "Decline must not change bench");

const second = runtime.decline(run, pending);
assert.strictEqual(second.status, "already-resolved");
assert.deepStrictEqual(run.claimedSpecialMatchRewardIds, ["special_alpine_ie2"], "Decline must be idempotent");

const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
assert(appSource.includes('id="decline-special-reward"'), "Special reward modal must expose decline action");
assert(appSource.includes('>RIFIUTA</button>'), "Decline action must be labeled RIFIUTA");
assert(appSource.includes('SpecialMatchRuntime.decline(run, pending)'), "UI must use runtime decline helper");
assert(appSource.includes('id="claim-special-reward"'), "Existing claim action must remain available");
assert(appSource.includes('global.RunState.save(run);\n    if (action.toast)'), "Special reward flow must save the live run before opening the reward modal");

const bridgeSource = fs.readFileSync(path.join(root, "js", "special-reward-ui-bridge.js"), "utf8");
assert(bridgeSource.includes('bench-replacement-modal'), "Full-roster replacement modal must be handled");
assert(bridgeSource.includes('button.textContent = "RIFIUTA"'), "Full-roster replacement modal must expose RIFIUTA");
assert(bridgeSource.includes('SpecialMatchRuntime?.decline?.'), "Full-roster decline must resolve through SpecialMatchRuntime.decline");
assert(bridgeSource.includes('__specialRewardLiveRunCapture'), "Bridge must capture the live app run through RunState.save");
assert(bridgeSource.includes("#app [data-nav='map']"), "Full-roster decline must use the app's existing map navigation");
assert(!bridgeSource.includes('location.reload('), "Full-roster decline must not hard reload the app");
assert(!bridgeSource.includes('sessionStorage'), "Full-roster decline must not require reload-resume session state");

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(indexSource.includes('js/special-reward-ui-bridge.js'), "Special reward UI bridge must be loaded by index.html");

console.log("special-match-reward-decline-test: OK");
