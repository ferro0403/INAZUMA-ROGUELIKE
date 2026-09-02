(function (global) {
  "use strict";
  function create({ resolveItem, escapeHtml }) {
    function itemImageFallbackSvg() {
      return `<svg viewBox="0 0 32 32"><path d="M6 9h20v17H6z"/><path d="m9 23 5-6 4 4 3-3 2 5"/><circle cx="20" cy="14" r="2"/></svg>`;
    }
    
    function handleItemImageError(image) {
      if (!image || image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = "true";
      image.removeAttribute("src");
      image.setAttribute("hidden", "");
      const wrapper = image.closest(".item-icon");
      if (wrapper) wrapper.classList.add("item-icon--fallback");
    }
    
    
    function equipmentBadgeMarkup(equipment, className = "") {
      if (!equipment) return "";
      const resolvedEquipment = resolveItem(equipment);
      const label = `Oggetto equipaggiato: ${resolvedEquipment.name || "oggetto"}`;
      const classes = ["equipment-badge", "mobile-equipment-badge", className].filter(Boolean).join(" ");
      return `<span class="${classes}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${itemIcon(resolvedEquipment)}</span>`;
    }
    
    function itemIcon(itemOrId) {
      const item = resolveItem(itemOrId);
      const id = String(item?.id || "");
      const name = item?.name || "Oggetto";
      if (item?.imageUrl) {
        return `<span class="item-icon item-icon--image" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="globalThis.handleItemImageError && globalThis.handleItemImageError(this)" />${itemImageFallbackSvg()}</span>`;
      }
      const icons = {
        energy_drink: `<svg viewBox="0 0 32 32"><path d="M11 8h10l-1 18h-8L11 8Z"/><path d="M13 4h6v4h-6z"/><path d="m16 12-3 6h3l-1 6 5-8h-3l1-4z"/></svg>`,
        training_manual: `<svg viewBox="0 0 32 32"><path d="M7 6h13a5 5 0 0 1 5 5v15H11a4 4 0 0 0-4 4V6Z"/><path d="M11 11h9M11 16h7M11 21h8"/></svg>`,
        scout_token: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><path d="m16 9 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1 2-5Z"/></svg>`,
        medical_kit: `<svg viewBox="0 0 32 32"><rect x="6" y="10" width="20" height="16" rx="3"/><path d="M12 10V7h8v3M16 14v8M12 18h8"/></svg>`,
        lucky_charm: `<svg viewBox="0 0 32 32"><path d="M16 6c6 0 10 4 10 10 0 7-10 12-10 12S6 23 6 16C6 10 10 6 16 6Z"/><path d="M16 10v12M10 16h12"/></svg>`,
        boots_attack: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><path d="M20 16h6"/></svg>`,
        boots_control: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><circle cx="18" cy="19" r="2"/></svg>`,
        boots_defense: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><path d="M20 13 25 16 20 19Z"/></svg>`,
        keeper_gloves: `<svg viewBox="0 0 32 32"><path d="M10 25V12a3 3 0 0 1 6 0v4-7a3 3 0 0 1 6 0v16H10Z"/><path d="M10 18 6 15"/></svg>`,
        grit_band: `<svg viewBox="0 0 32 32"><path d="M7 12h18v8H7z"/><path d="m10 12 3-5h6l3 5M12 24h8"/></svg>`,
        physical_band: `<svg viewBox="0 0 32 32"><path d="M7 16h18v7H7z"/><path d="M11 16c1-6 9-6 10 0M12 23l-2 4M20 23l2 4"/></svg>`,
        speed_necklace: `<svg viewBox="0 0 32 32"><path d="M8 8c2 9 14 9 16 0"/><path d="m16 17-4 8h8l-4-8Z"/><path d="M6 20h5M21 20h5"/></svg>`,
        stamina_necklace: `<svg viewBox="0 0 32 32"><path d="M8 8c2 9 14 9 16 0"/><circle cx="16" cy="21" r="5"/><path d="M16 18v3l2 2"/></svg>`,
      };
      return `<span class="item-icon item-icon--fallback" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}">${icons[id] || itemImageFallbackSvg()}</span>`;
    }
    return { itemImageFallbackSvg, handleItemImageError, equipmentBadgeMarkup, itemIcon };
  }
  global.InventoryItemPresenter = { create };
})(globalThis);
