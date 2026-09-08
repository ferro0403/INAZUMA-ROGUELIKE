"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const Progression = require(path.join(root, "js/roguelike_progression.js"));
const V2 = require(path.join(root, "js/development-v2.js"));
const V3 = require(path.join(root, "js/development-v3.js"));
const Account = require(path.join(root, "js/development-account-v3.js"));
const Management = require(path.join(root, "js/development-management-v3.js"));
require(path.join(root, "js/season1-config.js"));
require(path.join(root, "js/player/player-view.js"));

assert.equal(Progression.categoryForPotential(95), "Leggenda");
assert.equal(Progression.categoryForPotential(98), "Leggenda");
assert.equal(Progression.categoryForPotential(99), "Aurico");
assert.equal(Progression.RARITY_THRESHOLDS.at(-1).category, "Aurico");
assert.equal(Progression.RARITY_THRESHOLDS.at(-1).min, 99);

assert.equal(V2.nextRarity("Mondiale"), "Leggenda");
assert.equal(V2.nextRarity("Leggenda"), "Aurico");
assert.equal(V2.nextRarity("Aurico"), null);
assert.equal(V2.threshold("Leggenda"), 95);
assert.equal(V2.threshold("Aurico"), 99);
assert.equal(V2.PROJECT_PRICES.Aurico, 3200);
assert.deepStrictEqual(V2.COSTS.Aurico, { coins: 2000, cups: 10, projects: 1 });
assert.equal(V2.ASSETS.Mondiale, "https://dxi4wb638ujep.cloudfront.net/1/k/k/z/kz4ohtonkje.png");
assert.equal(V2.ASSETS.Aurico, "https://dxi4wb638ujep.cloudfront.net/1/k/c/j/cj7t4wj1bx8.png");

const normalizedLegacyV2 = V2.normalize({
  schemaVersion: V2.SCHEMA_VERSION,
  projects: { Buono: 1, Forte: 2, Elite: 3, Mondiale: 4, Leggenda: 5 },
  legacyProjectBuild: { Buono: 1, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0 },
});
assert.equal(normalizedLegacyV2.projects.Aurico, 0);
assert.equal(normalizedLegacyV2.legacyProjectBuild.Aurico, 0);

assert.deepStrictEqual(V3.RARITY_POTENTIAL_BANDS.Leggenda, { min: 95, max: 98 });
assert.deepStrictEqual(V3.RARITY_POTENTIAL_BANDS.Aurico, { min: 99, max: 99 });
assert.equal(V3.COLORED_RARITIES.at(-1), "Aurico");

const legacyV3 = V3.empty();
legacyV3.migrationLegacy = {
  projectBuild: { Buono: 1, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0 },
};
assert.equal(V3.validate(legacyV3).valid, true, "pre-Aurico migrationLegacy counters remain valid");
const normalizedLegacyV3 = V3.normalize(legacyV3);
assert.equal(normalizedLegacyV3.projects.Aurico, 0);
assert.equal(normalizedLegacyV3.migrationLegacy.projectBuild.Aurico, 0);

const baseLegend = {
  playerId: "aurico-fixture",
  name: "Aurico Fixture",
  finalOverall: 95,
  category: "Leggenda",
  position: "FW",
  maxLevel: 20,
  ratings: { attack: 10, control: 10, speed: 10, grit: 10, physical: 10, stamina: 10, defense: 10, save: 1 },
};
const auricoProfile = V3.materializeProfile({
  basePlayer: baseLegend,
  targetPotential: 99,
  category: "Aurico",
  progression: Progression,
});
assert.equal(auricoProfile.finalOverall, 99);
assert.equal(auricoProfile.category, "Aurico");
assert.equal(V3.validateProfile(auricoProfile).valid, true);

assert.equal(Account.SLOT_CAPACITIES.Aurico, 1);
assert.ok(Management.CAPACITY_RARITIES.includes("Aurico"));
assert.equal(Management.SORT_WEIGHT.Aurico, Management.SORT_WEIGHT.Leggenda + 1);
assert.equal(global.SEASON1_CONFIG.categoryRanks.Aurico, 8);
assert.ok(global.SEASON1_CONFIG.legendaryCategories.includes("Aurico"));
assert.equal(global.PlayerView.rarityClass("Aurico"), "rarity-aurico");

const css = fs.readFileSync(path.join(root, "css/aurico-rarity.css"), "utf8");
assert.match(css, /\.rarity-aurico\s*\{/);
assert.match(css, /--rarity-(?:bg|surface):\s*#(?:101114|07080a)/);
assert.match(css, /\.album-player-entry\s*>\s*\.player-card\.rarity-aurico\s+\.player-title strong\s*\{[\s\S]*?color:\s*#fff/);
assert.match(css, /\.squad-player-card\.rarity-aurico[\s\S]*?background:\s*linear-gradient\(165deg,\s*#15161a/);
assert.match(css, /\.five-slot\.run-tactical-card\.rarity-aurico[\s\S]*?background:\s*linear-gradient\(165deg,\s*#15161a/);
assert.match(css, /\.run-tactical-card\.tactical-player-card\.rarity-aurico[\s\S]*?background:\s*linear-gradient\(165deg,\s*#15161a/);
assert.match(css, /\.hall-player-card\.rarity-aurico[\s\S]*?background:\s*linear-gradient\(165deg,\s*#15161a/);
assert.match(css, /\.hall-player-card\.rarity-aurico\s+\.player-title strong[\s\S]*?color:\s*#fff/);
assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.development-slot-grid\s+\.development-slot-card\.rarity-aurico:last-child\s*\{[\s\S]*?grid-column:\s*auto/);

const developmentController = fs.readFileSync(path.join(root, "js/development/development-center-controller.js"), "utf8");
assert.match(developmentController, /player\.category === "Aurico"[\s\S]*development-max/);

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(index, /css\/aurico-rarity\.css\?v=20260909-aurico-1/);

console.log("aurico rarity production contract: 99 mapping, Development costs/capacity, legacy counters, UI class/assets and black-card coverage OK");
