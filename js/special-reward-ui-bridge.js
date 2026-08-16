(function (global) {
  "use strict";

  const DECLINE_SELECTOR = "[data-decline-special-reward-full-roster]";
  const IE3_SEASON_ID = "ie1_s3";
  const STAT_LABELS = Object.freeze({
    attack: "Attacco",
    physical: "Fisico",
    stamina: "Resistenza",
    control: "Controllo",
    defense: "Difesa",
    speed: "Velocità",
    grit: "Grinta",
    save: "Parata",
  });
  let liveRun = null;
  let autoClaimProfileId = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[char]);
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

  function returnToMapWithoutReload() {
    const mapButton = document.querySelector("#app [data-nav='map']");
    if (!mapButton) return false;
    mapButton.click();
    return true;
  }

  function declineFromFullRoster(button) {
    if (button?.disabled) return;
    const context = activeLiveSpecialReward();
    if (!context) return;

    button.disabled = true;
    const result = global.SpecialMatchRuntime?.decline?.(context.run, context.pending);
    if (!result || result.status === "no-pending-reward") {
      button.disabled = false;
      return;
    }

    context.run.phase = "map";
    context.run.activeMatch = null;
    global.RunState.save(context.run);

    if (!returnToMapWithoutReload()) {
      button.disabled = false;
      console.error("Special reward decline: map navigation target unavailable");
    }
  }

  function addDeclineToReplacementModal() {
    const modal = document.querySelector("#modal-root .bench-replacement-modal");
    if (!modal || modal.querySelector(DECLINE_SELECTOR)) return;
    if (!activeLiveSpecialReward()) return;

    let footer = modal.querySelector(".bench-replacement-footer");
    if (!footer) {
      footer = document.createElement("div");
      footer.className = "button-row bench-replacement-footer";
      modal.appendChild(footer);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost";
    button.dataset.declineSpecialRewardFullRoster = "true";
    button.textContent = "RIFIUTA";
    button.addEventListener("click", () => declineFromFullRoster(button));
    footer.prepend(button);
  }

  function rarityClass(category) {
    const key = String(category || "").toLocaleLowerCase("it");
    return ({ scarso: "rarity-scarso", debole: "rarity-debole", normale: "rarity-normale", buono: "rarity-buono", forte: "rarity-forte", elite: "rarity-elite", mondiale: "rarity-mondiale", leggenda: "rarity-leggenda" })[key] || "rarity-debole";
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

  function resolveRewardDetailPlayer(candidate, meta) {
    const entry = {
      playerId: String(candidate?.playerId || ""),
      activeProfileId: String(candidate?.profileId || candidate?.activeProfileId || ""),
      activeRoleVariantId: String(candidate?.defaultRoleVariantId || candidate?.activeRoleVariantId || ""),
      level: Math.max(0, Math.floor(Number(meta.level || 0))),
      levelUnits: 0,
    };
    const base = global.ProfiledSeasonRuntime?.resolveEffectiveBase?.(entry, IE3_SEASON_ID) || candidate || {};
    const resolved = global.InazumaProgression?.getPlayerAtLevel
      ? global.InazumaProgression.getPlayerAtLevel(base, entry.level, meta.database, entry)
      : base;
    return { ...base, ...resolved, playerId: entry.playerId, profileId: entry.activeProfileId };
  }

  function rewardDetailImage(player) {
    return player?.frontFullbodyUrl || player?.fullbodyUrl || player?.cardImageUrl || player?.imageUrl || player?.portraitUrl || "";
  }

  function rewardDetailStatsMarkup(player) {
    const stats = player?.stats || {};
    return Object.entries(STAT_LABELS).map(([stat, label]) => {
      const value = Math.max(0, Number(stats[stat] || 0));
      const width = Math.max(0, Math.min(100, value));
      return `<div class="detail-stat player-stat-card" style="--stat-value:${width}%"><span class="detail-stat-label">${escapeHtml(label)}</span><strong class="detail-stat-value">${escapeHtml(value)}</strong><span class="detail-stat-track" aria-hidden="true"><i></i></span></div>`;
    }).join("");
  }

  function showIe3PlayerDetail(modal, candidate, meta) {
    modal.querySelector(".ie3-secondary-full-player-detail")?.remove();
    const player = resolveRewardDetailPlayer(candidate, meta);
    const category = String(player.category || candidate?.category || "Debole");
    const role = String(player.position || player.normalizedRole || candidate?.position || "-");
    const element = String(player.element || player.type || candidate?.element || candidate?.type || "-");
    const overall = Number(player.overall ?? player.finalOverall ?? 0);
    const potential = Number(player.potential ?? player.finalOverall ?? overall);
    const image = rewardDetailImage(player);
    const teamLogo = meta.team?.logoUrl || "";

    const detail = document.createElement("section");
    detail.className = "ie3-secondary-full-player-detail";
    detail.innerHTML = `
      <div class="ie3-secondary-full-player-detail-shell player-detail-modal">
        <div class="ie3-secondary-detail-toolbar">
          <button type="button" class="btn btn-back" data-ie3-detail-close>← TORNA ALLA SCELTA</button>
        </div>
        <div class="player-detail-layout ${rarityClass(category)}">
          <section class="player-detail-hero ${String(player.name || "").length > 18 ? "player-detail-hero--extra-long-name" : (String(player.name || "").length > 12 ? "player-detail-hero--long-name" : "")}">
            <div class="player-detail-identity">
              <div class="player-detail-team" aria-label="Squadra ${escapeHtml(meta.teamName)}">
                ${teamLogo ? `<img src="${escapeHtml(teamLogo)}" alt="" loading="lazy" decoding="async">` : ""}
                <strong>${escapeHtml(meta.teamName)}</strong>
              </div>
              <div class="player-detail-heading"><p class="eyebrow">Scheda giocatore</p></div>
              <h2 class="player-detail-name">${escapeHtml(player.name || candidate?.name || "Giocatore")}</h2>
              <div class="player-detail-tags"><span class="role-chip"><b>${escapeHtml(role)}</b></span><span class="role-chip detail-element-chip">${escapeHtml(element)}</span><span class="role-chip">Lv ${escapeHtml(meta.level)}</span></div>
              <div class="overall-comparison"><div><span>Overall<br><b>attuale</b></span><strong>${escapeHtml(overall)}</strong></div><div><span>Potenziale</span><strong>${escapeHtml(potential)}</strong></div></div>
              <p class="detail-category"><span aria-hidden="true">★</span><small>Rarità</small><strong>${escapeHtml(category)}</strong></p>
            </div>
            <div class="player-detail-visual ${rarityClass(category)}">${image ? `<img class="player-fullbody" src="${escapeHtml(image)}" alt="${escapeHtml(player.name || candidate?.name || "Giocatore")}" loading="eager" decoding="async">` : '<span class="player-fullbody player-fullbody-placeholder" aria-hidden="true">⚽</span>'}</div>
          </section>
          <section class="player-detail-content">
            <section class="player-detail-section"><h3><span>Statistiche</span></h3><div class="detail-stats">${rewardDetailStatsMarkup(player)}</div></section>
            <section class="player-detail-section player-detail-equipment"><h3><span>Equipaggiamento</span></h3><div class="equipped-detail equipped-detail-empty"><div class="equipped-detail-copy"><span>Slot disponibile</span><strong>Nessun equipaggiamento</strong><small>Il giocatore non è ancora stato acquisito.</small></div></div></section>
          </section>
        </div>
      </div>`;
    detail.querySelector("[data-ie3-detail-close]")?.addEventListener("click", () => detail.remove());
    modal.append(detail);
    detail.scrollTop = 0;
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
    standard.innerHTML = `
      <div class="modal-head event-modal-head pull-selection-head">
        <button type="button" class="btn btn-back" data-ie3-secondary-back>← TORNA ALLA MAPPA</button>
        <div>
          <p class="eyebrow">SCELTA GIOCATORE</p>
          <h2>RICOMPENSA · ${escapeHtml(meta.teamName)}</h2>
          <p class="muted">Scegli 1 giocatore su 3 · Livello ${escapeHtml(meta.level)}</p>
        </div>
      </div>
      <div class="candidate-grid pull-offer-grid ie3-secondary-choice-grid" data-ie3-secondary-choice-grid></div>
      <div class="button-row pull-selection-footer ie3-secondary-reward-footer">
        <button type="button" class="btn btn-ghost" data-ie3-secondary-decline>RINUNCIA</button>
      </div>`;

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
      actions.innerHTML = `<div class="button-row pull-choice-action-row"><button type="button" class="btn" data-ie3-secondary-confirm>SÌ</button><button type="button" class="btn" data-ie3-secondary-detail>SCHEDA</button></div>`;
      actions.querySelector("[data-ie3-secondary-confirm]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        autoClaimProfileId = String(profileId);
        nativeCard.click();
      });
      actions.querySelector("[data-ie3-secondary-detail]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showIe3PlayerDetail(modal, candidate, meta);
      });
      option.append(actions);
      grid.append(option);
    });

    const decline = () => {
      if (nativeDecline && !nativeDecline.disabled) nativeDecline.click();
      else declineFromFullRoster(standard.querySelector("[data-ie3-secondary-decline]"));
    };
    standard.querySelector("[data-ie3-secondary-decline]")?.addEventListener("click", decline);
    standard.querySelector("[data-ie3-secondary-back]")?.addEventListener("click", decline);

    modal.prepend(standard);
    modal.append(nativeHolder);
    modal.classList.add("ie3-secondary-standard-reward-modal");
    modal.dataset.ie3StandardReward = "1";
  }

  function installReplacementObserver() {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) return;
    const observer = new MutationObserver(() => {
      addDeclineToReplacementModal();
      patchIe3SpecialRewardModal();
    });
    observer.observe(modalRoot, { childList: true, subtree: true });
    addDeclineToReplacementModal();
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
