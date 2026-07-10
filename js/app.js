(function (global) {
  "use strict";

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  let seasonDb = null;
  let freeAgentsDb = null;
  let freeAgentsById = new Map();
  let seasonPlayersById = new Map();
  let run = null;
  const ui = {
    selectedSquadPlayerId: null,
    activeTab: "map",
    match: null,
    pendingReward: null,
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

  function openModal(content, { closeable = true } = {}) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal">
          ${closeable ? '<button class="modal-close" data-close-modal aria-label="Chiudi">✕</button>' : ""}
          ${content}
        </section>
      </div>`;
    modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
  }

  function formationById(id) {
    return seasonDb.formations.eleven.find((formation) => formation.id === id);
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
    return { ...resolved, displayLevel: Number(entry.level || 0), source: entry.source };
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

  function bottomNav(active) {
    if (!run || !run.roster.length) return "";
    return `
      <nav class="bottom-nav">
        <button data-nav="map" class="${active === "map" ? "active" : ""}">Percorso</button>
        <button data-nav="squad" class="${active === "squad" ? "active" : ""}">Squadra</button>
        <button data-nav="inventory" class="${active === "inventory" ? "active" : ""}">Oggetti</button>
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
        } else {
          renderInventory();
        }
      });
    });
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
      <${tag} class="player-card ${options.selected ? "selected" : ""}" ${attributes}>
        <img class="player-portrait" src="${escapeHtml(player.portraitUrl)}" alt="${escapeHtml(player.name)}" loading="lazy" />
        <div class="player-info">
          <div class="player-title">
            <strong>${escapeHtml(player.name)}</strong>
            <span class="overall">${resolved.overall}</span>
          </div>
          <div class="player-meta">
            <span class="role-chip">${escapeHtml(player.position)}</span>
            <span>${escapeHtml(player.element || player.type)}</span>
            <span>${escapeHtml(player.category)}</span>
            <span>Lv ${escapeHtml(level)}</span>
          </div>
        </div>
      </${tag}>`;
  }

  function renderHome() {
    run = global.RunState.load();
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

  function miniPlayer(id, area) {
    const player = resolvedRosterPlayer(id);
    if (!player) return "";
    const selected = ui.selectedSquadPlayerId === String(id);
    return `
      <button class="mini-player ${selected ? "selected" : ""}" data-squad-player="${escapeHtml(id)}" data-area="${area}">
        <img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
        <strong>${escapeHtml(player.name)}</strong>
        <span class="small muted">${player.position} · ${player.overall} · Lv ${player.displayLevel}</span>
      </button>`;
  }

  function renderSquad() {
    run.phase = "squad";
    global.RunState.save(run);
    const formation = formationById(run.formationId);
    const rows = ["FW", "MF", "DF", "GK"].map((role) => ({
      role,
      ids: run.lineup.filter((id) => sourcePlayer(rosterEntry(id)).position === role),
    }));

    app.innerHTML = `
      <main class="screen">
        ${topbar("La tua squadra")}
        <div class="content">
          <div class="section-head">
            <div><p class="eyebrow">Rosa ${run.roster.length}/${global.SEASON1_CONFIG.maxRoster}</p><h2>Gestione squadra</h2></div>
            <select class="btn" id="formation-select" aria-label="Cambia modulo">
              ${seasonDb.formations.eleven.map((item) => `
                <option value="${item.id}" ${item.id === run.formationId ? "selected" : ""} ${canUseFormation(item) ? "" : "disabled"}>
                  ${item.name}${canUseFormation(item) ? "" : " · rosa non compatibile"}
                </option>`).join("")}
            </select>
          </div>
          <p class="muted small">Seleziona un titolare e poi una riserva dello stesso ruolo per scambiarli. Non sono previste sostituzioni durante la partita.</p>
          <div class="squad-layout">
            <section class="pitch">
              ${rows.map((row) => `<div class="pitch-row">${row.ids.map((id) => miniPlayer(id, "lineup")).join("")}</div>`).join("")}
            </section>
            <aside class="panel">
              <h3>Riserve ${run.bench.length}/4</h3>
              <div class="bench-list">
                ${run.bench.length ? run.bench.map((id) => miniPlayer(id, "bench")).join("") : '<p class="muted">Le riserve arriveranno con pull, scambi e ricompense.</p>'}
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
      button.addEventListener("click", () => handleSquadSelection(button.dataset.squadPlayer));
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
      if (zone.path.length <= 1 && scroll) scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
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

    if (node.type === "five_v_five" || node.type === "boss") {
      ui.match = { nodeId, type: node.type };
      run.phase = "match";
      global.RunState.save(run);
      return renderMatch();
    }
    if (node.type.startsWith("pull_")) return openPull(node);
    if (node.type === "item") return resolveItemNode(node);
    if (node.type === "random") return resolveRandomNode(node);
    if (node.type === "trade") return resolveTradeNode(node);
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
    const pool = global.SEASON1_CONFIG.itemPool;
    const item = pool[Math.floor(random() * pool.length)];
    run.inventory.push({ ...item, instanceId: `${item.id}_${Date.now()}` });
    finishNonMatchNode(node, `Hai ottenuto: ${item.name}`);
  }

  function resolveRandomNode(node) {
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:random`);
    if (random() < 0.55) {
      const item = global.SEASON1_CONFIG.itemPool[Math.floor(random() * global.SEASON1_CONFIG.itemPool.length)];
      run.inventory.push({ ...item, instanceId: `${item.id}_${Date.now()}` });
      finishNonMatchNode(node, `Evento fortunato: ${item.name}`);
    } else {
      finishNonMatchNode(node, "L'evento non ha prodotto alcun effetto");
    }
  }

  function resolveTradeNode(node) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Scambio</p><h2>Scambio dello stesso ruolo</h2></div></div>
      <p>Il sistema completo degli scambi verrà bilanciato nel prossimo passaggio. Per ora puoi proseguire senza modificare la rosa.</p>
      <button class="btn btn-primary" id="finish-trade">Continua</button>`, { closeable: false });
    document.getElementById("finish-trade").addEventListener("click", () => finishNonMatchNode(node, "Nodo scambio completato"));
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
    return {
      players: freeAgentsDb.players.filter((player) => ["Elite", "Forte"].includes(player.category)),
      source: "free_agents",
      database: freeAgentsDb,
    };
  }

  function openPull(node) {
    const pool = pullPool(node.type);
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:pull`);
    const candidates = global.DraftEngine.shuffle(
      pool.players.filter((player) => !owned.has(String(player.playerId))),
      random
    ).slice(0, 3);
    const level = previousBossLevel();
    showPlayerOffer({
      title: global.SEASON1_CONFIG.nodeLabels[node.type].label,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}`,
      candidates,
      source: pool.source,
      database: pool.database,
      level,
      allowSkip: true,
      onPick: (player) => {
        recruitPlayer(player, pool.source, level, (added) => {
          finishNonMatchNode(node, added ? `${player.name} entra nella rosa` : "Hai rinunciato al nuovo giocatore");
        });
      },
      onSkip: () => finishNonMatchNode(node, "Hai rinunciato al pull"),
    });
  }

  function showPlayerOffer(options) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Scelta giocatore</p><h2>${escapeHtml(options.title)}</h2><p class="muted">${escapeHtml(options.subtitle)}</p></div></div>
      <div class="candidate-grid">
        ${options.candidates.map((player) => playerCard(player, { button: true, level: options.level, database: options.database })).join("")}
      </div>
      ${options.allowSkip ? '<div class="button-row" style="margin-top:18px"><button class="btn btn-ghost" id="skip-offer">Rinuncia</button></div>' : ""}`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const player = options.candidates.find((candidate) => String(candidate.playerId) === button.dataset.playerId);
        options.onPick(player);
      });
    });
    document.getElementById("skip-offer")?.addEventListener("click", options.onSkip);
  }

  function recruitPlayer(player, source, level, done, options = {}) {
    const allowCancel = options.allowCancel !== false;
    if (run.roster.length < global.SEASON1_CONFIG.maxRoster) {
      run.roster.push({ playerId: String(player.playerId), source, level });
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
        run.roster = run.roster.filter((entry) => String(entry.playerId) !== removeId);
        run.bench = run.bench.filter((id) => String(id) !== removeId);
        run.roster.push({ playerId: String(player.playerId), source, level });
        run.bench.push(String(player.playerId));
        global.RunState.save(run);
        closeModal();
        done(true);
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
      return renderMap();
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
    ui.pendingReward = { boss, remaining: 2, excludedIds: [] };
    showNextBossReward();
  }

  function showNextBossReward() {
    const reward = ui.pendingReward;
    const team = seasonDb.teams.find((candidate) => String(candidate.teamId) === String(reward.boss.teamId));
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.runId}:bossReward:${run.bossIndex}:${reward.remaining}`);
    const candidates = global.DraftEngine.shuffle(
      team.playerIds
        .map((id) => seasonPlayersById.get(String(id)))
        .filter((player) => player && !owned.has(String(player.playerId)) && !reward.excludedIds.includes(String(player.playerId))),
      random
    ).slice(0, 3);
    const level = global.RoguelikeRules.defeatedBossRewardLevel(reward.boss);
    showPlayerOffer({
      title: `Ricompensa ${3 - reward.remaining} di 2 · ${reward.boss.teamName}`,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}`,
      candidates,
      source: "season1",
      database: seasonDb,
      level,
      allowSkip: false,
      onPick: (player) => {
        reward.excludedIds.push(String(player.playerId));
        recruitPlayer(player, "season1", level, () => {
          reward.remaining -= 1;
          reward.remaining > 0 ? showNextBossReward() : finishBossVictory();
        }, { allowCancel: false });
      },
    });
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

  function renderInventory() {
    app.innerHTML = `
      <main class="screen">
        ${topbar("Oggetti")}
        <div class="content narrow">
          <div class="section-head"><div><p class="eyebrow">Inventario</p><h2>Oggetti raccolti</h2></div></div>
          <div class="panel">
            ${run.inventory.length ? run.inventory.map((item) => `
              <article style="padding:12px 0;border-bottom:1px solid var(--line)"><strong>${escapeHtml(item.name)}</strong><p class="muted small">${escapeHtml(item.description)}</p></article>`).join("") : '<p class="muted">Non hai ancora raccolto oggetti.</p>'}
            <p class="muted small" style="margin-top:18px">Gli effetti definitivi degli oggetti verranno bilanciati in seguito. Gli allenatori sono disattivati nella Season 1.</p>
          </div>
        </div>
        ${bottomNav("inventory")}
      </main>`;
    bindBottomNav();
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
      const [seasonResponse, freeAgentsResponse] = await Promise.all([
        fetch("data/IE1_season_compact.json"),
        fetch("data/FREE_AGENTS_compact.json"),
      ]);
      if (!seasonResponse.ok || !freeAgentsResponse.ok) throw new Error("Database non raggiungibili");
      [seasonDb, freeAgentsDb] = await Promise.all([seasonResponse.json(), freeAgentsResponse.json()]);
      freeAgentsById = new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player]));
      seasonPlayersById = new Map(seasonDb.players.map((player) => [String(player.playerId), player]));
      renderHome();
    } catch (error) {
      showLoadError(error);
    }
  }

  init();
})(globalThis);
