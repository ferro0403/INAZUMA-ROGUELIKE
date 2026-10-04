"use strict";

const fs = require("fs");
const path = require("path");

const [, , inputArg, outputArg = "js/player/player-kit-catalog.js"] = process.argv;
if (!inputArg) {
  console.error("Usage: node scripts/build-player-kit-catalog.js <authoring.json> [output.js]");
  process.exit(2);
}

function fail(message) {
  throw new Error(`player-kit-catalog: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateAssetPath(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty asset path`);
  const normalized = value.replaceAll("\\", "/");
  if (/^[a-z]+:/i.test(normalized) || normalized.startsWith("/") || normalized.includes("../")) {
    fail(`${label} must be a repository-local asset path`);
  }
  if (!normalized.startsWith("assets/player-kits/")) {
    fail(`${label} must live under assets/player-kits/`);
  }
  return normalized;
}

function normalizeLayerMap(layers, label) {
  if (!isPlainObject(layers)) fail(`${label}.layers must be an object`);
  return Object.fromEntries(
    Object.entries(layers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([layerId, value]) => {
        if (typeof value === "string") {
          return [layerId, validateAssetPath(value, `${label}.layers.${layerId}`)];
        }
        if (!isPlainObject(value)) fail(`${label}.layers.${layerId} must be a string or object`);
        const normalized = {
          src: validateAssetPath(value.src, `${label}.layers.${layerId}.src`),
        };
        if (value.z != null) {
          const z = Number(value.z);
          if (!Number.isFinite(z)) fail(`${label}.layers.${layerId}.z must be numeric`);
          normalized.z = z;
        }
        if (value.required != null) normalized.required = value.required === true;
        return [layerId, normalized];
      }),
  );
}

function normalizeCatalog(source) {
  if (!isPlainObject(source)) fail("root must be an object");
  const requiredLayers = Array.isArray(source.requiredLayers) && source.requiredLayers.length
    ? source.requiredLayers.map(String)
    : ["body", "head", "arms", "shoes"];
  const players = {};
  const kits = {};

  if (!isPlainObject(source.players)) fail("players must be an object");
  if (!isPlainObject(source.kits)) fail("kits must be an object");

  for (const [kitId, kit] of Object.entries(source.kits).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isPlainObject(kit) || !isPlainObject(kit.profiles)) fail(`kits.${kitId}.profiles must be an object`);
    const profiles = {};
    for (const [profileId, profile] of Object.entries(kit.profiles).sort(([a], [b]) => a.localeCompare(b))) {
      if (!isPlainObject(profile)) fail(`kits.${kitId}.profiles.${profileId} must be an object`);
      profiles[profileId] = {
        layers: normalizeLayerMap(profile.layers || {}, `kits.${kitId}.profiles.${profileId}`),
      };
    }
    kits[kitId] = { profiles };
  }

  const defaultKitId = source.defaultKitId == null ? null : String(source.defaultKitId);
  if (defaultKitId && !kits[defaultKitId]) fail(`defaultKitId '${defaultKitId}' is missing from kits`);

  for (const [playerId, player] of Object.entries(source.players).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isPlainObject(player)) fail(`players.${playerId} must be an object`);
    const bodyProfile = String(player.bodyProfile || "").trim();
    if (!bodyProfile) fail(`players.${playerId}.bodyProfile is required`);
    const normalizedPlayer = {
      bodyProfile,
      layers: normalizeLayerMap(player.layers || {}, `players.${playerId}`),
    };
    if (player.defaultKitId != null) {
      normalizedPlayer.defaultKitId = String(player.defaultKitId);
      if (!kits[normalizedPlayer.defaultKitId]) {
        fail(`players.${playerId}.defaultKitId '${normalizedPlayer.defaultKitId}' is missing from kits`);
      }
    }
    if (Array.isArray(player.compatibleKitIds)) {
      normalizedPlayer.compatibleKitIds = [...new Set(player.compatibleKitIds.map(String))].sort();
      for (const kitId of normalizedPlayer.compatibleKitIds) {
        if (!kits[kitId]) fail(`players.${playerId} references unknown compatible kit '${kitId}'`);
      }
    }
    if (Array.isArray(player.requiredLayers) && player.requiredLayers.length) {
      normalizedPlayer.requiredLayers = player.requiredLayers.map(String);
    }
    players[String(playerId)] = normalizedPlayer;

    const candidateKitIds = normalizedPlayer.defaultKitId
      ? [normalizedPlayer.defaultKitId]
      : defaultKitId
        ? [defaultKitId]
        : [];
    for (const kitId of candidateKitIds) {
      const kit = kits[kitId];
      if (!kit.profiles[bodyProfile] && !kit.profiles.default) {
        fail(`players.${playerId} body profile '${bodyProfile}' is unavailable in default kit '${kitId}'`);
      }
    }
  }

  return {
    schemaVersion: 1,
    defaultKitId,
    requiredLayers,
    players,
    kits,
  };
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const catalog = normalizeCatalog(source);
const js = `(function (global) {
  "use strict";

  // Generated by scripts/build-player-kit-catalog.js. Do not edit manually.
  global.__INAZUMA_PLAYER_KIT_CATALOG__ = ${JSON.stringify(catalog, null, 2)};
})(globalThis);
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, js);
console.log(
  `player-kit-catalog: wrote ${outputPath} (${Object.keys(catalog.players).length} players, ${Object.keys(catalog.kits).length} kits)`,
);
