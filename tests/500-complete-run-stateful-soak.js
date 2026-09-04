"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load, PRODUCTION_MODULES } = require("./helpers/production-runtime");

// Match the browser composition for modules that the lightweight production
// harness normally stubs. This mutation is process-local to this test file.
const PRE_APP_PRODUCTION_MODULES = [
  "profiled-season.js",
  "recruitment-pool.js",
  "formation-layout.js",
  "run-statistics.js",
  "pulls/weighted-pull.js",
  "pulls/legendary-pull.js",
  "draft.js",
  "special-match.js",
  "roguelike_progression.js",
  "game-rules.js",
  "five-v-five.js",
  "smart-lineup.js",
  "smart-lineup-runtime.js",
  "match-simulator-config.js",
  "match-simulator.js",
  "level-progression.js",
];
const appModuleIndex = PRODUCTION_MODULES.indexOf("app.js");
assert(appModuleIndex >= 0, "production runtime must load app.js");
for (const file of [...PRE_APP_PRODUCTION_MODULES].reverse()) {
  if (!PRODUCTION_MODULES.includes(file)) PRODUCTION_MODULES.splice(appModuleIndex, 0, file);
}

const freeAgents = require("../data/FREE_AGENTS_compact.json");
const seasons = [
  { id: "ie1", db: require("../data/IE1_season_compact.json") },
  { id: "ie2", db: require("../data/IE2_season_compact.json") },
  { id: "ie1_s2", db: require("../data/IE1_S2_season_compact.json") },
  { id: "ie1_s3", db: require("../data/IE1_S3_season_compact.json") },
  { id: "orion", db: require("../data/ORION_season_compact.json") },
];
const seasonIds = seasons.map((season) => season.id);
const seasonById = new Map(seasons.map((season) => [season.id, season.db]));
const settle = () => new Promise((resolve) => setImmediate(resolve));

function rngFrom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seededMath(random) {
  const value = Object.create(Math);
  value.random = random;
  return value;
}

function seededDate(index) {
  return class SoakDate extends Date {
    static now() { return 1788544000000 + index * 1000; }
  };
}

function registryFor(seasonId) {
  const normalize = (id) => seasonIds.includes(String(id)) ? String(id) : seasonId;
  const database = (id = seasonId) => seasonById.get(normalize(id)) || seasonById.get(seasonId);
  return {
    DEFAULT_SEASON_ID: seasonId,
    normalizeSeasonId: normalize,
    activeId: () => seasonId,
    list: () => seasons.map((season) => ({ id: season.id, name: season.id })),
    database,
    get: (id) => ({ id: normalize(id), name: normalize(id) }),
    sourceForSeason: (id) => normalize(id),
    isSeasonSource: (source) => seasonIds.includes(String(source)),
    setActive: (id) => ({ id: normalize(id) }),
    loadDatabase: async (id) => database(id),
    player: (id) => database().players?.find((player) => String(player.playerId) === String(id)) || null,
    playersIndex: () => new Map((database().players || []).map((player) => [String(player.playerId), player])),
    teamsIndex: () => new Map((database().teams || []).map((team) => [String(team.teamId), team])),
  };
}

function fetchFor(seasonDb) {
  return async (url) => ({
    ok: true,
    json: async () => {
      const target = String(url || "");
      if (target.includes("FREE_AGENTS")) return freeAgents;
      if (target.includes("PLAYER_VISUALS")) return {};
      return seasonDb;
    },
  });
}

function runtimeOptions(meta, seasonDb, random) {
  return {
    fullRuntime: true,
    seasonId: meta.seasonId,
    seasonDb,
    contextOverrides: {
      SeasonRegistry: registryFor(meta.seasonId),
      fetch: fetchFor(seasonDb),
      Math: seededMath(random),
      Date: seededDate(meta.index),
    },
  };
}

function canonicalId(entry) { return String(entry?.playerId ?? ""); }

