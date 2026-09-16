(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const resolver = deps.playerResolver || global.RoadToGloryPlayerResolver;
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const formationLayout = deps.formationLayout || global.FormationLayout || null;

    const roleOf = (player) => String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
    const playerIdOf = (player) => String(player?.playerId || player?.id || "");

    function sourceBadge(source) {
      const label = source === "RTG" ? "RTG" : "SVINCOLATO";
      return `<span class="rtg-source-badge rtg-source-badge--${source === "RTG" ? "rtg" : "free"}">${label}</span>`;
    }

    function fallbackPlayerCard(player, source, attrs = "") {
      const role = roleOf(player) || "—";
      const portrait = player?.portraitUrl || player?.portrait || player?.imageUrl || "";
      return `<button type="button" class="player-card player-card-compact tactical-player-card mini-player squad-player-card rtg-squad-player-card" ${attrs}>
        <span class="player-corner player-role">${escape(role)}</span>
        <span class="player-corner player-overall">${escape(player?.overall ?? player?.finalOverall ?? "—")}</span>
        <div class="player-portrait-wrap">${portrait ? `<img class="player-portrait" src="${escape(portrait)}" alt="" loading="lazy" />` : "<span class=\"player-portrait rtg-player-fallback\">⚡</span>"}</div>
        <div class="player-info"><div class="player-title"><strong>${escape(player?.name || playerIdOf(player) || "Giocatore")}</strong></div><div class="player-meta"><span>${escape(role)}</span><span>Lv 20</span></div></div>
        <span class="player-corner player-level">Lv 20</span>
        ${sourceBadge(source)}
      </button>`;
    }

    function playerCard(entry, area) {
      const player = entry?.player || {};
      const playerId = String(entry?.playerId || playerIdOf(player));
      const role = roleOf(player);
      const attrs = [
        `data-rtg-squad-player="${escape(playerId)}"`,
        `data-area="${escape(area)}"`,
        `data-role="${escape(role)}"`,
        `data-source="${escape(entry?.source || "")}"`,
        area === "lineup" ? `data-rtg-lineup-player="${escape(playerId)}"` : "",
        area === "bench" ? `data-rtg-bench-player="${escape(playerId)}"` : "",
        area === "picker" ? `data-rtg-picker-player="${escape(playerId)}"` : "",
      ].filter(Boolean).join(" ");

      if (compactPlayerCardMarkup) {
        return compactPlayerCardMarkup(player, {
          level: 20,
          overall: player?.overall ?? player?.finalOverall,
          dataAttr: attrs,
          extraClass: "squad-player-card rtg-squad-player-card",
          trailingMarkup: sourceBadge(entry?.source),
        });
      }
      return fallbackPlayerCard(player, entry?.source, attrs);
    }

    function formationRows(formation, lineupEntries) {
      const byRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, lineupEntries.filter((entry) => roleOf(entry.player) === role)]));
      const requirements = formation?.requirements || { FW:3, MF:3, DF:4, GK:1 };
      const rows = formationLayout?.displayRows?.(formation) || [
        { role: "FW", count: Number(requirements.FW || 0) },
        { role: "MF", count: Number(requirements.MF || 0) },
        { role: "DF", count: Number(requirements.DF || 0) },
        { role: "GK", count: Number(requirements.GK || 0) },
      ];
      return rows.map((row) => ({
        ...row,
        entries: (byRole.get(String(row.role).toUpperCase()) || []).splice(0, Number(row.count || 0)),
      }));
    }

    function formationPreviewMarkup(formation) {
      const requirements = formation?.requirements || { FW:3, MF:3, DF:4, GK:1 };
      const rows = formationLayout?.displayRows?.(formation) || [
        { role: "FW", count: Number(requirements.FW || 0) },
        { role: "MF", count: Number(requirements.MF || 0) },
        { role: "DF", count: Number(requirements.DF || 0) },
        { role: "GK", count: Number(requirements.GK || 0) },
      ];
      return `<div class="squad-formation-mini" style="--mini-rows:${rows.length}" aria-hidden="true">
        ${rows.map((row) => {
          const amount = Number(row.count || 0);
          return `<span class="squad-formation-mini-row" data-display-role="${escape(row.displayRole || row.role)}" style="--mini-count:${Math.max(1, amount)}">${Array.from({ length: amount }, () => `<i class="squad-formation-dot squad-formation-dot--${String(row.role).toLowerCase()}"></i>`).join("")}</span>`;
        }).join("")}
      </div>`;
    }

    function renderModel({ state, freeAgentIds = [], seasonDb, freeAgentsDb = null } = {}) {
      const seasonId = String(state?.activeSeasonId || "ie1");
      const squad = state?.squads?.[seasonId] || state?.squads?.ie1 || { formationId: null, lineup: [], bench: [], activeRoleVariantByPlayerId: {} };
      const gacha = new Set((state?.gachaAcquiredPlayerIds || []).map(String));
      const resolve = (playerId) => resolver?.resolveAtLevel20?.(playerId, seasonId, squad.activeRoleVariantByPlayerId?.[playerId] || null, freeAgentsDb) || { playerId, name: playerId, overall: "—", level: 20 };
      const sourceFor = (playerId) => gacha.has(String(playerId)) ? "RTG" : "Svincolato";
      const formations = Array.from(global.RoadToGloryConfig?.SEASON1?.formations || seasonDb?.formations?.eleven || []);
      const formation = formations.find((item) => String(item.id) === String(squad.formationId)) || formations[0] || null;
      const lineup = (squad.lineup || []).map((playerId) => ({ playerId: String(playerId), source: sourceFor(playerId), player: resolve(String(playerId)) }));
      const bench = (squad.bench || []).map((playerId) => ({ playerId: String(playerId), source: sourceFor(playerId), player: resolve(String(playerId)) }));
      return Object.freeze({
        seasonId,
        formationId: squad.formationId,
        formation,
        formations: Object.freeze(formations),
        lineup: Object.freeze(lineup),
        bench: Object.freeze(bench),
        lineupRows: Object.freeze(formationRows(formation, lineup)),
        availableCount: new Set([...(freeAgentIds || []).map(String), ...gacha]).size,
        activeRoleVariantByPlayerId: { ...(squad.activeRoleVariantByPlayerId || {}) },
      });
    }

    function formationOptionsMarkup(model = {}, canUse = () => true) {
      return `<div class="squad-formation-options rtg-formation-options">
        ${(model.formations || []).map((formation) => {
          const active = String(formation.id) === String(model.formationId);
          const available = !!canUse(formation);
          return `<button type="button" class="squad-formation-option ${active ? "active" : ""}" data-rtg-formation-option="${escape(formation.id)}" ${available ? "" : "disabled"} aria-pressed="${active ? "true" : "false"}">
            ${formationPreviewMarkup(formation)}
            <span class="squad-formation-option-copy">
              <strong>${escape(formation.name || formation.formation || formation.id)}</strong>
              <small>${escape(Object.entries(formation.requirements || {}).map(([role, amount]) => `${amount} ${role}`).join(" · "))}</small>
              <em>${active ? "Modulo attivo" : available ? "Seleziona" : "Rosa incompatibile"}</em>
            </span>
          </button>`;
        }).join("")}
      </div>`;
    }

    function replacementPickerResultsMarkup({ entries = [], total = 0, visibleCount = entries.length } = {}) {
      const remaining = Math.max(0, Number(total) - Number(entries.length));
      return `<div class="rtg-picker-grid">${entries.map((entry) => playerCard(entry, "picker")).join("")}</div>${remaining > 0 ? `<div class="album-load-more-wrap rtg-picker-load-more-wrap"><button type="button" class="btn btn-yellow album-load-more rtg-picker-load-more" data-rtg-picker-load-more>MOSTRA ALTRI ${escape(Math.min(24, remaining))}</button><small>${escape(entries.length)} di ${escape(total)}</small></div>` : `<div class="rtg-picker-count"><small>${escape(entries.length)} di ${escape(total)}</small></div>`}`;
    }

    function replacementPickerMarkup({ target = null, role = "", entries = [], total = 0, visibleCount = entries.length, query = "", sourceFilter = "all" } = {}) {
      const targetName = target?.player?.name || target?.playerId || "Giocatore";
      const filterButton = (value,label) => `<button type="button" class="rtg-picker-filter ${sourceFilter===value?"active":""}" data-rtg-picker-source="${escape(value)}">${escape(label)}</button>`;
      return `<section class="rtg-squad-picker development-squad-card-scope">
        <div class="modal-head rtg-squad-picker-head">
          <div><p class="eyebrow">Cambio giocatore</p><h2>${escape(targetName)}</h2><p class="muted">Ruolo ${escape(role || "compatibile")} · caricamento progressivo a blocchi da 24.</p></div>
        </div>
        <div class="rtg-picker-toolbar">
          <label class="rtg-picker-search"><span>Cerca per nome</span><input type="search" inputmode="search" autocomplete="off" placeholder="Es. Jude, Axel, Mark…" value="${escape(query)}" data-rtg-picker-search /></label>
          <div class="rtg-picker-source-filters" aria-label="Filtra provenienza">
            ${filterButton("all","Tutti")}
            ${filterButton("free","Svincolati")}
            ${filterButton("rtg","Giocatori RTG")}
          </div>
          <div class="rtg-picker-role-badge">SOLO ${escape(role || "—")}</div>
        </div>
        <div data-rtg-picker-results>${replacementPickerResultsMarkup({ entries, total, visibleCount })}</div>
      </section>`;
    }

    function markup(model = {}) {
      const lineupRows = model.lineupRows || [];
      const bench = model.bench || [];
      return `<main class="screen squad-screen rtg-squad-shell">
        <header class="topbar squad-topbar rtg-squad-topbar">
          <button type="button" class="squad-back-button rtg-squad-back" data-rtg-home aria-label="Torna alla Home">←</button>
          <div class="squad-topbar-copy"><p class="eyebrow">ROAD TO GLORY · SEASON 1</p><h1>Gestione squadra</h1></div>
          <div class="squad-topbar-stats"><span><small>LV</small><strong>20</strong></span></div>
        </header>
        <nav class="rtg-tabs rtg-tabs--main-style" aria-label="Road to Glory">
          <button type="button" class="rtg-tab" data-rtg-tab="run">Run</button>
          <button type="button" class="rtg-tab active" data-rtg-tab="squad">Squadra</button>
        </nav>
        <div class="content squad-content rtg-squad-content">
          <div class="squad-command-deck is-valid is-roster-complete">
            <span class="squad-readiness-mark" aria-hidden="true">✓</span>
            <div><small>Road to Glory</small><strong>Formazione RTG</strong><em data-rtg-draft-status>Tocca un giocatore per cambiarlo</em></div>
            <span class="squad-command-count"><b>11/11 titolari</b><b>4/4 riserve · ${escape(model.availableCount || 0)} disponibili</b></span>
          </div>

          <div class="squad-workspace">
            <section class="squad-field-panel" aria-label="Campo 11v11 RTG">
              <div class="squad-panel-head"><div><p class="eyebrow">Formazione titolare</p><h2>Campo tattico</h2></div><span class="squad-field-formation" data-rtg-formation-current>${escape(model.formation?.name || model.formation?.formation || model.formationId || "—")}</span></div>
              <section class="pitch rtg-squad-pitch-main">
                ${lineupRows.map((row) => `<div class="pitch-row tactical-row" data-row-count="${Math.max(1, row.entries?.length || Number(row.count) || 1)}" style="--players-in-row:${Math.max(1, row.entries?.length || Number(row.count) || 1)};--row-count:${Math.max(1, row.entries?.length || Number(row.count) || 1)}">${(row.entries || []).map((entry) => playerCard(entry, "lineup")).join("")}</div>`).join("")}
              </section>
            </section>

            <aside class="squad-management-panel">
              <section class="squad-module-card">
                <div class="squad-module-head">
                  <div><small>Modulo corrente</small><strong>${escape(model.formation?.name || model.formation?.formation || model.formationId || "—")}</strong></div>
                  ${formationPreviewMarkup(model.formation || {})}
                </div>
                <div class="rtg-module-copy"><strong>Assetto RTG</strong><p>Tocca una card: si apre solo il suo ruolo. Nessuna lista da 1500 giocatori viene caricata nella schermata.</p></div>
              </section>
              <div class="squad-management-actions rtg-squad-actions rtg-squad-actions--three">
                <button type="button" class="btn btn-yellow rtg-adapt-button" data-rtg-adapt-requirements>Adatta ai requisiti</button>
                <button type="button" class="btn squad-module-button" data-rtg-open-formation>Modifica modulo</button>
                <button type="button" class="btn squad-info-button" data-rtg-save-squad>Salva squadra</button>
              </div>
              <p class="squad-selection-hint" data-rtg-selection-hint>Tocca un giocatore per aprire i cambi compatibili</p>
              <section class="squad-bench-panel">
                <div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h2>Riserve</h2></div><span class="squad-bench-count">4/4</span></div>
                <div class="bench-list squad-bench-list rtg-bench-list">${bench.map((entry) => playerCard(entry, "bench")).join("")}</div>
              </section>
            </aside>
          </div>
        </div>
      </main>`;
    }

    function bind(root, actions = {}) {
      root?.querySelectorAll?.("[data-rtg-squad-player]")?.forEach((button) => {
        button.addEventListener("click", () => {
          const playerId = String(button.dataset.rtgSquadPlayer || "");
          if (playerId) actions.onOpenPlayer?.(playerId);
        });
      });
      root?.querySelector?.("[data-rtg-adapt-requirements]")?.addEventListener("click", () => actions.onAdaptRequirements?.());
      root?.querySelector?.("[data-rtg-open-formation]")?.addEventListener("click", () => actions.onOpenFormation?.());
      root?.querySelector?.("[data-rtg-save-squad]")?.addEventListener("click", () => actions.onSave?.());
    }

    return Object.freeze({ renderModel, markup, bind, playerCard, formationPreviewMarkup, formationOptionsMarkup, replacementPickerMarkup, replacementPickerResultsMarkup });
  }

  global.RoadToGlorySquadView = Object.freeze({ create });
})(globalThis);
