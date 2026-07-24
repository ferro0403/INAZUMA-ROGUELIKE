"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
require(path.join(root, "js/season1-config.js"));
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");

const expected = {
  energy_drink: ["Onigiri energetico", "https://dxi4wb638ujep.cloudfront.net/1/k/j/9/j9lr9v-ph1c.png", 10, "player_level", 2],
  training_manual: ["Fascia della motivazione", "https://dxi4wb638ujep.cloudfront.net/1/k/d/s/ds-gbxtmuws.png", 12, "team_level", 0.5],
  scout_token: ["Visore scout", "https://dxi4wb638ujep.cloudfront.net/1/k/4/g/4guzyjzrxvk.png", 9, "pull_reroll", 1],
  medical_kit: ["Bendaggio sportivo", "https://dxi4wb638ujep.cloudfront.net/1/k/i/j/ij7xzdibdas.png", 11, "restore_life", 1],
  intensive_training: ["Pesi da allenamento", "https://dxi4wb638ujep.cloudfront.net/1/k/i/y/iyy3nyi8ths.png", 7, "potential_boost", 3],
  lucky_charm: ["Talismano portafortuna", "https://dxi4wb638ujep.cloudfront.net/1/k/j/s/jsqmv5wwkvk.png", 3, "lucky_pull", 1],
  boots_attack: ["Scarpini della Fiamma", "https://dxi4wb638ujep.cloudfront.net/1/k/j/o/jomvfg5z3p8.png", 8, "attack", 5],
  boots_control: ["Scarpini del Ghiaccio", "https://dxi4wb638ujep.cloudfront.net/1/k/k/f/kfe9tshkzpc.png", 8, "control", 5],
  boots_defense: ["Scarpini Imperiali", "https://dxi4wb638ujep.cloudfront.net/1/k/x/4/x4xakdeedrm.png", 8, "defense", 5],
  keeper_gloves: ["Guanti Salva-Porta", "https://dxi4wb638ujep.cloudfront.net/1/k/t/q/tq_np8t-bhu.png", 8, "save", 5],
  grit_band: ["Bracciale della Grinta", "https://dxi4wb638ujep.cloudfront.net/1/k/g/y/gy4nmcoz_s8.png", 8, "grit", 5],
  physical_band: ["Bracciale della Potenza", "https://dxi4wb638ujep.cloudfront.net/1/k/e/b/ebttgdstz2k.png", 8, "physical", 5],
  speed_necklace: ["Collana dell’Uragano", "https://dxi4wb638ujep.cloudfront.net/1/k/a/l/algd4dnn3lk.png", 8, "speed", 5],
  stamina_necklace: ["Collana dell’Atleta", "https://dxi4wb638ujep.cloudfront.net/1/k/s/z/sztfbzdox00.png", 8, "stamina", 5],
};
const pool = global.SEASON1_CONFIG.itemPool;
assert.deepEqual(pool.map((item) => item.id), Object.keys(expected), "item IDs/order must remain stable");
for (const [id, [name, imageUrl, weight, effectOrStat, amountOrBonus]] of Object.entries(expected)) {
  const item = pool.find((candidate) => candidate.id === id);
  assert(item, `${id} exists`);
  assert.equal(item.name, name, `${id} has Italian Zukan name`);
  assert.equal(item.imageUrl, imageUrl, `${id} has central image URL`);
  assert.equal(item.weight, weight, `${id} keeps weight`);
  if (item.kind === "equipment") {
    assert.equal(item.stat, effectOrStat, `${id} keeps stat`);
    assert.equal(item.bonus, amountOrBonus, `${id} keeps +5 bonus`);
  } else {
    assert.equal(item.effect, effectOrStat, `${id} keeps effect`);
    assert.equal(item.amount, amountOrBonus, `${id} keeps amount`);
  }
}
assert(appJs.includes("function resolveItem(itemOrId)") && appJs.includes("...itemOrId, ...definition"), "legacy saved item names resolve through central config by ID");
assert(appJs.includes("function itemIcon(itemOrId)") && appJs.includes("handleItemImageError") && appJs.includes("alt=\"${escapeHtml(name)}\""), "item images use shared renderer, alt text and fallback handler");
assert(appJs.includes("itemRewardCandidateMarkup") && appJs.includes("itemRewardDetailMarkup") && appJs.includes("itemIcon(item)"), "item reward candidates and detail render official item images");
assert(appJs.includes("pull-item-action-copy") && appJs.includes(`const scoutItem = resolveItem("scout_token")`) && appJs.includes(`const luckyItem = resolveItem("lucky_charm")`), "pull item panels use resolved central item data instead of duplicated names");
assert(css.includes(".item-icon--image img") && css.includes("object-fit: contain"), "official item images are contained without distortion");
assert(css.includes(".item-icon--image.item-icon--fallback svg"), "fallback SVG keeps card dimensions when images fail");
assert(/@media \(max-width: 780px\)[\s\S]*?\.inventory-screen \.inventory-item-card \{ grid-template-columns: 52px minmax\(0,1fr\) auto/.test(css), "mobile inventory remains compact and horizontal");
console.log("Item visuals/config tests passed");