function snapshot(run) {
  if (!run) return null;
  return {
    runId: run.runId,
    seasonId: run.seasonId,
    phase: run.phase,
    lives: run.lives,
    gameOver: Boolean(run.gameOver),
    bossIndex: Number(run.bossIndex || 0),
    completedBossIds: [...(run.completedBossIds || [])],
    rosterCount: (run.roster || []).length,
    lineupCount: (run.lineup || []).length,
    benchCount: (run.bench || []).length,
    draft: run.draft && { step: run.draft.step, roles: run.draft.roles?.length, candidates: [...(run.draft.candidates || [])] },
    activeMatch: run.activeMatch && {
      matchId: run.activeMatch.matchId,
      type: run.activeMatch.type,
      state: run.activeMatch.state,
      result: run.activeMatch.result,
      resolutionApplied: run.activeMatch.simulation?.resolutionApplied,
      pending: run.activeMatch.pendingPostMatchAction?.type || null,
    },
    zone: run.currentZone && {
      bossIndex: run.currentZone.bossIndex,
      currentNodeId: run.currentZone.currentNodeId,
      pendingNodeId: run.currentZone.pendingNodeId,
      completed: [...(run.currentZone.completedNodeIds || [])],
    },
    postBoss: run.postBossFlow && {
      status: run.postBossFlow.status,
      remainingRewards: run.postBossFlow.remainingRewards,
      rewardNumber: run.postBossFlow.rewardNumber,
    },
    pendingBossVictory: Boolean(run.pendingBossVictory),
    pendingSpecialReward: Boolean(run.pendingSpecialMatchReward),
    rewardSeen: run.developmentRewardPresentation?.seen,
    finalization: run.finalization?.status || null,
    outbox: (run.permanentEffectOutbox || []).map((effect) => [effect.type, effect.status, effect.id || effect.effectId || null]),
  };
}

function fail(label, meta, run, extra = null) {
  const error = new Error(`${label} | campaign=${meta.index} seed=${meta.seed} season=${meta.seasonId} target=${meta.target}`);
  error.fullSoak = { ...meta, snapshot: snapshot(run), extra };
  throw error;
}

function expect(condition, label, meta, run, extra = null) {
  if (!condition) fail(label, meta, run, extra);
}

function semanticToken(run) { return JSON.stringify(snapshot(run)); }

function assertInvariants(run, meta) {
  expect(Boolean(run), "canonical run missing", meta, run);
  const roster = (run.roster || []).map(canonicalId).filter(Boolean);
  const lineup = (run.lineup || []).map(String);
  const bench = (run.bench || []).map(String);
  expect(new Set(roster).size === roster.length, "duplicate player in roster", meta, run, roster);
  expect(new Set(lineup).size === lineup.length, "duplicate player in lineup", meta, run, lineup);
  expect(new Set(bench).size === bench.length, "duplicate player in bench", meta, run, bench);
  expect(!lineup.some((id) => bench.includes(id)), "player in lineup and bench", meta, run);
  if (roster.length) {
    expect(lineup.every((id) => roster.includes(id)), "lineup player outside roster", meta, run);
    expect(bench.every((id) => roster.includes(id)), "bench player outside roster", meta, run);
  }
  const fiveIds = Object.values(run.fiveVFive?.slots || {}).filter(Boolean).map(String);
  expect(new Set(fiveIds).size === fiveIds.length, "duplicate player in 5v5", meta, run, fiveIds);
  expect(fiveIds.every((id) => roster.includes(id)), "5v5 player outside roster", meta, run, fiveIds);
  expect(new Set(run.completedBossIds || []).size === (run.completedBossIds || []).length, "duplicate completed boss", meta, run);
  const effectIds = (run.permanentEffectOutbox || []).map((effect) => String(effect.id || effect.effectId || "")).filter(Boolean);
  expect(new Set(effectIds).size === effectIds.length, "duplicate permanent effect id", meta, run, effectIds);
  if (["map", "gameover", "final-celebration", "final-summary", "complete"].includes(String(run.phase))) {
    expect(!run.activeMatch, "map/terminal phase retains activeMatch", meta, run);
  }
  if (run.postBossFlow) expect(Boolean(run.pendingBossVictory), "postBossFlow without pendingBossVictory", meta, run);
  if (run.gameOver) expect(run.phase === "gameover" || run.activeMatch?.pendingPostMatchAction?.type === "game-over", "gameOver has no terminal route", meta, run);
}

