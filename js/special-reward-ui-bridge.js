(function (global) {
  "use strict";

  const DECLINE_SELECTOR = "[data-decline-special-reward-full-roster]";
  let liveRun = null;

  function installLiveRunCapture() {
    const runState = global.RunState;
    if (!runState?.save || runState.save.__specialRewardLiveRunCapture) return;

    const originalSave = runState.save;
    function trackedSave(activeRun, ...args) {
      if (activeRun?.seasonId === "ie1_s2") liveRun = activeRun;
      return originalSave.call(runState, activeRun, ...args);
    }
    trackedSave.__specialRewardLiveRunCapture = true;
    trackedSave.__specialRewardOriginalSave = originalSave;
    runState.save = trackedSave;
  }

  function activeLiveSpecialReward() {
    if (liveRun?.seasonId !== "ie1_s2" || !liveRun.pendingSpecialMatchReward) return null;
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
