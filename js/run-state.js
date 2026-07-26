(function (global) {
  "use strict";

  const config = () => global.SEASON1_CONFIG;
  const PROFILE_KEY = "inazuma_roguelike_profile";
  const DEFAULT_TEAM_NAME = "La tua squadra";
  const runLivesLimit = () => Number(global.SEASON1_CONFIG?.maxRunLives ?? global.SEASON1_CONFIG?.startingLives ?? 2);
  const initialRunLives = () => Number(global.SEASON1_CONFIG?.startingLives ?? runLivesLimit());
  const USER_TEAM_LOGO = "inazuma-lightning";

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function makeId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
  function seasonIdOf(runOrId = null) { return global.SeasonRegistry?.normalizeSeasonId?.(typeof runOrId === "object" ? runOrId?.seasonId : runOrId) || "ie1"; }
  function seasonSaveKey(seasonId = null) { return `${config().saveKey}:${seasonIdOf(seasonId)}`; }
  function primaryKey(seasonId = null) { return seasonSaveKey(seasonId); }
  function legacyKeys() { return Array.from(new Set([...(config().legacySaveKeys || []), "inazumaRoguelikeSeason1Run_v1"].filter((key) => key && key !== primaryKey()))); }
  function backupKey(seasonId = null) { return `${primaryKey(seasonId)}_backup`; }
  function tempKey(seasonId = null) { return `${primaryKey(seasonId)}_tmp`; }

  function normalizeTeamIdentity(teamIdentity = {}) {
    const name = String(teamIdentity.name || DEFAULT_TEAM_NAME).trim() || DEFAULT_TEAM_NAME;
    return { name, logo: USER_TEAM_LOGO };
  }
  function validTeamName(value) {
    const name = String(value || "").trim();
    return name.length >= 2 && name.length <= 24 && name !== DEFAULT_TEAM_NAME ? name : "";
  }
  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const name = validTeamName(parsed?.teamIdentity?.name || parsed?.teamName || parsed?.name);
      return { teamIdentity: name ? { name, logo: USER_TEAM_LOGO } : null };
    } catch (error) { console.error("Unable to load profile", error); return { teamIdentity: null }; }
  }
  function saveProfileTeamIdentity(teamIdentity) {
    const cleanIdentity = normalizeTeamIdentity(teamIdentity);
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, teamIdentity: cleanIdentity }));
    return cleanIdentity;
  }

  function createRun(teamIdentity = {}, seasonId = null) {
    const now = new Date().toISOString();
    const normalizedSeasonId = seasonIdOf(seasonId || global.SeasonRegistry?.activeId?.());
    return { version: config().saveVersion, seasonId: normalizedSeasonId, runId: makeId("run"), createdAt: now, updatedAt: now, lastPlayedAt: now, phase: "formation", teamIdentity: normalizeTeamIdentity(teamIdentity), lives: initialRunLives(), formationId: null, roster: [], lineup: [], bench: [], draft: null, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], teamLevel: 0, inventory: [], effects: {}, randomEventHistory: [], fiveVFive: null, activeMatch: null, pendingBossVictory: null, postBossFlow: null, currentZone: null, checkpoint: null, gameOver: false, messages: [] };
  }

  function defaultPostBossFlowFromPending(run) {
    const pending = run?.pendingBossVictory;
    if (!pending) return null;
    const remaining = Math.max(0, Number(pending.rewardsRemaining ?? pending.remainingRewards ?? 2));
    return { status: remaining > 0 ? "reward" : "next-zone", bossIndex: Number(pending.bossIndex ?? run.bossIndex ?? 0), bossTeamId: pending.bossId || pending.bossTeamId || null, matchNodeId: pending.nodeId || pending.matchNodeId || null, remainingRewards: remaining, rewardNumber: Math.max(1, 3 - remaining), excludedIds: Array.isArray(pending.excludedIds) ? pending.excludedIds.map(String) : [], rerolls: Number(pending.rerolls || 0), candidateIds: Array.isArray(pending.candidateIds) ? pending.candidateIds.map(String) : [], completed: false };
  }

  function normalizePostBossFlow(run) {
    let flow = run.postBossFlow || defaultPostBossFlowFromPending(run);
    const match = run.activeMatch;
    if (!flow && match?.type === "boss" && match.result === "victory" && String(match.state || "").startsWith("completed")) {
      flow = { status: "result", bossIndex: Number(match.bossIndex ?? run.bossIndex ?? 0), bossTeamId: match.bossId || null, matchNodeId: match.nodeId || null, remainingRewards: 2, rewardNumber: 1, excludedIds: [], rerolls: 0, candidateIds: [], completed: false };
    }
    if (!flow) return null;
    const remaining = Math.max(0, Math.min(2, Number(flow.remainingRewards ?? flow.rewardsRemaining ?? 2)));
    return { status: ["result", "reward", "next-zone", "season-complete"].includes(flow.status) ? flow.status : (remaining > 0 ? "reward" : "next-zone"), bossIndex: Number(flow.bossIndex ?? run.bossIndex ?? 0), bossTeamId: flow.bossTeamId || flow.bossId || null, matchNodeId: flow.matchNodeId || flow.nodeId || null, remainingRewards: remaining, rewardNumber: Math.max(1, Math.min(2, Number(flow.rewardNumber ?? (3 - remaining)))), excludedIds: Array.isArray(flow.excludedIds) ? Array.from(new Set(flow.excludedIds.map(String))) : [], rerolls: Math.max(0, Number(flow.rerolls || 0)), candidateIds: Array.isArray(flow.candidateIds) ? flow.candidateIds.map(String) : [], completed: Boolean(flow.completed) };
  }

  function migrateV1ToV2(input) { const run = clone(input); run.version = 2; run.postBossFlow = normalizePostBossFlow(run); return run; }
  const SAVE_MIGRATIONS = { 1: migrateV1ToV2 };
  function migrate(input) {
    let run = clone(input);
    let version = Number(run.version || 1);
    while (version < config().saveVersion) { const step = SAVE_MIGRATIONS[version]; if (!step) throw new Error(`Missing save migration ${version}`); run = step(run); version = Number(run.version); }
    return normalize(run);
  }
  function normalize(run) {
    run.seasonId = seasonIdOf(run.seasonId);
    run.version = config().saveVersion;
    run.runId = run.runId || makeId("run");
    run.phase = run.phase || "formation";
    run.lastPlayedAt = run.lastPlayedAt || run.updatedAt || run.savedAt || run.timestamp || run.createdAt || null;
    const rawLives = Number(run.lives);
    const fallbackLives = run.gameOver || ["gameover", "complete", "final-summary", "final-celebration"].includes(String(run.phase || "")) ? 0 : initialRunLives();
    run.lives = Math.max(0, Math.min(runLivesLimit(), Number.isFinite(rawLives) ? rawLives : fallbackLives));
    run.bossIndex = Number.isFinite(Number(run.bossIndex)) ? Number(run.bossIndex) : 0;
    for (const key of ["roster", "lineup", "bench", "inventory", "completedBossIds", "unlockedTeamIds"]) run[key] = Array.isArray(run[key]) ? run[key] : [];
    run.activeMatch = run.activeMatch || null; run.currentZone = run.currentZone || null;
    run.postBossFlow = normalizePostBossFlow(run);
    run.pendingBossVictory = run.pendingBossVictory || null;
    if (run.checkpoint) run.checkpoint.version = config().saveVersion;
    return run;
  }
  function validate(run) {
    return !!(run && typeof run === "object" && Number(run.version) === Number(config().saveVersion) && run.runId && run.phase && Number.isFinite(Number(run.lives)) && Number.isFinite(Number(run.bossIndex)) && Array.isArray(run.roster) && Array.isArray(run.lineup) && Array.isArray(run.bench) && Array.isArray(run.inventory) && Array.isArray(run.completedBossIds) && Array.isArray(run.unlockedTeamIds) && (run.activeMatch === null || typeof run.activeMatch === "object") && (run.currentZone === null || typeof run.currentZone === "object") && (run.postBossFlow === null || typeof run.postBossFlow === "object"));
  }
  function parseCandidate(raw) { if (!raw) return null; const parsed = JSON.parse(raw); const migrated = migrate(parsed); if (!validate(migrated)) throw new Error("Invalid run save"); return migrated; }
  function tryLoadKey(key) { try { return parseCandidate(localStorage.getItem(key)); } catch (error) { console.warn(`Unable to load run candidate ${key}`, error); return null; } }
  function save(run) { return RunStorage.save(run); }
  function load(seasonId = null) { return RunStorage.load(seasonId); }
  function hasSave(seasonId = null) { return !!RunStorage.load(seasonId); }
  function isActiveRun(run) { return validate(run) && !run.gameOver && !["complete", "final-summary", "final-celebration", "gameover"].includes(String(run.phase || "")); }
  function runSortTime(run, fallbackIndex = 0) { const value = run?.lastPlayedAt || run?.updatedAt || run?.savedAt || run?.timestamp || run?.createdAt || ""; const time = Date.parse(value); return Number.isFinite(time) ? time : fallbackIndex; }
  function touch(run) { if (!run) return run; run.lastPlayedAt = new Date().toISOString(); return save(run); }
  function activeSaves() { return (global.SeasonRegistry?.list?.() || [{ id: "ie1" }]).map((season, index) => ({ season, run: load(season.id), index })).filter((entry) => entry.run && isActiveRun(entry.run)).sort((a, b) => runSortTime(b.run, b.index) - runSortTime(a.run, a.index)); }
  function latestActiveSave() { return activeSaves()[0] || null; }
  function remove(seasonId = null) { try { const sid = seasonIdOf(seasonId); localStorage.removeItem(primaryKey(sid)); localStorage.removeItem(backupKey(sid)); localStorage.removeItem(tempKey(sid)); if (sid === "ie1") { localStorage.removeItem(config().saveKey); localStorage.removeItem(`${config().saveKey}_backup`); localStorage.removeItem(`${config().saveKey}_tmp`); } } catch (error) { console.error("Unable to remove run", error); } }
  function restoreBackup() { const backup = RunStorage.loadBackup(); if (!backup) return null; return save(backup); }
  function loadBackup() { return tryLoadKey(backupKey()); }

  const RunStorage = {
    keys: (seasonId = null) => ({ primary: primaryKey(seasonId), backup: backupKey(seasonId), temp: tempKey(seasonId), legacy: legacyKeys() }),
    validate, migrate,
    loadBackup,
    restoreBackup,
    isActiveRun, runSortTime, touch, activeSaves, latestActiveSave,
    load(seasonId = null) {
      const sid = seasonId == null ? seasonIdOf(null) : seasonIdOf(seasonId);
      const order = sid === "ie1" ? [primaryKey(sid), backupKey(sid), tempKey(sid), config().saveKey, `${config().saveKey}_backup`, `${config().saveKey}_tmp`, ...legacyKeys()] : [primaryKey(sid), backupKey(sid), tempKey(sid)];
      const candidates = order.map((key, index) => { const loaded = tryLoadKey(key); const raw = key === config().saveKey ? localStorage.getItem(key) : ""; return { key, index, loaded, legacyGlobal: key === config().saveKey && loaded && !/"seasonId"\s*:/.test(raw || "") }; }).filter((entry) => entry.loaded);
      if (!candidates.length) return null;
      candidates.forEach((entry) => { entry.loaded.seasonId = entry.loaded.seasonId || sid; });
      const best = candidates.sort((a, b) => Number(b.legacyGlobal) - Number(a.legacyGlobal) || runSortTime(b.loaded, b.index) - runSortTime(a.loaded, a.index))[0];
      this.save(best.loaded);
      return best.loaded;
    },
    save(run) {
      try {
        const normalized = normalize(run);
        const stamp = new Date().toISOString();
        normalized.updatedAt = stamp;
        normalized.lastPlayedAt = normalized.lastPlayedAt || stamp;
        const json = JSON.stringify(normalized);
        const reparsed = parseCandidate(json);
        const sid = seasonIdOf(normalized.seasonId);
        const tmp = tempKey(sid); const primary = primaryKey(sid); const backup = backupKey(sid);
        localStorage.setItem(tmp, json);
        parseCandidate(localStorage.getItem(tmp));
        const existing = localStorage.getItem(primary);
        if (existing) { try { parseCandidate(existing); localStorage.setItem(backup, existing); } catch (_) {} }
        localStorage.setItem(primary, json);
        if (sid === "ie1") localStorage.setItem(config().saveKey, json);
        localStorage.removeItem(tmp);
        Object.assign(run, reparsed);
        return run;
      } catch (error) { console.error("Unable to save run", error); return run; }
    },
    remove,
  };

  function createCheckpoint(run) {
    run.checkpoint = clone({ version: config().saveVersion, formationId: run.formationId, teamIdentity: run.teamIdentity, roster: run.roster, lineup: run.lineup, bench: run.bench, bossIndex: run.bossIndex, completedBossIds: run.completedBossIds, unlockedTeamIds: run.unlockedTeamIds, teamLevel: run.teamLevel, inventory: run.inventory, effects: run.effects, randomEventHistory: run.randomEventHistory, fiveVFive: run.fiveVFive, activeMatch: run.activeMatch || null, pendingBossVictory: run.pendingBossVictory || null, postBossFlow: run.postBossFlow || null, currentZone: run.currentZone });
    return save(run);
  }
  function restoreAfterLoss(run, previousNodeId = null) { run.lives = Math.max(0, Math.min(runLivesLimit(), Number(run.lives) || 0) - 1); if (run.lives <= 0) { run.lives = 0; run.gameOver = true; run.phase = "gameover"; return save(run); } const targetNodeId = previousNodeId || run.activeMatch?.previousNodeId || run.currentZone?.currentNodeId || null; if (!targetNodeId) throw new Error("Previous match node unavailable"); if (run.currentZone) { run.currentZone.currentNodeId = targetNodeId; run.currentZone.pendingNodeId = null; } run.phase = "map"; run.gameOver = false; return save(run); }

  global.RunStorage = RunStorage;
  global.RunState = { clone, createRun, save, load, hasSave, runLivesLimit, initialRunLives, normalizeTeamIdentity, validTeamName, loadProfile, saveProfileTeamIdentity, remove, createCheckpoint, restoreAfterLoss, validate, isActiveRun, touch, activeSaves, latestActiveSave };
})(globalThis);
