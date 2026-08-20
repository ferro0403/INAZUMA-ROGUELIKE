(function () {
  "use strict";

  const LABELS_BY_ID = {
    scout_token: "Rigenera Pull",
    pull_reroll: "Rigenera Pull",
    lucky_charm: "Migliora Pull",
    lucky_pull: "Migliora Pull",
  };

  const LABELS_BY_NAME = {
    "Visore scout": "Rigenera Pull",
    "Talismano portafortuna": "Migliora Pull",
  };

  function replacementForCard(card) {
    if (!card) return "";
    const itemId = String(card.dataset?.itemId || "").trim();
    if (LABELS_BY_ID[itemId]) return LABELS_BY_ID[itemId];

    const itemName = String(card.querySelector(".item-card-main strong")?.textContent || "").trim();
    return LABELS_BY_NAME[itemName] || "";
  }

  function applyPullItemLabels(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll(".inventory-item-card .inventory-unavailable").forEach((label) => {
      const card = label.closest(".inventory-item-card");
      const replacement = replacementForCard(card);
      if (replacement && label.textContent.trim() !== replacement) {
        label.textContent = replacement;
      }
    });
  }

  function scheduleApply(root) {
    if (typeof queueMicrotask === "function") queueMicrotask(() => applyPullItemLabels(root));
    else setTimeout(() => applyPullItemLabels(root), 0);
  }

  applyPullItemLabels(document);

  const app = document.getElementById("app");
  if (app && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => scheduleApply(app)).observe(app, {
      childList: true,
      subtree: true,
    });
  }

  document.addEventListener("click", () => scheduleApply(document), true);
})();
