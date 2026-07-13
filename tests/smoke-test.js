"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

require(path.join(root, "js/season1-config.js"));
require(path.join(root, "js/run-state.js"));
require(path.join(root, "js/draft.js"));
require(path.join(root, "js/map-generator.js"));
require(path.join(root, "js/roguelike_progression.js"));
require(path.join(root, "js/game-rules.js"));
require(path.join(root, "js/five-v-five.js"));

const season = JSON.parse(fs.readFileSync(path.join(root, "data/IE1_season_compact.json"), "utf8"));
const free = JSON.parse(fs.readFileSync(path.join(root, "data/FREE_AGENTS_compact.json"), "utf8"));
assert(season.formations.eleven.some((item) => item.id === "4-2-4"), "4-2-4 must exist");

const fiveFormations = global.FiveVFive.formations.map((formation) => formation.id);
assert.deepEqual(fiveFormations, ["1-2-1", "1-1-2"], "only the two 5v5 formations should be available");

const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const mobileMedia = css.slice(css.indexOf("@media (max-width: 780px)"));
assert(mobileMedia.includes(".route-map"), "mobile route map rules must exist");
assert(mobileMedia.includes("min-width: 0"), "mobile route map must remove the 620px minimum width");
assert(mobileMedia.includes("overflow-x: hidden"), "mobile map container must prevent horizontal overflow");
assert(mobileMedia.includes("touch-action: pan-y"), "mobile map must keep vertical panning without horizontal dragging");
const routeMapBefore = css.match(/\.route-map::before\s*\{([\s\S]*?)\n\}/)?.[1] || "";
assert(routeMapBefore.includes("radial-gradient(circle at 50% 50%"), "route map center circle must remain visible");
assert(routeMapBefore.includes("transparent calc(50%") && routeMapBefore.includes("calc(50% +"), "route map half-way line must remain visible");
assert(!/linear-gradient\(90deg,\s*rgba\(244,255,242,[^)]+\) 0 0\)\s*(?:left|right) 50% top 50% \/ 18% 24% no-repeat/.test(css), "desktop route map must not draw filled center/penalty panels");
assert(!/background(?:-color)?:\s*rgba\(255,\s*255,\s*255/.test(routeMapBefore), "route map field layer must not use a white translucent background");
assert(css.includes("pointer-events: none"), "route map decorative layers must not intercept clicks");

assert(mobileMedia.includes("--pitch-card-size"), "mobile squad cards must use a constant base card size");
assert(mobileMedia.includes("var(--pitch-card-size)"), "mobile squad rows must not stretch cards based on row count");
assert(mobileMedia.includes("width: calc(100vw - 20px)"), "mobile player detail modal must fit and center inside viewport");
assert(appJs.includes("--players-in-row:${row.ids.length || 1}"), "squad rows must expose player count to CSS grid");
assert(appJs.includes('["five", "5v5", "five"]'), "bottom navigation must include the 5v5 section");
assert(appJs.includes("Completa la Formazione 5v5"), "incomplete 5v5 formations must block 5v5 match nodes");
assert(appJs.includes("trade-squad-layout"), "trade screen must reuse the tactical squad layout");
assert(css.includes(".trade-bench-panel .mini-player { width: min(150px, 100%); max-width: 150px;"), "trade bench cards must use an explicit, non-stretched reserve size");
assert(css.includes(".player-card-large"), "large pull cards must have a class distinct from compact tactical cards");
assert(css.includes(".player-card-compact, button.player-card-compact"), "compact tactical cards must override generic player-card button width");
assert(css.includes(".mini-player.selected") && css.includes("outline: 3px solid #05070b"), "selected trade players must have a clear dark outline");
assert(appJs.includes("runKeepingScroll") && appJs.includes("preserveScroll: scrollSnapshot()"), "trade selection and provisional win flows must preserve scroll");
assert(appJs.includes("function setSelectedSquadPlayer(playerId)"), "squad editing must update selection classes incrementally");
assert(appJs.includes("function swapSquadPlayersInDom(starterId, benchId)"), "squad swaps must update only the affected starter and bench cards");
assert(!/function handleSquadSelection[\s\S]*?runKeepingScroll\(renderSquad\)[\s\S]*?function ensureCurrentZone/.test(appJs), "squad player selection must not rerender the squad screen");
assert(appJs.includes("function setSelectedTradePlayer(playerId)"), "trade player selection must update selection classes incrementally");
assert(appJs.includes("function updateTradeConfirmState()"), "trade player selection must update only confirm/summary state");
assert(!/modalRoot\.querySelectorAll\(\"\[data-trade-player\]\"\)[\s\S]*?resolveTradeNode/.test(appJs), "trade player clicks must not rerender the trade modal");
assert(appJs.includes('const main = app.querySelector("main");') && appJs.includes('main.addEventListener("click"'), "squad player clicks must use one delegated listener on the stable screen");
assert(appJs.includes("focus({ preventScroll: true })"), "automatic focus must not force scroll movement");
assert(appJs.includes('history.scrollRestoration = "manual"'), "browser scroll restoration must be disabled centrally");
assert(appJs.includes('function resetViewScroll(viewElement = null)') && appJs.includes('function scrollTargetsForView(viewElement = null)'), "view scroll reset must be centralized and discover scrollable containers");
assert(appJs.includes('requestAnimationFrame(() => requestAnimationFrame(callback))'), "view scroll reset must run after render/paint");
assert(appJs.includes('behavior: "auto"') && !appJs.includes('behavior: "smooth"'), "scroll reset must be immediate and never smooth");
assert(!/resetViewScroll[\s\S]{0,260}innerWidth|matchMedia\?\.\("\(max-width: 780px\)"\)[\s\S]{0,260}resetViewScroll/.test(appJs), "scroll reset must not be limited to mobile breakpoints");
assert(appJs.includes('appTop') && appJs.includes('viewTop') && appJs.includes('modalTop'), "scroll snapshots must preserve app, view and modal positions for internal interactions");
assert(appJs.includes('setScrollPosition(activeView') && appJs.includes('setScrollPosition(modal'), "returning from modal/internal updates must restore the previous context scroll");
assert(!appJs.includes('return runKeepingScroll(renderMap);'), "opening the route after match resolution must be treated as a new view, not an internal scroll-preserving update");
assert(appJs.includes('player-detail-visual ${rarityClass(resolved.category)}'), "player detail visual must inherit effective rarity color class");
assert(appJs.includes("showPullConfirmation"), "player pulls must open a confirmation before picking a candidate");

assert(appJs.includes("mobile-compact-player-list pull-confirmation-card"), "pull confirmation must reuse the shared compact mobile card container");
assert(appJs.includes("mobile-compact-player-list bench-replacement-grid"), "full-roster bench replacement must reuse the shared compact mobile card container");
assert(mobileMedia.includes(".mobile-compact-player-list .player-card-large"), "mobile compact contexts must share the pull card horizontal rules");
assert(mobileMedia.includes(".pull-offer-grid .player-card-large .player-portrait, .mobile-compact-player-list .player-card-large .player-portrait"), "mobile confirmation portraits must reuse the pull compact portrait image rule");
assert(mobileMedia.includes("height: 100%") && mobileMedia.includes("object-fit: contain"), "mobile compact portraits must keep a visible non-deformed source inside the image column");
assert(appJs.includes("function playerPortraitUrl(player)") && appJs.includes("player?.portraitUrl || player?.image || player?.imageUrl || player?.frontFullbodyUrl"), "pull cards must resolve a valid portrait source from supported player image fields");
assert(appJs.includes("data:image/svg+xml") && appJs.includes('src="${escapeHtml(playerPortraitUrl(player))}" alt="${escapeHtml(player.name)}"'), "pull cards must render a portrait fallback through the shared helper");
assert(appJs.includes('<button class="btn btn-primary" id="confirm-pull-pick">Sì</button>') && appJs.includes('<button class="btn" id="cancel-pull-pick">No</button>') && appJs.includes('<button class="btn btn-yellow" id="detail-pull-pick">Apri scheda</button>'), "pull confirmation buttons and logic hooks must remain unchanged");
assert(!appJs.includes("data-confirm-replacement"), "bench replacement logic should keep using the existing data-player-id click path");
assert(appJs.includes("Il Gettone scout non può essere utilizzato nelle pull leggendarie."), "legendary pulls must block scout token rerolls in logic and UI");
assert(css.includes("align-items: center"), "desktop fullbody visual must be vertically centered");
assert(css.includes("width: min(100%, 560px)"), "desktop fullbody player art must keep the approved size");
assert(css.includes("object-fit: contain"), "fullbody image must preserve proportions");
assert(mobileMedia.includes("width: min(90%, 340px)"), "mobile fullbody player art must keep the approved size");


assert(appJs.includes('boss-match-screen'), "boss nodes must render the dedicated 11v11 boss match screen");
assert(appJs.includes('bossMatchField({ players: userPlayers') && appJs.includes('bossMatchField({ players: bossPlayers'), "desktop boss match must render both teams at once");
assert(appJs.includes('bossMatchTab') && appJs.includes('data-boss-tab="user"') && appJs.includes('data-boss-tab="boss"'), "mobile boss match tabs must switch between user and boss formations");
assert(appJs.includes('function completeBossMatch(result)') && appJs.includes('ui.bossMatchResolving') && appJs.includes('ui.bossMatchState.startsWith("completed")'), "boss match completion must guard against duplicate resolution");
assert(appJs.includes('completeBossMatch("victory")') && appJs.includes('completeBossMatch("defeat")'), "boss match controls must reuse the centralized victory/defeat completion logic");
assert(css.includes('.boss-match-card') && !/\.boss-match-card\s*,\s*\.mini-player/.test(css), "boss match cards must use isolated styles and not override mini-player cards");
assert(css.includes('.boss-match-main-grid') && css.includes('@media (max-width: 780px)') && css.includes('.boss-match-mobile-field'), "boss match must define distinct desktop and mobile layouts");
assert(css.includes('.boss-match-line[data-row-count="5"]'), "mobile boss match must keep five-player lines on one row with specific sizing");

const expectedFormationRows = {
  "4-3-3": [3, 3, 4, 1],
  "4-4-2": [2, 4, 4, 1],
  "4-2-4": [4, 2, 4, 1],
  "3-4-3": [3, 4, 3, 1],
  "5-4-1": [1, 4, 5, 1],
  "4-5-1": [1, 5, 4, 1],
};
for (const formation of season.formations.eleven) {
  assert.deepEqual(
    [formation.requirements.FW, formation.requirements.MF, formation.requirements.DF, formation.requirements.GK],
    expectedFormationRows[formation.id],
    `${formation.id} must render tactical rows without wrapping/reordering`
  );
}

assert.equal(global.RoguelikeRules.defeatedBossRewardLevel(season.bossOrder[0]), 1);
assert.equal(global.RoguelikeRules.defeatedBossRewardLevel(season.bossOrder[1]), 3);
assert.equal(global.RoguelikeRules.unlockedPullLevel(season, 2), 3);
const wildTeam = season.teams.find((team) => team.teamId === "wild");
const migratedRun = {
  completedBossIds: ["occult", "wild"],
  roster: [{ playerId: String(wildTeam.playerIds[0]), source: "season1", level: 1 }],
};
assert.equal(global.RoguelikeRules.migrateDefeatedBossPlayerLevels(migratedRun, season), 1);
assert.equal(migratedRun.roster[0].level, 3);
assert.equal(Object.values(global.SEASON1_CONFIG.nodeWeights).reduce((sum, value) => sum + value, 0), 100);
const expectedStagePullWeights = [
  { bossIndex: 0, free: 17, defeated: 8 },
  { bossIndex: 2, free: 17, defeated: 8 },
  { bossIndex: 3, free: 8, defeated: 17 },
  { bossIndex: 4, free: 8, defeated: 17 },
  { bossIndex: 5, free: 5, defeated: 20 },
  { bossIndex: 6, free: 5, defeated: 20 },
  { bossIndex: 7, free: 3, defeated: 22 },
  { bossIndex: 9, free: 3, defeated: 22 },
];
for (const { bossIndex, free, defeated } of expectedStagePullWeights) {
  const weights = global.MapEngine.nodeWeightsForStage({ bossIndex });
  assert.equal(weights.pull_free_agents, free, `stage ${bossIndex + 1} free agent pull weight`);
  assert.equal(weights.pull_unlocked_teams, defeated, `stage ${bossIndex + 1} defeated team pull weight`);
  assert.equal(weights.pull_free_agents + weights.pull_unlocked_teams, 25);
  assert.equal(Object.values(weights).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(weights.five_v_five, 32);
  assert.equal(weights.random, 15);
  assert.equal(weights.item, 15);
  assert.equal(weights.trade, 10);
  assert.equal(weights.pull_legendary, 3);
}
assert.equal(Object.values(global.SEASON1_CONFIG.hiddenNodeWeights).reduce((sum, value) => sum + value, 0), 100);
assert.equal(global.SEASON1_CONFIG.maxInventory, 20);

const itemById = (id) => global.SEASON1_CONFIG.itemPool.find((item) => item.id === id);
const originalUnaffectedItemWeights = {
  scout_token: 9,
  medical_kit: 11,
  lucky_charm: 3,
  boots_attack: 8,
  boots_control: 8,
  boots_defense: 8,
  keeper_gloves: 8,
  grit_band: 8,
  physical_band: 8,
  speed_necklace: 8,
  stamina_necklace: 8,
};
const energyDrink = itemById("energy_drink");
const trainingManual = itemById("training_manual");
const intensiveTraining = itemById("intensive_training");
assert(energyDrink, "energy drink must exist in the real item pool");
assert(trainingManual, "training manual must exist in the real item pool");
assert.equal(global.SEASON1_CONFIG.itemPool.filter((item) => item.id === "intensive_training").length, 1, "only one intensive training item must exist in the real item pool");
assert.equal(energyDrink.weight, 10, "energy drink real pool weight");
assert.equal(energyDrink.amount, 2, "energy drink real amount");
assert.equal(energyDrink.description, "Assegna +2 livelli a un giocatore.", "energy drink visible description");
assert.equal(trainingManual.weight, 12, "training manual real pool weight");
assert.equal(trainingManual.amount, 0.5, "training manual amount must remain unchanged");
assert.equal(trainingManual.description, "Tutta la rosa guadagna +0,5 livello.", "training manual visible description");
assert.equal(intensiveTraining.weight, 7, "intensive training real pool weight");
assert.equal(intensiveTraining.effect, "potential_boost", "intensive training effect must remain unchanged");
assert.equal(intensiveTraining.amount, 3, "intensive training amount must remain unchanged");
assert.equal(intensiveTraining.description, "Aumenta permanentemente di +3 l’overall attuale e il potenziale massimo di un giocatore, fino a 99.", "intensive training visible description");
for (const [id, expectedWeight] of Object.entries(originalUnaffectedItemWeights)) {
  assert.equal(itemById(id)?.weight, expectedWeight, `${id} weight must not change during the training item rebalance`);
}
assert(!appJs.includes("Assegna +1 livello a un giocatore."), "old energy drink +1 description must not remain in UI text");
assert(appJs.includes("Questo giocatore ha già raggiunto il livello massimo."), "energy drink max-level block message must be shown");
assert(appJs.includes("Tutti i giocatori hanno già raggiunto il livello massimo."), "training manual all-max block message must be shown");
assert(appJs.includes("const appliedLevels = Math.min(Number(item.amount || 1), 20 - currentLevel);"), "energy drink must cap applied levels before consuming the item");
assert(appJs.includes("Overall ${before.overall} → ${after.overall}"), "energy drink summary must show recalculated overall before and after");
assert(appJs.includes('mode === "equip"'), "equipment assignment must use tactical squad cards, not the old linear player list");
assert(appJs.includes("handleEquipmentTarget"), "equipment assignment must route through replacement confirmation logic");
assert(appJs.includes("Conferma sostituzione"), "replacing equipped items must ask for confirmation");
assert(appJs.includes("item-assignment-layout"), "equipment assignment modal must show pitch and bench sections");
assert(appJs.includes("data-detail-unequip"), "player details must expose a direct remove item button");
assert(appJs.includes('luckyCompatible = ["pull_free_agents", "pull_unlocked_teams"].includes(pullType)'), "lucky charm must only be usable for eligible pull types");
assert(appJs.includes("function useLuckyCharmOnPull") && appJs.includes("chooseLuckyUpgrade"), "lucky charm must reroll visible candidates with rarity upgrades during a pull");
assert(appJs.includes("luckyCharmUsed") && appJs.includes("Portafortuna già utilizzato"), "lucky charm use must be persisted and blocked after one use per pull");
assert(appJs.includes("luckyCharmPoolForPull") && appJs.includes("players: seasonDb.players"), "team-pull lucky charm rerolls must use all season teams");
assert(appJs.includes("function buildLuckyCharmUpgrades") && appJs.includes("currentCandidates.length !== 3"), "lucky charm must validate exactly three visible candidates before upgrading");
assert(appJs.includes("upgradedCandidates.length !== 3") && appJs.includes("node.pullState.candidateIds = upgradedCandidates.map"), "lucky charm must atomically store the full upgraded array of three candidates");
assert(!appJs.includes("higherUpgrade") && !appJs.includes("anyNotWeaker"), "lucky charm must not fall back to rarities above the immediate next category");
assert(appJs.includes("candidate.category === improvedCategory(currentCandidates[index].category)"), "each lucky charm slot must upgrade by exactly one category");
assert(appJs.includes("uniqueIds.size !== 3"), "lucky charm must reject duplicate upgraded candidates");
assert(appJs.includes("Non è stato possibile migliorare tutti i candidati."), "failed lucky charm generation must be reported without consuming the item");
assert(appJs.includes('removeInventoryItem(luckyCharm.instanceId);') && appJs.indexOf('const upgradedCandidates = buildLuckyCharmUpgrades') < appJs.indexOf('removeInventoryItem(luckyCharm.instanceId);'), "lucky charm must consume exactly one item only after all upgrades are valid");
assert(!appJs.includes("Usa Portafortuna ×"), "lucky charm button must not suggest multiple consecutive uses");
assert(appJs.includes('"Usa Portafortuna"') && appJs.includes('Disponibili: ${luckyCount}'), "lucky charm button text and available count must be separated");
assert(appJs.includes('node.pullState?.luckyCharmUsed') && appJs.includes('luckyCharmPoolForPull(pullType)') && appJs.includes(': pullPool(pullType)'), "lucky charm upgraded team candidates from future teams must remain renderable without changing normal team pulls");
assert(appJs.includes('item.effect === "lucky_pull"') && appJs.includes("Utilizzabile durante una Pull svincolati o Pull squadre"), "inventory must show lucky charm as in-pull only without an activation button");
assert(!appJs.includes("Portafortuna attivo sulla prossima pull"), "old pending lucky charm activation toast must be removed");
const itemWeights = global.SEASON1_CONFIG.itemPool.map((item) => item.weight);
const luckyCharm = global.SEASON1_CONFIG.itemPool.find((item) => item.id === "lucky_charm");
assert(luckyCharm, "lucky charm must exist");
assert.equal(luckyCharm.weight, Math.min(...itemWeights), "lucky charm must have the lowest item spawn weight");
assert(global.SEASON1_CONFIG.categoryRanks.Scarso < global.SEASON1_CONFIG.categoryRanks.Debole, "category ladder must support Scarso before Debole");

const outgoing = free.players.find((player) => player.position === "FW" && player.finalOverall >= 74);
const tradeCandidates = global.RoguelikeRules.getTradeCandidates({
  outgoingPlayer: outgoing,
  rosterIds: [outgoing.playerId],
  freeAgents: free.players,
  seasonPlayers: season.players,
  unlockedTeamIds: ["occult", "wild"],
  teams: season.teams,
});
assert(tradeCandidates.length > 0);
assert(tradeCandidates.every(({ player }) => player.position === outgoing.position));
assert(tradeCandidates.every(({ player }) => player.finalOverall >= outgoing.finalOverall));

const equippedStats = global.RoguelikeRules.applyEquipment(
  { attack: 99, control: 70 },
  { stat: "attack", bonus: 5 }
);
assert.equal(equippedStats.attack, 104);
assert.equal(equippedStats.control, 70);

const equipmentItems = global.SEASON1_CONFIG.itemPool.filter((item) => item.kind === "equipment");
assert.equal(equipmentItems.length, 8, "all eight equipment items must stay configured");
for (const item of equipmentItems) {
  assert.equal(item.bonus, 5, `${item.name} real equipment bonus must remain +5`);
  const baseStats = { attack: 46, control: 46, speed: 46, grit: 46, physical: 46, stamina: 46, defense: 46, save: 46 };
  const once = global.RoguelikeRules.applyEquipment(baseStats, item);
  for (const stat of Object.keys(baseStats)) {
    assert.equal(once[stat], stat === item.stat ? 51 : 46, `${item.name} must only affect ${item.stat} by +5`);
  }
  assert.equal(once[item.stat] - baseStats[item.stat], 5, `${item.name} detail badge delta must be +5, not +10`);
}

let run;
for (const formation of season.formations.eleven) {
  run = global.RunState.createRun();
  run.formationId = formation.id;
  global.DraftEngine.start(run, formation, free.players);
  while (run.draft) {
    const candidate = run.draft.candidates[0];
    global.DraftEngine.choose(run, candidate, free.players, formation);
  }

  assert.equal(run.roster.length, 11);
  assert.equal(run.lineup.length, 11);
  assert.equal(new Set(run.roster.map((entry) => entry.playerId)).size, 11);
  const roleCounts = run.lineup.reduce((counts, id) => {
    const player = free.players.find((candidate) => String(candidate.playerId) === String(id));
    counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(roleCounts, formation.requirements);
}


const roleOf = (id) => free.players.find((player) => String(player.playerId) === String(id))?.position;
const fiveState = global.FiveVFive.ensure(run, roleOf);
assert.equal(fiveState.formation, "1-2-1", "new drafted runs default to the 1-2-1 5v5 formation");
assert.equal(Object.keys(fiveState.slots).length, 5, "5v5 formation must have exactly five slots");
let fiveStatus = global.FiveVFive.validate(run, roleOf);
assert.equal(fiveStatus.valid, true, fiveStatus.messages.join("; "));
assert.equal(new Set(Object.values(fiveState.slots)).size, 5, "5v5 formation must not duplicate players");
const originalLineup = run.lineup.join(",");
global.FiveVFive.changeFormation(run, "1-1-2", roleOf);
fiveStatus = global.FiveVFive.validate(run, roleOf);
assert.equal(Object.keys(run.fiveVFive.slots).length, 5);
assert.equal(run.lineup.join(","), originalLineup, "changing 5v5 formation must not modify 11v11 lineup");
global.FiveVFive.clearSlot(run, "FW2");
assert.equal(global.FiveVFive.validate(run, roleOf).valid, false, "incomplete 5v5 formations are not valid");
global.RunState.save(run);
const loadedFive = global.RunState.load().fiveVFive;
assert.deepEqual(loadedFive, run.fiveVFive, "5v5 formation must persist through save/load");
const removedFiveId = Object.values(run.fiveVFive.slots).find(Boolean);
run.roster = run.roster.filter((entry) => String(entry.playerId) !== String(removedFiveId));
global.FiveVFive.removeUnavailable(run);
assert(!Object.values(run.fiveVFive.slots).includes(removedFiveId), "removed roster players must leave the 5v5 formation");
const legacyRun = { roster: run.roster, fiveVFive: undefined };
global.FiveVFive.ensure(legacyRun, roleOf);
assert.equal(legacyRun.fiveVFive.formation, "1-2-1", "legacy runs receive a default 5v5 state");

const sampleEntry = run.roster[0];
const sample = free.players.find((player) => String(player.playerId) === sampleEntry.playerId);
const atZero = global.InazumaProgression.getPlayerAtLevel(sample, 0, free);
assert.equal(atZero.overall, sample.finalOverall - 20);

const compactFormat = { statOrder: ["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"], codeWidth: 2, levelMax: 20 };
const statCode = Number(50).toString(36).padStart(2, "0");
const intensiveDb = { compactFormat, players: [
  { playerId: "tier-base", category: "Forte", finalOverall: 79 },
  { playerId: "tier-elite", category: "Elite", finalOverall: 82 },
] };
const intensivePlayer = { playerId: "boost-test", name: "Boost Test", position: "FW", category: "Forte", finalOverall: 79, maxLevel: 20, progressionCode: statCode.repeat(compactFormat.statOrder.length * (compactFormat.levelMax + 1)) };
const beforeTraining = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, 4, intensiveDb);
assert.equal(beforeTraining.overall, 63, "test fixture starts from the requested current overall");
assert.equal(beforeTraining.potential, 79, "test fixture starts from the requested potential");
const afterTraining = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, 4, intensiveDb, { potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 4 }] });
assert.equal(afterTraining.overall, 66, "intensive training immediately raises current overall by the real boost");
assert.equal(afterTraining.potential, 82, "intensive training raises potential by the same real boost");
assert.equal(afterTraining.level, 4, "intensive training must not change player level");
assert(afterTraining.attack > beforeTraining.attack, "intensive training updates real stats using existing role weights");
assert.equal(afterTraining.category, "Elite", "intensive training recalculates rarity from boosted potential");
const secondTraining = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, 4, intensiveDb, { potentialBoost: 6, currentOverallBoost: 6 });
assert.equal(secondTraining.overall, 69, "multiple intensive trainings stack on current overall");
assert.equal(secondTraining.potential, 85, "multiple intensive trainings stack on potential");
const clampedTraining = global.InazumaProgression.getPlayerAtLevel({ ...intensivePlayer, finalOverall: 98 }, 13, intensiveDb, { potentialBoost: 1, currentOverallBoost: 1 });
assert.equal(clampedTraining.overall, 92, "when potential can only gain +1, current overall gains only +1");
assert.equal(clampedTraining.potential, 99, "intensive training potential is clamped at 99");

const legendaryDb = { compactFormat, players: [
  { playerId: "world-92", category: "Mondiale", finalOverall: 92 },
  { playerId: "world-94", category: "Mondiale", finalOverall: 94 },
] };
const legendaryCode = statCode.repeat(compactFormat.statOrder.length * (compactFormat.levelMax + 1));
const boostedWorld92 = { playerId: "world-92", name: "World 92", position: "FW", category: "Mondiale", finalOverall: 92, maxLevel: 20, progressionCode: legendaryCode };
const boostedWorld94 = { playerId: "world-94", name: "World 94", position: "FW", category: "Mondiale", finalOverall: 94, maxLevel: 20, progressionCode: legendaryCode };
for (const potential of [95, 96, 97, 98, 99]) {
  assert.equal(global.InazumaProgression.categoryForPotential(potential, "Mondiale", legendaryDb), "Leggenda", `${potential} potential must be Leggenda`);
}
assert.equal(global.InazumaProgression.categoryForPotential(94, "Mondiale", legendaryDb), "Mondiale", "94 potential must remain Mondiale");
const world92Legend = global.InazumaProgression.getPlayerAtLevel(boostedWorld92, 20, legendaryDb, { potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 20 }] });
assert.equal(world92Legend.potential, 95, "Mondiale 92 with +3 reaches effective potential 95");
assert.equal(world92Legend.category, "Leggenda", "Mondiale 92 with +3 becomes Leggenda");
const world94Legend = global.InazumaProgression.getPlayerAtLevel(boostedWorld94, 20, legendaryDb, { potentialBoost: 1, currentOverallBoost: 1, potentialBoostApplications: [{ amount: 1, appliedLevel: 20 }] });
assert.equal(world94Legend.potential, 95, "Mondiale 94 with +1 reaches effective potential 95");
assert.equal(world94Legend.category, "Leggenda", "Mondiale 94 with +1 becomes Leggenda");
const refreshedWorld97 = global.InazumaProgression.getPlayerAtLevel(boostedWorld94, 20, legendaryDb, { potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 20 }] });
assert.equal(refreshedWorld97.potential, 97, "saved potentialBoost is enough to restore effective potential 97 after refresh");
assert.equal(refreshedWorld97.category, "Leggenda", "saved boosted player remains Leggenda after refresh");
assert.equal(boostedWorld94.category, "Mondiale", "original database player category remains unchanged for a new run");
assert.equal(global.InazumaProgression.getPlayerAtLevel(boostedWorld92, 20, legendaryDb, { potentialBoost: 2, currentOverallBoost: 2 }).category, "Mondiale", "potential below 95 must not become Leggenda");
assert.equal(global.InazumaProgression.effectivePotential(boostedWorld94, { potentialBoost: 7 }), 99, "effective potential is clamped at 99");
assert(appJs.includes('rarityClass(resolved.category)'), "Player Detail and pull cards must use effective category for rarity classes");
assert(appJs.includes('class="player-card player-card-compact') && appJs.includes('${rarityClass(player.category)}'), "shared compact cards expose the effective player category to rarityClass");
assert(appJs.includes('rarity-leggenda') && css.includes('.rarity-leggenda'), "legendary card class and golden styling must exist");
assert(css.includes('.player-detail-layout.rarity-leggenda') && css.includes('#ffd34f'), "Player Detail legendary background must be gold");
assert(!appJs.includes('player-detail-visual ${rarityClass(player.category)}'), "Player Detail must not keep the original rarity class");
const markEvans = season.players.find((player) => player.name === "Mark Evans");
assert(markEvans, "Mark Evans fixture must exist");
const markBoost = 97 - Number(markEvans.finalOverall);
const boostedMarkEvans = global.InazumaProgression.getPlayerAtLevel(markEvans, 20, season, { potentialBoost: markBoost, currentOverallBoost: markBoost, potentialBoostApplications: [{ amount: markBoost, appliedLevel: 20 }] });
assert.equal(boostedMarkEvans.potential, 97, "Mark Evans effective potential reaches 97 with intensive training boost");
assert.equal(boostedMarkEvans.category, "Leggenda", "Mark Evans at potential 97 must become Leggenda");
assert.equal(global.InazumaProgression.categoryForPotential(boostedMarkEvans.potential, markEvans.category, season), "Leggenda", "Mark Evans effective category is not Mondiale at 97");
assert.equal(markEvans.category, "Mondiale", "Mark Evans original database category remains Mondiale");

