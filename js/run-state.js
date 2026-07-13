(function (global) {
  "use strict";

  const config = () => global.SEASON1_CONFIG;
  const PROFILE_KEY = "inazuma_roguelike_profile";
  const DEFAULT_TEAM_NAME = "La tua squadra";
  const USER_TEAM_LOGO = "inazuma-lightning";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix) {
    const random = Math.random().toString(36).slice(2, 9);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

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
    } catch (error) {
      console.error("Unable to load profile", error);
      return { teamIdentity: null };
    }
  }

  function saveProfileTeamIdentity(teamIdentity) {
    const cleanIdentity = normalizeTeamIdentity(teamIdentity);
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, teamIdentity: cleanIdentity }));
    return cleanIdentity;
  }

  function createRun(teamIdentity = {}) {
    const cleanIdentity = normalizeTeamIdentity(teamIdentity);
    return {
      version: config().saveVersion,
      runId: makeId("run"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: "formation",
      teamIdentity: cleanIdentity,
      lives: config().startingLives,
      formationId: null,
      roster: [],
      lineup: [],
      bench: [],
      draft: null,
      bossIndex: 0,
      completedBossIds: [],
      unlockedTeamIds: [],
      teamLevel: 0,
      inventory: [],
      effects: {},
      randomEventHistory: [],
      fiveVFive: null,
      activeMatch: null,
      currentZone: null,
      checkpoint: null,
      gameOver: false,
      messages: [],
    };
  }

  function save(run) {
    run.updatedAt = new Date().toISOString();
    localStorage.setItem(config().saveKey, JSON.stringify(run));
    return run;
  }

  function load() {
    try {
      const raw = localStorage.getItem(config().saveKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === config().saveVersion ? parsed : null;
    } catch (error) {
      console.error("Unable to load run", error);
      return null;
    }
  }

  function remove() {
    localStorage.removeItem(config().saveKey);
  }

  function createCheckpoint(run) {
    run.checkpoint = clone({
      formationId: run.formationId,
      teamIdentity: run.teamIdentity,
      roster: run.roster,
      lineup: run.lineup,
      bench: run.bench,
      bossIndex: run.bossIndex,
      completedBossIds: run.completedBossIds,
      unlockedTeamIds: run.unlockedTeamIds,
      teamLevel: run.teamLevel,
      inventory: run.inventory,
      effects: run.effects,
      randomEventHistory: run.randomEventHistory,
      fiveVFive: run.fiveVFive,
      activeMatch: run.activeMatch || null,
      currentZone: run.currentZone,
    });
    return save(run);
  }

  function restoreAfterLoss(run, previousNodeId = null) {
    run.lives -= 1;
    if (run.lives <= 0) {
      run.lives = 0;
      run.gameOver = true;
      run.phase = "gameover";
      return save(run);
    }

    const targetNodeId = previousNodeId || run.activeMatch?.previousNodeId || run.currentZone?.currentNodeId || null;
    if (!targetNodeId) throw new Error("Previous match node unavailable");
    if (run.currentZone) {
      run.currentZone.currentNodeId = targetNodeId;
      run.currentZone.pendingNodeId = null;
    }
    run.phase = "map";
    run.gameOver = false;
    return save(run);
  }

  global.RunState = {
    clone,
    createRun,
    save,
    load,
    normalizeTeamIdentity,
    validTeamName,
    loadProfile,
    saveProfileTeamIdentity,
    remove,
    createCheckpoint,
    restoreAfterLoss,
  };
})(globalThis);
