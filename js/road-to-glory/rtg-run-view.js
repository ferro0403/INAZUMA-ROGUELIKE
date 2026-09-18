(function (global) {
  "use strict";

  const MAIN_TEAMS = Object.freeze(["occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"]);
  const BLOCKS = Object.freeze([
    Object.freeze({ index:0, start:0, end:2, label:"Primi passi", eyebrow:"Capitolo 1" }),
    Object.freeze({ index:1, start:3, end:5, label:"La sfida cresce", eyebrow:"Capitolo 2" }),
    Object.freeze({ index:2, start:6, end:8, label:"Verso l'élite", eyebrow:"Capitolo 3" }),
    Object.freeze({ index:3, start:9, end:9, label:"Finale", eyebrow:"Capitolo 4" }),
  ]);

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const emblem = deps.teamEmblemMarkup || ((teamId) => `<span class="boss-logo-fallback boss-logo-fallback--visible">${escape(String(teamId || "?").slice(0,1).toUpperCase())}</span>`);
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;

    function tabs(active = "run") {
      const icon = (name) => name === "run"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5M12.5 17.5c.7-2.2 1.9-3.4 3.5-3.4 1.8 0 3.2 1.4 4 4"/></svg>';
      return `<nav class="bottom-nav rtg-bottom-nav" aria-label="Road to Glory">
        <button type="button" data-rtg-tab="run" class="${active === "run" ? "active" : ""}" aria-current="${active === "run" ? "page" : "false"}"><span class="nav-icon">${icon("run")}</span><span class="nav-label">Run</span></button>
        <button type="button" data-rtg-tab="squad" class="${active === "squad" ? "active" : ""}" aria-current="${active === "squad" ? "page" : "false"}"><span class="nav-icon">${icon("squad")}</span><span class="nav-label">Squadra</span></button>
      </nav>`;
    }

    function header(state = {}) {
      return `<header class="topbar rtg-main-topbar">
        <button type="button" class="btn rtg-home-button" data-rtg-home>← Home</button>
        <div class="rtg-main-title"><p class="eyebrow">Season 1</p><strong class="brand">Road to Glory</strong></div>
        <div class="status-strip"><span class="status-pill rtg-token-pill">◈ ${escape(Number(state.tokens) || 0)}</span><span class="status-pill lives">♥ ${escape(Number(state.lives) || 0)} vite</span></div>
      </header>`;
    }

    function lockedMarkup(access = {}) {
      const count = Math.max(0, Number(access.count) || 0);
      return `<main class="screen rtg-run-screen rtg-locked">
        ${header({ tokens:0, lives:0 })}
        <div class="content narrow rtg-locked-content">
          <section class="panel rtg-lock-card">
            <p class="eyebrow">Road to Glory</p>
            <h1>La strada non è ancora aperta</h1>
            <p class="muted">Sblocca almeno <strong>15 svincolati</strong> nelle run normali e assicurati di poter formare un undici valido con un portiere.</p>
            <div class="progress-track rtg-lock-progress"><span class="progress-bar" style="width:${Math.min(100, Math.round(count / 15 * 100))}%"></span></div>
            <strong>${escape(count)}/15 svincolati</strong>
          </section>
        </div>
      </main>`;
    }

    function nodeState(state, node, index) {
      if (state?.seasonComplete) return "completed";
      if (node.id === state?.currentNodeId) return "reachable";
      const currentIndex = Math.max(0, Number(state?.currentNodeIndex ?? -1));
      if (index < currentIndex) return "completed";
      const clearedSecondary = Number(state?.attemptsByNode?.[node.id]?.clears || 0) > 0;
      const defeatedMain = node.type === "main" && (state?.defeatedTeamIds || []).includes(node.teamId);
      if (clearedSecondary || defeatedMain) return "completed";
      return "locked";
    }

    function teamName(seasonDb, teamId) {
      const team = (seasonDb?.teams || []).find((entry) => String(entry.teamId || entry.id) === String(teamId));
      return team?.name || team?.teamName || String(teamId || "Squadra");
    }

    function blockForNode(node) {
      if (node.type === "main") return BLOCKS.find((block) => node.mainIndex >= block.start && node.mainIndex <= block.end) || BLOCKS[0];
      const nextIndex = MAIN_TEAMS.indexOf(node.beforeTeamId);
      return BLOCKS.find((block) => nextIndex >= block.start && nextIndex <= block.end) || BLOCKS[0];
    }

    function positions(count) {
      if (count <= 1) return [{ x:50, y:50 }];
      const xs = [50, 28, 67, 35, 72, 31, 64, 46, 70, 34];
      return Array.from({ length: count }, (_, index) => ({
        x: xs[index % xs.length],
        y: 10 + index * (80 / Math.max(1, count - 1)),
      }));
    }

    function pathSvg(points) {
      if (points.length < 2) return '<svg class="map-lines rtg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
      return `<svg class="map-lines rtg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${points.slice(0,-1).map((point,index) => {
        const next = points[index + 1];
        return `<line x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}" />`;
      }).join("")}</svg>`;
    }

    function mainNodeMarkup(state, node, index, seasonDb, point) {
      const status = nodeState(state, node, index);
      const disabled = status === "locked" ? " disabled" : "";
      const label = teamName(seasonDb, node.teamId);
      return `<button type="button" class="map-node rtg-route-node rtg-route-node--main ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" aria-label="${escape(label)} · ${status === "reachable" ? "Prossima partita" : status === "completed" ? "Completata" : "Da sbloccare"}"${status === "reachable" ? ' aria-current="step"' : ""}${disabled}>
        <span class="node-icon rtg-main-node-icon">${emblem(node.teamId)}</span>
        <span class="node-label">${escape(label)}</span><span class="rtg-node-status">${status === "reachable" ? "GIOCA" : status === "completed" ? "COMPLETATA" : "DA SBLOCCARE"}</span>
        ${node.checkpointAfter ? `<span class="rtg-node-checkpoint" data-rtg-checkpoint="${escape(node.teamId)}">⚑</span>` : ""}
      </button>`;
    }

    function secondaryNodeMarkup(state, node, index, point) {
      const status = nodeState(state, node, index);
      const farmable = Number(state?.attemptsByNode?.[node.id]?.clears || 0) > 0;
      const disabled = status === "locked" ? " disabled" : "";
      return `<button type="button" class="map-node rtg-route-node rtg-route-node--secondary ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" data-rtg-farmable="${farmable ? "true" : "false"}"${disabled}>
        <span class="node-icon rtg-free-agent-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 34 9v12c0 8-14 16-14 16S6 29 6 21V9Z" fill="currentColor"/><path d="m20 12 7 5-3 8h-8l-3-8Z" fill="#fff"/></svg></span>
        <span class="node-label">Svincolati</span><span class="rtg-node-status">${status === "reachable" ? "GIOCA" : farmable ? "RIGIOCA" : status === "completed" ? "COMPLETATA" : "DA SBLOCCARE"}</span>
      </button>`;
    }

    function blockMarkup(block, entries, state, seasonDb) {
      const points = positions(entries.length);
      return `<section class="rtg-map-block rtg-map-block--${block.index + 1}" data-rtg-map-block="${block.index + 1}">
        <div class="section-head rtg-route-heading"><div><p class="eyebrow">${escape(block.eyebrow)}</p><h2>${escape(block.label)}</h2></div><span class="rtg-route-count">${entries.length} tappe</span></div>
        <div class="route-map rtg-route-stage" style="--rtg-route-height:${Math.max(260, entries.length * 100)}px">
          ${pathSvg(points)}
          ${entries.map(({ node, index }, localIndex) => node.type === "main"
            ? mainNodeMarkup(state, node, index, seasonDb, points[localIndex])
            : secondaryNodeMarkup(state, node, index, points[localIndex])).join("")}
        </div>
      </section>`;
    }

    function runMarkup({ state, nodes, seasonDb } = {}) {
      const list = Array.from(nodes || []);
      const currentIndex = list.findIndex((node) => node.id === state?.currentNodeId);
      const viewState = { ...(state || {}), currentNodeIndex: currentIndex };
      const blocks = BLOCKS.map((block) => {
        const entries = list.map((node, index) => ({ node, index })).filter((entry) => blockForNode(entry.node).index === block.index);
        return blockMarkup(block, entries, viewState, seasonDb);
      }).join("");
      const currentNode = list[currentIndex];
      const currentLabel = currentNode?.type === "main" ? teamName(seasonDb,currentNode.teamId) : "Svincolati";
      const complete = !!state?.seasonComplete;
      const cleared = complete ? list.length : Math.max(0,currentIndex);
      return `<main class="screen rtg-run-screen">
        ${header(state)}
        <div class="content narrow rtg-run-content">
          <section class="rtg-journey-summary" aria-label="Avanzamento percorso">
            <div><p class="eyebrow">${complete ? "Season 1 completata" : "La tua prossima partita"}</p><h1>${complete ? "Traguardo raggiunto" : escape(currentLabel)}</h1><p>${complete ? "Hai completato il percorso della Season 1." : `Tappa ${Math.max(1,currentIndex+1)} di ${list.length} · ${currentNode?.type === "main" ? "Sfida principale" : "Partita secondaria"}`}</p></div>
            ${!complete && currentNode ? `<button type="button" class="btn btn-yellow" data-rtg-current-node="${escape(currentNode.id)}">Prepara partita <span aria-hidden="true">→</span></button>` : ""}
            <div class="rtg-journey-progress" role="progressbar" aria-label="Tappe completate nel percorso attuale" aria-valuenow="${cleared}" aria-valuemin="0" aria-valuemax="${list.length}"><span style="width:${list.length ? cleared/list.length*100 : 0}%"></span></div>
          </section>
          <section class="panel rtg-run-command">
            <div><p class="eyebrow">La tua collezione</p><h2>Rinforza la squadra</h2><p class="muted">Nuovi giocatori dalle squadre sconfitte.</p></div>
            <button type="button" class="btn btn-yellow rtg-vending-button" data-rtg-open-vending>Distributore S1 <span>300 ◈</span></button>
          </section>
          <section class="rtg-map" aria-label="Percorso Season 1">${blocks}</section>
        </div>
        ${tabs("run")}
      </main>`;
    }

    function requirementsMarkup(eligibility = {}) {
      if (!eligibility) return "";
      const rows = [
        ["Potenza rosa · max", eligibility.teamPower == null ? "—" : `${eligibility.teamPower} / ${eligibility.cap}`, !eligibility.reasons?.includes("team-power-cap")],
        ["Reclute S1 · min", `${eligibility.recruitCount || 0} / ${eligibility.minRecruit || 0}`, !eligibility.reasons?.includes("min-s1-recruits")],
        ["Reclute recenti · min", `${eligibility.recentRecruitCount || 0} / ${eligibility.recentCount || 0}`, !eligibility.reasons?.includes("recent-s1-recruits")],
      ];
      return `<section class="panel rtg-requirements"><p class="eyebrow">Accesso partita</p><h3>Requisiti</h3><div class="rtg-requirements-list">${rows.map(([label, value, ok]) => `<div class="rtg-requirement ${ok ? "ok" : "bad"}"><span><i aria-hidden="true">${ok ? "✓" : "!"}</i> ${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div><p class="rtg-requirements-note">Reclute e potenza considerano tutti i 15 giocatori: titolari + panchina.</p></section>`;
    }

    function nodeModalMarkup({ node, eligibility = null, seasonDb, allowed = true } = {}) {
      if (!node) return "";
      if (node.type === "main") {
        const label = teamName(seasonDb, node.teamId);
        return `<div class="rtg-node-modal rtg-paper-modal">
          <div class="modal-head rtg-node-modal-head">
            <span class="rtg-node-modal-emblem">${emblem(node.teamId)}</span>
            <div><p class="eyebrow">Partita principale</p><h2>${escape(label)}</h2><p class="muted">Prepara la squadra e rispetta i requisiti della sfida.</p></div>
          </div>
          ${requirementsMarkup(eligibility)}
          <button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed || !eligibility?.eligible ? "disabled" : ""}>GIOCA</button>
        </div>`;
      }
      return `<div class="rtg-node-modal rtg-paper-modal">
        <div class="modal-head rtg-node-modal-head">
          <span class="rtg-node-modal-secondary" aria-hidden="true">?</span>
          <div><p class="eyebrow">Svincolati</p><h2>Partita secondaria</h2><p class="muted">Avversari generati nella fascia di potenza del percorso. Vittoria: 100–150 Gettoni RTG.</p></div>
        </div>
        <button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed ? "disabled" : ""}>GIOCA</button>
      </div>`;
    }

    function vendingMarkup(model = {}) {
      const rarities = model.rarities || [];
      const candidates = model.candidates || [];
      const canPull = Number(model.tokens) >= 300 && candidates.length > 0;
      return `<div class="rtg-vending rtg-paper-modal">
        <div class="rtg-vending-title">
          <div><p class="eyebrow">RTG · S1</p><h2>Distributore</h2></div>
        </div>
        <div class="rtg-vending-stage">
          <div class="rtg-vending-machine-v7" data-rtg-vending-machine aria-label="Distributore di palline Season 1">
            <img class="rtg-vending-machine-image" src="assets/rtg/rtg-gacha-machine.webp?v=2" alt="Distributore RTG" draggable="false" />
          </div>
          <div class="rtg-vending-wallet-chip"><span>GETTONI</span><strong>${escape(Number(model.tokens)||0)} ◈</strong></div>
        </div>
        <div class="rtg-vending-ratebar" aria-label="Probabilità">
          ${rarities.map((entry)=>`<span data-rarity="${escape(entry.rarity)}"><b>${escape(entry.rarity)}</b><em>${escape(Number(entry.weight).toFixed(1))}%</em></span>`).join("")}
        </div>
        <button type="button" class="btn btn-yellow rtg-vending-pull" data-rtg-pull ${canPull?"":"disabled"}>${canPull?"GIRA · 300 ◈":candidates.length?`MANCANO ${escape(Math.max(0,300-(Number(model.tokens)||0)))} ◈`:"VINCI UNA SFIDA PER SBLOCCARE GIOCATORI"}</button>
      </div>`;
    }

    function pullResultMarkup(result = {}, player = {}) {
      const rarity = result.rarity || player.category || "";
      const card = compactPlayerCardMarkup
        ? compactPlayerCardMarkup(player,{level:20,overall:player?.finalOverall ?? player?.overall,extraClass:"squad-player-card rtg-squad-player-card rtg-pull-player-card",detailLayout:"stacked"})
        : `<div class="rtg-pull-player-fallback"><strong>${escape(player.name || result.playerId || "Giocatore")}</strong><span>Lv 20</span></div>`;
      return `<div class="rtg-pull-result rtg-paper-modal development-squad-card-scope">
        <div class="rtg-pull-result-head"><p class="eyebrow">${escape(rarity)}</p><strong>${result.duplicate ? "DUPLICATO" : "NUOVO GIOCATORE"}</strong></div>
        <div class="rtg-pull-result-body">
          ${card}
          <div class="rtg-pull-result-copy"><h2>${escape(player.name || result.playerId || "Giocatore")}</h2><p>${result.duplicate ? `Rimborso duplicato: <strong>${escape(result.refund)} ◈</strong>` : "Aggiunto alla collezione Road to Glory."}</p><span>Livello 20 · ${escape(rarity)}</span></div>
        </div>
        <strong class="rtg-pull-balance">Saldo RTG · ${escape(result.balanceAfter)} ◈</strong>
      </div>`;
    }

    return Object.freeze({ tabs, lockedMarkup, runMarkup, requirementsMarkup, nodeModalMarkup, vendingMarkup, pullResultMarkup });
  }

  global.RoadToGloryRunView = Object.freeze({ create });
})(globalThis);
