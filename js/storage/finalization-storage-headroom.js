(function (global) {
  "use strict";

  function wrappedError(error, stage, fallbackCode = "finalization-headroom-reclaim-failed") {
    const wrapped = new Error(error?.message || fallbackCode);
    wrapped.name = error?.name || "Error";
    wrapped.code = error?.code ?? fallbackCode;
    wrapped.stage = error?.stage || stage;
    wrapped.problemSector = error?.problemSector || "run_backup";
    wrapped.cause = error?.cause || error || null;
    return wrapped;
  }

  function parseObject(raw) {
    try {
      const parsed = JSON.parse(raw || "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function sameWitness(primary, head) {
    return !!(
      primary &&
      head &&
      Number(primary.storageSchemaVersion) === Number(head.storageSchemaVersion) &&
      String(primary.seasonId || "") === String(head.seasonId || "") &&
      Number(primary.generation) === Number(head.generation) &&
      String(primary.commitId || "") === String(head.commitId || "") &&
      String(primary.state || "") === String(head.state || "") &&
      String(primary.runId || "") === String(head.runId || "")
    );
  }

  function reclaimExactBackup(run, options = {}) {
    const seasonId = String(run?.seasonId || "");
    const runId = String(run?.runId || "");
    if (!seasonId || !runId) return { ok: true, reclaimed: false, reason: "missing-run-identity" };
    if (String(run?.phase || "") !== "finalization" || String(run?.finalization?.status || "") !== "hall-written") {
      return { ok: true, reclaimed: false, reason: "not-hall-written" };
    }

    const keys = global.RunStorage?.keys?.(seasonId);
    if (!keys?.primary || !keys?.backup || !keys?.head) return { ok: true, reclaimed: false, reason: "run-storage-unavailable" };

    let primaryRaw;
    let backupRaw;
    let headRaw;
    try {
      primaryRaw = global.localStorage?.getItem(keys.primary);
      backupRaw = global.localStorage?.getItem(keys.backup);
      headRaw = global.localStorage?.getItem(keys.head);
    } catch (error) {
      return { ok: false, reclaimed: false, reason: "storage-read-failed", error: wrappedError(error, "finalization-headroom-read") };
    }

    if (!primaryRaw || !backupRaw || !headRaw) return { ok: true, reclaimed: false, reason: "technical-copy-missing" };
    if (primaryRaw !== backupRaw) return { ok: true, reclaimed: false, reason: "backup-not-exact" };

    const primary = parseObject(primaryRaw);
    const head = parseObject(headRaw);
    if (!primary || !head) return { ok: true, reclaimed: false, reason: "recovery-proof-invalid" };
    if (
      String(primary.state || "") !== "active" ||
      String(primary.seasonId || "") !== seasonId ||
      String(primary.runId || "") !== runId ||
      !sameWitness(primary, head)
    ) {
      return { ok: true, reclaimed: false, reason: "recovery-proof-invalid" };
    }

    if (run.storageGeneration != null && Number(run.storageGeneration) !== Number(primary.generation)) {
      return { ok: true, reclaimed: false, reason: "memory-generation-mismatch" };
    }

    try {
      global.PersistenceRecoveryGuard?.assertWritable(options);
      global.PersistenceRecoveryGuard?.reserve(options);
      global.PersistenceRecoveryGuard?.assertWritable(options);
    } catch (error) {
      return { ok: false, reclaimed: false, reason: error?.code || "restore-recovery-required", error: wrappedError(error, "finalization-headroom-guard") };
    }

    try {
      if (
        global.localStorage?.getItem(keys.primary) !== primaryRaw ||
        global.localStorage?.getItem(keys.backup) !== backupRaw ||
        global.localStorage?.getItem(keys.head) !== headRaw
      ) {
        return { ok: true, reclaimed: false, reason: "storage-changed-during-reclaim" };
      }
      global.localStorage?.removeItem(keys.backup);
      if (global.localStorage?.getItem(keys.backup) != null) throw new Error("backup-removal-readback-mismatch");
      return {
        ok: true,
        reclaimed: true,
        reason: null,
        seasonId,
        runId,
        generation: Number(primary.generation),
        commitId: primary.commitId || null,
        reclaimedBytes: 2 * (String(keys.backup).length + String(backupRaw).length),
      };
    } catch (error) {
      return { ok: false, reclaimed: false, reason: "backup-removal-failed", error: wrappedError(error, "finalization-headroom-remove") };
    }
  }

  global.FinalizationStorageHeadroom = Object.freeze({ reclaimExactBackup, _sameWitness: sameWitness });
})(globalThis);
