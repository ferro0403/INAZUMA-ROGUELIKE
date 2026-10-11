(function (global) {
  "use strict";

  const DEFAULT_STORAGE_KEY = "inazuma.rtg.player-kit-selection.v1";

  function safePlayerId(value) {
    return value == null ? "" : String(value);
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function diagnosticFullbodyUrl(playerId, kit) {
    const label = escapeXml(kit.label || kit.kitId || "VR KIT");
    const id = escapeXml(playerId);
    const variant = escapeXml(String(kit.variant || "auto").toUpperCase());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1080">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#101b3a"/>
          <stop offset="1" stop-color="#244a87"/>
        </linearGradient>
      </defs>
      <rect width="720" height="1080" fill="none"/>
      <path d="M260 190 170 265l65 165 72-37v465h106V393l72 37 65-165-90-75-60 55h-80z"
        fill="url(#g)" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
      <circle cx="360" cy="135" r="82" fill="#ffd5bd" stroke="#fff" stroke-width="12"/>
      <rect x="130" y="820" width="460" height="170" rx="32" fill="#081127" fill-opacity=".92" stroke="#fff" stroke-width="6"/>
      <text x="360" y="872" text-anchor="middle" fill="#ffd21f" font-family="Arial,sans-serif" font-size="28" font-weight="700">VR KIT BRIDGE · DEV</text>
      <text x="360" y="920" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="30" font-weight="700">${label}</text>
      <text x="360" y="958" text-anchor="middle" fill="#d9e8ff" font-family="Arial,sans-serif" font-size="22">PLAYER ${id} · ${variant}</text>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function normalizeKit(playerId, value) {
    const kitId = String(value?.kitId || value?.id || "").trim();
    if (!kitId) return null;
    const diagnostic = value?.diagnostic === true;
    return Object.freeze({
      playerId: safePlayerId(playerId),
      kitId,
      label: String(value?.label || kitId),
      variant: String(value?.variant || "auto"),
      fullbodyUrl: value?.fullbodyUrl ? String(value.fullbodyUrl) : null,
      expectedAssetUrl: value?.expectedAssetUrl ? String(value.expectedAssetUrl) : null,
      diagnostic,
    });
  }

  function create({
    storage = global.localStorage,
    enabled = true,
    storageKey = DEFAULT_STORAGE_KEY,
  } = {}) {
    let manifest = Object.freeze({ schema: "inazuma-player-kit-visuals-v1", players: {} });
    let byPlayer = new Map();

    function readSelections() {
      if (!enabled || !storage || typeof storage.getItem !== "function") return {};
      try {
        const parsed = JSON.parse(storage.getItem(storageKey) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function writeSelections(next) {
      if (!enabled || !storage || typeof storage.setItem !== "function") return false;
      try {
        storage.setItem(storageKey, JSON.stringify(next));
        return true;
      } catch (_) {
        return false;
      }
    }

    function setManifest(nextManifest) {
      const nextPlayers = new Map();
      for (const [playerId, rawPlayer] of Object.entries(nextManifest?.players || {})) {
        const rawKits = Array.isArray(rawPlayer?.kits)
          ? rawPlayer.kits
          : Object.entries(rawPlayer?.kits || {}).map(([kitId, kit]) => ({ kitId, ...(kit || {}) }));
        const kits = rawKits.map((kit) => normalizeKit(playerId, kit)).filter(Boolean);
        if (kits.length) nextPlayers.set(String(playerId), Object.freeze(kits));
      }
      byPlayer = nextPlayers;
      manifest = Object.freeze({
        schema: String(nextManifest?.schema || "inazuma-player-kit-visuals-v1"),
        note: String(nextManifest?.note || ""),
        players: nextManifest?.players || {},
      });
      return summary();
    }

    async function load(url = "data/PLAYER_KIT_VISUALS.json", fetchResource = global.fetch?.bind(global)) {
      if (typeof fetchResource !== "function") throw new Error("VR kit manifest fetch unavailable");
      const response = await fetchResource(url, { cache: "no-store" });
      if (!response?.ok) throw new Error(`VR kit manifest load failed: ${response?.status || "unknown"}`);
      return setManifest(await response.json());
    }

    function optionsFor(playerId) {
      return [...(byPlayer.get(safePlayerId(playerId)) || [])];
    }

    function selectedKitId(playerId) {
      return String(readSelections()[safePlayerId(playerId)] || "");
    }

    function selectedKit(playerId) {
      const id = selectedKitId(playerId);
      if (!id) return null;
      return optionsFor(playerId).find((kit) => kit.kitId === id) || null;
    }

    function select(playerId, kitId) {
      if (!enabled) return false;
      const id = safePlayerId(playerId);
      const normalizedKitId = String(kitId || "");
      if (!id || !optionsFor(id).some((kit) => kit.kitId === normalizedKitId)) return false;
      const selections = readSelections();
      selections[id] = normalizedKitId;
      return writeSelections(selections);
    }

    function clear(playerId) {
      if (!enabled) return false;
      const id = safePlayerId(playerId);
      const selections = readSelections();
      delete selections[id];
      return writeSelections(selections);
    }

    function resolve(playerId) {
      if (!enabled) return null;
      const kit = selectedKit(playerId);
      if (!kit) return null;
      const fullbodyUrl = kit.fullbodyUrl || (kit.diagnostic ? diagnosticFullbodyUrl(playerId, kit) : null);
      if (!fullbodyUrl) return null;
      return Object.freeze({
        ...kit,
        fullbodyUrl,
        source: kit.diagnostic ? "vr-kit-diagnostic" : "vr-kit-render",
      });
    }

    function summary() {
      return Object.freeze({
        schema: manifest.schema,
        playerCount: byPlayer.size,
        kitCount: [...byPlayer.values()].reduce((total, kits) => total + kits.length, 0),
        enabled: Boolean(enabled),
      });
    }

    return Object.freeze({
      enabled: Boolean(enabled),
      load,
      setManifest,
      optionsFor,
      selectedKitId,
      selectedKit,
      select,
      clear,
      resolve,
      summary,
      storageKey,
    });
  }

  global.PlayerKitVisuals = Object.freeze({ create, DEFAULT_STORAGE_KEY });
  if (typeof module !== "undefined" && module.exports) module.exports = global.PlayerKitVisuals;
})(typeof globalThis !== "undefined" ? globalThis : window);
