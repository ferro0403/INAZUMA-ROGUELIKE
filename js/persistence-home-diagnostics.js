(function (global) {
  "use strict";

  const FAILURE_KEY = "inazuma.diagnostics.lastFailure.v2";
  const FAILURE_WRITE_ERROR_KEY = `${FAILURE_KEY}.writeError`;
  const EVENTS_KEY = "inazuma.diagnostics.events.v1";
  const PROBE_KEY = "inazuma.diagnostics.spaceProbe.v1";
  const MAX_EVENTS = 24;
  const MAX_TEXT = 420;

  let volatileFailure = null;
  let volatileEvents = [];
  let uiShell = null;
  let settingsObserver = null;

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
    if (!error) return null;
    const cause = error?.cause;
    return {
      name: text(error?.name || "Error", 80),
      code: text(error?.code || "", 120) || null,
      stage: text(error?.stage || "", 120) || null,
      message: text(error?.message || String(error || "Errore sconosciuto")),
      stack: text(error?.stack || "", 900) || null,
      recoverable: error?.recoverable === true,
      canonicalCommitted: error?.canonicalCommitted === true,
      generation: Number.isFinite(Number(error?.generation)) ? Number(error.generation) : null,
      cause: cause ? {
        name: text(cause?.name || "Error", 80),
        code: text(cause?.code || "", 120) || null,
        stage: text(cause?.stage || "", 120) || null,
        message: text(cause?.message || String(cause), 320),
      } : null,
    };
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

  function currentContext(runOverride = null, getUi = null) {
    const run = runOverride || global.run || null;
    const ui = getUi?.() || {};
    const match = run?.activeMatch || ui.match || null;
    return {
      seasonId: run?.seasonId || null,
      runId: run?.runId || null,
      phase: run?.phase || null,
      bossIndex: Number.isFinite(Number(run?.bossIndex)) ? Number(run.bossIndex) : null,
      currentNodeId: run?.currentZone?.currentNodeId || null,
      pendingNodeId: run?.currentZone?.pendingNodeId || null,
      match: match ? {
        matchId: match.matchId || null,
        type: match.type || null,
        state: match.state || null,
        simulationState: match.simulation?.state || null,
        result: match.result || null,
        resolutionApplied: match.simulation?.resolutionApplied === true,
        postMatchNavigationApplied: match.postMatchNavigationApplied === true,
      } : null,
    };
  }

  function readEvents() {
    if (volatileEvents.length) return clone(volatileEvents);
    const session = safeRead(global.sessionStorage, EVENTS_KEY);
    if (Array.isArray(session)) {
      volatileEvents = session.slice(-MAX_EVENTS);
      return clone(volatileEvents);
    }
    const local = safeRead(global.localStorage, EVENTS_KEY);
    if (Array.isArray(local)) {
      volatileEvents = local.slice(-MAX_EVENTS);
      return clone(volatileEvents);
    }
    return [];
  }

  function writeEvents(events) {
    volatileEvents = events.slice(-MAX_EVENTS);
    const raw = JSON.stringify(volatileEvents);
    safeSessionWrite(EVENTS_KEY, raw);
    safeLocalWrite(EVENTS_KEY, raw);
  }

  function recordEvent(type, detail = {}, context = null) {
    const events = readEvents();
    events.push({
      at: new Date().toISOString(),
      type: text(type || "event", 100),
      detail: clone(detail || {}),
      context: context || currentContext(),
    });
    writeEvents(events);
    return events.at(-1);
  }

  function readFailure() {
    if (volatileFailure) return { source: "memory", value: clone(volatileFailure) };
    const session = safeRead(global.sessionStorage, FAILURE_KEY);
    if (session) return { source: "sessionStorage", value: session };
    const local = safeRead(global.localStorage, FAILURE_KEY);
    if (local) return { source: "localStorage", value: local };
    return { source: "none", value: null };
  }

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
    recordEvent("persistence-failure", {
      label: entry.label,
      stage: entry.stage,
      kind: entry.kind,
      error: entry.error,
      generation: entry.generation,
    }, {
      seasonId: entry.seasonId,
      runId: entry.runId,
      phase: entry.phase,
      bossIndex: entry.bossIndex,
      currentNodeId: entry.node?.currentNodeId || null,
      pendingNodeId: entry.node?.pendingNodeId || null,
      match: entry.match || null,
    });
    return clone(volatileFailure);
  }

  function clearRecorded() {
    volatileFailure = null;
    volatileEvents = [];
    for (const storage of [global.sessionStorage, global.localStorage]) {
      for (const key of [FAILURE_KEY, EVENTS_KEY]) {
        try { storage?.removeItem(key); } catch (_) {}
      }
    }
    try { global.sessionStorage?.removeItem(FAILURE_WRITE_ERROR_KEY); } catch (_) {}
  }

  function errorSearchText(error) {
    if (!error) return "";
    const cause = error.cause || null;
    return `${error.name || ""} ${error.code || ""} ${error.stage || ""} ${error.message || ""} ${cause?.name || ""} ${cause?.code || ""} ${cause?.stage || ""} ${cause?.message || ""}`.toLowerCase();
  }

  function failureKind(error) {
    const value = errorSearchText(error);
    if (/quota|dom_quota|storage-quota-exceeded/.test(value)) return "quota";
    if (/canonical-verification-failed/.test(value)) return "verification";
    if (/stale-write|lineage-mismatch/.test(value)) return "stale";
    if (/write-locked|storage-unavailable/.test(value)) return "locked";
    if (/securityerror|storage-access-error/.test(value)) return "access";
    return "generic";
  }

  function buildFailureEntry({ label, stage, error, kind, run: suppliedRun = null, getRun = null, getUi = null, getActiveSeason = null }) {
    const current = suppliedRun || getRun?.() || global.run || null;
    const seasonId = current?.seasonId || getActiveSeason?.()?.id || global.SeasonRegistry?.activeId?.() || null;
    let canonical = null;
    let storage = null;
    try { canonical = seasonId ? global.RunState?.load?.(seasonId, { readOnly: true }) : null; } catch (_) {}
    try { storage = seasonId ? global.RunStorage?.diagnostics?.(seasonId) : null; } catch (_) {}
    const context = currentContext(current, getUi);
    return {
      schemaVersion: 2,
      at: new Date().toISOString(),
      label: text(label || "unknown", 120),
      stage: text(stage || error?.stage || "unknown", 120),
      kind: text(kind || failureKind(error), 80),
      seasonId: seasonId ? text(seasonId, 80) : null,
      runId: current?.runId ? text(current.runId, 160) : null,
      phase: current?.phase || null,
      bossIndex: context.bossIndex,
      error: errorSnapshot(error),
      generation: {
        memory: Number.isFinite(Number(current?.storageGeneration)) ? Number(current.storageGeneration) : null,
        canonical: Number.isFinite(Number(canonical?.storageGeneration ?? storage?.canonicalGeneration)) ? Number(canonical?.storageGeneration ?? storage?.canonicalGeneration) : null,
        expected: Number.isFinite(Number(error?.generation ?? current?.storageGeneration)) ? Number(error?.generation ?? current?.storageGeneration) : null,
      },
      commitId: {
        memory: current?.storageCommitId || null,
        canonical: canonical?.storageCommitId || storage?.canonicalCommitId || null,
      },
      match: context.match,
      node: { currentNodeId: context.currentNodeId, pendingNodeId: context.pendingNodeId },
      storage: storage ? {
        totalKnownBytes: Number(storage.totalKnownBytes || 0),
        headGeneration: storage.headGeneration ?? null,
        backupGeneration: storage.backupGeneration ?? null,
        headMatchesCanonical: storage.headMatchesCanonical ?? null,
      } : null,
    };
  }

  function recordFailure(context = {}) {
    return rememberFailure(buildFailureEntry(context));
  }

  function replaceMethod(apiName, methodName, factory) {
    const api = global[apiName];
    const original = api?.[methodName];
    if (typeof original !== "function" || original.__gameDiagnosticsWrapped) return;
    const wrapped = factory(original);
    wrapped.__gameDiagnosticsWrapped = true;
    try { api[methodName] = wrapped; } catch (_) {}
    if (api[methodName] !== wrapped) {
      try { global[apiName] = Object.freeze({ ...api, [methodName]: wrapped }); } catch (_) {}
    }
  }

  function installPersistenceHooks() {
    replaceMethod("RunState", "save", (original) => function saveWithDiagnostics(run, options = {}) {
      try { return original.call(this, run, options); }
      catch (error) {
        recordFailure({ label: options?.source || "run-state-save", stage: error?.stage || "persistence", error, run });
        throw error;
      }
    });

    replaceMethod("RunState", "createCheckpoint", (original) => function checkpointWithDiagnostics(run, ...args) {
      try { return original.call(this, run, ...args); }
      catch (error) {
        recordFailure({ label: "run-checkpoint", stage: error?.stage || "checkpoint", error, run });
        throw error;
      }
    });

    replaceMethod("RunState", "persistMutationOrRecover", (original) => function mutationWithDiagnostics(run, mutate, options = {}) {
      const result = original.call(this, run, mutate, options);
      if (result?.ok === false && result.error) {
        recordFailure({ label: options?.source || "run-state-mutation", stage: result.error?.stage || "persistence", error: result.error, kind: result.stale ? "stale" : failureKind(result.error), run: result.run || run });
      }
      return result;
    });

    replaceMethod("PermanentEffects", "drain", (original) => function drainWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) recordFailure({ label: "permanent-effects-drain", stage: result.error?.stage || "permanent-effect", error: result.error, run });
      return result;
    });

    replaceMethod("PermanentEffects", "resumeFinalization", (original) => function finalizationWithDiagnostics(run, ...args) {
      const result = original.call(this, run, ...args);
      if (result?.error) recordFailure({ label: "finalization-resume", stage: result.error?.stage || "finalization", error: result.error, run });
      return result;
    });
  }

  function wrapAppDiagnostics() {
    const api = global.AppDevDiagnostics;
    if (!api?.create || api.create.__gameDiagnosticsWrapped) return;
    const originalCreate = api.create;
    const wrappedCreate = function createWithGameDiagnostics(options = {}) {
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
    wrappedCreate.__gameDiagnosticsWrapped = true;
    global.AppDevDiagnostics = Object.freeze({ ...api, create: wrappedCreate });
  }

  function captureUiShell() {
    const api = global.AppUiShell;
    if (!api?.create || api.create.__gameDiagnosticsWrapped) return;
    const originalCreate = api.create;
    const wrappedCreate = function createWithDiagnosticsShell(...args) {
      const shell = originalCreate(...args);
      uiShell = shell;
      return shell;
    };
    wrappedCreate.__gameDiagnosticsWrapped = true;
    global.AppUiShell = Object.freeze({ ...api, create: wrappedCreate });
  }

  function installGlobalErrorCapture() {
    if (global.__INAZUMA_GAME_DIAGNOSTICS_ERRORS__) return;
    global.__INAZUMA_GAME_DIAGNOSTICS_ERRORS__ = true;
    global.addEventListener?.("error", (event) => {
      recordEvent("javascript-error", {
        message: text(event?.message || event?.error?.message || "Errore JavaScript"),
        filename: text(event?.filename || "", 220) || null,
        line: event?.lineno || null,
        column: event?.colno || null,
        error: errorSnapshot(event?.error),
      });
    });
    global.addEventListener?.("unhandledrejection", (event) => {
      const reason = event?.reason;
      recordEvent("unhandled-rejection", {
        message: text(reason?.message || String(reason || "Promise rifiutata")),
        error: errorSnapshot(reason),
      });
    });
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 102400 ? 0 : 1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function shortCommit(value) {
    const string = String(value || "");
    return string ? (string.length > 16 ? `${string.slice(0, 8)}…${string.slice(-6)}` : string) : "-";
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

  function classify(lastFailure, writeError, probe, events) {
    const combined = [lastFailure?.error, writeError?.error, probe?.failure].map(errorSearchText).join(" ");
    const memoryRaw = lastFailure?.generation?.memory;
    const canonicalRaw = lastFailure?.generation?.canonical;
    const memoryGeneration = memoryRaw == null ? NaN : Number(memoryRaw);
    const canonicalGeneration = canonicalRaw == null ? NaN : Number(canonicalRaw);
    const canonicalAhead = Number.isFinite(memoryGeneration) && Number.isFinite(canonicalGeneration) && canonicalGeneration > memoryGeneration;
    if (/quota|dom_quota|storage-quota-exceeded/.test(combined)) return { code: "quota", title: "QUOTA LOCALE CONFERMATA", detail: "È stato registrato un QuotaExceededError o equivalente. Lo spazio locale è un trigger reale su questo dispositivo." };
    if (/canonical-verification-failed/.test(combined) || lastFailure?.error?.canonicalCommitted === true || canonicalAhead) return { code: "ambiguous-commit", title: "COMMIT AMBIGUO", detail: "Il canonico risulta più avanti o la verifica del commit è fallita dopo una possibile scrittura. È il caso che può lasciare UI e runtime disallineati." };
    if (/stale-write|lineage-mismatch/.test(combined)) return { code: "stale", title: "GENERATION STALE", detail: "La generation in memoria non coincide con quella canonica oppure il lineage della run è cambiato." };
    if (/write-locked|storage-unavailable/.test(combined)) return { code: "locked", title: "STORAGE BLOCCATO", detail: "La scrittura è stata fermata da lock locale o storage temporaneamente non disponibile." };
    if (/securityerror|storage-access-error/.test(combined)) return { code: "access", title: "ACCESSO STORAGE BLOCCATO", detail: "Il browser ha negato o perso l’accesso allo storage locale." };
    if (lastFailure) return { code: "persistence", title: "ERRORE DI SALVATAGGIO REGISTRATO", detail: "È presente un errore reale di persistenza. Sotto trovi stage, generation, match e causa interna." };
    if ((events || []).some((entry) => ["javascript-error", "unhandled-rejection"].includes(entry.type))) return { code: "javascript", title: "ERRORE JAVASCRIPT REGISTRATO", detail: "È stato catturato un errore JavaScript o una Promise non gestita. Gli ultimi eventi sono inclusi nel report." };
    return { code: "none", title: "NESSUN ERRORE REGISTRATO", detail: "La diagnostica è attiva. Se il gioco si blocca, torna qui prima di cancellare dati e copia il report." };
  }

  async function buildReport(probe = null) {
    const failureRecord = readFailure();
    const writeError = safeRead(global.sessionStorage, FAILURE_WRITE_ERROR_KEY);
    const events = readEvents();
    const snapshotResult = await baseSnapshot();
    const measured = measureLocalStorage();
    const snapshot = snapshotResult.value || {};
    const permanent = snapshot.permanentStores || {};
    const localStorageBytes = Number(permanent.localStorageBytes ?? measured.totalBytes ?? 0);
    const hallBytes = Number(permanent.hall?.bytes || 0);
    const developmentBytes = Number(permanent.development?.bytes || 0);
    const albumBytes = Number(permanent.album?.bytes || 0);
    const profileBytes = Number(permanent.profile?.bytes || 0);
    return {
      schemaVersion: 2,
      capturedAt: new Date().toISOString(),
      classification: classify(failureRecord.value, writeError, probe, events),
      current: currentContext(),
      lastFailureSource: failureRecord.source,
      lastFailure: failureRecord.value,
      diagnosticWriteError: writeError,
      recentEvents: events.slice(-12),
      probe,
      storage: {
        localStorageMeasuredBytes: localStorageBytes,
        hallBytes,
        developmentBytes,
        albumBytes,
        profileBytes,
        hallSharePercent: localStorageBytes > 0 ? Math.round((hallBytes / localStorageBytes) * 1000) / 10 : 0,
        topInazumaKeys: (permanent.topInazumaKeys?.length ? permanent.topInazumaKeys : measured.topInazumaKeys).slice(0, 10),
        browserEstimate: snapshot.browser?.storageEstimate || null,
        browserFamily: snapshot.browser?.family || null,
        snapshotError: snapshotResult.error,
        measurementError: measured.error,
      },
      runs: Array.isArray(snapshot.runs) ? snapshot.runs.map((run) => ({ seasonId: run.seasonId, generation: run.generation, phase: run.phase, bossIndex: run.bossIndex, currentNode: run.currentNode, gameOver: run.gameOver, finalizationStatus: run.finalizationStatus, canonicalState: run.canonicalState })) : [],
    };
  }

  function esc(value) {
    if (uiShell?.escapeHtml) return uiShell.escapeHtml(value);
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function diagnosticCard(title, body) {
    return `<section class="panel"><p class="eyebrow">${esc(title)}</p>${body}</section>`;
  }

  function failureMarkup(failure) {
    if (!failure) return diagnosticCard("ULTIMO ERRORE", '<h3>Nessun errore di salvataggio</h3><p class="muted">Se un salvataggio fallisce, qui restano causa, stage e stato della run.</p>');
    const generation = failure.generation || {};
    const match = failure.match || {};
    const cause = failure.error?.cause;
    return diagnosticCard("ULTIMO ERRORE", `<h3>${esc(failure.error?.code || failure.error?.name || "Errore sconosciuto")}</h3><p class="muted">${esc(failure.error?.message || "")}</p>${cause ? `<p class="muted"><strong>Causa interna:</strong> ${esc(cause.name || "Error")} · ${esc(cause.code || cause.message || "-")}</p>` : ""}<div class="stat-grid"><div class="stat-card"><span>Azione</span><strong>${esc(failure.label || "-")}</strong></div><div class="stat-card"><span>Stage</span><strong>${esc(failure.stage || failure.error?.stage || "-")}</strong></div><div class="stat-card"><span>Generation RAM</span><strong>${esc(generation.memory ?? "-")}</strong></div><div class="stat-card"><span>Generation canonica</span><strong>${esc(generation.canonical ?? "-")}</strong></div><div class="stat-card"><span>Commit RAM</span><strong>${esc(shortCommit(failure.commitId?.memory))}</strong></div><div class="stat-card"><span>Commit canonico</span><strong>${esc(shortCommit(failure.commitId?.canonical))}</strong></div><div class="stat-card"><span>Partita</span><strong>${esc(match.type || "-")}</strong></div><div class="stat-card"><span>Stato partita</span><strong>${esc(match.simulationState || match.state || "-")}</strong></div><div class="stat-card"><span>Resolution</span><strong>${match.resolutionApplied === true ? "SÌ" : match.resolutionApplied === false ? "NO" : "-"}</strong></div><div class="stat-card"><span>Post-navigation</span><strong>${match.postMatchNavigationApplied === true ? "SÌ" : match.postMatchNavigationApplied === false ? "NO" : "-"}</strong></div></div>`);
  }

  function storageMarkup(report) {
    const storage = report.storage;
    const estimate = storage.browserEstimate;
    return diagnosticCard("SPAZIO LOCALE", `<div class="stat-grid"><div class="stat-card"><span>localStorage</span><strong>${esc(formatBytes(storage.localStorageMeasuredBytes))}</strong></div><div class="stat-card"><span>Albo d’Oro</span><strong>${esc(formatBytes(storage.hallBytes))}</strong><small>${esc(storage.hallSharePercent)}% del totale</small></div><div class="stat-card"><span>Development</span><strong>${esc(formatBytes(storage.developmentBytes))}</strong></div><div class="stat-card"><span>Album</span><strong>${esc(formatBytes(storage.albumBytes))}</strong></div>${storage.browserFamily ? `<div class="stat-card"><span>Browser</span><strong>${esc(storage.browserFamily)}</strong></div>` : ""}${estimate ? `<div class="stat-card"><span>Quota stimata browser</span><strong>${esc(formatBytes(estimate.quota))}</strong></div>` : ""}</div>`);
  }

  function eventsMarkup(events) {
    const visible = (events || []).slice(-6).reverse();
    if (!visible.length) return diagnosticCard("EVENTI RECENTI", '<p class="muted">Nessun errore JavaScript o evento diagnostico registrato.</p>');
    return diagnosticCard("EVENTI RECENTI", visible.map((entry) => `<p class="muted"><strong>${esc(entry.type)}</strong> · ${esc(entry.detail?.message || entry.detail?.label || entry.detail?.error?.code || "evento registrato")}<br><small>${esc(new Date(entry.at).toLocaleString("it-IT"))}</small></p>`).join(""));
  }

  function probeMarkup(probe) {
    if (!probe) return diagnosticCard("TEST DI SCRITTURA", '<p class="muted">Prova scritture temporanee da 16 KB, 64 KB e 256 KB. La chiave viene rimossa subito.</p>');
    return diagnosticCard("TEST DI SCRITTURA", `<div class="stat-grid">${probe.results.map((item) => `<div class="stat-card"><span>${esc(formatBytes(item.sizeBytes))}</span><strong>${item.ok ? "OK" : "FALLITO"}</strong>${item.error ? `<small>${esc(item.error.code || item.error.name || item.error.message)}</small>` : ""}</div>`).join("")}</div>`);
  }

  function reportMarkup(report) {
    return `<div class="modal-head"><div><p class="eyebrow">DIAGNOSTICA GIOCO</p><h2>${esc(report.classification.title)}</h2><p class="muted">${esc(report.classification.detail)}</p></div></div>${failureMarkup(report.lastFailure)}${storageMarkup(report)}${eventsMarkup(report.recentEvents)}${probeMarkup(report.probe)}${report.diagnosticWriteError ? diagnosticCard("LOG DIAGNOSTICO", `<h3>Il log non è entrato in localStorage</h3><p class="muted">${esc(report.diagnosticWriteError.error?.code || report.diagnosticWriteError.error?.name || "Errore storage")}</p>`) : ""}<div class="button-row"><button type="button" class="btn btn-yellow" id="game-diagnostics-probe">TESTA SPAZIO LOCALE</button><button type="button" class="btn" id="game-diagnostics-copy">COPIA REPORT</button><button type="button" class="btn" id="game-diagnostics-clear">AZZERA LOG</button></div>`;
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
    uiShell?.toast?.("REPORT DIAGNOSTICO COPIATO");
  }

  async function open(probe = null) {
    if (!uiShell?.openModal) return null;
    recordEvent("diagnostics-opened", { hasProbe: !!probe });
    const report = await buildReport(probe);
    uiShell.openModal(reportMarkup(report), { closeable: true, className: "game-diagnostics-modal" });
    document.getElementById("game-diagnostics-copy")?.addEventListener("click", () => copyReport(report));
    document.getElementById("game-diagnostics-clear")?.addEventListener("click", () => { clearRecorded(); open(probe); });
    document.getElementById("game-diagnostics-probe")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "VERIFICA IN CORSO…";
      const result = await probeStorage();
      recordEvent("storage-probe", { results: result.results });
      open(result);
    });
    return report;
  }

  function injectSettingsButton() {
    const panel = document.querySelector(".settings-preferences-panel");
    if (!panel || panel.querySelector("[data-settings-game-diagnostics]")) return false;
    const row = document.createElement("div");
    row.className = "settings-name-row";
    row.dataset.settingsGameDiagnostics = "";
    row.innerHTML = `<div><small>STRUMENTI</small><strong style="display:block;margin-top:4px;font-size:.9rem">DIAGNOSTICA GIOCO</strong><small style="display:block;margin-top:5px;color:#625e55;font-size:.72rem;line-height:1.35">Controlla errori, salvataggi, spazio locale e stato della run.</small></div><button type="button" class="btn btn-yellow" id="settings-open-game-diagnostics">ANALIZZA</button>`;
    row.querySelector("#settings-open-game-diagnostics")?.addEventListener("click", () => open());
    panel.appendChild(row);
    return true;
  }

  function installSettingsObserver() {
    const app = document.getElementById("app");
    if (!app || settingsObserver) return;
    settingsObserver = new MutationObserver(() => queueMicrotask(injectSettingsButton));
    settingsObserver.observe(app, { childList: true, subtree: true });
    injectSettingsButton();
  }

  wrapAppDiagnostics();
  installPersistenceHooks();
  captureUiShell();
  installGlobalErrorCapture();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSettingsObserver, { once: true });
  else installSettingsObserver();

  const api = Object.freeze({
    recordFailure,
    recordEvent,
    readFailure: () => clone(readFailure()),
    readEvents,
    clearRecorded,
    buildReport,
    probeStorage,
    open,
    injectSettingsButton,
  });
  global.GameDiagnostics = api;
  global.PersistenceHomeDiagnostics = api;
})(globalThis);
