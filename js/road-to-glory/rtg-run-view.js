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

    function tabs(active = "run") {
      return `<nav class="rtg-tabs rtg-tabs--main-style" aria-label="Road to Glory">
        <button type="button" class="rtg-tab ${active === "run" ? "active" : ""}" data-rtg-tab="run">Run</button>
        <button type="button" class="rtg-tab ${active === "squad" ? "active" : ""}" data-rtg-tab="squad">Squadra</button>
      </nav>`;
    }

    function header(state = {}) {
      return `<header class="topbar rtg-main-topbar">
        <button type="button" class="btn rtg-home-button" data-rtg-home>← Home</button>
        <div class="rtg-main-title"><p class="eyebrow">Season 1</p><strong class="brand">Road to Glory</strong></div>
        <div class="status-strip"><span class="status-pill rtg-token-pill">◈ ${escape(Number(state.tokens) || 0)}</span><span class="status-pill lives">♥ ${escape(Number(state.lives) || 0)}</span></div>
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
      return `<button type="button" class="map-node rtg-route-node rtg-route-node--main ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}"${disabled}>
        <span class="node-icon rtg-main-node-icon">${emblem(node.teamId)}</span>
        <span class="node-label">${escape(label)}</span>
        ${node.checkpointAfter ? `<span class="rtg-node-checkpoint" data-rtg-checkpoint="${escape(node.teamId)}">⚑</span>` : ""}
      </button>`;
    }

    function secondaryNodeMarkup(state, node, index, point) {
      const status = nodeState(state, node, index);
      const farmable = Number(state?.attemptsByNode?.[node.id]?.clears || 0) > 0;
      const disabled = status === "locked" ? " disabled" : "";
      return `<button type="button" class="map-node rtg-route-node rtg-route-node--secondary ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" data-rtg-farmable="${farmable ? "true" : "false"}"${disabled}>
        <span class="node-icon rtg-free-agent-mark">?</span>
        <span class="node-label">${farmable ? "Svincolati · rigiocabile" : "Svincolati"}</span>
      </button>`;
    }

    function blockMarkup(block, entries, state, seasonDb) {
      const points = positions(entries.length);
      return `<section class="rtg-map-block rtg-map-block--${block.index + 1}" data-rtg-map-block="${block.index + 1}">
        <div class="section-head rtg-route-heading"><div><p class="eyebrow">${escape(block.eyebrow)}</p><h2>${escape(block.label)}</h2></div><span class="rtg-route-count">${entries.length} tappe</span></div>
        <div class="route-map rtg-route-stage">
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
      return `<main class="screen rtg-run-screen">
        ${header(state)}
        ${tabs("run")}
        <div class="content narrow rtg-run-content">
          <section class="panel rtg-run-command">
            <div><p class="eyebrow">Ricompense Season 1</p><h2>Distributore giocatori</h2><p class="muted">Batti le squadre principali per ampliare il pool.</p></div>
            <button type="button" class="btn btn-yellow rtg-vending-button" data-rtg-open-vending>Distributore S1 <span>300 ◈</span></button>
          </section>
          <section class="rtg-map" aria-label="Percorso Season 1">${blocks}</section>
        </div>
      </main>`;
    }

    function requirementsMarkup(eligibility = {}) {
      if (!eligibility) return "";
      const rows = [
        ["Potenza RTG", eligibility.teamPower == null ? "—" : `${eligibility.teamPower} / ${eligibility.cap}`, !eligibility.reasons?.includes("team-power-cap")],
        ["Reclute S1", `${eligibility.recruitCount || 0} / ${eligibility.minRecruit || 0}`, !eligibility.reasons?.includes("min-s1-recruits")],
        ["Reclute recenti", `${eligibility.recentRecruitCount || 0} / ${eligibility.recentCount || 0}`, !eligibility.reasons?.includes("recent-s1-recruits")],
      ];
      return `<section class="panel rtg-requirements"><p class="eyebrow">Accesso partita</p><h3>Requisiti</h3><div class="rtg-requirements-list">${rows.map(([label, value, ok]) => `<div class="rtg-requirement ${ok ? "ok" : "bad"}"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div></section>`;
    }

    function vendingMarkup(model = {}) {
      const rarities = model.rarities || [];
      return `<div class="rtg-vending rtg-paper-modal">
        <div class="modal-head"><div><p class="eyebrow">Road to Glory</p><h2>DISTRIBUTORE S1</h2><p class="muted">Ogni squadra battuta aggiunge i suoi giocatori al distributore.</p></div></div>
        <div class="rtg-vending-body">
          <div class="rtg-vending-machine" aria-hidden="true"><span>⚽</span><i></i></div>
          <div class="rtg-vending-wallet"><small>GETTONI RTG</small><strong>${escape(Number(model.tokens) || 0)} ◈</strong></div>
          <div class="rtg-vending-rates">${rarities.map((entry) => `<span><strong>${escape(entry.rarity)}</strong><em>${escape(Number(entry.weight).toFixed(1))}%</em></span>`).join("")}</div>
        </div>
        <button type="button" class="btn btn-yellow rtg-vending-pull" data-rtg-pull ${Number(model.tokens) < 300 || !(model.candidates || []).length ? "disabled" : ""}>PESCA · 300 ◈</button>
      </div>`;
    }

    function pullResultMarkup(result = {}, player = {}) {
      return `<div class="rtg-pull-result rtg-paper-modal"><p class="eyebrow">${escape(result.rarity || player.category || "")}</p><h2>${escape(player.name || result.playerId || "Giocatore")}</h2><p>${result.duplicate ? `Duplicato · rimborso ${escape(result.refund)} ◈` : "Nuovo giocatore RTG!"}</p><strong class="rtg-pull-balance">Saldo: ${escape(result.balanceAfter)} ◈</strong></div>`;
    }

    return Object.freeze({ tabs, lockedMarkup, runMarkup, requirementsMarkup, vendingMarkup, pullResultMarkup });
  }

  global.RoadToGloryRunView = Object.freeze({ create });
})(globalThis);
