"use strict";
const assert = require("assert"), fs = require("fs");
const files = ["real-final-boss-production-path-test.js", "real-orion-gameover-production-path-test.js", "real-latest-season-boss5-production-path-test.js", "real-finalization-quota-matrix-test.js"];
const forbidden = ["BossGameOverRuntime.applyBossResolutionMutation(", "BossGameOverRuntime.applyBossVictoryHandoffMutation(", "function productionGameOver", "developmentEndProcessed=true", "source.replace("];
for (const file of files) { const source = fs.readFileSync(`tests/${file}`, "utf8"); assert(source.includes(".seam"), `${file} must call the app seam`); for (const token of forbidden) assert(!source.includes(token), `${file}: forbidden shortcut ${token}`); }
const finalBoss = fs.readFileSync("tests/real-final-boss-production-path-test.js", "utf8");
const orion = fs.readFileSync("tests/real-orion-gameover-production-path-test.js", "utf8");
assert(!finalBoss.includes("PermanentEffects.resumeFinalization(")); assert(!orion.includes("DevelopmentV2.processRunEnd("));
for (const call of ["completeBossMatch", "continueAfterMatch", "resolvePendingRunFlow", "advanceBossReward", "finishBossVictoryTransition", "navigateBossVictoryDestination", "resumeRunFinalization"]) assert(finalBoss.includes(`.${call}(`), `missing real ${call} call`);
assert(orion.includes(".renderGameOver("));
const helper = fs.readFileSync("tests/helpers/production-runtime.js", "utf8");
for (const token of ["c.PersistenceRecoveryGuard =", "c.RunState =", "c.GameplayPersistence =", "c.PermanentEffects =", "c.HallOfFameStorage =", "c.DevelopmentV2 =", "new Proxy("])
  assert(!helper.includes(token), `production helper must not fabricate ${token}`);
for (const moduleName of ["persistence-recovery-guard.js", "run-state.js", "gameplay-persistence.js", "permanent-effects.js", "hall-of-fame.js", "development-v2.js", "album-progress.js", "map-generator.js", "boss-gameover-runtime.js", "boss/boss-flow-controller.js", "app.js"])
  assert(helper.includes(`\"${moduleName}\"`), `production helper must load ${moduleName}`);
for (const file of files.slice(0, 3)) assert(fs.readFileSync(`tests/${file}`, "utf8").includes(".reopen("), `${file} must destroy/reopen from storage`);
console.log("production path anti-fake contract: ok");
