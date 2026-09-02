(function (global) {
  "use strict";

  const CATEGORY_CLASS_BY_NAME = {
    Scarso: "rarity-scarso", Debole: "rarity-debole", Normale: "rarity-normale", Buono: "rarity-buono",
    Forte: "rarity-forte", Elite: "rarity-elite", Mondiale: "rarity-mondiale", Leggenda: "rarity-leggenda",
  };
  const STAT_LABELS = { attack: "Attacco", control: "Controllo", speed: "Velocità", grit: "Grinta", physical: "Fisico", stamina: "Resistenza", defense: "Difesa", save: "Parata" };

  function rarityClass(category) { return CATEGORY_CLASS_BY_NAME[category] || "rarity-debole"; }
  function statIcon(stat) {
    const icons = {
      attack: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M9 12h6"/></svg>`, control: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17"/></svg>`, speed: `<svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/></svg>`, grit: `<svg viewBox="0 0 24 24"><path d="M12 21c4-2 7-5 7-9 0-3-2-5-4-7 0 3-2 4-3 5-1-2-1-4-1-6-3 2-6 5-6 9 0 4 3 7 7 8Z"/></svg>`, physical: `<svg viewBox="0 0 24 24"><path d="M7 13c1-5 4-8 8-7 2 1 3 3 2 5l3 1-2 4-4-1-2 4H7v-6Z"/><path d="M5 14h7"/></svg>`, stamina: `<svg viewBox="0 0 24 24"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 7-6 10-6 12Z"/><path d="M7 12h3l1-3 2 6 1-3h3"/></svg>`, defense: `<svg viewBox="0 0 24 24"><path d="M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M12 7v10"/></svg>`, save: `<svg viewBox="0 0 24 24"><path d="M7 20V8a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v11H7Z"/><path d="M7 14 4 12"/></svg>`,
    };
    return `<span class="detail-stat-icon" aria-hidden="true">${icons[stat] || icons.control}</span>`;
  }

  function create(deps) {
    const { visuals, escapeHtml, resolveItem, itemIcon, getProgression, applyEquipment, formatLevel, getSeasonId, sourcePlayer, playerTeamIdentity, historicalTeamIdentity, teamLogoMarkup, playerStatsMarkup } = deps;
    function compactCard(player, { equipment = null, equipmentInFooter = false, level = player.displayLevelText ?? player.displayLevel ?? 0, overall = player.overall ?? player.finalOverall, selected = false, dataAttr = "", extraClass = "", detailLayout = "inline", tag = "button", trailingMarkup = "" } = {}) {
      const cardTag = tag === "article" ? "article" : "button";
      const playerRole = player.position || player.normalizedRole || "-";
      const equipmentDefinition = equipment ? resolveItem(equipment) : null;
      const equipmentMarkup = equipmentDefinition ? `<span class="player-corner player-equipment ${equipmentInFooter ? "player-equipment--footer" : ""}" aria-label="Oggetto equipaggiato: ${escapeHtml(equipmentDefinition.name)}" title="${escapeHtml(equipmentDefinition.name)}">${itemIcon(equipment)}</span>` : "";
      const detail = detailLayout === "stacked" ? `<div class="player-meta player-meta--stacked" aria-label="Dettagli giocatore"><div class="player-meta-line player-meta-line--role-overall"><span data-player-role>${escapeHtml(playerRole)}</span><span aria-hidden="true">•</span><span data-player-overall>${escapeHtml(overall)}</span></div><div class="player-meta-line player-meta-line--level"><span aria-hidden="true">•</span><span data-player-level>Lv ${escapeHtml(level)}</span></div></div>` : `<div class="player-meta" aria-label="Dettagli giocatore"><span>${escapeHtml(playerRole)}</span><span>${escapeHtml(overall)}</span><span>Lv ${escapeHtml(level)}</span></div>`;
      return `
      <${cardTag} ${cardTag === "button" ? 'type="button"' : ""} class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player ${escapeHtml(extraClass)} ${rarityClass(player.category)} ${equipment ? "has-equipment" : ""} ${selected ? "selected" : ""}" ${dataAttr}>
        <span class="player-corner player-role" aria-label="Ruolo ${escapeHtml(playerRole)}">${escapeHtml(playerRole)}</span><span class="player-corner player-overall" aria-label="Overall ${overall}">${overall}</span>
        <div class="player-portrait-wrap"><img class="player-portrait" src="${escapeHtml(visuals.portraitUrl(player))}" alt="" loading="lazy" ${visuals.imageFallbackAttributes(visuals.resolve(player).cardFallbacks)} /></div>
        <div class="player-info"><div class="player-title"><strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>${equipmentInFooter ? equipmentMarkup : ""}</div>${detail}</div>
        ${equipmentInFooter ? "" : equipmentMarkup}<span class="player-corner player-level" aria-label="Livello ${escapeHtml(level)}">Lv ${escapeHtml(level)}</span>${trailingMarkup}
      </${cardTag}>`;
    }

    function detailMarkup(player, { playerId = player?.playerId, level = player?.displayLevel ?? 0, database = null, equipment = null, mode = "current", readOnly = false, team = null, runStats = null, albumUnlocked = false } = {}) {
      if (!player) return "";
      const historical = mode === "historical", albumMode = mode === "album";
      const sourceFallback = historical ? sourcePlayer(playerId, player.recruitmentSource) || sourcePlayer(playerId) || {} : {};
      const detailVisual = visuals.resolve({ ...sourceFallback, ...player }, { playerId });
      const teamIdentity = historical ? historicalTeamIdentity(player, team, sourceFallback) : playerTeamIdentity(player, playerId);
      const teamBadge = teamIdentity.name ? `<div class="player-detail-team" aria-label="Squadra ${escapeHtml(teamIdentity.name)}">${teamLogoMarkup(teamIdentity)}<strong>${escapeHtml(teamIdentity.name)}</strong></div>` : "";
      const resolved = historical ? { ...sourceFallback, ...player, name: player.name || sourceFallback.name || String(playerId), position: player.role || player.position || sourceFallback.position || "-", element: player.element || sourceFallback.element || sourceFallback.type || "-", category: player.finalRarity || player.category || sourceFallback.category || "Debole", overall: player.finalOverall ?? player.overall ?? null, potential: player.finalPotential ?? null, stats: player.finalStats || player.stats || {}, baseStats: player.finalStats || player.stats || {} } : (player.stats && player.baseStats ? player : getProgression().getPlayerAtLevel(player, Math.floor(Number(level || 0)), database));
      const baseStats = resolved.baseStats || resolved.stats || {};
      const effectiveStats = historical ? resolved.stats || {} : (albumMode ? resolved.stats || {} : (resolved.baseStats ? resolved.stats : (equipment ? applyEquipment(resolved.stats, equipment) : resolved.stats)));
      const stats = Object.entries(STAT_LABELS).map(([stat, label]) => { const base = Number(baseStats[stat] || 0), effective = Number(effectiveStats?.[stat] || 0), bonus = historical || albumMode ? 0 : effective - base, barValue = Math.max(0, Math.min(100, effective)); return `<div class="detail-stat player-stat-card" style="--stat-value:${barValue}%">${statIcon(stat)}<span class="detail-stat-label">${label}</span><strong class="detail-stat-value">${effective}</strong>${bonus > 0 ? `<em class="detail-stat-bonus">+${bonus}</em>` : ""}<span class="detail-stat-track" aria-hidden="true"><i></i></span></div>`; }).join("");
      const potential = historical ? resolved.potential ?? "Non disponibile" : resolved.potential ?? player.finalOverall;
      const origin = historical && team?.teamName ? `<p class="muted player-history-origin">Rosa campione: ${escapeHtml(team.teamName)}${player.recruitmentSource ? ` · Origine: ${escapeHtml(player.recruitmentSource)}` : ""}</p>` : "";
      const item = equipment ? resolveItem(equipment) : null;
      const equipmentMarkup = item ? `<div class="equipped-detail"><div class="equipped-detail-art">${itemIcon(equipment)}</div><div class="equipped-detail-copy"><span>${historical ? "Equipaggiamento storico" : "Oggetto assegnato"}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><em>+${Number(item.bonus || 0)} ${escapeHtml(STAT_LABELS[item.stat] || item.stat || "")}</em></div>${!readOnly && playerId ? `<button type="button" class="btn btn-ghost" data-detail-unequip="${escapeHtml(playerId)}">Rimuovi oggetto</button>` : ""}</div>` : `<div class="equipped-detail equipped-detail-empty"><div class="equipped-detail-copy"><span>Slot disponibile</span><strong>Nessun equipaggiamento</strong><small>Questo giocatore non ha ancora un oggetto assegnato.</small></div></div>`;
      const displayLevel = historical ? formatLevel(player.finalLevel ?? 0, player.seasonId || team?.seasonId || team?.modeId, player.finalLevelUnits) : (player.displayLevelText ?? formatLevel(level, getSeasonId(), player.displayLevelUnits));
      const contextLabel = albumMode ? "Album" : historical ? "Squadra campione" : "";
      return `<div class="player-detail-layout ${rarityClass(resolved.category)} ${historical ? "player-detail-historical" : ""}"><section class="player-detail-hero ${String(resolved.name || "").length > 18 ? "player-detail-hero--extra-long-name" : (String(resolved.name || "").length > 12 ? "player-detail-hero--long-name" : "")}"><div class="player-detail-identity">${teamBadge}<div class="player-detail-heading"><p class="eyebrow">Scheda giocatore</p>${contextLabel ? `<span>${escapeHtml(contextLabel)}</span>` : ""}${albumMode ? `<span class="album-detail-badge">${albumUnlocked ? "SBLOCCATO" : "CONSULTABILE"}</span>` : ""}</div><h2 class="player-detail-name">${escapeHtml(resolved.name)}</h2><div class="player-detail-tags"><span class="role-chip"><b>${escapeHtml(resolved.position)}</b></span><span class="role-chip detail-element-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z"/></svg>${escapeHtml(resolved.element || resolved.type || "-")}</span><span class="role-chip">Lv ${escapeHtml(displayLevel)}</span></div><div class="overall-comparison"><div><span>Overall<br><b>attuale</b></span><strong>${escapeHtml(resolved.overall ?? "N/D")}</strong></div><div><span>Potenziale</span><strong>${escapeHtml(potential)}</strong></div></div><p class="detail-category"><span aria-hidden="true">★</span><small>Rarità</small><strong>${escapeHtml(resolved.category)}</strong></p></div><div class="player-detail-visual ${rarityClass(resolved.category)}">${detailVisual.detailImageUrl ? `<img class="player-fullbody player-fullbody--${escapeHtml(detailVisual.detailImageKind)}" src="${escapeHtml(detailVisual.detailImageUrl)}" alt="${escapeHtml(resolved.name)}" loading="lazy" decoding="async" ${visuals.imageFallbackAttributes(detailVisual.detailFallbacks)} />` : `<span class="player-fullbody player-fullbody-placeholder" aria-hidden="true">⚽</span>`}</div></section><section class="player-detail-content"><section class="player-detail-section"><h3><span>Statistiche</span></h3><div class="detail-stats">${stats}</div></section><section class="player-detail-section player-detail-equipment"><h3><span>Equipaggiamento</span></h3>${equipmentMarkup}</section>${historical ? playerStatsMarkup(team || {}, player, runStats) : ""}${origin}</section></div>`;
    }
    return { compactCard, detailMarkup, rarityClass, statIcon, STAT_LABELS };
  }
  global.PlayerView = { create, rarityClass, statIcon, STAT_LABELS };
})(globalThis);
