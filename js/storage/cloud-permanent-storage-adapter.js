(function (global) {
  "use strict";

  const core = global.InazumaCloudSaveCore;
  const repository = global.AlbumIndexedDbStorage;
  if (!core || !repository) return;

  const LOCAL_SNAPSHOT = typeof Symbol === "function" ? Symbol("inazuma-local-permanent-snapshot") : "__inazumaLocalPermanentSnapshot";
  const baseReadLocalSnapshot = core.readLocalSnapshot.bind(core);
  const basePrepareSnapshot = core.prepareSnapshot.bind(core);
  const baseCompareSnapshots = core.compareSnapshots.bind(core);

  function markLocal(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;
    try { Object.defineProperty(snapshot, LOCAL_SNAPSHOT, { value: true, enumerable: false, configurable: false }); }
    catch (_) { snapshot[LOCAL_SNAPSHOT] = true; }
    return snapshot;
  }

  function isLocal(snapshot) {
    return !!snapshot?.[LOCAL_SNAPSHOT];
  }

  async function materializeLocal(snapshot) {
    if (!isLocal(snapshot)) return snapshot;
    const readiness = await repository.ensureReady();
    if (readiness?.authority !== "indexeddb") return snapshot;
    await repository.refresh();
    const current = core.clone(snapshot);
    current.album = repository.read();
    return current;
  }

  function readLocalSnapshot(...args) {
    return markLocal(baseReadLocalSnapshot(...args));
  }

  async function prepareSnapshot(snapshot, cryptoApi = global.crypto) {
    return basePrepareSnapshot(await materializeLocal(snapshot), cryptoApi);
  }

  async function compareSnapshots(expected, actual, cryptoApi = global.crypto) {
    const [left, right] = await Promise.all([materializeLocal(expected), materializeLocal(actual)]);
    return baseCompareSnapshots(left, right, cryptoApi);
  }

  global.InazumaCloudSaveCore = Object.freeze({ ...core, readLocalSnapshot, prepareSnapshot, compareSnapshots });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaCloudSaveCore;
})(typeof globalThis !== "undefined" ? globalThis : window);
