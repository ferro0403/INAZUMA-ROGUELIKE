(function (global) {
  "use strict";
  const inFlightByUid = new Map();
  async function route({ auth, readJournal, resumeInterrupted, normalAssociate, publish = () => {}, onWritable = () => {} }) {
    if (auth?.status !== "authenticated" || !auth.uid) return null;
    let journal; try { journal = readJournal(auth.uid); } catch (error) { publish({ status: "restore-error", error: error?.code || "restore-journal-unavailable" }); return null; }
    if (!journal) return normalAssociate?.() ?? null;
    const existing = inFlightByUid.get(auth.uid);
    if (existing) return existing;
    const uid = auth.uid;
    const recovery = Promise.resolve().then(() => resumeInterrupted(journal)).then((result) => { if (result?.status === "restored") onWritable(); return result; }).catch((error) => { publish({ status: error?.code === "restore-journal-repair-needed" ? "restore-repair-needed" : "restore-error", error: error?.code || "restore-failed" }); throw error; });
    inFlightByUid.set(uid, recovery);
    try { return await recovery; }
    finally { if (inFlightByUid.get(uid) === recovery) inFlightByUid.delete(uid); }
  }
  function retry(options) { return route(options); }
  function isRunning(uid = null) { return uid ? inFlightByUid.has(uid) : inFlightByUid.size > 0; }
  global.CloudRestoreResumeCoordinator = Object.freeze({ route, retry, isRunning });
  if (typeof module !== "undefined" && module.exports) module.exports = global.CloudRestoreResumeCoordinator;
})(globalThis);
