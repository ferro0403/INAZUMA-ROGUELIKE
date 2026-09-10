(function (global) {
  "use strict";

  const core = global.InazumaCloudSaveCore;
  const albumRepository = global.AlbumIndexedDbStorage;
  const hallRepository = global.HallOfFameStorage;
  if (!core) return;

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

  function hallCloudShape(archive) {
    return {
      archiveSchemaVersion: archive?.schemaVersion ?? hallRepository?.ARCHIVE_SCHEMA_VERSION ?? 1,
      updatedAt: archive?.updatedAt ?? null,
      teams: Array.isArray(archive?.teams) ? core.clone(archive.teams) : [],
      index: Array.isArray(archive?.index) ? core.clone(archive.index) : [],
    };
  }

  async function materializeLocal(snapshot) {
    if (!isLocal(snapshot)) return snapshot;
    const current = core.clone(snapshot);

    if (albumRepository?.ensureReady) {
      const readiness = await albumRepository.ensureReady();
      if (readiness?.authority === "indexeddb") {
        await albumRepository.refresh();
        current.album = albumRepository.read();
      }
    }

    if (hallRepository?.ensureIndexedDbReady) {
      const readiness = await hallRepository.ensureIndexedDbReady();
      if (readiness?.authority === "indexeddb") {
        const archive = await hallRepository.refreshIndexedDbArchive();
        current.hallOfFame = hallCloudShape(archive);
      }
    }

    const developmentRepository = global.DevelopmentIndexedDbStorage;
    if (developmentRepository?.ensureReady) {
      const readiness = await developmentRepository.ensureReady();
      if (readiness?.authority === "indexeddb") {
        await developmentRepository.refresh();
        current.development = developmentRepository.readCompatibility();
      }
    }

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
