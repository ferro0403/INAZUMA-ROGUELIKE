(function (global) {
  "use strict";

  const base = global.DevelopmentCenterController;
  if (!base?.create) return;
  const baseCreate = base.create.bind(base);

  function create(deps) {
    const controller = baseCreate(deps);
    let regressionIntent = null;
    let evolutionSubmitting = false;
    let regressionSubmitting = false;

    function authority() {
      return global.DevelopmentIndexedDbStorage?.isAuthority?.() === true;
    }

    function cupSelectionFromModal() {
      return Object.fromEntries(Array.from(document.querySelectorAll("[data-cup-count]")).map((node) => [String(node.dataset.cupCount || ""), Math.max(0, Math.floor(Number(node.textContent) || 0))]).filter(([id]) => id));
    }

    function unlocked(playerId) {
      return Object.keys(global.AlbumProgress?.ALBUM_COLLECTIONS || {}).some((collectionId) => global.AlbumProgress.isAlbumPlayerUnlocked(collectionId, playerId));
    }

    async function confirmEvolution(button) {
      if (evolutionSubmitting || button.disabled) return;
      evolutionSubmitting = true;
      button.disabled = true;
      const playerId = String(deps.getUi()?.selectedDevelopmentPlayerId || "");
      const database = deps.getFreeAgentsDb();
      const rawPlayer = (database?.players || []).find((candidate) => String(candidate.playerId) === playerId);
      if (!rawPlayer) {
        evolutionSubmitting = false;
        deps.closeModal({ invokeOnClose: false });
        deps.toast("Giocatore non trovato nel database svincolati");
        return controller.render("players");
      }
      let result;
      try {
        result = await global.DevelopmentAccountV3.evolveAsync({
          playerId,
          basePlayer: rawPlayer,
          unlocked: unlocked(playerId),
          freeAgentEligible: true,
          cupSelection: cupSelectionFromModal(),
        }, { database });
      } catch (error) {
        result = { ok: false, reason: "persistence", error };
      }
      evolutionSubmitting = false;
      if (!result?.ok) {
        deps.closeModal({ invokeOnClose: false });
        deps.toast(result?.reason === "not_free_agent" ? "Giocatore non eleggibile: non è svincolato" : result?.reason === "rarity-capacity-full" ? `Slot ${result.rarity} esauriti (${result.used}/${result.capacity}).` : result?.reason === "stale-evolution" ? "Evoluzione già cambiata in un'altra scheda: stato aggiornato" : "Risorse cambiate: evoluzione non completata");
        controller.invalidate?.();
        return controller.render("players");
      }
      controller.invalidate?.();
      const written = global.DevelopmentAccountV3.read().players?.[playerId];
      const activeWritten = written?.steps?.at(-1) || written?.legacyNormale;
      const writeIsCurrent = (activeWritten?.rarity || activeWritten?.profile?.category) === result.target && Number(activeWritten?.toPotential) >= Number(global.DevelopmentV2.threshold(result.target));
      if (!writeIsCurrent) {
        deps.closeModal({ invokeOnClose: false });
        deps.toast("Evoluzione non salvata: stato non coerente");
        return controller.render("players");
      }
      const updated = deps.albumPlayerView(rawPlayer, database);
      deps.closeModal({ invokeOnClose: false });
      deps.toast(`${updated.name}: ${updated.category}`);
      controller.render("players");
      return deps.showPlayerDetailsFor(updated, { playerId: updated.playerId, level: updated.displayLevel, database, equipment: null, readOnly: true, preserveScroll: deps.scrollSnapshot() });
    }

    async function confirmRegression(button) {
      if (regressionSubmitting || button.disabled) return;
      regressionSubmitting = true;
      button.disabled = true;
      const intent = regressionIntent;
      let result;
      try {
        result = intent?.playerId
          ? await global.DevelopmentAccountV3.regressAsync({ playerId: intent.playerId, expectedActiveId: intent.expectedActiveId }, { database: deps.getFreeAgentsDb() })
          : { ok: false, reason: "stale-regression" };
      } catch (error) {
        result = { ok: false, reason: "persistence", error };
      }
      regressionSubmitting = false;
      deps.closeModal({ invokeOnClose: false });
      if (!result?.ok) {
        deps.toast(result?.reason === "stale-regression" ? "Evoluzione già cambiata: aggiornata la lista" : "Regressione non salvata", "error");
        controller.invalidate?.();
        return controller.render("management");
      }
      controller.invalidate?.();
      const rowName = intent?.name || intent?.playerId || "Giocatore";
      deps.toast(`${rowName}: ${result.to.rarity} ${result.to.potential}`);
      regressionIntent = null;
      return controller.render("management");
    }

    document.addEventListener("click", (event) => {
      const regressionButton = event.target?.closest?.("[data-regress-management-player]");
      if (regressionButton && authority()) {
        const playerId = String(regressionButton.dataset.regressManagementPlayer || "");
        const preview = global.DevelopmentAccountV3.previewRegression({ playerId }, { database: deps.getFreeAgentsDb() });
        if (preview?.ok) {
          const row = event.target.closest?.("[data-management-player]");
          regressionIntent = { playerId, expectedActiveId: preview.removedId, name: row?.querySelector?.("h3")?.textContent || playerId };
        } else regressionIntent = null;
        return;
      }

      const evolutionConfirm = event.target?.closest?.("#confirm-evolution");
      if (evolutionConfirm && authority()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void confirmEvolution(evolutionConfirm);
        return;
      }

      const regressionConfirm = event.target?.closest?.("[data-confirm-regression]");
      if (regressionConfirm && authority()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void confirmRegression(regressionConfirm);
      }
    }, true);

    return controller;
  }

  global.DevelopmentCenterController = Object.freeze({ ...base, create });
})(globalThis);
