(function (global) {
  "use strict";
  function create(deps) {
    const {
      view,
      openModal,
      closeModal,
      toast,
      getModalRoot,
      getFreeAgentsDb,
      getRosterEntry,
      resolveRosterPlayer,
      databaseForEntry,
      unequipPlayerItem,
      renderSquad,
    } = deps;
    function showFor(player, options = {}) {
      if (!player) return toast("Giocatore non disponibile");
      const opts = {
        playerId: player.playerId,
        level: player.displayLevel ?? 0,
        database: getFreeAgentsDb(),
        equipment: null,
        onClose: null,
        ...options,
      };
      openModal(view.detailMarkup(player, opts), {
        closeable: true,
        className: `player-detail-modal${opts.mode === "album" ? " album-player-detail-modal" : ""}`,
        onClose: opts.onClose,
        preserveScroll: opts.preserveScroll,
      });
      if (!opts.readOnly) {
        const unequipButton = getModalRoot().querySelector(
          "[data-detail-unequip]",
        );
        unequipButton?.addEventListener("click", () => {
          unequipPlayerItem(opts.playerId, {
            render: () => {
              closeModal();
              renderSquad();
            },
          });
        });
      }
    }
    function showRosterPlayer(playerId, onClose = null) {
      const entry = getRosterEntry(playerId);
      const player = resolveRosterPlayer(playerId);
      if (!entry || !player) return toast("Giocatore non disponibile");
      return showFor(player, {
        playerId,
        level: player.displayLevel,
        database: databaseForEntry(entry),
        equipment: player.equipment,
        onClose,
      });
    }
    return { showFor, showRosterPlayer };
  }
  global.PlayerDetailController = { create };
})(globalThis);
