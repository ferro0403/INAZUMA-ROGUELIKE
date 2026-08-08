(function (global) {
  "use strict";

  const RESUME_KEY = "inazuma:special-reward-decline-resume";
  const DECLINE_SELECTOR = "[data-decline-special-reward-full-roster]";

  function activeSpecialRewardRun({ readOnly = true } = {}) {
    const seasonId = global.SeasonRegistry?.activeId?.();
    if (seasonId !== "ie1_s2") return null;
    const run = global.RunState?.load?.(seasonId, { readOnly });
    if (!run?.pendingSpecialMatchReward) return null;
    return { seasonId, run, pending: run.pendingSpecialMatchReward };
  }

  function declineFromFullRoster(button) {
    if (button?.disabled) return;
    const context = activeSpecialRewardRun({ readOnly: false });
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
    global.sessionStorage?.setItem?.(RESUME_KEY, context.seasonId);
    global.location.reload();
  }

  function addDeclineToReplacementModal() {
    const modal = document.querySelector("#modal-root .bench-replacement-modal");
    if (!modal || modal.querySelector(DECLINE_SELECTOR)) return;
    if (!activeSpecialRewardRun()) return;

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

  function resumeMapAfterDecline() {
    const seasonId = global.sessionStorage?.getItem?.(RESUME_KEY);
    if (!seasonId) return;

    const startedAt = Date.now();
    const observer = new MutationObserver(() => {
      const continueLabel = document.getElementById("continue-run");
      const continueButton = continueLabel?.closest?.("button");
      if (continueButton) {
        global.sessionStorage.removeItem(RESUME_KEY);
        observer.disconnect();
        continueButton.click();
        return;
      }
      if (Date.now() - startedAt > 10000) observer.disconnect();
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  }

  installReplacementObserver();
  resumeMapAfterDecline();
})(globalThis);
