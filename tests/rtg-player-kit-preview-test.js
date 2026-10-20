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
      kits: [{
        kitId: "backwater-raimon-home",
        label: "Backwater Raimon · Home",
        variant: "home",
        diagnostic: true,
        expectedAssetUrl: "assets/vr-players/1096/backwater-raimon-home.webp",
      }],
    },
  },
};

const kitVisuals = context.PlayerKitVisuals.create({
  enabled: true,
  storage: context.localStorage,
});
kitVisuals.setManifest(manifest);
assert.strictEqual(kitVisuals.select("1096", "backwater-raimon-home"), true);

const resolvedKit = kitVisuals.resolve("1096");
assert.ok(resolvedKit?.fullbodyUrl?.startsWith("data:image/svg+xml,"));

const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () =>
    new Map([["1096", { portraitUrl: "portrait.webp", frontFullbodyUrl: "legacy.webp" }]]),
  escapeHtml: String,
});
const player = {
  playerId: "1096",
  portraitUrl: "season-portrait.webp",
  frontFullbodyUrl: "season-front.webp",
};

const outsideRtg = visuals.resolve(player);
assert.strictEqual(
  outsideRtg.detailImageUrl,
  "season-front.webp",
  "saved RTG kit selection must not affect normal player detail",
);

const insideRtg = visuals.resolve(player, {
  detailFullbodyOverride: resolvedKit.fullbodyUrl,
});
assert.strictEqual(
  insideRtg.detailImageUrl,
  resolvedKit.fullbodyUrl,
  "RTG detail may opt into the selected kit preview",
);
assert.deepStrictEqual(
  Array.from(insideRtg.detailFallbacks).slice(1),
  ["season-front.webp", "legacy.webp", "season-portrait.webp", context.PlayerVisuals.PLAYER_IMAGE_PLACEHOLDER],
  "failed kit preview must fall back through existing visuals",
);

const viewSource = fs.readFileSync("js/player/player-view.js", "utf8");
assert.match(viewSource, /devMode && rtgKitPreview/);
const rtgControllerSource = fs.readFileSync("js/road-to-glory/rtg-controller.js", "utf8");
assert.match(rtgControllerSource, /rtgKitPreview:true/);

console.log("RTG player kit preview: isolated routing, fallback and RTG gate OK");
