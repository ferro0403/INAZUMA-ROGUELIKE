(function (global) {
  "use strict";
  const STAGES = ["profile", "album", "development", "hall", "verify", "metadata", "complete"];
  function createJournal(value) {
    return { schemaVersion: 3, operationId: value.operationId, uid: value.uid, restoreType: value.restoreType, safeAutomaticReplace: value.safeAutomaticReplace === true, targetCloudRevision: value.targetCloudRevision, targetCloudCommitId: value.targetCloudCommitId || null, targetManifestIdentity: value.targetManifestIdentity, sourceLocalEpoch: value.sourceLocalEpoch, expectedLocalEpoch: value.expectedLocalEpoch, stage: "prepared", startedAt: value.startedAt };
  }
  async function recover({ journal, loadTarget, writeJournal, clearJournal, adapters, onBlocked = () => {}, onComplete = () => {}, crash = () => {} }) {
    onBlocked(journal); const target = await loadTarget(journal); if (!target?.snapshot || !target?.manifest) throw Object.assign(new Error("restore-journal-repair-needed"), { code: "restore-journal-repair-needed" });
    const persist = (stage) => { journal = writeJournal({ ...journal, stage }); return journal; };
    for (const stage of STAGES) {
      await adapters.assertActive?.(); persist(stage); await crash(`before:${stage}`, journal);
      if (["profile", "album", "development", "hall"].includes(stage)) {
        if (!await adapters.storeEquals(stage, target.snapshot)) { await adapters.assertOwnership(journal, stage); await adapters.applyStore(stage, target.snapshot, journal); }
      } else if (stage === "verify") { if (!await adapters.verify(target.snapshot)) throw Object.assign(new Error("post-write-verification-failed"), { code: "post-write-verification-failed" }); }
      else if (stage === "metadata") await adapters.writeMetadata(target.manifest, target.snapshot);
      await crash(`after:${stage}`, journal);
    }
    await adapters.assertActive?.();
    try { clearJournal(); } catch (error) { return { status: "restore-repair-needed", journal, error }; }
    onComplete(journal); return { status: "restored", journal };
  }
  const api = Object.freeze({ STAGES, createJournal, recover }); global.InazumaCloudRestoreProtocol = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
