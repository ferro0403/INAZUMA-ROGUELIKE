"use strict";
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const controller = fs.readFileSync("js/boss/boss-flow-controller.js", "utf8");

const navigate = controller.slice(controller.indexOf("function navigate(flow)"), controller.indexOf("function resume()"));
assert.match(navigate, /flow\.destination === "finalization-pending"/);
assert.match(navigate, /deps\.renderFinalizationPending\(flow\.finalization\)/);
assert.ok(navigate.indexOf('"finalization-pending"') < navigate.indexOf("return null"), "pending finalization is handled before the unknown-destination fallback");

const finalizationSource = fs.readFileSync("js/finalization/finalization-controller.js", "utf8");
const finalizationView = fs.readFileSync("js/finalization/finalization-view.js", "utf8");
const pending = finalizationSource + finalizationView;
assert.match(pending, /data-finalization-pending/);
assert.match(pending, /retry-run-finalization/);
assert.match(pending, /resume\(\{ render: false \}\)/);
assert.match(pending, /if \(resumed\.completed\)/, "completed finalization proceeds past the pending screen");
assert.match(pending, /endReason: "victory"/, "victory now surfaces the development reward reveal, matching the gameover path");
assert.match(pending, /onComplete: \(\) => renderCelebration/, "celebration is still reached once the reward flow completes");
assert.doesNotMatch(pending, /renderMap\(/);
assert.doesNotMatch(pending, /renderSeasonComplete\(/);

const resume = finalizationSource;
assert.match(resume, /if \(render\) renderPending\(result\)/, "fresh Continue renders a recoverable pending state");
console.log("finalization-pending-navigation-test: explicit destination, same-runtime retry, fresh retry UI OK");

const handoff = controller.slice(controller.indexOf("function finishTransition"), controller.indexOf("return Object.freeze"));
assert.match(navigate, /flow\.destination === "post-boss-recovery"/);
assert.match(navigate, /renderRecovery\(\)/);
assert.match(handoff, /failedHandoffDestination\(committed\)/);
const wiring = app.slice(app.indexOf("failedHandoffDestination:"), app.indexOf("finishFinalization:"));
assert.match(wiring, /destination: final \? "finalization-pending" : "post-boss-recovery"/);
assert.doesNotMatch(handoff.split("persistGameplayMutation")[0], /ensurePostBossFlow/);
for (const status of ["pending", "hall-written", "development-written"]) assert.ok(wiring.includes(`"${status}"`), `${status} remains pending`);
