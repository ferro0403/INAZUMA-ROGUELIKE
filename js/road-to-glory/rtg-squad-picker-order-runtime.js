(function (global) {
  "use strict";

  let controllerInstance = null;
  let lastTargetId = "";
  let pickerAscending = false;

  global.__rtgPickerOverallAscending = false;

  function rememberTarget(event) {
    const button = event.target?.closest?.("[data-rtg-change-player]");
    if (!button?.dataset?.rtgChangePlayer) return;
    lastTargetId = String(button.dataset.rtgChangePlayer);
    pickerAscending = false;
    global.__rtgPickerOverallAscending = false;
  }

  function withCandidateOrder(ascending, callback) {
    if (!ascending) return callback();
    const originalSort = Array.prototype.sort;
    Array.prototype.sort = function (compareFn) {
      if (typeof compareFn === "function" && String(compareFn).includes("rawOverall(b)-rawOverall(a)")) {
        return originalSort.call(this, (a, b) => -compareFn(a, b));
      }
      return originalSort.call(this, compareFn);
    };
    try {
      return callback();
    } finally {
      Array.prototype.sort = originalSort;
    }
  }

  function reopenPicker(ascending) {
    if (!controllerInstance || !lastTargetId) return false;
    pickerAscending = !!ascending;
    global.__rtgPickerOverallAscending = pickerAscending;
    withCandidateOrder(pickerAscending, () => controllerInstance.openSquadPlayerPicker(lastTargetId));
    return true;
  }

  global.document?.addEventListener?.("click", rememberTarget, true);
  global.document?.addEventListener?.("rtg-picker-overall-order", (event) => {
    reopenPicker(!!event?.detail?.ascending);
  });

  let assignedFactory = global.RoadToGloryController || null;
  if (!assignedFactory) {
    Object.defineProperty(global, "RoadToGloryController", {
      configurable: true,
      enumerable: true,
      get() { return assignedFactory; },
      set(factory) {
        if (!factory?.create) { assignedFactory = factory; return; }
        const originalCreate = factory.create.bind(factory);
        assignedFactory = Object.freeze({
          ...factory,
          create(deps) {
            controllerInstance = originalCreate(deps);
            return controllerInstance;
          },
        });
        Object.defineProperty(global, "RoadToGloryController", {
          configurable: true,
          enumerable: true,
          writable: true,
          value: assignedFactory,
        });
      },
    });
  }

  global.RoadToGlorySquadPickerOrderRuntime = Object.freeze({
    reopenPicker,
    getAscending: () => pickerAscending,
    getTargetId: () => lastTargetId,
  });
})(globalThis);
