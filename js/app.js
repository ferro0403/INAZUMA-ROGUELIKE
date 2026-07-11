(function (global) {
  "use strict";

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  const CATEGORY_CLASS_BY_NAME = {
    Scarso: "rarity-scarso",
    Debole: "rarity-debole",
    Normale: "rarity-normale",
    Buono: "rarity-buono",
    Forte: "rarity-forte",
    Elite: "rarity-elite",
    Mondiale: "rarity-mondiale",
    Leggenda: "rarity-leggenda",
  };
  const CATEGORY_LADDER = ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda"];

  function rarityClass(category) {
    return CATEGORY_CLASS_BY_NAME[category] || "rarity-debole";
  }

  function improvedCategory(category) {
    const index = CATEGORY_LADDER.indexOf(category);
    return CATEGORY_LADDER[Math.min(CATEGORY_LADDER.length - 1, Math.max(0, index) + 1)];
  }

  function itemIcon(itemOrId) {
    const id = String(typeof itemOrId === "string" ? itemOrId : itemOrId?.id || "");
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
    return `<span class="item-icon" aria-hidden="true">${icons[id] || icons.scout_token}</span>`;
  }

  const STAT_LABELS = {
    attack: "Attacco",
    control: "Controllo",
    speed: "Velocità",
    grit: "Grinta",
    physical: "Fisico",
    stamina: "Resistenza",
    defense: "Difesa",
    save: "Parata",
  };

  let seasonDb = null;
  let freeAgentsDb = null;
  let freeAgentsById = new Map();
  let seasonPlayersById = new Map();
  let seasonTeamsById = new Map();
  let playerVisualsById = new Map();
  let run = null;
  const ui = {
    selectedSquadPlayerId: null,
    activeTab: "map",
    match: null,
    pendingReward: null,
    squadEditMode: false,
    fiveVFiveSelectedSlot: null,
    fiveVFiveRoleFilter: "all",
    tradeSelectedPlayerId: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    toastRoot.appendChild(element);
    setTimeout(() => element.remove(), 3200);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function scrollSnapshot() {
    const modal = modalRoot.querySelector(".modal");
    return {
      windowX: window.scrollX || 0,
      windowY: window.scrollY || 0,
      modalTop: modal ? modal.scrollTop : 0,
    };
  }

  function restoreScroll(snapshot) {
    if (!snapshot) return;
    const modal = modalRoot.querySelector(".modal");
    if (modal) modal.scrollTop = snapshot.modalTop || 0;
    try {
      window.scrollTo(snapshot.windowX || 0, snapshot.windowY || 0);
    } catch (error) {
      window.scrollX = snapshot.windowX || 0;
      window.scrollY = snapshot.windowY || 0;
    }
  }

  function runKeepingScroll(callback) {
    const snapshot = scrollSnapshot();
    const result = callback();
    requestAnimationFrame(() => restoreScroll(snapshot));
    setTimeout(() => restoreScroll(snapshot), 0);
    return result;
  }

  function openModal(content, { closeable = true, className = "", onClose = null, preserveScroll = null } = {}) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal ${className}">
          ${closeable ? '<button class="modal-close" data-close-modal aria-label="Chiudi">✕</button>' : ""}
          ${content}
        </section>
      </div>`;
    modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", () => {
      closeModal();
      if (onClose) onClose();
    });
    restoreScroll(preserveScroll);
  }

  function formationById(id) {
    return seasonDb.formations.eleven.find((formation) => formation.id === id);
  }

  function fiveRoleForPlayerId(playerId) {
    const entry = rosterEntry(playerId);
    return entry ? sourcePlayer(entry)?.position : null;
  }

  function ensureFiveVFive() {
    if (!run || !run.roster?.length) return null;
    return global.FiveVFive.ensure(run, fiveRoleForPlayerId);
  }

  function fiveVFiveStatus() {
    ensureFiveVFive();
    return global.FiveVFive.validate(run, fiveRoleForPlayerId);
  }

  function sourcePlayer(entryOrId, preferredSource) {
    const id = String(entryOrId && typeof entryOrId === "object" ? entryOrId.playerId : entryOrId);
    const source = preferredSource || (entryOrId && entryOrId.source);
    if (source === "season1") return seasonPlayersById.get(id);
    return freeAgentsById.get(id) || seasonPlayersById.get(id);
  }

  function rosterEntry(playerId) {
    return run.roster.find((entry) => String(entry.playerId) === String(playerId));
  }

  function ensureRunSchema() {
    if (!run) return;
    run.inventory = Array.isArray(run.inventory) ? run.inventory : [];
    run.effects = run.effects || { luckyPulls: 0 };
    run.effects.luckyPulls = Number(run.effects.luckyPulls || 0);
    run.randomEventHistory = Array.isArray(run.randomEventHistory) ? run.randomEventHistory : [];
    run.roster = (run.roster || []).map((entry) => ({ ...entry, equippedItem: entry.equippedItem || null }));
    run.lineup = (run.lineup || []).map(String);
    run.bench = (run.bench || []).map(String);
    if (run.roster.length && seasonDb && freeAgentsDb) ensureFiveVFive();
    run.inventory = run.inventory.map((item) => {
      const definition = global.SEASON1_CONFIG.itemPool.find((candidate) => candidate.id === item.id);
      return {
        ...(definition || item),
        ...item,
        instanceId: item.instanceId || `${item.id || "legacy"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
    });
  }

  function makeItemInstance(item, seedSuffix = "") {
    return {
      ...item,
      instanceId: `${item.id}_${Date.now()}_${seedSuffix || Math.random().toString(36).slice(2, 8)}`,
    };
  }

  function removeInventoryItem(instanceId) {
    const index = run.inventory.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return null;
    return run.inventory.splice(index, 1)[0];
  }

  function resolvedRosterPlayer(playerId) {
    const entry = rosterEntry(playerId);
    if (!entry) return null;
    const player = sourcePlayer(entry);
    const database = entry.source === "season1" ? seasonDb : freeAgentsDb;
    const resolved = global.InazumaProgression.getPlayerAtLevel(
      player,
      Math.floor(Number(entry.level || 0)),
      database
    );
    const effectiveStats = global.RoguelikeRules.applyEquipment(resolved.stats, entry.equippedItem);
    return {
      ...resolved,
      ...effectiveStats,
      stats: effectiveStats,
      baseStats: resolved.stats,
      equipment: entry.equippedItem,
      displayLevel: Number(entry.level || 0),
      source: entry.source,
    };
  }

  function hearts() {
    return Array.from({ length: global.SEASON1_CONFIG.startingLives }, (_, index) =>
      index < run.lives ? "♥" : "♡"
    ).join(" ");
  }

  function topbar(title) {
    return `
      <header class="topbar">
        <div><div class="brand">⚡ ${escapeHtml(title || "Inazuma Roguelike")}</div></div>
        <div class="status-strip">
          <span class="status-pill">Lv ${escapeHtml(run.teamLevel)}</span>
          <span class="status-pill lives" title="Vite">${hearts()}</span>
        </div>
      </header>`;
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
    if (!run || !run.roster.length) return "";
    const items = [
      ["map", "Percorso", "map"],
      ["squad", "Squadra", "squad"],
      ["inventory", "Oggetti", "inventory"],
      ["five", "5v5", "five"],
    ];
    return `
      <nav class="bottom-nav" aria-label="Navigazione principale">
        ${items.map(([destination, label, icon]) => `
          <button data-nav="${destination}" class="${active === destination ? "active" : ""}" aria-label="${label}" aria-current="${active === destination ? "page" : "false"}">
            <span class="nav-icon">${navIcon(icon)}</span>
            <span class="nav-label">${label}</span>
          </button>`).join("")}
      </nav>`;
  }

  function bindBottomNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const destination = button.dataset.nav;
        if (destination === "map") {
          ensureCurrentZone();
          run.phase = "map";
          global.RunState.save(run);
          renderMap();
        } else if (destination === "squad") {
          run.phase = "squad";
          global.RunState.save(run);
          renderSquad();
        } else if (destination === "inventory") {
          renderInventory();
        } else if (destination === "five") {
          renderFiveVFive();
        }
      });
    });
  }

  function compactPlayerCardMarkup(player, { equipment = null, level = player.displayLevel ?? 0, overall = player.overall ?? player.finalOverall, selected = false, dataAttr = "" } = {}) {
    return `
      <button class="player-card player-card-compact mini-player ${rarityClass(player.category)} ${equipment ? "has-equipment" : ""} ${selected ? "selected" : ""}" ${dataAttr}>
        <span class="player-corner player-role" aria-label="Ruolo ${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
        <span class="player-corner player-overall" aria-label="Overall ${overall}">${overall}</span>
        <div class="player-portrait-wrap">
          <img class="player-portrait" src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
        </div>
        <div class="player-info">
          <div class="player-title"><strong>${escapeHtml(player.name)}</strong></div>
          <div class="player-meta" aria-label="Dettagli giocatore"><span>${escapeHtml(player.element || player.type)}</span><span>${escapeHtml(player.category)}</span></div>
        </div>
        ${equipment ? `<span class="player-corner player-equipment" aria-label="Oggetto equipaggiato" title="${escapeHtml(equipment.name)}">${itemIcon(equipment)}</span>` : ""}
        <span class="player-corner player-level" aria-label="Livello ${escapeHtml(level)}">Lv ${escapeHtml(level)}</span>
      </button>`;
  }

  function playerCard(player, options = {}) {
    const database = options.database || freeAgentsDb;
    const level = Number(options.level ?? 0);
    const resolved = global.InazumaProgression.getPlayerAtLevel(
      player,
      Math.floor(level),
      database
    );
    const tag = options.button ? "button" : "article";
    const attributes = options.button
      ? `type="button" data-player-id="${escapeHtml(player.playerId)}"`
      : "";
    return `
      <${tag} class="player-card player-card-large ${rarityClass(player.category)} ${options.selected ? "selected" : ""} ${options.equipment ? "has-equipment" : ""}" ${attributes}>
        <span class="player-corner player-role" aria-label="Ruolo ${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
        <span class="player-corner player-overall" aria-label="Overall ${resolved.overall}">${resolved.overall}</span>
        <div class="player-portrait-wrap">
          <img class="player-portrait" src="${escapeHtml(player.portraitUrl)}" alt="${escapeHtml(player.name)}" loading="lazy" />
        </div>
        <div class="player-info">
          <div class="player-title">
            <strong>${escapeHtml(player.name)}</strong>
          </div>
          <div class="player-meta" aria-label="Dettagli giocatore">
            <span>${escapeHtml(player.element || player.type)}</span>
            <span>${escapeHtml(player.category)}</span>
          </div>
        </div>
        ${options.equipment ? `<span class="player-corner player-equipment" aria-label="Oggetto equipaggiato">${itemIcon(options.equipment)}</span>` : ""}
        <span class="player-corner player-level" aria-label="Livello ${escapeHtml(level)}">Lv ${escapeHtml(level)}</span>
      </${tag}>`;
  }

  function playerTeamIdentity(player, playerId) {
    const entry = playerId ? rosterEntry(playerId) : null;
    const ids = [entry?.teamId, player.teamId, ...(player.teamIds || [])].filter(Boolean);
    let team = ids.map((id) => seasonTeamsById.get(String(id))).find(Boolean);
    let teamName = team?.teamName || entry?.teamName || player.teamName || (player.teams || []).find((name) => name && name !== "Unaffiliated") || (player.teamId === "unaffiliated" ? "Svincolato" : "");
    if (!team && teamName) team = (seasonDb?.teams || []).find((candidate) => candidate.teamName === teamName);
    if (!teamName) teamName = "Svincolato";
    return { name: teamName === "Unaffiliated" ? "Svincolato" : teamName, logoUrl: team?.logoUrl || "" };
  }

  function showPlayerDetailsFor(player, { playerId = player.playerId, level = player.displayLevel ?? 0, database = freeAgentsDb, equipment = null, onClose = null } = {}) {
    if (!player) return toast("Giocatore non disponibile");
    const visual = playerVisualsById.get(String(playerId)) || {};
    const fullbodyUrl = visual.fullbodyUrl || player.portraitUrl;
    const teamIdentity = playerTeamIdentity(player, playerId);
    const teamBadge = teamIdentity.name ? `
      <div class="player-detail-team" aria-label="Squadra ${escapeHtml(teamIdentity.name)}">
        ${teamIdentity.logoUrl ? `<img src="${escapeHtml(teamIdentity.logoUrl)}" alt="${escapeHtml(teamIdentity.name)}" loading="lazy" />` : `<span class="team-logo-placeholder" aria-hidden="true">⚽</span>`}
        <strong>${escapeHtml(teamIdentity.name)}</strong>
      </div>` : "";
    const resolved = player.stats && player.baseStats
      ? player
      : global.InazumaProgression.getPlayerAtLevel(player, Math.floor(Number(level || 0)), database);
    const effectiveStats = equipment ? global.RoguelikeRules.applyEquipment(resolved.stats, equipment) : resolved.stats;
    const stats = Object.entries(STAT_LABELS).map(([stat, label]) => {
      const base = Number(resolved.stats[stat] || 0);
      const effective = Number(effectiveStats[stat] || 0);
      const bonus = effective - base;
      return `<div class="detail-stat"><span>${label}</span><strong>${effective}${bonus > 0 ? ` <em>+${bonus}</em>` : ""}</strong></div>`;
    }).join("");
    openModal(`
      <div class="player-detail-layout">
        <section class="player-detail-visual ${rarityClass(player.category)}">
          ${teamBadge}
          <img class="player-fullbody" src="${escapeHtml(fullbodyUrl)}" alt="${escapeHtml(player.name)}" />
        </section>
        <section class="player-detail-content">
          <p class="eyebrow">Player detail</p>
          <h2 class="player-detail-name">${escapeHtml(player.name)}</h2>
          <div class="player-detail-tags"><span class="role-chip">${player.position}</span><span class="role-chip">${escapeHtml(player.element || player.type)}</span><span class="role-chip">Lv ${Number(level || 0)}</span></div>
          <div class="overall-comparison">
            <div><span>Overall attuale</span><strong>${resolved.overall}</strong></div>
            <div><span>Potenziale</span><strong>${player.finalOverall}</strong></div>
          </div>
          <p class="detail-category">${escapeHtml(player.category)}</p>
          <div class="detail-stats">${stats}</div>
          ${equipment ? `<div class="equipped-detail">${itemIcon(equipment)}<span>Oggetto assegnato</span><strong>${escapeHtml(equipment.name)}</strong><small>${escapeHtml(equipment.description)}</small>${playerId ? `<button class="btn btn-ghost" data-detail-unequip="${escapeHtml(playerId)}">Rimuovi oggetto</button>` : ""}</div>` : ""}
        </section>
      </div>`,
      { closeable: true, className: "player-detail-modal", onClose }
    );
    modalRoot.querySelector("[data-detail-unequip]")?.addEventListener("click", () => unequipPlayerItem(playerId, { render: () => { closeModal(); renderSquad(); } }));
  }

  function showPlayerDetails(playerId, onClose = null) {
    const entry = rosterEntry(playerId);
    const player = resolvedRosterPlayer(playerId);
    if (!entry || !player) return toast("Giocatore non disponibile");
    showPlayerDetailsFor(player, {
      playerId,
      level: player.displayLevel,
      database: entry.source === "season1" ? seasonDb : freeAgentsDb,
      equipment: player.equipment,
      onClose,
    });
  }

  function renderHome() {
    run = global.RunState.load();
    ensureRunSchema();
    if (run && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(run, seasonDb) > 0) {
      global.RunState.save(run);
    }
    app.innerHTML = `
      <main class="hero-screen">
        <div>
          <p class="eyebrow">Season 1 · Prototipo funzionale</p>
          <h1>Inazuma<br />Roguelike</h1>
          <p class="muted">Costruisci la rosa, scegli il percorso e sconfiggi i dieci boss.</p>
          <div class="button-row">
            <button class="btn btn-yellow" id="new-run">Nuova run</button>
            ${run ? '<button class="btn btn-primary" id="continue-run">Continua</button>' : ""}
            ${run ? '<button class="btn btn-danger" id="delete-run">Cancella</button>' : ""}
          </div>
        </div>
      </main>`;

    document.getElementById("new-run").addEventListener("click", () => {
      if (run && !window.confirm("Vuoi sostituire la run salvata?")) return;
      run = global.RunState.createRun();
      global.RunState.save(run);
      renderFormationChoice();
    });
    document.getElementById("continue-run")?.addEventListener("click", resumeRun);
    document.getElementById("delete-run")?.addEventListener("click", () => {
      if (!window.confirm("Eliminare definitivamente la run?")) return;
      global.RunState.remove();
      run = null;
      renderHome();
    });
  }

  function resumeRun() {
    if (!run) return renderHome();
    if (run.gameOver || run.phase === "gameover") return renderGameOver();
    if (run.phase === "formation") return renderFormationChoice();
    if (run.phase === "draft") return renderDraft();
    if (run.phase === "squad") return renderSquad();
    if (run.phase === "five") return renderFiveVFive();
    if (run.phase === "inventory") return renderInventory();
    if (run.phase === "match" && ui.match) return renderMatch();
    ensureCurrentZone();
    renderMap();
  }

  function renderFormationChoice() {
    run.phase = "formation";
    global.RunState.save(run);
    app.innerHTML = `
      <main class="screen">
        ${topbar("Scegli il modulo")}
        <div class="content narrow">
          <div class="section-head">
            <div><p class="eyebrow">Prima decisione</p><h2>Come giocherà la tua squadra?</h2></div>
          </div>
          <div class="formation-grid">
            ${seasonDb.formations.eleven.map((formation) => `
              <button class="formation-card" data-formation="${escapeHtml(formation.id)}">
                <strong>${escapeHtml(formation.name)}</strong>
                <p class="muted small">Il draft proporrà esattamente i ruoli necessari.</p>
                <div class="formation-roles">
                  <span class="role-chip">GK ${formation.requirements.GK}</span>
                  <span class="role-chip">DF ${formation.requirements.DF}</span>
                  <span class="role-chip">MF ${formation.requirements.MF}</span>
                  <span class="role-chip">FW ${formation.requirements.FW}</span>
                </div>
              </button>`).join("")}
          </div>
        </div>
      </main>`;

    document.querySelectorAll("[data-formation]").forEach((button) => {
      button.addEventListener("click", () => {
        const formation = formationById(button.dataset.formation);
        run.formationId = formation.id;
        global.DraftEngine.start(run, formation, freeAgentsDb.players);
        global.RunState.save(run);
        renderDraft();
      });
    });
  }

  function renderDraft() {
    const draft = run.draft;
    if (!draft) return renderSquad();
    const role = draft.roles[draft.step];
    const candidates = draft.candidates.map((id) => freeAgentsById.get(String(id))).filter(Boolean);
    const progress = (draft.step / draft.roles.length) * 100;
    app.innerHTML = `
      <main class="screen">
        ${topbar("Draft iniziale")}
        <div class="content narrow">
          <p class="eyebrow">Scelta ${draft.step + 1} di ${draft.roles.length}</p>
          <div class="section-head">
            <div><h2>Scegli il tuo ${role}</h2><p class="muted">Uno di questi tre entrerà nella rosa.</p></div>
            <span class="role-chip">${escapeHtml(run.formationId)}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
          <div class="candidate-grid">
            ${candidates.map((player) => playerCard(player, { button: true })).join("")}
          </div>
        </div>
      </main>`;

    document.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const playerId = button.dataset.playerId;
        const player = freeAgentsById.get(playerId);
        const completed = global.DraftEngine.choose(
          run,
          playerId,
          freeAgentsDb.players,
          formationById(run.formationId)
        );
        if (completed) ensureFiveVFive();
        global.RunState.save(run);
        toast(`${player.name} entra nella squadra`);
        completed ? renderSquad() : renderDraft();
      });
    });
  }

  function rosterCounts() {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    run.roster.forEach((entry) => {
      const player = sourcePlayer(entry);
      if (player && counts[player.position] !== undefined) counts[player.position] += 1;
    });
    return counts;
  }

  function canUseFormation(formation) {
    const counts = rosterCounts();
    return Object.entries(formation.requirements).every(([role, amount]) => counts[role] >= amount);
  }

  function autoArrangeFormation(formation) {
    const available = run.roster.map((entry) => ({ entry, player: sourcePlayer(entry) }));
    const used = new Set();
    const lineup = formation.slotRoles.map((role) => {
      const candidate = available.find(
        ({ entry, player }) => player.position === role && !used.has(String(entry.playerId))
      );
      if (!candidate) throw new Error(`Not enough ${role} players`);
      used.add(String(candidate.entry.playerId));
      return String(candidate.entry.playerId);
    });
    run.formationId = formation.id;
    run.lineup = lineup;
    run.bench = run.roster
      .map((entry) => String(entry.playerId))
      .filter((id) => !used.has(id));
    ui.selectedSquadPlayerId = null;
  }


  function lineupRows() {
    return ["FW", "MF", "DF", "GK"].map((role) => ({
      role,
      ids: run.lineup.filter((id) => sourcePlayer(rosterEntry(id)).position === role),
    }));
  }

  function tacticalMiniPlayer(id, { mode = "squad", area = "lineup", selectedId = null } = {}) {
    const player = resolvedRosterPlayer(id);
    if (!player) return "";
    const selected = String(selectedId || ui.selectedSquadPlayerId) === String(id);
    const dataAttr = mode === "trade" ? `data-trade-player="${escapeHtml(id)}"` : mode === "equip" ? `data-equip-player="${escapeHtml(id)}"` : `data-squad-player="${escapeHtml(id)}" data-area="${area}"`;
    return compactPlayerCardMarkup(player, {
      equipment: player.equipment,
      level: player.displayLevel,
      overall: player.overall,
      selected,
      dataAttr,
    });
  }

  function squadPitchMarkup({ mode = "squad", selectedId = null } = {}) {
    return `
      <section class="pitch">
        ${lineupRows().map((row) => `<div class="pitch-row" data-row-count="${row.ids.length || 1}" style="--players-in-row:${row.ids.length || 1}">${row.ids.map((id) => tacticalMiniPlayer(id, { mode, area: "lineup", selectedId })).join("")}</div>`).join("")}
      </section>`;
  }

  function benchMarkup({ mode = "squad", selectedId = null } = {}) {
    return run.bench.length ? run.bench.map((id) => tacticalMiniPlayer(id, { mode, area: "bench", selectedId })).join("") : '<p class="muted">Le riserve arriveranno con pull, scambi e ricompense.</p>';
  }

  function miniPlayer(id, area) {
    return tacticalMiniPlayer(id, { mode: "squad", area });
  }

  function renderSquad() {
    run.phase = "squad";
    global.RunState.save(run);
    const formation = formationById(run.formationId);

    app.innerHTML = `
      <main class="screen">
        ${topbar("La tua squadra")}
        <div class="content">
          <div class="section-head">
            <div><p class="eyebrow">Rosa ${run.roster.length}/${global.SEASON1_CONFIG.maxRoster}</p><h2>Gestione squadra</h2></div>
            <div class="squad-controls">
              <select class="btn" id="formation-select" aria-label="Cambia modulo">
                ${seasonDb.formations.eleven.map((item) => `
                  <option value="${item.id}" ${item.id === run.formationId ? "selected" : ""} ${canUseFormation(item) ? "" : "disabled"}>
                    ${item.name}${canUseFormation(item) ? "" : " · rosa non compatibile"}
                  </option>`).join("")}
              </select>
              <button class="btn ${ui.squadEditMode ? "btn-yellow" : ""}" id="toggle-squad-edit">${ui.squadEditMode ? "Termina modifiche" : "Modifica titolari"}</button>
            </div>
          </div>
          <p class="muted small">${ui.squadEditMode ? "Seleziona un titolare e poi una riserva dello stesso ruolo per scambiarli." : "Seleziona un giocatore per aprire la scheda con statistiche, overall e potenziale."}</p>
          <div class="squad-layout">
            ${squadPitchMarkup()}
            <aside class="panel">
              <h3>Riserve ${run.bench.length}/4</h3>
              <div class="bench-list">
                ${benchMarkup()}
              </div>
              <div class="button-row" style="margin-top:18px">
                <button class="btn btn-yellow" id="go-map">${run.currentZone ? "Torna al percorso" : "Inizia il percorso"}</button>
              </div>
            </aside>
          </div>
        </div>
        ${bottomNav("squad")}
      </main>`;

    document.getElementById("formation-select").addEventListener("change", (event) => {
      const next = formationById(event.target.value);
      if (!canUseFormation(next)) return toast("La rosa non copre tutti i ruoli del modulo");
      autoArrangeFormation(next);
      global.RunState.save(run);
      toast(`Modulo cambiato in ${next.name}`);
      renderSquad();
    });

    document.querySelectorAll("[data-squad-player]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.squadEditMode
          ? handleSquadSelection(button.dataset.squadPlayer)
          : showPlayerDetails(button.dataset.squadPlayer);
      });
    });
    document.getElementById("toggle-squad-edit").addEventListener("click", () => {
      ui.squadEditMode = !ui.squadEditMode;
      ui.selectedSquadPlayerId = null;
      renderSquad();
    });
    document.getElementById("go-map").addEventListener("click", () => {
      ensureCurrentZone();
      run.phase = "map";
      global.RunState.save(run);
      renderMap();
    });
    bindBottomNav();
  }

  function handleSquadSelection(playerId) {
    const selected = ui.selectedSquadPlayerId;
    if (!selected) {
      ui.selectedSquadPlayerId = String(playerId);
      return renderSquad();
    }
    if (selected === String(playerId)) {
      ui.selectedSquadPlayerId = null;
      return renderSquad();
    }

    const selectedInLineup = run.lineup.includes(selected);
    const clickedInLineup = run.lineup.includes(String(playerId));
    if (selectedInLineup === clickedInLineup) {
      ui.selectedSquadPlayerId = String(playerId);
      return renderSquad();
    }

    const starterId = selectedInLineup ? selected : String(playerId);
    const benchId = selectedInLineup ? String(playerId) : selected;
    const starter = sourcePlayer(rosterEntry(starterId));
    const reserve = sourcePlayer(rosterEntry(benchId));
    if (starter.position !== reserve.position) {
      ui.selectedSquadPlayerId = null;
      toast("Il sostituto deve avere lo stesso ruolo del titolare");
      return renderSquad();
    }
    run.lineup[run.lineup.indexOf(starterId)] = benchId;
    run.bench[run.bench.indexOf(benchId)] = starterId;
    ui.selectedSquadPlayerId = null;
    global.RunState.save(run);
    toast(`${reserve.name} entra tra i titolari`);
    renderSquad();
  }

  function ensureCurrentZone() {
    if (run.currentZone && run.currentZone.bossIndex === run.bossIndex) return;
    const boss = seasonDb.bossOrder[run.bossIndex];
    if (!boss) return;
    run.currentZone = global.MapEngine.generate(run, boss);
    run.phase = "map";
    global.RunState.createCheckpoint(run);
  }

  function nodePositions(zone) {
    const maxLayer = Math.max(...zone.nodes.map((node) => node.layer));
    const result = {};
    for (const node of zone.nodes) {
      const layerNodes = zone.nodes.filter((candidate) => candidate.layer === node.layer);
      const index = layerNodes.findIndex((candidate) => candidate.id === node.id);
      result[node.id] = {
        x: ((index + 1) / (layerNodes.length + 1)) * 1000,
        y: 930 - (node.layer / maxLayer) * 860,
      };
    }
    return result;
  }

  function renderMap() {
    ensureCurrentZone();
    if (!run.currentZone) return renderSeasonComplete();
    run.phase = "map";
    global.RunState.save(run);
    const zone = run.currentZone;
    const boss = seasonDb.bossOrder[run.bossIndex];
    const positions = nodePositions(zone);
    const reachable = new Set(global.MapEngine.reachableNodeIds(zone));
    const completed = new Set(zone.completedNodeIds);
    const labels = global.SEASON1_CONFIG.nodeLabels;

    app.innerHTML = `
      <main class="screen">
        ${topbar(`Verso ${boss.teamName}`)}
        <div class="content">
          <div class="section-head">
            <div><p class="eyebrow">Boss ${run.bossIndex + 1} di ${seasonDb.bossOrder.length}</p><h2>Scegli il percorso</h2></div>
            <button class="btn" data-nav="squad">Modifica squadra</button>
          </div>
          <p class="muted">Puoi selezionare soltanto uno dei nodi collegati alla tua posizione attuale.</p>
          <div class="map-wrap" id="map-scroll">
            <div class="route-map">
              <svg class="map-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                ${zone.edges.map(([from, to]) => `<line x1="${positions[from].x}" y1="${positions[from].y}" x2="${positions[to].x}" y2="${positions[to].y}" />`).join("")}
              </svg>
              ${zone.nodes.map((node) => {
                const meta = labels[node.type];
                const stateClass = completed.has(node.id) ? "completed" : reachable.has(node.id) ? "reachable" : "locked";
                return `
                  <button class="map-node ${stateClass}" data-node-id="${node.id}" ${reachable.has(node.id) ? "" : "disabled"}
                    style="left:${positions[node.id].x / 10}%;top:${positions[node.id].y / 10}%;--node-color:${meta.color}">
                    <span class="node-icon">${meta.icon}</span>
                    <span class="node-label">${node.type === "boss" ? escapeHtml(boss.teamName) : meta.label}</span>
                  </button>`;
              }).join("")}
            </div>
          </div>
        </div>
        ${bottomNav("map")}
      </main>`;

    document.querySelectorAll("[data-node-id]").forEach((button) => {
      button.addEventListener("click", () => enterNode(button.dataset.nodeId));
    });
    bindBottomNav();
    requestAnimationFrame(() => {
      const scroll = document.getElementById("map-scroll");
      if (zone.path.length <= 1 && scroll && !window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
      if (scroll && window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = 0;
    });
  }

  function enterNode(nodeId) {
    let node;
    try {
      node = global.MapEngine.selectNode(run.currentZone, nodeId);
    } catch (error) {
      return toast(error.message);
    }
    global.RunState.save(run);

    if (node.type === "random") return resolveRandomNode(node);
    dispatchNode(node, node.type);
  }

  function dispatchNode(node, eventType) {
    if (eventType === "five_v_five") {
      const status = fiveVFiveStatus();
      if (!status.valid) {
        toast("Completa la Formazione 5v5 prima di avviare la partitella.");
        run.phase = "five";
        global.RunState.save(run);
        return renderFiveVFive();
      }
      ui.match = { nodeId: node.id, type: eventType };
      run.phase = "match";
      global.RunState.save(run);
      return renderMatch();
    }
    if (eventType === "boss") {
      ui.match = { nodeId: node.id, type: eventType };
      run.phase = "match";
      global.RunState.save(run);
      return renderMatch();
    }
    if (eventType.startsWith("pull_")) return openPull(node, eventType);
    if (eventType === "item") return resolveItemNode(node);
    if (eventType === "trade") return resolveTradeNode(node);
  }

  function finishNonMatchNode(node, message) {
    global.MapEngine.completeNode(run.currentZone, node.id);
    run.phase = "map";
    global.RunState.save(run);
    closeModal();
    toast(message);
    renderMap();
  }

  function resolveItemNode(node) {
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}`);
    const candidates = weightedItemCandidates(random, 3);
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Nodo oggetto</p><h2>Scegli un oggetto</h2><p class="muted">Inventario ${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</p></div></div>
      <div class="item-grid">
        ${candidates.map((item) => itemChoiceCard(item)).join("")}
      </div>
      <div class="button-row" style="margin-top:18px"><button class="btn btn-ghost" id="skip-item">Rinuncia</button></div>`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-item-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = candidates.find((candidate) => candidate.id === button.dataset.itemChoice);
        receiveItem(item, node, () => finishNonMatchNode(node, `Hai ottenuto: ${item.name}`));
      });
    });
    document.getElementById("skip-item").addEventListener("click", () => finishNonMatchNode(node, "Hai rinunciato all'oggetto"));
  }

  function resolveRandomNode(node) {
    const revealedType = global.MapEngine.resolveRandomNodeType(run, node);
    global.RunState.save(run);
    const meta = global.SEASON1_CONFIG.nodeLabels[revealedType];
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Punto interrogativo</p><h2>${escapeHtml(meta.label)}</h2></div></div>
      <div class="hidden-reveal" style="--reveal-color:${meta.color}"><span>${meta.icon}</span></div>
      <p class="muted">Il contenuto è stato rivelato e non cambierà ricaricando la pagina.</p>
      <button class="btn btn-primary" id="open-hidden-event">Continua</button>`,
      { closeable: false }
    );
    document.getElementById("open-hidden-event").addEventListener("click", () => {
      closeModal();
      dispatchNode(node, revealedType);
    });
  }

  function resolveTradeNode(node) {
    ui.tradeSelectedPlayerId = ui.tradeSelectedPlayerId && rosterEntry(ui.tradeSelectedPlayerId) ? ui.tradeSelectedPlayerId : null;
    const selected = ui.tradeSelectedPlayerId ? resolvedRosterPlayer(ui.tradeSelectedPlayerId) : null;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Scambio</p><h2>Scegli chi scambiare</h2><p class="muted">Seleziona un titolare dal campo o una riserva. Riceverai un giocatore casuale dello stesso ruolo, con finalOverall uguale o superiore e un livello in più.</p></div></div>
      <div class="trade-squad-layout">
        ${squadPitchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}
        <aside class="panel trade-bench-panel">
          <h3>Riserve</h3>
          <div class="bench-list">${benchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}</div>
        </aside>
      </div>
      <div class="trade-selection-summary ${selected ? "selected" : ""}">
        ${selected ? `<strong>${escapeHtml(selected.name)}</strong><span>${selected.position} · OVR ${selected.overall} · Lv ${selected.displayLevel}</span>` : '<strong>Nessun giocatore selezionato</strong><span>Scegli una card per procedere allo scambio.</span>'}
      </div>
      <div class="button-row" style="margin-top:18px">
        <button class="btn btn-yellow" id="continue-trade" ${selected ? "" : "disabled"}>Procedi allo scambio</button>
        <button class="btn btn-ghost" id="skip-trade">Rinuncia allo scambio</button>
      </div>`,
      { closeable: false, className: "trade-modal", preserveScroll: scrollSnapshot() }
    );
    modalRoot.querySelectorAll("[data-trade-player]").forEach((button) => {
      button.addEventListener("click", () => {
        runKeepingScroll(() => {
          ui.tradeSelectedPlayerId = String(button.dataset.tradePlayer);
          resolveTradeNode(node);
        });
      });
    });
    document.getElementById("continue-trade").addEventListener("click", () => prepareTrade(node, ui.tradeSelectedPlayerId));
    document.getElementById("skip-trade").addEventListener("click", () => {
      ui.tradeSelectedPlayerId = null;
      finishNonMatchNode(node, "Hai rinunciato allo scambio");
    });
  }

  function prepareTrade(node, outgoingId) {
    const outgoingEntry = rosterEntry(outgoingId);
    const outgoingPlayer = sourcePlayer(outgoingEntry);
    const candidates = global.RoguelikeRules.getTradeCandidates({
      outgoingPlayer,
      rosterIds: run.roster.map((entry) => entry.playerId),
      freeAgents: freeAgentsDb.players,
      seasonPlayers: seasonDb.players,
      unlockedTeamIds: run.unlockedTeamIds,
      teams: seasonDb.teams,
    });
    if (!candidates.length) {
      toast(`Nessun ${outgoingPlayer.position} con finalOverall ${outgoingPlayer.finalOverall} o superiore disponibile`);
      return resolveTradeNode(node);
    }
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:trade:${outgoingId}`);
    const incoming = candidates[Math.floor(random() * candidates.length)];
    const nextLevel = Math.min(20, Number(outgoingEntry.level || 0) + 1);
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Conferma scambio</p><h2>${escapeHtml(outgoingPlayer.name)}</h2></div></div>
      <p>Riceverai un <strong>${outgoingPlayer.position}</strong> casuale con finalOverall almeno <strong>${outgoingPlayer.finalOverall}</strong>, al livello <strong>${nextLevel}</strong>.</p>
      ${outgoingEntry.equippedItem ? `<p class="muted">${escapeHtml(outgoingEntry.equippedItem.name)} tornerà nell'inventario.</p>` : ""}
      <div class="button-row"><button class="btn btn-danger" id="confirm-trade">Conferma</button><button class="btn" id="back-trade">Torna indietro</button></div>`,
      { closeable: false }
    );
    document.getElementById("back-trade").addEventListener("click", () => resolveTradeNode(node));
    document.getElementById("confirm-trade").addEventListener("click", () => {
      const execute = () => executeTrade(node, outgoingEntry, incoming, nextLevel);
      if (outgoingEntry.equippedItem && run.inventory.length >= global.SEASON1_CONFIG.maxInventory) {
        return chooseInventoryDiscard("Libera uno spazio per recuperare l'oggetto equipaggiato", execute, () => resolveTradeNode(node));
      }
      execute();
    });
  }

  function executeTrade(node, outgoingEntry, incoming, nextLevel) {
    const outgoingId = String(outgoingEntry.playerId);
    const incomingId = String(incoming.player.playerId);
    const rosterIndex = run.roster.findIndex((entry) => String(entry.playerId) === outgoingId);
    if (outgoingEntry.equippedItem) run.inventory.push(outgoingEntry.equippedItem);
    run.roster[rosterIndex] = { playerId: incomingId, source: incoming.source, level: nextLevel, equippedItem: null };
    run.lineup = run.lineup.map((id) => String(id) === outgoingId ? incomingId : String(id));
    run.bench = run.bench.map((id) => String(id) === outgoingId ? incomingId : String(id));
    global.FiveVFive.removeUnavailable(run);
    ui.tradeSelectedPlayerId = null;
    global.RunState.save(run);
    showTradeResult(node, incoming, nextLevel);
  }

  function showTradeResult(node, incoming, nextLevel) {
    const database = incoming.source === "season1" ? seasonDb : freeAgentsDb;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Scambio completato</p><h2>È arrivato ${escapeHtml(incoming.player.name)}</h2></div></div>
      <div class="trade-result-card">${playerCard(incoming.player, { level: nextLevel, database })}</div>
      <div class="button-row"><button class="btn" id="trade-player-detail">Apri scheda</button><button class="btn btn-primary" id="finish-trade">Continua</button></div>`,
      { closeable: false }
    );
    document.getElementById("trade-player-detail").addEventListener("click", () => {
      showPlayerDetails(incoming.player.playerId, () => showTradeResult(node, incoming, nextLevel));
    });
    document.getElementById("finish-trade").addEventListener("click", () => finishNonMatchNode(node, `${incoming.player.name} entra nella rosa`));
  }

  function itemChoiceCard(item) {
    return `<button class="item-card" data-item-choice="${item.id}">${itemIcon(item)}<span class="item-kind">${item.kind === "equipment" ? "Equipaggiamento" : "Consumabile"}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></button>`;
  }

  function weightedItemCandidates(random, count) {
    const pool = global.SEASON1_CONFIG.itemPool.slice();
    const result = [];
    while (result.length < count && pool.length) {
      let cursor = random() * pool.reduce((sum, item) => sum + Number(item.weight || 10), 0);
      let selectedIndex = 0;
      for (let index = 0; index < pool.length; index += 1) {
        cursor -= Number(pool[index].weight || 10);
        if (cursor <= 0) { selectedIndex = index; break; }
      }
      result.push(pool.splice(selectedIndex, 1)[0]);
    }
    return result;
  }

  function receiveItem(item, node, done) {
    const add = () => {
      run.inventory.push(makeItemInstance(item, node.id));
      global.RunState.save(run);
      done();
    };
    if (run.inventory.length < global.SEASON1_CONFIG.maxInventory) return add();
    chooseInventoryDiscard("Inventario pieno: scegli un oggetto da eliminare", add, () => resolveItemNode(node));
  }

  function chooseInventoryDiscard(title, onDiscard, onCancel) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Inventario ${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</p><h2>${escapeHtml(title)}</h2></div></div>
      <div class="item-grid">${run.inventory.map((item) => `<button class="item-card danger-card" data-discard-item="${item.instanceId}"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></button>`).join("")}</div>
      <div class="button-row" style="margin-top:18px"><button class="btn" id="cancel-discard">Annulla</button></div>`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-discard-item]").forEach((button) => {
      button.addEventListener("click", () => {
        removeInventoryItem(button.dataset.discardItem);
        onDiscard();
      });
    });
    document.getElementById("cancel-discard").addEventListener("click", onCancel);
  }

  function previousBossLevel() {
    return global.RoguelikeRules.unlockedPullLevel(seasonDb, run.bossIndex);
  }

  function pullPool(type) {
    if (type === "pull_free_agents") return { players: freeAgentsDb.players, source: "free_agents", database: freeAgentsDb };
    if (type === "pull_unlocked_teams") {
      const ids = new Set(
        seasonDb.teams
          .filter((team) => run.unlockedTeamIds.includes(String(team.teamId)))
          .flatMap((team) => team.playerIds.map(String))
      );
      return { players: seasonDb.players.filter((player) => ids.has(String(player.playerId))), source: "season1", database: seasonDb };
    }
    const legendaryById = new Map();
    const legendarySources = new Map();
    freeAgentsDb.players
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(player.category))
      .forEach((player) => {
        legendaryById.set(String(player.playerId), player);
        legendarySources.set(String(player.playerId), "free_agents");
      });
    seasonDb.players
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(player.category))
      .forEach((player) => {
        if (!legendaryById.has(String(player.playerId))) {
          legendaryById.set(String(player.playerId), player);
          legendarySources.set(String(player.playerId), "season1");
        }
      });
    return {
      players: [...legendaryById.values()],
      source: "mixed",
      sourceForPlayer: (player) => legendarySources.get(String(player.playerId)),
      database: freeAgentsDb,
    };
  }

  function selectWeightedCandidates(available, random, luckyApplied, originalCandidates = null) {
    if (!luckyApplied) return global.DraftEngine.shuffle(available, random).slice(0, 3);
    if (originalCandidates?.length) {
      const result = [];
      const remaining = global.DraftEngine.shuffle(available, random);
      originalCandidates.forEach((original) => {
        const minRank = Number(global.SEASON1_CONFIG.categoryRanks[improvedCategory(original.category)] || 0);
        const index = remaining.findIndex((player) => Number(global.SEASON1_CONFIG.categoryRanks[player.category] || 0) >= minRank);
        if (index >= 0) result.push(remaining.splice(index, 1)[0]);
      });
      return result.concat(remaining.filter((player) => !result.includes(player)).slice(0, 3 - result.length)).slice(0, 3);
    }
    const result = [];
    const remaining = available.slice();
    while (result.length < 3 && remaining.length) {
      const weights = remaining.map((player) =>
        1 + Number(global.SEASON1_CONFIG.categoryRanks[player.category] || 0) * global.SEASON1_CONFIG.luckyCharmWeightPerRank
      );
      let cursor = random() * weights.reduce((sum, weight) => sum + weight, 0);
      let selectedIndex = 0;
      for (let index = 0; index < weights.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) { selectedIndex = index; break; }
      }
      result.push(remaining.splice(selectedIndex, 1)[0]);
    }
    return result;
  }

  function pullCandidates(pool, node, luckyApplied) {
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const excluded = new Set(node.pullState.excludedCandidateIds || []);
    const available = pool.players.filter((player) => !owned.has(String(player.playerId)) && !excluded.has(String(player.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:pull:${node.pullState.rerolls}`);
    const baseRandom = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:pull:${node.pullState.rerolls}:base`);
    const originalCandidates = luckyApplied ? global.DraftEngine.shuffle(available, baseRandom).slice(0, 3) : null;
    return selectWeightedCandidates(available, random, luckyApplied, originalCandidates);
  }

  function openPull(node, pullType = node.type) {
    const pool = pullPool(pullType);
    if (!node.pullState) {
      const luckyEligible = ["pull_free_agents", "pull_unlocked_teams"].includes(pullType);
      const luckyApplied = luckyEligible && Number(run.effects.luckyPulls || 0) > 0;
      if (luckyApplied) run.effects.luckyPulls -= 1;
      node.pullState = { pullType, rerolls: 0, excludedCandidateIds: [], luckyApplied };
    }
    const candidates = pullCandidates(pool, node, node.pullState.luckyApplied);
    const level = previousBossLevel();
    const scoutToken = run.inventory.find((item) => item.effect === "pull_reroll");
    const legendaryPull = pullType === "pull_legendary";
    const rerollPull = () => {
      if (legendaryPull) return toast("Il Gettone scout non può essere utilizzato nelle pull leggendarie.");
      removeInventoryItem(scoutToken.instanceId);
      node.pullState.excludedCandidateIds.push(...candidates.map((player) => String(player.playerId)));
      node.pullState.rerolls += 1;
      global.RunState.save(run);
      openPull(node, pullType);
    };
    showPlayerOffer({
      title: global.SEASON1_CONFIG.nodeLabels[pullType].label,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}${node.pullState.luckyApplied ? " · Portafortuna attivo" : ""}`,
      candidates,
      source: pool.source,
      sourceForPlayer: pool.sourceForPlayer,
      database: pool.database,
      level,
      allowSkip: true,
      onReroll: scoutToken ? rerollPull : null,
      rerollDisabled: Boolean(scoutToken && legendaryPull),
      rerollDisabledMessage: legendaryPull ? "Il Gettone scout non può essere utilizzato nelle pull leggendarie." : "",
      onPick: (player) => {
        const playerSource = pool.sourceForPlayer ? pool.sourceForPlayer(player) : pool.source;
        recruitPlayer(player, playerSource, level, (added) => {
          finishNonMatchNode(node, added ? `${player.name} entra nella rosa` : "Hai rinunciato al nuovo giocatore");
        });
      },
      onSkip: () => finishNonMatchNode(node, "Hai rinunciato al pull"),
    });
  }

  function showPullConfirmation(options, player) {
    let confirmed = false;
    const playerSource = options.sourceForPlayer ? options.sourceForPlayer(player) : options.source;
    const playerDatabase = playerSource === "season1" ? seasonDb : options.database;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Conferma scelta</p><h2>Vuoi scegliere ${escapeHtml(player.name)}?</h2><p class="muted">La pull non verrà consumata finché non confermi.</p></div></div>
      <div class="trade-result-card">${playerCard(player, { level: options.level, database: playerDatabase })}</div>
      <div class="button-row">
        <button class="btn btn-primary" id="confirm-pull-pick">Sì</button>
        <button class="btn" id="cancel-pull-pick">No</button>
        <button class="btn btn-yellow" id="detail-pull-pick">Apri scheda</button>
      </div>`,
      { closeable: false }
    );
    document.getElementById("confirm-pull-pick").focus({ preventScroll: true });
    document.getElementById("confirm-pull-pick").addEventListener("click", (event) => {
      if (confirmed) return;
      confirmed = true;
      event.currentTarget.disabled = true;
      options.onPick(player);
    });
    document.getElementById("cancel-pull-pick").addEventListener("click", () => showPlayerOffer(options));
    document.getElementById("detail-pull-pick").addEventListener("click", () => {
      showPlayerDetailsFor(player, {
        playerId: player.playerId,
        level: options.level,
        database: playerDatabase,
        onClose: () => showPullConfirmation(options, player),
      });
    });
  }

  function showPlayerOffer(options) {
    const rerollButton = options.onReroll
      ? `<button class="btn btn-yellow" id="reroll-offer" ${options.rerollDisabled ? "disabled" : ""}>Usa gettone scout</button>`
      : "";
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Scelta giocatore</p><h2>${escapeHtml(options.title)}</h2><p class="muted">${escapeHtml(options.subtitle)}</p></div></div>
      <div class="candidate-grid">
        ${options.candidates.map((player) => playerCard(player, { button: true, level: options.level, database: options.sourceForPlayer?.(player) === "season1" ? seasonDb : options.database })).join("")}
      </div>
      ${options.rerollDisabledMessage ? `<p class="muted small">${escapeHtml(options.rerollDisabledMessage)}</p>` : ""}
      <div class="button-row" style="margin-top:18px">
        ${rerollButton}
        ${options.allowSkip ? '<button class="btn btn-ghost" id="skip-offer">Rinuncia</button>' : ""}
      </div>`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const player = options.candidates.find((candidate) => String(candidate.playerId) === button.dataset.playerId);
        showPullConfirmation(options, player);
      });
    });
    document.getElementById("reroll-offer")?.addEventListener("click", () => {
      if (options.rerollDisabled) return toast(options.rerollDisabledMessage || "Gettone scout non disponibile");
      options.onReroll();
    });
    document.getElementById("skip-offer")?.addEventListener("click", options.onSkip);
  }

  function recruitPlayer(player, source, level, done, options = {}) {
    const allowCancel = options.allowCancel !== false;
    if (run.roster.length < global.SEASON1_CONFIG.maxRoster) {
      run.roster.push({ playerId: String(player.playerId), source, level, equippedItem: null });
      run.bench.push(String(player.playerId));
      global.RunState.save(run);
      closeModal();
      return done(true);
    }

    const benchPlayers = run.bench.map((id) => resolvedRosterPlayer(id)).filter(Boolean);
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Rosa piena</p><h2>Scegli chi lasciare fuori</h2><p class="muted">${escapeHtml(player.name)} sostituirà una delle quattro riserve.</p></div></div>
      <div class="player-grid">
        ${benchPlayers.map((candidate) => playerCard(sourcePlayer(rosterEntry(candidate.playerId)), { button: true, level: candidate.displayLevel, database: candidate.source === "season1" ? seasonDb : freeAgentsDb })).join("")}
      </div>
      ${allowCancel ? '<div class="button-row" style="margin-top:18px"><button class="btn btn-ghost" id="cancel-recruit">Rinuncia al nuovo giocatore</button></div>' : ""}`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const removeId = String(button.dataset.playerId);
        const removedEntry = rosterEntry(removeId);
        const replace = () => {
          if (removedEntry.equippedItem) run.inventory.push(removedEntry.equippedItem);
          run.roster = run.roster.filter((entry) => String(entry.playerId) !== removeId);
          run.bench = run.bench.filter((id) => String(id) !== removeId);
          run.roster.push({ playerId: String(player.playerId), source, level, equippedItem: null });
          run.bench.push(String(player.playerId));
          global.FiveVFive.removeUnavailable(run);
          global.RunState.save(run);
          closeModal();
          done(true);
        };
        if (removedEntry.equippedItem && run.inventory.length >= global.SEASON1_CONFIG.maxInventory) {
          return chooseInventoryDiscard(
            "Libera uno spazio per recuperare l'oggetto equipaggiato",
            replace,
            () => recruitPlayer(player, source, level, done, options)
          );
        }
        replace();
      });
    });
    document.getElementById("cancel-recruit")?.addEventListener("click", () => {
      closeModal();
      done(false);
    });
  }

  function renderMatch() {
    const boss = seasonDb.bossOrder[run.bossIndex];
    const isBoss = ui.match?.type === "boss";
    app.innerHTML = `
      <main class="screen">
        ${topbar(isBoss ? `Boss · ${boss.teamName}` : "Partita 5v5")}
        <div class="content">
          <section class="panel match-card">
            <p class="eyebrow">Modalità test</p>
            <h2>${isBoss ? "Partita 11v11" : "Partitella 5v5"}</h2>
            <div class="versus">
              <div class="team-block"><div style="font-size:72px">⚡</div><h3>La tua squadra</h3><p>Livello ${run.teamLevel}</p></div>
              <div class="vs-text">VS</div>
              <div class="team-block">
                ${isBoss ? `<img src="${escapeHtml(boss.logoUrl)}" alt="${escapeHtml(boss.teamName)}" />` : '<div style="font-size:72px">⚽</div>'}
                <h3>${isBoss ? escapeHtml(boss.teamName) : "Squadra 5v5"}</h3>
                <p>Livello ${isBoss ? boss.bossLevel : Math.max(0, Math.floor(run.teamLevel))}</p>
              </div>
            </div>
            <p class="muted">Il motore della partita verrà collegato più avanti. Questi pulsanti servono a collaudare vite, progressione e percorso.</p>
            <div class="button-row">
              <button class="btn btn-primary" id="test-win">Segna vittoria</button>
              <button class="btn btn-danger" id="test-loss">Segna sconfitta</button>
            </div>
          </section>
        </div>
      </main>`;
    document.getElementById("test-win").addEventListener("click", winMatch);
    document.getElementById("test-loss").addEventListener("click", loseMatch);
  }

  function addLevels(amount) {
    run.teamLevel = Math.min(20, Number(run.teamLevel) + amount);
    run.roster.forEach((entry) => {
      entry.level = Math.min(20, Number(entry.level || 0) + amount);
    });
  }

  function winMatch() {
    const node = run.currentZone.nodes.find((item) => item.id === ui.match.nodeId);
    if (ui.match.type === "five_v_five") {
      addLevels(0.5);
      global.MapEngine.completeNode(run.currentZone, node.id);
      run.phase = "map";
      ui.match = null;
      global.RunState.save(run);
      toast("Vittoria: tutta la rosa guadagna 0,5 livelli");
      return runKeepingScroll(renderMap);
    }
    addLevels(1);
    global.MapEngine.completeNode(run.currentZone, node.id);
    ui.match = null;
    startBossRewards();
  }

  function loseMatch() {
    ui.match = null;
    global.RunState.restoreAfterLoss(run);
    closeModal();
    if (run.gameOver) return renderGameOver();
    toast(`Sconfitta: resta${run.lives === 1 ? "" : "no"} ${run.lives} vita${run.lives === 1 ? "" : "e"}. Percorso ripristinato.`);
    renderMap();
  }

  function startBossRewards() {
    const boss = seasonDb.bossOrder[run.bossIndex];
    ui.pendingReward = { boss, remaining: 2, excludedIds: [], rerolls: 0, luckyApplied: false };
    global.RunState.save(run);
    showNextBossReward();
  }

  function showNextBossReward() {
    const reward = ui.pendingReward;
    const team = seasonDb.teams.find((candidate) => String(candidate.teamId) === String(reward.boss.teamId));
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.runId}:bossReward:${run.bossIndex}:${reward.remaining}:${reward.rerolls}`);
    const available = team.playerIds
      .map((id) => seasonPlayersById.get(String(id)))
      .filter((player) => player && !owned.has(String(player.playerId)) && !reward.excludedIds.includes(String(player.playerId)));
    const candidates = selectWeightedCandidates(available, random, reward.luckyApplied);
    const level = global.RoguelikeRules.defeatedBossRewardLevel(reward.boss);
    const scoutToken = run.inventory.find((item) => item.effect === "pull_reroll");
    showPlayerOffer({
      title: `Ricompensa ${3 - reward.remaining} di 2 · ${reward.boss.teamName}`,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}${reward.luckyApplied ? " · Portafortuna attivo" : ""}`,
      candidates,
      source: "season1",
      database: seasonDb,
      level,
      allowSkip: true,
      onReroll: scoutToken ? () => {
        removeInventoryItem(scoutToken.instanceId);
        reward.excludedIds.push(...candidates.map((player) => String(player.playerId)));
        reward.rerolls += 1;
        global.RunState.save(run);
        showNextBossReward();
      } : null,
      onPick: (player) => {
        reward.excludedIds.push(String(player.playerId));
        recruitPlayer(player, "season1", level, () => {
          advanceBossReward();
        }, { allowCancel: true });
      },
      onSkip: advanceBossReward,
    });
  }

  function advanceBossReward() {
    const reward = ui.pendingReward;
    reward.remaining -= 1;
    reward.rerolls = 0;
    reward.luckyApplied = false;
    reward.remaining > 0 ? showNextBossReward() : finishBossVictory();
  }

  function finishBossVictory() {
    const boss = ui.pendingReward.boss;
    if (!run.completedBossIds.includes(String(boss.teamId))) run.completedBossIds.push(String(boss.teamId));
    if (!run.unlockedTeamIds.includes(String(boss.teamId))) run.unlockedTeamIds.push(String(boss.teamId));
    run.bossIndex += 1;
    run.currentZone = null;
    ui.pendingReward = null;
    closeModal();
    if (run.bossIndex >= seasonDb.bossOrder.length) {
      run.phase = "complete";
      global.RunState.save(run);
      return renderSeasonComplete();
    }
    ensureCurrentZone();
    global.RunState.createCheckpoint(run);
    toast(`${boss.teamName} sconfitta. Nuovo checkpoint raggiunto!`);
    renderMap();
  }


  function roleBadge(role) {
    const icons = { GK: "▣", DF: "◆", MF: "●", FW: "▲", all: "✦" };
    return `<span class="role-token role-${escapeHtml(role)}"><span>${icons[role] || icons.all}</span>${escapeHtml(role === "all" ? "Tutti" : role)}</span>`;
  }

  function fiveSlotCard(slot, playerId, status) {
    const player = playerId ? resolvedRosterPlayer(playerId) : null;
    const selected = ui.fiveVFiveSelectedSlot === slot.key;
    const missing = !player && !status.valid;
    return `
      <button class="five-slot ${selected ? "selected" : ""} ${missing ? "missing" : ""}" data-five-slot="${escapeHtml(slot.key)}" style="grid-area:${escapeHtml(slot.line)}">
        <span class="five-slot-role">${roleBadge(slot.role)}</span>
        ${player ? `
          <img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
          <strong>${escapeHtml(player.name)}</strong>
          <span class="small muted">${player.position} · Lv ${player.displayLevel}</span>
        ` : `
          <span class="five-empty">+</span>
          <strong>Slot vuoto</strong>
          <span class="small muted">Richiede ${escapeHtml(slot.role)}</span>
        `}
      </button>`;
  }

  function fiveRosterCard(entry, selectedSlot) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const slot = selectedSlot ? global.FiveVFive.formationById(run.fiveVFive.formation).slots.find((item) => item.key === selectedSlot) : null;
    const compatible = !slot || player.position === slot.role;
    const assignedSlot = Object.entries(run.fiveVFive.slots).find(([, id]) => String(id) === String(entry.playerId))?.[0];
    return `
      <button class="five-roster-card ${compatible ? "" : "disabled"} ${assignedSlot ? "assigned" : ""}" data-five-player="${escapeHtml(entry.playerId)}" ${compatible ? "" : "disabled"}>
        <img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
        <span><strong>${escapeHtml(player.name)}</strong><small>${player.position} · OVR ${player.overall} · Lv ${player.displayLevel}${assignedSlot ? ` · ${assignedSlot}` : ""}</small></span>
      </button>`;
  }

  function renderFiveVFive() {
    run.phase = "five";
    ensureRunSchema();
    ensureFiveVFive();
    global.RunState.save(run);
    const status = fiveVFiveStatus();
    const formation = status.formation;
    const selectedSlot = ui.fiveVFiveSelectedSlot && formation.slots.some((slot) => slot.key === ui.fiveVFiveSelectedSlot)
      ? ui.fiveVFiveSelectedSlot
      : formation.slots.find((slot) => !run.fiveVFive.slots[slot.key])?.key || formation.slots[0].key;
    ui.fiveVFiveSelectedSlot = selectedSlot;
    const selectedRole = formation.slots.find((slot) => slot.key === selectedSlot)?.role;
    const filter = ui.fiveVFiveRoleFilter || "all";
    const rosterEntries = run.roster.filter((entry) => {
      const role = fiveRoleForPlayerId(entry.playerId);
      if (filter !== "all" && role !== filter) return false;
      if (selectedRole && filter === "all") return role === selectedRole;
      return true;
    });
    const rows = ["attack", "midfield", "defense", "goal"];
    app.innerHTML = `
      <main class="screen five-screen">
        ${topbar("Formazione 5v5")}
        <div class="content">
          <div class="section-head">
            <div>
              <p class="eyebrow">Partitelle</p>
              <h2>Formazione 5v5</h2>
              <p class="muted">Configura la tua formazione per le partite 5v5 usando i giocatori della rosa.</p>
            </div>
          </div>
          <section class="five-layout">
            <div class="five-main">
              <div class="five-formation-grid">
                ${global.FiveVFive.formations.map((item) => `
                  <button class="five-formation-card ${item.id === formation.id ? "selected" : ""}" data-five-formation="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.summary)}</span>
                  </button>`).join("")}
              </div>
              <div class="five-pitch formation-${escapeHtml(formation.id)}">
                ${rows.map((line) => `<div class="five-pitch-line line-${line}">${formation.slots.filter((slot) => slot.line === line).map((slot) => fiveSlotCard(slot, run.fiveVFive.slots[slot.key], status)).join("")}</div>`).join("")}
              </div>
              <div class="five-validation ${status.valid ? "valid" : "invalid"}">
                <strong>${status.valid ? "Formazione 5v5 pronta" : `Formazione incompleta (${status.assignedCount}/5)`}</strong>
                <p>${status.valid ? "Puoi affrontare i nodi Partita 5v5." : escapeHtml(status.messages[0] || "Completa tutti gli slot rispettando i ruoli.")}</p>
              </div>
              <div class="button-row"><button class="btn btn-yellow" id="save-five" ${status.valid ? "" : "disabled"}>Conferma formazione</button></div>
            </div>
            <aside class="panel five-selector">
              <div class="section-head compact"><div><p class="eyebrow">${escapeHtml(selectedSlot)}</p><h3>Seleziona giocatore</h3><p class="muted small">Scegli un ${escapeHtml(selectedRole)} dalla rosa.</p></div></div>
              <div class="role-filter-bar">
                ${["all", "GK", "DF", "MF", "FW"].map((role) => `<button class="role-filter ${filter === role ? "active" : ""}" data-five-filter="${role}">${roleBadge(role)}</button>`).join("")}
              </div>
              <div class="five-roster-list">
                ${rosterEntries.length ? rosterEntries.map((entry) => fiveRosterCard(entry, selectedSlot)).join("") : '<p class="muted">Nessun giocatore compatibile con questo filtro.</p>'}
              </div>
              <button class="btn btn-ghost" id="clear-five-slot">Svuota slot selezionato</button>
            </aside>
          </section>
        </div>
        ${bottomNav("five")}
      </main>`;

    document.querySelectorAll("[data-five-formation]").forEach((button) => button.addEventListener("click", () => {
      global.FiveVFive.changeFormation(run, button.dataset.fiveFormation, fiveRoleForPlayerId);
      ui.fiveVFiveSelectedSlot = null;
      global.RunState.save(run);
      renderFiveVFive();
    }));
    document.querySelectorAll("[data-five-slot]").forEach((button) => button.addEventListener("click", () => {
      ui.fiveVFiveSelectedSlot = button.dataset.fiveSlot;
      const role = formation.slots.find((slot) => slot.key === ui.fiveVFiveSelectedSlot)?.role;
      ui.fiveVFiveRoleFilter = role || "all";
      renderFiveVFive();
    }));
    document.querySelectorAll("[data-five-filter]").forEach((button) => button.addEventListener("click", () => {
      ui.fiveVFiveRoleFilter = button.dataset.fiveFilter;
      renderFiveVFive();
    }));
    document.querySelectorAll("[data-five-player]").forEach((button) => button.addEventListener("click", () => {
      try {
        global.FiveVFive.assign(run, ui.fiveVFiveSelectedSlot, button.dataset.fivePlayer, fiveRoleForPlayerId);
        global.RunState.save(run);
        toast("Giocatore assegnato alla formazione 5v5");
        renderFiveVFive();
      } catch (error) {
        toast(error.message);
      }
    }));
    document.getElementById("clear-five-slot").addEventListener("click", () => {
      global.FiveVFive.clearSlot(run, ui.fiveVFiveSelectedSlot);
      global.RunState.save(run);
      renderFiveVFive();
    });
    document.getElementById("save-five").addEventListener("click", () => {
      const nextStatus = fiveVFiveStatus();
      if (!nextStatus.valid) return toast("Completa tutti e cinque gli slot prima di salvare.");
      global.RunState.save(run);
      toast("Formazione 5v5 salvata");
    });
    bindBottomNav();
  }

  function renderInventory() {
    ensureRunSchema();
    const equipped = run.roster
      .filter((entry) => entry.equippedItem)
      .map((entry) => ({ entry, player: sourcePlayer(entry), resolved: resolvedRosterPlayer(entry.playerId), item: entry.equippedItem }));
    app.innerHTML = `
      <main class="screen">
        ${topbar("Oggetti")}
        <div class="content">
          <div class="section-head"><div><p class="eyebrow">Inventario ${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</p><h2>Oggetti raccolti</h2></div></div>
          <div class="item-grid">
            ${run.inventory.length ? run.inventory.map((item) => inventoryItemCard(item)).join("") : '<p class="muted">Non hai ancora raccolto oggetti.</p>'}
          </div>
          <div class="section-head" style="margin-top:30px"><div><p class="eyebrow">Equipaggiati</p><h2>Oggetti dei giocatori</h2></div></div>
          <div class="item-grid">
            ${equipped.length ? equipped.map(({ entry, player, resolved, item }) => `
              <article class="item-card equipped-summary static-item">${itemIcon(item)}<span class="item-kind">${escapeHtml(player.name)}</span><strong>${escapeHtml(item.name)}</strong><div class="equipped-owner"><img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" /><span>${escapeHtml(player.name)} · ${escapeHtml(player.position)}</span></div><p>${escapeHtml(item.description)} ${escapeHtml(item.stat)}: ${resolved.baseStats[item.stat]} → <strong>${resolved.stats[item.stat]}</strong></p><button class="btn btn-ghost" data-unequip-player="${entry.playerId}">Rimuovi</button></article>`).join("") : '<p class="muted">Nessun giocatore ha un oggetto equipaggiato.</p>'}
          </div>
        </div>
        ${bottomNav("inventory")}
      </main>`;
    document.querySelectorAll("[data-use-item]").forEach((button) => button.addEventListener("click", () => useInventoryItem(button.dataset.useItem)));
    document.querySelectorAll("[data-equip-item]").forEach((button) => button.addEventListener("click", () => chooseEquipmentPlayer(button.dataset.equipItem)));
    document.querySelectorAll("[data-unequip-player]").forEach((button) => button.addEventListener("click", () => unequipPlayerItem(button.dataset.unequipPlayer)));
    bindBottomNav();
  }

  function inventoryItemCard(item) {
    const action = item.kind === "equipment"
      ? `<button class="btn btn-primary" data-equip-item="${item.instanceId}">Assegna</button>`
      : item.effect === "pull_reroll"
        ? '<span class="muted small">Utilizzabile durante una pull</span>'
        : `<button class="btn btn-primary" data-use-item="${item.instanceId}">Usa</button>`;
    return `<article class="item-card static-item">${itemIcon(item)}<span class="item-kind">${item.kind === "equipment" ? "Equipaggiamento" : "Consumabile"}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p>${action}</article>`;
  }

  function useInventoryItem(instanceId) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    if (item.effect === "player_level") return choosePlayerForConsumable(item);
    if (item.effect === "team_level") {
      addLevels(Number(item.amount || 0));
      removeInventoryItem(instanceId);
      global.RunState.save(run);
      toast("Tutta la rosa guadagna 0,5 livello");
      return renderInventory();
    }
    if (item.effect === "restore_life") {
      if (run.lives >= global.SEASON1_CONFIG.startingLives) return toast("Hai già tutte le vite");
      run.lives = Math.min(global.SEASON1_CONFIG.startingLives, run.lives + Number(item.amount || 1));
      removeInventoryItem(instanceId);
      global.RunState.save(run);
      toast("Hai recuperato una vita");
      return renderInventory();
    }
    if (item.effect === "lucky_pull") {
      run.effects.luckyPulls += Number(item.amount || 1);
      removeInventoryItem(instanceId);
      global.RunState.save(run);
      toast("Portafortuna attivo sulla prossima pull");
      return renderInventory();
    }
  }

  function choosePlayerForConsumable(item) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>Scegli un giocatore</h2></div></div>
      <div class="player-grid">${run.roster.map((entry) => playerCard(sourcePlayer(entry), { button: true, level: entry.level, database: entry.source === "season1" ? seasonDb : freeAgentsDb })).join("")}</div>`,
      { closeable: true }
    );
    modalRoot.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = rosterEntry(button.dataset.playerId);
        entry.level = Math.min(20, Number(entry.level || 0) + Number(item.amount || 1));
        removeInventoryItem(item.instanceId);
        global.RunState.save(run);
        closeModal();
        toast(`${sourcePlayer(entry).name} sale al livello ${entry.level}`);
        renderInventory();
      });
    });
  }

  function chooseEquipmentPlayer(instanceId) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>Assegna a un giocatore</h2><p class="muted">Scegli dalla formazione attuale: titolari sul campo e riserve separate. Non puoi modificare modulo o rosa da qui.</p></div></div>
      <div class="item-assignment-layout">
        ${squadPitchMarkup({ mode: "equip" })}
        <aside class="panel"><h3>Riserve ${run.bench.length}/4</h3><div class="bench-list">${benchMarkup({ mode: "equip" })}</div></aside>
      </div>`,
      { closeable: true, className: "item-assignment-modal" }
    );
    modalRoot.querySelectorAll("[data-equip-player]").forEach((button) => {
      button.addEventListener("click", () => handleEquipmentTarget(instanceId, button.dataset.equipPlayer));
    });
  }

  function handleEquipmentTarget(instanceId, playerId) {
    const entry = rosterEntry(playerId);
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!entry || !item) return;
    if (entry.equippedItem) {
      const current = entry.equippedItem;
      const player = sourcePlayer(entry);
      return openModal(`
        <div class="modal-head"><div><p class="eyebrow">Sostituzione oggetto</p><h2>${escapeHtml(player.name)} ha già equipaggiato ${escapeHtml(current.name)}.</h2><p class="muted">Vuoi sostituirlo con ${escapeHtml(item.name)}?</p></div></div>
        <div class="button-row"><button class="btn btn-primary" id="confirm-equip-replace">Conferma sostituzione</button><button class="btn" id="cancel-equip-replace">Annulla</button></div>`,
        { closeable: false }
      ), document.getElementById("confirm-equip-replace").addEventListener("click", () => equipItemToEntry(instanceId, entry)), document.getElementById("cancel-equip-replace").addEventListener("click", () => chooseEquipmentPlayer(instanceId));
    }
    equipItemToEntry(instanceId, entry);
  }

  function equipItemToEntry(instanceId, entry) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    const newEquipment = removeInventoryItem(instanceId);
    if (entry.equippedItem) run.inventory.push(entry.equippedItem);
    entry.equippedItem = newEquipment;
    global.RunState.save(run);
    closeModal();
    toast(`${item.name} assegnato a ${sourcePlayer(entry).name}`);
    renderInventory();
  }

  function unequipPlayerItem(playerId, options = {}) {
    const entry = rosterEntry(playerId);
    if (!entry?.equippedItem) return;
    if (run.inventory.length >= global.SEASON1_CONFIG.maxInventory) return toast("Inventario pieno: libera prima uno spazio");
    run.inventory.push(entry.equippedItem);
    entry.equippedItem = null;
    global.RunState.save(run);
    toast("Oggetto riportato nell'inventario");
    (options.render || renderInventory)();
  }

  function renderGameOver() {
    app.innerHTML = `
      <main class="gameover-screen">
        <div><p class="eyebrow">0 vite rimaste</p><h1>Run terminata</h1><p class="muted">Per riprovare devi ricominciare dalla scelta del modulo.</p>
        <div class="button-row"><button class="btn btn-yellow" id="restart-run">Nuova run</button><button class="btn" id="home">Menu</button></div></div>
      </main>`;
    document.getElementById("restart-run").addEventListener("click", () => {
      run = global.RunState.createRun();
      global.RunState.save(run);
      renderFormationChoice();
    });
    document.getElementById("home").addEventListener("click", renderHome);
  }

  function renderSeasonComplete() {
    app.innerHTML = `
      <main class="hero-screen"><div><p class="eyebrow">Season 1 completata</p><h1>Campioni!</h1><p class="muted">Hai sconfitto tutti i boss della prima stagione.</p><button class="btn btn-yellow" id="home">Torna al menu</button></div></main>`;
    document.getElementById("home").addEventListener("click", renderHome);
  }

  function showLoadError(error) {
    console.error(error);
    app.innerHTML = `
      <main class="hero-screen"><div><p class="eyebrow">Caricamento non riuscito</p><h2>Apri il progetto tramite un server locale</h2>
      <p class="muted">I browser bloccano i database JSON quando index.html viene aperto direttamente. Usa Live Server oppure il file AVVIA_GIOCO.bat.</p>
      <pre class="panel">${escapeHtml(error.message)}</pre></div></main>`;
  }

  async function init() {
    try {
      const [seasonResponse, freeAgentsResponse, visualsResponse] = await Promise.all([
        fetch("data/IE1_season_compact.json"),
        fetch("data/FREE_AGENTS_compact.json"),
        fetch("data/PLAYER_VISUALS.json"),
      ]);
      if (!seasonResponse.ok || !freeAgentsResponse.ok || !visualsResponse.ok) throw new Error("Database non raggiungibili");
      const visualsDb = await visualsResponse.json();
      [seasonDb, freeAgentsDb] = await Promise.all([seasonResponse.json(), freeAgentsResponse.json()]);
      freeAgentsById = new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player]));
      seasonPlayersById = new Map(seasonDb.players.map((player) => [String(player.playerId), player]));
      seasonTeamsById = new Map((seasonDb.teams || []).map((team) => [String(team.teamId ?? team.id), team]));
      playerVisualsById = new Map(Object.entries(visualsDb.players || {}));
      renderHome();
    } catch (error) {
      showLoadError(error);
    }
  }

  init();
})(globalThis);
