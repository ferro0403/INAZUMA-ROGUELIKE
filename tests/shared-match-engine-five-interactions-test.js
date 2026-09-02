"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [
  { key: "GK", role: "GK", line: "goal" }, { key: "DF", role: "DF", line: "defense" },
  { key: "MF1", role: "MF", line: "midfield" }, { key: "MF2", role: "MF", line: "midfield" },
  { key: "FW", role: "FW", line: "attack" },
] };
const players = (prefix) => formation.slots.map((slot, index) => ({ playerId: `${prefix}-${index}`, name: `${prefix} ${index}`, position: slot.role, overall: 60 + index, finalOverall: 60 + index, category: "Normale", stats: { attack: 50, control: 50, defense: 50, speed: 50, save: 50, grit: 50 } }));
const users = players("user");
const opponents = players("opponent");
const seasonDb = { seasonId: "ie1", players: users, teams: [], formations: { eleven: [{ id: "4-3-3", requirements: {}, slotRoles: [] }] }, bossOrder: [{ teamId: "boss", teamName: "Boss" }] };
const freeAgentsDb = { marker: "expected-free-agents", players: opponents };
const FiveVFive = { formations: [formation], formationById: () => formation, emptySlots: () => ({}), ensure: (run) => run.fiveVFive,
  validate: () => ({ valid: true, formation, assignedCount: 5, messages: [] }) };

function run(id) {
  return { version: 2, runId: id, seasonId: "ie1", phase: "match", bossIndex: 0, teamLevel: 0, lives: 2, consecutiveLosses: 0,
    roster: users.map((player) => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: [], bench: [], inventory: [], statistics: {}, formationId: "4-3-3", teamIdentity: { name: "Raimon" },
    fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, index) => [slot.key, users[index].playerId])) },
    activeMatch: { matchId: `${id}-match`, type: "five_v_five", nodeId: "five-node", previousNodeId: "start", attemptNumber: 1, state: "pre-match", score: [0, 0], log: [], opponents: opponents.map((player, index) => ({ playerId: player.playerId, slotKey: formation.slots[index].key })), opponentFormation: formation.id },
    currentZone: { currentNodeId: "five-node", pendingNodeId: null, startNodeId: "start", completedNodeIds: [], path: ["start"], nodes: [{ id: "start", type: "start", layer: 0 }, { id: "five-node", type: "five_v_five", layer: 1 }], edges: [["start", "five-node"]] } };
}

function open(id) {
  const rt = load(new BudgetStorage(Infinity), { run: run(id), seasonDb, contextOverrides: { FiveVFive } });
  rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb });
  rt.context.SeasonRegistry.player = (playerId) => users.find((player) => player.playerId === String(playerId));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.MatchSimulator.simulate = ({ seed }) => ({ valid: true, seed, winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 }, timeline: [], probabilities: {}, userStrength: {}, opponentStrength: {} });

  const document = rt.context.document;
  const userCard = document.createElement("button"); Object.assign(userCard.dataset, { fiveMatchPlayer: users[0].playerId, fiveMatchSlot: "GK", fiveMatchSide: "user" });
  const opponentCard = document.createElement("button"); Object.assign(opponentCard.dataset, { fiveMatchPlayer: opponents[0].playerId, fiveMatchSlot: "GK", fiveMatchSide: "opponent" });
  const detail = document.createElement("aside");
  const sheet = document.createElement("button");
  const close = document.createElement("button");
  detail.closest = () => null;
  detail.querySelector = (selector) => selector === "[data-five-detail-sheet]" ? sheet : selector === "[data-five-detail-close]" ? close : null;
  let pickerMarkup = "";
  const picker = document.createElement("div"); picker.contains = () => true;
  const field = document.createElement("div");
  field.insertAdjacentHTML = (_where, markup) => { pickerMarkup = markup; };
  field.querySelector = (selector) => selector === ".five-selector" && pickerMarkup ? picker : null;
  const originalQuerySelector = document.querySelector.bind(document);
  const originalQuerySelectorAll = document.querySelectorAll.bind(document);
  document.querySelectorAll = (selector) => selector === "[data-five-match-slot]" || selector === "[data-five-match-player]" ? [userCard, opponentCard] : originalQuerySelectorAll(selector);
  document.querySelector = (selector) => selector === ".five-match-mobile-field" ? field : selector === "[data-five-player-detail]" ? detail : originalQuerySelector(selector);
  return { rt, userCard, opponentCard, detail, sheet, pickerMarkup: () => pickerMarkup };
}

{
  const { rt, userCard, pickerMarkup } = open("interactions-user");
  const before = rt.canonical;
  rt.seam.renderMatch({ allowAutomaticResume: false });
  userCard.click();
  assert.match(pickerMarkup(), /five-selector/, "user card reaches the real 5v5 picker");
  assert.deepStrictEqual(rt.canonical, before, "opening the picker is read-only");
}
{
  const { rt, opponentCard, detail, sheet } = open("interactions-opponent");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  opponentCard.click();
  assert.strictEqual(detail.hidden, false);
  assert.match(detail.innerHTML, /opponent 0/);
  sheet.click();
  assert.match(rt.modalMarkup, /opponent 0/, "full detail uses the dynamically supplied Free Agents database");
}
{
  const { rt } = open("interactions-edit-success");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  rt.context.document.getElementById("edit-five-team").click();
  assert.strictEqual(rt.canonical.phase, "five");
  assert.match(rt.seam.getAppMarkup(), /class="screen five-screen"/, "renderFiveVFive was reached after commit");
}
{
  const { rt } = open("interactions-edit-failure");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  const before = rt.canonical;
  rt.context.RunState.save = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  rt.context.document.getElementById("edit-five-team").click();
  assert.deepStrictEqual(rt.canonical, before, "failed edit does not report a canonical mutation success");
  assert.strictEqual(rt.seam.getRun().activeMatch.state, "pre-match");
  assert.match(rt.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/, "renderMapFailureRecovery was reached");
  assert.doesNotMatch(rt.seam.getAppMarkup(), /ReferenceError/);
}
console.log("shared Match Engine 5v5 interactions: user picker, opponent detail, edit success/failure OK");
