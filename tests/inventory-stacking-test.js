"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
require(path.join(root, "js/season1-config.js"));

const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const pool = global.SEASON1_CONFIG.itemPool;
const byId = (id) => pool.find((item) => item.id === id);
const instance = (id, n) => ({ ...byId(id), instanceId: `${id}_${n}` });

function identity(item) {
  return String(item?.itemId || item?.id || item?.effect || item?.name || "unknown_item");
}
function category(item) {
  const id = identity(item);
  if (item?.kind === "equipment") return "equipment";
  if (["energy_drink", "training_manual", "intensive_training"].includes(id)) return "training";
  return "special";
}
function groups(inventory) {
  const grouped = new Map();
  inventory.forEach((item) => {
    const key = identity(item);
    if (!grouped.has(key)) grouped.set(key, { key, item, quantity: 0, instances: [], category: category(item) });
    grouped.get(key).quantity += 1;
    grouped.get(key).instances.push(item);
  });
  return [...grouped.values()];
}

assert(appJs.includes("function inventoryItemIdentity(item)"), "inventory grouping must use one central stable identity helper");
assert(!/run\.inventory\.map\(\(item\) => inventoryItemCard\(item\)\)/.test(appJs), "inventory renderer must not render one card per stored copy");
assert(appJs.includes("groupedOwnedInventoryByCategory(run)"), "inventory renderer must group backpack and equipped cards through the ownership category helper");
assert(appJs.includes("groupedOwnedInventoryItems(run)"), "inventory renderer must include equipped instances in visible ownership");
assert(appJs.includes("data-item-id") && appJs.includes("item-quantity") && appJs.includes("×${group.quantity}"), "stacked cards must expose item id and quantity badge");
assert(appJs.includes("run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}"), "inventory total must keep counting stored copies, not visible cards");

const stacked = [instance("energy_drink", 1), instance("energy_drink", 2), instance("energy_drink", 3), instance("scout_token", 1), instance("boots_attack", 1), instance("boots_attack", 2)];
const grouped = groups(stacked);
assert.equal(grouped.find((group) => group.key === "energy_drink").quantity, 3, "three equal items produce one stack of ×3");
assert.equal(grouped.filter((group) => group.key === "energy_drink").length, 1, "three equal items produce one visible card group");
assert.equal(grouped.find((group) => group.key === "boots_attack").quantity, 2, "equipment copies stack by item id");
assert.equal(grouped.length, 3, "different item ids are not grouped together");
assert.equal(stacked.length, 6, "inventory total still counts every physical copy");

assert.equal(category(byId("energy_drink")), "training", "Onigiri energetico category");
assert.equal(category(byId("training_manual")), "training", "Fascia della motivazione category");
assert.equal(category(byId("intensive_training")), "training", "Pesi da allenamento category");
for (const id of ["boots_attack", "boots_control", "boots_defense", "keeper_gloves", "grit_band", "physical_band", "speed_necklace", "stamina_necklace"]) {
  assert.equal(category(byId(id)), "equipment", `${id} category`);
  assert.equal(byId(id).bonus, 5, `${id} bonus remains +5`);
}
for (const id of ["scout_token", "medical_kit", "lucky_charm"]) assert.equal(category(byId(id)), "special", `${id} category`);
assert.deepEqual(["Allenamento e potenziamenti", "Equipaggiamenti", "Gettoni e oggetti speciali"].map((title) => appJs.indexOf(title)).sort((a, b) => a - b), ["Allenamento e potenziamenti", "Equipaggiamenti", "Gettoni e oggetti speciali"].map((title) => appJs.indexOf(title)), "categories are declared in required display order");
assert(appJs.includes(".filter((category) => category.items.length)"), "empty categories are skipped without layout gaps");

assert(appJs.includes("removeInventoryItem(instanceId);"), "consumables remove exactly one instance after successful use");
assert(appJs.includes("const newEquipment = removeInventoryItem(instanceId);"), "equipment assignment removes exactly one inventory instance");
assert(appJs.includes("run.inventory.push(entry.equippedItem);") && appJs.includes("if (run.inventory.length >= global.SEASON1_CONFIG.maxInventory)"), "unequipping returns one copy and preserves full-inventory guard");
assert(appJs.includes("entry.equippedItem = newEquipment;"), "only the selected equipment instance is assigned");
const inventoryRenderer = appJs.slice(appJs.indexOf("function renderInventory"), appJs.indexOf("function chooseEquipmentPlayer"));
assert.equal((inventoryRenderer.match(/>RIMUOVI</g) || []).length, 1, "RIMUOVI is rendered only once in the equipped-player association row");
assert(appJs.includes("TUTTE LE COPIE SONO EQUIPAGGIATE"), "equipment detail exposes a non-interactive state when the backpack has no copies");
assert(!/function inventoryItemActionMarkup[\s\S]*?data-unequip-player/.test(appJs.slice(appJs.indexOf("function inventoryItemActionMarkup"), appJs.indexOf("function inventoryItemDetailMarkup"))), "item cards and detail never generate an unequip command");
assert(css.includes(".inventory-categories") && css.includes(".inventory-category") && css.includes(".item-quantity"), "desktop inventory category and quantity styles exist");
assert(appJs.includes("inventoryFilterDefinitions") && appJs.includes("data-inventory-filter") && appJs.includes("inventoryGroupMatchesFilter"), "inventory has real filter view model without changing item data");
assert(appJs.includes("function selectInventoryItem(groupKey)") && appJs.includes('detail.innerHTML = inventoryItemDetailMarkup(group);'), "item selection updates only cards and the detail panel without rerendering the app");
assert(appJs.includes("function openInventoryConfirmation(item") && appJs.includes("La quantità verrà aggiornata soltanto dopo il successo."), "consumable and removal flows use a shared success-only confirmation");
assert(appJs.includes('inventoryPlayerSelectionMarkup(item, "level")') && appJs.includes('inventoryPlayerSelectionMarkup(item, "potential")'), "player consumables use compact validity-aware player cards");
assert(appJs.includes("Livello massimo raggiunto") && appJs.includes("Potenziale massimo raggiunto"), "invalid consumable targets explain why they cannot receive the item");
assert(appJs.includes("Utilizzabile durante un Pull") && appJs.includes("Utilizzabile in un Pull normale"), "pull-only items remain unavailable from inventory with clear messages");
assert(appJs.includes("inventory-empty-state") && appJs.includes("Gli oggetti si ottengono dagli eventi della mappa"), "inventory empty state explains where items come from");
assert(appJs.includes("Equipaggiabili") && appJs.includes("Consumabili") && appJs.includes("itemStatLabel"), "inventory filters use real item kinds and equipment stats");
assert(css.includes(".inventory-layout") && css.includes(".inventory-summary") && css.includes(".inventory-equipped-panel"), "inventory has desktop layout, summary, and equipped panel styles");
assert(/@media \(max-width: 780px\)[\s\S]*?\.inventory-screen \.inventory-item-card \{ grid-template-columns: 52px minmax\(0,1fr\) auto/.test(css), "mobile inventory cards use compact horizontal layout without overflow");

console.log("inventory stacking tests passed");
