"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { globalThis: null, Map, Set, JSON };
context.globalThis = context;
vm.createContext(context);
for (const file of [
  "js/player/player-visuals.js",
  "js/player/player-view.js",
  "js/player/player-detail-controller.js",
])
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
const escapeHtml = (value) => String(value ?? "").replaceAll('"', "&quot;");
let visualMap = new Map();
const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () => visualMap,
  escapeHtml,
});
const placeholder = context.PlayerVisuals.PLAYER_IMAGE_PLACEHOLDER;
const cases = [
  [
    {
      playerId: "1",
      portraitUrl: "season-portrait",
      frontFullbodyUrl: "season-front",
    },
    {},
    "season-front",
    "season-portrait",
    "fullbody",
    "portrait",
  ],
  [
    { playerId: "2" },
    { portraitUrl: "global-portrait", frontFullbodyUrl: "global-front" },
    "global-front",
    "global-portrait",
    "fullbody",
    "portrait",
  ],
  [
    { playerId: "3", portraitUrl: "portrait" },
    {},
    "portrait",
    "portrait",
    "portrait",
    "portrait",
  ],
  [
    { playerId: "4", fullbodyUrl: "front" },
    {},
    "front",
    "front",
    "fullbody",
    "fullbody",
  ],
  [
    { playerId: "5", image: "compatible" },
    {},
    "compatible",
    "compatible",
    "portrait",
    "portrait",
  ],
  [
    { playerId: "6" },
    {},
    placeholder,
    placeholder,
    "placeholder",
    "placeholder",
  ],
  [
    { playerId: "7", portraitUrl: "same", fullbodyUrl: "same" },
    {},
    "same",
    "same",
    "fullbody",
    "portrait",
  ],
  [
    { playerId: "unknown" },
    {},
    placeholder,
    placeholder,
    "placeholder",
    "placeholder",
  ],
];
for (const [
  player,
  globalVisual,
  detail,
  card,
  detailKind,
  cardKind,
] of cases) {
  visualMap = new Map([[String(player.playerId), globalVisual]]);
  const result = visuals.resolve(player);
  assert.strictEqual(result.detailImageUrl, detail);
  assert.strictEqual(result.cardImageUrl, card);
  assert.strictEqual(result.detailImageKind, detailKind);
  assert.strictEqual(result.cardImageKind, cardKind);
}
visualMap = new Map([["dynamic", { portraitUrl: "A" }]]);
assert.strictEqual(visuals.resolve({ playerId: "dynamic" }).cardImageUrl, "A");
visualMap = new Map([["dynamic", { portraitUrl: "B" }]]);
assert.strictEqual(
  visuals.resolve({ playerId: "dynamic" }).cardImageUrl,
  "B",
  "visual map remains dynamic",
);
const attrs = visuals.imageFallbackAttributes(["same", "same", placeholder]);
assert.strictEqual(
  JSON.parse(
    /data-image-fallbacks="([^"]+)/.exec(attrs)[1].replaceAll("&quot;", '"'),
  ).length,
  2,
);
function assertFallbackProgression(fallbacks) {
  const image = {
    dataset: {
      imageFallbacks: JSON.stringify(fallbacks),
      imageFallbackIndex: "0",
    },
    src: fallbacks[0],
    onerror() {},
  };

  visuals.handleImageError(image);
  assert.strictEqual(image.dataset.imageFallbackIndex, "1");
  assert.strictEqual(image.src, fallbacks[1]);

  visuals.handleImageError(image);
  assert.strictEqual(image.dataset.imageFallbackIndex, "2");
  assert.strictEqual(image.src, placeholder);

  visuals.handleImageError(image);
  assert.strictEqual(image.dataset.imageFallbackDone, "true");
  assert.strictEqual(image.onerror, null);
  assert.strictEqual(image.src, placeholder);

  visuals.handleImageError(image);
  assert.strictEqual(image.src, placeholder, "completed fallback cannot loop");
}

assertFallbackProgression(["bad-fullbody", "portrait", placeholder]);
assertFallbackProgression(["bad-portrait", "fullbody", placeholder]);

