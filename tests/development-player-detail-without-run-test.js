"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/app.js", "utf8");

function extractFunction(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is present`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1).trim();
  }
  throw new Error(`Cannot extract ${name}`);
}

const adam = {
  playerId: "adam-montayne",
  name: "Adam Montayne",
  position: "FW",
  element: "Fuoco",
  category: "Elite",
  overall: 84,
  potential: 90,
  displayLevel: 20,
  stats: { attack: 91, control: 86, defense: 52 },
  baseStats: { attack: 91, control: 86, defense: 52 },
};

const context = {
  initialRun: null,
  global: {
    InazumaProgression: { getPlayerAtLevel: (player) => player },
    RoguelikeRules: { applyEquipment: (stats) => stats },
    LevelProgression: { formatLevel: (level) => String(level) },
  },
};

vm.runInNewContext(`
  let run = initialRun;
  const freeAgentsDb = { players: [] };
  const seasonDb = { teams: [] };
  const seasonTeamsById = new Map();
  const STAT_LABELS = { attack: "Attacco", control: "Controllo", defense: "Difesa" };
  const modalRoot = { querySelector: () => null };
  let modalMarkup = "";
  const escapeHtml = (value) => String(value ?? "");
  const rarityClass = (category) => "rarity-" + String(category).toLowerCase();
  const rosterEntry = (playerId) => run.roster.find((entry) => String(entry.playerId) === String(playerId));
  const resolvePlayerVisual = () => ({ frontFullbodyUrl: "", portraitUrl: "", detailImageUrl: "adam.png", detailImageKind: "portrait", detailFallbacks: [] });
  const imageFallbackAttributes = () => "";
  const statIcon = () => "";
  const sourcePlayer = () => null;
  const teamLogoMarkup = () => "";
  const resolveItem = () => ({ name: "", description: "", bonus: 0, stat: "" });
  const itemIcon = () => "";
  const playerStatsMarkup = () => "";
  const toast = (message) => { throw new Error(message); };
  const openModal = (markup) => { modalMarkup = markup; };
  const unequipPlayerItem = () => {};
  const closeModal = () => {};
  const renderSquad = () => {};
  ${extractFunction("playerTeamIdentity")}
  ${extractFunction("historicalTeamIdentity")}
  ${extractFunction("playerDetailMarkup")}
  ${extractFunction("showPlayerDetailsFor")}
  ${extractFunction("bindDevelopmentSelectedCardInteraction")}
  this.detail = playerDetailMarkup;
  this.show = showPlayerDetailsFor;
  this.bind = bindDevelopmentSelectedCardInteraction;
  this.markup = () => modalMarkup;
  this.setRun = (value) => { run = value; };
`, context);

function assertDevelopmentDetail(markup) {
  assert.ok(markup, "Player Detail returns non-empty markup");
  assert.match(markup, /Adam Montayne/, "the Development player name is shown");
  assert.match(markup, /Elite/, "the Development rarity is shown");
  assert.match(markup, /Potenziale<\/span><strong>90/, "the Development potential is shown");
  assert.match(markup, /Attacco[\s\S]*91/, "attack is shown");
  assert.match(markup, /Controllo[\s\S]*86/, "control is shown");
  assert.match(markup, /Difesa[\s\S]*52/, "defense is shown");
}

function renderDevelopmentSelectionAndClick(run) {
  context.setRun(run);
  let clickHandler = null;
  const card = {
    dataset: { developmentSelectedCard: adam.playerId },
    addEventListener(type, handler) { if (type === "click") clickHandler = handler; },
  };
  context.bind(card, adam, (selectedPlayer) => context.show(selectedPlayer, {
    readOnly: true,
    equipment: null,
    database: { players: [adam] },
  }));
  assert.ok(clickHandler, "the selected Development card is interactive");
  clickHandler();
  return context.markup();
}

context.setRun(null);
assert.doesNotThrow(() => context.detail(adam, { readOnly: true, equipment: null, database: { players: [adam] } }));
assertDevelopmentDetail(context.detail(adam, { readOnly: true, equipment: null, database: { players: [adam] } }));
assertDevelopmentDetail(renderDevelopmentSelectionAndClick(null));
assertDevelopmentDetail(renderDevelopmentSelectionAndClick({ seasonId: "season-1", roster: [{ playerId: adam.playerId, teamName: "Inazuma Japan" }] }));

console.log("development-player-detail-without-run-test: no-run and active-run Development detail flows OK");
