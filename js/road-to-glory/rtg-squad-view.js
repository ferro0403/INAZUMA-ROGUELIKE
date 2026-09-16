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
        area === "collection" ? `data-rtg-collection-player="${escape(playerId)}"` : "",
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
      const accessible = Array.from(new Set([...(freeAgentIds || []).map(String), ...gacha]));
      const resolve = (playerId) => resolver?.resolveAtLevel20?.(playerId, seasonId, squad.activeRoleVariantByPlayerId?.[playerId] || null, freeAgentsDb) || { playerId, name: playerId, overall: "—", level: 20 };
      const sourceFor = (playerId) => gacha.has(String(playerId)) ? "RTG" : "Svincolato";
      const collection = accessible
        .map((playerId) => ({ playerId, source: sourceFor(playerId), player: resolve(playerId) }))
        .sort((a, b) => (Number(b.player?.overall) || 0) - (Number(a.player?.overall) || 0) || String(a.player?.name || "").localeCompare(String(b.player?.name || "")));
      const formations = Array.from(seasonDb?.formations?.eleven || []);
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
        collection: Object.freeze(collection),
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

    function markup(model = {}) {
      const lineupRows = model.lineupRows || [];
      const bench = model.bench || [];
      const collection = model.collection || [];
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
            <div><small>Road to Glory</small><strong>Formazione RTG</strong><em data-rtg-draft-status>Modifiche non salvate: no</em></div>
            <span class="squad-command-count"><b>11/11 titolari</b><b>Rosa completa · 4/4 riserve</b></span>
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
                <div class="rtg-module-copy"><strong>Assetto RTG</strong><p>Gli scambi sono consentiti solo tra giocatori dello stesso ruolo. Il modulo usa le stesse regole della squadra delle run.</p></div>
              </section>
              <div class="squad-management-actions rtg-squad-actions">
                <button type="button" class="btn squad-module-button" data-rtg-open-formation>Modifica modulo</button>
                <button type="button" class="btn btn-yellow squad-info-button" data-rtg-save-squad>Salva squadra</button>
              </div>
              <p class="squad-selection-hint" data-rtg-selection-hint>Seleziona un giocatore</p>
              <section class="squad-bench-panel">
                <div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h2>Riserve</h2></div><span class="squad-bench-count">4/4</span></div>
                <div class="bench-list squad-bench-list rtg-bench-list">${bench.map((entry) => playerCard(entry, "bench")).join("")}</div>
              </section>
            </aside>
          </div>

          <section class="rtg-collection-main">
            <div class="rtg-collection-main-head">
              <div><p class="eyebrow">Rosa disponibile</p><h2>Giocatori disponibili</h2></div>
              <div class="rtg-collection-filters">
                <select data-rtg-role-filter aria-label="Filtra per ruolo"><option value="all">Tutti i ruoli</option><option value="GK">GK</option><option value="DF">DF</option><option value="MF">MF</option><option value="FW">FW</option></select>
                <select data-rtg-source-filter aria-label="Filtra per fonte"><option value="all">Tutte le fonti</option><option value="Svincolato">Svincolati</option><option value="RTG">RTG</option></select>
              </div>
            </div>
            <div class="rtg-collection-card-grid">${collection.map((entry) => playerCard(entry, "collection")).join("")}</div>
          </section>
        </div>
      </main>`;
    }

    function bind(root, actions = {}) {
      let selected = null;

      function cards() {
        return Array.from(root?.querySelectorAll?.("[data-rtg-squad-player]") || []);
      }

      function clearSelection() {
        selected = null;
        cards().forEach((card) => {
          card.classList?.remove?.("selected", "is-compatible", "is-incompatible");
          card.setAttribute?.("aria-pressed", "false");
        });
        const hint = root?.querySelector?.("[data-rtg-selection-hint]");
        if (hint) hint.textContent = "Seleziona un giocatore";
      }

      function selectCard(button) {
        selected = {
          playerId: String(button.dataset.rtgSquadPlayer || ""),
          role: String(button.dataset.role || "").toUpperCase(),
          area: String(button.dataset.area || ""),
        };
        cards().forEach((card) => {
          const cardId = String(card.dataset.rtgSquadPlayer || "");
          const role = String(card.dataset.role || "").toUpperCase();
          const isSelected = cardId === selected.playerId && String(card.dataset.area || "") === selected.area;
          const compatible = !isSelected && cardId !== selected.playerId && role && role === selected.role;
          card.classList?.toggle?.("selected", isSelected);
          card.classList?.toggle?.("is-compatible", compatible);
          card.classList?.toggle?.("is-incompatible", !isSelected && !compatible);
          card.setAttribute?.("aria-pressed", isSelected ? "true" : "false");
        });
        const hint = root?.querySelector?.("[data-rtg-selection-hint]");
        if (hint) hint.textContent = `Seleziona un altro ${selected.role} da scambiare`;
      }

      cards().forEach((button) => {
        button.addEventListener("click", () => {
          const current = {
            playerId: String(button.dataset.rtgSquadPlayer || ""),
            role: String(button.dataset.role || "").toUpperCase(),
            area: String(button.dataset.area || ""),
          };
          if (!selected) {
            selectCard(button);
            actions.onOpenPlayer?.(current.playerId);
            return;
          }
          if (selected.playerId === current.playerId && selected.area === current.area) {
            clearSelection();
            return;
          }
          if (!selected.role || selected.role !== current.role) {
            actions.onIncompatible?.(selected.playerId, current.playerId);
            return;
          }
          const first = selected.playerId;
          clearSelection();
          actions.onSwap?.(first, current.playerId);
        });
      });

      root?.querySelector?.("[data-rtg-open-formation]")?.addEventListener("click", () => actions.onOpenFormation?.());
      root?.querySelector?.("[data-rtg-save-squad]")?.addEventListener("click", () => actions.onSave?.());

      const applyFilters = () => {
        const role = root?.querySelector?.("[data-rtg-role-filter]")?.value || "all";
        const source = root?.querySelector?.("[data-rtg-source-filter]")?.value || "all";
        cards().filter((card) => card.dataset.area === "collection").forEach((card) => {
          card.hidden = (role !== "all" && card.dataset.role !== role) || (source !== "all" && card.dataset.source !== source);
        });
      };
      root?.querySelector?.("[data-rtg-role-filter]")?.addEventListener("change", applyFilters);
      root?.querySelector?.("[data-rtg-source-filter]")?.addEventListener("change", applyFilters);

      return Object.freeze({ clearSelection });
    }

    return Object.freeze({ renderModel, markup, bind, playerCard, formationPreviewMarkup, formationOptionsMarkup });
  }

  global.RoadToGlorySquadView = Object.freeze({ create });
})(globalThis);
