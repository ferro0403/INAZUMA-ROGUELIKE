(function (global) {
  "use strict";

  const IE3_SEASON_ID = "ie1_s3";
  const PLAYER_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='22' fill='%2311213f'/%3E%3Ccircle cx='60' cy='42' r='22' fill='%23ffd34f'/%3E%3Cpath d='M22 108c6-28 24-42 38-42s32 14 38 42' fill='%2385cdf5'/%3E%3C/svg%3E";
  const STAT_LABELS = Object.freeze({
    attack: "Attacco",
    control: "Controllo",
    speed: "Velocità",
    grit: "Grinta",
    physical: "Fisico",
    stamina: "Resistenza",
    defense: "Difesa",
    save: "Parata",
  });

  let liveRun = null;
  let autoClaimProfileId = null;
  let playerVisualsById = new Map();

  const playerVisualsReady = fetch("data/PLAYER_VISUALS.json")
    .then((response) => {
      if (!response.ok) throw new Error(`PLAYER_VISUALS non raggiungibile (${response.status})`);
      return response.json();
    })
    .then((visualsDb) => {
      playerVisualsById = new Map(Object.entries(visualsDb?.players || {}));
      return playerVisualsById;
    })
    .catch((error) => {
      console.warn("IE3 secondary reward: fallback visual database unavailable", error);
      return playerVisualsById;
    });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installLiveRunCapture() {
    const runState = global.RunState;
    if (!runState?.save || runState.save.__specialRewardLiveRunCapture) return;
    const originalSave = runState.save;
    function trackedSave(activeRun, ...args) {
      if (["ie1_s2", IE3_SEASON_ID].includes(activeRun?.seasonId)) liveRun = activeRun;
      return originalSave.call(runState, activeRun, ...args);
    }
    trackedSave.__specialRewardLiveRunCapture = true;
    trackedSave.__specialRewardOriginalSave = originalSave;
    runState.save = trackedSave;
  }

  function activeLiveSpecialReward() {
    if (!["ie1_s2", IE3_SEASON_ID].includes(liveRun?.seasonId) || !liveRun.pendingSpecialMatchReward) return null;
    return { run: liveRun, pending: liveRun.pendingSpecialMatchReward };
  }

  function activeIe3SpecialReward() {
    const context = activeLiveSpecialReward();
    return context?.run?.seasonId === IE3_SEASON_ID ? context : null;
  }

  function adaptReplacementCancel() {
    const modal = document.querySelector("#modal-root .bench-replacement-modal");
    const button = modal?.querySelector("#cancel-recruit");
    if (!button || !activeLiveSpecialReward() || button.dataset.specialRewardCancelAdapted === "1") return;
    button.textContent = "RIFIUTA";
    button.dataset.specialRewardCancelAdapted = "1";
  }

  function rarityClass(category) {
    return ({ Scarso: "rarity-scarso", Debole: "rarity-debole", Normale: "rarity-normale", Buono: "rarity-buono", Forte: "rarity-forte", Elite: "rarity-elite", Mondiale: "rarity-mondiale", Leggenda: "rarity-leggenda" })[category] || "rarity-debole";
  }

  function statIcon(stat) {
    const icons = {
      attack: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M9 12h6"/></svg>`,
      control: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17"/></svg>`,
      speed: `<svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/></svg>`,
      grit: `<svg viewBox="0 0 24 24"><path d="M12 21c4-2 7-5 7-9 0-3-2-5-4-7 0 3-2 4-3 5-1-2-1-4-1-6-3 2-6 5-6 9 0 4 3 7 7 8Z"/></svg>`,
      physical: `<svg viewBox="0 0 24 24"><path d="M7 13c1-5 4-8 8-7 2 1 3 3 2 5l3 1-2 4-4-1-2 4H7v-6Z"/><path d="M5 14h7"/></svg>`,
      stamina: `<svg viewBox="0 0 24 24"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 7-6 10-6 12Z"/><path d="M7 12h3l1-3 2 6 1-3h3"/></svg>`,
      defense: `<svg viewBox="0 0 24 24"><path d="M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M12 7v10"/></svg>`,
      save: `<svg viewBox="0 0 24 24"><path d="M7 20V8a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v11H7Z"/><path d="M7 14 4 12"/></svg>`,
    };
    return `<span class="detail-stat-icon" aria-hidden="true">${icons[stat] || icons.control}</span>`;
  }

  function imageFallbackAttributes(urls) {
    const unique = [...new Set((urls || []).filter(Boolean))];
    return `data-image-fallbacks="${escapeHtml(JSON.stringify(unique))}" data-image-fallback-index="0" onerror="globalThis.handlePlayerImageError && globalThis.handlePlayerImageError(this)"`;
  }

  // Keep this resolver byte-for-byte equivalent in behaviour to app.js.
  // The normal player sheet does not rely only on the seasonal profile: it also
  // resolves PLAYER_VISUALS.json by playerId. Missing this global fallback was
  // the reason IE3 secondary rewards showed the framed portrait instead of the
  // same full-body visual used by the native player sheet.
  function playerImageCandidates(player, playerId = player?.playerId) {
    const id = playerId != null ? String(playerId) : "";
    const globalVisual = id ? (playerVisualsById.get(id) || {}) : {};
    const seasonalFront = player?.frontFullbodyUrl || player?.fullbodyUrl || null;
    const globalFront = globalVisual.frontFullbodyUrl || globalVisual.fullbodyUrl || null;
    const seasonalPortrait = player?.portraitUrl || null;
    const globalPortrait = globalVisual.portraitUrl || globalVisual.imageUrl || null;
    const compatibleImage = player?.image || player?.imageUrl || globalVisual.image || globalVisual.imageUrl || null;
    const portraitUrl = seasonalPortrait || globalPortrait || compatibleImage || null;
    const frontFullbodyUrl = seasonalFront || globalFront || null;
    return { playerId: id, portraitUrl, frontFullbodyUrl, seasonalPortrait, globalPortrait, compatibleImage, seasonalFront, globalFront };
  }

  function resolvePlayerVisual(player, { playerId = player?.playerId, placeholder = PLAYER_IMAGE_PLACEHOLDER } = {}) {
    const visual = playerImageCandidates(player, playerId);
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

  function ie3RewardMeta(context) {
    const database = global.SeasonRegistry?.database?.(IE3_SEASON_ID);
    const special = global.SpecialMatchRuntime?.byId?.(database, context.pending.specialMatchId);
    const team = (database?.teams || []).find((candidate) => String(candidate.teamId || candidate.id) === String(special?.teamId || context.pending.teamId));
    return {
      database,
      special,
      team,
      teamName: String(team?.teamName || team?.name || special?.teamName || "Squadra"),
      level: Number(special?.matchLevel || 0),
    };
  }

  function nativeDetailMarkup(player, meta) {
    const detailVisual = resolvePlayerVisual(player, { playerId: player?.playerId });
    const resolved = player.stats && player.baseStats
      ? player
      : global.InazumaProgression.getPlayerAtLevel(player, Math.floor(Number(meta.level || 0)), meta.database);
    const baseStats = resolved.baseStats || resolved.stats || {};
    const effectiveStats = resolved.baseStats ? resolved.stats : resolved.stats;
    const stats = Object.entries(STAT_LABELS).map(([stat, label]) => {
      const base = Number(baseStats[stat] || 0);
      const effective = Number(effectiveStats?.[stat] || 0);
      const bonus = effective - base;
      const barValue = Math.max(0, Math.min(100, effective));
      return `<div class="detail-stat player-stat-card" style="--stat-value:${barValue}%">${statIcon(stat)}<span class="detail-stat-label">${label}</span><strong class="detail-stat-value">${effective}</strong>${bonus > 0 ? `<em class="detail-stat-bonus">+${bonus}</em>` : ""}<span class="detail-stat-track" aria-hidden="true"><i></i></span></div>`;
    }).join("");
    const potential = resolved.potential ?? player.finalOverall;
    const displayLevel = global.LevelProgression?.formatLevel?.(meta.level, liveRun?.seasonId) ?? meta.level;
    const teamLogo = meta.team?.logoUrl || "";
    const teamBadge = `<div class="player-detail-team" aria-label="Squadra ${escapeHtml(meta.teamName)}">${teamLogo ? `<img src="${escapeHtml(teamLogo)}" alt="${escapeHtml(meta.teamName)}" loading="lazy" />` : ""}<strong>${escapeHtml(meta.teamName)}</strong></div>`;
    const equipmentMarkup = `<div class="equipped-detail equipped-detail-empty"><div class="equipped-detail-copy"><span>Slot disponibile</span><strong>Nessun equipaggiamento</strong><small>Questo giocatore non ha ancora un oggetto assegnato.</small></div></div>`;

    return `<div class="player-detail-layout ${rarityClass(resolved.category)}">
      <section class="player-detail-hero ${String(resolved.name || "").length > 18 ? "player-detail-hero--extra-long-name" : (String(resolved.name || "").length > 12 ? "player-detail-hero--long-name" : "")}">
        <div class="player-detail-identity">${teamBadge}<div class="player-detail-heading"><p class="eyebrow">Scheda giocatore</p></div><h2 class="player-detail-name">${escapeHtml(resolved.name)}</h2><div class="player-detail-tags"><span class="role-chip"><b>${escapeHtml(resolved.position)}</b></span><span class="role-chip detail-element-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z"/></svg>${escapeHtml(resolved.element || resolved.type || "-")}</span><span class="role-chip">Lv ${escapeHtml(displayLevel)}</span></div><div class="overall-comparison"><div><span>Overall<br><b>attuale</b></span><strong>${escapeHtml(resolved.overall ?? "N/D")}</strong></div><div><span>Potenziale</span><strong>${escapeHtml(potential)}</strong></div></div><p class="detail-category"><span aria-hidden="true">★</span><small>Rarità</small><strong>${escapeHtml(resolved.category)}</strong></p></div>
        <div class="player-detail-visual ${rarityClass(resolved.category)}">${detailVisual.detailImageUrl ? `<img class="player-fullbody player-fullbody--${escapeHtml(detailVisual.detailImageKind)}" src="${escapeHtml(detailVisual.detailImageUrl)}" alt="${escapeHtml(resolved.name)}" loading="lazy" decoding="async" ${imageFallbackAttributes(detailVisual.detailFallbacks)} />` : `<span class="player-fullbody player-fullbody-placeholder" aria-hidden="true">⚽</span>`}</div>
      </section>
      <section class="player-detail-content"><section class="player-detail-section"><h3><span>Statistiche</span></h3><div class="detail-stats">${stats}</div></section><section class="player-detail-section player-detail-equipment"><h3><span>Equipaggiamento</span></h3>${equipmentMarkup}</section></section>
    </div>`;
  }

  async function showIe3PlayerDetail(player, meta) {
    await playerVisualsReady;
    const modalRoot = document.getElementById("modal-root");
    const rewardBackdrop = modalRoot?.firstElementChild;
    if (!modalRoot || !rewardBackdrop) return;
    const rewardScrollTop = rewardBackdrop.querySelector(".modal")?.scrollTop || 0;
    rewardBackdrop.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("section");
    modal.className = "modal player-detail-modal";
    modal.innerHTML = `<button type="button" class="modal-close" data-close-modal aria-label="Chiudi">✕</button>${nativeDetailMarkup(player, meta)}`;
    backdrop.append(modal);
    modalRoot.append(backdrop);
    modalRoot.classList.add("has-open-modal");
    modal.scrollTop = 0;

    const restoreReward = () => {
      if (modalRoot.firstElementChild !== backdrop) return;
      backdrop.remove();
      modalRoot.append(rewardBackdrop);
      modalRoot.classList.add("has-open-modal");
      const rewardModal = rewardBackdrop.querySelector(".modal");
      if (rewardModal) rewardModal.scrollTop = rewardScrollTop;
      rewardBackdrop.querySelector("[data-ie3-secondary-detail]")?.focus?.({ preventScroll: true });
    };
    modal.querySelector("[data-close-modal]")?.addEventListener("click", restoreReward);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) restoreReward(); });
  }

  function patchIe3SpecialRewardModal() {
    const context = activeIe3SpecialReward();
    const modal = document.querySelector("#modal-root .special-reward-modal");
    if (!context || !modal || modal.dataset.ie3StandardReward === "1") return;

    const nativeClaim = modal.querySelector("#claim-special-reward");
    if (autoClaimProfileId && String(context.pending.selectedProfileId || "") === String(autoClaimProfileId)) {
      autoClaimProfileId = null;
      if (nativeClaim && !nativeClaim.disabled) queueMicrotask(() => nativeClaim.click());
      return;
    }

    const nativeGrid = modal.querySelector(".pull-offer-grid");
    const nativeDecline = modal.querySelector("#decline-special-reward");
    const nativeActions = modal.querySelector(".special-reward-actions");
    const nativeHead = modal.querySelector(".special-reward-head");
    if (!nativeGrid || !nativeActions || !nativeHead) return;

    const nativeCards = [...nativeGrid.querySelectorAll("[data-player-id]")];
    const candidateProfileIds = context.pending.candidateProfileIds || [];
    const candidates = candidateProfileIds.map((profileId) => global.ProfiledSeasonRuntime?.resolveProfile?.(IE3_SEASON_ID, profileId)).filter(Boolean);
    const meta = ie3RewardMeta(context);

    const nativeHolder = document.createElement("div");
    nativeHolder.className = "ie3-secondary-reward-native";
    nativeHolder.setAttribute("aria-hidden", "true");
    nativeHolder.append(nativeHead, nativeGrid, nativeActions);

    const standard = document.createElement("section");
    standard.className = "ie3-secondary-standard-reward";
    const pullProgress = Number(context.pending.totalRewards || 1) > 1
      ? ` · PULL ${Number(context.pending.currentReward || 1)}/${Number(context.pending.totalRewards)}`
      : "";
    standard.innerHTML = `<div class="modal-head event-modal-head pull-selection-head"><div><p class="eyebrow">SCELTA GIOCATORE${pullProgress}</p><h2>RICOMPENSA · ${escapeHtml(meta.teamName)}</h2><p class="muted">Scegli 1 giocatore su 3 · Livello ${escapeHtml(meta.level)}</p></div></div><div class="candidate-grid pull-offer-grid ie3-secondary-choice-grid" data-ie3-secondary-choice-grid></div><div class="button-row pull-selection-footer ie3-secondary-reward-footer"><button type="button" class="btn btn-ghost" data-ie3-secondary-decline>RINUNCIA</button></div>`;

    const grid = standard.querySelector("[data-ie3-secondary-choice-grid]");
    nativeCards.forEach((nativeCard, index) => {
      const candidate = candidates[index];
      const profileId = candidateProfileIds[index];
      if (!candidate || !profileId) return;
      const option = document.createElement("div");
      option.className = `pull-choice-option ${rarityClass(candidate.category)}`;
      option.dataset.profileId = String(profileId);
      const cardClone = nativeCard.cloneNode(true);
      cardClone.removeAttribute("id");
      option.append(cardClone);
      const actions = document.createElement("div");
      actions.className = "pull-choice-actions";
      actions.innerHTML = `<div class="button-row pull-choice-action-row"><button type="button" class="btn btn-primary" data-ie3-secondary-confirm>SÌ</button><button type="button" class="btn btn-yellow" data-ie3-secondary-detail>SCHEDA</button></div>`;
      actions.querySelector("[data-ie3-secondary-confirm]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        autoClaimProfileId = String(profileId);
        nativeCard.click();
      });
      actions.querySelector("[data-ie3-secondary-detail]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showIe3PlayerDetail(candidate, meta);
      });
      option.append(actions);
      grid.append(option);
    });

    const decline = () => { if (nativeDecline && !nativeDecline.disabled) nativeDecline.click(); };
    standard.querySelector("[data-ie3-secondary-decline]")?.addEventListener("click", decline);

    modal.prepend(standard);
    modal.append(nativeHolder);
    modal.classList.add("ie3-secondary-standard-reward-modal");
    modal.dataset.ie3StandardReward = "1";
  }

  function installReplacementObserver() {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) return;
    const observer = new MutationObserver(() => {
      adaptReplacementCancel();
      patchIe3SpecialRewardModal();
    });
    observer.observe(modalRoot, { childList: true, subtree: true });
    adaptReplacementCancel();
    patchIe3SpecialRewardModal();
  }

  installLiveRunCapture();
  installReplacementObserver();
})(globalThis);

