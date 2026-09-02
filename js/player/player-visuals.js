(function (global) {
  "use strict";

  const PLAYER_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='22' fill='%2311213f'/%3E%3Ccircle cx='60' cy='42' r='22' fill='%23ffd34f'/%3E%3Cpath d='M22 108c6-28 24-42 38-42s32 14 38 42' fill='%2385cdf5'/%3E%3C/svg%3E";

  function create({ getPlayerVisualsById, escapeHtml }) {
    function candidates(player, playerId = player?.playerId) {
      const id = playerId != null ? String(playerId) : "";
      const globalVisual = id ? (getPlayerVisualsById()?.get(id) || {}) : {};
      const seasonalFront = player?.frontFullbodyUrl || player?.fullbodyUrl || null;
      const globalFront = globalVisual.frontFullbodyUrl || globalVisual.fullbodyUrl || null;
      const seasonalPortrait = player?.portraitUrl || null;
      const globalPortrait = globalVisual.portraitUrl || globalVisual.imageUrl || null;
      const compatibleImage = player?.image || player?.imageUrl || globalVisual.image || globalVisual.imageUrl || null;
      return {
        playerId: id,
        portraitUrl: seasonalPortrait || globalPortrait || compatibleImage || null,
        frontFullbodyUrl: seasonalFront || globalFront || null,
        seasonalPortrait,
        globalPortrait,
        compatibleImage,
        seasonalFront,
        globalFront,
      };
    }

    function resolve(player, { playerId = player?.playerId, placeholder = PLAYER_IMAGE_PLACEHOLDER } = {}) {
      const visual = candidates(player, playerId);
      const detailFallbacks = [visual.frontFullbodyUrl, visual.portraitUrl, placeholder].filter(Boolean);
      const cardFallbacks = [visual.portraitUrl, visual.frontFullbodyUrl, placeholder].filter(Boolean);
      return {
        playerId: visual.playerId,
        portraitUrl: visual.portraitUrl,
        frontFullbodyUrl: visual.frontFullbodyUrl,
        detailImageUrl: detailFallbacks[0] || null,
        cardImageUrl: cardFallbacks[0] || null,
        detailFallbacks,
        cardFallbacks,
        detailImageKind: visual.frontFullbodyUrl ? "fullbody" : (visual.portraitUrl ? "portrait" : "placeholder"),
        cardImageKind: visual.portraitUrl ? "portrait" : (visual.frontFullbodyUrl ? "fullbody" : "placeholder"),
      };
    }

    function imageFallbackAttributes(urls, handler = "globalThis.handlePlayerImageError") {
      const unique = [...new Set((urls || []).filter(Boolean))];
      return `data-image-fallbacks="${escapeHtml(JSON.stringify(unique))}" data-image-fallback-index="0" onerror="${handler} && ${handler}(this)"`;
    }

    function handleImageError(img) {
      if (!img || img.dataset.imageFallbackDone === "true") return;
      let fallbacks = [];
      try { fallbacks = JSON.parse(img.dataset.imageFallbacks || "[]"); } catch (_) { fallbacks = []; }
      const next = Number(img.dataset.imageFallbackIndex || 0) + 1;
      if (fallbacks[next]) {
        img.dataset.imageFallbackIndex = String(next);
        img.src = fallbacks[next];
        return;
      }
      img.dataset.imageFallbackDone = "true";
      img.onerror = null;
      if (img.src !== PLAYER_IMAGE_PLACEHOLDER) img.src = PLAYER_IMAGE_PLACEHOLDER;
    }

    function portraitUrl(player) {
      return resolve(player).cardImageUrl || PLAYER_IMAGE_PLACEHOLDER;
    }

    return { candidates, resolve, imageFallbackAttributes, handleImageError, portraitUrl, placeholder: PLAYER_IMAGE_PLACEHOLDER };
  }

  global.PlayerVisuals = { create, PLAYER_IMAGE_PLACEHOLDER };
})(globalThis);
