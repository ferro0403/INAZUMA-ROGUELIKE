"use strict";
const assert = require("assert");
const fs = require("fs");
const { createCrashHarness, once } = require("./helpers/crash-harness");

const initial = { runId: "terminal-run", phase: "match", lives: 1, gameOver: false, activeMatch: { matchId: "terminal-match", type: "boss", state: "pre-match" }, developmentRewardPresentation: null, permanentEffectOutbox: [], appliedPermanentEffectIds: [], completedBossIds: ["b1", "b2"], generation: 10 };
const h = createCrashHarness(initial);
const memory = h.fresh(); memory.lives = 0; memory.gameOver = true; assert.throws(() => h.save(memory, "terminal-loss", { fail: true }));
const G0 = h.fresh(); assert.strictEqual(G0.lives, 1); assert.strictEqual(G0.gameOver, false);

let run = h.fresh(); run.lives = 0; run.gameOver = true; run.phase = "gameover"; run.activeMatch.result = "defeat"; run.activeMatch.resolutionApplied = true; h.save(run, "terminal-loss");
const G1 = h.fresh(); assert.strictEqual(G1.lives, 0); assert.strictEqual(G1.phase, "gameover");

run = h.fresh(); const effectId = `${run.runId}:development:end`; run.permanentEffectOutbox.push({ effectId, type: "development", status: "pending" }); h.save(run, "development-enqueued");
const G2 = h.fresh(); assert.strictEqual(G2.permanentEffectOutbox[0].status, "pending");

const permanent = { redeemedRunIds: [] }; once(permanent.redeemedRunIds, run.runId); const G3 = h.fresh(); assert.deepStrictEqual(permanent.redeemedRunIds, [run.runId]); assert.strictEqual(G3.permanentEffectOutbox[0].status, "pending", "marker failure leaves canonical outbox retryable");
run = h.fresh(); run.permanentEffectOutbox[0].status = "applied"; once(run.appliedPermanentEffectIds, effectId); h.save(run, "development-marker");
const G4 = h.fresh(); assert.strictEqual(G4.appliedPermanentEffectIds.filter((id) => id === effectId).length, 1);
run = h.fresh(); run.developmentRewardPresentation = { endReason: "defeat", coins: 40, seen: false }; h.save(run, "presentation-pending");
const G5 = h.fresh(); G5.developmentRewardPresentation.seen = true; assert.strictEqual(permanent.redeemedRunIds.length, 1, "presentation cannot repay");
const G6 = h.fresh(); assert.strictEqual(G6.gameOver, true); assert.strictEqual(G6.phase, "gameover");
for (let i = 0; i < 3; i += 1) { const G7 = h.fresh(); assert.strictEqual(G7.lives, 0); assert.strictEqual(G7.gameOver, true); assert.strictEqual(G7.appliedPermanentEffectIds.length, 1); h.save(G7, `reopen-${i}`); }

const app = fs.readFileSync("js/app.js", "utf8");
assert.match(app, /if \(run\.gameOver \|\| run\.phase === "gameover"\) return renderGameOver\(\)/);
const config = fs.readFileSync("js/season1-config.js", "utf8");
assert.match(config, /maxRunLives:\s*2/); assert.match(config, /startingLives:\s*2/); assert.match(config, /lossPolicy:\s*"return_to_previous_match_node"/);
console.log("gameover-crash-matrix-test: G0-G7 terminal loss and development exactly-once boundaries OK");