async function settleRuntime(runtime, seasonDb) {
  runtime.context.ProfiledSeasonRuntime?.register?.(seasonDb.seasonId, seasonDb);
  runtime.seam?.setContext?.({ seasonDb });
  await settle();
  await settle();
  if (runtime.canonical) {
    runtime.seam.setContext({ run: runtime.canonical, seasonDb });
    runtime.context.__INAZUMA_INITIAL_DRAFT_TEST__?.setContext?.({ run: runtime.canonical, seasonDb, freeAgentsDb: freeAgents });
    runtime.context.__INAZUMA_RECRUITMENT_TEST__?.setContext?.({ run: runtime.canonical, seasonDb, freeAgentsDb: freeAgents });
  }
  return runtime;
}

async function reopenRuntime(runtime, seasonDb, meta) {
  const before = semanticToken(runtime.canonical);
  const next = runtime.reopen({ seasonDb });
  await settleRuntime(next, seasonDb);
  expect(semanticToken(next.canonical) === before, "reopen changed canonical campaign state", meta, next.canonical);
  return next;
}

function failNextSave(runtime) {
  const original = runtime.context.RunState.save.bind(runtime.context.RunState);
  let fired = false;
  runtime.context.RunState.save = (...args) => {
    if (!fired) {
      fired = true;
      const error = new Error("full-run soak injected quota");
      error.name = "QuotaExceededError";
      throw error;
    }
    return original(...args);
  };
  return () => { runtime.context.RunState.save = original; };
}

function formationButton(runtime, random) {
  const buttons = runtime.queryAll("[data-formation]").filter((button) => !button.disabled);
  return buttons[Math.floor(random() * buttons.length)] || null;
}

async function draftFromCreation(runtime, seasonDb, meta, random, coverage) {
  runtime.seam.setContext({ seasonDb });
  const started = runtime.context.__INAZUMA_UI_TEST__.startRunWithIdentity({ name: `SOAK ${meta.index}`, emblemId: "default-lightning" });
  expect(started === true, "new run creation failed", meta, runtime.canonical);
  runtime.context.__INAZUMA_INITIAL_DRAFT_TEST__.setContext({ run: runtime.canonical, seasonDb, freeAgentsDb: freeAgents });
  expect(runtime.canonical.phase === "formation", "new run did not enter formation", meta, runtime.canonical);
  const formation = formationButton(runtime, random);
  expect(Boolean(formation), "formation UI exposes no selectable formation", meta, runtime.canonical);
  formation.click();
  expect(runtime.canonical.phase === "draft", "formation selection did not start draft", meta, runtime.canonical);
  let picks = 0;
  while (runtime.canonical.phase === "draft") {
    const draft = runtime.canonical.draft;
    const candidateIds = [...(draft?.candidates || [])];
    expect(candidateIds.length > 0, "draft step has no candidates", meta, runtime.canonical);
    const selectedId = candidateIds[Math.floor(random() * candidateIds.length)];
    const button = runtime.queryAll("[data-player-id]").find((entry) => String(entry.dataset.playerId) === String(selectedId));
    expect(Boolean(button), "draft candidate has no production UI button", meta, runtime.canonical, { selectedId, candidateIds });
    const beforeStep = Number(draft.step || 0);
    button.click();
    picks += 1;
    expect(runtime.canonical.phase !== "draft" || Number(runtime.canonical.draft?.step || 0) === beforeStep + 1, "draft pick made no canonical progress", meta, runtime.canonical);
    expect(picks <= 20, "draft exceeded expected role count", meta, runtime.canonical);
    assertInvariants(runtime.canonical, meta);
  }
  expect(runtime.canonical.phase === "squad", "draft did not finish in Squad", meta, runtime.canonical);
  expect(runtime.canonical.roster.length === runtime.canonical.lineup.length, "initial roster/lineup count mismatch", meta, runtime.canonical);
  expect(runtime.canonical.roster.length >= 11, "initial draft produced fewer than 11 players", meta, runtime.canonical);
  coverage.draftPicks += picks;
  const goMap = runtime.query("#go-map");
  expect(Boolean(goMap), "Squad has no go-map action after draft", meta, runtime.canonical);
  goMap.click();
  expect(runtime.canonical.phase === "map" && Boolean(runtime.canonical.currentZone), "Squad -> Map did not create canonical zone", meta, runtime.canonical);
  assertInvariants(runtime.canonical, meta);
  return runtime;
}

