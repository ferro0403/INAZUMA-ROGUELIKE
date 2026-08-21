"use strict";
const assert = require("assert");
const { performance } = require("perf_hooks");
const progression = require("../js/roguelike_progression.js");
const ORDER = ["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"];
const WEIGHTS = progression.ROLE_STAT_WEIGHTS;

function coherenceScore(candidate, original, current, role, target) {
  const weights = WEIGHTS[role], eligible = ORDER.filter((stat) => weights[stat] > 0);
  const average = eligible.reduce((sum, stat) => sum + original[stat], 0) / eligible.length;
  let score = 0, totalGrowth = 0, squaredGrowth = 0;
  for (const stat of eligible) {
    const growth = candidate[stat] - current[stat];
    totalGrowth += growth; squaredGrowth += growth * growth;
    const strength = original[stat] - average;
    score += growth * (weights[stat] * 0.34 + strength * 3);
    if (original[stat] <= average - 2) score -= growth * growth * 24;
    const desired = target >= 95 ? 10 : target >= 90 ? 9 : target >= 85 ? 8.5 : target >= 80 ? 8 : 7;
    score -= Math.max(0, candidate[stat] - Math.max(original[stat], desired)) * 5;
  }
  score -= squaredGrowth * 5 + Math.max(0, squaredGrowth - totalGrowth * totalGrowth / eligible.length) * 4;
  for (const stronger of eligible) for (const weaker of eligible) {
    if (original[stronger] >= original[weaker] + 2 && candidate[stronger] < candidate[weaker]) score -= 90;
  }
  return score;
}

// Production solver before the optimization, retained only as an equivalence oracle.
function legacyFindBestCodexGrowthProfileForTest({ role, originalRatings, currentRatings, targetOverall }) {
  const weights = WEIGHTS[role], original = progression.toCodexRatings(originalRatings), current = progression.toCodexRatings(currentRatings);
  if (!weights) return current;
  const target = Math.max(0, Math.min(99, Math.round(Number(targetOverall) || 0)));
  const primary = { FW: "attack", MF: "control", DF: "defense", GK: "save" }[role];
  let primaryMinimum = current[primary];
  if (target >= 95) primaryMinimum = 10;
  else if (target >= 90 && original[primary] >= 9) primaryMinimum = 10;
  else if (target >= 90 && original[primary] >= 8) primaryMinimum = 9;
  const eligible = ORDER.filter((stat) => weights[stat] > 0);
  const minimums = Object.fromEntries(eligible.map((stat) => [stat, stat === primary ? Math.max(current[stat], primaryMinimum) : current[stat]]));
  const eligibleIndex = Object.fromEntries(eligible.map((stat, index) => [stat, index]));
  function boundOverall(index, candidate, maximize) {
    let roleScore = 0;
    for (const [stat, weight] of Object.entries(weights)) {
      const position = eligibleIndex[stat];
      const value = weight > 0 && position >= index ? (maximize ? 10 : minimums[stat]) : candidate[stat];
      roleScore += Number(value || 0) * weight / 100;
    }
    return Math.max(1, Math.min(99, Math.round(30 + ((roleScore - 1) * 69 / 9))));
  }
  let best = null;
  function visit(index, candidate) {
    const minOverall = boundOverall(index, candidate, false), maxOverall = boundOverall(index, candidate, true);
    if (maxOverall < target) return;
    if (best && ((best.rank[0] === 0 && minOverall > target) || (best.rank[0] === 1 && minOverall - target > best.rank[1]))) return;
    if (index === eligible.length) {
      const overall = progression.overallForRole(role, candidate);
      if (overall < target) return;
      const score = coherenceScore(candidate, original, current, role, target);
      const rank = [overall === target ? 0 : 1, overall - target, -score, eligible.map((stat) => candidate[stat]).join("")];
      if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && (rank[1] < best.rank[1] || (rank[1] === best.rank[1] && (rank[2] < best.rank[2] || (rank[2] === best.rank[2] && rank[3] < best.rank[3])))))) best = { ratings: { ...candidate }, rank };
      return;
    }
    const stat = eligible[index];
    for (let value = minimums[stat]; value <= 10; value += 1) {
      candidate[stat] = value;
      const branchMin = boundOverall(index + 1, candidate, false);
      if (best && ((best.rank[0] === 0 && branchMin > target) || (best.rank[0] === 1 && branchMin - target > best.rank[1]))) break;
      visit(index + 1, candidate);
    }
  }
  visit(0, { ...current });
  return best?.ratings || current;
}

