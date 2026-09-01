"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
require("../js/roguelike_progression.js");
require("../js/development-v2.js");
require("../js/game-rules.js");

const viewSource = fs.readFileSync(require.resolve("../js/pulls/pull-view.js"), "utf8");

const raw = {
  playerId: "adam-montayne",
  name: "Adam Montayne",
  position: "FW",
  category: "Forte",
  finalOverall: 83,
  maxLevel: 20,
  ratings: { attack: 7, control: 7, speed: 6, grit: 6, physical: 6, stamina: 6, defense: 5, save: 1 },
};
const database = { progression: { maxLevel: 20 } };
const snapshot = { [raw.playerId]: { permanentTargetPotential: 90, currentPermanentRarity: "Elite" } };
const context = {
  global: {
    DevelopmentV2: global.DevelopmentV2,
    InazumaProgression: global.InazumaProgression,
    RoguelikeRules: global.RoguelikeRules,
    RecruitmentPoolRuntime: { choiceDatabase: () => database },
    DevelopmentRuntime: {
      resolvePlayer: (run, player, level, db) => global.InazumaProgression.getPlayerAtLevel(player, level, db, global.DevelopmentV2.optionsFromUpgrade(player, run.developmentPlayerSnapshot?.[String(player.playerId)])),
      resolveEffectiveMetadata: (run, player) => global.RoguelikeRules.resolveDevelopmentEffectiveMetadata(player, run.developmentPlayerSnapshot),
    },
  },
  run: { developmentPlayerSnapshot: snapshot },
};
context.globalThis = context.global;
vm.runInNewContext(viewSource, context);
const view = context.global.PullViewRuntime.create({
  getRun: () => context.run, getSeasonDb: () => database, getFreeAgentsDb: () => database,
});
context.resolvePullChoicePlayer = view.resolvePullChoicePlayer;

const options = { level: 0, source: "free_agents" };
const effective = context.resolvePullChoicePlayer(options, raw);
assert.strictEqual(effective.level, 0, "Pull Detail keeps the pull level");
assert.strictEqual(effective.category, "Elite", "the developed Free Agent is Elite in card and detail source");
assert.strictEqual(effective.potential, 90, "the developed potential is used in Player Detail");
assert.deepStrictEqual(effective.baseStats, effective.stats, "Player Detail receives the already-resolved Development stats");
assert.notStrictEqual(effective.category, raw.category);
assert.notStrictEqual(effective.potential, raw.finalOverall);

const normal = context.resolvePullChoicePlayer(options, { ...raw, playerId: "normal-player" });
assert.strictEqual(normal.category, "Forte", "a player without Development keeps the raw rarity");
assert.strictEqual(normal.potential, 83, "a player without Development keeps the raw potential");

assert.match(viewSource, /pull-choice-option \$\{rarityClass\(effectivePlayer\.category\)\}/, "the pull wrapper uses effective rarity");
assert.doesNotMatch(viewSource, /pull-choice-option \$\{rarityClass\(player\.category\)\}/, "the pull wrapper does not use raw rarity");
assert.match(viewSource, /playerCard\(player, \{[^}]*resolvedPlayer: effectivePlayer/, "the card uses the resolved effective player");
assert.match(viewSource, /showPlayerDetailsFor\(effectivePlayer, \{/, "SCHEDA uses the same effective source");

console.log("pull-effective-detail-test: effective card/detail parity, wrapper rarity and raw fallback OK");
