const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const progression = require("../js/roguelike_progression.js");

const STAT_ORDER = ["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"];
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const ie1 = read("data/IE1_season_compact.json");
const freeAgents = read("data/FREE_AGENTS_compact.json");
const ares = read("data/IE2_season_compact.json");
const ie1s2 = read("data/IE1_S2_season_compact.json");

function decodedStats(player, database, level) {
  const { statOrder, codeWidth, levelMax } = database.compactFormat;
  return Object.fromEntries(statOrder.map((stat, statIndex) => {
    const offset = (statIndex * (levelMax + 1) + level) * codeWidth;
    return [stat, parseInt(player.progressionCode.slice(offset, offset + codeWidth), 36)];
  }));
}

let legacyValues = 0;
let dynamicMismatch = 0;
let dynamicAbsoluteError = 0;
for (const database of [ie1, freeAgents]) {
  for (const player of database.players.filter((item) => typeof item.progressionCode === "string")) {
    for (let level = 0; level <= 20; level += 1) {
      const expected = decodedStats(player, database, level);
      const resolved = progression.getPlayerAtLevel(player, level, database);
      assert.deepStrictEqual(resolved.stats, expected, `${player.name} legacy level ${level}`);

      const ratingsOnly = { ...player, progressionCode: undefined, ratings: Object.fromEntries(STAT_ORDER.map((stat) => [stat, player.finalStats[stat] / 10])) };
      const dynamic = progression.getPlayerAtLevel(ratingsOnly, level, database).stats;
      for (const stat of STAT_ORDER) {
        legacyValues += 1;
        const error = Math.abs(dynamic[stat] - expected[stat]);
        dynamicAbsoluteError += error;
        if (error) dynamicMismatch += 1;
      }
    }
  }
}

function assertEndpoint(player, database, label = player.name) {
  const resolved = progression.getPlayerAtLevel(player, 20, database);
  for (const stat of STAT_ORDER) {
    assert.strictEqual(resolved.stats[stat], player.ratings[stat] * 10, `${label} ${stat}`);
    assert(Number.isInteger(resolved.stats[stat]));
    assert(resolved.stats[stat] >= 10 && resolved.stats[stat] <= 100);
  }
  return resolved;
}

for (const player of ares.players.filter((item) => item.ratings)) assertEndpoint(player, ares, `Ares ${player.name}`);
for (const player of ie1s2.players.filter((item) => item.ratings)) assertEndpoint(player, ie1s2, `IE1 S2 canonical ${player.name}`);
for (const profile of ie1s2.profiles) {
  if (profile.ratings) assertEndpoint(profile, ie1s2, `profile ${profile.profileId}`);
  for (const variant of profile.roleVariants || []) {
    if (variant.ratings) assertEndpoint(variant, ie1s2, `variant ${profile.profileId}/${variant.roleVariantId}`);
  }
}

const diam = ie1s2.players.find((player) => player.name === "Diam");
assert.deepStrictEqual(assertEndpoint(diam, ie1s2).stats, { attack: 70, control: 80, speed: 80, grit: 60, physical: 70, stamina: 70, defense: 20, save: 10 });
const acker = ares.players.find((player) => player.name === "Acker Reese");
assert.deepStrictEqual(assertEndpoint(acker, ares).stats, { attack: 40, control: 100, speed: 80, grit: 80, physical: 90, stamina: 90, defense: 90, save: 10 });
const apollo = ie1.players.find((player) => player.name === "Apollo Light");
assert(apollo && typeof apollo.progressionCode === "string");
assert.deepStrictEqual(progression.getPlayerAtLevel(apollo, 20, ie1).stats, { attack: 60, control: 70, speed: 80, grit: 80, physical: 80, stamina: 80, defense: 90, save: 10 });

for (const player of [acker, diam, ...ares.players.filter((item) => item.ratings).slice(0, 8)]) {
  let previous = null;
  for (let level = 0; level <= 20; level += 1) {
    const resolved = progression.getPlayerAtLevel(player, level, player === diam ? ie1s2 : ares);
    if (previous) {
      assert.strictEqual(resolved.overall, previous.overall + 1);
      for (const stat of STAT_ORDER) assert(resolved.stats[stat] >= previous.stats[stat]);
    }
    previous = resolved;
  }
  assert.deepStrictEqual(progression.getPlayerAtLevel(player, -10, ares).stats, progression.getPlayerAtLevel(player, 0, ares).stats);
  assert.deepStrictEqual(progression.getPlayerAtLevel(player, 99, ares).stats, progression.getPlayerAtLevel(player, 20, ares).stats);
}

assert.throws(() => progression.getPlayerAtLevel({ finalOverall: 70, ratings: { attack: 7 } }, 20, {}), /Invalid InaCodex rating/);

const context = { console, globalThis: null };
context.globalThis = context;
context.InazumaProgression = progression;
vm.runInNewContext(fs.readFileSync("js/profiled-season.js", "utf8"), context, { filename: "js/profiled-season.js" });
context.ProfiledSeasonRuntime.register("ie1_s2", ie1s2);
const switchable = ie1s2.profiles.find((profile) => profile.roleVariants?.length > 1 && profile.roleVariants.some((variant, index, variants) => index && JSON.stringify(variant.ratings) !== JSON.stringify(variants[0].ratings)));
assert(switchable, "expected a profile with distinct role variants");
const rawBefore = JSON.stringify(switchable);
const runPlayer = { playerId: switchable.playerId, activeProfileId: switchable.profileId, activeRoleVariantId: switchable.roleVariants[0].roleVariantId, level: 20 };
const first = context.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(runPlayer, { seasonId: "ie1_s2", database: ie1s2 });
runPlayer.activeRoleVariantId = switchable.roleVariants[1].roleVariantId;
const second = context.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(runPlayer, { seasonId: "ie1_s2", database: ie1s2 });
assert.notDeepStrictEqual(first.stats, second.stats, "role switch must resolve the active variant without stale stats");
assert.deepStrictEqual(second.stats, Object.fromEntries(STAT_ORDER.map((stat) => [stat, switchable.roleVariants[1].ratings[stat] * 10])));
assert.strictEqual(JSON.stringify(switchable), rawBefore, "profile resolution must not mutate raw data");

const mismatchPercent = (dynamicMismatch * 100 / legacyValues).toFixed(2);
const meanAbsoluteError = (dynamicAbsoluteError / legacyValues).toFixed(3);
console.log(`dynamic-progression-legacy-parity-test: ${legacyValues} legacy values exact through progressionCode; deterministic ratings-only curve mismatch ${dynamicMismatch} (${mismatchPercent}%), MAE ${meanAbsoluteError} for levels 0-19/20; all endpoints exact`);
