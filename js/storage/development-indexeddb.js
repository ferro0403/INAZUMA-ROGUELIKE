(function (global) {
  "use strict";

  const STORE = "development";
  const STATE_KEY = "state";
  const MIGRATION_KEY = "migration:development:localstorage-to-indexeddb:v1";
  const MIGRATION_SCHEMA_VERSION = 1;
  const RECORD_SCHEMA_VERSION = 1;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const stable = (value) => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return JSON.stringify(Number.isFinite(value) ? value : null);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return "null";
  };

  const account = global.DevelopmentAccountV3;
  const V2 = global.DevelopmentV2;
  const V3 = global.DevelopmentV3;
  const Migration = global.DevelopmentV3Migration;
  if (!account || !V2 || !V3 || !Migration) return;

  const accountOriginal = Object.fromEntries([
    "ensureMigrated", "read", "readCompatibility", "commit", "mutate", "reset", "evolve", "previewRegression", "regress",
    "processRunEnd", "purchaseProject", "purchaseEmblem", "addCompletedProject", "resetSessionCache", "envelopeFor",
  ].map((name) => [name, typeof account[name] === "function" ? account[name].bind(account) : null]));
  const v2Original = Object.fromEntries([
    "read", "write", "totalCups", "playerUpgrade", "permanentOptions", "resolvePlayer", "processRunEnd", "purchaseProject", "purchaseEmblem", "addCompletedProject", "evolve",
  ].map((name) => [name, typeof V2[name] === "function" ? V2[name].bind(V2) : null]));

  let authority = "legacy";
  let cachedRecord = null;
  let readyPromise = null;
  let facadeInstalled = false;
  let effectsBridgeInstalled = false;
  const pendingDrains = new Map();

  function db() {
    if (!global.PermanentIndexedDb) throw Object.assign(new Error("PermanentIndexedDb non disponibile"), { code: "indexeddb-unavailable", stage: "development-indexeddb-open" });
    return global.PermanentIndexedDb;
  }

  function validateState(value) {
    const normalized = V3.normalize(value);
    const validation = V3.validate(normalized);
    if (!validation.valid) throw Object.assign(new Error("Development V3 IndexedDB non valido"), { code: "development-indexeddb-invalid-state", stage: "development-indexeddb-validate", details: validation.errors });
    return normalized;
  }

  function compatibilityEconomyMatches(compatibility, state) {
    const normalized = V2.normalize(compatibility || {});
    return Number(normalized.coins || 0) === Number(state.coins || 0)
      && stable(normalized.cupsBySeason || {}) === stable(state.cupsBySeason || {})
      && stable(normalized.projects || {}) === stable(state.projects || {})
      && stable([...(normalized.unlockedEmblems || [])].map(String).sort()) === stable([...(state.unlockedEmblems || [])].map(String).sort())
      && stable([...(normalized.redeemedRunIds || [])].map(String).sort()) === stable([...(state.redeemedRunIds || [])].map(String).sort())
      && stable([...(normalized.victoryRewardRunIds || [])].map(String).sort()) === stable([...(state.victoryRewardRunIds || [])].map(String).sort());
  }

  function canonicalCompatibility(value, state) {
    const compatibility = V2.normalize(clone(value || {}));
    compatibility[account.SHADOW_FIELD] = clone(state);
    compatibility[account.AUTHORITY_FIELD] = account.AUTHORITY_VERSION;
    compatibility.coins = Number(state.coins || 0);
    compatibility.cupsBySeason = clone(state.cupsBySeason || {});
    compatibility.projects = clone(state.projects || {});
    compatibility.unlockedEmblems = clone(state.unlockedEmblems || []);
    compatibility.redeemedRunIds = clone(state.redeemedRunIds || []);
    compatibility.victoryRewardRunIds = clone(state.victoryRewardRunIds || []);
    return compatibility;
  }

  function recordFromCompatibility(value, options = {}) {
    const compatibility = V2.normalize(clone(value || {}));
    const marker = compatibility[account.AUTHORITY_FIELD];
    if (marker != null && marker !== account.AUTHORITY_VERSION) {
      throw Object.assign(new Error("Development V3 authority incompatibile"), { code: "development-v3-authority-version-conflict", stage: "development-indexeddb-materialize" });
    }
    let state;
    if (compatibility[account.SHADOW_FIELD] && typeof compatibility[account.SHADOW_FIELD] === "object") {
      state = validateState(compatibility[account.SHADOW_FIELD]);
    } else {
      const planned = Migration.convertState({
        ...options,
        v2State: V2.normalize(compatibility),
        DevelopmentV2: V2,
        DevelopmentV3: V3,
        resolveBasePlayer: options.resolveBasePlayer || global.DevelopmentRuntime?.resolveBasePlayer,
        progression: options.progression || global.InazumaProgression,
        database: options.database,
      });
      if (!planned?.ok) {
        throw Object.assign(new Error(planned?.blockers?.[0]?.code || "development-v3-migration-blocked"), {
          code: planned?.blockers?.[0]?.code || "development-v3-migration-blocked",
          stage: "development-indexeddb-materialize",
          blockers: planned?.blockers || [],
        });
      }
      state = validateState(planned.state);
    }
    const canonical = canonicalCompatibility(compatibility, state);
    if (!compatibilityEconomyMatches(canonical, state)) {
      throw Object.assign(new Error("Development compatibility mirror incoerente"), { code: "development-indexeddb-compatibility-mismatch", stage: "development-indexeddb-materialize" });
    }
    return { schemaVersion: RECORD_SCHEMA_VERSION, state: clone(state), compatibility: canonical };
  }

  function validateRecord(value) {
    if (!value || typeof value !== "object" || Number(value.schemaVersion) !== RECORD_SCHEMA_VERSION) {
      throw Object.assign(new Error("Record Development IndexedDB non valido"), { code: "development-indexeddb-invalid-record", stage: "development-indexeddb-validate" });
    }
    const state = validateState(value.state);
    const compatibility = canonicalCompatibility(value.compatibility || {}, state);
    if (stable(compatibility[account.SHADOW_FIELD]) !== stable(state) || !compatibilityEconomyMatches(compatibility, state)) {
      throw Object.assign(new Error("Record Development IndexedDB incoerente"), { code: "development-indexeddb-compatibility-mismatch", stage: "development-indexeddb-validate" });
    }
    return { schemaVersion: RECORD_SCHEMA_VERSION, state: clone(state), compatibility };
  }

  function memoryStorage(initialValue) {
    let raw = initialValue == null ? null : JSON.stringify(initialValue);
    return {
      getItem(key) { return String(key) === String(V2.STORAGE_KEY) ? raw : null; },
      setItem(key, value) { if (String(key) === String(V2.STORAGE_KEY)) raw = String(value); },
      removeItem(key) { if (String(key) === String(V2.STORAGE_KEY)) raw = null; },
      raw: () => raw,
    };
  }

  function memoryV2(storage) {
    return {
      ...V2,
      read() {
        const raw = storage.getItem(V2.STORAGE_KEY);
        try { return V2.normalize(raw ? JSON.parse(raw) : V2.empty()); }
        catch (_) { return V2.empty(); }
      },
      write(value) {
        const normalized = V2.normalize(value);
        storage.setItem(V2.STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      },
    };
  }

  function simulate(method, currentRecord, args = [], options = {}) {
    const record = validateRecord(currentRecord);
    const storage = memoryStorage(record.compatibility);
    const DevelopmentV2 = memoryV2(storage);
    accountOriginal.resetSessionCache?.();
    try {
      const operation = accountOriginal[method];
      if (typeof operation !== "function") throw Object.assign(new Error(`Operazione Development non disponibile: ${method}`), { code: "development-indexeddb-operation-unavailable" });
      const simulatedOptions = { ...options, DevelopmentV2, storage, writeOptions: { ...(options.writeOptions || {}), suppressCloudEvent: true } };
      const result = operation(...args, simulatedOptions);
      const raw = storage.raw();
      const nextCompatibility = raw ? JSON.parse(raw) : V2.empty();
      return { result, record: recordFromCompatibility(nextCompatibility, options) };
    } finally {
      accountOriginal.resetSessionCache?.();
    }
  }

  function emitCommitted(operation, options = {}) {
    if (options.suppressCloudEvent) return;
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", { detail: { domain: "account-permanent", sector: "development", operation, source: options.source || "gameplay" } }));
      }
    } catch (error) {
      console.warn("Development cloud dirty notification failed", error?.code || error);
    }
  }

  function guardReadableMutation(options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
  }

  function guardCommit(options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
    global.PersistenceRecoveryGuard?.reserve?.(options);
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
  }

  function isUnavailable(error) {
    return ["indexeddb-unavailable", "indexeddb-open-failed", "indexeddb-open-blocked", "storage-access-error"].includes(error?.code);
  }

  function legacyEnvelope() {
    let raw;
    try { raw = global.localStorage?.getItem(V2.STORAGE_KEY); }
    catch (error) { throw Object.assign(new Error("storage-access-error"), { code: "storage-access-error", stage: "development-legacy-read", cause: error }); }
    try { return raw ? JSON.parse(raw) : V2.empty(); }
    catch (error) { throw Object.assign(new Error("invalid-json"), { code: "invalid-json", stage: "development-legacy-read", cause: error }); }
  }

  function asyncRequired(stage) {
    return Object.assign(new Error("Development IndexedDB richiede il percorso asincrono"), { code: "development-indexeddb-async-required", stage, problemSector: "development", recoverable: true });
  }

  function installFacades() {
    if (facadeInstalled) return;
    account.ensureMigrated = function ensureMigratedFacade(options = {}) {
      if (authority !== "indexeddb") return accountOriginal.ensureMigrated(options);
      return { ok: true, migrated: false, deferred: false, reason: null, state: clone(cachedRecord.state), indexedDbAuthority: true };
    };
    account.read = function readFacade(options = {}) {
      if (authority !== "indexeddb") return accountOriginal.read(options);
      return clone(cachedRecord.state);
    };
    account.readCompatibility = function readCompatibilityFacade(options = {}) {
      if (authority !== "indexeddb") return accountOriginal.readCompatibility(options);
      return clone(cachedRecord.compatibility);
    };
    account.previewRegression = function previewRegressionFacade(input, options = {}) {
      if (authority !== "indexeddb") return accountOriginal.previewRegression(input, options);
      return simulate("previewRegression", cachedRecord, [input], options).result;
    };
    account.commit = function commitFacade(candidate, options = {}) {
      if (authority !== "indexeddb") return accountOriginal.commit(candidate, options);
      throw asyncRequired("development-commit");
    };
    account.mutate = function mutateFacade(mutator, options = {}) {
      if (authority !== "indexeddb") return accountOriginal.mutate(mutator, options);
      throw asyncRequired("development-mutate");
    };
    account.reset = function resetFacade(options = {}) {
      if (authority !== "indexeddb") return accountOriginal.reset(options);
      throw asyncRequired("development-reset");
    };
    for (const method of ["evolve", "regress", "purchaseProject", "purchaseEmblem"]) {
      account[method] = function syncMutationFacade(...args) {
        if (authority !== "indexeddb") return accountOriginal[method](...args);
        return { ok: false, reason: "development-indexeddb-async-required", state: clone(cachedRecord.state), error: asyncRequired(`development-${method}`) };
      };
    }
    account.processRunEnd = function processRunEndFacade(...args) {
      if (authority !== "indexeddb") return accountOriginal.processRunEnd(...args);
      return { state: clone(cachedRecord.state), pull: null, awarded: false, reason: "development-indexeddb-async-required", error: asyncRequired("development-process-run-end") };
    };
    account.addCompletedProject = function addCompletedProjectFacade(...args) {
      if (authority !== "indexeddb") return accountOriginal.addCompletedProject(...args);
      return false;
    };

    account.commitAsync = commitAsync;
    account.mutateAsync = mutateAsync;
    account.resetAsync = resetAsync;
    account.evolveAsync = evolveAsync;
    account.regressAsync = regressAsync;
    account.processRunEndAsync = processRunEndAsync;
    account.purchaseProjectAsync = purchaseProjectAsync;
    account.purchaseEmblemAsync = purchaseEmblemAsync;
    account.addCompletedProjectAsync = addCompletedProjectAsync;

    V2.read = function v2ReadFacade() {
      if (authority !== "indexeddb") return v2Original.read();
      return clone(cachedRecord.compatibility);
    };
    V2.write = function v2WriteFacade(value, options = {}) {
      if (authority !== "indexeddb") return v2Original.write(value, options);
      if (options.restoreOwnershipToken) return writeCompatibilityAsync(value, options);
      throw asyncRequired("development-v2-write");
    };
    if (v2Original.totalCups) V2.totalCups = function totalCupsFacade(state) {
      return v2Original.totalCups(state === undefined && authority === "indexeddb" ? cachedRecord.compatibility : state);
    };
    if (v2Original.playerUpgrade) V2.playerUpgrade = function playerUpgradeFacade(id) {
      if (authority !== "indexeddb") return v2Original.playerUpgrade(id);
      return clone(cachedRecord.compatibility.players?.[String(id)] || null);
    };
    if (v2Original.permanentOptions) V2.permanentOptions = function permanentOptionsFacade(player) {
      if (authority !== "indexeddb") return v2Original.permanentOptions(player);
      return V2.optionsFromUpgrade(player, V2.playerUpgrade(player?.playerId));
    };
    if (v2Original.resolvePlayer) V2.resolvePlayer = function resolvePlayerFacade(player, level, database) {
      if (authority !== "indexeddb") return v2Original.resolvePlayer(player, level, database);
      return global.InazumaProgression.getPlayerAtLevel(player, level, database, V2.permanentOptions(player));
    };
    for (const method of ["processRunEnd", "purchaseProject", "purchaseEmblem", "addCompletedProject", "evolve"]) {
      if (!v2Original[method]) continue;
      V2[method] = function legacyMutationBlocked(...args) {
        if (authority !== "indexeddb") return v2Original[method](...args);
        throw asyncRequired(`development-v2-${method}`);
      };
    }
    facadeInstalled = true;
  }

  async function ensureReady(options = {}) {
    if (authority === "indexeddb" && cachedRecord) return { authority, migrated: false, state: clone(cachedRecord.state), compatibility: clone(cachedRecord.compatibility) };
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      let marker;
      try { marker = await db().read("meta", MIGRATION_KEY); }
      catch (error) {
        if (isUnavailable(error)) return { authority: "legacy", migrated: false, deferred: true, error };
        throw error;
      }
      if (marker?.complete === true) {
        const stored = await db().read(STORE, STATE_KEY);
        if (!stored) throw Object.assign(new Error("Marker Development IndexedDB completo ma stato assente"), { code: "development-indexeddb-authority-corrupt", stage: "development-indexeddb-authority-read", problemSector: "development" });
        cachedRecord = validateRecord(stored);
        authority = "indexeddb";
        installFacades();
        installPermanentEffectsBridge();
        return { authority, migrated: false, marker: clone(marker), state: clone(cachedRecord.state), compatibility: clone(cachedRecord.compatibility) };
      }
      if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { authority: "legacy", migrated: false, deferred: true, reason: "restore-recovery-required" };
      guardReadableMutation(options);
      const migration = accountOriginal.ensureMigrated(options);
      if (!migration?.ok) {
        const baseNotReady = migration?.reason === "base-player-missing" || (migration?.blockers || []).some((item) => item?.code === "base-player-missing");
        if (baseNotReady) return { authority: "legacy", migrated: false, deferred: true, reason: "development-base-data-not-ready", blockers: migration.blockers || [] };
        if (migration?.deferred) return { authority: "legacy", migrated: false, deferred: true, reason: migration.reason, blockers: migration.blockers || [] };
        throw Object.assign(new Error(migration?.reason || "development-v3-migration-blocked"), { code: migration?.reason || "development-v3-migration-blocked", stage: "development-indexeddb-legacy-canonicalization", blockers: migration?.blockers || [] });
      }
      const sourceCompatibility = legacyEnvelope();
      const sourceRecord = recordFromCompatibility(sourceCompatibility, options);
      const pending = { schemaVersion: MIGRATION_SCHEMA_VERSION, complete: false, startedAt: marker?.startedAt || nowIso(), source: "localStorage", legacyKey: V2.STORAGE_KEY };
      await db().write("meta", pending, MIGRATION_KEY);
      await db().write(STORE, sourceRecord, STATE_KEY);
      const readback = validateRecord(await db().read(STORE, STATE_KEY));
      if (stable(readback) !== stable(sourceRecord)) throw Object.assign(new Error("Verifica migrazione Development IndexedDB fallita"), { code: "development-indexeddb-migration-verification-failed", stage: "development-indexeddb-migration-readback", problemSector: "development" });
      const complete = { ...pending, complete: true, completedAt: nowIso(), recordSchemaVersion: RECORD_SCHEMA_VERSION, developmentSchemaVersion: V3.SCHEMA_VERSION };
      await db().write("meta", complete, MIGRATION_KEY);
      const markerReadback = await db().read("meta", MIGRATION_KEY);
      if (markerReadback?.complete !== true) throw Object.assign(new Error("Marker migrazione Development IndexedDB non verificato"), { code: "development-indexeddb-migration-marker-failed", stage: "development-indexeddb-migration-marker", problemSector: "development" });
      cachedRecord = readback;
      authority = "indexeddb";
      installFacades();
      installPermanentEffectsBridge();
      return { authority, migrated: true, marker: clone(markerReadback), state: clone(cachedRecord.state), compatibility: clone(cachedRecord.compatibility) };
    })().finally(() => { readyPromise = null; });
    return readyPromise;
  }

  async function refresh() {
    if (authority !== "indexeddb") return { authority: "legacy", state: accountOriginal.read() };
    const stored = await db().read(STORE, STATE_KEY);
    if (!stored) throw Object.assign(new Error("Development IndexedDB authority priva dello stato"), { code: "development-indexeddb-authority-corrupt", stage: "development-indexeddb-refresh", problemSector: "development" });
    cachedRecord = validateRecord(stored);
    return { authority, state: clone(cachedRecord.state), compatibility: clone(cachedRecord.compatibility) };
  }

  function outcomeWithCanonicalState(result) {
    if (result == null || typeof result !== "object") return result;
    return { ...result, state: clone(cachedRecord.state) };
  }

  function operationFailure(method, error) {
    if (method === "processRunEnd") return { state: clone(cachedRecord?.state || V3.empty()), pull: null, awarded: false, reason: "persistence", error };
    return { ok: false, reason: "persistence", error, state: clone(cachedRecord?.state || V3.empty()) };
  }

  async function runOperation(method, args = [], options = {}, precondition = null) {
    if (authority !== "indexeddb") return accountOriginal[method](...args, options);
    guardReadableMutation(options);
    let outcome = null;
    let changed = false;
    try {
      const committed = await db().update(STORE, (currentValue) => {
        const current = validateRecord(currentValue || cachedRecord);
        if (typeof precondition === "function") {
          const rejected = precondition(current);
          if (rejected) {
            outcome = { ...rejected, state: clone(current.state) };
            return current;
          }
        }
        const simulated = simulate(method, current, args, options);
        outcome = simulated.result;
        changed = stable(simulated.record) !== stable(current);
        if (!changed) return current;
        guardCommit(options);
        return simulated.record;
      }, STATE_KEY);
      cachedRecord = validateRecord(committed);
      if (changed) emitCommitted(method, options);
      return outcomeWithCanonicalState(outcome);
    } catch (error) {
      return operationFailure(method, error);
    }
  }

  async function commitAsync(candidate, options = {}) {
    if (authority !== "indexeddb") return accountOriginal.commit(candidate, options);
    const state = validateState(candidate);
    let compatibility;
    try { compatibility = accountOriginal.envelopeFor(state, options); }
    catch (error) { throw Object.assign(error, { code: error?.code || "development-indexeddb-compatibility-build-failed", stage: "development-indexeddb-commit" }); }
    const next = recordFromCompatibility(compatibility, options);
    guardCommit(options);
    const committed = await db().write(STORE, next, STATE_KEY);
    cachedRecord = validateRecord(committed);
    emitCommitted("commit", options);
    return { state: clone(cachedRecord.state), envelope: clone(cachedRecord.compatibility) };
  }

  async function mutateAsync(mutator, options = {}) {
    if (authority !== "indexeddb") return accountOriginal.mutate(mutator, options);
    if (typeof mutator !== "function") throw new TypeError("Development mutator richiesto");
    guardReadableMutation(options);
    let changed = false;
    const committed = await db().update(STORE, (currentValue) => {
      const current = validateRecord(currentValue || cachedRecord);
      const candidate = clone(current.state);
      mutator(candidate);
      const state = validateState(candidate);
      if (stable(state) === stable(current.state)) return current;
      const compatibility = accountOriginal.envelopeFor(state, options);
      const next = recordFromCompatibility(compatibility, options);
      guardCommit(options);
      changed = true;
      return next;
    }, STATE_KEY);
    cachedRecord = validateRecord(committed);
    if (changed) emitCommitted("mutate", options);
    return { state: clone(cachedRecord.state), envelope: clone(cachedRecord.compatibility) };
  }

  async function resetAsync(options = {}) {
    if (authority !== "indexeddb") return accountOriginal.reset(options);
    return (await commitAsync(V3.empty(), { ...options, source: options.source || "development-reset" })).state;
  }

  function activeIdentity(state, base) {
    const chain = state?.players?.[String(base?.playerId)] || null;
    const active = chain?.steps?.at?.(-1) || chain?.legacyNormale || null;
    return active ? String(active.stepId || active.migrationId || `${active.rarity || active.profile?.category}:${active.toPotential}`) : `base:${String(base?.category || "")}:${Number(base?.finalOverall || 0)}`;
  }

  async function evolveAsync(input, options = {}) {
    if (authority !== "indexeddb") return accountOriginal.evolve(input, options);
    const id = String(input?.playerId || "");
    const base = (options.resolveBasePlayer || global.DevelopmentRuntime?.resolveBasePlayer)?.(id);
    if (!base) return { ok: false, reason: "base-player-missing", state: clone(cachedRecord.state) };
    const expectedActiveId = activeIdentity(cachedRecord.state, base);
    const expectedState = account.activeState(cachedRecord.state, base);
    const expectedTarget = V2.nextRarity(expectedState.rarity);
    const timestamp = String(options.timestamp || nowIso());
    const operationId = String(options.operationId || `evo:${encodeURIComponent(id)}:${encodeURIComponent(expectedTarget || "next")}:${encodeURIComponent(timestamp)}`);
    return runOperation("evolve", [input], { ...options, timestamp, operationId, source: options.source || "development-evolution" }, (current) => {
      if (activeIdentity(current.state, base) !== expectedActiveId) return { ok: false, reason: "stale-evolution", expectedActiveId };
      return null;
    });
  }

  function regressAsync(input, options = {}) {
    return runOperation("regress", [input], { ...options, source: options.source || "development-regression" });
  }

  function processRunEndAsync(payload, options = {}) {
    return runOperation("processRunEnd", [payload], { ...options, source: options.source || "development-run-end" });
  }

  function purchaseProjectAsync(rarity, options = {}) {
    return runOperation("purchaseProject", [rarity], { ...options, source: options.source || "shop-project" });
  }

  function purchaseEmblemAsync(product, options = {}) {
    return runOperation("purchaseEmblem", [product], { ...options, source: options.source || "shop-emblem" });
  }

  async function addCompletedProjectAsync(rarity, amount = 1, options = {}) {
    if (authority !== "indexeddb") return accountOriginal.addCompletedProject(rarity, amount, options);
    if (!V3.PROJECT_RARITIES.includes(rarity)) return false;
    try {
      await mutateAsync((state) => { state.projects[rarity] += Math.max(0, Math.floor(Number(amount) || 0)); }, { ...options, source: options.source || "development-project" });
      return true;
    } catch (_) { return false; }
  }

  async function writeCompatibilityAsync(value, options = {}) {
    if (authority !== "indexeddb") return v2Original.write(value, options);
    guardReadableMutation(options);
    const next = recordFromCompatibility(value, options);
    guardCommit(options);
    const committed = await db().write(STORE, next, STATE_KEY);
    cachedRecord = validateRecord(committed);
    emitCommitted("restore", options);
    return clone(cachedRecord.compatibility);
  }

  function pendingDevelopment(run) {
    const type = global.PermanentEffects?.TYPES?.DEVELOPMENT || "development-run-end";
    return (run?.permanentEffectOutbox || []).filter((entry) => entry?.type === type && entry.status === "pending");
  }

  function isQuotaLikeError(error, seen = new Set()) {
    if (!error || typeof error !== "object" || seen.has(error)) return false;
    seen.add(error);
    if (error.name === "QuotaExceededError" || Number(error.code) === 22 || Number(error.code) === 1014 || /quota/i.test(String(error.code || "")) || /quota/i.test(String(error.message || ""))) return true;
    return isQuotaLikeError(error.cause, seen) || isQuotaLikeError(error.error, seen);
  }

  function installPermanentEffectsBridge() {
    if (effectsBridgeInstalled || authority !== "indexeddb" || !global.PermanentEffects?.drain) return;
    const base = global.PermanentEffects;
    const developmentType = base.TYPES?.DEVELOPMENT || "development-run-end";
    const baseRunSave = global.RunState?.save?.bind(global.RunState);
    const baseRunRemove = global.RunState?.remove?.bind(global.RunState);
    if (!baseRunSave) return;

    async function applyDevelopmentReceipt(run, effect) {
      const result = await processRunEndAsync(effect.payload || {}, { source: "development-permanent-effect" });
      const redeemed = cachedRecord.state.redeemedRunIds.includes(effect.payload?.runId);
      if (!redeemed) throw result?.error || Object.assign(new Error("Development effect remains pending"), { code: result?.reason || "development-finalization-failed", stage: "development-write", problemSector: "development" });
      const before = { status: effect.status, appliedAt: effect.appliedAt, finalizationStatus: run.finalization?.status };
      effect.status = "applied";
      effect.appliedAt = nowIso();
      if (run.finalization?.status === "hall-written") run.finalization.status = "development-written";
      try { baseRunSave(run, { effectMarker: effect.id, source: "development-indexeddb-effect-marker" }); }
      catch (error) {
        effect.status = before.status;
        effect.appliedAt = before.appliedAt;
        if (run.finalization) run.finalization.status = before.finalizationStatus;
        throw error;
      }
      return { id: effect.id, result };
    }

    async function drainDevelopment(run, options = {}) {
      if (options.readOnly) return { run, applied: [], pending: pendingDevelopment(run), readOnly: true };
      const applied = [];
      for (const effect of pendingDevelopment(run)) {
        try { const outcome = await applyDevelopmentReceipt(run, effect); applied.push(outcome.id); }
        catch (error) { return { run, applied, pending: pendingDevelopment(run), error }; }
      }
      return { run, applied, pending: pendingDevelopment(run) };
    }

    function requestDrain(seasonId) {
      const sid = String(seasonId || "");
      if (!sid) return Promise.resolve({ applied: [], pending: [] });
      const previous = pendingDrains.get(sid) || Promise.resolve();
      const next = previous.catch(() => {}).then(async () => {
        const current = global.RunState?.load?.(sid, { readOnly: true });
        return current ? drainDevelopment(current) : { run: null, applied: [], pending: [] };
      });
      pendingDrains.set(sid, next);
      next.finally(() => { if (pendingDrains.get(sid) === next) pendingDrains.delete(sid); }).catch(() => {});
      return next;
    }

    async function drainAsync(run, options = {}) {
      const requested = options.types ? new Set(options.types) : null;
      const wantsDevelopment = !requested || requested.has(developmentType);
      if (!wantsDevelopment) return base.drain(run, options);
      const nonDevelopmentTypes = requested
        ? [...requested].filter((type) => type !== developmentType)
        : [base.TYPES?.ALBUM, base.TYPES?.HALL].filter(Boolean);
      let result = { run, applied: [], pending: pendingDevelopment(run) };
      if (nonDevelopmentTypes.length) {
        result = await Promise.resolve(base.drain(run, { ...options, types: nonDevelopmentTypes }));
        if (result?.error) return result;
      }
      const development = await drainDevelopment(run, options);
      return {
        run,
        applied: [...(result?.applied || []), ...(development.applied || [])],
        pending: (run?.permanentEffectOutbox || []).filter((entry) => entry.status === "pending"),
        ...(development.error ? { error: development.error } : {}),
      };
    }

    function drain(run, options = {}) {
      const requested = options.types ? new Set(options.types) : null;
      if (requested && !requested.has(developmentType)) return base.drain(run, options);
      return drainAsync(run, options);
    }

    async function resumeFinalizationAsync(run, options = {}) {
      if (options.readOnly) return { run, status: "read-only", completed: false };
      if (run?.finalization?.status === "complete") return { run, status: "complete", completed: true };
      if (run?.finalization?.status === "pending") {
        const hallAttempt = await Promise.resolve(base.resumeFinalization(run, options));
        if (run?.finalization?.status === "pending" || run?.finalization?.status === "complete") return hallAttempt;
      }
      if (run?.finalization?.status === "hall-written") {
        const effectId = base.developmentId(run, "victory");
        let effect = (run.permanentEffectOutbox || []).find((entry) => entry.id === effectId);
        if (!effect) {
          const lengthBefore = (run.permanentEffectOutbox || []).length;
          try {
            effect = base.enqueueDevelopment(run, { endReason: "victory", defeatedBosses: Number(run.completedBossIds?.length || run.bossIndex || 0) });
            baseRunSave(run, { effectEnqueue: effect.id, source: "development-indexeddb-finalization-enqueue" });
          } catch (error) {
            if (Array.isArray(run.permanentEffectOutbox)) run.permanentEffectOutbox.splice(lengthBefore);
            return { run, status: "hall-written", completed: false, error };
          }
        }
        let development = await drainDevelopment(run, options);
        if (development.error && isQuotaLikeError(development.error)) {
          const headroom = global.FinalizationStorageHeadroom?.reclaimExactBackup?.(run, { ...options, source: "finalization-headroom-after-quota" });
          if (headroom?.ok !== false && headroom?.reclaimed === true) development = await drainDevelopment(run, options);
        }
        if (development.error || run.finalization?.status !== "development-written") {
          return { run, status: "hall-written", completed: false, error: development.error || new Error("Development effect remains pending") };
        }
      }
      return Promise.resolve(base.resumeFinalization(run, options));
    }

    function resumeFinalization(run, options = {}) {
      if (authority !== "indexeddb") return base.resumeFinalization(run, options);
      return resumeFinalizationAsync(run, options);
    }

    if (global.RunState && baseRunRemove) {
      global.RunState.save = function guardedDevelopmentRunSave(run, options = {}) {
        if (authority === "indexeddb" && options.replaceRun) {
          const current = global.RunState.load(run?.seasonId, { readOnly: true });
          if (current && current.runId !== run?.runId && pendingDevelopment(current).length) {
            void requestDrain(current.seasonId).catch(() => {});
            throw Object.assign(new Error("La run contiene effetti Development permanenti ancora da confermare"), { code: "development-permanent-effect-pending", stage: "development-permanent-effect-run-replacement-guard", seasonId: String(current.seasonId || ""), recoverable: true });
          }
        }
        return baseRunSave(run, options);
      };
      global.RunState.remove = function guardedDevelopmentRunRemove(seasonId = null, options = {}) {
        if (authority === "indexeddb") {
          const current = global.RunState.load(seasonId, { readOnly: true });
          if (pendingDevelopment(current).length) {
            void requestDrain(current.seasonId).catch(() => {});
            throw Object.assign(new Error("La run contiene effetti Development permanenti ancora da confermare"), { code: "development-permanent-effect-pending", stage: "development-permanent-effect-run-delete-guard", seasonId: String(current.seasonId || ""), recoverable: true });
          }
        }
        return baseRunRemove(seasonId, options);
      };
    }

    global.PermanentEffects = Object.freeze({ ...base, drain, resume: drain, resumeFinalization, resumeFinalizationAsync });
    effectsBridgeInstalled = true;
  }

  if (typeof global.addEventListener === "function") {
    global.addEventListener("storage", (event) => {
      if (authority !== "indexeddb" || event?.key !== global.PersistenceRecoveryGuard?.EPOCH_KEY) return;
      void refresh().catch((error) => console.warn("Development IndexedDB cross-tab refresh failed", error?.code || error));
    });
  }

  const api = Object.freeze({
    STORE, STATE_KEY, MIGRATION_KEY, MIGRATION_SCHEMA_VERSION, RECORD_SCHEMA_VERSION,
    ensureReady, refresh, read: () => authority === "indexeddb" ? clone(cachedRecord.state) : accountOriginal.read(),
    readCompatibility: () => authority === "indexeddb" ? clone(cachedRecord.compatibility) : accountOriginal.readCompatibility(),
    writeCompatibilityAsync, commitAsync, mutateAsync, resetAsync, evolveAsync, regressAsync, processRunEndAsync,
    purchaseProjectAsync, purchaseEmblemAsync, addCompletedProjectAsync,
    isAuthority: () => authority === "indexeddb",
    _recordFromCompatibility: recordFromCompatibility,
    _validateRecord: validateRecord,
    _simulate: simulate,
    _activeIdentity: activeIdentity,
  });
  global.DevelopmentIndexedDbStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
