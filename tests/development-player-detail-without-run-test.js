"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null, Map, Set, JSON };
context.globalThis = context;
vm.createContext(context);
for (const file of [
  "js/player/player-visuals.js",
  "js/player/player-view.js",
  "js/player/player-detail-controller.js",
]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const stats = {
  attack: 50,
  control: 50,
  speed: 50,
  grit: 50,
  physical: 50,
  stamina: 50,
  defense: 50,
  save: 50,
};
const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () => new Map(),
  escapeHtml: String,
});
const view = context.PlayerView.create({
  visuals,
  escapeHtml: String,
  resolveItem: (item) => item,
  itemIcon: () => "",
  getProgression: () => ({
    getPlayerAtLevel: (player) => ({
      ...player,
      overall: 50,
      potential: 60,
      stats,
      baseStats: stats,
    }),
  }),
  applyEquipment: (value) => value,
  formatLevel: String,
  getSeasonId: () => undefined,
  sourcePlayer: () => null,
  playerTeamIdentity: (player) => ({
    name: player.teamName || "Svincolato",
    logoUrl: "",
    logo: "",
  }),
  historicalTeamIdentity: () => ({ name: "Svincolato", logoUrl: "", logo: "" }),
  teamLogoMarkup: () => "",
  playerStatsMarkup: () => "",
});
const player = {
  playerId: "dev",
  name: "Development Player",
  position: "MF",
  element: "Vento",
  category: "Normale",
  finalOverall: 60,
  stats,
};
assert.doesNotThrow(() =>
  view.detailMarkup(player, { mode: "current", readOnly: true }),
);
const markup = view.detailMarkup(player, { mode: "current", readOnly: true });
assert.match(markup, /Development Player/);
assert.strictEqual((markup.match(/player-stat-card/g) || []).length, 8);
console.log(
  "development player detail without run: injected PlayerView works without Run authority",
);
