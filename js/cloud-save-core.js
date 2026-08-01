(function (global) {
  "use strict";

  const DOCUMENT_LIMIT_BYTES = 850 * 1024;
  const SECTOR_NAMES = ["profile", "run_ie1", "run_ie2", "album", "development", "hall_index"];

  function normalize(value, inArray = false) {
    if (value === undefined) return inArray ? null : undefined;
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => normalize(item, true));
    if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
      const clean = normalize(value[key], false);
      return clean === undefined ? [] : [[key, clean]];
    }));
    return inArray ? null : undefined;
  }

  function clone(value) { return normalize(value); }
  function stableSerialize(value) { return JSON.stringify(normalize(value)); }
  function byteSize(value) { return new TextEncoder().encode(stableSerialize(value)).byteLength; }
  async function hash(value, cryptoApi = global.crypto) {
    if (!cryptoApi?.subtle) throw new Error("Web Crypto SHA-256 non disponibile");
    const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(stableSerialize(value)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function readLocalSnapshot(apis = global) {
    const archive = apis.HallOfFameStorage._loadArchive();
    const teams = Array.isArray(archive?.teams) ? archive.teams.map(clone) : [];
    return normalize({
      profile: apis.RunState.loadProfile(),
      runs: { ie1: apis.RunState.load("ie1"), ie2: apis.RunState.load("ie2") },
      album: apis.AlbumProgress.read(),
      development: apis.DevelopmentV2.read(),
      hallOfFame: {
        archiveSchemaVersion: archive?.schemaVersion ?? apis.HallOfFameStorage.ARCHIVE_SCHEMA_VERSION ?? 1,
        updatedAt: archive?.updatedAt ?? null,
        teams,
        index: Array.isArray(archive?.index) ? archive.index : [],
      },
    });
  }

  function hallIndex(snapshot) {
    const hall = snapshot.hallOfFame;
    return normalize({ archiveSchemaVersion: hall.archiveSchemaVersion, updatedAt: hall.updatedAt, teamIds: hall.teams.map((team) => team.hallTeamId), index: hall.index, count: hall.teams.length });
  }

  async function prepareSnapshot(snapshot, cryptoApi = global.crypto) {
    const clean = normalize(snapshot);
    const payloads = {
      profile: clean.profile ?? {}, run_ie1: clean.runs?.ie1 ?? null, run_ie2: clean.runs?.ie2 ?? null,
      album: clean.album ?? {}, development: clean.development ?? {}, hall_index: hallIndex(clean),
    };
    const hashes = {};
    for (const name of SECTOR_NAMES) hashes[name] = await hash(payloads[name], cryptoApi);
    const hallEntries = [];
    for (const team of clean.hallOfFame.teams) hallEntries.push({ hallTeamId: team.hallTeamId, archiveKey: team.archiveKey, payload: team, payloadHash: await hash(team, cryptoApi) });
    return { snapshot: clean, payloads, hashes, hallEntries };
  }

  function preflight(prepared, limit = DOCUMENT_LIMIT_BYTES) {
    for (const name of SECTOR_NAMES) if (byteSize(prepared.payloads[name]) > limit) throw Object.assign(new Error(`Documento ${name} troppo grande`), { code: "document-too-large", problemSector: name });
    for (const entry of prepared.hallEntries) if (byteSize(entry.payload) > limit) throw Object.assign(new Error(`Documento Hall of Fame ${entry.hallTeamId} troppo grande`), { code: "document-too-large", problemSector: `hallOfFame/${entry.hallTeamId}` });
    return true;
  }

  function buildManifest(prepared, uid, deviceId, timestamp) {
    return { schemaVersion: 1, revision: 1, initialized: true, createdAt: timestamp, updatedAt: timestamp, source: "local-first-association", deviceId, accountUid: uid,
      sectors: { profile: true, run_ie1: prepared.payloads.run_ie1 !== null, run_ie2: prepared.payloads.run_ie2 !== null, album: true, development: true, hallOfFameCount: prepared.hallEntries.length },
      sectorHashes: { profile: prepared.hashes.profile, run_ie1: prepared.payloads.run_ie1 === null ? null : prepared.hashes.run_ie1, run_ie2: prepared.payloads.run_ie2 === null ? null : prepared.hashes.run_ie2, album: prepared.hashes.album, development: prepared.hashes.development, hall_index: prepared.hashes.hall_index } };
  }

  global.InazumaCloudSaveCore = Object.freeze({ DOCUMENT_LIMIT_BYTES, SECTOR_NAMES, normalize, clone, stableSerialize, byteSize, hash, readLocalSnapshot, hallIndex, prepareSnapshot, preflight, buildManifest });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaCloudSaveCore;
})(globalThis);