const preferenceSets = [
  ["special_match", "five_v_five", "pull_legendary", "pull_unlocked_teams", "pull_free_agents", "item", "trade", "random", "boss"],
  ["pull_free_agents", "pull_unlocked_teams", "pull_legendary", "five_v_five", "special_match", "trade", "item", "random", "boss"],
  ["item", "trade", "random", "five_v_five", "pull_free_agents", "special_match", "pull_unlocked_teams", "pull_legendary", "boss"],
  ["five_v_five", "special_match", "trade", "item", "pull_unlocked_teams", "pull_free_agents", "random", "pull_legendary", "boss"],
];

function chooseReachableNode(runtime, meta, coverage) {
  runtime.seam.renderMap({ persist: false });
  const buttons = runtime.queryAll("[data-node-id]").filter((button) => !button.disabled);
  expect(buttons.length > 0, "map has no reachable node", meta, runtime.canonical, { markup: runtime.seam.getAppMarkup().slice(0, 500) });
  const preference = preferenceSets[(meta.index + coverage.actions) % preferenceSets.length];
  for (const type of preference) {
    const found = buttons.find((button) => button.dataset.nodeType === type);
    if (found) return found;
  }
  return buttons[0];
}

function outcomeFor(match, run, meta, random) {
  if (match.type === "boss") return meta.target === "gameover" ? "defeat" : "victory";
  if (meta.target === "gameover") return "victory";
  if (Number(run.lives || 0) > 1 && random() < 0.12) return "defeat";
  return "victory";
}

async function resolveMatch(runtime, seasonDb, meta, random, coverage, faults) {
  const before = runtime.canonical;
  const match = before.activeMatch;
  expect(Boolean(match), "match phase has no activeMatch", meta, before);
  const result = outcomeFor(match, before, meta, random);
  runtime.seam.forceMatchOutcome(result);
  let saved = runtime.canonical;
  expect(saved.activeMatch?.result === result, "forced production match result not persisted", meta, saved, { matchType: match.type, result });
  expect(saved.activeMatch?.simulation?.resolutionApplied === true, "match resolution not canonically applied", meta, saved);
  coverage.matches[match.type] = (coverage.matches[match.type] || 0) + 1;
  if (result === "defeat") coverage.defeats += 1; else coverage.victories += 1;
  assertInvariants(saved, meta);

  if (!faults.matchRefresh && meta.index % 23 === 0) {
    runtime = await reopenRuntime(runtime, seasonDb, meta);
    faults.matchRefresh = true;
    coverage.refreshes += 1;
    saved = runtime.canonical;
    expect(saved.activeMatch?.result === result, "refresh lost resolved match", meta, saved);
  }

  runtime.seam.continueAfterMatch();
  const afterFirst = semanticToken(runtime.canonical);
  if (!faults.doubleContinue && meta.index % 19 === 0 && match.type !== "boss") {
    runtime.seam.continueAfterMatch();
    expect(semanticToken(runtime.canonical) === afterFirst, "double Continue applied match navigation twice", meta, runtime.canonical, { matchType: match.type });
    faults.doubleContinue = true;
    coverage.doubleActions += 1;
  }
  return runtime;
}

