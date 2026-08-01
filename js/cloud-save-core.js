(function (global) {
  "use strict";

  const DOCUMENT_LIMIT_BYTES = 850 * 1024;
  const CLOUD_SCHEMA_VERSION = 1;
  const MAX_HALL_TEAMS = 1000;
  const SECTOR_NAMES = ["profile", "run_ie1", "run_ie2", "album", "development", "hall_index"];
  const SHA256_REGEX = /^[a-f0-9]{64}$/;

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

  function own(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
  function cloudError(code, problemSector = null) { return Object.assign(new Error(code), { code, problemSector }); }
  function nonEmptyObject(value) { return !!value && typeof value === "object" && Object.keys(value).length > 0; }
  function positiveValues(value) { return Object.values(value || {}).some((item) => Number(item) > 0); }

  function inspectLocalProgress(snapshot) {
    const value = normalize(snapshot || {});
    const albumUnlocked = Object.values(value.album?.collections || {}).reduce((total, collection) => total + Object.keys(collection?.unlockedPlayerIds || {}).length, 0);
    const development = value.development || {};
    const developmentProgress = Number(development.coins) > 0 || Number(development.cups) > 0 || positiveValues(development.projects) || positiveValues(development.projectBuild)
      || nonEmptyObject(development.players) || (development.evolutionHistory || []).length > 0 || (development.redeemedRunIds || []).length > 0
      || (development.victoryRewardRunIds || []).length > 0 || nonEmptyObject(development.projectPullLedger);
    const summary = {
      profile: !!value.profile?.teamIdentity,
      runIe1: value.runs?.ie1 != null,
      runIe2: value.runs?.ie2 != null,
      albumUnlocked,
      developmentProgress,
      hallOfFameCount: Array.isArray(value.hallOfFame?.teams) ? value.hallOfFame.teams.length : 0,
    };
    const reasons = [];
    if (summary.profile) reasons.push("profile");
    if (summary.runIe1) reasons.push("run_ie1");
    if (summary.runIe2) reasons.push("run_ie2");
    if (summary.albumUnlocked) reasons.push("album");
    if (summary.developmentProgress) reasons.push("development");
    if (summary.hallOfFameCount) reasons.push("hall_of_fame");
    return { empty: reasons.length === 0, meaningful: reasons.length > 0, reasons, summary };
  }

  function validateManifest(manifest, uid) {
    if (!manifest || typeof manifest !== "object") throw cloudError("missing-manifest", "manifest");
    if (Number(manifest.schemaVersion) > CLOUD_SCHEMA_VERSION) throw cloudError("unsupported-cloud-schema", "manifest");
    if (manifest.schemaVersion !== CLOUD_SCHEMA_VERSION || manifest.initialized !== true) throw cloudError("invalid-manifest", "manifest");
    if (!Number.isInteger(manifest.revision) || manifest.revision < 1 || manifest.accountUid !== uid) throw cloudError("invalid-manifest", "manifest");
    if (!manifest.sectors || typeof manifest.sectors !== "object" || !manifest.sectorHashes || typeof manifest.sectorHashes !== "object") throw cloudError("invalid-manifest", "manifest");
    for (const name of SECTOR_NAMES) {
      if (name !== "hall_index" && !own(manifest.sectors, name)) throw cloudError("invalid-manifest", "manifest");
      if (!own(manifest.sectorHashes, name)) throw cloudError("invalid-manifest", "manifest");
      const hashValue = manifest.sectorHashes[name];
      const absentRun = (name === "run_ie1" || name === "run_ie2") && manifest.sectors[name] === false;
      if (absentRun ? hashValue !== null : !SHA256_REGEX.test(hashValue || "")) throw cloudError("invalid-manifest", name);
    }
    const count = manifest.sectors.hallOfFameCount;
    if (!Number.isInteger(count) || count < 0 || count > MAX_HALL_TEAMS) throw cloudError("invalid-manifest", "hall_index");
    return normalize(manifest);
  }

  async function validateSectorDocument(name, data, manifest, cryptoApi = global.crypto) {
    if (!data || typeof data !== "object") throw cloudError("missing-sector", name);
    if (data.schemaVersion !== CLOUD_SCHEMA_VERSION || data.revision !== manifest.revision || data.sector !== name || !own(data, "payload") || !own(data, "payloadHash")) throw cloudError("invalid-sector", name);
    if (data.sourceDeviceId != null && (typeof data.sourceDeviceId !== "string" || !data.sourceDeviceId.trim())) throw cloudError("invalid-sector", name);
    const isRun = name === "run_ie1" || name === "run_ie2";
    const present = isRun ? manifest.sectors[name] === true : true;
    if (!present) {
      if (data.payload !== null || manifest.sectorHashes[name] !== null) throw cloudError("invalid-sector", name);
      if (data.payloadHash === null) return null;
      if (!SHA256_REGEX.test(data.payloadHash)) throw cloudError("invalid-sector", name);
      if (data.payloadHash !== await hash(null, cryptoApi)) throw cloudError("hash-mismatch", name);
      return null;
    }
    if (data.payload === null || !SHA256_REGEX.test(data.payloadHash || "")) throw cloudError("invalid-sector", name);
    const calculated = await hash(data.payload, cryptoApi);
    if (calculated !== data.payloadHash || calculated !== manifest.sectorHashes[name]) throw cloudError("hash-mismatch", name);
    return normalize(data.payload);
  }

  function validateHallIndex(payload, manifest, maxTeams = MAX_HALL_TEAMS) {
    if (!payload || typeof payload !== "object" || !Number.isInteger(payload.archiveSchemaVersion) || !Array.isArray(payload.teamIds) || !Array.isArray(payload.index) || !Number.isInteger(payload.count)) throw cloudError("invalid-hall-index", "hall_index");
    const ids = payload.teamIds;
    if (ids.length !== payload.count || payload.count !== manifest.sectors.hallOfFameCount || ids.length > maxTeams || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) throw cloudError("invalid-hall-index", "hall_index");
    if (payload.index.some((item) => item?.payload || item?.fullRoster || item?.finalStartingEleven)) throw cloudError("invalid-hall-index", "hall_index");
    return normalize(payload);
  }

  async function validateHallDocument(id, data, manifest, cryptoApi = global.crypto) {
    const sector = `hallOfFame/${id}`;
    if (!data || typeof data !== "object") throw cloudError("missing-hall-team", sector);
    if (data.hallTeamId !== id || data.schemaVersion !== CLOUD_SCHEMA_VERSION || data.revision !== manifest.revision || typeof data.archiveKey !== "string" || !data.archiveKey || !own(data, "payload") || data.payload == null) throw cloudError("invalid-hall-team", sector);
    const calculated = await hash(data.payload, cryptoApi);
    if (calculated !== data.payloadHash) throw cloudError("hash-mismatch", sector);
    return normalize(data.payload);
  }

  function reconstructSnapshot(payloads, hallPayloads) {
    const index = payloads.hall_index;
    return normalize({ profile: payloads.profile, runs: { ie1: payloads.run_ie1, ie2: payloads.run_ie2 }, album: payloads.album, development: payloads.development,
      hallOfFame: { archiveSchemaVersion: index.archiveSchemaVersion, updatedAt: index.updatedAt ?? null, teams: hallPayloads, index: index.index } });
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

  global.InazumaCloudSaveCore = Object.freeze({ DOCUMENT_LIMIT_BYTES, CLOUD_SCHEMA_VERSION, MAX_HALL_TEAMS, SECTOR_NAMES, normalize, clone, stableSerialize, byteSize, hash, readLocalSnapshot, hallIndex, inspectLocalProgress, validateManifest, validateSectorDocument, validateHallIndex, validateHallDocument, reconstructSnapshot, prepareSnapshot, preflight, buildManifest });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaCloudSaveCore;
})(globalThis);
