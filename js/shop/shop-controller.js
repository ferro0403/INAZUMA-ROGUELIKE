(function (global) {
  "use strict";

  function create({ app, view, devMode, renderHome, toast }) {
    async function render(section = "general") {
      await Promise.all(global.SeasonRegistry.list().map((season) => global.SeasonRegistry.loadDatabase(season.id)));
      const state = global.DevelopmentAccountV3.read();
      const catalog = global.ShopCatalog.build();
      app.innerHTML = view.markup({ section, state, catalog, devMode });

      document.querySelector(".shop-back").onclick = () => renderHome();
      document.querySelectorAll("[data-shop-tab]").forEach((button) => {
        button.onclick = () => render(button.dataset.shopTab);
      });
      document.querySelectorAll("[data-buy-project]").forEach((button) => {
        button.onclick = () => {
          const result = global.DevelopmentAccountV3.purchaseProject(button.dataset.buyProject);
          toast(result.ok ? "PROGETTO ACQUISTATO" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : "ACQUISTO NON SALVATO");
          render(section);
        };
      });
      document.querySelectorAll("[data-buy-emblem]").forEach((button) => {
        button.onclick = () => {
          const product = catalog.find((item) => item.emblemId === button.dataset.buyEmblem);
          const result = global.DevelopmentAccountV3.purchaseEmblem(product);
          toast(result.ok ? "STEMMA SBLOCCATO" : result.reason === "cups" ? "COPPE SEASON INSUFFICIENTI" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : "STEMMA GIÀ POSSEDUTO");
          render(section);
        };
      });
      if (devMode) bindDev(section, catalog);
    }

    function bindDev(section, catalog) {
      const mutate = (callback) => {
        global.DevelopmentAccountV3.mutate(callback);
        render(section);
      };
      document.querySelectorAll("[data-shop-coins]").forEach((button) => button.onclick = () => mutate((state) => { state.coins += Number(button.dataset.shopCoins); }));
      document.querySelectorAll("[data-shop-cups]").forEach((button) => button.onclick = () => mutate((state) => { state.cupsBySeason[button.dataset.shopCups] += Number(button.dataset.amount); }));
      document.querySelectorAll("[data-shop-project]").forEach((button) => button.onclick = () => mutate((state) => { state.projects[button.dataset.shopProject] += 1; }));
      document.querySelector("[data-shop-prepare]")?.addEventListener("click", () => mutate((state) => {
        state.coins = Math.max(state.coins, 10000);
        global.DevelopmentV2.SEASON_IDS.forEach((id) => { state.cupsBySeason[id] = Math.max(state.cupsBySeason[id], 5); });
      }));
      document.querySelector("[data-shop-unlock]")?.addEventListener("click", () => mutate((state) => { state.unlockedEmblems = [...new Set([...state.unlockedEmblems, ...catalog.map((item) => item.emblemId)])]; }));
      document.querySelector("[data-shop-remove]")?.addEventListener("click", () => mutate((state) => { state.unlockedEmblems = []; }));
      document.querySelector("[data-shop-reset]")?.addEventListener("click", () => mutate((state) => {
        state.coins = 0;
        global.DevelopmentV2.SEASON_IDS.forEach((id) => { state.cupsBySeason[id] = 0; });
        state.unlockedEmblems = [];
      }));
    }

    return Object.freeze({ render });
  }

  global.ShopController = Object.freeze({ create });
})(globalThis);
