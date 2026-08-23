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
assert.match(pending, /if \(resumed\.completed\) return renderFinalCelebration/);
assert.doesNotMatch(pending, /renderMap\(/);
assert.doesNotMatch(pending, /renderSeasonComplete\(/);

const resume = app.slice(app.indexOf("function resumeRunFinalization"), app.indexOf("function enqueueAlbumRecruit"));
assert.match(resume, /if \(render\) renderFinalizationPending\(result\)/, "fresh Continue renders a recoverable pending state");
console.log("finalization-pending-navigation-test: explicit destination, same-runtime retry, fresh retry UI OK");

const handoff = app.slice(app.indexOf("function finishBossVictoryTransition"), app.indexOf("function devSkipCurrentBoss"));
assert.match(navigate, /flow\.destination === "post-boss-recovery"/);
assert.match(navigate, /renderPostBossRecovery\(\)/);
assert.match(handoff, /canonicalFinalization/);
assert.match(handoff, /destination: canonicalFinalization \? "finalization-pending" : "post-boss-recovery"/);
assert.doesNotMatch(handoff.split("persistGameplayMutation")[0], /ensurePostBossFlow/);
