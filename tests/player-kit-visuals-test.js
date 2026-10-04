"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null, console, Map, Set, JSON };
context.globalThis = context;
vm.createContext(context);
for (const file of [
  "js/player/player-kit-catalog.js",
  "js/player/player-kit-visuals.js",
  "js/player/player-visuals.js",
]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

let visualMap = new Map([
  ["mark", { frontFullbodyUrl: "legacy-mark.webp", portraitUrl: "mark-portrait.webp" }],
  ["axel", { frontFullbodyUrl: "legacy-axel.webp", portraitUrl: "axel-portrait.webp" }],
  ["nelly", { frontFullbodyUrl: "legacy-nelly.webp", portraitUrl: "nelly-portrait.webp" }],
]);

const visuals = context.PlayerVisuals.create({
  getPlayerVisualsById: () => visualMap,
  escapeHtml,
});

// Empty production catalog must preserve the legacy fullbody path exactly.
const legacy = visuals.detailMarkup({ playerId: "mark", name: "Mark Evans" });
assert.match(legacy, /legacy-mark\.webp/);
assert.ok(!legacy.includes("modular-player-visual"));

// POC: three distinct characters, two kits and two body profiles.
context.PlayerKitVisuals.configure({
  schemaVersion: 1,
  defaultKitId: "raimon",
  requiredLayers: ["body", "head", "arms", "shoes"],
  players: {
    mark: {
      bodyProfile: "u000101",
      layers: {
        head: { src: "assets/player-kits/players/mark/head.webp", z: 40 },
        arms: { src: "assets/player-kits/players/mark/arms.webp", z: 30 },
        shoes: { src: "assets/player-kits/players/mark/shoes.webp", z: 20 },
      },
    },
    axel: {
      bodyProfile: "u000101",
      defaultKitId: "japan",
      layers: {
        head: { src: "assets/player-kits/players/axel/head.webp", z: 40 },
        arms: { src: "assets/player-kits/players/axel/arms.webp", z: 30 },
        shoes: { src: "assets/player-kits/players/axel/shoes.webp", z: 20 },
      },
    },
    nelly: {
      bodyProfile: "u000103",
      compatibleKitIds: ["raimon"],
      layers: {
        head: { src: "assets/player-kits/players/nelly/head.webp", z: 40 },
        arms: { src: "assets/player-kits/players/nelly/arms.webp", z: 30 },
        shoes: { src: "assets/player-kits/players/nelly/shoes.webp", z: 20 },
      },
    },
  },
  kits: {
    raimon: {
      profiles: {
        u000101: { layers: { body: { src: "assets/player-kits/kits/raimon/u000101/body.webp", z: 10 } } },
        u000103: { layers: { body: { src: "assets/player-kits/kits/raimon/u000103/body.webp", z: 10 } } },
      },
    },
    japan: {
      profiles: {
        u000101: { layers: { body: { src: "assets/player-kits/kits/japan/u000101/body.webp", z: 10 } } },
      },
    },
  },
});

const mark = context.PlayerKitVisuals.resolve({ playerId: "mark" });
assert.strictEqual(mark.available, true);
assert.strictEqual(mark.kitId, "raimon");
assert.strictEqual(mark.bodyProfile, "u000101");
assert.deepStrictEqual(Array.from(mark.layers, (layer) => layer.id), ["body", "shoes", "arms", "head"]);

const axel = context.PlayerKitVisuals.resolve({ playerId: "axel" });
assert.strictEqual(axel.available, true);
assert.strictEqual(axel.kitId, "japan");
assert.strictEqual(axel.layers[0].src, "assets/player-kits/kits/japan/u000101/body.webp");

const axelRaimon = context.PlayerKitVisuals.resolve({
  playerId: "axel",
  visualKitId: "raimon",
});
assert.strictEqual(axelRaimon.available, true);
assert.strictEqual(axelRaimon.kitId, "raimon");
assert.strictEqual(axelRaimon.layers[0].src, "assets/player-kits/kits/raimon/u000101/body.webp");

const nelly = context.PlayerKitVisuals.resolve({ playerId: "nelly" });
assert.strictEqual(nelly.available, true);
assert.strictEqual(nelly.bodyProfile, "u000103");
assert.strictEqual(nelly.layers[0].src, "assets/player-kits/kits/raimon/u000103/body.webp");

const incompatible = context.PlayerKitVisuals.resolve({
  playerId: "nelly",
  visualKitId: "japan",
});
assert.strictEqual(incompatible.available, false);
assert.strictEqual(incompatible.reason, "kit-incompatible");

// PlayerVisuals switches to modular markup only when a complete compatible set exists.
const modularMarkup = visuals.detailMarkup({
  playerId: "mark",
  name: "Mark Evans",
  visualKitId: "raimon",
});
assert.match(modularMarkup, /modular-player-visual/);
assert.match(modularMarkup, /data-player-kit="raimon"/);
assert.match(modularMarkup, /data-body-profile="u000101"/);
assert.match(modularMarkup, /assets\/player-kits\/players\/mark\/head\.webp/);
assert.match(modularMarkup, /assets\/player-kits\/kits\/raimon\/u000101\/body\.webp/);
assert.match(modularMarkup, /legacy-mark\.webp/);

// Missing required parts must never display a half-built character.
context.PlayerKitVisuals.configure({
  schemaVersion: 1,
  defaultKitId: "broken",
  requiredLayers: ["body", "head"],
  players: {
    mark: {
      bodyProfile: "u000101",
      layers: {},
    },
  },
  kits: {
    broken: {
      profiles: {
        u000101: { layers: { body: "assets/player-kits/kits/broken/u000101/body.webp" } },
      },
    },
  },
});
const broken = context.PlayerKitVisuals.resolve({ playerId: "mark" });
assert.strictEqual(broken.available, false);
assert.strictEqual(broken.reason, "required-layer-missing");
assert.deepStrictEqual(Array.from(broken.missingRequiredLayers), ["head"]);
const brokenFallback = visuals.detailMarkup({ playerId: "mark", name: "Mark Evans" });
assert.match(brokenFallback, /legacy-mark\.webp/);
assert.ok(!brokenFallback.includes("modular-player-visual"));

// Optional layer failures are hidden; required layer failures switch the whole composite to legacy fallback.
const optionalRoot = {
  classList: { add() { throw new Error("optional layer must not fail the composite"); } },
  dataset: {},
};
const optionalLayer = {
  dataset: { modularRequired: "false" },
  hidden: false,
  onerror() {},
  parentElement: optionalRoot,
};
context.PlayerKitVisuals.handleLayerError(optionalLayer);
assert.strictEqual(optionalLayer.hidden, true);
assert.strictEqual(optionalLayer.onerror, null);

let failedClass = "";
const requiredRoot = {
  classList: { add(value) { failedClass = value; } },
  dataset: {},
};
const requiredLayer = {
  dataset: { modularRequired: "true" },
  onerror() {},
  parentElement: requiredRoot,
};
context.PlayerKitVisuals.handleLayerError(requiredLayer);
assert.strictEqual(failedClass, "modular-player-visual--failed");
assert.strictEqual(requiredRoot.dataset.modularFailed, "true");
assert.strictEqual(requiredLayer.onerror, null);

console.log("player kit visuals: 3 players, 2 kits, compatibility and legacy fallback OK");
