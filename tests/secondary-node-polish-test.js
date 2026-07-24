"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");

assert(appJs.includes('function resolveTradeNode(node)'), "trade node keeps its single renderer");
assert(appJs.includes('function resolveRandomNode(node)'), "random node keeps its reveal renderer");
assert(appJs.includes('function resolveItemNode(node)'), "item node keeps its real item-choice renderer");
assert(!appJs.includes('eventType === "training"') && !appJs.includes("resolveTrainingNode"), "training node screen was not introduced");
assert(appJs.includes('className: "trade-modal"') && appJs.includes('trade-flow-summary'), "trade screen exposes a compact offer/receive summary");
assert(appJs.includes('className: "random-event-modal"') && appJs.includes('Evento casuale'), "random reveal is presented as the existing random-event flow");
assert(appJs.includes('className: "item-reward-modal"') && appJs.includes('OGGETTO TROVATO'), "item reward uses the dedicated found-item presentation");
assert(appJs.includes('global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:trade:${outgoingId}`)'), "trade seed remains unchanged");
assert(appJs.includes('global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}`)'), "item seed remains unchanged");
assert(appJs.includes('global.MapEngine.resolveRandomNodeType(run, node)'), "random node resolution remains delegated to MapEngine");
assert(css.includes('.trade-node-head') && css.includes('.random-event-modal') && css.includes('.item-reward-modal'), "secondary node styles are scoped");
assert(appJs.includes("pendingItemReward") && appJs.includes("candidateIds") && appJs.includes("claimedInstanceId"), "item reward persists candidates and the claimed instance");
assert(appJs.includes("resumePendingItemReward()") && appJs.includes('pendingType === "item"'), "normal and revealed random item nodes resume after refresh");
assert(appJs.includes("itemRewardOwnedQuantity(item)") && appJs.includes("run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}"), "item reward shows owned quantity and current inventory use");
assert(appJs.includes("itemIcon(item)") && appJs.includes("itemRewardUsageNote(item)"), "item reward reuses real item imagery and existing usage rules");
assert(appJs.includes('item.effect === "pull_reroll" || item.effect === "lucky_pull"') && appJs.includes("Utilizzabile durante un Pull previsto."), "pull-only items are collected with the correct usage note");
assert(appJs.includes('item.kind === "equipment" ? "AGGIUNGI AGLI OGGETTI" : "PRENDI"'), "equipment and other items expose the appropriate acquisition action");
assert(appJs.includes('pending.status = "claimed"') && appJs.includes('pending.claimedInstanceId = instance.instanceId'), "successful claims become idempotent before returning to the map");
assert(appJs.includes('id="finish-item-reward"') && appJs.includes("run.pendingItemReward = null"), "completed reward leaves only the return-to-map step");
assert(appJs.includes('chooseInventoryDiscard("Inventario pieno: scegli un oggetto da eliminare"'), "full inventory reuses the existing space-management flow");
assert(css.includes('url("../assets/home/inazuma-stadium-desktop-light.jpeg")') && css.includes('url("../assets/home/inazuma-stadium-mobile-light.jpeg")'), "item reward uses the approved local stadium backgrounds");

function cssBlocksFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1]).join("\n");
}

const exchangeActionsIndex = appJs.indexOf('class="node-actions exchange-actions trade-actions"');
const exchangeContentCloseIndex = appJs.indexOf('</main>\n        <div class="node-actions exchange-actions trade-actions"');
const itemActionsIndex = appJs.indexOf('class="node-actions item-reward-actions"');
const itemContentCloseIndex = appJs.indexOf('</main>\n        <div class="node-actions item-reward-actions"');
const exchangeActionsCss = cssBlocksFor(".exchange-actions, .item-reward-actions") + "\n" + cssBlocksFor(".exchange-actions") + "\n" + cssBlocksFor(".exchange-actions .btn, .item-reward-actions .btn");
const scopedActionCss = exchangeActionsCss + "\n" + cssBlocksFor(".item-reward-actions");

assert(appJs.includes('<section class="exchange-screen">') && appJs.includes('<main class="exchange-content">'), "trade screen has explicit content flow before actions");
assert(exchangeContentCloseIndex !== -1 && exchangeActionsIndex > exchangeContentCloseIndex, "trade actions are after all exchange content in the DOM");
assert(appJs.includes('<section class="item-reward-screen">') && appJs.includes('<main class="item-reward-content">'), "item reward screen has explicit content flow before actions");
assert(itemContentCloseIndex !== -1 && itemActionsIndex > itemContentCloseIndex, "item reward actions are after all item content in the DOM");
assert(!/class="[^"]*(?:sticky-actions|fixed-actions|action-dock|floating-actions|mobile-action-bar|bottom-action-bar)[^"]*"/.test(appJs), "exchange and item reward do not reuse fixed/sticky action-bar classes");
assert(!/position\s*:\s*(?:fixed|sticky|absolute)/.test(scopedActionCss), "exchange and item reward action CSS does not use fixed, sticky, or absolute positioning");
assert(!/\bbottom\s*:\s*0\b|inset-block-end|translateY\(/.test(scopedActionCss), "exchange and item reward actions are not bottom-docked or translated");
assert(css.includes('.exchange-screen, .item-reward-screen { display: block; padding-bottom: calc(96px + env(safe-area-inset-bottom)); }'), "screens keep normal end padding for global bottom navigation clearance");
assert(appJs.includes('id="continue-trade"') && appJs.includes('document.getElementById("continue-trade").addEventListener("click", () => prepareTrade(node, ui.tradeSelectedPlayerId))'), "trade proceed button remains wired");
assert(appJs.includes('id="skip-trade"') && appJs.includes('finishNonMatchNode(node, "Hai rinunciato allo scambio")'), "trade skip button remains wired");
assert(appJs.includes('id="skip-item"') && appJs.includes('finishNonMatchNode(node, "Hai rinunciato all\'oggetto")'), "item reward skip button remains wired");

assert(/@media \(max-width: 780px\)[\s\S]*?\.trade-modal, \.trade-confirm-modal, \.trade-result-modal, \.random-event-modal, \.item-reward-modal/.test(css), "secondary node modals have mobile-specific bounds");
assert(!css.includes(".map-node.trade") && !css.includes(".map-node.random-event") && !css.includes(".map-node.item-reward"), "map node styling was not repurposed for node screens");

console.log("secondary node polish test passed");
