(function (global) {
  "use strict";

  const config = () => global.SEASON1_CONFIG;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix) {
    const random = Math.random().toString(36).slice(2, 9);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function createRun(teamIdentity = {}) {
    const cleanIdentity = {
      name: String(teamIdentity.name || "La tua squadra").trim() || "La tua squadra",
      logo: teamIdentity.logo || "inazuma-lightning",
    };
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

  function restoreAfterLoss(run) {
    run.lives -= 1;
    if (run.lives <= 0) {
      run.lives = 0;
      run.gameOver = true;
      run.phase = "gameover";
      return save(run);
    }

    const remainingLives = run.lives;
    const checkpoint = clone(run.checkpoint);
    if (!checkpoint) throw new Error("Checkpoint unavailable");
    Object.assign(run, checkpoint);
    run.lives = remainingLives;
    run.phase = "map";
    run.gameOver = false;
    return save(run);
  }

  global.RunState = {
    clone,
    createRun,
    save,
    load,
    remove,
    createCheckpoint,
    restoreAfterLoss,
  };
})(globalThis);
