"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const player = { playerId: "p1", name: "Mark", position: "FW", stats: { attack: 50, control: 45, speed: 48, grit: 44, physical: 43, stamina: 42, defense: 30, save: 10 }, overall: 50, finalOverall: 70, category: "Normale" };
const seasonDb = { seasonId: "ie2", players: [player], profiles: [], teams: [], bossOrder: [], formations: { eleven: [{ id: "one", rows: [{ role: "FW", count: 1 }] }] } };
const freeAgentsDb = { marker: "current-free-agents", players: [player] };
const item = (id, instanceId) => ({ ...({
  boots_attack: { itemId: id, id, kind: "equipment", name: "Scarpini della Fiamma", stat: "attack", bonus: 5 },
  boots_control: { itemId: id, id, kind: "equipment", name: "Scarpe controllo", stat: "control", bonus: 5 },
  energy_drink: { itemId: id, id, kind: "consumable", name: "Onigiri energetico", effect: "player_level", amount: 2 },
  medical_kit: { itemId: id, id, kind: "consumable", name: "Bendaggio sportivo", effect: "restore_life", amount: 1 },
  training_manual: { itemId: id, id, kind: "consumable", name: "Fascia", effect: "team_level", amount: 0.5 },
  intensive_training: { itemId: id, id, kind: "consumable", name: "Pesi", effect: "potential_boost", amount: 3 },
})[id], instanceId });
const baseOverrides = {
  FiveVFive: { ensure: current => current.fiveVFive || (current.fiveVFive = {}) },
  FormationLayout: { displayRows: formation => formation.rows },
  RoguelikeRules: { isProfileAwareRosterEntry: () => false, applyEquipment: stats => stats, resolveDevelopmentEffectiveMetadata: () => ({}), defeatedBossRewardLevel: () => 1 },
};
function scenario({ inventory = [], equippedItem = null, lives = 1, overrides = {} } = {}) {
  const storage = new BudgetStorage();
  const bootstrap = load(storage);
  const run = bootstrap.RunState.createRun({ name: "Test" }, "ie2");
  Object.assign(run, { phase: "inventory", formationId: "one", roster: [{ playerId: "p1", source: "ie2", level: 1, equippedItem }], lineup: ["p1"], bench: [], inventory, lives });
  const runtime = load(storage, { fullRuntime: true, run, seasonDb, contextOverrides: { ...baseOverrides, ...overrides } });
  runtime.seam.setContext({ run: runtime.seam.getRun(), seasonDb, freeAgentsDb });
  return { runtime, storage };
}
function render(runtime) { runtime.seam.renderInventory(); }
function click(runtime, selector) { const target = runtime.query(selector); assert(target, `missing real DOM target ${selector}`); target.click(); return target; }
function choosePlayerAndConfirm(runtime) { click(runtime, '[data-item-target-player="p1"]'); const confirm = runtime.query("[data-confirm-equipment-target]"); assert(confirm && !confirm.disabled); confirm.click(); }

// Item detail exercises the delegated card click and groupedOwnedInventoryItems dependency.
{
  const { runtime } = scenario({ inventory: [item("boots_attack", "eq-detail")] });
  render(runtime); click(runtime, '[data-inventory-select="boots_attack"]');
  assert.match(runtime.modalMarkup, /Scarpini della Fiamma/); assert.match(runtime.modalMarkup, /<strong>1<\/strong> nello zaino/); assert.match(runtime.modalMarkup, /Attacco \+5/); assert.match(runtime.modalMarkup, /EQUIPAGGIA/);
}

