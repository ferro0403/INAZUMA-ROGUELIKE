(function () {
  "use strict";

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;

  const ELEMENTS = {
    fire: {
      aliases: ["fire", "fuoco"],
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.4 3.6 5 5.2 5 9.4A5 5 0 1 1 7 12c0-2.3 1.2-4.3 3.4-6.3-.1 2.2.5 3.7 1.6 4.7.9-2 .7-4.5 0-7.4Z"/></svg>'
    },
    mountain: {
      aliases: ["mountain", "montagna"],
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6.2-10 3.1 4.6L15.5 9 21 19H3Z"/><path d="m7.5 12 1.8 1.1 1.4-1.1"/></svg>'
    },
    forest: {
      aliases: ["forest", "albero", "wood", "bosco"],
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 7.5 9h2.3L6 14h4v4H8v3h8v-3h-2v-4h4l-3.8-5h2.3L12 3Z"/></svg>'
    },
    wind: {
      aliases: ["wind", "vento"],
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h10.5c2 0 2.5-3 0-3-1.1 0-1.8.5-2.2 1.2"/><path d="M3 12h15c2.4 0 2.8 3.5.2 3.5-1.2 0-2-.6-2.4-1.4"/><path d="M3 16h8"/></svg>'
    }
  };

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function resolveElement(label) {
    const value = normalize(label);
    return Object.entries(ELEMENTS).find(([, config]) => config.aliases.some((alias) => value === alias || value.includes(alias))) || null;
  }

  function enhance(scope) {
    const chips = [];
    if (scope instanceof Element && scope.matches(".detail-element-chip")) chips.push(scope);
    scope.querySelectorAll?.(".detail-element-chip").forEach((chip) => chips.push(chip));

    chips.forEach((chip) => {
      const text = Array.from(chip.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" ")
        .trim() || chip.textContent.trim();
      const match = resolveElement(text);
      if (!match) return;
      const [key, config] = match;
      chip.dataset.element = key;
      const oldIcon = chip.querySelector("svg");
      if (oldIcon) oldIcon.outerHTML = config.icon;
      else chip.insertAdjacentHTML("afterbegin", config.icon);
    });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) enhance(node);
    }));
  });

  observer.observe(modalRoot, { childList: true, subtree: true });
  enhance(modalRoot);
})();
