(function (global) {
  "use strict";
  global.SeasonSelectionController = {
    create(d) {
      const timestamp = (run) =>
        Math.max(
          0,
          ...[run?.lastPlayedAt, run?.updatedAt, run?.createdAt].map(
            (value) => Date.parse(value || "") || 0,
          ),
        );
      async function selectSeason(seasonId, { markPlayed = false } = {}) {
        await d.loadSeason(seasonId);
        d.setRun(global.RunState.load(d.getActiveSeason().id));
        d.ensureRunSchema();
        const run = d.getRun();
        if (!run?.finalization || run.finalization.status === "complete")
          if (
            run?.permanentEffectOutbox?.some(
              (effect) => effect.status === "pending",
            )
          )
            d.drainPermanentEffects();
        if (!run) return true;
        const probe = global.RunState.clone(run);
        const needsBossLevelMigration =
          global.RoguelikeRules.migrateDefeatedBossPlayerLevels(
            probe,
            d.getSeasonDb(),
          ) > 0;
        if (markPlayed || needsBossLevelMigration) {
          const persisted = global.RunState.persistMutationOrRecover(
            run,
            (current) => {
              if (markPlayed)
                current.lastPlayedAt = new Date().toISOString();
              if (needsBossLevelMigration)
                global.RoguelikeRules.migrateDefeatedBossPlayerLevels(
                  current,
                  d.getSeasonDb(),
                );
            },
            {
              source: markPlayed
                ? "season-select-resume"
                : "boss-level-migration-season-select",
            },
          );
          d.setRun(persisted.run);
          if (!persisted.ok) {
            console.error("save failed (season selection)", persisted.error);
            return false;
          }
        }
        return true;
      }
      async function renderSeasonSelect({ preserveScroll = null } = {}) {
        await d.loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID);
        const seasons = global.SeasonRegistry.list();
        await Promise.all(
          seasons.map((season) =>
            global.SeasonRegistry.loadDatabase(season.id),
          ),
        );
        const runs = seasons.map((season) => ({
          season,
          savedRun: global.RunState.load(season.id, { readOnly: true }),
        }));
        const latest = Math.max(
          0,
          ...runs
            .filter(
              (x) => x.savedRun && global.RunState.isActiveRun(x.savedRun),
            )
            .map((x) => timestamp(x.savedRun)),
        );
        d.app.innerHTML = d.view.screen(
          runs
            .map(({ season, savedRun }) =>
              d.view.seasonSelectCardMarkup({
                season,
                savedRun,
                isLastPlayed: Boolean(
                  savedRun && latest && timestamp(savedRun) === latest,
                ),
              }),
            )
            .join(""),
        );
        if (preserveScroll)
          d.afterNextPaint(() => d.restorePageScroll(preserveScroll));
        else d.resetRenderedViewScroll();
        d.bindSectionRootNav();
        document.querySelectorAll("[data-season-continue]").forEach((button) =>
          button.addEventListener("click", async () => {
            const selected = await selectSeason(button.dataset.seasonContinue);
            if (selected === false) return;
            d.resumeRun();
          }),
        );
        document.querySelectorAll("[data-season-new]").forEach((button) =>
          button.addEventListener("click", async () => {
            const selected = await selectSeason(button.dataset.seasonNew);
            if (selected === false) return;
            d.startNewRun();
          }),
        );
        document
          .querySelectorAll("[data-season-delete]")
          .forEach((button) =>
            button.addEventListener("click", () =>
              openDeleteSeasonRunModal(button.dataset.seasonDelete),
            ),
          );
      }
      function openDeleteSeasonRunModal(seasonId) {
        const season = global.SeasonRegistry.get(seasonId);
        const observedGeneration = global.RunState.load(season.id, {
          readOnly: true,
        })?.storageGeneration;
        const preservedScroll = d.scrollSnapshot();
        d.openModal(
          `<div class="modal-head"><div><p class="eyebrow">${d.escapeHtml(season.name)}</p><h2>ELIMINA RUN</h2><p class="muted">Vuoi eliminare la run di questa Season? I progressi della run verranno cancellati.</p></div></div><div class="button-row"><button type="button" class="btn btn-ghost" data-cancel-delete-run>ANNULLA</button><button type="button" class="btn season-delete-button" data-confirm-delete-run>ELIMINA</button></div>`,
          {
            closeable: false,
            className: "season-delete-modal",
            preserveScroll: preservedScroll,
          },
        );
        d.modalRoot
          .querySelector("[data-cancel-delete-run]")
          ?.addEventListener("click", d.closeModal);
        d.modalRoot
          .querySelector("[data-confirm-delete-run]")
          ?.addEventListener("click", async () => {
            try {
              global.RunState.remove(season.id, {
                expectedGeneration: observedGeneration,
              });
            } catch (error) {
              d.closeModal({ invokeOnClose: false });
              if (error?.code === "stale-write") {
                d.setRun(global.RunState.load(season.id, { readOnly: true }));
                global.alert?.(
                  "La run è stata aggiornata in un'altra scheda. Ho ricaricato l'ultima versione salvata.",
                );
                return renderSeasonSelect({ preserveScroll: preservedScroll });
              }
              global.alert?.(
                "Salvataggio non riuscito. L'azione non è stata registrata.",
              );
              return;
            }
            if (d.getRun()?.seasonId === season.id) d.setRun(null);
            d.closeModal({ invokeOnClose: false });
            await renderSeasonSelect({ preserveScroll: preservedScroll });
          });
      }
      return {
        selectSeason,
        renderSeasonSelect,
        openDeleteSeasonRunModal,
        runTimestamp: timestamp,
      };
    },
  };
  global.NewRunController = {
    create(d) {
      function startRunWithIdentity(identity) {
        const localIdentity = d.normalizeTeamIdentity(identity);
        let candidate;
        try {
          candidate = global.RunState.createRun(
            localIdentity,
            d.getActiveSeason()?.id,
          );
        } catch (error) {
          const SnapshotError =
            global.DevelopmentRuntime?.DevelopmentSnapshotError;
          if (!SnapshotError || !(error instanceof SnapshotError)) throw error;
          console.error("New run Development snapshot rejected", {
            code: error.code,
            details: error.details,
          });
          d.toast(
            "Impossibile avviare la run: i dati del Centro di sviluppo richiedono una verifica.",
          );
          return false;
        }
        try {
          global.RunState.save(candidate, { replaceRun: true });
        } catch (error) {
          console.error("New run save failed", error);
          d.toast("Salvataggio non riuscito. La nuova run non è stata avviata.");
          return false;
        }
        d.setRun(candidate);
        try {
          global.RunState.saveProfileTeamIdentity(localIdentity);
        } catch (error) {
          console.warn(
            "Account profile update deferred; local run is already saved",
            { code: error?.code || "profile-write-failed" },
          );
        }
        d.closeModal({ invokeOnClose: false });
        d.renderFormationChoice();
        return true;
      }
      function startNewRunFromHome() {
        const identity = d.savedTeamIdentity();
        d.setRun(global.RunState.load(d.getActiveSeason()?.id));
        const confirmed = () => {
          const nextIdentity = d.savedTeamIdentity();
          return nextIdentity
            ? startRunWithIdentity(nextIdentity)
            : d.openTeamNameModal({ mode: "create" });
        };
        const run = d.getRun();
        if (!run || !global.RunState.isActiveRun(run))
          return identity
            ? startRunWithIdentity(identity)
            : d.openTeamNameModal({ mode: "create" });
        const seasonName = d.seasonDisplayName(d.getActiveSeason()?.id);
        const bossLine = `Boss ${Math.min(Number(run.bossIndex || 0) + 1, d.getSeasonDb()?.bossOrder?.length || 99)} · Livello ${global.LevelProgression.formatLevel(run, run.seasonId)} · ${run.lives ?? "-"} vite`;
        d.openModal(
          `<div class="modal-head"><div><p class="eyebrow">Nuova run</p><h2>Inizia nuova run</h2><p class="muted">Hai già una run attiva in ${d.escapeHtml(seasonName)}.</p></div>${d.inazumaLogoMarkup("inazuma-logo--modal")}</div><p class="home-overwrite-warning"><strong>${d.escapeHtml(bossLine)}</strong><br>Iniziando una nuova run, i progressi attuali di ${d.escapeHtml(seasonName)} verranno sostituiti. Le altre Season resteranno intatte. L’Albo d’Oro e le squadre campioni resteranno salvati.</p><div class="button-row"><button type="button" class="btn" id="cancel-new-run">Annulla</button><button type="button" class="btn btn-yellow" id="confirm-new-run">Inizia nuova run</button></div>`,
          {
            closeable: false,
            className: "team-name-modal new-run-confirm-modal",
          },
        );
        document
          .getElementById("confirm-new-run")
          .addEventListener("click", confirmed);
        document
          .getElementById("cancel-new-run")
          .addEventListener("click", d.closeModal);
      }
      return { startRunWithIdentity, startNewRunFromHome };
    },
  };
})(globalThis);
