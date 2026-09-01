(function (global) {
  "use strict";

  // Loaded for pure in-memory V2 -> V3 conversion at the run boundary.
  // Persisted migrateStoredState() remains explicit-only: account migration is
  // never activated automatically here.
  const SHADOW_FIELD = "developmentV3";
  const LEGACY_CUP_SEASON = "ie1";
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const integer = (value) => Number.isInteger(value) && value >= 0;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const stable = (value) => JSON.stringify(value);

  function dependencies(options) {
    const DevelopmentV2 = options?.DevelopmentV2 || global.DevelopmentV2;
    const DevelopmentV3 = options?.DevelopmentV3 || global.DevelopmentV3;
    return { DevelopmentV2, DevelopmentV3 };
  }

  function migrationId(entry, playerId, ordinal) {
    if (typeof entry.id === "string" && entry.id.trim()) return entry.id;
    return ["v2", playerId, ordinal, entry.fromRarity, entry.toRarity, entry.fromPotential, entry.toPotential, entry.timestamp || "untimed"]
      .map((part) => encodeURIComponent(String(part))).join(":");
  }

  function receiptFor(entry) {
    const cupsConsumed = Number(entry.cupsConsumed);
    if (!integer(cupsConsumed)) return { error: "invalid-cups-consumed" };
    let sources = entry.cupsConsumedBySource;
    const usable = record(sources) && Object.keys(sources).length > 0 && Object.values(sources).every((amount) => integer(Number(amount)));
    // Legacy unattributed cup source -> canonical IE1 migration attribution.
    if (cupsConsumed > 0 && !usable) sources = { [LEGACY_CUP_SEASON]: cupsConsumed };
    else if (!usable) sources = {};
    else sources = Object.fromEntries(Object.keys(sources).sort().map((key) => [key, Number(sources[key])]));
    if (Object.values(sources).reduce((sum, amount) => sum + amount, 0) !== cupsConsumed) return { error: "cup-source-sum-mismatch" };
    const receipt = {
      coinsConsumed: Number(entry.coinsConsumed), cupsConsumed, cupsConsumedBySource: sources, projectsConsumed: Number(entry.projectsConsumed),
    };
    if (!integer(receipt.coinsConsumed) || !integer(receipt.projectsConsumed)) return { error: "invalid-receipt" };
    return { receipt };
  }

  function convertState(options = {}) {
    const { DevelopmentV2, DevelopmentV3 } = dependencies(options);
    const blockers = [], warnings = [], ignoredHistory = [];
    const fail = (code, playerId, detail) => blockers.push({ code, ...(playerId ? { playerId } : {}), ...(detail ? { detail } : {}) });
    if (!DevelopmentV2 || !DevelopmentV3) return { ok: false, state: null, warnings, ignoredHistory, blockers: [{ code: "migration-dependency-missing" }] };
    if (!record(options.v2State)) return { ok: false, state: null, warnings, ignoredHistory, blockers: [{ code: "invalid-v2-state" }] };
    if (typeof options.resolveBasePlayer !== "function") return { ok: false, state: null, warnings, ignoredHistory, blockers: [{ code: "base-player-resolver-required" }] };

    const v2 = options.v2State;
    const state = DevelopmentV3.empty();
    for (const key of ["coins", "cupsBySeason", "projects", "unlockedEmblems", "redeemedRunIds", "victoryRewardRunIds"]) state[key] = clone(v2[key]);
    const legacyBuild = Object.fromEntries(DevelopmentV3.PROJECT_RARITIES.map((rarity) => [rarity, Math.max(0, Math.floor(Number(v2.legacyProjectBuild?.[rarity]) || 0))]));
    if (Object.values(legacyBuild).some(Boolean)) state.migrationLegacy = { projectBuild: legacyBuild };

    const historyByPlayer = new Map();
    (Array.isArray(v2.evolutionHistory) ? v2.evolutionHistory : []).forEach((entry, sourceIndex) => {
      const playerId = String(entry?.playerId || "");
      if (!playerId) { fail("history-player-id-missing", null, String(sourceIndex)); return; }
      if (!historyByPlayer.has(playerId)) historyByPlayer.set(playerId, []);
      historyByPlayer.get(playerId).push({ entry, sourceIndex });
    });
    const activeIds = Object.keys(record(v2.players) ? v2.players : {}).sort();
    for (const [playerId, entries] of historyByPlayer) if (!activeIds.includes(playerId)) {
      ignoredHistory.push({ playerId, count: entries.length, sourceIndexes: entries.map(({ sourceIndex }) => sourceIndex) });
    }

    for (const playerId of activeIds) {
      const upgrade = v2.players[playerId];
      if (!record(upgrade) || !integer(Number(upgrade.permanentTargetPotential)) || !String(upgrade.currentPermanentRarity || "")) { fail("invalid-current-upgrade", playerId); continue; }
      const base = options.resolveBasePlayer(playerId);
      if (!record(base) || String(base.playerId || "") !== playerId || !integer(Number(base.finalOverall))) { fail("base-player-missing", playerId); continue; }
      const chronological = (historyByPlayer.get(playerId) || []).slice().sort((a, b) => {
        const at = Date.parse(a.entry?.timestamp || ""), bt = Date.parse(b.entry?.timestamp || "");
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
        if (Number.isFinite(at) !== Number.isFinite(bt)) return Number.isFinite(at) ? -1 : 1;
        return a.sourceIndex - b.sourceIndex;
      });
      if (!chronological.length) { fail("current-history-missing", playerId); continue; }
      const seenIds = new Set(), seenSignatures = new Set();
      let expectedPotential = Number(base.finalOverall);
      let expectedRarity = String(base.category || options.progression?.categoryForPotential?.(expectedPotential) || "");
      let legacyNormale = null;
      const steps = [];
      for (let ordinal = 0; ordinal < chronological.length; ordinal += 1) {
        const entry = chronological[ordinal].entry || {};
        const id = migrationId(entry, playerId, ordinal);
        const signature = [entry.fromRarity, entry.toRarity, entry.fromPotential, entry.toPotential, entry.timestamp || ""].join("|");
        if (seenIds.has(id) || seenSignatures.has(signature)) { fail("duplicate-evolution-entry", playerId, id); break; }
        seenIds.add(id); seenSignatures.add(signature);
        const fromPotential = Number(entry.fromPotential), toPotential = Number(entry.toPotential);
        if (!integer(fromPotential) || !integer(toPotential) || toPotential < fromPotential) { fail("impossible-backwards-evolution", playerId, id); break; }
        if (entry.fromRarity !== expectedRarity) { fail("rarity-discontinuity", playerId, id); break; }
        if (fromPotential !== expectedPotential) { fail("potential-discontinuity", playerId, id); break; }
        const expectedNext = DevelopmentV2.nextRarity(expectedRarity);
        if (entry.toRarity !== expectedNext) { fail("impossible-rarity-transition", playerId, id); break; }
        const receiptResult = receiptFor(entry);
        if (receiptResult.error) { fail(receiptResult.error, playerId, id); break; }
        let profile;
        try { profile = DevelopmentV3.materializeProfile({ basePlayer: base, targetPotential: toPotential, database: options.database, progression: options.progression, category: entry.toRarity }); }
        catch (error) { fail("profile-materialization-failed", playerId, error.message); break; }
        const common = { fromRarity: entry.fromRarity, fromPotential, toPotential, profile, receipt: receiptResult.receipt };
        if (entry.timestamp != null) common.createdAt = String(entry.timestamp);
        if (entry.toRarity === "Normale") legacyNormale = { migrationId: id, ...common };
        else steps.push({ stepId: id, rarity: entry.toRarity, ...common });
        expectedPotential = toPotential; expectedRarity = entry.toRarity;
      }
      if (blockers.some((blocker) => blocker.playerId === playerId)) continue;
      if (expectedPotential !== Number(upgrade.permanentTargetPotential)) { fail("current-target-mismatch", playerId); continue; }
      if (expectedRarity !== String(upgrade.currentPermanentRarity)) { fail("current-rarity-mismatch", playerId); continue; }
      state.players[playerId] = { legacyNormale, steps };
      const active = steps.at(-1)?.profile || legacyNormale?.profile;
      if (!active) { fail("active-upgrade-dropped", playerId); continue; }
      try {
        const v2Options = DevelopmentV2.optionsFromUpgrade(base, upgrade);
        for (let level = 0; level <= DevelopmentV3.MAX_LEVEL; level += 1) {
          const expected = options.progression.getPlayerAtLevel(base, level, options.database, v2Options);
          const actual = DevelopmentV3.resolveMaterializedPlayer(base, active, level);
          const projection = (resolved) => ({ level: resolved.level, overall: resolved.overall, potential: resolved.potential, category: resolved.category, stats: Object.fromEntries(DevelopmentV3.STAT_ORDER.map((key) => [key, resolved.stats[key]])) });
          if (stable(projection(expected)) !== stable(projection(actual))) { fail("active-profile-parity-mismatch", playerId, `level-${level}`); break; }
        }
      } catch (error) { fail("active-profile-parity-failed", playerId, error.message); }
    }
    if (blockers.length) return { ok: false, state: null, warnings, ignoredHistory, blockers };
    const candidate = DevelopmentV3.normalize(state);
    const validation = DevelopmentV3.validate(candidate);
    if (!validation.valid) return { ok: false, state: null, warnings, ignoredHistory, blockers: validation.errors.map((detail) => ({ code: "v3-validation-failed", detail })) };
    return { ok: true, state: candidate, warnings, ignoredHistory, blockers: [] };
  }

  function migrateStoredState(options = {}) {
    const { DevelopmentV2, DevelopmentV3 } = dependencies(options);
    let sourceRaw;
    try { sourceRaw = global.localStorage?.getItem(DevelopmentV2.STORAGE_KEY); }
    catch (error) { return { ok: false, migrated: false, deferred: false, reason: "storage-access-error", blockers: [{ code: "storage-access-error", detail: error.message }] }; }
    let parsed;
    try { parsed = sourceRaw == null || sourceRaw === "" ? null : JSON.parse(sourceRaw); }
    catch (_) { return { ok: false, migrated: false, deferred: false, reason: "invalid-json", blockers: [{ code: "invalid-json" }] }; }
    if (parsed != null && !record(parsed)) return { ok: false, migrated: false, deferred: false, reason: "invalid-state", blockers: [{ code: "invalid-state" }] };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ok: false, migrated: false, deferred: true, reason: "restore-recovery-required", blockers: [] };
    const v2State = DevelopmentV2.read();
    const planned = convertState({ ...options, DevelopmentV2, DevelopmentV3, v2State });
    if (!planned.ok) return { ...planned, migrated: false, deferred: false, reason: planned.blockers[0]?.code || "migration-blocked" };
    if (global.localStorage?.getItem(DevelopmentV2.STORAGE_KEY) !== sourceRaw) return { ...planned, ok: false, state: null, migrated: false, deferred: true, reason: "development-v3-migration-stale", blockers: [{ code: "development-v3-migration-stale" }] };
    const existing = parsed?.[SHADOW_FIELD];
    if (existing != null) {
      if (!record(existing) || existing.schemaVersion !== DevelopmentV3.SCHEMA_VERSION) return { ...planned, ok: false, state: null, migrated: false, deferred: false, reason: "development-v3-schema-conflict", blockers: [{ code: "development-v3-schema-conflict" }] };
      const validation = DevelopmentV3.validate(existing);
      if (!validation.valid || stable(DevelopmentV3.normalize(existing)) !== stable(planned.state)) return { ...planned, ok: false, state: null, migrated: false, deferred: false, reason: "development-v3-migration-conflict", blockers: [{ code: "development-v3-migration-conflict" }] };
      return { ...planned, migrated: false, deferred: false, reason: null };
    }
    const payload = clone(v2State); payload[SHADOW_FIELD] = clone(planned.state);
    try {
      const committed = DevelopmentV2.write(payload);
      return { ...planned, migrated: true, deferred: false, reason: null, developmentState: committed };
    } catch (error) {
      if (["restore-recovery-required", "restore-ownership-lost"].includes(error?.code)) return { ...planned, ok: false, state: null, migrated: false, deferred: true, reason: error.code, blockers: [{ code: error.code }] };
      throw error;
    }
  }

  const api = { SHADOW_FIELD, LEGACY_CUP_SEASON, convertState, planMigration: convertState, migrateStoredState };
  global.DevelopmentV3Migration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
