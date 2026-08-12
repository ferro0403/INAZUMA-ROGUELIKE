(function () {
  "use strict";

  const root = document.getElementById("modal-root");
  if (!root) return;

  function enhancePlayerDetail(scope = root) {
    const modals = [];
    if (scope instanceof Element && scope.matches?.(".player-detail-modal")) modals.push(scope);
    scope.querySelectorAll?.(".player-detail-modal").forEach((modal) => modals.push(modal));

    modals.forEach((modal) => {
      modal.classList.add("player-detail-revolution");
      modal.querySelectorAll(".detail-stat").forEach((card) => {
        const value = Number(card.querySelector(".detail-stat-value")?.textContent || 0);
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(99, value)) : 0;
        card.style.setProperty("--detail-stat-progress", `${(normalized / 99) * 100}%`);
      });
    });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) enhancePlayerDetail(node);
    }));
  });

  observer.observe(root, { childList: true, subtree: true });
  enhancePlayerDetail(root);
})();
