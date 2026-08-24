(function (global) {
  "use strict";
  let inFlight = null, activeUid = null;
  async function route({ auth, readJournal, resumeInterrupted, normalAssociate, publish = () => {}, onWritable = () => {} }) {
    if (auth?.status !== "authenticated" || !auth.uid) { activeUid = null; return null; }
    let journal; try { journal = readJournal(auth.uid); } catch (error) { publish({ status: "restore-error", error: error?.code || "restore-journal-unavailable" }); return null; }
    if (!journal) return normalAssociate?.() ?? null;
    if (inFlight && activeUid === auth.uid) return inFlight;
    activeUid = auth.uid;
    inFlight = Promise.resolve().then(() => resumeInterrupted(journal)).then((result) => { if (result?.status === "restored") onWritable(); return result; }).catch((error) => { publish({ status: error?.code === "restore-journal-repair-needed" ? "restore-repair-needed" : "restore-error", error: error?.code || "restore-failed" }); throw error; }).finally(() => { inFlight = null; activeUid = null; });
    return inFlight;
  }
  function retry(options) { return route(options); }
  global.CloudRestoreResumeCoordinator = Object.freeze({ route, retry, isRunning: () => !!inFlight });
  if (typeof module !== "undefined" && module.exports) module.exports = global.CloudRestoreResumeCoordinator;
})(globalThis);