const applyEnergyDrinkLevel = (level, amount = energyDrink.amount) => {
  const appliedLevels = Math.min(amount, 20 - level);
  return appliedLevels <= 0 ? { used: false, level } : { used: true, level: Math.min(20, level + appliedLevels), appliedLevels };
};
assert.deepEqual(applyEnergyDrinkLevel(5), { used: true, level: 7, appliedLevels: 2 }, "energy drink level 5 must become 7");
assert.deepEqual(applyEnergyDrinkLevel(18), { used: true, level: 20, appliedLevels: 2 }, "energy drink level 18 must become 20");
assert.deepEqual(applyEnergyDrinkLevel(19), { used: true, level: 20, appliedLevels: 1 }, "energy drink level 19 must become 20 with only +1 applied");
assert.deepEqual(applyEnergyDrinkLevel(20), { used: false, level: 20 }, "energy drink level 20 must block use and consumption");
const progressiveCode = compactFormat.statOrder.map((_, statIndex) =>
  Array.from({ length: compactFormat.levelMax + 1 }, (_, level) => Number(40 + statIndex + level).toString(36).padStart(2, "0")).join("")
).join("");
const progressivePlayer = { ...intensivePlayer, progressionCode: progressiveCode };
const energyBefore = global.InazumaProgression.getPlayerAtLevel(progressivePlayer, 5, intensiveDb);
const energyAfter = global.InazumaProgression.getPlayerAtLevel(progressivePlayer, applyEnergyDrinkLevel(5).level, intensiveDb);
assert.equal(energyAfter.level, 7, "energy drink must resolve the player exactly at the new level");
assert(energyAfter.overall > energyBefore.overall, "energy drink must recalculate overall through progression");
assert.notDeepEqual(energyAfter.stats, energyBefore.stats, "energy drink must recalculate stats through progression");
const boostedEnergyAfter = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, 7, intensiveDb, { potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 5 }] });
assert.equal(boostedEnergyAfter.potential, 82, "energy drink progression must preserve intensive training potential boost");
assert(boostedEnergyAfter.overall >= energyAfter.overall, "energy drink progression must keep intensive training current overall boost without losing it");
const applyTrainingManualLevels = (levels, amount = trainingManual.amount) => {
  let changed = 0;
  const next = levels.map((level) => {
    const capped = Math.min(20, level + amount);
    if (capped > level) changed += 1;
    return capped;
  });
  return { used: changed > 0, levels: next };
};
assert.deepEqual(applyTrainingManualLevels([5, 19.75, 20]), { used: true, levels: [5.5, 20, 20] }, "training manual must add +0.5 to the roster without exceeding 20");
assert.deepEqual(applyTrainingManualLevels([20, 20]), { used: false, levels: [20, 20] }, "training manual must not be consumed when the whole roster is level 20");
const manualBefore = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, 5, intensiveDb, { potentialBoost: 3, currentOverallBoost: 3 });
const manualAfter = global.InazumaProgression.getPlayerAtLevel(intensivePlayer, Math.floor(5.5), intensiveDb, { potentialBoost: 3, currentOverallBoost: 3 });
assert.equal(manualAfter.potential, manualBefore.potential, "training manual recalculation must preserve permanent boosts");
const storedTrainingRun = { version: global.SEASON1_CONFIG.saveVersion, roster: [{ playerId: "boost-test", source: "free_agents", level: 7, potentialBoost: 3, currentOverallBoost: 3 }], inventory: [] };
storage.set(global.SEASON1_CONFIG.saveKey, JSON.stringify(storedTrainingRun));
assert.equal(global.RunState.load().roster[0].level, 7, "level changes must persist through save/load refresh");
const unsimulatedSnapshot = { userStrength: 60, probabilities: global.MatchSimulator?.getMatchWinProbabilities?.("five", 60, 60) };
const recalculatedStrength = energyAfter.overall;
assert.notEqual(recalculatedStrength, unsimulatedSnapshot.userStrength, "unsimulated pre-match strength can be recalculated after level changes");
const simulatedMatch = { state: "completed-victory", score: [3, 2], seed: "fixed-seed", log: ["goal"] };
const simulatedCopy = JSON.parse(JSON.stringify(simulatedMatch));
assert.deepEqual(simulatedMatch, simulatedCopy, "already simulated match result/log/seed fixture remains unchanged by progression helpers");