// Equip through card -> selector -> player -> confirm, then canonical reopen.
{
  const { runtime } = scenario({ inventory: [item("boots_attack", "eq-a")] });
  const generation = runtime.canonical.storageGeneration;
  render(runtime); click(runtime, '[data-equip-item="eq-a"]'); choosePlayerAndConfirm(runtime);
  assert.equal(runtime.canonical.inventory.length, 0); assert.equal(runtime.canonical.roster[0].equippedItem.instanceId, "eq-a"); assert.equal(runtime.canonical.storageGeneration, generation + 1);
  const reopened = runtime.reopen({ seasonDb }); assert.equal(reopened.canonical.roster[0].equippedItem.instanceId, "eq-a"); assert.equal(reopened.canonical.inventory.length, 0);
}

// Unequip through equipped tab, remove and confirmation; the exact instance returns once.
{
  const equipment = item("boots_attack", "eq-u");
  const { runtime } = scenario({ equippedItem: equipment }); render(runtime); click(runtime, '[data-inventory-tab="equipped"]'); click(runtime, '[data-unequip-player="p1"]'); click(runtime, "#confirm-inventory-action");
  assert.equal(runtime.canonical.roster[0].equippedItem, null); assert.deepEqual(runtime.canonical.inventory.map(item => item.instanceId), ["eq-u"]);
  const reopened = runtime.reopen({ seasonDb }); assert.equal(reopened.canonical.roster[0].equippedItem, null); assert.deepEqual(reopened.canonical.inventory.map(item => item.instanceId), ["eq-u"]);
}

// Replace preserves both instance identities and swaps their ownership locations.
{
  const { runtime } = scenario({ equippedItem: item("boots_control", "eq-old"), inventory: [item("boots_attack", "eq-new")] });
  render(runtime); click(runtime, '[data-equip-item="eq-new"]'); choosePlayerAndConfirm(runtime); click(runtime, "#confirm-equip-replace");
  assert.equal(runtime.canonical.roster[0].equippedItem.instanceId, "eq-new"); assert.deepEqual(runtime.canonical.inventory.map(item => item.instanceId), ["eq-old"]);
}

// Player-level consumes via the tactical lineupRows path and persists after reopen.
{
  const { runtime } = scenario({ inventory: [item("energy_drink", "level-a")] }); render(runtime); click(runtime, '[data-use-item="level-a"]'); choosePlayerAndConfirm(runtime); click(runtime, "#confirm-inventory-action");
  assert.equal(runtime.canonical.roster[0].level, 3); assert.equal(runtime.canonical.inventory.length, 0); assert.equal(runtime.reopen({ seasonDb }).canonical.roster[0].level, 3);
}

// Restore-life and team-level retain their production persistence behavior.
{
  const life = scenario({ inventory: [item("medical_kit", "life-a")], lives: 1 }).runtime; render(life); click(life, '[data-use-item="life-a"]'); click(life, "#confirm-inventory-action"); assert.equal(life.canonical.lives, 2); assert.equal(life.canonical.inventory.length, 0);
  const team = scenario({ inventory: [item("training_manual", "team-a")] }).runtime; render(team); click(team, '[data-use-item="team-a"]'); click(team, "#confirm-inventory-action"); assert.equal(team.canonical.inventory.length, 0); assert.equal(team.canonical.roster[0].level, 1.5);
}

// A rapid second equipment confirm observes the item already removed: one commit, no duplicate.
{
  const { runtime } = scenario({ inventory: [item("boots_attack", "eq-double")] }); render(runtime); click(runtime, '[data-equip-item="eq-double"]'); click(runtime, '[data-item-target-player="p1"]'); const confirm = runtime.query("[data-confirm-equipment-target]"); const generation = runtime.canonical.storageGeneration; confirm.click(); confirm.click(); assert.equal(runtime.canonical.storageGeneration, generation + 1); assert.equal(runtime.canonical.roster[0].equippedItem.instanceId, "eq-double");
}


