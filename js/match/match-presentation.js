(function (global) {
  "use strict";

  const TACTIC_LABELS = { attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", speed: "Velocità", physical: "Fisico", stamina: "Resistenza" };
  const TACTIC_SHORT_LABELS = { attack: "ATT", control: "CON", defense: "DIF", save: "PAR", speed: "VEL", physical: "FIS", stamina: "RES" };

  function create(deps = {}) {
    const {
      getRun,
      getUi,
      getSeasonDb,
      getSeasonPlayersById,
      getSeasonTeamsById,
      isProfileAwareSeason,
      formationById,
      resolvedRosterPlayer,
      rosterEntry,
      compactPlayerCardMarkup,
      normalizeTeamIdentity,
      escapeHtml,
      matchEventSideClass,
      openModal,
      closeModal,
      scrollSnapshot,
      showPlayerDetailsFor,
      bossNodeIconMarkup,
      modalRoot,
      document: documentRef = global.document,
    } = deps;

    function run() { return getRun?.() || null; }
    function ui() { return getUi?.() || {}; }
    function seasonDb() { return getSeasonDb?.() || null; }
    function seasonPlayersById() { return getSeasonPlayersById?.() || new Map(); }
    function seasonTeamsById() { return getSeasonTeamsById?.() || new Map(); }

    function shortName(name) {
      const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return parts[0] || "?";
      return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
    }

    function teamById(id) {
      return seasonTeamsById().get(String(id)) || null;
    }

    function bossTeamPlayers(boss) {
      const currentRun = run();
      const db = seasonDb();
      const level = Number(boss?.bossLevel || 0);
      return (boss?.startingXI || (boss?.startingXIPlayerIds || []).map((playerId) => ({ playerId, level })))
        .slice(0, 11)
        .map((slot) => {
          let source = seasonPlayersById().get(String(slot.playerId));
          let profileId = slot.profileId;
          if (isProfileAwareSeason?.(currentRun?.seasonId)) {
            profileId = profileId || boss.startingXIProfileIds?.[Number(slot.slot || 1) - 1];
            const profile = global.ProfiledSeasonRuntime.resolveProfile(currentRun.seasonId, profileId);
            if (profile) {
              const variant = (profile.roleVariants || []).find((item) => String(item.roleVariantId || item.variantId) === String(profile.defaultRoleVariantId));
              source = { ...source, ...profile, ...(variant || {}), playerId: String(profile.playerId), profileId: profile.profileId, roleVariantId: variant?.roleVariantId || variant?.variantId || profile.defaultRoleVariantId || null };
            }
          }
          if (!source) return null;
          const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(Number(slot.level ?? level)), db);
          return { ...resolved, profileId: profileId || resolved.profileId || null, displayLevel: Number(slot.level ?? level), source: global.SeasonRegistry.sourceForSeason(currentRun?.seasonId), playerId: String(slot.playerId) };
        })
        .filter(Boolean);
    }

    function userTeamPlayers() {
      return (run()?.lineup || []).slice(0, 11).map((id) => resolvedRosterPlayer(id)).filter(Boolean);
    }

    function formationRows(formationId, players) {
      const formation = formationById(formationId) || formationById("4-3-3") || { requirements: { FW: 3, MF: 3, DF: 4, GK: 1 } };
      const playersByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, players.filter((player) => String(player.position || player.normalizedRole || "").toUpperCase() === role)]));
      return global.FormationLayout.displayRows(formation).map((layout) => ({
        ...layout,
        players: (playersByRole.get(layout.role) || []).splice(0, layout.count),
      })).filter((row) => row.players.length);
    }

    function bossMatchTeamMeta(boss) {
      const currentRun = run();
      const userIdentity = normalizeTeamIdentity(currentRun.teamIdentity);
      return {
        user: { name: userIdentity.name || "La tua squadra", logoUrl: "", formation: currentRun.formationId || "-", level: currentRun.teamLevel },
        boss: { name: boss?.teamName || "Boss", logoUrl: boss?.logoUrl || teamById(boss?.teamId)?.logoUrl || "", formation: boss?.bossFormation || "-", level: boss?.bossLevel ?? "-", overall: boss?.teamOverall || null },
      };
    }

    function bossMatchAverage(players) {
      if (!players.length) return null;
      return Math.round(players.reduce((sum, player) => sum + Number(player.overall || 0), 0) / players.length);
    }

    function tacticSummary(formationId) {
      return global.MatchSimulator.formationTactic(formationId);
    }

    function tacticChipMarkup(key, value, compact = false) {
      const positive = Number(value) >= 0;
      const percent = Math.round(Math.abs(Number(value) || 0) * 100);
      const label = compact ? (TACTIC_SHORT_LABELS[key] || key.toUpperCase()) : (TACTIC_LABELS[key] || key);
      const text = `${positive ? "↑" : "↓"} ${label} ${positive ? "+" : "-"}${percent}%`;
      return `<span class="tactic-chip tactic-chip--${positive ? "bonus" : "penalty"}" aria-label="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
    }

    function tacticPanelMarkup(formationId, { className = "", compact = false, strength = null, probability = null } = {}) {
      const tactic = tacticSummary(formationId);
      const entries = Object.entries(tactic.modifiers || {});
      const bonuses = entries.filter(([, value]) => value >= 0).map(([key, value]) => tacticChipMarkup(key, value, compact)).join("");
      const penalties = entries.filter(([, value]) => value < 0).map(([key, value]) => tacticChipMarkup(key, value, compact)).join("");
      const strengthMarkup = strength ? `<div class="tactic-strength"><span>Forza base <strong>${escapeHtml(Math.round(strength.averageOverall ?? 0))}</strong></span><span>Forza effettiva <strong>${escapeHtml(strength.final ?? "-")}</strong></span>${probability != null ? `<span>Probabilità <strong>${escapeHtml(probability)}%</strong></span>` : ""}</div>` : "";
      return `<section class="tactic-panel ${className}" data-tactic-panel data-formation="${escapeHtml(formationId || "")}"><div class="tactic-heading"><strong>${escapeHtml(formationId || "-")}</strong><span>${escapeHtml(tactic.name)}</span></div><p>${escapeHtml(tactic.description)}</p><div class="tactic-chip-row tactic-chip-row--bonus">${bonuses || '<span class="tactic-chip">Nessun bonus</span>'}</div><div class="tactic-chip-row tactic-chip-row--penalty">${penalties || '<span class="tactic-chip">Nessuna penalità</span>'}</div>${strengthMarkup}</section>`;
    }

    function matchFormationCard(player, { side = "user", readonly = true, showEquipment = false } = {}) {
      const equipment = showEquipment ? (player.equipment || rosterEntry(player.playerId)?.equippedItem || null) : null;
      return compactPlayerCardMarkup(player, {
        equipment,
        equipmentInFooter: true,
        level: player.displayLevel ?? player.level ?? 0,
        overall: player.overall ?? player.finalOverall ?? "-",
        dataAttr: `data-boss-player="${escapeHtml(player.playerId)}" data-boss-side="${side}" ${readonly ? 'aria-label="Apri scheda ' + escapeHtml(player.name) + '"' : ""}`,
        extraClass: `run-tactical-card match-player-card match-player-card--${side} boss-match-card boss-match-card--${side}`,
        detailLayout: "stacked",
      });
    }

    function renderMatchFormation({ players, formationId, side = "user", readonly = true, showEquipment = false, mobile = false, hidden = false } = {}) {
      const rows = formationRows(formationId, players || []);
      return `
        <div class="match-formation match-formation--${side} boss-match-field-side boss-match-field-side--${side} ${mobile ? "boss-match-field-side--mobile" : ""}" data-boss-team="${side}" data-readonly="${readonly}"${hidden ? " hidden" : ""}>
          ${rows.map((row) => `<div class="match-formation-line match-formation-line--${row.role} boss-match-line boss-match-line--${row.role}" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length || 1};--row-count:${row.players.length || 1};--boss-row-count:${row.players.length || 1}">${row.players.map((player) => matchFormationCard(player, { side, readonly, showEquipment })).join("")}</div>`).join("")}
        </div>`;
    }

    function bossMatchField(team, side, mobile = false, hidden = false) {
      return renderMatchFormation({
        players: team.players,
        formationId: team.formationId,
        side,
        readonly: true,
        showEquipment: side === "user",
        mobile,
        hidden,
      });
    }

    function bossMatchTimeline() {
      const currentUi = ui();
      if (!currentUi.bossMatchLog?.length) return `<li data-empty-log="true"><span>0'</span><b>⚽</b><p>Formazioni pronte. Avvia la simulazione o usa i controlli provvisori.</p></li>`;
      return currentUi.bossMatchLog.map((event) => `<li class="${matchEventSideClass(event.side)}"><span>${escapeHtml(event.minute)}</span><b>${event.icon}</b><p>${escapeHtml(event.text)}</p></li>`).join("");
    }

    function switchBossMatchTab(side) {
      const currentUi = ui();
      const activeSide = side === "boss" ? "boss" : "user";
      currentUi.bossMatchTab = activeSide;
      const field = documentRef.querySelector(".boss-match-field");
      if (field) field.dataset.activeBossSide = activeSide;
      documentRef.querySelectorAll("[data-boss-tab]").forEach((button) => {
        const selected = button.dataset.bossTab === activeSide;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", selected ? "true" : "false");
      });
      documentRef.querySelectorAll(".boss-match-field [data-boss-team]").forEach((formation) => {
        formation.hidden = formation.dataset.bossTeam !== activeSide;
      });
      const label = documentRef.querySelector(".boss-match-half-label--active");
      const team = documentRef.querySelector(`.boss-match-team${activeSide === "boss" ? ".boss-match-team--boss" : ":not(.boss-match-team--boss)"} strong`);
      if (label && team) label.textContent = team.textContent || "";
    }

    function bossMatchStatusText() {
      return {
        "pre-match": "Pre-partita",
        simulating: "Simulazione in corso",
        "completed-victory": "Vittoria completata",
        "completed-defeat": "Sconfitta completata",
      }[ui().bossMatchState] || "Pre-partita";
    }

    function openBossPreviewModal(boss) {
      const currentRun = run();
      const db = seasonDb();
      const bossPlayers = bossTeamPlayers(boss);
      const meta = bossMatchTeamMeta(boss).boss;
      const average = bossMatchAverage(bossPlayers);
      openModal(`
        <div class="modal-head route-boss-preview-head">
          <div>
            <p class="eyebrow">Prossima sfida</p>
            <h2>${escapeHtml(meta.name)}</h2>
            <p class="muted">${escapeHtml(meta.formation)} · Boss ${currentRun.bossIndex + 1}/${db.bossOrder.length}${average ? ` · OVR ${escapeHtml(average)}` : ""}</p>
          </div>
          <span class="boss-match-logo route-boss-preview-logo">${bossNodeIconMarkup(boss)}</span>
        </div>
        <section class="route-boss-preview-field" aria-label="Formazione boss ${escapeHtml(meta.name)}">
          ${bossMatchField({ players: bossPlayers, formationId: boss.bossFormation }, "boss", true)}
        </section>
        <div class="button-row route-boss-preview-actions">
          <button type="button" class="btn btn-yellow" data-close-modal>Chiudi</button>
        </div>`,
        { closeable: true, className: "route-boss-preview-modal", preserveScroll: scrollSnapshot() }
      );
      modalRoot.querySelectorAll("[data-boss-player]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.bossPlayer;
        const player = bossPlayers.find((candidate) => String(candidate.playerId) === String(id));
        showPlayerDetailsFor(player, { playerId: id, level: player?.displayLevel, database: db, preserveScroll: scrollSnapshot() });
      }));
      modalRoot.querySelectorAll(".route-boss-preview-actions [data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
    }

    return {
      shortName,
      teamById,
      bossTeamPlayers,
      userTeamPlayers,
      formationRows,
      bossMatchTeamMeta,
      bossMatchAverage,
      tacticSummary,
      tacticChipMarkup,
      tacticPanelMarkup,
      matchFormationCard,
      renderMatchFormation,
      bossMatchField,
      bossMatchTimeline,
      switchBossMatchTab,
      bossMatchStatusText,
      openBossPreviewModal,
    };
  }

  global.MatchPresentationRuntime = { create };
})(globalThis);