const stats = Object.fromEntries(
  Object.keys(context.PlayerView.STAT_LABELS).map((key) => [key, 50]),
);
const view = context.PlayerView.create({
  visuals,
  escapeHtml,
  resolveItem: (item) => item,
  itemIcon: () => "ICON",
  getProgression: () => ({
    getPlayerAtLevel: (player) => ({
      ...player,
      overall: 50,
      potential: 60,
      stats,
      baseStats: stats,
    }),
  }),
  applyEquipment: (value) => value,
  formatLevel: (value) => String(value),
  getSeasonId: () => "ie1",
  sourcePlayer: () => null,
  playerTeamIdentity: () => ({ name: "Inazuma", logoUrl: "", logo: "" }),
  historicalTeamIdentity: () => ({ name: "Campioni", logoUrl: "", logo: "" }),
  teamLogoMarkup: () => "LOGO",
  playerStatsMarkup: () =>
    '<section class="player-history-section">HISTORY</section>',
});
const player = {
  playerId: "dynamic",
  name: "Mark",
  position: "GK",
  element: "Vento",
  category: "Elite",
  finalOverall: 60,
  stats,
  baseStats: stats,
};
const card = view.compactCard(player, {
  tag: "article",
  selected: true,
  equipment: { name: "Guanti" },
  equipmentInFooter: true,
  level: 4,
  overall: 60,
  dataAttr: 'data-test="yes"',
  extraClass: "extra",
  trailingMarkup: "TAIL",
});
for (const token of [
  "<article",
  "selected",
  "has-equipment",
  'data-test="yes"',
  "extra",
  "TAIL",
  "Lv 4",
  "Guanti",
])
  assert.ok(card.includes(token), token);
const currentMarkup = view.detailMarkup(player, {
  mode: "current",
  readOnly: false,
  level: 4,
  equipment: { name: "Guanti", description: "Presa", stat: "save", bonus: 5 },
});
assert.ok(currentMarkup.includes("Mark"));
assert.strictEqual((currentMarkup.match(/player-stat-card/g) || []).length, 8);
assert.ok(currentMarkup.includes("data-detail-unequip"));

const albumMarkup = view.detailMarkup(player, {
  mode: "album",
  readOnly: true,
  level: 4,
  albumUnlocked: true,
  equipment: { name: "Guanti", description: "Presa", stat: "save", bonus: 5 },
  team: { teamName: "Campioni" },
});
assert.ok(albumMarkup.includes("album-detail-badge"));
assert.ok(albumMarkup.includes("SBLOCCATO"));
assert.ok(!albumMarkup.includes("data-detail-unequip"));
assert.strictEqual((albumMarkup.match(/player-stat-card/g) || []).length, 8);

const historicalMarkup = view.detailMarkup(
  {
    ...player,
    finalRarity: "Elite",
    finalOverall: 60,
    finalPotential: 65,
    finalLevel: 4,
    finalStats: stats,
    recruitmentSource: "pull",
  },
  {
    mode: "historical",
    readOnly: true,
    team: { teamName: "Campioni" },
  },
);
assert.ok(historicalMarkup.includes("player-detail-historical"));
assert.ok(historicalMarkup.includes("HISTORY"));
assert.ok(historicalMarkup.includes("Rosa campione: Campioni"));
assert.ok(historicalMarkup.includes("Origine: pull"));
assert.ok(!historicalMarkup.includes("data-detail-unequip"));
assert.strictEqual(
  (historicalMarkup.match(/player-stat-card/g) || []).length,
  8,
);

// Production resolveItem preserves unknown truthy object data on both BASE and HEAD.
const invalidEquipment = {
  id: "removed-item",
  name: "Oggetto rimosso",
  description: "Non più nel catalogo",
  stat: "attack",
  bonus: 1,
};
const invalidEquipmentMarkup = view.detailMarkup(player, {
  equipment: invalidEquipment,
});
assert.ok(invalidEquipmentMarkup.includes("Oggetto rimosso"));
assert.ok(invalidEquipmentMarkup.includes("data-detail-unequip"));

// If an injected resolver returns null, retain BASE behavior rather than silently
// converting truthy equipment into an empty slot.
const nullItemView = context.PlayerView.create({
  visuals,
  escapeHtml,
  resolveItem: () => null,
  itemIcon: () => "ICON",
  getProgression: () => ({ getPlayerAtLevel: (value) => value }),
  applyEquipment: (value) => value,
  formatLevel: String,
  getSeasonId: () => "ie1",
  sourcePlayer: () => null,
  playerTeamIdentity: () => ({ name: "", logoUrl: "", logo: "" }),
  historicalTeamIdentity: () => ({ name: "", logoUrl: "", logo: "" }),
  teamLogoMarkup: () => "",
  playerStatsMarkup: () => "",
});
assert.throws(
  () => nullItemView.detailMarkup(player, { equipment: { id: "missing" } }),
  /Cannot read properties of null/,
  "truthy equipment with a null resolver preserves BASE failure semantics",
);

console.log(
  "player presentation characterization: visuals, card and three detail modes OK",
);
