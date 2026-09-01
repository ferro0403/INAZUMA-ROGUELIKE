"use strict";
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");

const navigate = app.slice(app.indexOf("function navigateBossVictoryDestination"), app.indexOf("function bossRewardCandidates"));
assert.match(navigate, /flow\.destination === "finalization-pending"/);
assert.match(navigate, /renderFinalizationPending\(flow\.finalization\)/);
assert.ok(navigate.indexOf('"finalization-pending"') < navigate.indexOf("return null"), "pending finalization is handled before the unknown-destination fallback");

const pending = app.slice(app.indexOf("function renderFinalizationPending"), app.indexOf("function enqueueAlbumRecruit"));
assert.match(pending, /data-finalization-pending/);
assert.match(pending, /retry-run-finalization/);
assert.match(pending, /resumeRunFinalization\(\{ render: false \}\)/);
assert.match(pending, /if \(resumed\.completed\) \{/, "completed finalization proceeds past the pending screen");
assert.match(pending, /endReason: "victory"/, "victory now surfaces the development reward reveal, matching the gameover path");
assert.match(pending, /onComplete: \(\) => renderFinalCelebration/, "celebration is still reached once the reward flow completes");
assert.doesNotMatch(pending, /renderMap\(/);
assert.doesNotMatch(pending, /renderSeasonComplete\(/);

const resume = app.slice(app.indexOf("function resumeRunFinalization"), app.indexOf("function enqueueAlbumRecruit"));
assert.match(resume, /if \(render\) renderFinalizationPending\(result\)/, "fresh Continue renders a recoverable pending state");
console.log("finalization-pending-navigation-test: explicit destination, same-runtime retry, fresh retry UI OK");

const handoff = app.slice(app.indexOf("function finishBossVictoryTransition"), app.indexOf("function devSkipCurrentBoss"));
assert.match(navigate, /flow\.destination === "post-boss-recovery"/);
assert.match(navigate, /renderPostBossRecovery\(\)/);
assert.match(handoff, /canonicalFinalization/);
assert.match(handoff, /hasPendingCanonicalFinalization\(recovered\)/);
assert.match(handoff, /destination: canonicalFinalization \? "finalization-pending" : "post-boss-recovery"/);
assert.doesNotMatch(handoff.split("persistGameplayMutation")[0], /ensurePostBossFlow/);

const classifierSource = app.slice(app.indexOf("function hasPendingCanonicalFinalization"), app.indexOf("function createPostBossCheckpoint"));
const classify = new Function(`${classifierSource}; return hasPendingCanonicalFinalization;`)();
for (const status of ["pending", "hall-written", "development-written"]) {
  assert.strictEqual(classify({ phase: "finalization", finalization: { status } }), true, `${status} remains pending`);
}
assert.strictEqual(classify({ phase: "final-celebration", finalization: { status: "complete" } }), false);
assert.strictEqual(classify({ phase: "final-summary", finalization: { status: "complete" } }), false);
assert.strictEqual(classify({ phase: "match", postBossFlow: { status: "next-zone" } }), false, "ordinary boss recovery is not finalization pending");
