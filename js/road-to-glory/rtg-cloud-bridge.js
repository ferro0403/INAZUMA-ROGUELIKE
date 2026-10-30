(function (global) {
  "use strict";
  const core = global.InazumaCloudSaveCore;
  if (!core || !global.RoadToGloryStorage || !global.RoadToGloryCloudLocalAdapter) return;
  const LOCAL = Symbol("rtg-local-account-snapshot");
  const storage = global.RoadToGloryStorage.create();
  const local = global.RoadToGloryCloudLocalAdapter.create({ storage });
  let restore = null;
  function restoreAdapter() {
    return restore ||= global.RoadToGloryCloudRestoreAdapter.create({ storage });
  }
  function readLocalSnapshot(...args) {
    const value = core.readLocalSnapshot(...args);
    Object.defineProperty(value, LOCAL, { value: true });
    return value;
  }
  async function prepareSnapshot(snapshot, cryptoApi = global.crypto) {
    const prepared = await core.prepareSnapshot(snapshot, cryptoApi);
    if (!snapshot?.[LOCAL]) return prepared;
    let captured;
    try { captured = await local.captureStable(); }
    catch (error) { captured = { status: "error", reason: error.code || "rtg-cloud-capture-failed",
      detail: typeof error.detail === "string" && /^(rtg-ie-trilogy|rtg-ares-orion):[A-Za-z][A-Za-z.]*$/.test(error.detail)
        ? error.detail : null }; }
    if (captured.status !== "ready") return { ...prepared, rtgCapture: captured };
    const rtg = captured.snapshot;
    try { restoreAdapter().validateTarget(rtg); }
    catch (error) { return { ...prepared, rtgCapture: { status: "error", reason: error.code || "rtg-cloud-invalid-local-state" } }; }
    const present = Object.values(rtg.campaigns).some(Boolean) || rtg.shared != null || rtg.album.cardIds.length > 0
      || !!await storage.read?.("cloud:restore-proof");
    return present ? { ...await core.prepareSnapshot({ ...prepared.snapshot, rtg }, cryptoApi), rtgCapture: captured }
      : { ...prepared, rtgCapture: { status: "absent", snapshot: rtg } };
  }
  async function compareSnapshots(expected, actual, cryptoApi = global.crypto) {
    const [left, right] = await Promise.all([prepareSnapshot(expected, cryptoApi), prepareSnapshot(actual, cryptoApi)]);
    if ([left, right].some(value => ["error", "deferred"].includes(value.rtgCapture?.status))) return { equivalent: false, mismatches: ["rtg"] };
    return core.compareSnapshots(left.snapshot, right.snapshot, cryptoApi);
  }
  global.InazumaCloudSaveCore = Object.freeze({ ...core, readLocalSnapshot, prepareSnapshot, compareSnapshots });
  global.RoadToGloryCloudBridge = Object.freeze({ restoreAdapter });
})(globalThis);
