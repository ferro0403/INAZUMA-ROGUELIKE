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
assert(appJs.includes('className: "item-reward-modal"') && appJs.includes('itemChoiceCard(item)'), "item reward polishes the existing choice-card flow without a duplicate inventory card");
assert(appJs.includes('global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:trade:${outgoingId}`)'), "trade seed remains unchanged");
assert(appJs.includes('global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}`)'), "item seed remains unchanged");
assert(appJs.includes('global.MapEngine.resolveRandomNodeType(run, node)'), "random node resolution remains delegated to MapEngine");
assert(css.includes('.trade-node-head') && css.includes('.random-event-modal') && css.includes('.item-reward-modal'), "secondary node styles are scoped");
assert(/@media \(max-width: 780px\)[\s\S]*?\.trade-modal, \.trade-confirm-modal, \.trade-result-modal, \.random-event-modal, \.item-reward-modal/.test(css), "secondary node modals have mobile-specific bounds");
assert(!css.includes(".map-node.trade") && !css.includes(".map-node.random-event") && !css.includes(".map-node.item-reward"), "map node styling was not repurposed for node screens");

console.log("secondary node polish test passed");
