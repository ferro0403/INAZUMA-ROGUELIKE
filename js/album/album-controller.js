(function (global) {
  "use strict";

  const ALBUM_COLLECTION_PRESENTATION = Object.freeze({
    ie1: Object.freeze({
      coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTljpQy0-8hZqy9NP7BmOZwijtzN9VGYbXEN4bR2bPW8GiaccWADFA3RAlYclPfO8HSr9aEgR8H_NWF-al-1MLXlH6ToD-mMNUKwTsaSKlKvUCEY1xzg_2auQvhA3usKf5qPwV8Iawi6pm/s1600/wallpapers_inazuma11_1_1024x768.jpg",
      focalPoint: "center",
    }),
    ie1_s2: Object.freeze({
      coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven/images/9/9b/%28Artwork%29_Aliea_Gakuen_captains.jpg/revision/latest?cb=20120722223451",
      focalPoint: "center 42%",
    }),
    ie1_s3: Object.freeze({
      coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven-fanon/images/6/67/Inazuma-boys-inazuma-eleven-35597232-1600-1200_%281%29.jpg/revision/latest?cb=20140310150638",
      focalPoint: "center",
    }),
    ie2: Object.freeze({
      coverUrl: "https://www.akibagamers.it/wp-content/uploads/2019/12/inazuma-eleven-great-road-of-heroes-cover.jpg",
      focalPoint: "center 38%",
    }),
  });

  function isInazumaEleven2Collection(collection) {
    const collectionId = String(collection?.id || "").trim().toLowerCase();
    const collectionName = String(collection?.name || "").trim().toLowerCase();
    return collectionId === "ie1_s2" || collectionName === "inazuma eleven 2";
  }

  function albumCollectionPresentation(collection) {
    const collectionId = String(collection?.id || "");
    const databasePresentation = global.SeasonRegistry?.database?.(collection?.seasonId || collectionId)?.presentation;
    const basePresentation = databasePresentation?.menuImageUrl
      ? {
          coverUrl: databasePresentation.menuImageUrl,
          focalPoint: databasePresentation.menuImageFocalPoint || "center",
        }
      : ALBUM_COLLECTION_PRESENTATION[collectionId] || {
          coverUrl: collection?.coverUrl || "",
          focalPoint: "center",
        };
    return {
      ...basePresentation,
      zoomOut: isInazumaEleven2Collection(collection),
    };
  }
  function create(deps) {
    const { app, getUi, getRun, prepareAlbumLegacyContext, getSeasonDb, getFreeAgentsDb, getSeasonPlayersById, getActiveSeason, loadSeason, isProfileAwareSeason, closeModal, resetRenderedViewScroll, bindSectionRootNav, showPlayerDetailsFor, scrollSnapshot, view } = deps;
    const ui = getUi();
    function albumHallTeams() {
      return (global.HallOfFameStorage?.listSummaries?.() || []).map((summary) => global.HallOfFameStorage.getTeam(summary.hallTeamId)).filter(Boolean);
    }
    function albumUnlockedSetFromState(collectionId, progress) {
      const id = String(collectionId || global.AlbumProgress.DEFAULT_COLLECTION_ID);
      const unlocked = progress?.collections?.[id]?.unlockedPlayerIds;
      return new Set(Object.keys(unlocked && typeof unlocked === "object" ? unlocked : {}));
    }
    // LEGACY ONE-WAY RUN → ALBUM BACKFILL BRIDGE. IndexedDB already owns migration/backfill,
    // so do not materialize Hall snapshots for a facade call that is intentionally a no-op.
    function ensureBackfill() {
      if (global.AlbumIndexedDbStorage?.isAuthority?.() === true) return 0;
      return global.AlbumProgress?.backfillAlbumProgress?.({ run: getRun(), hallTeams: albumHallTeams() }) || 0;
    }
  function albumFreeAgentPlayers(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    return global.AlbumCatalog.freeAgentPlayers(getFreeAgentsDb()?.players, collectionId);
  }

  function albumCollectionPlayers(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    const db = global.SeasonRegistry.database(collectionId) || getSeasonDb();
    const byId = new Map();
    (db?.players || []).forEach((player) => byId.set(String(player.playerId), { ...player, albumDatabase: db }));
    albumFreeAgentPlayers(collectionId).forEach((player) => { if (!byId.has(String(player.playerId))) byId.set(String(player.playerId), { ...player, albumDatabase: getFreeAgentsDb() }); });
    return [...byId.values()];
  }

  function albumCollectionProgress(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID, progressState = undefined, unlockedSet = undefined) {
    const state = progressState || global.AlbumProgress.read();
    const unlocked = unlockedSet || albumUnlockedSetFromState(collectionId, state);
    const totalIds = new Set(albumCollectionPlayers(collectionId).map((player) => String(player.playerId)));
    return { unlocked: [...totalIds].filter((id) => unlocked.has(id)).length, total: totalIds.size };
  }

  function albumTeamLogoMarkup(team) {
    if (team?.logoUrl) return `<img src="${view.escapeHtml(team.logoUrl)}" alt="${view.escapeHtml(team.teamName || team.name)}" loading="lazy" decoding="async" />`;
    return `<span class="album-free-agent-logo" aria-hidden="true">⚽</span>`;
  }

  function homeAlbumCardMarkup() {
    return `<article class="home-hub-card album-home-card" aria-label="Album">
      <div class="home-card-kicker"><span>▣</span><strong>ALBUM</strong></div>
      <h2>Album</h2>
      <p class="muted">Completa la collezione dei giocatori.</p>
      <div class="stat-grid home-stat-grid"><div class="stat-card"><span>ALBUM</span><strong>${Object.keys(global.AlbumProgress?.ALBUM_COLLECTIONS || {}).length} COLLEZIONI</strong></div></div>
      <div class="home-card-actions"><button type="button" class="btn btn-yellow" id="open-album-home">Apri Album</button></div>
    </article>`;
  }

  function albumProgressForPlayers(players, collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID, progressState = undefined, unlockedSet = undefined) {
    const state = progressState || global.AlbumProgress.read();
    const unlocked = unlockedSet || albumUnlockedSetFromState(collectionId, state);
    const ids = [...new Set((players || []).map((player) => String(player.playerId)))];
    return { unlocked: ids.filter((id) => unlocked.has(id)).length, total: ids.length };
  }

  function albumPlayerView(player, database, state = undefined) {
    const basePotential = Number(player.basePotential ?? player.finalOverall ?? 0);
    const final = global.DevelopmentRuntime.resolveAccountPlayer(player, Number(player.maxLevel || 20), database, state ? { state } : undefined);
    return { ...player, basePotential, overall: final.overall, finalOverall: final.overall, potential: final.potential, category: final.category, stats: final.stats, baseStats: final.stats, displayLevel: Number(player.maxLevel || 20), albumDatabase: database };
  }

  function albumProgressPercent(progress) {
    const unlocked = Number(progress?.unlocked);
    const total = Number(progress?.total);
    const safeUnlocked = Number.isFinite(unlocked) ? Math.max(0, unlocked) : 0;
    const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
    if (safeTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (safeUnlocked / safeTotal) * 100));
  }

  async function renderAlbumCollections() {
    prepareAlbumLegacyContext();
    const currentSeasonId = getActiveSeason()?.id || global.SeasonRegistry.activeId();
    await Promise.all(Object.values(global.AlbumProgress.ALBUM_COLLECTIONS).map((collection) => global.SeasonRegistry.loadDatabase(collection.seasonId)));
    global.SeasonRegistry.setActive(currentSeasonId);
    ensureBackfill();
    const albumProgressState = global.AlbumProgress.read();
    const unlockedByCollection = new Map(Object.keys(global.AlbumProgress.ALBUM_COLLECTIONS).map((collectionId) => [collectionId, albumUnlockedSetFromState(collectionId, albumProgressState)]));
    const collectionCards = Object.values(global.AlbumProgress.ALBUM_COLLECTIONS).map((collection) => {
      const progress = albumCollectionProgress(collection.id, albumProgressState, unlockedByCollection.get(collection.id));
      const percent = albumProgressPercent(progress);
      const percentLabel = `${Math.round(percent)}%`;
      const presentation = albumCollectionPresentation(collection);
      return `<button type="button" class="panel album-collection-card" data-album-collection="${view.escapeHtml(collection.id)}" aria-label="Apri collezione ${view.escapeHtml(collection.name)}: ${view.escapeHtml(progress.unlocked)} su ${view.escapeHtml(progress.total)} giocatori sbloccati, ${view.escapeHtml(percentLabel)}"><span class="album-collection-cover album-collection-cover--hero${presentation.zoomOut ? " album-collection-cover--zoom-out" : ""}"><img src="${view.escapeHtml(presentation.coverUrl)}" alt="" style="object-position:${view.escapeHtml(presentation.focalPoint)}" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');" /></span><span class="album-collection-content album-collection-content--hero"><span class="album-collection-title">${view.escapeHtml(collection.name)}</span><span class="album-collection-progress-copy"><span>${view.escapeHtml(progress.unlocked)} / ${view.escapeHtml(progress.total)} giocatori sbloccati</span><strong>${view.escapeHtml(percentLabel)}</strong></span><span class="album-collection-progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span><span class="album-collection-action">Apri collezione <span aria-hidden="true">→</span></span></span></button>`;
    }).join("");
    app.innerHTML = `<main class="album-screen album-collections-screen"><header class="topbar album-topbar album-collections-topbar">${view.sectionRootButton("albumRoot", "album-collections-home-button")}<div class="album-collections-heading"><p class="eyebrow">ALBUM</p><h1>COLLEZIONI</h1><p class="muted">Progressi permanenti, separati dalla run attiva.</p></div><span class="album-collections-topbar-spacer" aria-hidden="true"></span></header><section class="album-collection-grid">${collectionCards}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-album-collection]").forEach((button) => button.addEventListener("click", () => renderAlbumTeams(button.dataset.albumCollection)));
  }

  function albumTeamsView(collectionId = ui.albumCollectionId, database = getSeasonDb()) {
    const teams = global.RecruitmentPoolRuntime.orderedAlbumTeams(database, Boolean(database?.recruitmentPool?.entries), isProfileAwareSeason(collectionId));
    const freeAgentsTeam = { teamId: "__free_agents", teamName: "Svincolati", logoUrl: null, playerIds: albumFreeAgentPlayers(collectionId).map((player) => String(player.playerId)), freeAgents: true };
    return [...teams, freeAgentsTeam];
  }

  function albumTeamPlayers(team, collectionId = ui.albumCollectionId) {
    if (team?.freeAgents) return albumFreeAgentPlayers(collectionId);
    if (isProfileAwareSeason(collectionId) && team?.playerProfileIds?.length) {
      return team.playerProfileIds.map((profileId) => {
        const profile = global.ProfiledSeasonRuntime.resolveProfile(collectionId, profileId);
        return profile ? { ...global.ProfiledSeasonRuntime.resolveEffectiveBase({ playerId: profile.playerId, activeProfileId: profile.profileId, activeRoleVariantId: profile.defaultRoleVariantId }, collectionId), albumProfileId: profile.profileId } : null;
      }).filter(Boolean);
    }
    return (team?.playerIds || []).map((id) => getSeasonPlayersById().get(String(id))).filter(Boolean);
  }

  async function renderAlbumTeams(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    closeModal({ invokeOnClose: false });
    await loadSeason(collectionId);
    ui.albumCollectionId = collectionId;
    const collection = global.AlbumProgress.ALBUM_COLLECTIONS[collectionId];
    ensureBackfill();
    const albumProgressState = global.AlbumProgress.read();
    const unlocked = albumUnlockedSetFromState(collectionId, albumProgressState);
    const teams = albumTeamsView(collectionId);
    const teamCards = teams.map((team) => {
      const players = albumTeamPlayers(team, collectionId);
      const progress = albumProgressForPlayers(players, collectionId, albumProgressState, unlocked);
      const percent = albumProgressPercent(progress);
      const percentLabel = `${Math.round(percent)}%`;
      const complete = progress.total > 0 && progress.unlocked === progress.total;
      return `<button type="button" class="panel album-team-card album-team-card--modern ${complete ? "album-complete" : ""}" data-album-team="${view.escapeHtml(team.teamId)}" aria-label="${view.escapeHtml(team.teamName)}: ${view.escapeHtml(progress.unlocked)} su ${view.escapeHtml(progress.total)} giocatori sbloccati, ${view.escapeHtml(percentLabel)}"><span class="album-team-card__visual"><span class="album-team-logo album-team-card__logo">${albumTeamLogoMarkup(team)}</span>${complete ? '<span class="album-team-complete">COMPLETATA</span>' : ""}</span><span class="album-team-card__body"><strong class="album-team-card__name">${view.escapeHtml(team.teamName)}</strong><span class="album-team-card__progress"><span>${view.escapeHtml(progress.unlocked)} / ${view.escapeHtml(progress.total)}</span><b>${view.escapeHtml(percentLabel)}</b></span><span class="album-team-card__bar" aria-hidden="true"><span style="width:${percent}%"></span></span><span class="album-team-card__action">VEDI ROSA <span aria-hidden="true">→</span></span></span></button>`;
    }).join("");
    app.innerHTML = `<main class="album-screen album-teams-screen"><header class="topbar album-topbar album-teams-topbar">${view.sectionRootButton("albumCollection", "album-teams-back-button")}<div class="album-teams-heading"><p class="eyebrow">ALBUM → ${view.escapeHtml(collection.name)}</p><h1>SQUADRE</h1></div><span class="album-teams-topbar-spacer" aria-hidden="true"></span></header><section class="album-team-grid album-team-grid--modern">${teamCards}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    document.querySelectorAll("[data-album-team]").forEach((button) => button.addEventListener("click", () => renderAlbumRoster(collectionId, button.dataset.albumTeam)));
  }

  function renderAlbumRoster(collectionId, teamId) {
    closeModal({ invokeOnClose: false });
    ui.albumCollectionId = collectionId; ui.albumTeamId = teamId;
    const team = albumTeamsView(collectionId).find((candidate) => String(candidate.teamId) === String(teamId));
    if (!team) return renderAlbumTeams(collectionId);
    const rawPlayers = albumTeamPlayers(team, collectionId);
    const database = team.freeAgents ? getFreeAgentsDb() : getSeasonDb();
    const albumProgressState = global.AlbumProgress.read();
    const unlocked = albumUnlockedSetFromState(collectionId, albumProgressState);
    const developmentState = global.DevelopmentAccountV3.read();
    const rawById = new Map(rawPlayers.map((player) => [String(player.playerId), player]));
    const resolvedById = new Map();
    const progress = { unlocked: rawPlayers.filter((player) => unlocked.has(String(player.playerId))).length, total: rawPlayers.length };
    const pageSize = 60;
    let visibleCount = rawPlayers.length > 80 ? pageSize : rawPlayers.length;
    const resolvedPlayer = (raw) => {
      const id = String(raw.playerId);
      if (!resolvedById.has(id)) resolvedById.set(id, albumPlayerView(raw, database, developmentState));
      return resolvedById.get(id);
    };
    const rosterMarkup = () => {
      const visible = rawPlayers.slice(0, visibleCount);
      const cards = visible.map((raw) => {
        const player = resolvedPlayer(raw);
        const isUnlocked = unlocked.has(String(player.playerId));
        return `<div class="album-player-entry ${isUnlocked ? "is-unlocked" : "is-locked"}" data-album-player-entry="${view.escapeHtml(player.playerId)}" data-album-unlocked="${isUnlocked ? "true" : "false"}">${view.playerCard(player, { button: true, dataAttribute: "data-album-player", level: player.maxLevel || 20, database: player.albumDatabase, resolvedPlayer: player })}${isUnlocked ? "" : `<span class="album-lock-overlay album-player-lock"><span aria-hidden="true">🔒</span>Non sbloccato</span>`}</div>`;
      }).join("");
      const remaining = rawPlayers.length - visible.length;
      return `${cards}${remaining > 0 ? `<div class="album-load-more-wrap"><button type="button" class="btn btn-yellow album-load-more" data-album-load-more>MOSTRA ALTRI ${view.escapeHtml(Math.min(pageSize, remaining))}</button><small>${view.escapeHtml(visible.length)} di ${view.escapeHtml(rawPlayers.length)}</small></div>` : ""}`;
    };
    app.innerHTML = `<main class="album-screen album-roster-screen"><header class="topbar album-topbar album-roster-header"><div class="album-roster-title"><span class="album-team-logo album-team-logo--header album-roster-logo">${albumTeamLogoMarkup(team)}</span><div class="album-roster-heading"><p class="eyebrow album-roster-breadcrumb">Album → ${view.escapeHtml(global.AlbumProgress.ALBUM_COLLECTIONS[collectionId]?.name || collectionId)}</p><h1 class="album-roster-name">${view.escapeHtml(team.teamName)}</h1><p class="muted album-roster-progress">${view.escapeHtml(progress.unlocked)} / ${view.escapeHtml(progress.total)} giocatori sbloccati</p></div></div>${view.sectionRootButton("albumRoster", "album-roster-action")}</header><section class="album-player-grid" data-album-roster>${rosterMarkup()}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    const albumRoster = document.querySelector("[data-album-roster]");
    bindAlbumRosterInteractions(albumRoster, ({ playerId }) => {
      const raw = rawById.get(String(playerId));
      const player = raw ? resolvedPlayer(raw) : null;
      if (!player) {
        console.error("Album player not found", { collectionId, teamId, playerId });
        return;
      }
      const isUnlocked = unlocked.has(String(player.playerId));
      showPlayerDetailsFor(player, { mode: "album", readOnly: true, playerId: player.playerId, level: player.maxLevel || 20, database: player.albumDatabase, equipment: null, preserveScroll: scrollSnapshot(), albumUnlocked: isUnlocked });
    });
    albumRoster?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-album-load-more]")) return;
      visibleCount = Math.min(rawPlayers.length, visibleCount + pageSize);
      albumRoster.innerHTML = rosterMarkup();
    });
  }

  function bindAlbumRosterInteractions(albumRoster, openPlayer) {
    if (!albumRoster) return;
    // Keep one delegated listener while refreshing the resolver after every roster render.
    albumRoster.albumOpenPlayer = openPlayer;
    if (albumRoster.dataset.albumInteractionBound === "true") return;
    albumRoster.dataset.albumInteractionBound = "true";
    albumRoster.addEventListener("click", (event) => {
      const origin = typeof event.target?.closest === "function" ? event.target : event.target?.parentElement;
      const entry = origin?.closest("[data-album-player-entry]");
      const button = origin?.closest("[data-album-player]");
      const target = entry || button;
      if (!target || !albumRoster.contains(target)) return;
      event.preventDefault();
      albumRoster.albumOpenPlayer?.({ playerId: String(entry?.dataset.albumPlayerEntry ?? button.dataset.albumPlayer), entry, button });
    });
  }

    return { renderCollections: renderAlbumCollections, renderTeams: renderAlbumTeams, renderRoster: renderAlbumRoster, ensureBackfill, playerView: albumPlayerView, bindRosterInteractions: bindAlbumRosterInteractions };
  }
  global.AlbumController = Object.freeze({ create });
})(globalThis);
