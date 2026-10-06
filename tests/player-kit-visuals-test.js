"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const context = {
  globalThis: null,
  Map,
  Set,
  JSON,
  encodeURIComponent,
  localStorage: new MemoryStorage(),
};
context.globalThis = context;
vm.createContext(context);

for (const file of [
  "js/player/player-kit-visuals.js",
  "js/player/player-visuals.js",
]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const manifest = {
  schema: "inazuma-player-kit-visuals-v1",
  players: {
    "1096": {
      kits: [
        {
          kitId: "backwater-raimon-home",
          label: "Backwater Raimon · Home",
          variant: "home",
          diagnostic: true,
          expectedAssetUrl: "assets/vr-players/1096/backwater-raimon-home.webp",
        },
      ],
    },
  },
};

const kitVisuals = context.PlayerKitVisuals.create({
  enabled: true,
  storage: context.localStorage,
});
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(kitVisuals.setManifest(manifest))),
  { schema: "inazuma-player-kit-visuals-v1", playerCount: 1, kitCount: 1, enabled: true },
);
assert.strictEqual(kitVisuals.selectedKitId("1096"), "");
assert.strictEqual(kitVisuals.resolve("1096"), null);
assert.strictEqual(kitVisuals.select("1096", "missing"), false);
assert.strictEqual(kitVisuals.select("1096", "backwater-raimon-home"), true);
assert.strictEqual(kitVisuals.selectedKitId("1096"), "backwater-raimon-home");

const resolvedKit = kitVisuals.resolve("1096");
assert.strictEqual(resolvedKit.kitId, "backwater-raimon-home");
assert.strictEqual(resolvedKit.source, "vr-kit-diagnostic");
assert.ok(resolvedKit.fullbodyUrl.startsWith("data:image/svg+xml,"));
assert.strictEqual(
  resolvedKit.expectedAssetUrl,
  "assets/vr-players/1096/backwater-raimon-home.webp",
);

const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () =>
    new Map([["1096", { portraitUrl: "portrait.webp", frontFullbodyUrl: "legacy.webp" }]]),
  escapeHtml: String,
  resolveKitVisual: (playerId) => kitVisuals.resolve(playerId),
});
const player = { playerId: "1096", portraitUrl: "season-portrait.webp", frontFullbodyUrl: "season-front.webp" };
const withKit = visuals.resolve(player);
assert.strictEqual(withKit.detailImageUrl, resolvedKit.fullbodyUrl);
assert.strictEqual(withKit.cardImageUrl, "season-portrait.webp");
assert.deepStrictEqual(
  Array.from(withKit.detailFallbacks).slice(1),
  ["season-front.webp", "legacy.webp", "season-portrait.webp", context.PlayerVisuals.PLAYER_IMAGE_PLACEHOLDER],
  "failed generated kit asset falls back through current player visuals",
);

assert.strictEqual(kitVisuals.clear("1096"), true);
const original = visuals.resolve(player);
assert.strictEqual(original.detailImageUrl, "season-front.webp");
assert.strictEqual(original.cardImageUrl, "season-portrait.webp");

const disabled = context.PlayerKitVisuals.create({
  enabled: false,
  storage: context.localStorage,
});
disabled.setManifest(manifest);
assert.strictEqual(disabled.select("1096", "backwater-raimon-home"), false);
assert.strictEqual(disabled.resolve("1096"), null);

console.log("player kit visual bridge: routing, persistence, fallback and dev gate OK");
