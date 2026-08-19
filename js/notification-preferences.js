(function (global) {
  "use strict";

  const STORAGE_KEY = "inazuma_roguelike_notifications_enabled";
  const AUTO_LINEUP_UPDATE_PATTERN = /AUTO[- ]FORMAZIONE\s*[—-]\s*aggiornata/i;

  function readEnabled() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      return raw === null ? true : raw !== "false";
    } catch (_) {
      return true;
    }
  }

  function writeEnabled(enabled) {
    const value = enabled === true;
    try {
      global.localStorage?.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch (_) {}
    return value;
  }

  function isAutoLineupUpdateNotification(node) {
    const text = String(node?.textContent || "").trim();
    return AUTO_LINEUP_UPDATE_PATTERN.test(text);
  }

  function shouldSuppressToast(node) {
    if (!node || node.nodeType !== 1) return false;
    if (isAutoLineupUpdateNotification(node)) return true;
    return !readEnabled();
  }

  function removeSuppressedToasts(root) {
    if (!root) return;
    Array.from(root.children || []).forEach((node) => {
      if (shouldSuppressToast(node)) node.remove();
    });
  }

  function notificationToggleMarkup() {
    const checked = readEnabled() ? "checked" : "";
    return `<label class="settings-toggle-row" for="settings-game-notifications" data-notification-preferences-toggle>
      <span><strong>NOTIFICHE DI GIOCO</strong><small>Mostra i messaggi di conferma e aggiornamento durante il gioco.</small></span>
      <input type="checkbox" id="settings-game-notifications" ${checked} aria-describedby="settings-game-notifications-description">
      <span class="settings-toggle" aria-hidden="true"></span>
    </label><span id="settings-game-notifications-description" class="sr-only">Preferenza persistente, attivata per impostazione predefinita.</span>`;
  }

  function ensureSettingsToggle() {
    const panel = global.document?.querySelector?.(".settings-preferences-panel");
    if (!panel || panel.querySelector("[data-notification-preferences-toggle]")) return;
    panel.insertAdjacentHTML("beforeend", notificationToggleMarkup());
    panel.querySelector("#settings-game-notifications")?.addEventListener("change", (event) => {
      writeEnabled(event.currentTarget.checked);
      if (!event.currentTarget.checked) {
        removeSuppressedToasts(global.document.getElementById("toast-root"));
      }
    });
  }

  function installToastFilter() {
    const root = global.document?.getElementById?.("toast-root");
    if (!root || typeof global.MutationObserver !== "function") return;
    removeSuppressedToasts(root);
    new global.MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (shouldSuppressToast(node)) node.remove();
        });
      });
    }).observe(root, { childList: true });
  }

  function installSettingsObserver() {
    const app = global.document?.getElementById?.("app");
    if (!app || typeof global.MutationObserver !== "function") return;
    ensureSettingsToggle();
    new global.MutationObserver(() => ensureSettingsToggle()).observe(app, { childList: true, subtree: true });
  }

  global.NotificationPreferences = Object.freeze({
    storageKey: STORAGE_KEY,
    isEnabled: readEnabled,
    setEnabled: writeEnabled,
  });

  installToastFilter();
  installSettingsObserver();
})(globalThis);
