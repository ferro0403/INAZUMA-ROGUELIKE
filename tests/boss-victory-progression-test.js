"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

assert(appJs.includes("function finalizeBossVictoryTransition(options = {})"), "boss victory finalization must be centralized in an idempotent helper");
assert(appJs.includes("run.pendingBossVictory = { bossIndex") && appJs.includes("rewardsRemaining: 2"), "boss wins must persist an explicit pending reward/transition state");
assert(appJs.includes("function resumePostBossFlowOrMap()") && appJs.includes("return resumePostBossFlowOrMap();"), "map navigation must resume post-boss flow instead of opening the stale map");
assert(appJs.includes('if (match.type === "boss" && match.result === "victory")') && appJs.includes("navigateBossVictoryDestination(flow)"), "Continue after a boss win must reuse the central transition helper");
assert(appJs.includes("const remaining = Math.max(0, Number(pending.rewardsRemaining ?? pending.remainingRewards ?? 2))") && appJs.includes("flow.remainingRewards = Math.max(0, Math.min(2, Number(flow.remainingRewards ?? flow.rewardsRemaining ?? 2)))") && appJs.includes("flow.remainingRewards = Math.max(0, Number(flow.remainingRewards || 0) - 1)"), "boss rewards must be resumed from pending state and persisted through run.postBossFlow");
assert(appJs.includes("if (run.bossIndex <= bossIndex) run.bossIndex = bossIndex + 1"), "boss advancement must be idempotent and avoid double-incrementing");
assert(appJs.includes("if (run.bossIndex >= seasonDb.bossOrder.length)") && appJs.includes('destination: "season-complete"'), "last boss must route to season completion without generating an out-of-range map");
assert(!/function continueAfterMatch[\s\S]*?if \(action\.type === "boss-rewards"\) return startBossRewards\(\);/.test(appJs), "boss reward transition must not remain exclusively wired to the Continue action object");

console.log("boss victory progression regression checks passed");
