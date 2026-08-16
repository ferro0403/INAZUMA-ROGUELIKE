(function (global) {
  "use strict";

  const DECLINE_SELECTOR = "[data-decline-special-reward-full-roster]";
  let liveRun = null;

  function installLiveRunCapture() {
    const runState = global.RunState;
    if (!runState?.save || runState.save.__specialRewardLiveRunCapture) return;

    const originalSave = runState.save;
    function trackedSave(activeRun, ...args) {
      if (["ie1_s2", "ie1_s3"].includes(activeRun?.seasonId)) liveRun = activeRun;
      return originalSave.call(runState, activeRun, ...args);
    }
    trackedSave.__specialRewardLiveRunCapture = true;
    trackedSave.__specialRewardOriginalSave = originalSave;
    runState.save = trackedSave;
  }

  function activeLiveSpecialReward() {
    if (!["ie1_s2", "ie1_s3"].includes(liveRun?.seasonId) || !liveRun.pendingSpecialMatchReward) return null;
    return { run: liveRun, pending: liveRun.pendingSpecialMatchReward };
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

  function installReplacementObserver() {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) return;
    const observer = new MutationObserver(addDeclineToReplacementModal);
    observer.observe(modalRoot, { childList: true, subtree: true });
    addDeclineToReplacementModal();
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
