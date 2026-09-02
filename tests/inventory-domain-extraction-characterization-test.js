"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { SEASON1_CONFIG: { itemPool: [
  { id: "boots_attack", name: "Scarpe", kind: "equipment", stat: "attack", bonus: 2 },
  { id: "energy_drink", name: "Bibita", kind: "consumable", effect: "team_level" },
] } };
context.globalThis = context; vm.createContext(context);
vm.runInContext(fs.readFileSync("js/inventory/inventory-model.js", "utf8"), context);
const model = context.InventoryModel.create({ getItemPool: () => context.SEASON1_CONFIG.itemPool });
assert.equal(model.resolveItem("missing").name, "Oggetto");
assert.equal(model.resolveItem({ itemId: "boots_attack", instanceId: "a" }).instanceId, "a");
const run = { inventory: [{ itemId: "boots_attack", instanceId: "a" }, { itemId: "boots_attack", instanceId: "b" }, { itemId: "energy_drink", instanceId: "c" }], roster: [{ playerId: "p1", equippedItem: { itemId: "boots_attack", instanceId: "d" } }, { playerId: "p2", equippedItem: { itemId: "boots_attack", instanceId: "a" } }] };
const groups = model.groupedOwnedInventoryItems(run);
assert.equal(groups.find(group => group.key === "boots_attack").quantity, 3);
assert.deepEqual(model.inventoryOwnershipSummary(run), { backpackCount: 3, equippedCount: 2, ownedCount: 4, equippedPlayerCount: 2, consumableCount: 1 });
assert.deepEqual(model.inventoryFilterDefinitions(run).map(filter => [filter.id, filter.count]), [["all",4],["equipment",3],["consumable",1],["stat:attack",3]]);
for (const file of ["inventory-model.js", "item-presenter.js", "inventory-controller.js"]) assert.doesNotMatch(fs.readFileSync(`js/inventory/${file}`, "utf8"), /firebase|firestore|InazumaCloudSave|CloudRestore|cloudSave|RunState\.save\s*\(/i);
console.log("inventory domain extraction characterization: grouping, ownership, legacy resolution, filters and cloud gate OK");
const controllerSource = fs.readFileSync("js/inventory/inventory-controller.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
for (const dependency of ["groupedOwnedInventoryItems", "lineupRows", "getSeasonDb", "getFreeAgentsDb"]) assert.match(controllerSource.slice(0, controllerSource.indexOf("const run =")), new RegExp(`\\b${dependency}\\b`));
assert.doesNotMatch(controllerSource, /\bseasonDb\b|\bfreeAgentsDb\b/);
assert.match(appSource, /groupedOwnedInventoryItems[\s\S]*lineupRows[\s\S]*getSeasonDb: \(\) => seasonDb[\s\S]*getFreeAgentsDb: \(\) => freeAgentsDb/);
const cloudCore = require("../js/cloud-save-core.js");
const snapshot = cloudCore.readLocalSnapshot({ RunState: { loadProfile: () => ({}) }, AlbumProgress: { read: () => ({}) }, DevelopmentV2: { read: () => ({}) }, HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 1, _loadArchive: () => ({ teams: [], index: [] }) } });
for (const localKey of ["run", "runs", "inventory", "roster", "lineup", "bench", "activeMatch", "lives", "currentZone", "bossIndex"]) assert.equal(Object.hasOwn(snapshot, localKey), false);
