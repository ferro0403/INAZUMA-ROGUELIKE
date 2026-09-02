(function (global) {
  "use strict";

  const TABS = [["general", "GENERALE"], ["ie1", "IE1"], ["ie1_s2", "IE2"], ["ie1_s3", "IE3"], ["ie2", "ARES"], ["orion", "ORION"]];
  const CUP_LABELS = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" };
  const CUP_NAMES = { ie1: "Sun Pendant", ie1_s2: "Alius Crystal", ie1_s3: "Meteor Necklace", ie2: "Challenger's Necklace", orion: "Comet Pendant" };
  const TIER_ORDER = { base: 0, rare: 1, epic: 2, iconic: 3 };

  function create({ escapeHtml, currencyIcon }) {
    function cupIcon(id, className = "shop-cup-icon") {
      const asset = global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cupsBySeason[id];
      return `<img class="${className}" src="${escapeHtml(asset)}" alt="${escapeHtml(CUP_NAMES[id])}" title="${escapeHtml(CUP_NAMES[id])}" data-cup-season="${escapeHtml(id)}">`;
    }

    function walletMarkup(state) {
      return global.DevelopmentV2.SEASON_IDS.map((id) => `<span>${cupIcon(id)}<small>${CUP_LABELS[id]}</small><b>${escapeHtml(state.cupsBySeason[id] || 0)}</b></span>`).join("");
    }

    function emblemCard(product, state) {
      const owned = state.unlockedEmblems.includes(product.emblemId);
      const emblem = global.TeamEmblems.resolveTeamById(product.teamId, product.seasonId);
      return `<article class="shop-product shop-emblem-card shop-tier--${product.rarity}">${global.TeamEmblems.teamEmblemMarkup(emblem, { escape: escapeHtml, className: "shop-emblem" })}<h3>${escapeHtml(product.name)}</h3><span class="shop-tier">${product.label}</span><strong class="shop-price"><span>${product.coins} MONETE</span>${product.cups ? `<span class="shop-price-extra">+ ${cupIcon(product.seasonId, "shop-price-cup")} <span aria-label="${product.cups} Coppe">×${product.cups}</span></span>` : ""}</strong><button class="btn ${owned ? "shop-owned" : "btn-yellow"}" data-buy-emblem="${escapeHtml(product.emblemId)}" ${owned ? "disabled" : ""}>${owned ? "POSSEDUTO" : "ACQUISTA"}</button></article>`;
    }

    function productMarkup(section, state, catalog) {
      if (section === "general") {
        return global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<article class="shop-product shop-project shop-project--${rarity.toLowerCase()}"><img src="${escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt=""><h3>PROGETTO ${escapeHtml(rarity.toUpperCase())}</h3><p>Posseduti <b>×${escapeHtml(state.projects[rarity] || 0)}</b></p><strong>${escapeHtml(global.DevelopmentV2.PROJECT_PRICES[rarity])} MONETE</strong><button class="btn btn-yellow" data-buy-project="${escapeHtml(rarity)}" ${state.coins < global.DevelopmentV2.PROJECT_PRICES[rarity] ? "disabled" : ""}>ACQUISTA</button></article>`).join("");
      }
      const sorted = catalog.filter((product) => product.shopSection === section).sort((a, b) => TIER_ORDER[a.rarity] - TIER_ORDER[b.rarity] || a.name.localeCompare(b.name, "it"));
      return Object.keys(TIER_ORDER).map((tier) => {
        const items = sorted.filter((product) => product.rarity === tier);
        return items.length ? `<section class="shop-tier-group shop-tier-group--${tier}"><h2><span>${items[0].label}</span></h2><div class="shop-grid">${items.map((product) => emblemCard(product, state)).join("")}</div></section>` : "";
      }).join("");
    }

    function devMarkup() {
      return `<section class="shop-dev"><h2>NEGOZIO — HACK TEST</h2><button data-shop-prepare>PREPARA TEST NEGOZIO</button><div class="shop-dev-grid">${[1000, 5000].map((amount) => `<button data-shop-coins="${amount}">+${amount} MONETE</button>`).join("")}${global.DevelopmentV2.SEASON_IDS.flatMap((id) => [1, 5].map((amount) => `<button data-shop-cups="${id}" data-amount="${amount}">+${amount} COPPA ${CUP_LABELS[id]}</button>`)).join("")}${global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<button data-shop-project="${rarity}">+1 PROGETTO ${rarity.toUpperCase()}</button>`).join("")}</div><div class="shop-dev-danger"><button data-shop-unlock>SBLOCCA TUTTI GLI STEMMI</button><button data-shop-remove>RIMUOVI TUTTI GLI STEMMI ACQUISTATI</button><button data-shop-reset>RESET RISORSE SHOP</button></div></section>`;
    }

    function markup({ section, state, catalog, devMode }) {
      const products = productMarkup(section, state, catalog);
      return `<main class="shop-screen"><header class="shop-header"><button class="shop-back" aria-label="Torna alla Home">←</button><div><p class="eyebrow">RICOMPENSE PERMANENTI</p><h1>NEGOZIO</h1></div></header><section class="shop-wallet"><div class="shop-coins">${currencyIcon("coins")}<span><small>MONETE</small><b>${state.coins}</b></span></div><div class="shop-cups">${walletMarkup(state)}${state.legacyCups ? `<span><small>LEGACY</small><b>${state.legacyCups}</b></span>` : ""}</div></section><nav class="shop-tabs" aria-label="Seleziona Season">${TABS.map(([id, label]) => `<button class="${id === section ? "active" : ""}" data-shop-tab="${id}" aria-current="${id === section ? "page" : "false"}">${label}</button>`).join("")}</nav>${section === "general" ? `<section class="shop-grid">${products}</section>` : `<div class="shop-catalog">${products}</div>`}${devMode ? devMarkup() : ""}</main>`;
    }

    return Object.freeze({ markup });
  }

  global.ShopView = Object.freeze({ create });
})(globalThis);
