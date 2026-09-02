(function (global) {
  "use strict";
  global.HomeController = { create(deps) {
    async function ensureHomeTeamEmblemSeasonLoaded(identity) { const encoded = global.TeamEmblems?.parseTeamEmblemId?.(identity?.emblemId); if (!encoded || !global.SeasonRegistry?.isSeasonSource?.(encoded.seasonId) || global.SeasonRegistry.database(encoded.seasonId)) return; const previousSeasonId = global.SeasonRegistry.activeId(); try { await global.SeasonRegistry.loadDatabase(encoded.seasonId); } finally { global.SeasonRegistry.setActive(previousSeasonId); } }
    async function renderHome() {
      deps.closeModal({ invokeOnClose: false });
      const latest = global.RunState.latestActiveSave?.();
      if (latest?.run) { await deps.loadSeason(latest.run.seasonId || latest.season.id); deps.setRun(global.RunState.load(deps.getActiveSeason().id)); if (deps.persistenceWritesAllowed() && (!deps.getRun()?.finalization || deps.getRun().finalization.status === "complete") && deps.getRun()?.permanentEffectOutbox?.some((effect) => effect.status === "pending")) deps.drainPermanentEffects(); }
      else { await deps.loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID); deps.setRun(null); }
      deps.ensureRunSchema();
      const profileIdentity = deps.migrateTeamIdentityProfile();
      // PRE-EXISTING STRUCTURAL BEHAVIOR / FUTURE HARDENING CANDIDATE.
      if (deps.persistenceWritesAllowed() && deps.getRun() && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(deps.getRun(), deps.getSeasonDb()) > 0) { try { global.RunState.save(deps.getRun()); } catch (error) { console.error("save failed (boss level migration, init)", error); } }
      await ensureHomeTeamEmblemSeasonLoaded(deps.normalizeTeamIdentity(deps.getRun()?.teamIdentity || profileIdentity || {}));
      deps.app.innerHTML = `<main class="home-screen modern-home" id="clean-home" data-run-state="${deps.getRun() ? "active" : "empty"}"><header class="home-masthead"><div class="home-wordmark" aria-label="Inazuma Roguelike · Road to Raimon"><span>Ina<span>z</span>uma</span><small>Roguelike</small><i class="home-road-label">Road to Raimon</i></div><div class="home-profile-actions">${global.InazumaAccountUI?.buttonMarkup?.() || '<button type="button" class="account-header-button" data-account-trigger disabled><span>ACCOUNT</span></button>'}<button type="button" class="home-settings-button" id="open-settings-home" aria-label="Impostazioni"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 3h4.8l.6 2.3 2 .9 2.1-1.2 2.4 4.1-1.8 1.6.2 2.2 1.8 1.6-2.4 4.1-2.3-.7-1.8 1.3-.5 2.3H9.6L9 18.3l-2-.9-2.1 1.2-2.4-4.1 1.8-1.6-.2-2.2-1.8-1.6L4.7 5l2.3.7 2-1.3L9.6 3Zm2.4 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg></button></div></header>${deps.view.homeRunCardMarkup(deps.getRun())}</main>`;
      deps.resetRenderedViewScroll();
      document.getElementById("open-modes-home")?.addEventListener("click", deps.renderSeasonSelect); document.getElementById("open-shop-home")?.addEventListener("click", deps.renderShop); document.getElementById("home-primary-cta")?.addEventListener("click", () => deps.getRun() ? deps.resumeRun() : deps.renderSeasonSelect()); document.getElementById("open-hall-home")?.addEventListener("click", deps.renderHallOfFame); document.getElementById("open-album-home")?.addEventListener("click", deps.renderAlbumCollections); document.getElementById("open-development-home")?.addEventListener("click", deps.renderDevelopmentCenter); document.getElementById("open-settings-home")?.addEventListener("click", () => deps.renderSettings({ view: "main" }));
    }
    return { renderHome, ensureHomeTeamEmblemSeasonLoaded };
  }};
})(globalThis);