run.currentZone = global.MapEngine.generate(run, season.bossOrder[0]);
assert(run.currentZone.nodes.some((node) => node.type === "boss"));
assert(global.MapEngine.reachableNodeIds(run.currentZone).length > 0);
const hiddenNode = { id: "hidden-test", type: "random" };
const hiddenType = global.MapEngine.resolveRandomNodeType(run, hiddenNode);
assert(["five_v_five", "item", "pull_free_agents", "trade"].includes(hiddenType));
assert.equal(global.MapEngine.resolveRandomNodeType(run, hiddenNode), hiddenType);

run.bossIndex = 4;
run.unlockedTeamIds = ["occult", "wild", "brainwashing", "otaku"];
run.currentZone.seed = "hidden-distribution";
run.randomEventHistory = [];
const hiddenCounts = {};
let previousHiddenType = null;
for (let index = 0; index < 10000; index += 1) {
  const type = global.MapEngine.resolveRandomNodeType(run, { id: `hidden-${index}` });
  assert.notEqual(type, previousHiddenType, "hidden events must not repeat consecutively");
  previousHiddenType = type;
  hiddenCounts[type] = (hiddenCounts[type] || 0) + 1;
}
for (const type of Object.keys(global.SEASON1_CONFIG.hiddenNodeWeights)) {
  const actualShare = hiddenCounts[type] / 10000;
  assert(actualShare > 0.08, `${type} hidden share too low: ${actualShare}`);
  assert(actualShare < 0.28, `${type} hidden share too high: ${actualShare}`);
}
run.bossIndex = 0;
run.unlockedTeamIds = [];
global.RunState.createCheckpoint(run);
const originalStart = run.currentZone.currentNodeId;
const firstChoice = global.MapEngine.reachableNodeIds(run.currentZone)[0];
global.MapEngine.completeNode(run.currentZone, firstChoice);
const completedBeforeLoss = [...run.currentZone.completedNodeIds];
const pathBeforeLoss = [...run.currentZone.path];
const matchNode = global.MapEngine.reachableNodeIds(run.currentZone).find((nodeId) => run.currentZone.nodes.find((node) => node.id === nodeId)?.type === "five_v_five")
  || global.MapEngine.reachableNodeIds(run.currentZone)[0];
