(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const resolver = deps.playerResolver || global.RoadToGloryPlayerResolver;
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const teamEmblemMarkup = deps.teamEmblemMarkup || null;
    const formationLayout = deps.formationLayout || global.FormationLayout || null;

    const roleOf = (player) => String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
    const playerIdOf = (player) => String(player?.playerId || player?.id || "");
    const cardIdOf = (value) => String(value?.cardId || value?.player?.cardId || value?.playerId || playerIdOf(value?.player || value) || "");
    const legacyBadge = (entry) => {
      const identity = global.RoadToGloryCardIdentity;
      const ref = entry?.cardId || entry?.player?.cardId || entry?.player || entry;
      const meta = identity?.parse?.(ref);
      if (meta?.sourceKind !== "season") return "";
      const label = identity?.legacyLabel?.(meta.legacySeasonId) || "";
      return label ? `<span class="rtg-legacy-badge rtg-legacy-tab" data-legacy-season="${escape(label)}" title="Legacy ${escape(label)}">${escape(label)}</span>` : "";
    };

    function sourceBadge(source) {
      if (source !== "RTG") return "";
      return '<span class="rtg-source-badge rtg-source-badge--rtg">RTG</span>';
    }

    function fallbackPlayerCard(player, source, attrs = "", extraClass = "") {
      const role = roleOf(player) || "—";
      const portrait = player?.portraitUrl || player?.portrait || player?.imageUrl || "";
      return `<button type="button" class="player-card player-card-compact tactical-player-card mini-player ${escape(extraClass)}" ${attrs}>
        <span class="player-corner player-role">${escape(role)}</span>
        <span class="player-corner player-overall">${escape(player?.overall ?? player?.finalOverall ?? "—")}</span>
        <div class="player-portrait-wrap">${portrait ? `<img class="player-portrait" src="${escape(portrait)}" alt="" loading="lazy" />` : "<span class=\"player-portrait rtg-player-fallback\">⚡</span>"}</div>
        <div class="player-info"><div class="player-title"><strong>${escape(player?.name || playerIdOf(player) || "Giocatore")}</strong></div><div class="player-meta"><span>${escape(role)}</span><span>Lv 20</span></div></div>
        <span class="player-corner player-level">Lv 20</span>
        ${sourceBadge(source)}
        ${legacyBadge({ player })}
      </button>`;
    }

    function playerCard(entry, area, options = {}) {
      const player = entry?.player || {};
      const cardId = cardIdOf(entry);
      const playerId = String(entry?.playerId || playerIdOf(player));
      const role = roleOf(player);
      const isPicker = area === "picker";
      const isCatalog = area === "catalog";
      const attrs = [
        `data-rtg-squad-player="${escape(cardId)}"`,
        `data-area="${escape(area)}"`,
        `data-role="${escape(role)}"`,
        `data-source="${escape(entry?.source || "")}"`,
        !isPicker ? `data-rtg-player-detail="${escape(cardId)}"` : "",
        area === "lineup" ? `data-rtg-lineup-player="${escape(cardId)}"` : "",
        area === "bench" ? `data-rtg-bench-player="${escape(cardId)}"` : "",
        isPicker ? `data-rtg-picker-player="${escape(cardId)}"` : "",
        isCatalog ? `data-rtg-catalog-player="${escape(cardId)}"` : "",
        options.dataAttr || "",
      ].filter(Boolean).join(" ");
      const extraClass = [
        "squad-player-card",
        isPicker ? "" : "rtg-squad-player-card",
        isPicker ? "rtg-picker-squad-card" : "",
        isCatalog ? "rtg-prematch-player-card rtg-picker-player-card rtg-catalog-player-card" : "",
        options.extraClass || "",
      ].filter(Boolean).join(" ");
      const cardMarkup = compactPlayerCardMarkup
        ? compactPlayerCardMarkup(player, {
            level: 20,
            overall: player?.overall ?? player?.finalOverall,
            dataAttr: attrs,
            extraClass,
            trailingMarkup: legacyBadge({ ...entry, player }),
          })
        : fallbackPlayerCard(player, "", attrs, extraClass);
      if (isPicker || isCatalog) return cardMarkup;
      return `<div class="rtg-squad-card-slot ${options.readOnly ? "rtg-squad-card-slot--readonly" : ""}" data-rtg-card-slot="${escape(cardId)}">
        ${cardMarkup}
        ${options.readOnly ? "" : `<button type="button" class="rtg-squad-change-trigger" data-rtg-change-player="${escape(cardId)}" aria-label="Cambia ${escape(player?.name || playerId)}"><span aria-hidden="true">↔</span><span>Cambia</span></button>`}
      </div>`;
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

    function formationForId(formationId) {
      const formations = Array.from(global.RoadToGloryConfig?.SEASON1?.formations || global.SeasonRegistry?.database?.("ie1")?.formations?.eleven || []);
      return formations.find((item) => String(item.id) === String(formationId)) || null;
    }

    function lineupPitchMarkup(lineupRows = [], options = {}) {
      const readOnly = !!options.readOnly;
      const side = String(options.side || "user");
      const mode = String(options.mode || "squad");
      const selectedId = String(options.selectedId || "");
      const latest = options.latest || null;
      const attrName = mode === "prematch" ? "data-rtg-prematch-player" : mode === "halftime" ? "data-rtg-half-lineup" : mode === "live" ? "data-rtg-field-player" : "";
      return `<section class="pitch rtg-squad-pitch-main">
        ${lineupRows.map((row) => `<div class="pitch-row tactical-row" data-row-count="${Math.max(1, row.entries?.length || Number(row.count) || 1)}" style="--players-in-row:${Math.max(1, row.entries?.length || Number(row.count) || 1)};--row-count:${Math.max(1, row.entries?.length || Number(row.count) || 1)}">${(row.entries || []).map((entry) => {
          const currentId = cardIdOf(entry);
          const selected = mode === "halftime" && currentId === selectedId;
          const latestClass = latest?.actorId === currentId ? "is-latest-actor" : latest?.opponentId === currentId ? "is-latest-opponent" : "";
          const dataAttr = !attrName ? "" : mode === "halftime"
            ? `${attrName}="${escape(currentId)}" data-role="${escape(roleOf(entry.player))}" aria-pressed="${selected ? "true" : "false"}"`
            : `${attrName}="${escape(currentId)}" data-side="${escape(side)}"`;
          return playerCard(entry, "lineup", {
            readOnly,
            dataAttr,
            extraClass:`${selected ? "selected" : ""} ${latestClass}`,
          });
        }).join("")}</div>`).join("")}
      </section>`;
    }

    function matchPitchMarkup(squad = {}, options = {}) {
      const side = String(options.side || "user");
      const mode = String(options.mode || "live");
      const selectedId = String(options.selectedId || "");
      const latest = options.latest || null;
      const formation = formationForId(squad?.formationId) || { requirements: { FW:3, MF:3, DF:4, GK:1 } };
      const entries = (squad?.lineup || []).map((player) => ({ cardId: cardIdOf(player), playerId: playerIdOf(player), source:"", player }));
      const rows = formationRows(formation, entries);
      return `<section class="squad-field-panel rtg-match-squad-field-shell rtg-match-squad-field-shell--${escape(mode)}" data-side="${escape(side)}">${lineupPitchMarkup(rows,{readOnly:true,side,mode,selectedId,latest})}</section>`;
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
      const squad = state?.squads?.[seasonId] || state?.squads?.ie1 || { formationId: null, lineup: [], bench: [], activeRoleVariantByCardId: {} };
      const gacha = new Set((state?.gachaAcquiredCards || []).map((entry) => global.RoadToGloryCardIdentity?.parse?.(entry)?.cardId).filter(Boolean));
      const resolve = (cardId) => resolver?.resolveAtLevel20?.(cardId, seasonId, squad.activeRoleVariantByCardId?.[cardId] || null, freeAgentsDb) || { cardId, playerId:global.RoadToGloryCardIdentity?.parse?.(cardId)?.playerId || cardId, name: cardId, overall: "—", level: 20 };
      const sourceFor = (cardId) => gacha.has(String(cardId)) ? "RTG" : "Svincolato";
      const formations = Array.from(global.RoadToGloryConfig?.SEASON1?.formations || seasonDb?.formations?.eleven || []);
      const formation = formations.find((item) => String(item.id) === String(squad.formationId)) || formations[0] || null;
      const toEntry = (cardId) => { const player=resolve(String(cardId)); return { cardId:String(cardId), playerId:String(player?.playerId || global.RoadToGloryCardIdentity?.parse?.(cardId)?.playerId || cardId), source:sourceFor(cardId), player }; };
      const lineup = (squad.lineup || []).map(toEntry);
      const bench = (squad.bench || []).map(toEntry);
      const freeCards=(freeAgentIds||[]).map((playerId)=>global.RoadToGloryCardIdentity?.cardIdForFreeAgent?.(playerId)||String(playerId));
      return Object.freeze({
        seasonId,
        formationId: squad.formationId,
        formation,
        formations: Object.freeze(formations),
        lineup: Object.freeze(lineup),
        bench: Object.freeze(bench),
        lineupRows: Object.freeze(formationRows(formation, lineup)),
        availableCount: new Set([...freeCards, ...gacha]).size,
        activeRoleVariantByCardId: { ...(squad.activeRoleVariantByCardId || {}) },
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

    function catalogResultsMarkup({ entries = [], total = 0 } = {}) {
      const remaining = Math.max(0, Number(total) - Number(entries.length));
      return `<div class="rtg-catalog-grid">${entries.map((entry) => playerCard(entry, "catalog")).join("")}</div>${remaining > 0 ? `<div class="album-load-more-wrap rtg-picker-load-more-wrap"><button type="button" class="btn btn-yellow album-load-more rtg-picker-load-more" data-rtg-catalog-load-more>MOSTRA ALTRI ${escape(Math.min(24, remaining))}</button><small>${escape(entries.length)} di ${escape(total)}</small></div>` : `<div class="rtg-picker-count"><small>${escape(entries.length)} di ${escape(total)}</small></div>`}`;
    }

    function catalogMarkup({ entries = [], total = 0, query = "" } = {}) {
      return `<section class="rtg-player-catalog development-squad-card-scope">
        <div class="modal-head rtg-catalog-head">
          <div><p class="eyebrow">Collezione Road to Glory</p><h2>Giocatori RTG</h2><p class="muted">${escape(total)} giocatori ottenuti dal percorso e dal distributore.</p></div>
        </div>
        <label class="rtg-picker-search rtg-catalog-search"><span>Cerca giocatore</span><input type="search" inputmode="search" autocomplete="off" placeholder="Cerca per nome…" value="${escape(query)}" data-rtg-catalog-search /></label>
        <div data-rtg-catalog-results>${catalogResultsMarkup({ entries, total })}</div>
      </section>`;
    }

    function replacementPickerMarkup({ target = null, role = "", allowAnyRole = false, quickEntries = [], entries = [], total = 0, visibleCount = entries.length, query = "", sourceFilter = "all", rarityFilter = "all", rarityOptions = [] } = {}) {
      const targetName = target?.player?.name || target?.playerId || "Giocatore";
      const filterButton = (value,label) => `<button type="button" class="rtg-picker-filter ${sourceFilter===value?"active":""}" data-rtg-picker-source="${escape(value)}">${escape(label)}</button>`;
      const rarityOptionMarkup = ['<option value="all">Tutte</option>', ...rarityOptions.map((rarity) => `<option value="${escape(rarity)}" ${String(rarityFilter)===String(rarity)?"selected":""}>${escape(rarity)}</option>`)].join("");
      return `<section class="rtg-squad-picker development-squad-card-scope">
        <div class="modal-head rtg-squad-picker-head">
          <div><p class="eyebrow">Cambio giocatore</p><h2>${escape(targetName)}</h2><p class="muted">Scegli un sostituto · ${escape(allowAnyRole ? "qualsiasi ruolo" : (role || "stesso ruolo"))}</p></div>
        </div>
        ${quickEntries.length ? `<section class="rtg-picker-quick-bench"><div class="rtg-picker-quick-head"><span>PANCHINA · CAMBIO RAPIDO</span><strong>STESSO RUOLO</strong></div><div class="rtg-picker-quick-strip">${quickEntries.map((entry) => playerCard(entry, "picker")).join("")}</div></section>` : ""}
        <div class="rtg-picker-toolbar">
          <label class="rtg-picker-search"><span>Cerca per nome</span><input type="search" inputmode="search" autocomplete="off" placeholder="Es. Jude, Axel, Mark…" value="${escape(query)}" data-rtg-picker-search /></label>
          <div class="rtg-picker-source-filters" aria-label="Filtra provenienza">
            ${filterButton("all","Tutti")}
            ${filterButton("free","Svincolati")}
            ${filterButton("rtg","Giocatori RTG")}
          </div>
          <label class="rtg-picker-rarity-filter">
            <span>Rarità</span>
            <select data-rtg-picker-rarity aria-label="Filtra per rarità">${rarityOptionMarkup}</select>
          </label>
          <button type="button" class="rtg-picker-ovr-sort active" data-rtg-picker-sort aria-label="Ordina per overall decrescente" aria-pressed="true">OVR ↓</button>
        </div>
        <div data-rtg-picker-results>${replacementPickerResultsMarkup({ entries, total, visibleCount })}</div>
      </section>`;
    }

    function markup(model = {}, context = {}) {
      const lineupRows = model.lineupRows || [];
      const bench = model.bench || [];
      const teamName = String(context.teamName || "La tua squadra");
      const teamIdentity = context.teamIdentity || null;
      const teamEmblem = teamEmblemMarkup
        ? teamEmblemMarkup({ name:teamName, teamIdentity }, "user", "rtg-squad-team-emblem")
        : "";
      return `<main class="screen squad-screen rtg-squad-shell">
        <header class="topbar squad-topbar rtg-squad-topbar">
          <button type="button" class="squad-back-button rtg-squad-back" data-rtg-home aria-label="Torna alla Home">←</button>
          <div class="squad-topbar-copy"><p class="eyebrow">RTG · S1</p><h1>Squadra</h1></div>
          <div class="rtg-squad-team-identity" aria-label="Squadra ${escape(teamName)}">
            <span class="rtg-squad-team-logo">${teamEmblem}</span>
            <strong title="${escape(teamName)}">${escape(teamName)}</strong>
          </div>
        </header>

        <div class="content squad-content rtg-squad-content">
          <div class="squad-workspace">
            <section class="squad-field-panel" aria-label="Campo 11v11 RTG">
              <div class="squad-panel-head rtg-squad-section-head"><h2>Titolari</h2><span class="squad-field-formation" data-rtg-formation-current>${escape(model.formation?.name || model.formation?.formation || model.formationId || "—")}</span></div>
              ${lineupPitchMarkup(lineupRows)}
            </section>

            <aside class="squad-management-panel">
              <section class="squad-bench-panel">
                <div class="squad-panel-head rtg-squad-section-head"><h2>Panchina</h2><span class="squad-bench-count">${bench.length}/4</span></div>
                <div class="bench-list squad-bench-list rtg-bench-list">${bench.map((entry) => playerCard(entry, "bench")).join("")}</div>
              </section>
              <div class="squad-management-actions rtg-squad-actions rtg-squad-actions--four">
                <button type="button" class="btn squad-module-button" data-rtg-open-formation>Modifica modulo</button>
                <button type="button" class="btn squad-info-button rtg-catalog-button" data-rtg-open-catalog>Giocatori RTG</button>
              </div>
              ${context.requirementsMarkup ? `<section class="rtg-squad-next"><div class="rtg-next-heading"><div><p class="eyebrow">Prossima sfida</p><h2>${escape(context.nextTeamName || "Season 1")}</h2></div><details class="rtg-requirements-disclosure"><summary aria-label="Informazioni sui requisiti della prossima sfida"><span aria-hidden="true">i</span> Requisiti</summary><div class="rtg-requirements-drawer">${context.requirementsMarkup}<button type="button" class="btn rtg-adapt-button" data-rtg-adapt-requirements>Adatta ai requisiti</button></div></details></div></section>` : '<button type="button" class="btn rtg-adapt-button" data-rtg-adapt-requirements disabled>Adatta ai requisiti</button>'}
              <div class="rtg-squad-savebar"><span>${context.dirty ? "Modifiche da salvare" : "Squadra salvata"}</span><button type="button" class="btn btn-yellow" data-rtg-save-squad>Salva squadra</button></div>
            </aside>
          </div>
        </div>
                <nav class="bottom-nav rtg-bottom-nav" aria-label="Road to Glory">
          <button type="button" data-rtg-tab="run"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg></span><span class="nav-label">Run</span></button>
          <button type="button" data-rtg-tab="squad" class="active" aria-current="page"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5M12.5 17.5c.7-2.2 1.9-3.4 3.5-3.4 1.8 0 3.2 1.4 4 4"/></svg></span><span class="nav-label">Squadra</span></button>
        </nav>
      </main>`;
    }

    function bind(root, actions = {}) {
      root?.querySelectorAll?.("[data-rtg-player-detail]")?.forEach((button) => {
        button.addEventListener("click", () => {
          const playerId = String(button.dataset.rtgPlayerDetail || "");
          if (playerId) actions.onOpenDetails?.(playerId);
        });
      });
      root?.querySelectorAll?.("[data-rtg-change-player]")?.forEach((button) => {
        button.addEventListener("click", (event) => {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          const playerId = String(button.dataset.rtgChangePlayer || "");
          if (playerId) actions.onOpenPlayer?.(playerId);
        });
      });
      root?.querySelector?.("[data-rtg-adapt-requirements]")?.addEventListener("click", () => actions.onAdaptRequirements?.());
      root?.querySelector?.("[data-rtg-open-formation]")?.addEventListener("click", () => actions.onOpenFormation?.());
      root?.querySelector?.("[data-rtg-open-catalog]")?.addEventListener("click", () => actions.onOpenCatalog?.());
      root?.querySelector?.("[data-rtg-save-squad]")?.addEventListener("click", () => actions.onSave?.());
    }

    return Object.freeze({ renderModel, markup, bind, playerCard, lineupPitchMarkup, matchPitchMarkup, formationPreviewMarkup, formationOptionsMarkup, replacementPickerMarkup, replacementPickerResultsMarkup, catalogMarkup, catalogResultsMarkup });
  }

  global.RoadToGlorySquadView = Object.freeze({ create });
})(globalThis);
