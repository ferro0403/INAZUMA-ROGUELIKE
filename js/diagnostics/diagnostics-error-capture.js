(function (global) {
  "use strict";

  function replaceMethod(apiName, methodName, factory) {
    const api = global[apiName];
    const original = api?.[methodName];
    if (typeof original !== "function" || original.__gameDiagnosticsWrapped) return false;
    const wrapped = factory(original);
    wrapped.__gameDiagnosticsWrapped = true;
    try { api[methodName] = wrapped; } catch (_) {}
    if (api[methodName] !== wrapped) {
      try { global[apiName] = Object.freeze({ ...api, [methodName]: wrapped }); } catch (_) { return false; }
    }
    return global[apiName]?.[methodName] === wrapped;
  }

  function install({ runtime }) {
    if (global.__INAZUMA_GAME_DIAGNOSTICS_CAPTURE__) return Object.freeze({ installed: false, reason: "already-installed" });
    global.__INAZUMA_GAME_DIAGNOSTICS_CAPTURE__ = true;

    function safeRecordFailure(context) {
      try { return runtime.recordFailure(context); }
      catch (diagnosticError) {
        try { global.console?.warn?.("Game diagnostics failure capture failed", diagnosticError); } catch (_) {}
        return null;
      }
    }

    function safeRecordEvent(type, detail) {
      try { return runtime.recordEvent(type, detail); }
      catch (diagnosticError) {
        try { global.console?.warn?.("Game diagnostics event capture failed", diagnosticError); } catch (_) {}
        return null;
      }
    }

    function safeFailureKind(error) {
      try { return runtime.failureKind(error); }
      catch (_) { return "generic"; }
    }

    replaceMethod("RunState", "save", (original) => function saveWithDiagnostics(run, options = {}) {
      try { return original.call(this, run, options); }
      catch (error) {
        safeRecordFailure({ label: options?.source || "run-state-save", stage: error?.stage || "persistence", error, run });
        throw error;
      }
    });

    replaceMethod("RunState", "createCheckpoint", (original) => function checkpointWithDiagnostics(run, ...args) {
      try { return original.call(this, run, ...args); }
      catch (error) {
        safeRecordFailure({ label: "run-checkpoint", stage: error?.stage || "checkpoint", error, run });
        throw error;
      }
    });

    replaceMethod("RunState", "persistMutationOrRecover", (original) => function mutationWithDiagnostics(run, mutate, options = {}) {
      const result = original.call(this, run, mutate, options);
      if (result?.ok === false && result.error) {
        safeRecordFailure({
          label: options?.source || "run-state-mutation",
          stage: result.error?.stage || "persistence",
          error: result.error,
          kind: result.stale ? "stale" : safeFailureKind(result.error),
          run: result.run || run,
        });
      }
      return result;
    });

    replaceMethod("PermanentEffects", "drain", (original) => function drainWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) safeRecordFailure({ label: "permanent-effects-drain", stage: result.error?.stage || "permanent-effect", error: result.error, run });
      return result;
    });

    replaceMethod("PermanentEffects", "resumeFinalization", (original) => function finalizationWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) safeRecordFailure({ label: "finalization-resume", stage: result.error?.stage || "finalization", error: result.error, run });
      return result;
    });

    const appDiagnostics = global.AppDevDiagnostics;
    if (appDiagnostics?.create && !appDiagnostics.create.__gameDiagnosticsWrapped) {
      const originalCreate = appDiagnostics.create;
      const wrappedCreate = function createWithGameDiagnostics(options = {}) {
        const original = originalCreate(options);
        return Object.freeze({
          ...original,
          recordGameplayFailure(label, stage, error, kind = null) {
            safeRecordFailure({ label, stage, error, kind: kind || safeFailureKind(error), ...options });
            return original.recordGameplayFailure?.(label, stage, error, kind);
          },
        });
      };
      wrappedCreate.__gameDiagnosticsWrapped = true;
      global.AppDevDiagnostics = Object.freeze({ ...appDiagnostics, create: wrappedCreate });
    }

    global.addEventListener?.("error", (event) => {
      safeRecordEvent("javascript-error", {
        message: String(event?.message || event?.error?.message || "Errore JavaScript").slice(0, 420),
        filename: String(event?.filename || "").slice(0, 220) || null,
        line: event?.lineno || null,
        column: event?.colno || null,
        error: (() => { try { return runtime.errorSnapshot(event?.error); } catch (_) { return null; } })(),
      });
    });

    global.addEventListener?.("unhandledrejection", (event) => {
      const reason = event?.reason;
      safeRecordEvent("unhandled-rejection", {
        message: String(reason?.message || reason || "Promise rifiutata").slice(0, 420),
        error: (() => { try { return runtime.errorSnapshot(reason); } catch (_) { return null; } })(),
      });
    });

    return Object.freeze({ installed: true });
  }

  global.GameDiagnosticsErrorCapture = Object.freeze({ install, replaceMethod });
})(globalThis);