async function resolveInteractiveState(runtime, seasonDb, meta, random, coverage, faults) {
  for (let guard = 0; guard < 40; guard += 1) {
    const run = runtime.canonical;
    assertInvariants(run, meta);
    if (run.phase === "gameover" || ["final-celebration", "final-summary", "complete"].includes(String(run.phase))) return runtime;
    if (run.pendingSpecialMatchReward) {
      const action = runtime.query("#decline-special-reward") || runtime.query("#claim-special-reward");
      expect(Boolean(action), "Special reward has no valid action", meta, run, { modal: runtime.modalMarkup.slice(0, 600) });
      action.click();
      coverage.specialRewards += 1;
      continue;
    }
    if (run.postBossFlow) {
      const skip = runtime.query("#skip-offer");
      if (skip) skip.click(); else runtime.seam.advanceBossReward();
      coverage.bossRewards += 1;
      continue;
    }
    if (run.phase === "match") {
      runtime = await resolveMatch(runtime, seasonDb, meta, random, coverage, faults);
      continue;
    }
    const hidden = runtime.query("#open-hidden-event");
    if (hidden) {
      hidden.click();
      coverage.randomReveals += 1;
      continue;
    }
    const skipItem = runtime.query("#skip-item");
    if (skipItem) {
      skipItem.click();
      coverage.itemSkips += 1;
      continue;
    }
    const skipTrade = runtime.query("#skip-trade");
    if (skipTrade) {
      skipTrade.click();
      coverage.tradeSkips += 1;
      continue;
    }
    const skipOffer = runtime.query("#skip-offer");
    if (skipOffer) {
      skipOffer.click();
      coverage.pullSkips += 1;
      continue;
    }
    if (run.phase === "five") {
      runtime.seam.renderFiveVFive({ persist: false });
      const save = runtime.query("#save-five");
      expect(Boolean(save) && !save.disabled, "5v5 editor cannot produce valid quintet", meta, run);
      save.click();
      coverage.fiveEditorSaves += 1;
      continue;
    }
    if (run.phase === "finalization") {
      runtime.seam.resumeRunFinalization();
      continue;
    }
    if (run.phase === "map" && !run.currentZone?.pendingNodeId) return runtime;
    fail("campaign state has no executable production action", meta, run, {
      modal: runtime.modalMarkup.slice(0, 700),
      app: runtime.seam.getAppMarkup().slice(0, 700),
    });
  }
  fail("interactive resolver exceeded guard", meta, runtime.canonical);
}

async function maybeRefreshMap(runtime, seasonDb, meta, coverage, faults) {
  const run = runtime.canonical;
  if (!faults.mapRefresh && meta.index % 11 === 0 && run.phase === "map" && !run.currentZone?.pendingNodeId) {
    runtime = await reopenRuntime(runtime, seasonDb, meta);
    faults.mapRefresh = true;
    coverage.refreshes += 1;
    runtime.seam.renderMap({ persist: false });
  }
  return runtime;
}

async function selectMapNode(runtime, seasonDb, meta, random, coverage, faults) {
  const button = chooseReachableNode(runtime, meta, coverage);
  const nodeType = button.dataset.nodeType || "unknown";
  coverage.nodeTypes[nodeType] = (coverage.nodeTypes[nodeType] || 0) + 1;
  coverage.actions += 1;

  if (!faults.mapQuota && meta.index % 37 === 0) {
    const before = semanticToken(runtime.canonical);
    const restore = failNextSave(runtime);
    button.click();
    restore();
    expect(semanticToken(runtime.canonical) === before, "failed map-node save changed canonical state", meta, runtime.canonical, { nodeType });
    const retry = runtime.query("#retry-failed-gameplay");
    expect(Boolean(retry), "map quota failure exposed no retry UI", meta, runtime.canonical, { nodeType });
    retry.click();
    await settle();
    await settle();
    faults.mapQuota = true;
    coverage.quotaRetries += 1;
    return runtime;
  }

  button.click();
  return resolveInteractiveState(runtime, seasonDb, meta, random, coverage, faults);
}

