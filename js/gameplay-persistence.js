(function (global) {
  "use strict";

  const MESSAGES = {
    generic: "Salvataggio non riuscito. L'azione non è stata registrata.",
    stale: "La run è stata aggiornata in un'altra scheda. Ho ricaricato l'ultima versione salvata.",
    unreadable: "Il salvataggio locale più recente non è leggibile. L'azione è stata bloccata.",
    mutation: "L'azione non è stata completata.",
  };

  function failureKind(error) {
    const code = String(error?.code || error?.name || "").toLowerCase();
    if (code.includes("stale") || code.includes("write-locked") || code.includes("locked")) return "stale";
    return "generic";
  }

  function defaultCloneRun(run) {
    if (typeof structuredClone === "function") return structuredClone(run);
    return JSON.parse(JSON.stringify(run));
  }

  function create({ save, load, getRun, replaceRun, stopRuntime, reportFailure, reportMutationFailure, cloneRun = defaultCloneRun }) {
    if (![save, load, getRun, replaceRun].every((value) => typeof value === "function")) throw new TypeError("GameplayPersistence requires save, load, getRun and replaceRun");
    return function persistGameplayMutation(options = {}) {
      const current = getRun();
      if (!current) return { ok: false, kind: "unreadable", error: new Error("No active run") };
      const before = cloneRun(current);
      const seasonId = current.seasonId;
      let value;
      try {
        value = options.mutate?.(current);
      } catch (error) {
        replaceRun(before);
        const failure = { error, kind: "mutation", stage: "mutation", run: before, before, canonical: undefined };
        if (options.onMutationError) options.onMutationError(failure);
        else reportMutationFailure?.(MESSAGES.mutation, error, options);
        options.rerender?.({ ok: false, ...failure });
        return { ok: false, ...failure };
      }
      try {
        save(current, options.saveOptions);
      } catch (error) {
        stopRuntime?.(error, options);
        let canonical = null;
        try { canonical = load(seasonId, { readOnly: true }); } catch (_) { canonical = null; }
        const kind = canonical ? failureKind(error) : "unreadable";
        const recovered = canonical || before;
        replaceRun(recovered);
        const message = MESSAGES[kind];
        reportFailure?.(message, kind, error, options);
        options.onFailure?.({ error, kind, stage: "persistence", message, canonical, run: recovered });
        options.rerender?.({ ok: false, kind, stage: "persistence", canonical, run: recovered });
        return { ok: false, kind, stage: "persistence", error, run: recovered, canonical };
      }
      options.onCommitted?.(value, current);
      options.rerender?.({ ok: true, run: current, value });
      return { ok: true, value, run: current };
    };
  }

  global.GameplayPersistence = Object.freeze({ create, failureKind, MESSAGES });
})(typeof window !== "undefined" ? window : globalThis);