// Potential boost resolves mutable databases at action time, never at controller creation.
for (const profileAware of [false, true]) {
  const received = [];
  const currentSeasonDb = { ...seasonDb, marker: "current-season", requiresProfileAwareRuntime: profileAware };
  const currentFreeAgentsDb = { ...freeAgentsDb, marker: "current-free-agents" };
  const overrides = {
    RoguelikeRules: { ...baseOverrides.RoguelikeRules, isProfileAwareRosterEntry: () => profileAware },
    ProfiledSeasonRuntime: { resolveEffectiveBase: () => player, resolveEffectivePlayerAtLevel: () => ({ ...player, baseStats: player.stats, displayLevel: 1, displayLevelText: "1" }) },
    DevelopmentRuntime: {
      resolvePlayer: () => player, resolveRosterPlayer: () => ({ ...player, baseStats: player.stats }), resolveEffectiveMetadata: value => value,
      rosterEntryPermanentFields: () => ({}), trainingState: () => ({ applications: [], currentLocalBoost: 0, currentOverallBoost: 0, maxLocalBoost: 99, remainingBoost: 99 }),
      planIntensiveTraining: (_run, _player, _entry, _amount, database) => { received.push(database); return { codexDeltas: {} }; },
    },
  };
  const { runtime } = scenario({ inventory: [item("intensive_training", `potential-${profileAware}`)], overrides });
  runtime.seam.setContext({ run: runtime.seam.getRun(), seasonDb: currentSeasonDb });
  runtime.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ run: runtime.seam.getRun(), seasonDb: currentSeasonDb, freeAgentsDb: currentFreeAgentsDb });
  render(runtime); click(runtime, `[data-use-item="potential-${profileAware}"]`); choosePlayerAndConfirm(runtime); click(runtime, "#confirm-inventory-action");
  assert.strictEqual(received.at(-1), profileAware ? currentSeasonDb : currentFreeAgentsDb);
  assert.equal(runtime.canonical.inventory.length, 0);
}

// Extraction parity on persistence failures: rollback canonical/runtime, then a real UI retry succeeds.
{
  const { runtime } = scenario({ inventory: [item("boots_attack", "eq-fail")] });
  const originalSave = runtime.context.RunState.save; let fail = true;
  runtime.context.RunState.save = value => { if (fail) { fail = false; const error = new Error("quota"); error.name = "QuotaExceededError"; throw error; } return originalSave(value); };
  render(runtime); click(runtime, '[data-equip-item="eq-fail"]'); choosePlayerAndConfirm(runtime);
  assert.equal(runtime.canonical.inventory[0].instanceId, "eq-fail"); assert.equal(runtime.canonical.roster[0].equippedItem, null); assert.equal(runtime.seam.getRun().inventory[0].instanceId, "eq-fail");
  render(runtime); click(runtime, '[data-equip-item="eq-fail"]'); choosePlayerAndConfirm(runtime); assert.equal(runtime.canonical.roster[0].equippedItem.instanceId, "eq-fail");
}
{
  const { runtime } = scenario({ equippedItem: item("boots_attack", "eq-unequip-fail") });
  const originalSave = runtime.context.RunState.save; let fail = true;
  runtime.context.RunState.save = value => { if (fail) { fail = false; const error = Object.assign(new Error("stale"), { code: "stale-write" }); throw error; } return originalSave(value); };
  render(runtime); click(runtime, '[data-inventory-tab="equipped"]'); click(runtime, '[data-unequip-player="p1"]'); click(runtime, "#confirm-inventory-action");
  assert.equal(runtime.canonical.roster[0].equippedItem.instanceId, "eq-unequip-fail"); assert.equal(runtime.canonical.inventory.length, 0); assert.equal(runtime.seam.getRun().roster[0].equippedItem.instanceId, "eq-unequip-fail");
  render(runtime); click(runtime, '[data-inventory-tab="equipped"]'); click(runtime, '[data-unequip-player="p1"]'); click(runtime, "#confirm-inventory-action"); assert.equal(runtime.canonical.roster[0].equippedItem, null); assert.equal(runtime.canonical.inventory[0].instanceId, "eq-unequip-fail");
}

console.log("inventory equipment production path: detail, equip, unequip, replace, consumables, double tap and reopen OK");
