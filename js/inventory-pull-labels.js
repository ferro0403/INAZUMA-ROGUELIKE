(function () {
  "use strict";

  const TEXT_REPLACEMENTS = new Map([
    ["Utilizzabile durante un Pull", "Rigenera Pull"],
    ["Utilizzabile durante un Pull previsto.", "Rigenera Pull"],
    ["Utilizzabile in un Pull normale", "Migliora Pull"],
    ["Utilizzabile in un Pull normale.", "Migliora Pull"],
  ]);

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

  function replacementForLabel(label) {
    if (!label) return "";

    const currentText = String(label.textContent || "").trim();
    if (TEXT_REPLACEMENTS.has(currentText)) return TEXT_REPLACEMENTS.get(currentText);

    const card = label.closest(".inventory-item-card");
    if (!card) return "";

    const itemId = String(card.dataset?.itemId || "").trim();
    if (LABELS_BY_ID[itemId]) return LABELS_BY_ID[itemId];

    const itemName = String(card.querySelector(".item-card-main strong")?.textContent || "").trim();
    return LABELS_BY_NAME[itemName] || "";
  }

  function applyPullItemLabels(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll(".inventory-unavailable").forEach((label) => {
      const replacement = replacementForLabel(label);
      if (replacement && label.textContent.trim() !== replacement) {
        label.textContent = replacement;
      }
    });
  }

  function scheduleApply(root) {
    requestAnimationFrame(() => applyPullItemLabels(root));
  }

  applyPullItemLabels(document);

  const app = document.getElementById("app");
  if (app && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => scheduleApply(app)).observe(app, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  document.addEventListener("click", () => scheduleApply(document), true);
  window.addEventListener("pageshow", () => scheduleApply(document));
})();
