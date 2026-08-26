(function (global) {
  "use strict";
  const inFlightByUid = new Map();
  async function route({ auth, readJournal, resumeInterrupted, normalAssociate, freshComparison, abandonNonResumable, terminalRecoveryActive = () => false, publish = () => {}, onWritable = () => {} }) {
    if (auth?.status !== "authenticated" || !auth.uid) return null;
    let journal; try { journal = readJournal(auth.uid); } catch (error) { publish({ status: "restore-error", error: error?.code || "restore-journal-unavailable" }); return null; }
    if (!journal && !terminalRecoveryActive()) return normalAssociate?.() ?? null;
    const existing = inFlightByUid.get(auth.uid);
    if (existing) return existing;
    const uid = auth.uid;
    let recovery;
    if (!journal) {
      recovery = Promise.resolve().then(() => freshComparison?.()).catch((error) => {
        publish({ status: "restore-terminal-error", error: error?.code || "fresh-comparison-failed", freshComparisonStatus: "retry-required" });
        return { status: "restore-terminal-error", resumable: true, retryRequired: true };
      });
    } else if (!journal.targetCloudCommitId) {
      recovery = Promise.resolve().then(async () => {
        await abandonNonResumable?.(journal);
        publish({ status: "restore-terminal-error", error: "legacy-cloud-target-not-immutable", journalTerminalReason: "missing-target-cloud-commit-id", restoreResumeEligibility: "fresh-comparison-only" });
        try { await freshComparison?.(); }
        catch (error) { publish({ status: "restore-terminal-error", error: error?.code || "fresh-comparison-failed", freshComparisonStatus: "retry-required" }); }
        return { status: "restore-terminal-error", resumable: false, freshComparisonRequired: true };
      }).catch((error) => {
        publish({ status: "restore-terminal-error", error: error?.code || "restore-terminal-transition-failed", journalTerminalReason: "missing-target-cloud-commit-id", restoreResumeEligibility: "fresh-comparison-only", freshComparisonStatus: "retry-required" });
        return { status: "restore-terminal-error", resumable: false, retryRequired: true };
      });
    } else {
      recovery = Promise.resolve().then(() => resumeInterrupted(journal)).then((result) => { if (result?.status === "restored") onWritable(); return result; }).catch((error) => { publish({ status: error?.code === "restore-journal-repair-needed" ? "restore-repair-needed" : "restore-error", error: error?.code || "restore-failed" }); throw error; });
    }
    inFlightByUid.set(uid, recovery);
    try { return await recovery; }
    finally { if (inFlightByUid.get(uid) === recovery) inFlightByUid.delete(uid); }
  }
  function retry(options) { return route(options); }
  function isRunning(uid = null) { return uid ? inFlightByUid.has(uid) : inFlightByUid.size > 0; }
  global.CloudRestoreResumeCoordinator = Object.freeze({ route, retry, isRunning });
  if (typeof module !== "undefined" && module.exports) module.exports = global.CloudRestoreResumeCoordinator;
})(globalThis);
