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
        ["Potenza titolari · max", eligibility.teamPower == null ? "—" : `${eligibility.teamPower} / ${eligibility.cap}`, !eligibility.reasons?.includes("team-power-cap")],
        ["Reclute S1 · min", `${eligibility.recruitCount || 0} / ${eligibility.minRecruit || 0}`, !eligibility.reasons?.includes("min-s1-recruits")],
        ["Reclute recenti · min", `${eligibility.recentRecruitCount || 0} / ${eligibility.recentCount || 0}`, !eligibility.reasons?.includes("recent-s1-recruits")],
      ];
      return `<section class="panel rtg-requirements"><p class="eyebrow">Accesso partita</p><h3>Requisiti</h3><div class="rtg-requirements-list">${rows.map(([label, value, ok]) => `<div class="rtg-requirement ${ok ? "ok" : "bad"}"><span><i aria-hidden="true">${ok ? "✓" : "!"}</i> ${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div><p class="rtg-requirements-note">Le reclute contano anche in panchina. La potenza riguarda gli 11 titolari.</p></section>`;
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
          <div class="rtg-vending-machine-v6" data-rtg-vending-machine aria-label="Distributore di palline Season 1">
            <svg class="rtg-vending-machine-art" viewBox="0 0 380 560" role="img" aria-label="Distributore RTG">
              <defs>
                <linearGradient id="rtgMachineYellow" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#ffe266"/>
                  <stop offset=".48" stop-color="#ffd21f"/>
                  <stop offset="1" stop-color="#c68b0b"/>
                </linearGradient>
                <linearGradient id="rtgMachineSide" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#dca31e"/>
                  <stop offset="1" stop-color="#8a5b09"/>
                </linearGradient>
                <linearGradient id="rtgMachineGlass" x1=".15" y1=".05" x2=".85" y2=".95">
                  <stop offset="0" stop-color="#ffffff" stop-opacity=".82"/>
                  <stop offset=".35" stop-color="#eef7f8" stop-opacity=".70"/>
                  <stop offset=".72" stop-color="#c5d2d6" stop-opacity=".56"/>
                  <stop offset="1" stop-color="#91a0a7" stop-opacity=".42"/>
                </linearGradient>
                <linearGradient id="rtgMachineMetal" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#ffffff"/>
                  <stop offset=".25" stop-color="#bfc4c8"/>
                  <stop offset=".55" stop-color="#f7f7f4"/>
                  <stop offset=".82" stop-color="#6f7377"/>
                  <stop offset="1" stop-color="#3c3f42"/>
                </linearGradient>
                <filter id="rtgMachineShadow" x="-30%" y="-20%" width="170%" height="170%">
                  <feDropShadow dx="8" dy="10" stdDeviation="4" flood-color="#111216" flood-opacity=".30"/>
                </filter>
                <filter id="rtgMachineSoftShadow" x="-30%" y="-30%" width="170%" height="170%">
                  <feDropShadow dx="2" dy="4" stdDeviation="2" flood-color="#111216" flood-opacity=".24"/>
                </filter>
                <clipPath id="rtgMachineGlobeClip">
                  <path d="M71 135 C71 70 119 38 190 38 C261 38 309 70 309 135 L309 253 C309 301 278 328 236 337 L144 337 C102 328 71 301 71 253 Z"/>
                </clipPath>
              </defs>

              <ellipse cx="195" cy="531" rx="146" ry="17" fill="#111216" opacity=".13"/>

              <g filter="url(#rtgMachineShadow)">
                <path d="M294 126 L334 151 L334 463 L304 490 L286 455 Z" fill="url(#rtgMachineSide)" stroke="#111216" stroke-width="7" stroke-linejoin="round"/>
                <path d="M77 122 C77 77 112 50 155 45 L155 26 C155 15 163 8 174 8 H206 C217 8 225 15 225 26 L225 45 C268 50 303 77 303 122 L303 158 H77 Z" fill="url(#rtgMachineYellow)" stroke="#111216" stroke-width="8" stroke-linejoin="round"/>
                <path d="M145 45 V30 C145 8 161 -4 181 -4 H199 C219 -4 235 8 235 30 V45" fill="#111216" stroke="#111216" stroke-width="7"/>
                <circle cx="190" cy="31" r="28" fill="#111216" stroke="#ffd21f" stroke-width="6"/>
                <path d="M191 11 L177 33 H187 L181 51 L204 27 H194 L201 11 Z" fill="#ffd21f"/>
                <rect x="125" y="62" width="130" height="51" rx="18" fill="#111216" stroke="#111216" stroke-width="4"/>
                <text x="190" y="79" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="900" letter-spacing="5">INAZUMA</text>
                <text x="190" y="104" text-anchor="middle" fill="#ffd21f" font-size="32" font-weight="1000" letter-spacing="2">RTG</text>

                <path d="M71 135 C71 70 119 38 190 38 C261 38 309 70 309 135 L309 253 C309 301 278 328 236 337 L144 337 C102 328 71 301 71 253 Z" fill="url(#rtgMachineGlass)" stroke="#111216" stroke-width="8"/>
                <g clip-path="url(#rtgMachineGlobeClip)" class="rtg-vending-capsules-v6">
                  <g class="rtg-capsule c1" transform="translate(104 166) rotate(-13)"><circle cx="0" cy="0" r="27" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-25 2 A27 27 0 0 0 25 2 Z" fill="#ffd21f"/><path d="M-26 0 H26" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c2" transform="translate(163 139) rotate(16)"><circle cx="0" cy="0" r="28" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-26 2 A28 28 0 0 0 26 2 Z" fill="#111216"/><path d="M-27 0 H27" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c3" transform="translate(229 150) rotate(-8)"><circle cx="0" cy="0" r="30" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-28 2 A30 30 0 0 0 28 2 Z" fill="#ffd21f"/><path d="M-29 0 H29" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c4" transform="translate(277 183) rotate(11)"><circle cx="0" cy="0" r="26" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-24 2 A26 26 0 0 0 24 2 Z" fill="#ffd21f"/><path d="M-25 0 H25" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c5" transform="translate(130 226) rotate(8)"><circle cx="0" cy="0" r="31" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-29 2 A31 31 0 0 0 29 2 Z" fill="#111216"/><path d="M-30 0 H30" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c6" transform="translate(188 216) rotate(-11)"><circle cx="0" cy="0" r="32" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-30 2 A32 32 0 0 0 30 2 Z" fill="#ffd21f"/><path d="M-31 0 H31" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c7" transform="translate(252 230) rotate(14)"><circle cx="0" cy="0" r="31" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-29 2 A31 31 0 0 0 29 2 Z" fill="#ffd21f"/><path d="M-30 0 H30" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c8" transform="translate(102 284) rotate(-16)"><circle cx="0" cy="0" r="26" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-24 2 A26 26 0 0 0 24 2 Z" fill="#ffd21f"/><path d="M-25 0 H25" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c9" transform="translate(156 281) rotate(5)"><circle cx="0" cy="0" r="27" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-25 2 A27 27 0 0 0 25 2 Z" fill="#111216"/><path d="M-26 0 H26" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c10" transform="translate(215 283) rotate(-7)"><circle cx="0" cy="0" r="28" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-26 2 A28 28 0 0 0 26 2 Z" fill="#ffd21f"/><path d="M-27 0 H27" stroke="#111216" stroke-width="4"/></g>
                  <g class="rtg-capsule c11" transform="translate(272 282) rotate(13)"><circle cx="0" cy="0" r="25" fill="#fff" stroke="#111216" stroke-width="4"/><path d="M-23 2 A25 25 0 0 0 23 2 Z" fill="#ffd21f"/><path d="M-24 0 H24" stroke="#111216" stroke-width="4"/></g>
                  <path d="M92 95 C107 72 128 61 151 55" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity=".65"/>
                  <path d="M101 116 C107 105 114 97 122 91" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".72"/>
                </g>

                <path d="M82 337 H298 L319 359 L314 478 Q314 495 295 500 H83 Q65 494 66 477 L61 359 Z" fill="url(#rtgMachineYellow)" stroke="#111216" stroke-width="8" stroke-linejoin="round"/>
                <path d="M287 350 L316 363 L311 468 L291 481 Z" fill="url(#rtgMachineSide)" opacity=".92"/>

                <rect x="91" y="363" width="112" height="70" rx="10" fill="#fffdf6" stroke="#111216" stroke-width="6"/>
                <text x="147" y="387" text-anchor="middle" fill="#111216" font-size="12" font-weight="1000" letter-spacing="1">1 PALLINA</text>
                <text x="147" y="418" text-anchor="middle" fill="#111216" font-size="29" font-weight="1000">300 ◇</text>

                <g class="rtg-vending-crank-v6" transform="translate(252 397)">
                  <circle cx="0" cy="0" r="42" fill="url(#rtgMachineMetal)" stroke="#111216" stroke-width="7"/>
                  <circle cx="0" cy="0" r="25" fill="#fffdf6" stroke="#111216" stroke-width="5"/>
                  <rect x="-6" y="-29" width="12" height="39" rx="6" fill="#111216" transform="rotate(-34)"/>
                  <circle cx="0" cy="0" r="8" fill="#111216"/>
                </g>

                <path d="M92 447 H184 V492 H91 Q79 492 79 480 V459 Q79 447 92 447 Z" fill="#111216" stroke="#111216" stroke-width="4"/>
                <path d="M101 456 H174 V482 H100 Q91 482 91 474 V464 Q91 456 101 456 Z" fill="#08090a" stroke="#3d3d3d" stroke-width="3"/>
                <circle cx="137" cy="470" r="18" fill="#fff" stroke="#111216" stroke-width="4"/>
                <path d="M120 472 A18 18 0 0 0 154 472 Z" fill="#ffd21f"/><path d="M119 470 H155" stroke="#111216" stroke-width="4"/>

                <rect x="202" y="447" width="82" height="45" rx="7" fill="#111216" stroke="#111216" stroke-width="4"/>
                <text x="243" y="462" text-anchor="middle" fill="#ffd21f" font-size="8" font-weight="900" letter-spacing="1.5">ROAD TO</text>
                <text x="243" y="476" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="1000" letter-spacing="1.5">GLORY</text>

                <path d="M54 500 H321 L306 531 H69 Z" fill="#111216" stroke="#111216" stroke-width="7" stroke-linejoin="round"/>
                <path d="M75 502 H302 L294 518 H82 Z" fill="#ffd21f"/>
                <rect x="78" y="526" width="49" height="12" rx="6" fill="#111216"/>
                <rect x="249" y="526" width="49" height="12" rx="6" fill="#111216"/>
              </g>
            </svg>
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