(function (global) {
  "use strict";

  const CUP_LABELS = Object.freeze({ ie1: "COPPA IE1", ie1_s2: "COPPA IE2", ie1_s3: "COPPA IE3", ie2: "COPPA ARES" });

  function normalizeSeasonId(value) {
    return global.SeasonRegistry?.normalizeSeasonId?.(value) || String(value || global.SeasonRegistry?.activeId?.() || "ie1");
  }

  function cupAsset(seasonId) {
    const id = normalizeSeasonId(seasonId);
    return global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.cupsBySeason?.[id] || global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.cups || "";
  }

  function installRewardSeasonGuard() {
    const development = global.DevelopmentV2;
    if (!development?.processRunEnd || development.processRunEnd.__seasonGuardInstalled) return;
    const original = development.processRunEnd.bind(development);
    const guarded = function guardedProcessRunEnd(input = {}) {
      const seasonId = normalizeSeasonId(input.seasonId);
      global.__inazumaLastRewardSeasonId = seasonId;
      return original({ ...input, seasonId });
    };
    guarded.__seasonGuardInstalled = true;
    development.processRunEnd = guarded;
  }

  function patchRewardCupPresentation(root = document) {
    const reward = root.querySelector?.(".development-reward-cup") || document.querySelector(".development-reward-cup");
    if (!reward) return;
    const seasonId = normalizeSeasonId(global.__inazumaLastRewardSeasonId || global.SeasonRegistry?.activeId?.());
    const src = cupAsset(seasonId);
    const image = reward.querySelector("img");
    if (image && src) {
      image.dataset.cupFallback = src;
      image.src = src;
    }
    const label = reward.querySelector("small");
    if (label) label.textContent = CUP_LABELS[seasonId] || "COPPA SEASON";
  }

  function installRewardObserver() {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(".development-reward-cup") || node.querySelector?.(".development-reward-cup")) {
            patchRewardCupPresentation(node);
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    patchRewardCupPresentation();
  }

  installRewardSeasonGuard();
  installRewardObserver();
})(globalThis);
