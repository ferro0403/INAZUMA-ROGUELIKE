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

const controllerSource = fs.readFileSync(
  "js/development/development-center-controller.js",
  "utf8",
);
const bindStart = controllerSource.indexOf(
  "function bindDevelopmentSelectedCardInteraction",
);
const bindEnd = controllerSource.indexOf(
  "function developmentManagementPathMarkup",
  bindStart,
);
assert.ok(bindStart >= 0 && bindEnd > bindStart);
vm.runInContext(
  `${controllerSource.slice(bindStart, bindEnd)}; globalThis.bindDevelopmentSelectedCardInteraction = bindDevelopmentSelectedCardInteraction;`,
  context,
);

const stats = {
  attack: 91,
  control: 86,
  speed: 80,
  grit: 79,
  physical: 78,
  stamina: 77,
  defense: 52,
  save: 20,
};
const adam = {
  playerId: "adam-montayne",
  name: "Adam Montayne",
  position: "FW",
  element: "Fuoco",
  category: "Elite",
  overall: 84,
  potential: 90,
  displayLevel: 20,
  stats,
  baseStats: stats,
};
let run = null;
let modalMarkup = "";
const modalRoot = { querySelector: () => null };
const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () => new Map(),
  escapeHtml: String,
});
const view = context.PlayerView.create({
  visuals,
  escapeHtml: String,
  resolveItem: (item) => item,
  itemIcon: () => "",
  getProgression: () => ({ getPlayerAtLevel: (player) => player }),
  applyEquipment: (value) => value,
  formatLevel: String,
  getSeasonId: () => run?.seasonId,
  sourcePlayer: () => null,
  playerTeamIdentity: (player, playerId) => {
    const entry = run?.roster?.find(
      (candidate) => String(candidate.playerId) === String(playerId),
    );
    return {
      name: entry?.teamName || player.teamName || "Svincolato",
      logoUrl: "",
      logo: "",
    };
  },
  historicalTeamIdentity: () => ({
    name: "Svincolato",
    logoUrl: "",
    logo: "",
  }),
  teamLogoMarkup: () => "",
  playerStatsMarkup: () => "",
});
const detailController = context.PlayerDetailController.create({
  view,
  openModal: (markup) => {
    modalMarkup = markup;
  },
  closeModal: () => {},
  toast: (message) => {
    throw new Error(message);
  },
  getModalRoot: () => modalRoot,
  getFreeAgentsDb: () => ({ players: [adam] }),
  getRosterEntry: () => null,
  resolveRosterPlayer: () => null,
  databaseForEntry: () => ({ players: [adam] }),
  unequipPlayerItem: () => {},
  renderSquad: () => {},
});

function assertDevelopmentDetail(markup) {
  assert.ok(markup, "Player Detail returns non-empty markup");
  assert.match(markup, /Adam Montayne/);
  assert.match(markup, /Elite/);
  assert.match(markup, /Potenziale[\s\S]*90/);
  assert.match(markup, /Attacco[\s\S]*91/);
  assert.match(markup, /Controllo[\s\S]*86/);
  assert.match(markup, /Difesa[\s\S]*52/);
  assert.strictEqual((markup.match(/player-stat-card/g) || []).length, 8);
}

function selectedCardClick(currentRun) {
  run = currentRun;
  modalMarkup = "";
  let clickHandler = null;
  const card = {
    dataset: { developmentSelectedCard: adam.playerId },
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
  };
  context.bindDevelopmentSelectedCardInteraction(
    card,
    adam,
    (selectedPlayer, playerId) =>
      detailController.showFor(selectedPlayer, {
        playerId,
        readOnly: true,
        database: { players: [adam] },
      }),
  );
  assert.ok(clickHandler, "Development selected card binds a click handler");
  clickHandler({ type: "click" });
  return modalMarkup;
}

assertDevelopmentDetail(selectedCardClick(null));
assertDevelopmentDetail(
  selectedCardClick({
    seasonId: "season-1",
    roster: [{ playerId: adam.playerId, teamName: "Inazuma Japan" }],
  }),
);

console.log(
  "development-player-detail-without-run-test: selected-card controller path works without and with active run",
);
