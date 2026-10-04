(function (global) {
  "use strict";

  const EMPTY_CATALOG = Object.freeze({
    schemaVersion: 1,
    defaultKitId: null,
    requiredLayers: ["body", "head"],
    players: Object.freeze({}),
    kits: Object.freeze({}),
  });

  let catalog = normalizeCatalog(global.__INAZUMA_PLAYER_KIT_CATALOG__);

  function normalizeCatalog(value) {
    if (!value || typeof value !== "object") return EMPTY_CATALOG;
    return {
      schemaVersion: Number(value.schemaVersion || 1),
      defaultKitId: value.defaultKitId == null ? null : String(value.defaultKitId),
      requiredLayers: Array.isArray(value.requiredLayers) && value.requiredLayers.length
        ? value.requiredLayers.map(String)
        : ["body", "head"],
      players: value.players && typeof value.players === "object" ? value.players : {},
      kits: value.kits && typeof value.kits === "object" ? value.kits : {},
    };
  }

  function configure(value) {
    catalog = normalizeCatalog(value);
    global.__INAZUMA_PLAYER_KIT_CATALOG__ = catalog;
    return catalog;
  }

  function currentCatalog() {
    return catalog;
  }

  function normalizeLayer(id, value, fallbackZ) {
    if (typeof value === "string") {
      return { id, src: value, z: fallbackZ, required: false };
    }
    if (!value || typeof value !== "object" || !value.src) return null;
    const z = Number(value.z);
    return {
      id,
      src: String(value.src),
      z: Number.isFinite(z) ? z : fallbackZ,
      required: value.required === true,
    };
  }

  function collectLayers(playerEntry, profile) {
    const defaults = { body: 10, armsBack: 15, shoes: 20, arms: 30, head: 40, accessory: 50 };
    const merged = { ...(profile?.layers || {}), ...(playerEntry?.layers || {}) };
    return Object.entries(merged)
      .map(([id, value], index) => normalizeLayer(id, value, defaults[id] ?? (100 + index)))
      .filter(Boolean)
      .sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  }

  function resolve(player, { playerId = player?.playerId, kitId = null } = {}) {
    const id = playerId == null ? "" : String(playerId);
    const playerEntry = id ? catalog.players[id] : null;
    if (!playerEntry) return { available: false, playerId: id, reason: "player-unmapped", layers: [] };

    const effectiveKitId = [kitId, player?.visualKitId, player?.kitId, playerEntry.defaultKitId, catalog.defaultKitId]
      .find((value) => value != null && String(value).trim() !== "");
    if (effectiveKitId == null) return { available: false, playerId: id, reason: "kit-unselected", layers: [] };

    const normalizedKitId = String(effectiveKitId);
    if (Array.isArray(playerEntry.compatibleKitIds)
        && !playerEntry.compatibleKitIds.map(String).includes(normalizedKitId)) {
      return { available: false, playerId: id, kitId: normalizedKitId, reason: "kit-incompatible", layers: [] };
    }

    const kit = catalog.kits[normalizedKitId];
    if (!kit) return { available: false, playerId: id, kitId: normalizedKitId, reason: "kit-missing", layers: [] };

    const bodyProfile = String(playerEntry.bodyProfile || player?.bodyProfile || "default");
    const profile = kit.profiles?.[bodyProfile] || kit.profiles?.default || null;
    if (!profile) {
      return { available: false, playerId: id, kitId: normalizedKitId, bodyProfile, reason: "body-profile-missing", layers: [] };
    }

    const layers = collectLayers(playerEntry, profile);
    const requiredLayers = Array.isArray(playerEntry.requiredLayers) && playerEntry.requiredLayers.length
      ? playerEntry.requiredLayers.map(String)
      : catalog.requiredLayers;
    const layerIds = new Set(layers.map((layer) => layer.id));
    const missingRequiredLayers = requiredLayers.filter((layerId) => !layerIds.has(layerId));
    if (missingRequiredLayers.length) {
      return {
        available: false,
        playerId: id,
        kitId: normalizedKitId,
        bodyProfile,
        reason: "required-layer-missing",
        missingRequiredLayers,
        layers,
      };
    }

    const requiredSet = new Set(requiredLayers);
    return {
      available: true,
      playerId: id,
      kitId: normalizedKitId,
      bodyProfile,
      layers: layers.map((layer) => ({ ...layer, required: layer.required || requiredSet.has(layer.id) })),
      missingRequiredLayers: [],
    };
  }

  function handleLayerError(img) {
    if (!img) return;
    img.onerror = null;
    const required = img.dataset?.modularRequired === "true";
    if (!required) {
      img.hidden = true;
      return;
    }
    const root = typeof img.closest === "function"
      ? img.closest(".modular-player-visual")
      : img.parentElement;
    if (root?.classList?.add) root.classList.add("modular-player-visual--failed");
    if (root?.dataset) root.dataset.modularFailed = "true";
  }

  function create({ escapeHtml }) {
    function markup(player, {
      playerId = player?.playerId,
      kitId = null,
      alt = player?.name || "",
      fallbackUrl = null,
      fallbackAttributes = "",
    } = {}) {
      const resolved = resolve(player, { playerId, kitId });
      if (!resolved.available) return "";
      const layers = resolved.layers.map((layer) =>
        `<img class="modular-player-visual__layer modular-player-visual__layer--${escapeHtml(layer.id)}" src="${escapeHtml(layer.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async" data-modular-layer="${escapeHtml(layer.id)}" data-modular-required="${layer.required ? "true" : "false"}" style="--modular-layer-z:${layer.z}" onerror="globalThis.handleModularPlayerLayerError && globalThis.handleModularPlayerLayerError(this)" />`,
      ).join("");
      const fallback = fallbackUrl
        ? `<img class="modular-player-visual__fallback" src="${escapeHtml(fallbackUrl)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" ${fallbackAttributes} />`
        : `<span class="modular-player-visual__fallback modular-player-visual__fallback--empty" aria-hidden="true">⚽</span>`;
      return `<span class="player-fullbody player-fullbody--fullbody player-fullbody--modular modular-player-visual" data-player-id="${escapeHtml(resolved.playerId)}" data-player-kit="${escapeHtml(resolved.kitId)}" data-body-profile="${escapeHtml(resolved.bodyProfile)}">${layers}${fallback}</span>`;
    }
    return { resolve, markup, handleLayerError };
  }

  global.handleModularPlayerLayerError = handleLayerError;
  global.PlayerKitVisuals = Object.freeze({ create, configure, currentCatalog, resolve, handleLayerError, EMPTY_CATALOG });
})(globalThis);
