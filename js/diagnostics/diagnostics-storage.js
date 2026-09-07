(function (global) {
  "use strict";

  const FAILURE_KEY = "inazuma.diagnostics.lastFailure.v3";
  const FAILURE_WRITE_ERROR_KEY = `${FAILURE_KEY}.writeError`;
  const PROBE_KEY = "inazuma.diagnostics.spaceProbe.v1";
  let volatileFailure = null;

  function clone(value) {
    if (value == null) return value;
    try { return structuredClone(value); }
    catch (_) {
      try { return JSON.parse(JSON.stringify(value)); }
      catch (_) { return value; }
    }
  }

  function parseJson(raw) {
    try { return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }

  function safeRead(storage, key) {
    try { return parseJson(storage?.getItem(key)); }
    catch (_) { return null; }
  }

  function safeSessionWrite(key, value) {
    try { global.sessionStorage?.setItem(key, value); return true; }
    catch (_) { return false; }
  }

  function safeLocalWrite(key, value) {
    try { global.localStorage?.setItem(key, value); return { ok: true, error: null }; }
    catch (error) { return { ok: false, error }; }
  }

  function create({ errorSnapshot }) {
    function rememberFailure(entry) {
      volatileFailure = clone(entry);
      const raw = JSON.stringify(volatileFailure);
      safeSessionWrite(FAILURE_KEY, raw);
      const local = safeLocalWrite(FAILURE_KEY, raw);
      if (!local.ok) {
        safeSessionWrite(FAILURE_WRITE_ERROR_KEY, JSON.stringify({ at: new Date().toISOString(), error: errorSnapshot(local.error) }));
      } else {
        try { global.sessionStorage?.removeItem(FAILURE_WRITE_ERROR_KEY); } catch (_) {}
      }
      return clone(volatileFailure);
    }

    function readFailure() {
      if (volatileFailure) return { source: "memory", value: clone(volatileFailure) };
      const session = safeRead(global.sessionStorage, FAILURE_KEY);
      if (session) return { source: "sessionStorage", value: session };
      const local = safeRead(global.localStorage, FAILURE_KEY);
      if (local) return { source: "localStorage", value: local };
      return { source: "none", value: null };
    }

    function readFailureWriteError() {
      return safeRead(global.sessionStorage, FAILURE_WRITE_ERROR_KEY);
    }

    function clearFailure() {
      volatileFailure = null;
      for (const storage of [global.sessionStorage, global.localStorage]) {
        try { storage?.removeItem(FAILURE_KEY); } catch (_) {}
      }
      try { global.sessionStorage?.removeItem(FAILURE_WRITE_ERROR_KEY); } catch (_) {}
    }

    function measureLocalStorage() {
      const entries = [];
      let totalBytes = 0;
      try {
        for (let index = 0; index < global.localStorage.length; index += 1) {
          const key = global.localStorage.key(index);
          if (key == null) continue;
          const value = global.localStorage.getItem(key) || "";
          const bytes = 2 * (String(key).length + String(value).length);
          totalBytes += bytes;
          if (/inazuma|^run:/i.test(key)) entries.push({ key, bytes });
        }
        entries.sort((a, b) => b.bytes - a.bytes);
        return { ok: true, totalBytes, topInazumaKeys: entries.slice(0, 12), error: null };
      } catch (error) {
        return { ok: false, totalBytes, topInazumaKeys: entries.slice(0, 12), error: errorSnapshot(error) };
      }
    }

    async function baseSnapshot() {
      try {
        const value = await global.InazumaPersistenceDiagnostics?.snapshot?.();
        return { ok: true, value: value || null, error: null };
      } catch (error) {
        return { ok: false, value: null, error: errorSnapshot(error) };
      }
    }

    async function probeStorage() {
      const sizes = [16 * 1024, 64 * 1024, 256 * 1024];
      const results = [];
      try { global.localStorage?.removeItem(PROBE_KEY); } catch (_) {}
      for (const size of sizes) {
        let outcome;
        try {
          const payload = "x".repeat(size);
          global.localStorage.setItem(PROBE_KEY, payload);
          const verified = global.localStorage.getItem(PROBE_KEY);
          if (verified?.length !== payload.length) {
            throw Object.assign(new Error("storage-probe-readback-mismatch"), { code: "storage-probe-readback-mismatch" });
          }
          outcome = { sizeBytes: size, ok: true, error: null };
        } catch (error) {
          outcome = { sizeBytes: size, ok: false, error: errorSnapshot(error) };
        } finally {
          try { global.localStorage?.removeItem(PROBE_KEY); } catch (_) {}
        }
        results.push(outcome);
        if (!outcome.ok) break;
      }
      return {
        at: new Date().toISOString(),
        results,
        maxSucceededBytes: results.filter((item) => item.ok).reduce((max, item) => Math.max(max, item.sizeBytes), 0),
        failedAtBytes: results.find((item) => !item.ok)?.sizeBytes || null,
        failure: results.find((item) => !item.ok)?.error || null,
      };
    }

    return Object.freeze({
      rememberFailure,
      readFailure,
      readFailureWriteError,
      clearFailure,
      measureLocalStorage,
      baseSnapshot,
      probeStorage,
      keys: Object.freeze({ failure: FAILURE_KEY, failureWriteError: FAILURE_WRITE_ERROR_KEY, probe: PROBE_KEY }),
    });
  }

  global.GameDiagnosticsStorage = Object.freeze({ create });
})(globalThis);
