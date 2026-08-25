(function (global) {
  "use strict";

  const RUN_IDS = ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"];
  const HALL_KEY = "inazuma.hallOfFame.v1";
  const DEVELOPMENT_KEY = "inazumaRoguelike.developmentV2";
  const ALBUM_KEY = "inazumaRoguelike.albumProgress";
  const PROFILE_KEYS = ["inazuma_roguelike_profile", "inazuma.profile"];
  const byteLength = (key, value) => 2 * (String(key || "").length + String(value || "").length);
  const shortHash = (value) => {
    if (!value) return null;
    let hash = 2166136261;
    for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
  };
  const truncate = (value) => value ? `${String(value).slice(0, 8)}…` : null;
  const account = () => {
    const auth = global.InazumaAccount?.getState?.();
    return auth?.status === "authenticated" && auth.uid ? { uid: String(auth.uid) } : null;
  };
  const sanitizedKey = (key) => String(key).replace(/^(inazuma\.cloud\.(?:restoreJournal|association)\.).+$/, "$1[account]");
  function safeJson(raw, fallback = null) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function entries() {
    const result = [];
    for (let index = 0; index < global.localStorage.length; index += 1) {
      const key = global.localStorage.key(index);
      if (key == null) continue;
      const value = global.localStorage.getItem(key) || "";
      result.push({ key, value, bytes: byteLength(key, value) });
    }
    return result;
  }
  function runDiagnostic(seasonId) {
    const diagnostic = global.RunStorage?.diagnostics?.(seasonId) || {};
    const run = global.RunState?.load?.(seasonId, { readOnly: true }) || null;
    const keys = global.RunStorage?.keys?.(seasonId) || {};
    const present = (key) => Array.isArray(key) ? key.some((item) => global.localStorage.getItem(item) != null) : !!key && global.localStorage.getItem(key) != null;
    return {
      seasonId, canonicalState: diagnostic.canonicalState || "unknown", generation: diagnostic.canonicalGeneration || 0,
      commitId: truncate(diagnostic.canonicalCommitId), runId: truncate(diagnostic.canonicalRunId), phase: run?.phase || null,
      bossIndex: Number(run?.bossIndex || 0), currentZone: run?.currentZone?.zoneIndex ?? run?.currentZone?.id ?? null,
      currentNode: run?.currentZone?.currentNodeId ?? null, gameOver: !!run?.gameOver,
      finalizationStatus: run?.finalization?.status || null,
      outbox: { pending: (run?.permanentEffectOutbox || []).filter((item) => item.status !== "applied").length, applied: (run?.permanentEffectOutbox || []).filter((item) => item.status === "applied").length },
      present: { primary: present(keys.primary), head: present(keys.head), backup: present(keys.backup), temp: present(keys.temp) }, bytes: diagnostic.bytes || {}
    };
  }
  async function snapshot() {
    const all = entries(), cloud = global.InazumaCloudSave?.getState?.() || {};
    const guard = global.PersistenceRecoveryGuard?.getState?.() || {};
    const active = account(), journalEntry = active ? all.find((entry) => entry.key === `inazuma.cloud.restoreJournal.${active.uid}`) : null;
    const journal = safeJson(journalEntry?.value);
    const hall = safeJson(global.localStorage.getItem(HALL_KEY), {}), development = safeJson(global.localStorage.getItem(DEVELOPMENT_KEY), {});
    const storageEstimate = await global.navigator?.storage?.estimate?.().catch?.(() => null) || null;
    const bytesFor = (keys) => all.filter((entry) => keys.some((key) => entry.key === key || entry.key.startsWith(key))).reduce((sum, entry) => sum + entry.bytes, 0);
    return {
      schemaVersion: 1, capturedAt: new Date().toISOString(),
      cloud: { status: cloud.status || "unavailable", errorCode: cloud.error || null, localRevision: cloud.localRevision ?? null, cloudRevision: cloud.cloudRevision ?? cloud.revision ?? null, attemptedRevision: cloud.attemptedRevision ?? null, pendingSectors: cloud.pendingSectors || [], restoreStage: cloud.restoreStage || null, restoreReadCount: cloud.restoreReadCount || 0, hasCommitId: !!cloud.cloudCommitId, deviceId: shortHash(cloud.deviceId) },
      guard: { state: { ...guard, uid: guard.uid ? "[redacted]" : null, operationId: shortHash(guard.operationId), error: guard.error || null }, isBlocked: !!global.PersistenceRecoveryGuard?.isBlocked?.(), authenticated: !!active, storedJournalCount: all.filter((entry) => entry.key.startsWith("inazuma.cloud.restoreJournal.")).length, journalPresent: !!journal, journalStage: journal?.stage || null, operationId: shortHash(journal?.operationId), targetCloudRevision: journal?.targetCloudRevision ?? null, hasTargetCloudCommitId: !!journal?.targetCloudCommitId, journalAgeMs: journal?.startedAt ? Math.max(0, Date.now() - Date.parse(journal.startedAt)) : null, localMutationEpoch: global.PersistenceRecoveryGuard?.readEpoch?.() ?? null },
      runs: RUN_IDS.map(runDiagnostic),
      permanentStores: { hall: { count: hall.teams?.length || 0, bytes: bytesFor([HALL_KEY]) }, development: { bytes: bytesFor([DEVELOPMENT_KEY]), redeemedRunIds: development.redeemedRunIds?.length || 0, victoryRewardRunIds: development.victoryRewardRunIds?.length || 0 }, album: { bytes: bytesFor([ALBUM_KEY]) }, profile: { bytes: bytesFor(PROFILE_KEYS) }, localStorageBytes: all.reduce((sum, entry) => sum + entry.bytes, 0), topInazumaKeys: all.filter((entry) => /inazuma|^run:/i.test(entry.key)).sort((a, b) => b.bytes - a.bytes).slice(0, 15).map(({ key, bytes }) => ({ key: sanitizedKey(key), bytes })) },
      browser: { storageEstimate: storageEstimate && { usage: storageEstimate.usage ?? null, quota: storageEstimate.quota ?? null }, localStorageMeasuredBytes: all.reduce((sum, entry) => sum + entry.bytes, 0), family: /iP(?:hone|ad|od)/.test(global.navigator?.userAgent || "") ? "iOS WebKit" : /Firefox/i.test(global.navigator?.userAgent || "") ? "Firefox" : /Chrome|Chromium/i.test(global.navigator?.userAgent || "") ? "Chromium" : "Other" }
    };
  }
  function removeExactTechnicalDuplicates() {
    const removed = [];
    for (const seasonId of RUN_IDS) {
      const keys = global.RunStorage?.keys?.(seasonId) || {};
      const primary = keys.primary && global.localStorage.getItem(keys.primary), backup = keys.backup && global.localStorage.getItem(keys.backup);
      if (primary && backup && primary === backup) { global.localStorage.removeItem(keys.backup); removed.push(keys.backup); }
      if (keys.temp && global.localStorage.getItem(keys.temp) && primary) { const temp = safeJson(global.localStorage.getItem(keys.temp)), canonical = safeJson(primary); if (temp?.commitId && temp.commitId === canonical?.commitId) { global.localStorage.removeItem(keys.temp); removed.push(keys.temp); } }
      if (keys.lock) { const lock = safeJson(global.localStorage.getItem(keys.lock)); if (lock && Number(lock.expiresAt || 0) < Date.now()) { global.localStorage.removeItem(keys.lock); removed.push(keys.lock); } }
    }
    const hall = global.localStorage.getItem(HALL_KEY), hallBackup = global.localStorage.getItem(`${HALL_KEY}.backup`);
    if (hall && hall === hallBackup) { global.localStorage.removeItem(`${HALL_KEY}.backup`); removed.push(`${HALL_KEY}.backup`); }
    return removed;
  }
  async function repair(options = {}) {
    const before = await snapshot();
    const active = account();
    if (!active) return { repaired: false, action: "none", removedTechnicalKeys: [], blocker: "account-scope-unavailable", before, after: before };
    const journalKey = `inazuma.cloud.restoreJournal.${active.uid}`;
    const journal = journalKey ? safeJson(global.localStorage.getItem(journalKey)) : null;
    let action = "none", blocker = null;
    if (journal) {
      if (journal.uid !== active.uid) return { repaired: false, action, removedTechnicalKeys: [], blocker: "journal-account-mismatch", before, after: before };
      const epoch = global.PersistenceRecoveryGuard?.readEpoch?.();
      const resume = options.resume || global.InazumaCloudSave?.resumeInterruptedRestore;
      if (journal.targetCloudCommitId && typeof resume === "function") {
        try {
          const resumed = await resume(journal);
          if (resumed?.status === "restored") action = "resumed-immutable-target";
          else blocker = resumed?.status || "immutable-target-resume-incomplete";
        } catch (error) { blocker = error?.code || "immutable-target-unavailable"; }
      } else if (["prepared", "abort-proven"].includes(journal.stage) && !journal.targetCloudCommitId && Number(journal.expectedLocalEpoch) === Number(epoch) && Number(journal.sourceLocalEpoch) === Number(epoch)) {
        const guardState = global.PersistenceRecoveryGuard?.getState?.() || {};
        if (guardState.uid !== active.uid || (guardState.operationId && guardState.operationId !== journal.operationId)) blocker = "restore-ownership-lost";
        else {
          const abortJournal = { ...journal, stage: "abort-proven", abortProof: { localEpoch: epoch, noLocalWrites: true } };
          global.localStorage.setItem(journalKey, JSON.stringify(abortJournal));
          options.crash?.("before-guard-clear");
          global.PersistenceRecoveryGuard?.clearBlocked?.(journal.operationId);
          options.crash?.("before-journal-remove");
          global.localStorage.removeItem(journalKey);
          if (global.localStorage.getItem(journalKey) != null) throw Object.assign(new Error("restore-journal-cleanup-failed"), { code: "restore-journal-cleanup-failed" });
          global.PersistenceRecoveryGuard?.assertWritable?.({ readOnly: true }); action = "aborted-unmodified-restore";
        }
      } else if (journal.stage === "complete") {
        const metadata = entries().map((entry) => entry.key.startsWith("inazuma.cloud.association.") ? safeJson(entry.value) : null).find((item) => item?.revision === journal.targetCloudRevision);
        if (metadata) { global.PersistenceRecoveryGuard?.clearBlocked?.(journal.operationId); global.localStorage.removeItem(journalKey); action = "cleared-verified-complete-journal"; }
        else blocker = "complete-journal-target-not-locally-proven";
      } else blocker = journal.targetCloudCommitId ? "immutable-target-resume-required" : "partial-restore-without-immutable-target";
    }
    const removedTechnicalKeys = blocker ? [] : removeExactTechnicalDuplicates();
    const after = await snapshot();
    return { repaired: !!(action !== "none" || removedTechnicalKeys.length), action, removedTechnicalKeys, blocker, before, after };
  }
  global.InazumaPersistenceDiagnostics = Object.freeze({ snapshot, repair, removeExactTechnicalDuplicates });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaPersistenceDiagnostics;
})(globalThis);
