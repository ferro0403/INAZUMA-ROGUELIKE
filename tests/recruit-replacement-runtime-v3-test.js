"use strict";

const assert = require("assert");
const fs = require("fs");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
global.DevelopmentV2 = require("../js/development-v2.js");
const V3 = require("../js/development-v3.js");
global.DevelopmentV3 = V3;
const Runtime = require("../js/development-runtime.js");
const database = require("../data/FREE_AGENTS_compact.json");
Runtime.registerDatabase("free-agents", database);

const adam = database.players.find((player) => player.name === "Adam Montayne");
assert(adam, "Adam Montayne real free-agent fixture is required");
assert.equal(Number(adam.finalOverall), 83, "manual regression fixture remains the real Forte 83 base player");
assert.equal(adam.category, "Forte");
const elite = V3.materializeProfile({ basePlayer: adam, targetPotential: 85, category: "Elite", database, progression });
const run = {
  seasonId: "ie1",
  developmentV3PlayerSnapshot: {
    schemaVersion: 1,
    profileFormatVersion: V3.PROFILE_FORMAT_VERSION,
    players: { [String(adam.playerId)]: { profile: elite } },
  },
  developmentPlayerSnapshot: {},
};
const rawAtLevel = progression.getPlayerAtLevel(adam, 3, database);
const resolvedAtLevel = Runtime.resolvePlayer(run, adam, 3, database);
assert.equal(resolvedAtLevel.category, "Elite");
assert.equal(resolvedAtLevel.potential, 85);
assert.notEqual(resolvedAtLevel.category, rawAtLevel.category, "frozen V3 rarity differs from raw replacement-card rarity");
assert(resolvedAtLevel.overall >= rawAtLevel.overall, "V3 replacement card keeps the evolved level-3 progression");

const baseRun = { seasonId: "ie1" };
assert.deepStrictEqual(Runtime.resolvePlayer(baseRun, adam, 3, database), rawAtLevel, "non-evolved incoming players remain unchanged");

const controller = fs.readFileSync("js/recruitment/recruitment-controller.js", "utf8");
const view = fs.readFileSync("js/recruitment/recruitment-view.js", "utf8");
assert.match(view, /playerCard\(player, \{ context: "pull", extraClass: "bench-replacement-new-card", level, database: databaseFor\(source\), applyPermanent: !profileAware \}\)/, "replacement modal resolves normal/free-agent incoming cards through the injected frozen-run resolver");
assert.match(controller, /const profileAware = isProfileAwareSeason\(\) && Boolean\(player\.profileId\)/, "profile-aware recruitment branch remains explicit");
assert.match(view, /applyPermanent: !profileAware/, "season profile candidates deliberately bypass free-agent V3 resolution");

console.log("recruit replacement card uses frozen V3 runtime for evolved free agents and preserves profile-aware/base behavior");
