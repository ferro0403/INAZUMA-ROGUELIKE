(function (global) {
  "use strict";
  const RUN_IDS = ["ie1", "ie2", "ie1_s2", "ie1_s3"];
  const STAGES = ["profile", ...RUN_IDS.map((id) => `run-${id}`), "album", "development", "hall", "verify", "metadata", "complete"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function createJournal(value) {
    const runProgress = Object.fromEntries(RUN_IDS.map((id) => [id, { status: "pending", sourceGeneration: Number(value.sourceRunProvenance?.[id]?.generation || 0), appliedGeneration: null, targetLogicalHash: value.targetRunHashes?.[id] ?? null }]));
    return { schemaVersion: 3, operationId: value.operationId, uid: value.uid, restoreType: value.restoreType, targetCloudRevision: value.targetCloudRevision, targetCloudCommitId: value.targetCloudCommitId || null, targetManifestIdentity: value.targetManifestIdentity, sourceLocalEpoch: value.sourceLocalEpoch, expectedLocalEpoch: value.expectedLocalEpoch, sourceRunProvenance: clone(value.sourceRunProvenance || {}), runProgress, stage: "prepared", startedAt: value.startedAt };
  }
  async function recover({ journal, loadTarget, writeJournal, clearJournal, adapters, onBlocked = () => {}, onComplete = () => {}, crash = () => {} }) {
    onBlocked(journal); const target = await loadTarget(journal); if (!target?.snapshot || !target?.manifest) throw Object.assign(new Error("restore-journal-repair-needed"), { code: "restore-journal-repair-needed" });
    const persist = (stage) => { journal = writeJournal({ ...journal, stage }); return journal; };
    for (const stage of STAGES) {
      await adapters.assertActive?.(); persist(stage); await crash(`before:${stage}`, journal);
      if (stage.startsWith("run-")) {
        const id = stage.slice(4), wanted = target.snapshot.runs[id], current = await adapters.readRun(id);
        if (await adapters.runEquals(current, wanted)) { journal.runProgress[id] = { ...journal.runProgress[id], status: "applied", appliedGeneration: await adapters.runGeneration(id) }; persist(stage); continue; }
        await adapters.assertOwnership(journal, id); await adapters.applyRun(id, wanted, journal); await crash(`after-run-commit:${id}`, journal);
        const applied = await adapters.readRun(id); if (!await adapters.runEquals(applied, wanted)) throw Object.assign(new Error("run-restore-verification-failed"), { code: "run-restore-verification-failed", problemSector: `run_${id}` });
        journal.runProgress[id] = { ...journal.runProgress[id], status: "applied", appliedGeneration: await adapters.runGeneration(id) }; persist(stage);
      } else if (["profile", "album", "development", "hall"].includes(stage)) {
        if (!await adapters.storeEquals(stage, target.snapshot)) { await adapters.assertOwnership(journal, stage); await adapters.applyStore(stage, target.snapshot, journal); }
      } else if (stage === "verify") { if (!await adapters.verify(target.snapshot)) throw Object.assign(new Error("post-write-verification-failed"), { code: "post-write-verification-failed" }); }
      else if (stage === "metadata") await adapters.writeMetadata(target.manifest, target.snapshot);
      await crash(`after:${stage}`, journal);
    }
    await adapters.assertActive?.();
    try { clearJournal(); } catch (error) { return { status: "restore-repair-needed", journal, error }; }
    onComplete(journal); return { status: "restored", journal };
  }
  const api = Object.freeze({ RUN_IDS, STAGES, createJournal, recover }); global.InazumaCloudRestoreProtocol = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
