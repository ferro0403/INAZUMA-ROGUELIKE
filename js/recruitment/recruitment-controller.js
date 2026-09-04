(function (global) {
  "use strict";

  function create(dependencies) {
    const {
      getRun, isProfileAwareSeason, persistGameplayMutation, rosterInvariants, playerIdentity,
      getProfiledSeasonRuntime, getMaxRoster, getMaxInventory, permanentRosterFields, resolvedRosterPlayer, rosterEntry,
      optimizeLineupsForNewPlayer, fiveVFive, runStatistics, enqueueAlbumRecruit, unlockAlbumRecruit,
      closeModal, toast, chooseInventoryDiscardSelection, renderMapFailureRecovery, recruitmentView,
    } = dependencies;

    function recruitPlayer(player, source, level, done, options = {}) {
      let smartLineupResult = null;
      const allowCancel = options.allowCancel !== false;
      const profileAware = isProfileAwareSeason() && Boolean(player.profileId);
      const complete = (status, extra = {}) => done?.({ status, committed: status.startsWith("committed-"), ...extra });
      const recover = (status, failure = {}) => {
        complete(status, failure);
        if (status === "recovery-blocked") {
          closeModal();
          return options.onRecoveryBlocked?.(failure) || renderMapFailureRecovery();
        }
        options.onRecover?.(status, failure);
      };
      const recruitmentSource = options.recruitmentSource || source;
      const actionId = options.actionId || `${getRun().runId}:${player.profileId || player.playerId}:recruited:${recruitmentSource}`;
      const decorateRecruit = (current, entry) => {
        const overall = resolvedRosterPlayer(entry.playerId, current)?.overall ?? player.overall ?? player.finalOverall ?? null;
        Object.assign(entry, { firstJoinedAt: new Date().toISOString(), recruitmentSource, recruitedAtLevel: level, recruitedOverall: overall });
        runStatistics?.recordRunAction?.(current, runStatistics.ACTIONS.PLAYER_RECRUITED, { player, playerId: entry.playerId, source: recruitmentSource, level, overall, actionId });
        enqueueAlbumRecruit(current, entry.playerId, recruitmentSource, actionId);
        smartLineupResult = optimizeLineupsForNewPlayer(entry.playerId, current, false);
      };
      const announceCommittedSmartLineup = () => {
        if (!smartLineupResult?.elevenChanged && !smartLineupResult?.fiveChanged) return;
        const areas = [smartLineupResult.elevenChanged ? "11v11" : null, smartLineupResult.fiveChanged ? "5v5" : null].filter(Boolean).join(" e ");
        toast(`AUTO-FORMAZIONE — aggiornata ${areas}`);
      };
      const committedSideEffects = (entry, status) => {
        if (status === "committed-acquired") unlockAlbumRecruit(entry.playerId, recruitmentSource);
        closeModal();
        toast(status === "committed-upgraded" ? "POTENZIAMENTO PROFILO" : "NUOVO GIOCATORE");
        announceCommittedSmartLineup();
        complete(status, { player: entry });
      };
      const persistenceFailure = ({ kind, ...failure }) => recover(kind === "unreadable" ? "recovery-blocked" : "persistence-failed", { kind, ...failure });

      if (profileAware) {
        let result;
        return persistGameplayMutation({
          label: "recruit-profile",
          mutate: (current) => {
            smartLineupResult = null;
            const alreadyOwned = current.roster.some((entry) => playerIdentity.canonicalPlayerId(entry) === playerIdentity.canonicalPlayerId(player));
            result = getProfiledSeasonRuntime().acquireOrUpgradeProfile(current, player, { seasonId: current.seasonId, maxRoster: getMaxRoster(), level });
            if (result.status === "roster-full") throw Object.assign(new Error("Roster full"), { code: "recruit-needs-replacement" });
            if (!["upgraded", "acquired"].includes(result.status)) throw Object.assign(new Error("Recruit not eligible"), { code: "recruit-ineligible" });
            if (result.status === "acquired") {
              if (alreadyOwned) throw Object.assign(new Error("Recruit not eligible"), { code: "recruit-ineligible" });
              current.bench.push(String(result.player.playerId)); decorateRecruit(current, result.player);
            }
            rosterInvariants.assertValid(current);
            options.transactionMutate?.(current, result.player);
          },
          onCommitted: () => committedSideEffects(result.player, result.status === "upgraded" ? "committed-upgraded" : "committed-acquired"),
          onMutationError: ({ error }) => {
            if (error?.code === "recruit-needs-replacement") return showRecruitReplacement();
            if (error?.code === "recruit-ineligible") return recover("ineligible", { error });
            console.error("Recruit mutation failed", error); recover("persistence-failed", { error });
          },
          onFailure: persistenceFailure,
        });
      }
      if (getRun().roster.length < getMaxRoster()) {
        let entry;
        return persistGameplayMutation({
          label: "recruit",
          mutate: (current) => {
            smartLineupResult = null;
            try { rosterInvariants.assertCanOwn(current, player); } catch (error) { throw Object.assign(error, { code: "recruit-ineligible" }); }
            entry = { playerId: String(player.playerId), source, level, equippedItem: null, ...permanentRosterFields(player) };
            current.roster.push(entry); current.bench.push(entry.playerId); decorateRecruit(current, entry);
            rosterInvariants.assertValid(current);
            options.transactionMutate?.(current, entry);
          },
          onCommitted: () => committedSideEffects(entry, "committed-acquired"),
          onMutationError: ({ error }) => recover(error?.code === "recruit-ineligible" ? "ineligible" : "persistence-failed", { error }),
          onFailure: persistenceFailure,
        });
      }
      return showRecruitReplacement();

      function showRecruitReplacement() {
        return recruitmentView.showRecruitReplacement({
          player, source, level, profileAware, allowCancel, cancelLabel: options.cancelLabel,
          onNeedsReplacement: () => complete("needs-replacement"),
          onSelect: prepareReplacement,
          onCancel: () => complete("cancelled"),
        });
      }

      function prepareReplacement(removeId) {
        const run = getRun();
        const selected = rosterEntry(removeId, run);
        if (!selected || !(run.bench || []).some((id) => String(id) === removeId)) return showRecruitReplacement();
        if (selected.equippedItem && run.inventory.length >= getMaxInventory()) {
          return chooseInventoryDiscardSelection("Libera uno spazio per recuperare l'oggetto equipaggiato", (discardId) => replace(removeId, discardId), showRecruitReplacement);
        }
        return replace(removeId, null);
      }

      function replace(removeId, discardInstanceId) {
        let entry;
        return persistGameplayMutation({
          label: "recruit-replacement",
          mutate: (current) => {
            smartLineupResult = null;
            const incomingId = playerIdentity.canonicalPlayerId(player);
            if (current.roster.some((candidate) => playerIdentity.canonicalPlayerId(candidate) === incomingId && String(candidate.playerId) !== String(removeId))) throw Object.assign(new Error("Canonical player already owned"), { code: "replacement-invalid" });
            const removed = rosterEntry(removeId, current);
            if (!removed || !(current.bench || []).some((id) => String(id) === removeId)) throw Object.assign(new Error("Replacement no longer valid"), { code: "replacement-invalid" });
            if (discardInstanceId) {
              const discardIndex = current.inventory.findIndex((item) => String(item.instanceId) === String(discardInstanceId));
              if (discardIndex < 0) throw Object.assign(new Error("Discard no longer valid"), { code: "replacement-invalid" });
              current.inventory.splice(discardIndex, 1);
            }
            if (removed.equippedItem) {
              if (current.inventory.length >= getMaxInventory()) throw Object.assign(new Error("Inventory still full"), { code: "replacement-invalid" });
              current.inventory.push(removed.equippedItem);
            }
            current.roster = current.roster.filter((item) => String(item.playerId) !== removeId);
            current.bench = current.bench.filter((id) => String(id) !== removeId);
            current.lineup = (current.lineup || []).filter((id) => String(id) !== removeId);
            fiveVFive.removeUnavailable(current);
            if (profileAware) {
              const acquired = getProfiledSeasonRuntime().acquireOrUpgradeProfile(current, player, { seasonId: current.seasonId, maxRoster: getMaxRoster(), level });
              if (acquired.status !== "acquired" || !acquired.player) throw Object.assign(new Error("Replacement recruit invalid"), { code: "replacement-invalid" });
              entry = acquired.player;
            } else {
              entry = { playerId: String(player.playerId), source, level, equippedItem: null, ...permanentRosterFields(player) };
              current.roster.push(entry);
            }
            current.bench.push(String(entry.playerId)); decorateRecruit(current, entry);
            fiveVFive.removeUnavailable(current);
            rosterInvariants.assertValid(current);
            options.transactionMutate?.(current, entry);
          },
          onCommitted: () => committedSideEffects(entry, "committed-acquired"),
          onMutationError: ({ error }) => { toast("Sostituzione non più valida", "error"); recover("ineligible", { error }); },
          onFailure: persistenceFailure,
        });
      }
    }

    return { recruitPlayer };
  }

  global.RecruitmentControllerRuntime = { create };
})(typeof globalThis !== "undefined" ? globalThis : window);
