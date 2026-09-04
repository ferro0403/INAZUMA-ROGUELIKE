(function (global) {
  "use strict";

  function create(deps = {}) {
    const { getSeasonDb, escapeHtml, formatDate, compactPlayerCardMarkup } = deps;

    if (typeof getSeasonDb !== "function") {
      throw new Error("ChampionPresentation requires a dynamic season database getter");
    }

    function snapshotCard(player) {
      return compactPlayerCardMarkup(
        {
          ...player,
          position: player.role,
          category: player.finalRarity,
          overall: player.finalOverall,
          displayLevel: player.finalLevel,
          stats: player.finalStats,
        },
        {
          equipment: player.equippedItem,
          equipmentInFooter: true,
          level: global.LevelProgression.formatLevel(player.finalLevel, player.seasonId, player.finalLevelUnits),
          overall: player.finalOverall,
          dataAttr: `data-hall-player="${escapeHtml(player.playerId)}"`,
          extraClass: "squad-player-card hall-player-card",
        },
      );
    }

    function championFormationMarkup(team) {
      const seasonDb = getSeasonDb();
      const starters = Array.isArray(team.finalStartingEleven) ? team.finalStartingEleven : [];
      const database = global.SeasonRegistry?.database?.(team.seasonId || team.modeId) || seasonDb;
      const formation = database?.formations?.eleven?.find((item) => item.id === team.finalFormation);
      const playersByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, starters.filter((player) => player.role === role)]));
      const layouts = global.FormationLayout.displayRows(formation || { requirements: { FW: 3, MF: 3, DF: 4, GK: 1 } });
      const rows = layouts.map((layout) => ({ ...layout, players: (playersByRole.get(layout.role) || []).splice(0, layout.count) }));
      return `<section class="pitch hall-pitch">${rows.map((row) => `<div class="pitch-row tactical-row" data-display-role="${escapeHtml(row.displayRole || row.role)}" data-row-count="${row.players.length || 1}" style="--players-in-row:${row.players.length || 1}">${row.players.map(snapshotCard).join("")}</div>`).join("")}</section>`;
    }

    function championFiveVFiveMarkup(team) {
      const formation = team.savedFiveVFiveFormation;
      const slots = formation?.slots || {};
      const roster = Array.isArray(team.fullRoster) ? team.fullRoster : [];
      const players = Object.values(slots).map((playerId) => roster.find((player) => String(player.playerId) === String(playerId))).filter(Boolean);
      if (!players.length) return `<p class="muted">${escapeHtml(formation?.formation || "Non disponibile")}</p>`;
      return `<p class="muted">${escapeHtml(formation?.formation || "Formazione salvata")}</p><div class="bench-list hall-five-list">${players.map(snapshotCard).join("")}</div>`;
    }

    function compactSeed(seed) {
      const value = String(seed || "");
      return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
    }

    function formatStatValue(value, type = "text") {
      if (value == null || value === "") return null;
      if (type === "date") return formatDate(value);
      if (type === "duration") {
        const ms = Number(value);
        if (!Number.isFinite(ms) || ms < 0) return null;
        const minutes = Math.max(1, Math.round(ms / 60000));
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return hours ? `${hours}h ${rest}m` : `${minutes} min`;
      }
      if (type === "list") return Array.isArray(value) && value.length ? value : null;
      if (typeof value === "number" && !Number.isFinite(value)) return null;
      return String(value);
    }

    function runStatsSections(team) {
      const stats = team.runStatistics || {};
      return [
        {
          title: "Identità finale",
          className: "hall-stat-group--identity",
          items: [
            { label: "Livello finale squadra", value: global.LevelProgression.formatLevel(stats.finalTeamLevel ?? team.finalTeamLevel, team.seasonId || team.modeId, team.finalTeamLevelUnits ?? 0) },
            { label: "Overall medio finale", value: stats.finalAverageOverall ?? team.finalAverageOverall },
            { label: "Modulo finale", value: stats.finalFormation || team.finalFormation },
            { label: "Vite rimaste", value: stats.livesRemaining ?? team.livesRemaining },
          ],
        },
        {
          title: "Bilancio della run",
          className: "hall-stat-group--results",
          items: [
            { label: "Partite", value: stats.matchesTotal },
            { label: "Vittorie", value: stats.winsTotal },
            { label: "Sconfitte", value: stats.lossesTotal },
            { label: "Gol fatti", value: stats.goalsFor },
            { label: "Gol subiti", value: stats.goalsAgainst },
            { label: "Differenza reti", value: stats.goalDifference },
            { label: "Clean sheet", value: stats.cleanSheets },
          ],
        },
        {
          title: "Sfide boss",
          className: "hall-stat-group--boss",
          items: [
            { label: "Partite Boss", value: stats.bossMatches },
            { label: "Vittorie Boss", value: stats.bossWins },
            { label: "Sconfitte Boss", value: stats.bossLosses },
          ],
        },
        ...(Number(stats.specialMatches || 0) > 0 ? [{
          title: "Partite speciali",
          className: "hall-stat-group--special",
          items: [
            { label: "Giocate", value: stats.specialMatches },
            { label: "Vinte", value: stats.specialWins },
            { label: "Perse", value: stats.specialLosses },
          ],
        }] : []),
        {
          title: "Percorso",
          className: "hall-stat-group--secondary",
          items: [
            { label: "Nodi completati", value: stats.nodesCompleted },
            { label: "Giocatori reclutati", value: stats.recruitedPlayers ?? stats.playersRecruited ?? team.fullRoster?.length },
          ],
        },
      ];
    }

    function statsMarkup(team) {
      const sections = runStatsSections(team).map((section) => {
        const items = section.items.map((item) => ({ ...item, formatted: formatStatValue(item.value, item.type) })).filter((item) => item.formatted != null);
        if (!items.length) return "";
        return `<section class="hall-stat-group ${escapeHtml(section.className || "")}"><h3>${escapeHtml(section.title)}</h3><div class="hall-stat-list">${items.map((item) => `<div class="hall-stat"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.formatted)}</strong></div>`).join("")}</div></section>`;
      }).filter(Boolean).join("");
      return sections || '<p class="muted">Statistiche essenziali non disponibili per questa run.</p>';
    }

    function awardsMarkup(team) {
      const featuredAwardIds = new Set(["top_scorer", "best_goalkeeper", "defensive_pillar", "final_hero", "mvp"]);
      const awards = (team.awards || []).filter((award) => award && award.playerName && featuredAwardIds.has(award.id));
      return awards.map((award) => {
        const playerAttr = award.playerId ? ` data-hall-player="${escapeHtml(award.playerId)}"` : "";
        const description = award.description || award.reason || (award.score != null ? `Punteggio ${award.score}` : "Riconoscimento della run");
        return `<article class="hall-award ${playerAttr ? "hall-award--interactive" : ""}"${playerAttr}><span class="hall-award-mark" aria-hidden="true">★</span><img src="${escapeHtml(award.portraitUrl || "")}" alt="" loading="lazy"/><div class="hall-award-copy"><strong>${escapeHtml(award.label || award.title)}</strong><span>${escapeHtml(award.playerName)}</span><small>${escapeHtml(description)}</small></div></article>`;
      }).join("") || '<p class="muted">Premi individuali disponibili solo quando i dati registrati sono affidabili.</p>';
    }

    function playerStatsMarkup(team, player, explicitStats = null) {
      const stats = explicitStats || team.playerStatistics?.[String(player.playerId)] || player.playerStatistics || {};
      const role = player.role || player.position || stats.role;
      const items = [
        ["Presenze", stats.appearances ?? stats.appearancesTotal],
        ["Vittorie", stats.wins],
        role !== "GK" ? ["Gol", stats.goals] : null,
        role === "FW" || role === "MF" ? ["Tiri", stats.shots] : null,
        role === "GK" ? ["Parate", stats.saves] : null,
        role === "GK" || role === "DF" ? ["Clean sheet", stats.cleanSheets] : null,
        role === "DF" || role === "MF" ? ["Azioni difensive", stats.defensiveActions ?? stats.defensiveStops] : null,
        ["Voto medio", stats.averageRating],
        ["Miglior voto", stats.bestRating],
        ["Crescita overall", stats.overallGrowth],
      ].filter((item) => item && item[1] != null && item[1] !== "");
      const awards = (team.awards || [])
        .filter((award) => String(award.playerId || award.playerName) === String(player.playerId) || award.playerName === player.name)
        .map((award) => award.label || award.title)
        .filter(Boolean);
      const playerAwardsMarkup = awards.length
        ? `<div class="run-stat-card"><span class="run-stat-label">Premi</span><strong class="run-stat-value">${escapeHtml(awards.join(", "))}</strong></div>`
        : "";
      if (!items.length && !playerAwardsMarkup) {
        return '<section class="player-history-section"><h3>PRESTAZIONI NELLA RUN</h3><p class="muted">Statistiche complete non disponibili per questa run.</p></section>';
      }
      return `<section class="player-history-section"><h3>PRESTAZIONI NELLA RUN</h3><div class="player-history-stats">${items.map(([label, value]) => `<div class="run-stat-card"><span class="run-stat-label">${escapeHtml(label)}</span><strong class="run-stat-value">${escapeHtml(value)}</strong></div>`).join("")}${playerAwardsMarkup}</div></section>`;
    }

    return Object.freeze({
      snapshotCard,
      championFormationMarkup,
      championFiveVFiveMarkup,
      compactSeed,
      formatStatValue,
      runStatsSections,
      statsMarkup,
      awardsMarkup,
      playerStatsMarkup,
    });
  }

  global.ChampionPresentation = Object.freeze({ create });
})(globalThis);
