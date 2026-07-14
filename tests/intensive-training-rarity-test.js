"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const progression = require(path.join(root, "js/roguelike_progression.js"));

const freeAgents = JSON.parse(fs.readFileSync(path.join(root, "data/FREE_AGENTS_compact.json"), "utf8"));
const season1 = JSON.parse(fs.readFileSync(path.join(root, "data/IE1_season_compact.json"), "utf8"));
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

function fixturePlayer(finalOverall, category = "Debole") {
  const maxLevel = 20;
  const statCount = 8;
  return {
    playerId: `fixture_${finalOverall}_${category}`,
    name: "Fixture Player",
    position: "FW",
    normalizedRole: "FW",
    category,
    finalOverall,
    maxLevel,
    progressionCode: "0a".repeat(statCount * (maxLevel + 1)),
  };
}

function categoryAt(basePotential, boost, source = "free_agents", fallback = "Debole") {
  const database = source === "season1" ? season1 : freeAgents;
  return progression.getPlayerAtLevel(fixturePlayer(basePotential, fallback), 0, database, {
    potentialBoost: boost,
    currentOverallBoost: boost,
    potentialBoostApplications: boost > 0 ? [{ amount: boost, appliedLevel: 0 }] : [],
  }).category;
}

const expectedThresholds = [
  [0, "Scarso"],
  [65, "Scarso"],
  [66, "Debole"],
  [69, "Debole"],
  [70, "Normale"],
  [74, "Normale"],
  [75, "Buono"],
  [79, "Buono"],
  [80, "Forte"],
  [84, "Forte"],
  [85, "Elite"],
  [89, "Elite"],
  [90, "Mondiale"],
  [94, "Mondiale"],
  [95, "Leggenda"],
  [99, "Leggenda"],
];
for (const [potential, category] of expectedThresholds) {
  assert.equal(progression.categoryForPotential(potential, "Elite", freeAgents), category, `${potential} must resolve to ${category}`);
}
assert.equal(progression.categoryForPotential(Number.NaN, "Forte", freeAgents), "Forte", "fallback is only used when potential is not numeric");

assert(!freeAgents.players.some((player) => player.category === "Mondiale"), "real free agents database intentionally lacks Mondiale players");
assert(season1.players.some((player) => player.category === "Mondiale"), "real Season 1 database includes Mondiale players");
assert.equal(progression.categoryForPotential(90, "Elite", freeAgents), "Mondiale", "free agents 90 ignores missing database rarity");
assert.equal(progression.categoryForPotential(90, "Elite", season1), "Mondiale", "season1 90 uses the same global rarity");
assert.equal(progression.categoryForPotential(95, "Elite", freeAgents), "Leggenda", "free agents 95 reaches Leggenda");
assert.equal(progression.categoryForPotential(95, "Elite", season1), "Leggenda", "season1 95 reaches Leggenda");

for (const source of ["free_agents", "season1"]) {
  assert.equal(categoryAt(84, 3, source, "Forte"), "Elite", `${source}: 84 + 3 must become Elite`);
  assert.equal(categoryAt(84, 6, source, "Forte"), "Mondiale", `${source}: 87 + 3 must become Mondiale`);
  assert.equal(categoryAt(84, 9, source, "Forte"), "Mondiale", `${source}: 90 + 3 must remain Mondiale`);
  assert.equal(categoryAt(84, 12, source, "Forte"), "Leggenda", `${source}: 93 + 3 must become Leggenda`);
}

const longProgression = [
  [68, 0, "Debole"],
  [68, 3, "Normale"],
  [68, 6, "Normale"],
  [68, 9, "Buono"],
  [68, 12, "Forte"],
  [68, 15, "Forte"],
  [68, 18, "Elite"],
  [68, 21, "Elite"],
  [68, 24, "Mondiale"],
  [68, 27, "Leggenda"],
];
for (const [base, boost, category] of longProgression) {
  assert.equal(categoryAt(base, boost, "free_agents", "Debole"), category, `${base} + ${boost} must be ${category}`);
}