async function settleTerminal(runtime, seasonDb, meta, coverage, faults) {
  let run = runtime.canonical;
  const isChampion = meta.target === "champion";
  expect(isChampion ? ["final-celebration", "final-summary"].includes(String(run.phase)) : run.phase === "gameover", "campaign reached wrong terminal phase", meta, run);

  if (!run.developmentRewardPresentation?.seen) {
    if (!faults.terminalRefresh && meta.index % 13 === 0) {
      runtime = await reopenRuntime(runtime, seasonDb, meta);
      await runtime.seam.resumeRun();
      faults.terminalRefresh = true;
      coverage.refreshes += 1;
      expect(Boolean(runtime.query("#development-reward-continue")), "terminal refresh lost RICOMPENSE RUN", meta, runtime.canonical);
    }
    if (!faults.terminalQuota && meta.index % 31 === 0) {
      const restore = failNextSave(runtime);
      const continueButton = runtime.query("#development-reward-continue");
      expect(Boolean(continueButton), "terminal reward Continue missing before quota injection", meta, runtime.canonical);
      continueButton.click();
      restore();
      expect(runtime.canonical.developmentRewardPresentation?.seen === false, "failed terminal Continue marked reward seen", meta, runtime.canonical);
      const retry = runtime.query("#retry-terminal-effect");
      expect(Boolean(retry), "failed terminal Continue exposed no retry", meta, runtime.canonical);
      retry.click();
      faults.terminalQuota = true;
      coverage.quotaRetries += 1;
    }
    const rewardContinue = runtime.query("#development-reward-continue");
    expect(Boolean(rewardContinue), "RICOMPENSE RUN Continue missing", meta, runtime.canonical, { app: runtime.seam.getAppMarkup().slice(0, 700) });
    rewardContinue.click();
    if (!faults.terminalDouble && meta.index % 17 === 0) {
      rewardContinue.click();
      faults.terminalDouble = true;
      coverage.doubleActions += 1;
    }
  }

  run = runtime.canonical;
  expect(run.developmentRewardPresentation?.seen === true, "terminal reward presentation not acknowledged", meta, run);
  expect(runtime.redeemed.size === 1, "Development run-end reward not exactly once", meta, run, { redeemed: [...runtime.redeemed] });

  if (isChampion) {
    expect(runtime.hall.length === 1, "champion Hall entry not exactly once", meta, run, { hall: runtime.hall.length });
    expect(run.phase === "final-celebration", "champion did not reach Celebration", meta, run);
    const finalContinue = runtime.query("#final-continue");
    expect(Boolean(finalContinue), "Celebration Continue missing", meta, run);
    finalContinue.click();
    run = runtime.canonical;
    expect(run.phase === "final-summary", "Celebration did not reach final Summary", meta, run);
    expect(runtime.seam.getAppMarkup().includes("final-summary-screen"), "final Summary UI missing", meta, run);
  } else {
    expect(runtime.hall.length === 0, "GameOver incorrectly wrote Hall champion", meta, run, { hall: runtime.hall.length });
    expect(run.gameOver === true && run.phase === "gameover", "GameOver terminal state lost after rewards", meta, run);
    expect(runtime.seam.getAppMarkup().includes("RUN TERMINATA"), "GameOver UI missing after reward acknowledgement", meta, run);
  }
  assertInvariants(run, meta);
  return runtime;
}

async function runCampaign(meta, seasonDb, globalCoverage) {
  const random = rngFrom(meta.seed);
  const storage = new BudgetStorage(30_000_000);
  let runtime = load(storage, runtimeOptions(meta, seasonDb, random));
  await settleRuntime(runtime, seasonDb);
  const faults = { mapQuota: false, mapRefresh: false, matchRefresh: false, doubleContinue: false, terminalRefresh: false, terminalQuota: false, terminalDouble: false };
  const coverage = {
    actions: 0, draftPicks: 0, nodeTypes: {}, matches: {}, victories: 0, defeats: 0,
    bossRewards: 0, specialRewards: 0, pullSkips: 0, itemSkips: 0, tradeSkips: 0,
    randomReveals: 0, fiveEditorSaves: 0, refreshes: 0, quotaRetries: 0, doubleActions: 0,
  };

  runtime = await draftFromCreation(runtime, seasonDb, meta, random, coverage);
  const bossTotal = seasonDb.bossOrder.length;
  for (let step = 0; step < 500; step += 1) {
    const run = runtime.canonical;
    assertInvariants(run, meta);
    if (meta.target === "gameover" && run.phase === "gameover") break;
    if (meta.target === "champion" && ["final-celebration", "final-summary"].includes(String(run.phase))) break;
    expect(run.phase === "map", "campaign loop expected Map between actions", meta, run);
    runtime = await maybeRefreshMap(runtime, seasonDb, meta, coverage, faults);
    runtime = await selectMapNode(runtime, seasonDb, meta, random, coverage, faults);
    if (meta.target === "champion") expect(Number(runtime.canonical.bossIndex || 0) <= bossTotal, "bossIndex exceeded season", meta, runtime.canonical, { bossTotal });
  }

  const terminal = runtime.canonical;
  if (meta.target === "champion") {
    expect(Number(terminal.bossIndex || 0) === bossTotal, "champion campaign did not defeat every boss", meta, terminal, { bossTotal });
    expect((terminal.completedBossIds || []).length === bossTotal, "champion completedBossIds count mismatch", meta, terminal, { bossTotal });
  } else {
    expect(terminal.gameOver === true && terminal.phase === "gameover", "GameOver campaign did not terminate", meta, terminal);
  }

  runtime = await settleTerminal(runtime, seasonDb, meta, coverage, faults);
  globalCoverage.campaigns += 1;
  globalCoverage.targets[meta.target] += 1;
  globalCoverage.seasons[meta.seasonId] = (globalCoverage.seasons[meta.seasonId] || 0) + 1;
  for (const [type, count] of Object.entries(coverage.nodeTypes)) globalCoverage.nodeTypes[type] = (globalCoverage.nodeTypes[type] || 0) + count;
  for (const [type, count] of Object.entries(coverage.matches)) globalCoverage.matches[type] = (globalCoverage.matches[type] || 0) + count;
  for (const key of ["actions", "draftPicks", "victories", "defeats", "bossRewards", "specialRewards", "pullSkips", "itemSkips", "tradeSkips", "randomReveals", "fiveEditorSaves", "refreshes", "quotaRetries", "doubleActions"]) globalCoverage[key] += coverage[key];
  runtime.destroy();
}

