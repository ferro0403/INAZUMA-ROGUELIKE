(function (global) {
  "use strict";

  function create({ app, view, devMode, renderHome, toast }) {
    const callAccount = (asyncName, syncName, ...args) => {
      const account = global.DevelopmentAccountV3;
      const operation = typeof account?.[asyncName] === "function" ? account[asyncName] : account?.[syncName];
      if (typeof operation !== "function") return Promise.reject(Object.assign(new Error(`Development operation unavailable: ${syncName}`), { code: "development-operation-unavailable" }));
      try { return Promise.resolve(operation.apply(account, args)); }
      catch (error) { return Promise.reject(error); }
    };

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
        button.onclick = async () => {
          if (button.disabled) return;
          button.disabled = true;
          let result;
          try { result = await callAccount("purchaseProjectAsync", "purchaseProject", button.dataset.buyProject); }
          catch (error) { result = { ok: false, reason: "persistence", error }; }
          toast(result.ok ? "PROGETTO ACQUISTATO" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : "ACQUISTO NON SALVATO");
          await render(section);
        };
      });
      document.querySelectorAll("[data-buy-emblem]").forEach((button) => {
        button.onclick = async () => {
          if (button.disabled) return;
          button.disabled = true;
          const product = catalog.find((item) => item.emblemId === button.dataset.buyEmblem);
          let result;
          try { result = await callAccount("purchaseEmblemAsync", "purchaseEmblem", product); }
          catch (error) { result = { ok: false, reason: "persistence", error }; }
          toast(result.ok ? "STEMMA SBLOCCATO" : result.reason === "cups" ? "COPPE SEASON INSUFFICIENTI" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : result.reason === "owned" ? "STEMMA GIÀ POSSEDUTO" : "ACQUISTO NON SALVATO");
          await render(section);
        };
      });
      if (devMode) bindDev(section, catalog);
    }

    function bindDev(section, catalog) {
      const mutate = async (callback) => {
        try {
          await callAccount("mutateAsync", "mutate", callback);
          await render(section);
        } catch (error) {
          console.error("Development dev mutation failed", error);
          toast("MODIFICA DEV NON SALVATA");
        }
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
