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
const matchSource = fs.readFileSync(path.join(root, "js", "match", "match-controller.js"), "utf8");
const rewardSource = fs.readFileSync(path.join(root, "js", "special-match", "special-match-reward-controller.js"), "utf8");
const rewardViewSource = fs.readFileSync(path.join(root, "js", "special-match", "special-match-reward-view.js"), "utf8");
assert(rewardViewSource.includes('id="decline-special-reward"'), "Special reward modal must expose decline action");
assert(rewardViewSource.includes('>RIFIUTA</button>'), "Decline action must be labeled RIFIUTA");
assert(rewardSource.includes('SpecialMatchRuntime.decline(current, assertCurrent(current, expected), deps.getSeasonDb())'), "UI must use runtime decline helper on transaction-owned state");
assert(rewardViewSource.includes('id="claim-special-reward"'), "Existing claim action must remain available");
assert(matchSource.includes('commitMatchMutation("match-post-navigation"'), "Special reward handoff must use the durable post-match transaction");

const bridgeSource = fs.readFileSync(path.join(root, "js", "special-reward-ui-bridge.js"), "utf8");
assert(bridgeSource.includes('bench-replacement-modal'), "Full-roster replacement modal may be styled");
assert(bridgeSource.includes('button.textContent = "RIFIUTA"'), "Native full-roster cancel may be relabeled RIFIUTA");
assert(!bridgeSource.includes('SpecialMatchRuntime?.decline?.'), "Bridge must not resolve full-roster decline");
assert(!bridgeSource.includes('phase = "map"'), "Bridge must not force map navigation");
assert(!bridgeSource.includes('returnToMapWithoutReload'), "Bridge must not own replacement navigation");
assert(bridgeSource.includes('__specialRewardLiveRunCapture'), "Bridge must capture the live app run through RunState.save");
assert(!bridgeSource.includes('location.reload('), "Full-roster decline must not hard reload the app");
assert(!bridgeSource.includes('sessionStorage'), "Full-roster decline must not require reload-resume session state");

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(indexSource.includes('js/special-reward-ui-bridge.js'), "Special reward UI bridge must be loaded by index.html");
const runtimeIndex = indexSource.indexOf('js/special-match.js');
const controllerIndex = indexSource.indexOf('js/special-match/special-match-controller.js');
const rewardIndex = indexSource.indexOf('js/special-match/special-match-reward-controller.js');
const appIndex = indexSource.indexOf('js/app.js');
assert(runtimeIndex >= 0 && runtimeIndex < controllerIndex && controllerIndex < rewardIndex && rewardIndex < appIndex, "Special runtime, extracted controllers, and app must preserve dependency load order");

console.log("special-match-reward-decline-test: OK");
