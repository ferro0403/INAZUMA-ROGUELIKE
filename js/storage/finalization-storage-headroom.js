(function (global) {
  "use strict";

  function wrappedError(error, stage, fallbackCode = "finalization-headroom-reclaim-failed") {
    const wrapped = new Error(error?.message || fallbackCode);
    wrapped.name = error?.name || "Error";
    wrapped.code = error?.code ?? fallbackCode;
    wrapped.stage = error?.stage || stage;
    wrapped.problemSector = error?.problemSector || "run_backup";
    wrapped.recoverable = error?.recoverable === true;
    wrapped.canonicalCommitted = error?.canonicalCommitted === true;
    wrapped.generation = error?.generation ?? null;
    wrapped.cause = error?.cause || error || null;
    return wrapped;
  }

  function leaseError(code, stage, cause = null) {
    const error = new Error(code);
    error.name = "RunPersistenceError";
    error.code = code;
    error.stage = stage;
    error.problemSector = "run_backup";
    error.recoverable = true;
    error.canonicalCommitted = false;
    if (cause) error.cause = cause;
    return error;
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

  function readProof(keys) {
    try {
      return {
        primaryRaw: global.localStorage?.getItem(keys.primary),
        backupRaw: global.localStorage?.getItem(keys.backup),
        headRaw: global.localStorage?.getItem(keys.head),
      };
    } catch (error) {
      throw leaseError("storage-read-failed", "finalization-headroom-read", error);
    }
  }

  function inspectProof(run, seasonId, runId, proof) {
    if (!proof?.primaryRaw || !proof?.backupRaw || !proof?.headRaw) return { valid: false, reason: "technical-copy-missing" };
    if (proof.primaryRaw !== proof.backupRaw) return { valid: false, reason: "backup-not-exact" };

    const primary = parseObject(proof.primaryRaw);
    const head = parseObject(proof.headRaw);
    if (!primary || !head) return { valid: false, reason: "recovery-proof-invalid" };
    if (
      String(primary.state || "") !== "active" ||
      String(primary.seasonId || "") !== seasonId ||
      String(primary.runId || "") !== runId ||
      !Number.isInteger(Number(primary.generation)) ||
      Number(primary.generation) < 1 ||
      typeof primary.commitId !== "string" ||
      !primary.commitId ||
      !sameWitness(primary, head)
    ) {
      return { valid: false, reason: "recovery-proof-invalid" };
    }

    if (run.storageGeneration != null && Number(run.storageGeneration) !== Number(primary.generation)) {
      return { valid: false, reason: "memory-generation-mismatch" };
    }

    return { valid: true, reason: null, primary, head };
  }

  function sameProof(left, right) {
    return !!(
      left && right &&
      left.primaryRaw === right.primaryRaw &&
      left.backupRaw === right.backupRaw &&
      left.headRaw === right.headRaw
    );
  }

  function withRunStorageLease(keys, operation) {
    const lockKey = keys?.lock;
    if (!lockKey) throw leaseError("run-storage-unavailable", "finalization-headroom-lock-key");
    const ownerId = `headroom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    let existing = null;
    try {
      const raw = global.localStorage?.getItem(lockKey);
      existing = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw leaseError("storage-read-failed", "finalization-headroom-lock-read", error);
    }
    if (existing && Number(existing.expiresAt) > now) throw leaseError("write-locked", "finalization-headroom-lock-acquire");

    const lease = {
      ownerId,
      fence: Math.max(Number(existing?.fence || 0) + 1, now),
      expiresAt: now + 5000,
    };
    try {
      global.localStorage?.setItem(lockKey, JSON.stringify(lease));
      const verified = JSON.parse(global.localStorage?.getItem(lockKey) || "null");
      if (verified?.ownerId !== ownerId || verified?.fence !== lease.fence) throw new Error("lease ownership lost");
    } catch (error) {
      throw leaseError("storage-unavailable", "finalization-headroom-lock-acquire", error);
    }

    const ownsLease = () => {
      try {
        const current = JSON.parse(global.localStorage?.getItem(lockKey) || "null");
        return current?.ownerId === ownerId && current?.fence === lease.fence && Number(current.expiresAt) > Date.now();
      } catch (_) {
        return false;
      }
    };

    try {
      return operation(ownsLease);
    } finally {
      try {
        const current = JSON.parse(global.localStorage?.getItem(lockKey) || "null");
        if (current?.ownerId === ownerId) {
          global.localStorage?.setItem(lockKey, JSON.stringify({ ...current, expiresAt: 0 }));
          global.localStorage?.removeItem(lockKey);
        }
      } catch (_) {}
    }
  }

  function reclaimExactBackup(run, options = {}) {
    const seasonId = String(run?.seasonId || "");
    const runId = String(run?.runId || "");
    if (!seasonId || !runId) return { ok: true, reclaimed: false, reason: "missing-run-identity" };
    if (String(run?.phase || "") !== "finalization" || String(run?.finalization?.status || "") !== "hall-written") {
      return { ok: true, reclaimed: false, reason: "not-hall-written" };
    }

    const keys = global.RunStorage?.keys?.(seasonId);
    if (!keys?.primary || !keys?.backup || !keys?.head || !keys?.lock) {
      return { ok: true, reclaimed: false, reason: "run-storage-unavailable" };
    }

    try {
      global.PersistenceRecoveryGuard?.assertWritable(options);
    } catch (error) {
      return { ok: false, reclaimed: false, reason: error?.code || "restore-recovery-required", error: wrappedError(error, "finalization-headroom-guard") };
    }

    let initialProof;
    try {
      initialProof = readProof(keys);
    } catch (error) {
      return { ok: false, reclaimed: false, reason: error?.code || "storage-read-failed", error: wrappedError(error, error?.stage || "finalization-headroom-read") };
    }
    const initialInspection = inspectProof(run, seasonId, runId, initialProof);
    if (!initialInspection.valid) return { ok: true, reclaimed: false, reason: initialInspection.reason };

    try {
      return withRunStorageLease(keys, (ownsLease) => {
        if (!ownsLease()) throw leaseError("write-locked", "finalization-headroom-lock-fence");

        const lockedProof = readProof(keys);
        if (!sameProof(initialProof, lockedProof)) return { ok: true, reclaimed: false, reason: "storage-changed-during-reclaim" };
        const lockedInspection = inspectProof(run, seasonId, runId, lockedProof);
        if (!lockedInspection.valid) return { ok: true, reclaimed: false, reason: lockedInspection.reason };

        try {
          global.PersistenceRecoveryGuard?.assertWritable(options);
          global.PersistenceRecoveryGuard?.reserve(options);
          global.PersistenceRecoveryGuard?.assertWritable(options);
        } catch (error) {
          throw wrappedError(error, "finalization-headroom-guard");
        }

        if (!ownsLease()) throw leaseError("write-locked", "finalization-headroom-lock-fence");
        const finalProof = readProof(keys);
        if (!sameProof(lockedProof, finalProof)) return { ok: true, reclaimed: false, reason: "storage-changed-during-reclaim" };

        try {
          global.localStorage?.removeItem(keys.backup);
          if (global.localStorage?.getItem(keys.backup) != null) throw new Error("backup-removal-readback-mismatch");
        } catch (error) {
          throw leaseError("backup-removal-failed", "finalization-headroom-remove", error);
        }

        return {
          ok: true,
          reclaimed: true,
          reason: null,
          seasonId,
          runId,
          generation: Number(lockedInspection.primary.generation),
          commitId: lockedInspection.primary.commitId || null,
          reclaimedBytes: 2 * (String(keys.backup).length + String(lockedProof.backupRaw).length),
        };
      });
    } catch (error) {
      return {
        ok: false,
        reclaimed: false,
        reason: error?.code || "finalization-headroom-reclaim-failed",
        error: wrappedError(error, error?.stage || "finalization-headroom-reclaim"),
      };
    }
  }

  global.FinalizationStorageHeadroom = Object.freeze({
    reclaimExactBackup,
    _sameWitness: sameWitness,
    _withRunStorageLease: withRunStorageLease,
  });
})(globalThis);
