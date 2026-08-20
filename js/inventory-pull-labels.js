(function () {
  "use strict";

  const LABELS = {
    scout_token: "Rigenera Pull",
    lucky_charm: "Migliora Pull",
  };

  function applyPullItemLabels(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll(".inventory-item-card[data-item-id] .inventory-unavailable").forEach((label) => {
      const card = label.closest(".inventory-item-card[data-item-id]");
      const text = LABELS[card?.dataset?.itemId];
      if (text && label.textContent !== text) label.textContent = text;
    });
  }

  applyPullItemLabels();

  const app = document.getElementById("app");
  if (app && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => applyPullItemLabels(app)).observe(app, {
      childList: true,
      subtree: true,
    });
  }
})();
