"use strict";
const assert = require("assert");
const fs = require("fs");

const playerView = fs.readFileSync("js/player/player-view.js", "utf8");
const squadView = fs.readFileSync("js/squad/squad-view.js", "utf8");
const fiveView = fs.readFileSync("js/five-v-five/five-v-five-view.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/game.css", "utf8");

for (const token of [
  "player-role",
  "player-overall",
  "player-title",
  "player-equipment--footer",
]) {
  assert.ok(
    playerView.includes(token),
    `shared tactical card is missing ${token}`,
  );
}
assert.match(playerView, /equipmentDefinition\s*\?/);
assert.match(playerView, /itemIcon\(equipment\)/);
assert.match(playerView, /equipmentInFooter \? equipmentMarkup/);
assert.match(squadView, /compactPlayerCardMarkup\(player/);
assert.match(fiveView, /compactPlayerCardMarkup\(player/);
assert.match(fiveView, /equipmentInFooter: true/);
for (const token of [
  "five-match-card-portrait",
  "five-match-card-role",
  'aria-pressed="false"',
  "player.name",
]) {
  assert.ok(
    app.includes(token),
    `dedicated match half card is missing ${token}`,
  );
}
assert.doesNotMatch(app, /fivePlayerEquipmentMarkup/);
assert.doesNotMatch(css, /five-player-equipment/);
assert.match(
  css,
  /\.player-equipment--footer \.item-icon img \{[^}]*object-fit: contain;/s,
);
for (const rarity of ["buono", "forte", "elite", "mondiale", "leggenda"]) {
  assert.match(
    css,
    new RegExp(
      `\\.five-match-screen :is\\(\\.rarity-${rarity}\\) \\{ --rarity-border:`,
    ),
  );
}
console.log(
  "tactical-player-card-test: extracted shared card consumers and pitch contract OK",
);
