(function (global) {
  "use strict";

  const CUP_LABELS = Object.freeze({
    ie1: "COPPA IE1",
    ie1_s2: "COPPA IE2",
    ie1_s3: "COPPA IE3",
    ie2: "COPPA ARES",
  });

  function normalizeSeasonId(value) {
    return global.SeasonRegistry?.normalizeSeasonId?.(value) || String(value || global.SeasonRegistry?.activeId?.() || "ie1");
  }

  function cupAsset(seasonId) {
    const id = normalizeSeasonId(seasonId);
    return global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.cupsBySeason?.[id]
      || global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.cups
      || "";
  }

  // Keep the exact season that generated the latest permanent run reward.
  // Besides fixing the presentation, normalize the id before DevelopmentV2
  // credits cupsBySeason so every season always increments its own balance.
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
    reward.dataset.rewardSeason = seasonId;
  }

  function projectPurchaseSummary(button) {
    const rarity = String(button.dataset.buyProject || "");
    const price = Number(global.DevelopmentV2?.PROJECT_PRICES?.[rarity] || 0);
    return {
      name: `PROGETTO ${rarity.toUpperCase()}`,
      cost: `${price} MONETE`,
    };
  }

  function emblemPurchaseSummary(button) {
    const emblemId = String(button.dataset.buyEmblem || "");
    const product = global.ShopCatalog?.build?.().find((item) => String(item.emblemId) === emblemId);
    if (!product) return { name: "QUESTO STEMMA", cost: "il costo indicato" };
    const seasonId = normalizeSeasonId(product.seasonId);
    const cupText = Number(product.cups || 0) > 0
      ? ` + ${Number(product.cups)} ${CUP_LABELS[seasonId] || "COPPA SEASON"}`
      : "";
    return {
      name: `STEMMA ${String(product.name || "").toUpperCase()}`,
      cost: `${Number(product.coins || 0)} MONETE${cupText}`,
    };
  }

  // Purchase confirmation is intentionally installed in capture phase: the
  // shop's existing handlers remain the only code that actually spends state.
  // On YES we re-dispatch one click marked as confirmed; on NO nothing changes.
  function installPurchaseConfirmation() {
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-buy-project], [data-buy-emblem]");
      if (!button || button.disabled) return;
      if (button.dataset.purchaseConfirmed === "1") {
        delete button.dataset.purchaseConfirmed;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      const summary = button.matches("[data-buy-project]")
        ? projectPurchaseSummary(button)
        : emblemPurchaseSummary(button);
      const accepted = global.confirm(`Stai acquistando ${summary.name}.\nCosto: ${summary.cost}.\n\nConfermi l'acquisto?`);
      if (!accepted) return;
      button.dataset.purchaseConfirmed = "1";
      button.click();
    }, true);
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
  installPurchaseConfirmation();
  installRewardObserver();
})(globalThis);