let seed = 0x1a2b3c4d;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; }
const targets = [70, 75, 80, 85, 87, 90, 93, 95, 98, 99], roles = ["FW", "MF", "DF", "GK"];
const cases = [];
for (const role of roles) for (const target of targets) {
  cases.push({ role, target, original: Object.fromEntries(ORDER.map((stat, index) => [stat, 1 + ((index * 3 + target) % 10)])) });
  cases.push({ role, target, original: Object.fromEntries(ORDER.map((stat) => [stat, target >= 90 ? 10 : 7])) });
}
for (let index = 0; index < 920; index += 1) {
  const original = Object.fromEntries(ORDER.map((stat) => [stat, 4 + Math.floor(random() * 7)]));
  if (index % 20 === 0) original[ORDER[index % ORDER.length]] = 1;
  cases.push({ role: roles[index % roles.length], target: targets[Math.floor(random() * targets.length)], original });
}
for (const input of cases) {
  const current = Object.fromEntries(ORDER.map((stat) => [stat, Math.min(10, input.original[stat] + Math.floor(random() * (11 - input.original[stat])))]));
  const args = { role: input.role, originalRatings: input.original, currentRatings: current, targetOverall: input.target };
  assert.deepStrictEqual(progression.findBestCodexGrowthProfile(args), legacyFindBestCodexGrowthProfileForTest(args), `legacy parity: ${JSON.stringify(args)}`);
}

const fixture = { position: "DF", finalOverall: 84, ratings: { attack: 1, control: 7, speed: 6, grit: 7, physical: 10, stamina: 6, defense: 9, save: 1 } };
const planned = progression.planCodexTrainingGrowth(fixture, {}, 3);
const legacyRatings = legacyFindBestCodexGrowthProfileForTest({ role: fixture.position, originalRatings: fixture.ratings, currentRatings: fixture.ratings, targetOverall: 87 });
assert.deepStrictEqual(planned.ratings, legacyRatings, "Intensive Training ratings remain identical");
assert.deepStrictEqual(planned.codexDeltas, Object.fromEntries(ORDER.map((stat) => [stat, legacyRatings[stat] - fixture.ratings[stat]]).filter(([, delta]) => delta > 0)), "Intensive Training deltas remain identical");
const development = progression.growPlayerStatsToTargetOverall({ role: fixture.position, originalStats: fixture.ratings, currentStats: fixture.ratings, currentOverall: 84, targetOverall: 87 });
const expectedDevelopment = { ...fixture.ratings };
for (const stat of ORDER) if (legacyRatings[stat] > fixture.ratings[stat]) expectedDevelopment[stat] += (legacyRatings[stat] - fixture.ratings[stat]) * 10;
assert.deepStrictEqual(development, expectedDevelopment, "Development preview remains identical");

const heavy = { role: "MF", originalRatings: Object.fromEntries(ORDER.map((stat) => [stat, 1])), currentRatings: Object.fromEntries(ORDER.map((stat) => [stat, 1])), targetOverall: 85 };
let start = performance.now(); legacyFindBestCodexGrowthProfileForTest(heavy); const legacyMs = performance.now() - start;
start = performance.now(); progression.findBestCodexGrowthProfile(heavy); const newMs = performance.now() - start;
console.log(`codex-growth-solver-equivalence-test: ${cases.length} parity cases; legacy ${legacyMs.toFixed(1)} ms, new ${newMs.toFixed(1)} ms, speedup ${(legacyMs / newMs).toFixed(1)}x; training and Development parity OK`);
