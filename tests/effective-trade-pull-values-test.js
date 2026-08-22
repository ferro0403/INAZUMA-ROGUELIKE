"use strict";

const assert = require("assert");
require("../js/roguelike_progression.js");
require("../js/game-rules.js");
require("../js/development-v2.js");

const rules = global.RoguelikeRules;
const progression = global.InazumaProgression;
const legendaryCategories = ["Forte", "Elite", "Mondiale", "Leggenda"];
const developedFw = { playerId: "developed-fw", name: "Developed FW", position: "FW", finalOverall: 82, category: "Forte" };
const snapshot90 = { "developed-fw": { permanentTargetPotential: 90, currentPermanentRarity: "Mondiale" } };

function tradeCandidates(outgoingOverall, candidates, snapshot = {}) {
  return rules.getTradeCandidates({
    outgoingPlayer: { playerId: "outgoing", position: "FW", finalOverall: outgoingOverall },
    rosterIds: ["outgoing"],
    freeAgents: candidates,
    seasonPlayers: [],
    unlockedTeamIds: [],
    teams: [],
    resolveCandidate: (player, source) => source === "free_agents"
      ? rules.resolveDevelopmentEffectiveMetadata(player, snapshot)
      : player,
  });
}

assert.strictEqual(tradeCandidates(88, [developedFw], snapshot90).length, 1, "Development 90 candidate is eligible over outgoing 88");

const outgoing84 = { playerId: "outgoing", position: "FW", finalOverall: 84 };
assert.strictEqual(progression.effectivePotential(outgoing84, { potentialBoost: 3 }), 87, "run Training raises outgoing trade potential");
assert.strictEqual(tradeCandidates(87, [{ playerId: "85", position: "FW", finalOverall: 85 }]).length, 0);
assert.strictEqual(tradeCandidates(87, [{ playerId: "87", position: "FW", finalOverall: 87 }]).length, 1);

const outgoing80 = { playerId: "outgoing", position: "FW", finalOverall: 80 };
const developedAndTrained = global.DevelopmentV2.optionsFromUpgrade(outgoing80, { permanentTargetPotential: 90 });
developedAndTrained.potentialBoost = 13;
developedAndTrained.potentialBoostApplications.push({ amount: 3, appliedLevel: 0 });
assert.strictEqual(progression.effectivePotential(outgoing80, developedAndTrained), 93, "Development and Training combine only on the roster entry");
assert.strictEqual(tradeCandidates(93, [{ playerId: "92", position: "FW", finalOverall: 80 }], { 92: { permanentTargetPotential: 92 } }).length, 0);
assert.strictEqual(tradeCandidates(93, [{ playerId: "93", position: "FW", finalOverall: 80 }], { 93: { permanentTargetPotential: 93 } }).length, 1);

const rawNonLegendary = { playerId: "late-bloomer", position: "FW", finalOverall: 78, category: "Buono" };
const oldRunSnapshot = { "late-bloomer": { permanentTargetPotential: 85, currentPermanentRarity: "Elite" } };
const newRunSnapshot = { "late-bloomer": { permanentTargetPotential: 90, currentPermanentRarity: "Mondiale" } };
assert(rules.isLegendaryEffectivePlayer(rawNonLegendary, legendaryCategories, oldRunSnapshot), "effective Elite Free Agent enters Legendary");
assert.strictEqual(rules.resolveDevelopmentEffectiveMetadata(rawNonLegendary, oldRunSnapshot).finalOverall, 85);
assert.strictEqual(rules.resolveDevelopmentEffectiveMetadata(rawNonLegendary, newRunSnapshot).finalOverall, 90);
assert.strictEqual(rawNonLegendary.category, "Buono", "raw Free Agent and its normal pull membership remain unchanged");
assert(!rules.isLegendaryEffectivePlayer(rawNonLegendary, legendaryCategories, {}), "Training-free snapshot metadata alone controls Legendary eligibility");

const acquiredOptions = global.DevelopmentV2.optionsFromUpgrade(rawNonLegendary, oldRunSnapshot["late-bloomer"]);
assert.strictEqual(progression.effectivePotential(rawNonLegendary, acquiredOptions), 85, "an acquired player retains snapshot Development fields");

console.log("effective-trade-pull-values-test: effective trades, Legendary metadata, Free Agent origin and snapshots OK");
