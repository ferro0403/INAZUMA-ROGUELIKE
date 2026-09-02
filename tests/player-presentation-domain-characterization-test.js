"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { globalThis: null, Map, Set, JSON }; context.globalThis = context; vm.createContext(context);
for (const file of ["js/player/player-visuals.js", "js/player/player-view.js", "js/player/player-detail-controller.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
const escapeHtml = value => String(value ?? "").replaceAll('"', "&quot;");
let visualMap = new Map();
const visuals = context.PlayerVisuals.create({ getPlayerVisualsById: () => visualMap, escapeHtml });
const placeholder = context.PlayerVisuals.PLAYER_IMAGE_PLACEHOLDER;
const cases = [
  [{ playerId: "1", portraitUrl: "season-portrait", frontFullbodyUrl: "season-front" }, {}, "season-front", "season-portrait", "fullbody", "portrait"],
  [{ playerId: "2" }, { portraitUrl: "global-portrait", frontFullbodyUrl: "global-front" }, "global-front", "global-portrait", "fullbody", "portrait"],
  [{ playerId: "3", portraitUrl: "portrait" }, {}, "portrait", "portrait", "portrait", "portrait"],
  [{ playerId: "4", fullbodyUrl: "front" }, {}, "front", "front", "fullbody", "fullbody"],
  [{ playerId: "5", image: "compatible" }, {}, "compatible", "compatible", "portrait", "portrait"],
  [{ playerId: "6" }, {}, placeholder, placeholder, "placeholder", "placeholder"],
  [{ playerId: "7", portraitUrl: "same", fullbodyUrl: "same" }, {}, "same", "same", "fullbody", "portrait"],
  [{ playerId: "unknown" }, {}, placeholder, placeholder, "placeholder", "placeholder"],
];
for (const [player, globalVisual, detail, card, detailKind, cardKind] of cases) {
  visualMap = new Map([[String(player.playerId), globalVisual]]);
  const result = visuals.resolve(player);
  assert.strictEqual(result.detailImageUrl, detail); assert.strictEqual(result.cardImageUrl, card);
  assert.strictEqual(result.detailImageKind, detailKind); assert.strictEqual(result.cardImageKind, cardKind);
}
visualMap = new Map([["dynamic", { portraitUrl: "A" }]]); assert.strictEqual(visuals.resolve({ playerId: "dynamic" }).cardImageUrl, "A");
visualMap = new Map([["dynamic", { portraitUrl: "B" }]]); assert.strictEqual(visuals.resolve({ playerId: "dynamic" }).cardImageUrl, "B", "visual map remains dynamic");
const attrs = visuals.imageFallbackAttributes(["same", "same", placeholder]); assert.strictEqual((JSON.parse(/data-image-fallbacks="([^"]+)/.exec(attrs)[1].replaceAll('&quot;', '"'))).length, 2);
const img = { dataset: { imageFallbacks: JSON.stringify(["bad", "good", placeholder]), imageFallbackIndex: "0" }, src: "bad", onerror() {} };
visuals.handleImageError(img); assert.strictEqual(img.src, "good"); visuals.handleImageError(img); assert.strictEqual(img.src, placeholder); visuals.handleImageError(img); assert.strictEqual(img.dataset.imageFallbackDone, "true");
const stats = Object.fromEntries(Object.keys(context.PlayerView.STAT_LABELS).map(key => [key, 50]));
const view = context.PlayerView.create({ visuals, escapeHtml, resolveItem: item => item, itemIcon: () => "ICON", getProgression: () => ({ getPlayerAtLevel: player => ({ ...player, overall: 50, potential: 60, stats, baseStats: stats }) }), applyEquipment: value => value, formatLevel: value => String(value), getSeasonId: () => "ie1", sourcePlayer: () => null, playerTeamIdentity: () => ({ name: "Inazuma", logoUrl: "", logo: "" }), historicalTeamIdentity: () => ({ name: "Campioni", logoUrl: "", logo: "" }), teamLogoMarkup: () => "LOGO", playerStatsMarkup: () => '<section class="player-history-section">HISTORY</section>' });
const player = { playerId: "dynamic", name: "Mark", position: "GK", element: "Vento", category: "Elite", finalOverall: 60, stats, baseStats: stats };
const card = view.compactCard(player, { tag: "article", selected: true, equipment: { name: "Guanti" }, equipmentInFooter: true, level: 4, overall: 60, dataAttr: 'data-test="yes"', extraClass: "extra", trailingMarkup: "TAIL" });
for (const token of ["<article", "selected", "has-equipment", 'data-test="yes"', "extra", "TAIL", "Lv 4", "Guanti"]) assert.ok(card.includes(token), token);
for (const mode of ["current", "album", "historical"]) { const markup = view.detailMarkup(player, { mode, readOnly: mode !== "current", level: 4, albumUnlocked: true, team: { teamName: "Campioni" } }); assert.ok(markup.includes("Mark")); assert.strictEqual((markup.match(/player-stat-card/g) || []).length, 8); if (mode === "album") assert.ok(markup.includes("album-detail-badge")); if (mode === "historical") assert.ok(markup.includes("HISTORY")); }
console.log("player presentation characterization: visuals, card and three detail modes OK");
