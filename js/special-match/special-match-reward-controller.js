(function (global) {
  "use strict";

  function stableReward(pending) {
    return pending && {
      specialMatchId: String(pending.specialMatchId),
      currentReward: Math.max(1, Number(pending.currentReward || 1)),
      actionId: String(pending.actionId || ""),
      selectedProfileId: pending.selectedProfileId == null ? null : String(pending.selectedProfileId),
    };
  }

  function assertCurrent(current, expected, options = {}) {
    const pending = current.pendingSpecialMatchReward;
    if (!pending || String(pending.specialMatchId) !== expected.specialMatchId
      || Math.max(1, Number(pending.currentReward || 1)) !== expected.currentReward
      || String(pending.actionId || "") !== expected.actionId
      || (options.selection !== true && (pending.selectedProfileId == null ? null : String(pending.selectedProfileId)) !== expected.selectedProfileId)) {
      throw new Error("Special match reward state changed");
    }
    return pending;
  }

  function create(deps) {
    function finishCommitted(transition) {
      deps.closeModal();
      if (transition?.status === "next-reward") return show();
      return deps.renderMap({ persist: false });
    }

    function show() {
      const pending = deps.getRun().pendingSpecialMatchReward;
      if (!pending) return deps.renderMap({ persist: false });
      const expected = stableReward(pending);
      const reward = deps.view.model(pending);
      deps.view.render(reward);

      deps.getModalRoot().querySelectorAll("[data-player-id]").forEach((card) => card.addEventListener("click", () => {
        const profileId = deps.view.candidateProfileId(card, reward.candidates);
        deps.persistMutation({
          label: "special-reward-select",
          mutate: (current) => global.SpecialMatchRuntime.selectRewardCandidate(current, profileId, assertCurrent(current, expected, { selection: true })),
          onCommitted: show,
          rerender: ({ ok }) => { if (!ok) show(); },
        });
      }));

      deps.getDocument().getElementById("decline-special-reward")?.addEventListener("click", (event) => {
        if (event.currentTarget.disabled) return;
        deps.view.disableActions();
        let result;
        deps.persistMutation({
          label: "special-reward-decline",
          mutate: (current) => {
            result = global.SpecialMatchRuntime.decline(current, assertCurrent(current, expected), deps.getSeasonDb());
            if (result.transition?.status !== "next-reward") current.phase = "map";
          },
          onCommitted: () => {
            deps.closeModal();
            if (result.status === "declined") deps.toast("Ricompensa rifiutata");
            if (result.transition?.status === "next-reward") return show();
            return deps.renderMap({ persist: false });
          },
          rerender: ({ ok }) => { if (!ok) show(); },
        });
      });

      deps.getDocument().getElementById("claim-special-reward").addEventListener("click", (event) => {
        if (event.currentTarget.disabled) return;
        event.currentTarget.disabled = true;
        if (!reward.selected) {
          let transition;
          return deps.persistMutation({
            label: "special-reward-empty",
            mutate: (current) => {
              transition = global.SpecialMatchRuntime.completeCurrentReward(current, deps.getSeasonDb(), assertCurrent(current, expected));
              if (transition.status !== "next-reward") current.phase = "map";
            },
            onCommitted: () => finishCommitted(transition),
            rerender: ({ ok }) => { if (!ok) show(); },
          });
        }
        let transition;
        deps.recruitPlayer(reward.selected, deps.seasonSource(deps.getRun().seasonId), reward.level, (result) => {
          if (result.status.startsWith("committed-")) finishCommitted(transition);
          if (result.status === "cancelled") show();
        }, {
          allowCancel: true,
          cancelLabel: "RIFIUTA",
          recruitmentSource: "special_match_reward",
          actionId: expected.actionId,
          transactionMutate: (current) => {
            transition = global.SpecialMatchRuntime.completeCurrentReward(current, deps.getSeasonDb(), assertCurrent(current, expected));
            if (transition.status !== "next-reward") current.phase = "map";
          },
          onRecover: show,
        });
      });
    }

    return { show, stableReward, assertCurrent };
  }

  global.SpecialMatchRewardControllerRuntime = { create, stableReward, assertCurrent };
})(globalThis);
