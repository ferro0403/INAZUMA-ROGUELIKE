(function () {
  "use strict";

  const DETAIL_COPY_BY_NAME = {
    "Visore scout": "Rigenera tutte e 3 le Pull.",
    "Talismano portafortuna": "Rigenera le Pull con rarità aumentata di 1.",
  };

  function applyPullDetailCopy(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll(".inventory-detail-copy").forEach((detail) => {
      const name = String(detail.querySelector("h3")?.textContent || "").trim();
      const replacement = DETAIL_COPY_BY_NAME[name];
      if (!replacement) return;

      const heading = detail.querySelector("h3");
      const description = heading?.nextElementSibling;
      if (description?.tagName === "P" && description.textContent.trim() !== replacement) {
        description.textContent = replacement;
      }
    });
  }

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;

  applyPullDetailCopy(modalRoot);

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(() => applyPullDetailCopy(modalRoot)).observe(modalRoot, {
      childList: true,
      subtree: true,
    });
  }
})();
