(function () {
  "use strict";

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  if (!app || !modalRoot) return;

  const SCREEN_SELECTOR = ".boss-match-screen";

  function matchStateLabel(state) {
    if (state === "completed-victory") return "Vittoria";
    if (state === "completed-defeat") return "Sconfitta";
    if (state === "simulating") return "In corso";
    return "Pronta";
  }

  function timelineStateLabel(state) {
    return state === "simulating" ? "Live" : String(state || "").startsWith("completed") ? "Completa" : "In attesa";
  }

  function cloneSimulationEmblem(teamNode) {
    const source = teamNode?.querySelector(".boss-match-logo img, .boss-match-logo .team-emblem, .boss-match-logo .boss-match-emblem, .boss-match-logo > *");
    if (!source) return null;
    const clone = source.cloneNode(true);
    clone.removeAttribute?.("id");
    clone.classList?.add("five-simulation-emblem");
    clone.setAttribute?.("aria-hidden", "true");
    if (clone.tagName === "IMG") clone.alt = "";
    return clone;
  }

  function teamLockup(teamNode, opponent = false) {
    const name = teamNode?.querySelector("strong")?.textContent?.trim() || (opponent ? "Avversari" : "La tua squadra");
    const node = document.createElement("strong");
    const emblem = cloneSimulationEmblem(teamNode);
    if (opponent) {
      node.append(document.createTextNode(name));
      if (emblem) node.append(emblem);
    } else {
      if (emblem) node.append(emblem);
      node.append(document.createTextNode(name));
    }
    return { name, node };
  }

  function lockModalScroll() {
    modalRoot._restoreFocusTo = document.activeElement;
    modalRoot._restoreScrollTo = null;
    modalRoot._onClose = null;
    [document.documentElement, document.body, app].forEach((element) => {
      if (!element) return;
      if (element._modalSavedStyle === undefined) element._modalSavedStyle = element.getAttribute("style");
      element.classList.add("modal-scroll-locked");
    });
    modalRoot.classList.add("has-open-modal");
  }

  function normalizeEmptyTimeline(log) {
    if (!log?.querySelector("[data-empty-log]")) return;
    log.innerHTML = `<li data-empty-log="true"><span>0'</span><b>⚽</b><p>Calcio d'inizio.</p></li>`;
  }

  function continueButtonText(screen, state) {
    const isSpecial = /partita speciale/i.test(screen.querySelector(".topbar-kicker")?.textContent || "");
    if (state === "completed-defeat") return "Torna alla mappa";
    if (state === "completed-victory" && (isSpecial || screen.querySelector(".boss-match-team--boss"))) return "Continua";
    return "Continua";
  }

  function syncContinueLabel(cabin, screen) {
    if (!cabin || !screen) return;
    const state = cabin.dataset.matchState || screen.dataset.matchState || "pre-match";
    const button = cabin.querySelector("#continue-match-result");
    if (button) button.textContent = continueButtonText(screen, state);
  }

  function openBossSimulationModal(screen) {
    if (!screen || modalRoot.querySelector("[data-boss-simulation-modal]")) return false;

    const bottomGrid = screen.querySelector(".boss-match-bottom-grid");
    const resultPanel = bottomGrid?.querySelector(".boss-match-result-panel");
    const logPanel = bottomGrid?.querySelector(".boss-match-log-panel");
    const score = resultPanel?.querySelector(".boss-match-score");
    const log = logPanel?.querySelector(".match-sim-log");
    const controls = screen.querySelector(".boss-match-controls");
    const skipButton = controls?.querySelector("#skip-match-result");
    const continueButton = controls?.querySelector("#continue-match-result");

    if (!bottomGrid || !resultPanel || !logPanel || !score || !log || !skipButton || !continueButton) return false;

    const state = screen.dataset.matchState || "pre-match";
    const teams = screen.querySelectorAll(".boss-match-team");
    const user = teamLockup(teams[0], false);
    const opponent = teamLockup(teams[1], true);

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal five-simulation-modal boss-simulation-modal" role="dialog" aria-modal="true" aria-label="Simulazione partita 11v11">
          <div class="five-simulation-cabin" data-five-simulation-modal data-boss-simulation-modal data-match-state="${state}">
            <header class="five-simulation-head">
              <p class="eyebrow">Cabina partita</p>
              <h2>Simulazione 11v11</h2>
              <strong class="five-simulation-state">${matchStateLabel(state)}</strong>
            </header>
            <div data-boss-simulation-score-slot></div>
            <div data-boss-simulation-events-slot></div>
            <footer class="five-simulation-actions" data-boss-simulation-actions></footer>
          </div>
        </section>
      </div>`;

    const cabin = modalRoot.querySelector("[data-boss-simulation-modal]");
    const scoreSlot = cabin?.querySelector("[data-boss-simulation-score-slot]");
    const eventsSlot = cabin?.querySelector("[data-boss-simulation-events-slot]");
    const actions = cabin?.querySelector("[data-boss-simulation-actions]");
    if (!cabin || !scoreSlot || !eventsSlot || !actions) {
      modalRoot.innerHTML = "";
      return false;
    }

    const statusParagraph = Array.from(resultPanel.children).find((child) => child.tagName === "P" && !child.classList.contains("eyebrow")) || document.createElement("p");
    const scoreRow = document.createElement("div");
    scoreRow.className = "five-match-result-row";
    scoreRow.append(user.node, score, opponent.node);
    score.setAttribute("aria-label", `${user.name} contro ${opponent.name}`);
    resultPanel.className = "boss-match-result-panel five-simulation-score";
    resultPanel.removeAttribute("hidden");
    resultPanel.replaceChildren(scoreRow, statusParagraph);
    scoreSlot.replaceWith(resultPanel);

    const eventsHeader = document.createElement("div");
    eventsHeader.className = "panel-title-row";
    const eventsTitle = document.createElement("h3");
    eventsTitle.textContent = "Cronaca eventi";
    const eventsBadge = document.createElement("span");
    eventsBadge.className = "match-state-badge";
    eventsBadge.textContent = timelineStateLabel(state);
    eventsHeader.append(eventsTitle, eventsBadge);
    normalizeEmptyTimeline(log);
    logPanel.className = "five-simulation-events";
    logPanel.removeAttribute("hidden");
    logPanel.replaceChildren(eventsHeader, log);
    eventsSlot.replaceWith(logPanel);

    skipButton.className = "btn btn-secondary";
    skipButton.textContent = "Vai al risultato";
    continueButton.className = "btn btn-yellow btn-primary-action";
    continueButton.textContent = continueButtonText(screen, state);
    actions.append(skipButton, continueButton);

    bottomGrid.remove();
    lockModalScroll();
    syncContinueLabel(cabin, screen);

    const stateObserver = new MutationObserver(() => syncContinueLabel(cabin, screen));
    stateObserver.observe(cabin, { attributes: true, attributeFilter: ["data-match-state"] });
    return true;
  }

  function cleanBossScreen(screen) {
    if (!screen) return;
    screen.querySelectorAll(".boss-match-reward-note").forEach((banner) => banner.remove());
    const state = screen.dataset.matchState || "pre-match";
    if (state === "simulating" || state.startsWith("completed")) {
      queueMicrotask(() => openBossSimulationModal(screen));
    }
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("#simulate-boss-match, #test-win, #test-loss");
    if (!trigger) return;
    const screen = trigger.closest(SCREEN_SELECTOR);
    if (!screen) return;
    openBossSimulationModal(screen);
  }, true);

  const observer = new MutationObserver(() => {
    const screen = app.querySelector(SCREEN_SELECTOR);
    if (screen) cleanBossScreen(screen);
  });
  observer.observe(app, { childList: true, subtree: true });

  cleanBossScreen(app.querySelector(SCREEN_SELECTOR));
})();
