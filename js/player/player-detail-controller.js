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
      kitVisuals = null,
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
      const roleSwitchButton = getModalRoot()?.querySelector?.("[data-detail-rtg-role-switch]");
      roleSwitchButton?.addEventListener("click", (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        opts.onRtgRoleSwitch?.();
      });
      if (opts.rtgKitPreview === true) {
        const kitSelect = getModalRoot()?.querySelector?.("[data-detail-kit-select]");
        kitSelect?.addEventListener("change", () => {
          const kitId = String(kitSelect.value || "");
          const changed = kitId
            ? kitVisuals?.select?.(opts.playerId, kitId)
            : kitVisuals?.clear?.(opts.playerId);
          if (changed === false) return toast("DIVISA VR NON DISPONIBILE");
          const label = kitId
            ? kitVisuals?.optionsFor?.(opts.playerId)?.find((kit) => kit.kitId === kitId)?.label || kitId
            : "Visuale originale";
          toast(`DIVISA TEST: ${label}`);
          showFor(player, opts);
        });
      }
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