async function main() {
  const coverage = {
    campaigns: 0,
    targets: { champion: 0, gameover: 0 },
    seasons: {}, nodeTypes: {}, matches: {}, actions: 0, draftPicks: 0, victories: 0, defeats: 0,
    bossRewards: 0, specialRewards: 0, pullSkips: 0, itemSkips: 0, tradeSkips: 0,
    randomReveals: 0, fiveEditorSaves: 0, refreshes: 0, quotaRetries: 0, doubleActions: 0,
  };
  const startedAt = Date.now();
  for (let index = 0; index < 500; index += 1) {
    const season = seasons[index % seasons.length];
    const cycle = Math.floor(index / seasons.length);
    const target = cycle % 5 < 3 ? "champion" : "gameover";
    const seed = (0x9e3779b9 ^ Math.imul(index + 1, 2246822519)) >>> 0;
    const meta = { index: index + 1, seed, seasonId: season.id, target };
    try {
      await runCampaign(meta, season.db, coverage);
    } catch (error) {
      console.error("500-COMPLETE-RUN FAILURE", error.fullSoak || meta, error);
      throw error;
    }
  }

  assert.strictEqual(coverage.campaigns, 500);
  assert.deepStrictEqual(coverage.targets, { champion: 300, gameover: 200 });
  for (const season of seasons) assert.strictEqual(coverage.seasons[season.id], 100, `${season.id} must execute 100 complete campaigns`);
  assert((coverage.matches.boss || 0) > 0, "full-run soak never executed a Boss match");
  assert((coverage.matches.five_v_five || 0) > 0, "full-run soak never executed a 5v5 match");
  assert((coverage.matches.special_match || 0) > 0, "full-run soak never executed a Special Match");
  assert(coverage.bossRewards > 0, "full-run soak never crossed Boss rewards");
  assert(coverage.quotaRetries > 0 && coverage.refreshes > 0 && coverage.doubleActions > 0, "fault/reopen/double-action coverage missing");

  const elapsedMs = Date.now() - startedAt;
  console.log(`500 complete stateful campaigns: PASS | targets=${JSON.stringify(coverage.targets)} | seasons=${JSON.stringify(coverage.seasons)} | elapsedMs=${elapsedMs}`);
  console.log(`full-run coverage: nodes=${JSON.stringify(coverage.nodeTypes)} matches=${JSON.stringify(coverage.matches)} actions=${coverage.actions} draftPicks=${coverage.draftPicks} bossRewards=${coverage.bossRewards} specialRewards=${coverage.specialRewards} pullSkips=${coverage.pullSkips} itemSkips=${coverage.itemSkips} tradeSkips=${coverage.tradeSkips} random=${coverage.randomReveals} refreshes=${coverage.refreshes} quotaRetries=${coverage.quotaRetries} doubleActions=${coverage.doubleActions}`);
  console.log("terminal invariant: 300 champion runs defeated every boss and reached reward -> Celebration -> Summary; 200 runs reached real GameOver; Development exactly once on all 500 and Hall exactly once only on champions");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
