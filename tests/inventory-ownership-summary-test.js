"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
require(path.join(root, "js/season1-config.js"));

const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
assert(appJs.includes("function inventoryOwnershipSummary(run)"), "inventory ownership summary helper exists");
assert(appJs.includes("inventoryOwnershipSummary, categories"), "helper is exposed through InventoryHelpers");
assert(appJs.includes("const ownershipSummary = inventoryOwnershipSummary(run);"), "inventory renderer uses the ownership summary helper");
assert(!appJs.includes("const totalItems = run.inventory.length;"), "owned item count no longer mirrors backpack length directly");
assert(appJs.includes("Nello zaino ${ownershipSummary.backpackCount}/${global.SEASON1_CONFIG.maxInventory}"), "capacity label remains backpack-only");

const noopElement = () => ({
  innerHTML: "",
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
  closest() { return null; },
  setAttribute() {},
  removeAttribute() {},
});

const context = {
  console,
  setTimeout,
  clearTimeout,
  location: { hostname: "localhost", search: "" },
  document: { getElementById: noopElement, querySelector: noopElement, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  SEASON1_CONFIG: global.SEASON1_CONFIG,
  fetch: () => new Promise(() => {}),
};
context.window = context;
context.history = { scrollRestoration: "auto", replaceState() {} };
context.globalThis = context;
vm.runInNewContext(appJs, context, { filename: "js/app.js" });

const { inventoryOwnershipSummary } = context.InventoryHelpers;
const equipment = (id, instanceId) => ({ id, itemId: id, instanceId, kind: "equipment", stat: "attack", bonus: 5 });
const consumable = (id, instanceId) => ({ id, itemId: id, instanceId, kind: "consumable", effect: "player_level", amount: 1 });
const runWith = (inventory, equippedItems) => ({
  inventory,
  roster: equippedItems.map((item, index) => ({ playerId: `p${index + 1}`, equippedItem: item })),
});

let summary = inventoryOwnershipSummary(runWith([], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
assert.deepEqual(summary, { backpackCount: 0, equippedCount: 2, ownedCount: 2, equippedPlayerCount: 2, consumableCount: 0 }, "empty backpack with two equipped items counts both as owned");

summary = inventoryOwnershipSummary(runWith([equipment("boots_defense", "eq-3")], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
assert.equal(summary.ownedCount, 3, "one backpack equipment plus two equipped items are owned");
assert.equal(summary.equippedCount, 2, "two equipment instances are equipped");
assert.equal(summary.backpackCount, 1, "one item remains in the backpack");

summary = inventoryOwnershipSummary(runWith([consumable("energy_drink", "c-1")], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
assert.equal(summary.ownedCount, 3, "backpack consumable plus equipped items are owned before use");
assert.equal(summary.consumableCount, 1, "unused consumable in backpack is counted");

const beforeUse = inventoryOwnershipSummary(runWith([consumable("energy_drink", "c-1")], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
const afterUse = inventoryOwnershipSummary(runWith([], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
assert.equal(afterUse.ownedCount, beforeUse.ownedCount - 1, "used consumable removal decreases owned count by one");
assert.equal(afterUse.consumableCount, beforeUse.consumableCount - 1, "used consumable removal decreases consumable count by one");
assert.equal(afterUse.equippedCount, beforeUse.equippedCount, "using a consumable does not change equipped count");

const beforeUnequip = inventoryOwnershipSummary(runWith([], [equipment("boots_attack", "eq-1"), equipment("boots_control", "eq-2")]));
const afterUnequip = inventoryOwnershipSummary(runWith([equipment("boots_attack", "eq-1")], [equipment("boots_control", "eq-2")]));
assert.equal(afterUnequip.ownedCount, beforeUnequip.ownedCount, "unequipping returns the same instance to backpack without changing owned count");
assert.equal(afterUnequip.equippedCount, beforeUnequip.equippedCount - 1, "unequipping decreases equipped count");
assert.equal(afterUnequip.backpackCount, beforeUnequip.backpackCount + 1, "unequipping increases backpack count");

summary = inventoryOwnershipSummary(runWith([equipment("boots_attack", "old-eq")], [equipment("boots_control", "new-eq")]));
assert.equal(summary.ownedCount, 2, "replacement keeps outgoing and incoming equipment ownership coherent");
assert.equal(summary.equippedCount, 1, "replacement leaves one equipped item");
assert.equal(summary.backpackCount, 1, "replacement returns one item to backpack");

const duplicate = equipment("boots_attack", "legacy-dup");
summary = inventoryOwnershipSummary(runWith([duplicate], [duplicate]));
assert.equal(summary.ownedCount, 1, "legacy duplicate with same instanceId is counted once");
assert.equal(summary.backpackCount, 1, "legacy duplicate still occupies its backpack slot for capacity");
assert.equal(summary.equippedCount, 1, "legacy duplicate still reports equipped assignment");

summary = inventoryOwnershipSummary(runWith([equipment("boots_attack", "copy-1"), equipment("boots_attack", "copy-2")], []));
assert.equal(summary.ownedCount, 2, "two distinct copies of the same itemId are both owned");
summary = inventoryOwnershipSummary(runWith([{ id: "boots_attack", itemId: "boots_attack", kind: "equipment" }, { id: "boots_attack", itemId: "boots_attack", kind: "equipment" }], []));
assert.equal(summary.ownedCount, 2, "legacy copies without instanceId are not deduplicated by itemId");

console.log("inventory ownership summary tests passed");
