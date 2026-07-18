"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");

const equippedRenderer = appJs.slice(appJs.indexOf("function renderInventory"), appJs.indexOf("function chooseEquipmentPlayer"));

assert(equippedRenderer.includes('class="equipped-player"'), "equipped item cards render a dedicated owner portrait block");
assert(equippedRenderer.includes('class="equipped-player-portrait"') && equippedRenderer.includes('class="equipped-player-copy"'), "owner portrait and copy have scoped inventory classes");
assert(equippedRenderer.includes('src="${escapeHtml(playerPortraitUrl(resolved || player))}"'), "equipped owner portrait uses the shared player portrait resolver and fallback");
assert(equippedRenderer.includes('${escapeHtml(player.name)} · ${escapeHtml(player.position)}'), "owner name and role are rendered from the same player used for the equipped card");
assert(equippedRenderer.includes('data-unequip-player="${entry.playerId}"'), "remove button remains associated to the equipped player id");
assert(equippedRenderer.includes('${escapeHtml(itemStatLabel(item.stat))} ${resolved.baseStats[item.stat]} → <strong>${resolved.stats[item.stat]}</strong>'), "stat delta remains tied to the resolved equipped player stats");
assert(equippedRenderer.includes('filter((entry) => entry.equippedItem)') && equippedRenderer.includes('entry, player: sourcePlayer(entry), resolved: resolvedRosterPlayer(entry.playerId), item: resolveItem(entry.equippedItem)'), "equipped cards still derive player, player id and item from the roster entry");
assert(!equippedRenderer.includes('playerPortraitUrl(run.roster') && !equippedRenderer.includes('run.roster[0]'), "equipped cards do not render another player's portrait");
assert(appJs.includes('function playerPortraitUrl(player)') && appJs.includes('data:image/svg+xml'), "shared player portrait resolver keeps the existing fallback for missing portraits");
assert(!appJs.includes('function compactPlayerCardMarkup(player, { equipment = null') || appJs.includes('<img class="player-portrait" src="${escapeHtml(playerPortraitUrl(player))}"'), "shared player card renderer portrait markup remains unchanged");
assert(css.includes('.equipped-player-portrait') && css.includes('width: 42px') && css.includes('height: 42px') && css.includes('object-fit: contain'), "equipped portrait has fixed, contained desktop sizing");
assert(/@media \(max-width: 780px\)[\s\S]*?\.equipped-player-portrait \{ width: 40px; height: 40px; \}/.test(css), "mobile equipped portraits stay compact");

console.log("equipped item portrait tests passed");
