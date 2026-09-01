"use strict";

const assert = require("assert");
const fs = require("fs");
require("../js/roguelike_progression.js");
require("../js/development-v2.js");
require("../js/game-rules.js");

const raw = {
  playerId: "adam-preview",
  name: "Adam Montayne",
  position: "FW",
  category: "Forte",
  finalOverall: 82,
  baseOverall: 62,
  maxLevel: 20,
  ratings: { attack: 8, control: 7, speed: 7, grit: 6, physical: 6, stamina: 6, defense: 4, save: 2 },
};
const upgrade = { permanentTargetPotential: 95, currentPermanentRarity: "Leggenda" };
const entry = { playerId: raw.playerId, level: 6, ...global.DevelopmentV2.optionsFromUpgrade(raw, upgrade) };
const database = { players: [raw], compactFormat: { statOrder: Object.keys(raw.ratings) } };

// The confirmation preview and the recruited roster result resolve the same raw
// Free Agent, at the same next level, with the same snapshotted Development fields.
const preview = global.InazumaProgression.getPlayerAtLevel(raw, 6, database, entry);
const result = global.InazumaProgression.getPlayerAtLevel(raw, 6, database, { ...entry });
assert.strictEqual(preview.category, "Leggenda");
assert.strictEqual(preview.category, result.category);
assert.deepStrictEqual(preview.stats, result.stats);
assert.strictEqual(global.InazumaProgression.effectivePotential(raw, entry), 95);
assert.strictEqual(global.InazumaProgression.effectivePotential(raw, entry), global.InazumaProgression.effectivePotential(raw, { ...entry }));
assert(preview.overall < 95, "level-6 current OVR remains distinct from final potential");

const evolvedFreeAgent = { playerId: "evolved-pool", position: "MF", category: "Buono", finalOverall: 78 };
const legendaryPoolBeforeRandom = [evolvedFreeAgent].filter((player) => global.RoguelikeRules.isLegendaryEffectivePlayer(
  player,
  ["Forte", "Elite", "Mondiale", "Leggenda"],
  { "evolved-pool": { permanentTargetPotential: 85, currentPermanentRarity: "Elite" } }
));
assert.deepStrictEqual(legendaryPoolBeforeRandom.map((player) => player.playerId), ["evolved-pool"], "Development Elite Free Agent enters the real pool before random selection");

const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
assert.match(appSource, /incoming\.source === "free_agents"[\s\S]*permanentRosterFields\(incoming\.player\)/, "trade preview applies the shared permanent roster resolver");
assert.match(appSource, /DEV_MODE \? `[\s\S]*data-dev-open-legendary/, "map DEV controls are not rendered outside ?dev=1");
assert.match(appSource, /openPull\(node, "pull_legendary", \{ dev: true \}\)/, "direct DEV pull reuses the real Legendary flow");
assert.match(appSource, /RIGENERA PULL LEGGENDARIO/, "DEV Legendary reroll is available without a scout token");
assert.match(appSource, /data-dev-transform-node="pull_legendary"/);
assert.match(appSource, /data-dev-transform-node="trade"/);
const prepareTradeSource = appSource.slice(appSource.indexOf("function prepareTrade"), appSource.indexOf("function showTradeResult"));
assert(!prepareTradeSource.includes("InazumaProgression.effectivePotential"), "Trade never reconstructs V3 permanent potential from BASE plus roster fields");
assert.match(prepareTradeSource, /tradeOutgoingEffectiveMetadata\(outgoingResolved\)/, "preview uses the resolved roster player");
assert.match(prepareTradeSource, /resolveOutgoingBase: \(entry\) => global\.RoguelikeRules\.tradeOutgoingEffectiveMetadata\(resolvedRosterPlayer\(entry\.playerId, current\)\)/, "final profile-aware validation uses the same resolved metadata boundary");
assert.match(prepareTradeSource, /finalOverall ≥ \$\{escapeHtml\(outgoingBase\.finalOverall\)\}/, "contract renders the exact filtering threshold");

console.log("trade-preview-dev-tools-test: Development preview parity and DEV map tools OK");
