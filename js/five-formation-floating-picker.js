(function (global) {
  "use strict";

  let internalSlotClick = false;

  function currentScreen() {
    return document.querySelector(".five-screen");
  }

  function currentPicker(screen = currentScreen()) {
    return screen?.querySelector(".five-selector.five-selector-floating") || null;
  }

  function preparePicker(picker, options = {}) {
    if (!picker) return null;
    picker.dataset.floatingPickerReady = "1";
    picker.classList.add("five-selector-floating", "is-open");
    picker.setAttribute("aria-hidden", "false");
    picker.closest(".five-screen, .five-match-screen")?.classList.add("five-player-picker-open");
    picker.querySelector(".role-filter-bar")?.setAttribute("hidden", "");
    picker.querySelector("#clear-five-slot")?.setAttribute("hidden", "");
    const rosterList = picker.querySelector(".five-roster-list");
    if (rosterList) rosterList.scrollTop = 0;
    if (!picker.querySelector(".five-floating-picker-close")) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "five-floating-picker-close";
      close.setAttribute("aria-label", "Chiudi selezione giocatore");
      close.textContent = "×";
      close.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePreparedPicker(picker);
      });
      picker.prepend(close);
    }
    if (options.onClose) picker.fivePickerOnClose = options.onClose;
    return picker;
  }

  function closePreparedPicker(picker) {
    if (!picker) return;
    picker.classList.remove("is-open");
    picker.setAttribute("aria-hidden", "true");
    picker.closest(".five-screen, .five-match-screen")?.classList.remove("five-player-picker-open");
    picker.fivePickerOnClose?.();
  }

  function setPickerOpen(screen, open) {
    const picker = currentPicker(screen);
    if (!screen || !picker) return;
    picker.classList.toggle("is-open", open);
    picker.setAttribute("aria-hidden", open ? "false" : "true");
    screen.classList.toggle("five-player-picker-open", open);
    if (open) {
      const rosterList = picker.querySelector(".five-roster-list");
      if (rosterList) rosterList.scrollTop = 0;
    }
  }

  function clearVisualSelection(screen) {
    const selected = screen?.querySelector("[data-five-slot].selected");
    if (!selected) return;
    internalSlotClick = true;
    try {
      selected.click();
    } finally {
      internalSlotClick = false;
    }
  }

  function closePicker(options = {}) {
    const screen = currentScreen();
    if (!screen) return;
    setPickerOpen(screen, false);
    if (options.clearSelection) clearVisualSelection(screen);
  }

  function ensureSlotSelected(slotButton) {
    if (!slotButton || slotButton.classList.contains("selected")) return;
    internalSlotClick = true;
    try {
      slotButton.click();
    } finally {
      internalSlotClick = false;
    }
  }

  function openPickerForSlot(slotButton) {
    const screen = currentScreen();
    if (!screen || !slotButton || !screen.contains(slotButton)) return;
    ensureFloatingPicker(screen);

    /* renderFiveVFive toggles an already-selected card off. For a contextual picker,
       tapping a card should always mean "edit this slot", so select it again when needed. */
    ensureSlotSelected(slotButton);

    const picker = currentPicker(screen);
    if (!picker) return;
    picker.querySelector(".role-filter-bar")?.setAttribute("hidden", "");
    picker.querySelector("#clear-five-slot")?.setAttribute("hidden", "");
    setPickerOpen(screen, true);
  }

  function ensureFloatingPicker(screen = currentScreen()) {
    if (!screen) return;
    screen.classList.add("five-floating-picker-enabled");

    const picker = screen.querySelector(".five-selector");
    if (!picker || picker.dataset.floatingPickerReady === "1") return;

    const fieldPanel = screen.querySelector(".five-field-panel");
    if (!fieldPanel) return;

    preparePicker(picker, { onClose: () => clearVisualSelection(screen) });
    picker.classList.remove("is-open");
    picker.setAttribute("aria-hidden", "true");
    screen.classList.remove("five-player-picker-open");

    const roleFilters = picker.querySelector(".role-filter-bar");
    if (roleFilters) roleFilters.hidden = true;
    const clearButton = picker.querySelector("#clear-five-slot");
    if (clearButton) clearButton.hidden = true;

    /* Moving the existing selector preserves app.js listeners and assignment logic,
       while removing the long selector block from the normal document flow. */
    fieldPanel.appendChild(picker);

    picker.addEventListener("click", (event) => {
      if (!event.target.closest("[data-five-player]")) return;
      /* app.js handles the assignment first on the same selector. Close afterwards. */
      queueMicrotask(() => closePicker({ clearSelection: false }));
    });
  }

  document.addEventListener("click", (event) => {
    if (internalSlotClick) return;
    const slotButton = event.target.closest(".five-screen [data-five-slot]");
    if (!slotButton) return;

    /* Let app.js update ui.fiveVFiveSelectedSlot and compatible roster first. */
    queueMicrotask(() => {
      if (!document.body.contains(slotButton)) return;
      openPickerForSlot(slotButton);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const matchPicker = document.querySelector(".five-match-screen .five-selector.five-selector-floating.is-open");
    if (matchPicker) {
      closePreparedPicker(matchPicker);
      return;
    }
    const picker = currentPicker();
    if (!picker?.classList.contains("is-open")) return;
    closePicker({ clearSelection: true });
  });

  const observer = new MutationObserver(() => ensureFloatingPicker());
  const app = document.getElementById("app");
  if (app) observer.observe(app, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ensureFloatingPicker(), { once: true });
  } else {
    ensureFloatingPicker();
  }

  global.FiveFormationFloatingPicker = Object.freeze({
    prepare: preparePicker,
    close: closePreparedPicker,
  });
})(globalThis);
