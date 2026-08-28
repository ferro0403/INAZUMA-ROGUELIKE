(function (global) {
  "use strict";

  const OVERLAY_ID = "shop-buy-overlay";
  const TIER_LABELS = { base: "BASE", rare: "RARO", epic: "EPICO", iconic: "ICONICO" };
  const TIER_ACCENTS = { base: "#4a4b4f", rare: "#3487bd", epic: "#8b48bd", iconic: "#a87714" };
  const CUP_NAMES = { ie1: "Sun Pendant", ie1_s2: "Alius Crystal", ie1_s3: "Meteor Necklace", ie2: "Challenger's Necklace", orion: "Comet Pendant" };
  const CUP_LABELS = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" };
  const CUP_LAYOUT_STYLE_ID = "shop-cup-layout-final-fix";

  if (typeof document !== "undefined" && !document.getElementById(CUP_LAYOUT_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = CUP_LAYOUT_STYLE_ID;
    style.textContent = "@media(max-width:620px){main.shop-screen .shop-cups span:nth-child(4){grid-column:1/4}main.shop-screen .shop-cups span:nth-child(5){grid-column:4/7}}";
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[char]);
  }

  function currentShopSection() {
    return document.querySelector(".shop-screen [data-shop-tab].active")?.dataset.shopTab || "general";
  }

  function rerenderShop() {
    const active = document.querySelector(`.shop-screen [data-shop-tab="${CSS.escape(currentShopSection())}"]`);
    if (active) active.click();
  }

  function closePurchaseModal() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function coinIconMarkup(className = "") {
    const src = global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.coins;
    return src ? `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="Monete">` : "";
  }

  function cupIconMarkup(seasonId) {
    const src = global.DevelopmentV2?.DEVELOPMENT_RESOURCE_ASSETS?.cupsBySeason?.[seasonId];
    return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(CUP_NAMES[seasonId] || "Coppa Season")}">` : "";
  }

  function projectDescriptor(button) {
    const rarity = String(button.dataset.buyProject || "");
    if (!rarity) return null;
    const price = Number(global.DevelopmentV2?.PROJECT_PRICES?.[rarity] || 0);
    return {
      type: "project",
      rarity,
      title: `Progetto ${rarity}`,
      subtitle: "PROGETTO PERMANENTE",
      image: global.DevelopmentV2?.ASSETS?.[rarity] || "",
      coins: price,
      cups: 0,
      seasonId: null,
      accent: ({ Buono: "#5a7a69", Forte: "#3487bd", Elite: "#8b48bd", Mondiale: "#a87714", Leggenda: "#c39a1c" })[rarity] || "#4a4b4f",
      execute() { return global.DevelopmentAccountV3.purchaseProject(rarity); },
    };
  }

  function emblemDescriptor(button) {
    const emblemId = String(button.dataset.buyEmblem || "");
    const product = global.ShopCatalog?.build?.().find((item) => item.emblemId === emblemId);
    if (!product) return null;
    const resolved = global.TeamEmblems?.resolveTeamById?.(product.teamId, product.seasonId);
    return {
      type: "emblem",
      product,
      title: product.name,
      subtitle: `STEMMA • ${TIER_LABELS[product.rarity] || String(product.label || "").toUpperCase()}`,
      image: resolved?.src || "",
      fallback: resolved?.fallbackSrc || "",
      coins: Number(product.coins || 0),
      cups: Number(product.cups || 0),
      seasonId: product.seasonId,
      accent: TIER_ACCENTS[product.rarity] || "#4a4b4f",
      execute() { return global.DevelopmentAccountV3.purchaseEmblem(product); },
    };
  }

  function purchaseError(result) {
    if (result?.reason === "coins") return "MONETE INSUFFICIENTI";
    if (result?.reason === "cups") return "COPPE DELLA SEASON INSUFFICIENTI";
    if (result?.reason === "owned") return "STEMMA GIÀ POSSEDUTO";
    if (result?.reason === "persistence") return "ACQUISTO NON SALVATO. RIPROVA.";
    return "IMPOSSIBILE COMPLETARE L'ACQUISTO";
  }

  function openPurchaseModal(descriptor) {
    if (!descriptor) return;
    closePurchaseModal();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "shop-buy-overlay";
    overlay.setAttribute("role", "presentation");

    const costMarkup = `${coinIconMarkup()}<span>${escapeHtml(descriptor.coins)}</span>${descriptor.cups ? `<b>+</b>${cupIconMarkup(descriptor.seasonId)}<span>×${escapeHtml(descriptor.cups)}</span><small>${escapeHtml(CUP_LABELS[descriptor.seasonId] || "")}</small>` : ""}`;
    const fallbackAttr = descriptor.fallback ? ` data-fallback="${escapeHtml(descriptor.fallback)}"` : "";
    const imageMarkup = descriptor.image ? `<img class="shop-buy-modal__image" src="${escapeHtml(descriptor.image)}" alt=""${fallbackAttr}>` : "";

    overlay.innerHTML = `<section class="shop-buy-modal" role="dialog" aria-modal="true" aria-labelledby="shop-buy-title" style="--modal-accent:${escapeHtml(descriptor.accent)}">
      <div class="shop-buy-modal__head">CONFERMA ACQUISTO</div>
      <div class="shop-buy-modal__body">
        ${imageMarkup}
        <h2 id="shop-buy-title">${escapeHtml(descriptor.title)}</h2>
        <p class="shop-buy-modal__kind">${escapeHtml(descriptor.subtitle)}</p>
        <p class="shop-buy-modal__cost-label">COSTO</p>
        <div class="shop-buy-modal__cost">${costMarkup}</div>
        <p class="shop-buy-modal__status" aria-live="polite"></p>
      </div>
      <div class="shop-buy-modal__actions">
        <button type="button" class="shop-buy-modal__cancel">ANNULLA</button>
        <button type="button" class="shop-buy-modal__confirm">ACQUISTA</button>
      </div>
    </section>`;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector(".shop-buy-modal");
    const cancel = overlay.querySelector(".shop-buy-modal__cancel");
    const confirm = overlay.querySelector(".shop-buy-modal__confirm");
    const status = overlay.querySelector(".shop-buy-modal__status");
    const image = overlay.querySelector(".shop-buy-modal__image");

    if (image) image.addEventListener("error", () => {
      const fallback = image.dataset.fallback;
      if (fallback && image.src !== fallback) image.src = fallback;
      else image.style.visibility = "hidden";
    }, { once: true });

    cancel.addEventListener("click", closePurchaseModal);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closePurchaseModal(); });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      cancel.disabled = true;
      const result = descriptor.execute();
      if (!result?.ok) {
        status.textContent = purchaseError(result);
        confirm.disabled = false;
        cancel.disabled = false;
        return;
      }
      modal.classList.add("is-success");
      status.textContent = descriptor.type === "emblem" ? "✓ STEMMA SBLOCCATO" : "✓ PROGETTO ACQUISTATO";
      confirm.textContent = "FATTO";
      setTimeout(() => {
        closePurchaseModal();
        rerenderShop();
      }, 520);
    });

    setTimeout(() => confirm.focus(), 0);
  }

  function interceptPurchase(event) {
    const button = event.target.closest?.(".shop-screen [data-buy-project], .shop-screen [data-buy-emblem]");
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const descriptor = button.dataset.buyProject ? projectDescriptor(button) : emblemDescriptor(button);
    openPurchaseModal(descriptor);
  }

  document.addEventListener("click", interceptPurchase, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById(OVERLAY_ID)) closePurchaseModal();
  });
})(globalThis);
