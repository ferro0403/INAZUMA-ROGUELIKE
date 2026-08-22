(function (global) {
  "use strict";

  const MESSAGES = {
    generic: "Salvataggio non riuscito. L'azione non è stata registrata.",
    stale: "La run è stata aggiornata in un'altra scheda. Ho ricaricato l'ultima versione salvata.",
    unreadable: "Il salvataggio locale più recente non è leggibile. L'azione è stata bloccata.",
  };

  function failureKind(error) {
    const code = String(error?.code || error?.name || "").toLowerCase();
    if (code.includes("stale") || code.includes("write-locked") || code.includes("locked")) return "stale";
    return "generic";
  }

  function create({ save, load, getRun, replaceRun, stopRuntime, reportFailure }) {
    if (![save, load, getRun, replaceRun].every((value) => typeof value === "function")) throw new TypeError("GameplayPersistence requires save, load, getRun and replaceRun");
    return function persistGameplayMutation(options = {}) {
      const current = getRun();
      if (!current) return { ok: false, kind: "unreadable", error: new Error("No active run") };
      const seasonId = current.seasonId;
      let value;
      try {
        value = options.mutate?.(current);
        save(current, options.saveOptions);
      } catch (error) {
        stopRuntime?.(error, options);
        let canonical = null;
        try { canonical = load(seasonId, { readOnly: true }); } catch (_) { canonical = null; }
        const kind = canonical ? failureKind(error) : "unreadable";
        if (canonical) replaceRun(canonical);
        const message = MESSAGES[kind];
        reportFailure?.(message, kind, error, options);
        options.onFailure?.({ error, kind, message, canonical });
        options.rerender?.({ ok: false, kind, canonical });
        return { ok: false, kind, error, run: canonical };
      }
      options.onCommitted?.(value, current);
      options.rerender?.({ ok: true, run: current, value });
      return { ok: true, value, run: current };
    };
  }

  global.GameplayPersistence = Object.freeze({ create, failureKind, MESSAGES });
})(typeof window !== "undefined" ? window : globalThis);
