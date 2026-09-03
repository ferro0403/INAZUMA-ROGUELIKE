(function (global) {
  "use strict";

  function create(dependencies) {
    const {
      view, app, getRun, getSeasonDb, getFreeAgentsDb,
      isProfileAwareSeason, formationById, persistGameplayMutation,
      resetRenderedViewScroll, bindSectionRootNav, renderHome, renderSquad,
      ensureFiveVFive, reconcileSquadRosterState, sourcePlayer,
      enqueueAlbumRecruit, unlockAlbumRecruit,
    } = dependencies;

    function players() {
      const seasonDb = getSeasonDb();
      const freeAgentsDb = getFreeAgentsDb();
      if (seasonDb?.recruitmentPool?.entries && isProfileAwareSeason()) {
        const candidates = global.RecruitmentPoolRuntime.effectiveProfiledPlayers(seasonDb, freeAgentsDb);
        return global.RecruitmentPoolRuntime.eligibleInitialDraftPlayers(candidates);
      }
      const config = seasonDb?.draftConfig;
      if (config?.freeAgentsOnly && !Array.isArray(freeAgentsDb?.players)) {
        throw new Error(`Draft ${getRun()?.seasonId}: database svincolati non disponibile (${config.databasePath || "data/FREE_AGENTS_compact.json"})`);
      }
      const candidates = freeAgentsDb?.players;
      if (!Array.isArray(candidates)) throw new Error("Draft: database svincolati non disponibile");
      const invalid = candidates.find((player) => player.profileId || global.SeasonRegistry?.isSeasonSource?.(player.source));
      if (invalid) throw new Error(`Draft corrotto: candidato ${invalid.playerId} non è uno svincolato normale`);
      return candidates;
    }

    function renderFormationChoice() {
      const currentRun = getRun();
      if (currentRun.phase !== "formation") {
        const transition = persistGameplayMutation({ label: "initial-formation-phase", mutate: (current) => { current.phase = "formation"; } });
        if (!transition.ok) return renderHome();
      }
      const canonicalRun = getRun();
      app.innerHTML = view.formationChoice({ formations: getSeasonDb().formations.eleven, formationId: canonicalRun.formationId });
      resetRenderedViewScroll();
      bindSectionRootNav();

      document.querySelectorAll("[data-formation]").forEach((button) => {
        button.addEventListener("click", () => {
          const formation = formationById(button.dataset.formation);
          const draftPlayers = players();
          persistGameplayMutation({
            label: "initial-draft-start",
            mutate(current) {
              current.formationId = formation.id;
              global.DraftEngine.start(current, formation, draftPlayers);
            },
            onCommitted: () => renderDraft(),
            rerender: ({ ok }) => { if (!ok) renderFormationChoice(); },
          });
        });
      });
    }

    function renderDraft() {
      const currentRun = getRun();
      const draftState = currentRun.draft;
      if (!draftState) return renderSquad();
      const role = draftState.roles[draftState.step];
      const draftPlayers = players();
      const draftById = new Map(draftPlayers.map((player) => [String(player.playerId), player]));
      const candidates = draftState.candidates.map((id) => draftById.get(String(id))).filter(Boolean);
      app.innerHTML = view.draft({ draftState, role, candidates, formationId: currentRun.formationId });
      resetRenderedViewScroll();
      bindSectionRootNav();

      document.querySelectorAll("[data-player-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const playerId = button.dataset.playerId;
          const currentDraftPlayers = players();
          let completed = false;
          const committed = persistGameplayMutation({
            label: "initial-draft-pick",
            mutate(current) {
              completed = global.DraftEngine.choose(current, playerId, currentDraftPlayers, formationById(current.formationId));
              if (!completed) return;
              ensureFiveVFive();
              current.roster.forEach((entry) => {
                const source = sourcePlayer(entry);
                entry.firstJoinedAt = entry.firstJoinedAt || new Date().toISOString();
                entry.recruitmentSource = entry.recruitmentSource || "initial_draft";
                entry.recruitedAtLevel = entry.recruitedAtLevel ?? entry.level ?? 0;
                entry.recruitedOverall = entry.recruitedOverall ?? source?.finalOverall ?? null;
                global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player: source || entry, playerId: entry.playerId, source: "initial_draft", level: entry.level || 0, overall: entry.recruitedOverall, actionId: `${current.runId}:initial_draft:${entry.playerId}` });
                enqueueAlbumRecruit(current, entry.playerId, "initial_draft", `${current.runId}:initial_draft:${entry.playerId}`);
              });
              current.phase = "squad";
              reconcileSquadRosterState(current);
            },
            onCommitted() {
              if (completed) getRun().roster.forEach((entry) => unlockAlbumRecruit(entry.playerId, "initial_draft"));
              completed ? renderSquad() : renderDraft();
            },
            rerender: ({ ok }) => { if (!ok) renderDraft(); },
          });
          return committed;
        });
      });
    }

    return Object.freeze({ players, renderFormationChoice, renderDraft });
  }

  global.InitialDraftController = Object.freeze({ create });
})(globalThis);
