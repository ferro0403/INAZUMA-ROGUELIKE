(function (global) {
  "use strict";

  const DOCUMENT_LIMIT_BYTES = 850 * 1024;
  const CLOUD_SCHEMA_VERSION = 1;
  const MAX_HALL_TEAMS = 1000;
  // Cloud persistence is an account-permanent domain. RunStorage is a
  // separate, device-local domain and is deliberately absent from this list.
  const SECTOR_NAMES = ["profile", "album", "development", "hall_index"];
  const SHA256_REGEX = /^[a-f0-9]{64}$/;
  const PAYLOAD_ENCODING = "firestore-safe-v1";
  const ARRAY_WRAPPER = "__inazumaCloudArrayV1";
  const ESCAPED_OBJECT_WRAPPER = "__inazumaCloudEscapedObjectV1";

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

  // Firestore rejects arrays directly nested in arrays. Objects which use a
  // codec sentinel are escaped so no game object can be mistaken for metadata.
  function encodeFirestorePayload(value, inArray = false) {
    if (Array.isArray(value)) {
      const items = value.map((item) => encodeFirestorePayload(item, true));
      return inArray ? { [ARRAY_WRAPPER]: items } : items;
    }
    if (value && typeof value === "object") {
      const encoded = Object.fromEntries(Object.keys(value).map((key) => [key, encodeFirestorePayload(value[key], false)]));
      return own(value, ARRAY_WRAPPER) || own(value, ESCAPED_OBJECT_WRAPPER) ? { [ESCAPED_OBJECT_WRAPPER]: encoded } : encoded;
    }
    return value;
  }

  function decodeFirestorePayload(value) {
    if (Array.isArray(value)) return value.map(decodeFirestorePayload);
    if (!value || typeof value !== "object") return value;
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === ARRAY_WRAPPER && Array.isArray(value[ARRAY_WRAPPER])) return value[ARRAY_WRAPPER].map(decodeFirestorePayload);
    if (keys.length === 1 && keys[0] === ESCAPED_OBJECT_WRAPPER && value[ESCAPED_OBJECT_WRAPPER] && typeof value[ESCAPED_OBJECT_WRAPPER] === "object" && !Array.isArray(value[ESCAPED_OBJECT_WRAPPER])) {
      return Object.fromEntries(Object.entries(value[ESCAPED_OBJECT_WRAPPER]).map(([key, item]) => [key, decodeFirestorePayload(item)]));
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeFirestorePayload(item)]));
  }

  function logicalPayload(data, problemSector) {
    if (data.payloadEncoding == null) return data.payload;
    if (data.payloadEncoding !== PAYLOAD_ENCODING) throw cloudError("unsupported-payload-encoding", problemSector);
    return decodeFirestorePayload(data.payload);
  }

  function readLocalSnapshot(apis = global) {
    const archive = apis.HallOfFameStorage._loadArchive();
    const teams = Array.isArray(archive?.teams) ? archive.teams.map(clone) : [];
    const snapshot = normalize({
      profile: apis.RunState.loadProfile(),
      album: apis.AlbumProgress.read(),
      development: apis.DevelopmentV2.read(),
      hallOfFame: {
        archiveSchemaVersion: archive?.schemaVersion ?? apis.HallOfFameStorage.ARCHIVE_SCHEMA_VERSION ?? 1,
        updatedAt: archive?.updatedAt ?? null,
        teams,
        index: Array.isArray(archive?.index) ? archive.index : [],
      },
    });
    return snapshot;
  }

  function hallIndex(snapshot) {
    const hall = snapshot.hallOfFame;
    const preserved = Array.isArray(hall.cloudEntries) ? hall.cloudEntries : [];
    return normalize({ archiveSchemaVersion: hall.archiveSchemaVersion, updatedAt: hall.updatedAt, teamIds: hall.teams.map((team, index) => preserved[index]?.hallTeamId ?? team.hallTeamId), index: hall.index, count: hall.teams.length });
  }

  function own(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
  function cloudError(code, problemSector = null) { return Object.assign(new Error(code), { code, problemSector }); }
  function nonEmptyObject(value) { return !!value && typeof value === "object" && Object.keys(value).length > 0; }
  function positiveValues(value) { return Object.values(value || {}).some((item) => Number(item) > 0); }

  function inspectLocalProgress(snapshot) {
    const value = normalize(snapshot || {});
    const albumUnlocked = Object.values(value.album?.collections || {}).reduce((total, collection) => total + Object.keys(collection?.unlockedPlayerIds || {}).length, 0);
    const development = value.development || {};
    const developmentProgress = Number(development.coins) > 0 || Number(development.legacyCups) > 0 || positiveValues(development.cupsBySeason) || positiveValues(development.projects) || positiveValues(development.legacyProjectBuild)
      || nonEmptyObject(development.players) || (development.evolutionHistory || []).length > 0 || (development.redeemedRunIds || []).length > 0
      || (development.victoryRewardRunIds || []).length > 0 || (development.unlockedEmblems || []).length > 0;
    const summary = {
      profile: !!value.profile?.teamIdentity,
      albumUnlocked,
      developmentProgress,
      hallOfFameCount: Array.isArray(value.hallOfFame?.teams) ? value.hallOfFame.teams.length : 0,
    };
    const reasons = [];
    if (summary.profile) reasons.push("profile");
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
      if (!SHA256_REGEX.test(hashValue || "")) throw cloudError("invalid-manifest", name);
      if (manifest.sectorRevisions != null && (!Number.isInteger(manifest.sectorRevisions[name]) || manifest.sectorRevisions[name] < 1 || manifest.sectorRevisions[name] > manifest.revision)) throw cloudError("invalid-manifest", name);
    }
    if (manifest.hallTeamIds != null && (!Array.isArray(manifest.hallTeamIds) || new Set(manifest.hallTeamIds).size !== manifest.hallTeamIds.length)) throw cloudError("invalid-manifest", "hall_index");
    const count = manifest.sectors.hallOfFameCount;
    if (!Number.isInteger(count) || count < 0 || count > MAX_HALL_TEAMS) throw cloudError("invalid-manifest", "hall_index");
    const validated = normalize(manifest);
    // Firestore timestamps are opaque values; validation must not turn them
    // into plain objects before the cloud manager caches them.
    validated.createdAt = manifest.createdAt;
    validated.updatedAt = manifest.updatedAt;
    return validated;
  }

  async function validateSectorDocument(name, data, manifest, cryptoApi = global.crypto) {
    if (!data || typeof data !== "object") throw cloudError("missing-sector", name);
    const expectedRevision = manifest.sectorRevisions?.[name] ?? manifest.revision;
    if (data.schemaVersion !== CLOUD_SCHEMA_VERSION || data.revision !== expectedRevision || data.sector !== name || !own(data, "payload") || !own(data, "payloadHash")) throw cloudError("invalid-sector", name);
    if (data.payloadEncoding != null && data.payloadEncoding !== PAYLOAD_ENCODING) throw cloudError("unsupported-payload-encoding", name);
    if (data.sourceDeviceId != null && (typeof data.sourceDeviceId !== "string" || !data.sourceDeviceId.trim())) throw cloudError("invalid-sector", name);
    if (data.payload === null || !SHA256_REGEX.test(data.payloadHash || "")) throw cloudError("invalid-sector", name);
    const payload = logicalPayload(data, name);
    const calculated = await hash(payload, cryptoApi);
    if (calculated !== data.payloadHash || calculated !== manifest.sectorHashes[name]) throw cloudError("hash-mismatch", name);
    return normalize(payload);
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
    const expectedRevision = manifest.hallTeamRevisions?.[id] ?? manifest.revision;
    if (data.hallTeamId !== id || data.schemaVersion !== CLOUD_SCHEMA_VERSION || data.revision !== expectedRevision || typeof data.archiveKey !== "string" || !data.archiveKey || !own(data, "payload") || data.payload == null) throw cloudError("invalid-hall-team", sector);
    if (data.payloadEncoding != null && data.payloadEncoding !== PAYLOAD_ENCODING) throw cloudError("unsupported-payload-encoding", sector);
    const payload = logicalPayload(data, sector);
    const calculated = await hash(payload, cryptoApi);
    if (calculated !== data.payloadHash || (manifest.hallTeamHashes && calculated !== manifest.hallTeamHashes[id]) || (manifest.hallTeamIds && !manifest.hallTeamIds.includes(id))) throw cloudError("hash-mismatch", sector);
    return { hallTeamId: id, archiveKey: data.archiveKey, payload: normalize(payload), payloadHash: data.payloadHash };
  }

  function reconstructSnapshot(payloads, hallPayloads) {
    const index = payloads.hall_index;
    const entries = hallPayloads.map((entry) => own(entry, "payload") ? entry : { hallTeamId: entry?.hallTeamId, archiveKey: entry?.archiveKey, payload: entry, payloadHash: null });
    return normalize({ profile: payloads.profile, album: payloads.album, development: payloads.development,
      hallOfFame: { archiveSchemaVersion: index.archiveSchemaVersion, updatedAt: index.updatedAt ?? null, teams: entries.map((entry) => entry.payload), index: index.index, cloudEntries: entries } });
  }

  async function prepareSnapshot(snapshot, cryptoApi = global.crypto) {
    const input = normalize(snapshot);
    const clean = normalize({ profile: input.profile, album: input.album, development: input.development, hallOfFame: input.hallOfFame });
    const payloads = {
      profile: clean.profile ?? {},
      album: clean.album ?? {}, development: clean.development ?? {}, hall_index: hallIndex(clean),
    };
    const hashes = {};
    for (const name of SECTOR_NAMES) hashes[name] = await hash(payloads[name], cryptoApi);
    const hallEntries = [];
    const preserved = Array.isArray(clean.hallOfFame.cloudEntries) ? clean.hallOfFame.cloudEntries : [];
    for (let i = 0; i < clean.hallOfFame.teams.length; i += 1) {
      const team = clean.hallOfFame.teams[i], metadata = preserved[i], payloadHash = await hash(team, cryptoApi);
      const useMetadata = metadata && stableSerialize(metadata.payload) === stableSerialize(team) && metadata.payloadHash === payloadHash;
      const hallTeamId = useMetadata ? metadata.hallTeamId : team.hallTeamId, archiveKey = useMetadata ? metadata.archiveKey : team.archiveKey;
      if (typeof hallTeamId !== "string" || !hallTeamId.trim() || typeof archiveKey !== "string" || !archiveKey) throw cloudError("invalid-hall-team", `hallOfFame/${hallTeamId || "unknown"}`);
      hallEntries.push({ hallTeamId, archiveKey, payload: team, payloadHash: useMetadata ? metadata.payloadHash : payloadHash });
    }
    return { snapshot: clean, payloads, hashes, hallEntries };
  }

  // Transaction adapters use this exact identity predicate inside their
  // server-side transaction. A missing expected manifest means create-only.
  function manifestMatchesExpected(actual, expected) {
    if (!expected) return !actual;
    if (!actual || actual.accountUid !== expected.accountUid) return false;
    return actual.revision === expected.revision
      && (actual.cloudCommitId ?? null) === (expected.cloudCommitId ?? null)
      && stableSerialize(actual.sectorHashes) === stableSerialize(expected.sectorHashes)
      && stableSerialize(actual.hallTeamHashes || {}) === stableSerialize(expected.hallTeamHashes || {});
  }

  async function compareSnapshots(expected, actual, cryptoApi = global.crypto) {
    const expectedPrepared = await prepareSnapshot(expected, cryptoApi);
    const actualPrepared = await prepareSnapshot(actual, cryptoApi);
    const mismatches = SECTOR_NAMES.filter((name) => expectedPrepared.hashes[name] !== actualPrepared.hashes[name]);
    const expectedHalls = new Map(expectedPrepared.hallEntries.map((entry) => [entry.hallTeamId, entry.payloadHash]));
    const actualHalls = new Map(actualPrepared.hallEntries.map((entry) => [entry.hallTeamId, entry.payloadHash]));
    for (const id of new Set([...expectedHalls.keys(), ...actualHalls.keys()])) {
      if (expectedHalls.get(id) !== actualHalls.get(id)) mismatches.push(`hallOfFame/${id}`);
    }
    return { equivalent: mismatches.length === 0, mismatches };
  }

  function preflight(prepared, limit = DOCUMENT_LIMIT_BYTES) {
    for (const name of SECTOR_NAMES) {
      const document = { schemaVersion: 1, revision: 1, sector: name, payloadEncoding: PAYLOAD_ENCODING, payload: encodeFirestorePayload(prepared.payloads[name]), payloadHash: sectorLogicalHash(prepared, name), sourceDeviceId: "device" };
      if (byteSize(document) > limit) throw Object.assign(new Error(`Documento ${name} troppo grande`), { code: "document-too-large", problemSector: name });
    }
    for (const entry of prepared.hallEntries) {
      const document = { schemaVersion: 1, revision: 1, hallTeamId: entry.hallTeamId, archiveKey: entry.archiveKey, payloadEncoding: PAYLOAD_ENCODING, payload: encodeFirestorePayload(entry.payload), payloadHash: entry.payloadHash, sourceDeviceId: "device" };
      if (byteSize(document) > limit) throw Object.assign(new Error(`Documento Hall of Fame ${entry.hallTeamId} troppo grande`), { code: "document-too-large", problemSector: `hallOfFame/${entry.hallTeamId}` });
    }
    return true;
  }
  function sectorLogicalHash(prepared, name) { return prepared.hashes[name]; }

  function buildManifest(prepared, uid, deviceId, timestamp, commit = {}) {
    const revision = Number(commit.revision || 1), cloudCommitId = commit.cloudCommitId || null;
    const previous = commit.expectedManifest || null;
    return { schemaVersion: previous?.schemaVersion ?? 1, revision, baseRevision: Number(commit.baseRevision || 0), cloudCommitId, initialized: previous?.initialized ?? true, createdAt: previous ? previous.createdAt : timestamp, updatedAt: timestamp, source: previous ? previous.source : "local-first-association", deviceId, sourceDeviceId: deviceId, accountUid: previous?.accountUid ?? uid,
      // Preserve unknown/legacy manifest fields byte-logically. In particular,
      // old run sector metadata remains untouched and is never made active.
      ...(previous?.runProvenance ? { runProvenance: clone(previous.runProvenance) } : {}),
      sectors: { ...(previous?.sectors || {}), profile: true, album: true, development: true, hallOfFameCount: prepared.hallEntries.length },
      sectorHashes: { ...(previous?.sectorHashes || {}), profile: prepared.hashes.profile, album: prepared.hashes.album, development: prepared.hashes.development, hall_index: prepared.hashes.hall_index },
      sectorRevisions: { ...(previous?.sectorRevisions || {}), ...Object.fromEntries(SECTOR_NAMES.map((name) => [name, revision])) }, hallTeamIds: prepared.hallEntries.map((entry) => entry.hallTeamId),
      hallTeamHashes: Object.fromEntries(prepared.hallEntries.map((entry) => [entry.hallTeamId, entry.payloadHash])), hallTeamRevisions: Object.fromEntries(prepared.hallEntries.map((entry) => [entry.hallTeamId, revision])) };
  }

  global.InazumaCloudSaveCore = Object.freeze({ DOCUMENT_LIMIT_BYTES, CLOUD_SCHEMA_VERSION, MAX_HALL_TEAMS, SECTOR_NAMES, PAYLOAD_ENCODING, encodeFirestorePayload, decodeFirestorePayload, normalize, clone, stableSerialize, byteSize, hash, readLocalSnapshot, hallIndex, inspectLocalProgress, validateManifest, validateSectorDocument, validateHallIndex, validateHallDocument, reconstructSnapshot, prepareSnapshot, compareSnapshots, preflight, manifestMatchesExpected, buildManifest });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaCloudSaveCore;
})(globalThis);
