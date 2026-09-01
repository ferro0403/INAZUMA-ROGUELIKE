(function () {
  "use strict";

  const modalRoot = document.getElementById("modal-root");
  const app = document.getElementById("app");
  if (!modalRoot) return;

  function releaseSimulationModalShell() {
    if (!modalRoot.querySelector(".five-simulation-modal")) return;

    modalRoot.innerHTML = "";
    modalRoot._restoreFocusTo = null;
    modalRoot._restoreScrollTo = null;
    modalRoot._onClose = null;
    modalRoot.removeAttribute("style");
    modalRoot.classList.remove("has-open-modal");

    [document.documentElement, document.body, app].forEach((element) => {
      if (!element) return;
      element.classList.remove("modal-scroll-locked");
      const savedStyle = element._modalSavedStyle;
      if (savedStyle !== undefined) {
        if (savedStyle == null) element.removeAttribute("style");
        else element.setAttribute("style", savedStyle);
        delete element._modalSavedStyle;
      }
    });
  }

  function polishSimulationModal() {
    const modal = modalRoot.querySelector(".five-simulation-modal");
    if (!modal) return;

    const skipButton = modal.querySelector("#skip-match-result");
    if (skipButton) {
      skipButton.classList.remove("btn-secondary");
      skipButton.classList.add("btn-yellow", "btn-primary-action");
    }

    const continueButton = modal.querySelector("#continue-match-result");
    if (continueButton && !continueButton.dataset.mapModalReleaseBound) {
      continueButton.dataset.mapModalReleaseBound = "true";
      continueButton.addEventListener("click", () => {
        // app.js finalizes the already-resolved match and renders the proper destination first.
        // The modal itself previously remained mounted above that destination, making the
        // "Torna alla mappa" action appear broken. Release only the modal shell afterwards.
        setTimeout(releaseSimulationModalShell, 0);
      });
    }
  }

  const observer = new MutationObserver(polishSimulationModal);
  observer.observe(modalRoot, { childList: true, subtree: true });
  polishSimulationModal();
})();
