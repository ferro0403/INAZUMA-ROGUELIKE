(function (global) {
  "use strict";

  const EVENTS_KEY = "inazuma.diagnostics.events.v2";
  const MAX_EVENTS = 24;
  const MAX_TEXT = 420;

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

  function create({ storage, getRun = () => global.run || null, getUi = () => ({}), getActiveSeason = () => null }) {
    let volatileEvents = [];

    function currentContext(runOverride = null) {
      const run = runOverride || getRun?.() || global.run || null;
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
      try {
        const stored = parseJson(global.sessionStorage?.getItem(EVENTS_KEY));
        if (Array.isArray(stored)) volatileEvents = stored.slice(-MAX_EVENTS);
      } catch (_) {}
      return clone(volatileEvents);
    }

    function writeEvents(events) {
      volatileEvents = events.slice(-MAX_EVENTS);
      try { global.sessionStorage?.setItem(EVENTS_KEY, JSON.stringify(volatileEvents)); } catch (_) {}
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
      return clone(events.at(-1));
    }

    function clearEvents() {
      volatileEvents = [];
      try { global.sessionStorage?.removeItem(EVENTS_KEY); } catch (_) {}
    }

    function buildFailureEntry({ label, stage, error, kind, run: suppliedRun = null, getRun: suppliedGetRun = null, getUi: suppliedGetUi = null, getActiveSeason: suppliedGetActiveSeason = null }) {
      const current = suppliedRun || suppliedGetRun?.() || getRun?.() || global.run || null;
      const activeSeason = suppliedGetActiveSeason?.() || getActiveSeason?.() || null;
      const seasonId = current?.seasonId || activeSeason?.id || global.SeasonRegistry?.activeId?.() || null;
      let canonical = null;
      let diagnostics = null;
      try { canonical = seasonId ? global.RunState?.load?.(seasonId, { readOnly: true }) : null; } catch (_) {}
      try { diagnostics = seasonId ? global.RunStorage?.diagnostics?.(seasonId) : null; } catch (_) {}
      const ui = suppliedGetUi?.() || getUi?.() || {};
      const match = current?.activeMatch || ui.match || null;
      const context = {
        ...currentContext(current),
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
      return {
        schemaVersion: 3,
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
          canonical: Number.isFinite(Number(canonical?.storageGeneration ?? diagnostics?.canonicalGeneration)) ? Number(canonical?.storageGeneration ?? diagnostics?.canonicalGeneration) : null,
          expected: Number.isFinite(Number(error?.generation ?? current?.storageGeneration)) ? Number(error?.generation ?? current?.storageGeneration) : null,
        },
        commitId: {
          memory: current?.storageCommitId || null,
          canonical: canonical?.storageCommitId || diagnostics?.canonicalCommitId || null,
        },
        match: context.match,
        node: { currentNodeId: context.currentNodeId, pendingNodeId: context.pendingNodeId },
        storage: diagnostics ? {
          totalKnownBytes: Number(diagnostics.totalKnownBytes || 0),
          headGeneration: diagnostics.headGeneration ?? null,
          backupGeneration: diagnostics.backupGeneration ?? null,
          headMatchesCanonical: diagnostics.headMatchesCanonical ?? null,
        } : null,
      };
    }

    function recordFailure(context = {}) {
      const entry = buildFailureEntry(context);
      const remembered = storage.rememberFailure(entry);
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
      return remembered;
    }

    function recordGameplayFailure(label, stage, error, kind = null) {
      return recordFailure({ label, stage, error, kind: kind || failureKind(error) });
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
      const failureRecord = storage.readFailure();
      const writeError = storage.readFailureWriteError();
      const events = readEvents();
      const snapshotResult = await storage.baseSnapshot();
      const measured = storage.measureLocalStorage();
      const snapshot = snapshotResult.value || {};
      const permanent = snapshot.permanentStores || {};
      const localStorageBytes = Number(permanent.localStorageBytes ?? measured.totalBytes ?? 0);
      const hallLegacyBytes = Number(permanent.hall?.legacyBytes ?? permanent.hall?.bytes ?? 0);
      const developmentLegacyBytes = Number(permanent.development?.legacyBytes ?? permanent.development?.bytes ?? 0);
      const albumLegacyBytes = Number(permanent.album?.legacyBytes ?? permanent.album?.bytes ?? 0);
      const hallBytes = Number(permanent.hall?.indexedDbBytes ?? permanent.hall?.bytes ?? 0);
      const developmentBytes = Number(permanent.development?.indexedDbBytes ?? permanent.development?.bytes ?? 0);
      const albumBytes = Number(permanent.album?.indexedDbBytes ?? permanent.album?.bytes ?? 0);
      const profileBytes = Number(permanent.profile?.bytes || 0);
      const legacyPermanentBytes = Number(permanent.legacyPermanentBytes ?? (hallLegacyBytes + developmentLegacyBytes + albumLegacyBytes));
      const indexedDbPermanentBytes = Number(permanent.indexedDbPermanentBytes ?? (hallBytes + developmentBytes + albumBytes));
      const localStorageRunAndMetadataBytes = Math.max(0, localStorageBytes - legacyPermanentBytes);
      return {
        schemaVersion: 3,
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
          hallLegacyBytes,
          developmentLegacyBytes,
          albumLegacyBytes,
          legacyPermanentBytes,
          indexedDbPermanentBytes,
          localStorageRunAndMetadataBytes,
          authority: {
            hall: permanent.hall?.authority || "legacy",
            development: permanent.development?.authority || "legacy",
            album: permanent.album?.authority || "legacy",
          },
          indexedDbPresent: {
            hall: permanent.hall?.indexedDbPresent === true,
            development: permanent.development?.indexedDbPresent === true,
            album: permanent.album?.indexedDbPresent === true,
          },
          cleanupSentinelPresent: permanent.cleanupSentinelPresent === true,
          hallSharePercent: indexedDbPermanentBytes > 0 ? Math.round((hallBytes / indexedDbPermanentBytes) * 1000) / 10 : 0,
          topInazumaKeys: (permanent.topInazumaKeys?.length ? permanent.topInazumaKeys : measured.topInazumaKeys).slice(0, 10),
          browserEstimate: snapshot.browser?.storageEstimate || null,
          browserFamily: snapshot.browser?.family || null,
          snapshotError: snapshotResult.error,
          measurementError: measured.error,
        },
        runs: Array.isArray(snapshot.runs) ? snapshot.runs.map((run) => ({
          seasonId: run.seasonId,
          generation: run.generation,
          phase: run.phase,
          bossIndex: run.bossIndex,
          currentNode: run.currentNode,
          gameOver: run.gameOver,
          finalizationStatus: run.finalizationStatus,
          canonicalState: run.canonicalState,
        })) : [],
      };
    }

    function clearRecorded() {
      storage.clearFailure();
      clearEvents();
    }

    return Object.freeze({
      currentContext,
      recordEvent,
      readEvents,
      recordFailure,
      recordGameplayFailure,
      clearRecorded,
      buildFailureEntry,
      buildReport,
      errorSnapshot,
      failureKind,
      eventsKey: EVENTS_KEY,
    });
  }

  global.GameDiagnosticsRuntime = Object.freeze({ create, errorSnapshot, failureKind });
})(globalThis);