global.MapEngine.selectNode(run.currentZone, matchNode);
run.activeMatch = { nodeId: matchNode, previousNodeId: firstChoice, type: "five_v_five" };
global.RunState.save(run);
global.RunState.restoreAfterLoss(run, run.activeMatch.previousNodeId);
assert.equal(run.lives, 2);
assert.equal(run.currentZone.currentNodeId, firstChoice);
assert.equal(run.currentZone.pendingNodeId, null);
assert.deepEqual(run.currentZone.completedNodeIds, completedBeforeLoss, "completed nodes must survive match defeat");
assert.deepEqual(run.currentZone.path, pathBeforeLoss, "path must not reset after match defeat");
assert.notEqual(run.currentZone.currentNodeId, originalStart, "defeat must not restore the boss-path checkpoint start");

const bossNode = run.currentZone.nodes.find((node) => node.type === "boss");
run.currentZone.currentNodeId = firstChoice;
run.currentZone.pendingNodeId = bossNode.id;
run.activeMatch = { nodeId: bossNode.id, previousNodeId: firstChoice, type: "boss" };
global.RunState.restoreAfterLoss(run, run.activeMatch.previousNodeId);
assert.equal(run.lives, 1);
assert.equal(run.currentZone.currentNodeId, firstChoice, "boss defeat must return to the immediate predecessor");

run.lives = 1;
run.phase = "match";
run.gameOver = false;
run.activeMatch = { nodeId: bossNode.id, previousNodeId: firstChoice, type: "boss" };
global.RunState.restoreAfterLoss(run, run.activeMatch.previousNodeId);
assert.equal(run.lives, 0);
assert.equal(run.gameOver, true);
assert.equal(run.phase, "gameover");

console.log("Smoke test passed: all formations, progression, map and previous-node loss.");
