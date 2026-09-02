(function (global) {
  "use strict";

  function create({ app, view, normalizeTeamIdentity, savedTeamIdentity, openEditTeamNameModal, renderHome, renderShop, toast }) {
    function render(options = {}) {
      const selectingEmblem = options?.view === "emblems";
      const savedIdentity = savedTeamIdentity();
      const identity = savedIdentity || normalizeTeamIdentity({});
      const owned = new Set(global.DevelopmentAccountV3.read().unlockedEmblems || []);
      const catalog = global.ShopCatalog.build().filter((item) => owned.has(item.emblemId));
      const choices = [{ emblemId: "default-lightning", name: "Inazuma Lightning", seasonId: "default" }, ...catalog];
      const current = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: identity, fallbackKind: "user" });
      const smartAutoLineup = global.RunState.loadProfile().preferences.smartAutoLineup;
      app.innerHTML = view.markup({ selectingEmblem, identity, savedIdentity, choices, current, smartAutoLineup });

      document.querySelector(".settings-back").onclick = () => selectingEmblem ? render({ view: "main" }) : renderHome();
      document.getElementById("settings-edit-name")?.addEventListener("click", () => openEditTeamNameModal());
      document.getElementById("settings-change-emblem")?.addEventListener("click", () => render({ view: "emblems" }));
      document.getElementById("settings-open-shop")?.addEventListener("click", () => renderShop("general"));
      document.getElementById("settings-smart-lineup")?.addEventListener("change", (event) => {
        global.RunState.saveProfilePreferences({ smartAutoLineup: event.currentTarget.checked });
        toast(event.currentTarget.checked ? "AUTO-FORMAZIONE ATTIVATA" : "AUTO-FORMAZIONE DISATTIVATA");
      });
      document.querySelectorAll("[data-settings-emblem]").forEach((button) => button.onclick = () => {
        const saved = savedTeamIdentity();
        if (!saved) {
          toast("IMPOSTA PRIMA IL NOME SQUADRA");
          return;
        }
        global.RunState.saveProfileTeamIdentity({ ...saved, emblemId: button.dataset.settingsEmblem });
        toast("STEMMA SALVATO");
        render({ view: "emblems" });
      });
    }

    return Object.freeze({ render });
  }

  global.SettingsController = Object.freeze({ create });
})(globalThis);
