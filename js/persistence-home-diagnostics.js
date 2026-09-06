(function (global) {
  "use strict";

  const FAILURE_KEY = "inazuma.persistence.lastFailure.v1";
  const FAILURE_WRITE_ERROR_KEY = `${FAILURE_KEY}.writeError`;
  const PROBE_KEY = "inazuma.persistence.spaceProbe.v1";
  const MAX_TEXT = 320;
  let volatileFailure = null;
  let uiShell = null;
  let homeObserver = null;

  function clone(value) {
    if (value == null) return value;
    try { return structuredClone(value); }
    catch (_) {
      try { return JSON.parse(JSON.stringify(value)); }
      catch (_) { return value; }
    }
  }

  function text(value, max = MAX_TEXT) {
    const normalized = String(value ?? "");
    return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
  }

  function errorSnapshot(error) {
    return {
      name: text(error?.name || "Error", 80),
      code: text(error?.code || "", 120) || null,
      stage: text(error?.stage || "", 120) || null,
      message: text(error?.message || String(error || "Errore sconosciuto")),
      recoverable: error?.recoverable === true,
      canonicalCommitted: error?.canonicalCommitted === true,
      generation: Number.isFinite(Number(error?.generation)) ? Number(error.generation) : null,
    };
  }

  function storageErrorSnapshot(error) {
    return { at: new Date().toISOString(), ...errorSnapshot(error) };
  }

  function safeSessionSet(key, value) {
    try { global.sessionStorage?.setItem(key, value); return true; }
    catch (_) { return false; }
  }

  function safeLocalSet(key, value) {
    try { global.localStorage?.setItem(key, value); return { ok: true, error: null }; }
    catch (error) { return { ok: false, error }; }
  }

  function parseStored(raw) {
    try { return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }

  function readStored(key, storage) {
    try { return parseStored(storage?.getItem(key)); }
    catch (_) { return null; }
  }

  function rememberFailure(entry) {
    const compact = clone(entry);
    volatileFailure = compact;
    const raw = JSON.stringify(compact);
    safeSessionSet(FAILURE_KEY, raw);
    const local = safeLocalSet(FAILURE_KEY, raw);
    if (!local.ok) safeSessionSet(FAILURE_WRITE_ERROR_KEY, JSON.stringify(storageErrorSnapshot(local.error)));
    else {
      try { global.sessionStorage?.removeItem(FAILURE_WRITE_ERROR_KEY); } catch (_) {}
    }
    return compact;
  }

  function readFailure() {
    if (volatileFailure) return { source: "memory", value: clone(volatileFailure) };
    const session = readStored(FAILURE_KEY, global.sessionStorage);
    if (session) return { source: "sessionStorage", value: session };
    const local = readStored(FAILURE_KEY, global.localStorage);
    if (local) return { source: "localStorage", value: local };
    return { source: "none", value: null };
  }

  function readFailureWriteError() {
    return readStored(FAILURE_WRITE_ERROR_KEY, global.sessionStorage);
  }

  function clearFailure() {
    volatileFailure = null;
    for (const storage of [global.sessionStorage, global.localStorage]) {
      try { storage?.removeItem(FAILURE_KEY); } catch (_) {}
    }
    try { global.sessionStorage?.removeItem(FAILURE_WRITE_ERROR_KEY); } catch (_) {}
  }

  function buildFailureEntry({ label, stage, error, kind, getRun, getUi, getActiveSeason, run: suppliedRun = null }) {
    const current = suppliedRun || getRun?.() || global.run || null;
    const ui = getUi?.() || {};
    const seasonId = current?.seasonId || getActiveSeason?.()?.id || global.SeasonRegistry?.activeId?.() || null;
    let canonical = null;
    let storage = null;
    try { canonical = seasonId ? global.RunState?.load?.(seasonId, { readOnly: true }) : null; } catch (_) {}
    try { storage = seasonId ? global.RunStorage?.diagnostics?.(seasonId) : null; } catch (_) {}
    const match = current?.activeMatch || ui.match || null;
    return {
      schemaVersion: 1,
      at: new Date().toISOString(),
      label: text(label || "unknown", 120),
      stage: text(stage || "unknown", 120),
      kind: text(kind || "generic", 80),
      seasonId: seasonId ? text(seasonId, 80) : null,
      runId: current?.runId ? text(current.runId, 160) : null,
      phase: current?.phase ? text(current.phase, 80) : null,
      error: errorSnapshot(error),
      generation: {
        memory: Number.isFinite(Number(current?.storageGeneration)) ? Number(current.storageGeneration) : null,
        canonical: Number.isFinite(Number(canonical?.storageGeneration ?? storage?.canonicalGeneration)) ? Number(canonical?.storageGeneration ?? storage?.canonicalGeneration) : null,
        expected: Number.isFinite(Number(error?.generation ?? current?.storageGeneration)) ? Number(error?.generation ?? current?.storageGeneration) : null,
      },
      commitId: {
        memory: current?.storageCommitId ? text(current.storageCommitId, 180) : null,
        canonical: canonical?.storageCommitId || storage?.canonicalCommitId ? text(canonical?.storageCommitId || storage?.canonicalCommitId, 180) : null,
      },
      match: match ? {
        matchId: match.matchId ? text(match.matchId, 180) : null,
        type: match.type || null,
        state: match.state || null,
        simulationState: match.simulation?.state || null,
        resolutionApplied: match.simulation?.resolutionApplied === true,
        postMatchNavigationApplied: match.postMatchNavigationApplied === true,
        result: match.result || null,
      } : null,
      node: {
        currentNodeId: current?.currentZone?.currentNodeId || null,
        pendingNodeId: current?.currentZone?.pendingNodeId || null,
      },
      storage: storage ? {
        totalKnownBytes: Number(storage.totalKnownBytes || 0) || null,
        headGeneration: storage.headGeneration ?? null,
        backupGeneration: storage.backupGeneration ?? null,
        headMatchesCanonical: storage.headMatchesCanonical ?? null,
      } : null,
    };
  }

  function recordFailure(context) {
    return rememberFailure(buildFailureEntry(context || {}));
  }

  function failureKind(error) {
    const code = `${error?.name || ""} ${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    if (/quota|dom_quota|storage-quota-exceeded/.test(code)) return "quota";
    if (/canonical-verification-failed/.test(code)) return "verification";
    if (/stale-write|lineage-mismatch/.test(code)) return "stale";
    if (/write-locked|storage-unavailable/.test(code)) return "locked";
    if (/securityerror|storage-access-error/.test(code)) return "access";
    return "generic";
  }

  function wrapAppDiagnostics() {
    const api = global.AppDevDiagnostics;
    if (!api?.create || api.create.__homeDiagnosticsWrapped) return;
    const originalCreate = api.create;
    const wrappedCreate = function createWithHomeDiagnostics(options = {}) {
      const original = originalCreate(options);
      return Object.freeze({
        ...original,
        recordGameplayFailure(label, stage, error, kind = null) {
          const entry = recordFailure({ label, stage, error, kind: kind || failureKind(error), ...options });
          original.recordGameplayFailure?.(label, stage, error, kind);
          return entry;
        },
      });
    };
    wrappedCreate.__homeDiagnosticsWrapped = true;
    global.AppDevDiagnostics = Object.freeze({ ...api, create: wrappedCreate });
  }

  function replaceMethod(apiName, methodName, factory) {
    const api = global[apiName];
    const original = api?.[methodName];
    if (typeof original !== "function" || original.__homeDiagnosticsWrapped) return;
    const wrapped = factory(original);
    wrapped.__homeDiagnosticsWrapped = true;
    try { api[methodName] = wrapped; } catch (_) {}
    if (api[methodName] !== wrapped) {
      try { global[apiName] = Object.freeze({ ...api, [methodName]: wrapped }); } catch (_) {}
    }
  }

  function wrapDirectPersistenceBoundaries() {
    replaceMethod("RunState", "save", (original) => function saveWithDiagnostics(run, options = {}) {
      try { return original.call(this, run, options); }
      catch (error) {
        recordFailure({ label: options?.source || "run-state-save", stage: error?.stage || "persistence", error, kind: failureKind(error), run });
        throw error;
      }
    });

    replaceMethod("RunState", "createCheckpoint", (original) => function checkpointWithDiagnostics(run, ...args) {
      try { return original.call(this, run, ...args); }
      catch (error) {
        recordFailure({ label: "run-checkpoint", stage: error?.stage || "checkpoint", error, kind: failureKind(error), run });
        throw error;
      }
    });

    replaceMethod("RunState", "persistMutationOrRecover", (original) => function persistMutationWithDiagnostics(run, mutate, options = {}) {
      const result = original.call(this, run, mutate, options);
      if (result?.ok === false && result.error) recordFailure({ label: options?.source || "run-state-mutation", stage: result.error?.stage || "persistence", error: result.error, kind: result.stale ? "stale" : failureKind(result.error), run: result.run || run });
      return result;
    });

    replaceMethod("PermanentEffects", "drain", (original) => function permanentDrainWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) recordFailure({ label: "permanent-effects-drain", stage: result.error?.stage || "permanent-effect", error: result.error, kind: failureKind(result.error), run });
      return result;
    });

    replaceMethod("PermanentEffects", "resumeFinalization", (original) => function finalizationWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) recordFailure({ label: "finalization-resume", stage: result.error?.stage || "finalization", error: result.error, kind: failureKind(result.error), run });
      return result;
    });
  }

  function captureUiShell() {
    const api = global.AppUiShell;
    if (!api?.create || api.create.__homeDiagnosticsWrapped) return;
    const originalCreate = api.create;
    const wrappedCreate = function createWithDiagnosticsShell(...args) {
      const shell = originalCreate(...args);
      uiShell = shell;
      return shell;
    };
    wrappedCreate.__homeDiagnosticsWrapped = true;
    global.AppUiShell = Object.freeze({ ...api, create: wrappedCreate });
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 1024 * 100 ? 0 : 1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
      return { ok: true, totalBytes, topInazumaKeys: entries.slice(0, 10), error: null };
    } catch (error) {
      return { ok: false, totalBytes, topInazumaKeys: entries.slice(0, 10), error: errorSnapshot(error) };
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
        if (verified?.length !== payload.length) throw Object.assign(new Error("storage-probe-readback-mismatch"), { code: "storage-probe-readback-mismatch" });
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

  function classify(lastFailure, diagnosticWriteError, probe) {
    const error = lastFailure?.error || diagnosticWriteError || probe?.failure || null;
    const code = `${error?.name || ""} ${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    const memoryGeneration = Number(lastFailure?.generation?.memory);
    const canonicalGeneration = Number(lastFailure?.generation?.canonical);
    const canonicalAhead = Number.isFinite(memoryGeneration) && Number.isFinite(canonicalGeneration) && canonicalGeneration > memoryGeneration;
    if (/quota|dom_quota|storage-quota-exceeded/.test(code)) return { code: "quota-confirmed", title: "SPAZIO LOCALE: QUOTA CONFERMATA", detail: "È stato registrato un QuotaExceededError o equivalente. Lo spazio locale è un trigger reale su questo dispositivo." };
    if (probe?.failedAtBytes && /quota|dom_quota/.test(`${probe.failure?.name || ""} ${probe.failure?.code || ""} ${probe.failure?.message || ""}`.toLowerCase())) return { code: "quota-probe", title: "SPAZIO LOCALE: TEST FALLITO", detail: `Il test temporaneo non riesce a scrivere ${formatBytes(probe.failedAtBytes)}.` };
    if (/canonical-verification-failed/.test(code) || error?.canonicalCommitted === true || canonicalAhead) return { code: "ambiguous-commit", title: "COMMIT AMBIGUO / CANONICO PIÙ AVANTI", detail: "Il salvataggio canonico può essere già avanzato anche se la chiamata ha restituito errore. Questo è il caso che può lasciare runtime e UI disallineati." };
    if (/stale-write|lineage-mismatch/.test(code)) return { code: "stale", title: "GENERATION STALE", detail: "La generation in memoria non coincide con quella canonica oppure il lineage è cambiato." };
    if (/write-locked|storage-unavailable/.test(code)) return { code: "locked", title: "LOCK / STORAGE TEMPORANEAMENTE NON SCRIVIBILE", detail: "La scrittura è stata bloccata dal lock locale o dallo storage non disponibile." };
    if (/securityerror|storage-access-error/.test(code)) return { code: "access", title: "ACCESSO STORAGE BLOCCATO", detail: "Il browser ha negato o perso l’accesso allo storage locale." };
    if (lastFailure) return { code: "failure", title: "ERRORE DI SALVATAGGIO REGISTRATO", detail: "È presente un errore reale da analizzare; il codice esatto è mostrato qui sotto." };
    return { code: "none", title: "NESSUN ERRORE REGISTRATO", detail: "La diagnostica è pronta. Dopo il prossimo problema resteranno qui codice, stage, generation e stato della partita." };
  }

  async function buildReport(probe = null) {
    const failureRecord = readFailure();
    const diagnosticWriteError = readFailureWriteError();
    const snapshotResult = await baseSnapshot();
    const measured = measureLocalStorage();
    const snapshot = snapshotResult.value || {};
    const permanentStores = snapshot.permanentStores || {};
    const localStorageBytes = Number(permanentStores.localStorageBytes ?? measured.totalBytes ?? 0);
    const hallBytes = Number(permanentStores.hall?.bytes || 0);
    const developmentBytes = Number(permanentStores.development?.bytes || 0);
    const albumBytes = Number(permanentStores.album?.bytes || 0);
    const profileBytes = Number(permanentStores.profile?.bytes || 0);
    const hallSharePercent = localStorageBytes > 0 ? Math.round((hallBytes / localStorageBytes) * 1000) / 10 : 0;
    const topInazumaKeys = Array.isArray(permanentStores.topInazumaKeys) && permanentStores.topInazumaKeys.length
      ? permanentStores.topInazumaKeys.slice(0, 10)
      : measured.topInazumaKeys;
    return {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      classification: classify(failureRecord.value, diagnosticWriteError, probe),
      lastFailureSource: failureRecord.source,
      lastFailure: failureRecord.value,
      diagnosticWriteError,
      probe,
      storage: {
        localStorageMeasuredBytes: localStorageBytes,
        hallBytes,
        developmentBytes,
        albumBytes,
        profileBytes,
        hallSharePercent,
        topInazumaKeys,
        browserEstimate: snapshot.browser?.storageEstimate || null,
        browserFamily: snapshot.browser?.family || null,
        snapshotError: snapshotResult.error,
        measurementError: measured.error,
      },
      runs: Array.isArray(snapshot.runs) ? snapshot.runs.map((run) => ({ seasonId: run.seasonId, generation: run.generation, phase: run.phase, bossIndex: run.bossIndex, currentNode: run.currentNode, gameOver: run.gameOver, finalizationStatus: run.finalizationStatus, canonicalState: run.canonicalState })) : [],
    };
  }

  function escape(value) {
    if (uiShell?.escapeHtml) return uiShell.escapeHtml(value);
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function failureMarkup(failure) {
    if (!failure) return '<section class="panel"><p class="eyebrow">ULTIMO ERRORE</p><h3>Nessun errore ancora registrato</h3><p class="muted">Quando una persistence fallirà, questa sezione conserverà il contesto tecnico.</p></section>';
    const generation = failure.generation || {};
    const match = failure.match || {};
    return `<section class="panel"><p class="eyebrow">ULTIMO ERRORE</p><h3>${escape(failure.error?.code || failure.error?.name || "Errore sconosciuto")}</h3><p class="muted">${escape(failure.error?.message || "")}</p><div class="stat-grid"><div class="stat-card"><span>Azione</span><strong>${escape(failure.label || "-")}</strong></div><div class="stat-card"><span>Stage</span><strong>${escape(failure.stage || failure.error?.stage || "-")}</strong></div><div class="stat-card"><span>Quando</span><strong>${escape(failure.at ? new Date(failure.at).toLocaleString("it-IT") : "-")}</strong></div><div class="stat-card"><span>Fase run</span><strong>${escape(failure.phase || "-")}</strong></div><div class="stat-card"><span>Generation RAM</span><strong>${escape(generation.memory ?? "-")}</strong></div><div class="stat-card"><span>Generation canonica</span><strong>${escape(generation.canonical ?? "-")}</strong></div><div class="stat-card"><span>Partita</span><strong>${escape(match.type || "-")}</strong></div><div class="stat-card"><span>Stato partita</span><strong>${escape(match.simulationState || match.state || "-")}</strong></div><div class="stat-card"><span>Resolution durable</span><strong>${match.resolutionApplied === true ? "SÌ" : match.resolutionApplied === false ? "NO" : "-"}</strong></div><div class="stat-card"><span>Post-navigation</span><strong>${match.postMatchNavigationApplied === true ? "SÌ" : match.postMatchNavigationApplied === false ? "NO" : "-"}</strong></div></div></section>`;
  }

  function storageMarkup(report) {
    const storage = report.storage;
    const estimate = storage.browserEstimate;
    const top = (storage.topInazumaKeys || []).slice(0, 6);
    return `<section class="panel"><p class="eyebrow">SPAZIO LOCALE</p><div class="stat-grid"><div class="stat-card"><span>localStorage misurato</span><strong>${escape(formatBytes(storage.localStorageMeasuredBytes))}</strong></div><div class="stat-card"><span>Albo d’Oro</span><strong>${escape(formatBytes(storage.hallBytes))}</strong><small>${escape(storage.hallSharePercent)}% del totale locale</small></div><div class="stat-card"><span>Development</span><strong>${escape(formatBytes(storage.developmentBytes))}</strong></div><div class="stat-card"><span>Album</span><strong>${escape(formatBytes(storage.albumBytes))}</strong></div>${estimate ? `<div class="stat-card"><span>Storage browser usato</span><strong>${escape(formatBytes(estimate.usage))}</strong></div><div class="stat-card"><span>Quota browser stimata</span><strong>${escape(formatBytes(estimate.quota))}</strong></div>` : ""}</div>${top.length ? `<div class="panel" style="margin-top:12px"><p class="eyebrow">CHIAVI PIÙ PESANTI</p>${top.map((entry) => `<p class="muted" style="display:flex;justify-content:space-between;gap:12px"><span>${escape(entry.key)}</span><strong>${escape(formatBytes(entry.bytes))}</strong></p>`).join("")}</div>` : ""}</section>`;
  }

  function probeMarkup(probe) {
    if (!probe) return '<section class="panel"><p class="eyebrow">TEST DI SCRITTURA</p><p class="muted">Premi “Testa spazio locale” per provare scritture temporanee da 16 KB, 64 KB e 256 KB. La chiave di test viene rimossa subito.</p></section>';
    return `<section class="panel"><p class="eyebrow">TEST DI SCRITTURA</p><div class="stat-grid">${probe.results.map((result) => `<div class="stat-card"><span>${escape(formatBytes(result.sizeBytes))}</span><strong>${result.ok ? "OK" : "FALLITO"}</strong>${result.error ? `<small>${escape(result.error.code || result.error.name || result.error.message)}</small>` : ""}</div>`).join("")}</div></section>`;
  }

  function reportMarkup(report) {
    return `<div class="modal-head"><div><p class="eyebrow">DIAGNOSTICA SALVATAGGIO</p><h2>${escape(report.classification.title)}</h2><p class="muted">${escape(report.classification.detail)}</p></div></div>${failureMarkup(report.lastFailure)}${storageMarkup(report)}${probeMarkup(report.probe)}${report.diagnosticWriteError ? `<section class="panel"><p class="eyebrow">LOG DIAGNOSTICO</p><h3>Il log non è entrato in localStorage</h3><p class="muted">${escape(report.diagnosticWriteError.code || report.diagnosticWriteError.name)} · ${escape(report.diagnosticWriteError.message)}</p></section>` : ""}<div class="button-row"><button type="button" class="btn btn-yellow" id="run-persistence-space-probe">TESTA SPAZIO LOCALE</button><button type="button" class="btn" id="copy-persistence-diagnostics">COPIA DIAGNOSTICA</button>${report.lastFailure ? '<button type="button" class="btn" id="clear-persistence-diagnostics">AZZERA ULTIMO ERRORE</button>' : ""}</div>`;
  }

  async function copyReport(report) {
    const value = JSON.stringify(report, null, 2);
    try {
      if (!global.navigator?.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await global.navigator.clipboard.writeText(value);
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand?.("copy");
      textarea.remove();
    }
    uiShell?.toast?.("Diagnostica copiata");
  }

  async function open(probe = null) {
    if (!uiShell?.openModal) return false;
    const report = await buildReport(probe);
    uiShell.openModal(reportMarkup(report), { closeable: true, className: "persistence-diagnostic-modal" });
    document.getElementById("copy-persistence-diagnostics")?.addEventListener("click", () => copyReport(report));
    document.getElementById("clear-persistence-diagnostics")?.addEventListener("click", () => { clearFailure(); open(probe); });
    document.getElementById("run-persistence-space-probe")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "VERIFICA IN CORSO…";
      const result = await probeStorage();
      open(result);
    });
    return report;
  }

  function hasFailure() {
    return !!readFailure().value;
  }

  function injectHomeButton() {
    const home = document.querySelector(".home-screen");
    const nav = home?.querySelector(".home-club-actions");
    if (!nav || nav.querySelector("#open-persistence-diagnostics-home")) return false;
    const last = readFailure().value;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-club-action home-club-action--wide";
    button.id = "open-persistence-diagnostics-home";
    button.innerHTML = `<span class="home-club-icon" aria-hidden="true">!</span><span class="home-club-copy"><strong>Diagnostica salvataggio</strong><small>${escape(last ? `Ultimo errore: ${last.error?.code || last.error?.name || "registrato"}` : "Errori, generation e spazio locale")}</small></span><span class="home-club-arrow" aria-hidden="true">»</span>`;
    button.addEventListener("click", () => open());
    nav.appendChild(button);
    return true;
  }

  function installHomeObserver() {
    const app = document.getElementById("app");
    if (!app || homeObserver) return;
    homeObserver = new MutationObserver(() => queueMicrotask(injectHomeButton));
    homeObserver.observe(app, { childList: true, subtree: true });
    injectHomeButton();
  }

  wrapAppDiagnostics();
  wrapDirectPersistenceBoundaries();
  captureUiShell();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installHomeObserver, { once: true });
  else installHomeObserver();

  global.PersistenceHomeDiagnostics = Object.freeze({
    recordFailure,
    readFailure: () => clone(readFailure()),
    clearFailure,
    buildReport,
    probeStorage,
    open,
    hasFailure,
    injectHomeButton,
  });
})(globalThis);