const nearCap = fixturePlayer(96, "Mondiale");
let applications = [];
let potentialBoost = 0;
for (const amount of [3, 3, 3]) {
  applications = progression.normalizePotentialBoostApplications({ potentialBoost, potentialBoostApplications: applications }, 99 - nearCap.finalOverall);
  const current = applications.reduce((sum, boost) => sum + boost.amount, 0);
  const added = Math.min(amount, Math.max(0, 99 - nearCap.finalOverall - current));
  if (added > 0) applications.push({ amount: added, appliedLevel: 0 });
  potentialBoost = applications.reduce((sum, boost) => sum + boost.amount, 0);
}
assert.equal(potentialBoost, 3, "multiple uses clamp at 99 and cannot add beyond cap");
assert.equal(progression.effectivePotential(nearCap, { potentialBoost, potentialBoostApplications: applications }), 99, "effective potential is capped at 99");
assert.equal(Math.min(3, Math.max(0, 99 - nearCap.finalOverall - potentialBoost)), 0, "an item would not be consumed once no boost can be applied");

let migrated = progression.normalizePotentialBoostApplications({ potentialBoost: 6, currentOverallBoost: 6, potentialBoostApplications: [] }, 15);
assert.deepEqual(migrated, [{ amount: 6, appliedLevel: 0, legacy: true }], "empty legacy applications preserve saved potentialBoost");
assert.deepEqual(progression.normalizePotentialBoostApplications({ potentialBoost: 6, potentialBoostApplications: migrated }, 15), migrated, "legacy migration is idempotent");
assert.equal(progression.effectivePotential(fixturePlayer(84, "Forte"), { potentialBoost: 6, potentialBoostApplications: migrated }), 90, "migrated legacy boost affects category potential");
assert.equal(categoryAt(84, 6, "free_agents", "Forte"), "Mondiale", "migrated legacy boost reaches Mondiale");

migrated = progression.normalizePotentialBoostApplications({ potentialBoost: 6, potentialBoostApplications: [{ amount: 3, appliedLevel: 4 }] }, 15);
assert.deepEqual(migrated, [{ amount: 3, appliedLevel: 4 }, { amount: 3, appliedLevel: 0, legacy: true }], "partial legacy migration adds only the missing delta");
assert.deepEqual(progression.normalizePotentialBoostApplications({ potentialBoost: 6, potentialBoostApplications: migrated }, 15), migrated, "partial migration is idempotent");

migrated = progression.normalizePotentialBoostApplications({ potentialBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 4 }, { amount: 3, appliedLevel: 7 }] }, 15);
assert.deepEqual(migrated, [{ amount: 3, appliedLevel: 4 }, { amount: 3, appliedLevel: 7 }], "application totals greater than old potentialBoost are preserved");
assert.equal(progression.normalizedPotentialBoost({ potentialBoost: 3, potentialBoostApplications: migrated }, 15), 6, "potentialBoost normalizes up to the valid application sum");
assert.deepEqual(progression.normalizePotentialBoostApplications({ potentialBoost: 6, potentialBoostApplications: migrated }, 15), migrated, "greater-than-potential migration does not duplicate entries");

const source = fixturePlayer(84, "Forte");
const resolved = progression.getPlayerAtLevel(source, 0, freeAgents, { potentialBoost: 6, currentOverallBoost: 6, potentialBoostApplications: [{ amount: 6, appliedLevel: 0 }] });
assert.equal(resolved.category, "Mondiale", "resolved roster-style player returns effective category");
assert.equal(source.category, "Forte", "source database player category remains unchanged");
assert(appJs.includes('Mondiale: "rarity-mondiale"'), "rarityClass maps Mondiale to rarity-mondiale");
assert(appJs.includes('Leggenda: "rarity-leggenda"'), "rarityClass maps Leggenda to rarity-leggenda");
assert(appJs.includes('const rarityMessage = before.category !== after.category ? `\\nNuova rarità: ${after.category}` : "";'), "toast reports the resolved category change");
assert(!fs.readFileSync(path.join(root, "js/roguelike_progression.js"), "utf8").includes("function categoryThresholds"), "database-derived rarity thresholds must not exist");

console.log("intensive-training-rarity-test passed");
