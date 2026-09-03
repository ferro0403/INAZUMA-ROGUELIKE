(function (global) {
  "use strict";

  const SECTION_ROOT_DESTINATIONS = {
    seasonSelection: { destination: "home", label: "Torna alla Home" },
    run: { destination: "seasonSelection", label: "Torna alla selezione delle run" },
    albumRoot: { destination: "home", label: "Torna alla Home" },
    albumCollection: { destination: "albumRoot", label: "Torna alle collezioni Album" },
    albumRoster: { destination: "albumTeams", label: "Torna alla selezione squadre" },
    hallRoot: { destination: "home", label: "Torna alla Home" },
    hallDetail: { destination: "hallRoot", label: "Torna all’Albo d’Oro" },
    finalSummary: { destination: "home", label: "Torna alla Home" },
    development: { destination: "seasonSelection", label: "Torna alla selezione delle run" },
    match: { destination: "map", label: "Torna alla mappa della run" },
  };

  function create({ app, modalRoot, toastRoot, getRun, normalizeTeamIdentity, averageOverall }) {
    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function toast(message, type = "success") {
      const element = document.createElement("div");
      element.className = `toast toast--${type === "error" ? "error" : "success"}`;
      element.setAttribute("role", "status");
      element.innerHTML = `<span class="toast-mark" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span class="toast-copy">${escapeHtml(message)}</span>`;
      toastRoot.appendChild(element);
      setTimeout(() => element.remove(), 3200);
    }

    function scrollSnapshot() {
      const modal = modalRoot.querySelector(".modal");
      const activeView = app.querySelector("main") || app.firstElementChild || app;
      return {
        windowX: window.scrollX || 0,
        windowY: window.scrollY || 0,
        appLeft: app ? app.scrollLeft || 0 : 0,
        appTop: app ? app.scrollTop || 0 : 0,
        viewLeft: activeView ? activeView.scrollLeft || 0 : 0,
        viewTop: activeView ? activeView.scrollTop || 0 : 0,
        modalLeft: modal ? modal.scrollLeft || 0 : 0,
        modalTop: modal ? modal.scrollTop || 0 : 0,
      };
    }

    function setScrollPosition(element, top = 0, left = 0) {
      if (!element) return;
      if (typeof element.scrollTo === "function") element.scrollTo({ top, left, behavior: "auto" });
      else { element.scrollTop = top; element.scrollLeft = left; }
      element.scrollTop = top;
      element.scrollLeft = left;
    }

    function restorePageScroll(snapshot) {
      if (!snapshot) return;
      const activeView = app.querySelector("main") || app.firstElementChild || app;
      setScrollPosition(activeView, snapshot.viewTop || 0, snapshot.viewLeft || 0);
      setScrollPosition(app, snapshot.appTop || 0, snapshot.appLeft || 0);
      try { window.scrollTo({ top: snapshot.windowY || 0, left: snapshot.windowX || 0, behavior: "auto" }); }
      catch (_) { window.scrollX = snapshot.windowX || 0; window.scrollY = snapshot.windowY || 0; }
    }

    function restoreScroll(snapshot) {
      if (!snapshot) return;
      setScrollPosition(modalRoot.querySelector(".modal"), snapshot.modalTop || 0, snapshot.modalLeft || 0);
      restorePageScroll(snapshot);
    }

    function afterNextPaint(callback) { requestAnimationFrame(() => requestAnimationFrame(callback)); }

    function runKeepingScroll(callback) {
      const snapshot = scrollSnapshot();
      const result = callback();
      afterNextPaint(() => restoreScroll(snapshot));
      return result;
    }

    function isScrollableElement(element) {
      if (!element || element === document.body || element === document.documentElement) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
      const overflowY = style ? `${style.overflowY} ${style.overflow}` : "";
      const overflowX = style ? `${style.overflowX} ${style.overflow}` : "";
      const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
      const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && element.scrollWidth > element.clientWidth;
      return canScrollY || canScrollX || element.scrollTop > 0 || element.scrollLeft > 0;
    }

    function scrollTargetsForView(viewElement = null) {
      const roots = [viewElement, modalRoot.querySelector(".modal"), app.querySelector("main"), app, document.scrollingElement, document.documentElement, document.body].filter(Boolean);
      const targets = new Set();
      roots.forEach((root) => {
        targets.add(root);
        if (root.querySelectorAll) root.querySelectorAll("*").forEach((element) => { if (isScrollableElement(element)) targets.add(element); });
      });
      return [...targets];
    }

    function resetViewScroll(viewElement = null) {
      scrollTargetsForView(viewElement).forEach((element) => setScrollPosition(element, 0, 0));
      try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }
      catch (_) { window.scrollX = 0; window.scrollY = 0; }
      if (document.documentElement) { document.documentElement.scrollTop = 0; document.documentElement.scrollLeft = 0; }
      if (document.body) { document.body.scrollTop = 0; document.body.scrollLeft = 0; }
    }

    function resetRenderedViewScroll(viewElement = null) {
      const view = viewElement || app.querySelector("main") || app.firstElementChild || app;
      resetViewScroll(view);
      afterNextPaint(() => resetViewScroll(view));
    }

    function closeModal({ invokeOnClose = true } = {}) {
      const restoreFocusTo = modalRoot._restoreFocusTo;
      const restoreScrollTo = modalRoot._restoreScrollTo;
      const onClose = modalRoot._onClose;
      modalRoot.innerHTML = "";
      modalRoot._restoreFocusTo = null;
      modalRoot._restoreScrollTo = null;
      modalRoot._onClose = null;
      modalRoot.removeAttribute("style");
      modalRoot.classList.remove("has-open-modal");
      [document.documentElement, document.body, app].forEach((element) => {
        if (!element) return;
        element.classList.remove("modal-scroll-locked");
        const savedStyle = element._modalSavedStyle;
        if (savedStyle !== undefined) {
          if (savedStyle == null) element.removeAttribute("style");
          else element.setAttribute("style", savedStyle);
          delete element._modalSavedStyle;
        }
      });
      if (restoreScrollTo) restorePageScroll(restoreScrollTo);
      if (restoreFocusTo && typeof restoreFocusTo.focus === "function" && document.contains(restoreFocusTo)) {
        try { restoreFocusTo.focus({ preventScroll: true }); } catch (_) { restoreFocusTo.focus(); }
      }
      if (invokeOnClose && typeof onClose === "function") onClose();
    }

    function openModal(content, { closeable = true, className = "", onClose = null, preserveScroll = null } = {}) {
      if (modalRoot.firstElementChild) closeModal({ invokeOnClose: false });
      modalRoot._restoreFocusTo = document.activeElement;
      modalRoot._restoreScrollTo = preserveScroll || scrollSnapshot();
      modalRoot._onClose = onClose;
      [document.documentElement, document.body, app].forEach((element) => {
        element._modalSavedStyle = element.getAttribute("style");
        element.classList.add("modal-scroll-locked");
      });
      modalRoot.classList.add("has-open-modal");
      modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${className}">${closeable ? '<button type="button" class="modal-close" data-close-modal aria-label="Chiudi">✕</button>' : ""}${content}</section></div>`;
      modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", () => closeModal());
      const modal = modalRoot.querySelector(".modal");
      resetRenderedViewScroll(modal);
      if (preserveScroll) afterNextPaint(() => restorePageScroll(preserveScroll));
      afterNextPaint(() => modalRoot.querySelector("[data-close-modal]")?.focus?.({ preventScroll: true }));
    }

    function getSectionRootDestination(section) { return SECTION_ROOT_DESTINATIONS[section] || SECTION_ROOT_DESTINATIONS.seasonSelection; }

    function sectionRootButton(section, extraClass = "") {
      const destination = getSectionRootDestination(section);
      return `<button type="button" class="section-root-button ${escapeHtml(extraClass)}" data-section-root="${escapeHtml(section)}" aria-label="${escapeHtml(destination.label)}" title="${escapeHtml(destination.label)}"><svg class="section-root-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"/><path d="M9 12h11"/></svg></button>`;
    }

    function lifeHeartsMarkup(lives) {
      const currentLives = Math.max(0, Number(lives) || 0);
      const maxLives = Number(global.RunState?.runLivesLimit?.() ?? global.SEASON1_CONFIG.maxRunLives ?? global.SEASON1_CONFIG.startingLives ?? 2);
      return Array.from({ length: maxLives }, (_, index) => {
        const remaining = currentLives - index;
        const state = remaining >= 1 ? "full" : remaining >= 0.5 ? "half" : "empty";
        return `<span class="life-heart life-heart--${state}" aria-hidden="true">${state === "full" ? "♥" : "♡"}</span>`;
      }).join("");
    }

    function hearts() { return lifeHeartsMarkup(getRun()?.lives); }

    function formatDuration(ms) {
      const value = Number(ms);
      if (!Number.isFinite(value) || value <= 0) return "0 min";
      const minutes = Math.max(1, Math.round(value / 60000));
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return hours ? `${hours}h ${rest}m` : `${minutes} min`;
    }

    function topbar(title, extraClass = "", rootSection = "run") {
      const run = getRun();
      const identity = run ? normalizeTeamIdentity(run.teamIdentity) : null;
      const teamName = identity?.name || title || "Inazuma Roguelike";
      return `<header class="topbar game-topbar shared-game-header ${escapeHtml(extraClass)}"><div class="topbar-title-group">${sectionRootButton(rootSection)}<div class="topbar-brand-block"><span class="topbar-kicker">${escapeHtml(title || "Inazuma Roguelike")}</span><strong class="brand">${escapeHtml(teamName)}</strong></div></div><div class="status-strip" aria-label="Stato run"><span class="status-pill"><small>OVR</small><strong>${escapeHtml(averageOverall())}</strong></span><span class="status-pill"><small>LV</small><strong>${escapeHtml(global.LevelProgression.formatLevel(run, run.seasonId))}</strong></span><span class="status-pill lives" title="Vite" aria-label="Vite ${escapeHtml(run.lives)}">${hearts()}</span></div></header>`;
    }

    function navIcon(name) {
      const icons = {
        map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
        squad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5M12.5 17.5c.7-2.2 1.9-3.4 3.5-3.4 1.8 0 3.2 1.4 4 4"/></svg>',
        inventory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V6a5 5 0 0 1 10 0v2"/><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 12h6"/></svg>',
        five: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m12 8 3 2-1 4h-4l-1-4 3-2ZM4.8 10.5l4.2-.5M15 10l4.2.5M8.5 18l1.5-4M14 14l1.5 4"/></svg>',
      };
      return icons[name] || "";
    }

    function bottomNav(active) {
      const run = getRun();
      if (!run || !run.roster.length) return "";
      const items = [["map", "Percorso", "map"], ["squad", "Squadra", "squad"], ["inventory", "Oggetti", "inventory"], ["five", "5v5", "five"]];
      return `<nav class="bottom-nav" aria-label="Navigazione principale">${items.map(([destination, label, icon]) => `<button type="button" data-nav="${destination}" class="${active === destination ? "active" : ""}" aria-label="${label}" aria-current="${active === destination ? "page" : "false"}"><span class="nav-icon">${navIcon(icon)}</span><span class="nav-label">${label}</span></button>`).join("")}</nav>`;
    }

    function cssEscape(value) {
      if (global.CSS && typeof global.CSS.escape === "function") return global.CSS.escape(String(value));
      return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    function inazumaLogoMarkup(className = "") { return `<span class="inazuma-logo ${className}" aria-label="Logo Inazuma" role="img">⚡</span>`; }

    if (window.history && "scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

    return {
      escapeHtml, toast, closeModal, scrollSnapshot, setScrollPosition, restorePageScroll, restoreScroll,
      afterNextPaint, runKeepingScroll, isScrollableElement, scrollTargetsForView, resetViewScroll,
      resetRenderedViewScroll, openModal, getSectionRootDestination, sectionRootButton, lifeHeartsMarkup,
      hearts, formatDuration, topbar, navIcon, bottomNav, cssEscape, inazumaLogoMarkup,
    };
  }

  global.AppUiShell = Object.freeze({ create, SECTION_ROOT_DESTINATIONS });
})(globalThis);
