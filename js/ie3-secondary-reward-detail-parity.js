(function () {
  "use strict";

  const ORDER = ["Attacco", "Controllo", "Velocità", "Grinta", "Fisico", "Resistenza", "Difesa", "Parata"];
  const ICONS = {
    Attacco: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M9 12h6"/></svg>',
    Controllo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17"/></svg>',
    Velocità: '<svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/></svg>',
    Grinta: '<svg viewBox="0 0 24 24"><path d="M12 21c4-2 7-5 7-9 0-3-2-5-4-7 0 3-2 4-3 5-1-2-1-4-1-6-3 2-6 5-6 9 0 4 3 7 7 8Z"/></svg>',
    Fisico: '<svg viewBox="0 0 24 24"><path d="M7 13c1-5 4-8 8-7 2 1 3 3 2 5l3 1-2 4-4-1-2 4H7v-6Z"/><path d="M5 14h7"/></svg>',
    Resistenza: '<svg viewBox="0 0 24 24"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 7-6 10-6 12Z"/><path d="M7 12h3l1-3 2 6 1-3h3"/></svg>',
    Difesa: '<svg viewBox="0 0 24 24"><path d="M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M12 7v10"/></svg>',
    Parata: '<svg viewBox="0 0 24 24"><path d="M7 20V8a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v11H7Z"/><path d="M7 14 4 12"/></svg>',
  };

  function applyNativeParity() {
    const modal = document.querySelector("#modal-root .player-detail-modal");
    if (!modal) return;

    const stats = modal.querySelector(".detail-stats");
    if (stats) {
      const cards = [...stats.querySelectorAll(".detail-stat")];
      const byLabel = new Map(cards.map((card) => [card.querySelector(".detail-stat-label")?.textContent?.trim(), card]));
      ORDER.forEach((label) => {
        const card = byLabel.get(label);
        if (!card) return;
        if (!card.querySelector(".detail-stat-icon")) {
          const icon = document.createElement("span");
          icon.className = "detail-stat-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = ICONS[label] || ICONS.Controllo;
          card.prepend(icon);
        }
        stats.append(card);
      });
    }

    const image = modal.querySelector(".player-detail-visual img.player-fullbody");
    if (image) {
      image.classList.remove("player-fullbody--portrait");
      image.classList.add("player-fullbody--fullbody");
    }
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-ie3-secondary-detail]")) return;
    queueMicrotask(applyNativeParity);
    requestAnimationFrame(applyNativeParity);
  }, true);
})();
