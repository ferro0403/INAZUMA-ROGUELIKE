(function (global) {
  "use strict";

  const baseFactory = global.RoadToGlorySquadView;
  if (!baseFactory?.create) return;

  global.RoadToGlorySquadView = Object.freeze({
    create(deps = {}) {
      const base = baseFactory.create(deps);
      let pickerOverallAscending = false;
      let pickerOrderListenerBound = false;

      function overallOfEntry(entry) {
        const value = Number(entry?.player?.overall ?? entry?.player?.finalOverall);
        return Number.isFinite(value) ? value : -Infinity;
      }

      function orderedEntries(entries = []) {
        const copy = Array.from(entries);
        copy.sort((a, b) => {
          const delta = overallOfEntry(a) - overallOfEntry(b);
          if (delta) return pickerOverallAscending ? delta : -delta;
          const nameA = String(a?.player?.name || a?.playerId || "");
          const nameB = String(b?.player?.name || b?.playerId || "");
          return nameA.localeCompare(nameB, "it");
        });
        return copy;
      }

      function reorderVisibleCards(root) {
        const grid = root?.querySelector?.("[data-rtg-picker-results] .rtg-picker-grid");
        if (!grid) return;
        const cards = Array.from(grid.children);
        cards.sort((a, b) => {
          const readOverall = (node) => {
            const value = Number(String(node.querySelector?.(".player-overall")?.textContent || "").replace(/[^0-9.-]/g, ""));
            return Number.isFinite(value) ? value : -Infinity;
          };
          const delta = readOverall(a) - readOverall(b);
          if (delta) return pickerOverallAscending ? delta : -delta;
          return String(a.textContent || "").localeCompare(String(b.textContent || ""), "it");
        });
        cards.forEach((card) => grid.appendChild(card));
      }

      function syncOrderButton(root) {
        const button = root?.querySelector?.("[data-rtg-picker-overall-order]");
        if (!button) return;
        button.textContent = pickerOverallAscending ? "OVR ↑" : "OVR ↓";
        button.setAttribute("aria-label", pickerOverallAscending ? "Overall: più scarsi in cima" : "Overall: più forti in cima");
        button.setAttribute("aria-pressed", pickerOverallAscending ? "true" : "false");
      }

      function bindPickerOrderToggle() {
        if (pickerOrderListenerBound || !global.document) return;
        pickerOrderListenerBound = true;
        global.document.addEventListener("click", (event) => {
          const button = event.target?.closest?.("[data-rtg-picker-overall-order]");
          if (!button) return;
          const picker = button.closest?.(".rtg-squad-picker");
          if (!picker) return;
          event.preventDefault();
          pickerOverallAscending = !pickerOverallAscending;
          syncOrderButton(picker);
          reorderVisibleCards(picker);
        });
      }

      function replacementPickerMarkup(options = {}) {
        pickerOverallAscending = false;
        bindPickerOrderToggle();
        const html = base.replacementPickerMarkup(options);
        const orderButton = '<button type="button" class="rtg-picker-overall-order" data-rtg-picker-overall-order aria-pressed="false" aria-label="Overall: più forti in cima">OVR ↓</button>';
        return html.replace('<div class="rtg-picker-role-badge">', `${orderButton}<div class="rtg-picker-role-badge">`);
      }

      function replacementPickerResultsMarkup(options = {}) {
        return base.replacementPickerResultsMarkup({
          ...options,
          entries: orderedEntries(options.entries || []),
        });
      }

      return Object.freeze({
        ...base,
        replacementPickerMarkup,
        replacementPickerResultsMarkup,
      });
    },
  });
})(globalThis);
