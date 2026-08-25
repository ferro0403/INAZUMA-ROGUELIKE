const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const polish = fs.readFileSync(path.join(root, "js/shop-ui-polish.js"), "utf8");
const orionDb = JSON.parse(fs.readFileSync(path.join(root, "data/ORION_season_compact.json"), "utf8"));
assert.match(css, /\.shop-cups\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\);gap:4px\}/, "desktop cup grid must keep five columns");
assert.match(css, /\.shop-tabs\{[^}]*grid-template-columns:1\.45fr repeat\(5,1fr\)/, "desktop tabs must keep six entries on one row");
assert.match(polish, /\.shop-cups\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/, "mobile cup grid must use four columns");
assert.match(polish, /\.shop-cups span:nth-child\(5\)\{grid-column:1\/-1;/, "Orion cup must occupy the full second row on mobile");
assert.match(polish, /\.shop-tabs\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/, "mobile tabs must render as a 3x2 grid");
assert.match(app, /orion: "Comet Pendant"/);
assert.match(polish, /orion: "Comet Pendant"/);
assert.match(polish, /orion: "ORION"/);
const emptyDb = { teams: [], bossOrder: [] };
global.SeasonRegistry = { database: (seasonId) => seasonId === "orion" ? orionDb : emptyDb };
delete require.cache[require.resolve("../js/shop-catalog.js")];
const ShopCatalog = require("../js/shop-catalog.js");
const products = ShopCatalog.build().filter((item) => item.seasonId === "orion");
const expected = {
  raging_bulls: "base", eternal_dancers: "base", arabian_firebirds: "base",
  ace_invaders: "rare", avenging_acrobats: "rare", fallen_angels: "rare",
  pitch_perfectionists: "epic", guardians_of_the_queen: "epic", los_invencibles: "epic", the_sambassadors: "epic",
  inazuma_national_2: "iconic", orion_eclipse: "iconic", zhao_eclipse: "iconic",
};
const excluded = ["alia_academy", "alpine", "backwater_island", "barcelona_orb", "everytown", "kirkwood", "lunar_prime_academy", "polestar_academy", "rampart_junior_high", "royal_academy_ares", "zeus_ares"];
const bossIds = new Set(orionDb.bossOrder.map((boss) => String(boss.teamId)));
assert.equal(products.length, 13, "Orion shop must expose exactly the 13 boss emblems");
assert.deepStrictEqual(new Set(products.map((item) => item.teamId)), bossIds, "Orion shop must match bossOrder exactly");
for (const product of products) assert.equal(product.rarity, expected[product.teamId], `wrong rarity for ${product.teamId}`);
for (const teamId of excluded) assert(!products.some((item) => item.teamId === teamId), `${teamId} must not be sold as an Orion emblem`);
console.log("orion-shop-catalog-layout-test: desktop 5/6, mobile 4+1 cups and 3x2 tabs, 13 boss-only emblems and exact rarities OK");
