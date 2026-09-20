(function (global) {
  "use strict";

  const baseFactory = global.RoadToGlorySquadView;
  if (!baseFactory?.create) return;

  global.RoadToGlorySquadView = Object.freeze({
    create(deps = {}) {
      const base = baseFactory.create(deps);
      let pickerOverallAscending = !!global.__rtgPickerOverallAscending;
      let pickerOrderListenerBound = false;

      function overallOfEntry(entry) {
        const value = Number(entry?.player?.overall ?? entry?.player?.finalOverall);
        return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
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

      function decorateOverallAttributes(html, entries = []) {
        let output = String(html || "");
        for (const entry of entries) {
          const playerId = String(entry?.playerId || entry?.player?.playerId || entry?.player?.id || "");
          if (!playerId) continue;
          const overall = overallOfEntry(entry);
          if (!Number.isFinite(overall)) continue;
          const escapedId = playerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp(`(data-rtg-picker-player=["']${escapedId}["'])`);
          output = output.replace(pattern, `$1 data-rtg-picker-overall="${overall}"`);
        }
        return output;
      }

      function bindPickerOrderToggle() {
        if (pickerOrderListenerBound || !global.document) return;
        pickerOrderListenerBound = true;
        global.document.addEventListener("click", (event) => {
          const button = event.target?.closest?.("[data-rtg-picker-overall-order]");
          if (!button || !button.closest?.(".rtg-squad-picker")) return;
          event.preventDefault();
          event.stopImmediatePropagation?.();
          const nextAscending = !pickerOverallAscending;
          global.document.dispatchEvent(new CustomEvent("rtg-picker-overall-order", { detail: { ascending: nextAscending } }));
        }, true);
      }

      function replacementPickerMarkup(options = {}) {
        pickerOverallAscending = !!global.__rtgPickerOverallAscending;
        bindPickerOrderToggle();
        const ordered = orderedEntries(options.entries || []);
        let html = base.replacementPickerMarkup({ ...options, entries: ordered });
        html = decorateOverallAttributes(html, ordered);
        const orderButton = pickerOverallAscending
          ? '<button type="button" class="rtg-picker-overall-order" data-rtg-picker-overall-order aria-pressed="true" aria-label="Overall: più scarsi in cima">OVR ↑</button>'
          : '<button type="button" class="rtg-picker-overall-order" data-rtg-picker-overall-order aria-pressed="false" aria-label="Overall: più forti in cima">OVR ↓</button>';
        return html.replace('<div class="rtg-picker-role-badge">', `${orderButton}<div class="rtg-picker-role-badge">`);
      }

      function replacementPickerResultsMarkup(options = {}) {
        pickerOverallAscending = !!global.__rtgPickerOverallAscending;
        const entries = orderedEntries(options.entries || []);
        const html = base.replacementPickerResultsMarkup({ ...options, entries });
        return decorateOverallAttributes(html, entries);
      }

      return Object.freeze({ ...base, replacementPickerMarkup, replacementPickerResultsMarkup });
    },
  });
})(globalThis);
