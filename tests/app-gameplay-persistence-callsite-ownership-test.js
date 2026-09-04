const assert = require("assert");
const fs = require("fs");
const path = require("path");
const source = fs.readFileSync("js/app.js", "utf8");
const initialDraftSource = fs.readFileSync("js/run-entry/initial-draft-controller.js", "utf8");

function bodyBetween(start, end, owner = source) {
  const from = owner.indexOf(start);
  const to = owner.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `missing source range ${start}`);
  return owner.slice(from, to);
}
const formation = bodyBetween("function renderFormationChoice", "function renderDraft", initialDraftSource);
assert.match(formation, /label: "initial-formation-phase"[\s\S]*mutate:/);
assert.match(formation, /label: "initial-draft-start"[\s\S]*DraftEngine\.start\(current/);
const draft = bodyBetween("function renderDraft", "return Object.freeze", initialDraftSource);
assert.match(draft, /label: "initial-draft-pick"[\s\S]*DraftEngine\.choose\(current/);
assert.match(draft, /DraftEngine\.choose\(current[\s\S]*current\.phase = "squad";[\s\S]*reconcileSquadRosterState\(current\)/);
assert.match(draft, /onCommitted(?:\(\)|:)[\s\S]*completed \? renderSquad\(\) : renderDraft\(\)/);
const squadViewSource = fs.readFileSync("js/squad/squad-view.js", "utf8");
const squadView = bodyBetween("function renderSquad()", "function squadPlayerRole", squadViewSource);
assert.doesNotMatch(squadView, /RunState\.save|run\.phase\s*=|reconcileSquadRosterState/);
const squadControllerSource = fs.readFileSync("js/squad/squad-controller.js", "utf8");
const lineup = bodyBetween("function swapPlayers", "return { formationById", squadControllerSource);
assert.match(lineup, /label: "lineup-swap"[\s\S]*mutate:[\s\S]*firstList\[firstIndex\]/);
const tradeNodeSource = fs.readFileSync("js/map/trade-node-controller.js", "utf8");
const trade = bodyBetween("function executeTrade", "function showTradeResult", tradeNodeSource);
assert.match(trade, /mutate: \(current\)[\s\S]*executeProfileAwareTrade\(current/);
assert.match(trade, /mutate: \(current\)[\s\S]*current\.roster\[rosterIndex\]/);
assert.match(trade, /onMutationError:[\s\S]*trade-invalid[\s\S]*Offerta non più valida/);
const recruitmentController = fs.readFileSync("js/recruitment/recruitment-controller.js", "utf8");
const recruit = bodyBetween("function recruitPlayer", "return { recruitPlayer }", recruitmentController);
for (const label of ["recruit-profile", "recruit", "recruit-replacement"]) assert.match(recruit, new RegExp(`label: "${label}"[\\s\\S]*?mutate: \\(current\\)`));
assert.match(recruit, /recruit-needs-replacement[\s\S]*showRecruitReplacement/);
assert.match(recruit, /committed-acquired[\s\S]*committed-upgraded[\s\S]*needs-replacement/);
assert.match(recruit, /chooseInventoryDiscardSelection[\s\S]*discardInstanceId[\s\S]*mutate: \(current\)/);
assert.doesNotMatch(recruit, /removeInventoryItem\(/);

const pullController = fs.readFileSync("js/pulls/pull-controller.js", "utf8");
const pull = bodyBetween("function openPull", "function openDevLegendaryPull", pullController);
assert.match(pull, /onRecover: \(\) => rerenderCanonicalPull\(nodeId, pullType, options\)/, "pull recovery resolves the canonical active node instead of reusing a stale object");
assert.doesNotMatch(pull, /onRecover: \(\) => openPull\(node, pullType, options\)/, "pull recovery must not reuse the pre-rollback node reference");
assert.doesNotMatch(pull, /onRecover: \(\) => showPlayerOffer\(options\)/, "recovery must not reuse incomplete openPull options as an offer config");
const bossController = fs.readFileSync("js/boss/boss-flow-controller.js", "utf8");
const bossRewards = bodyBetween("function showNextReward", "function advanceReward", bossController);
assert.match(bossRewards, /result\.status === "cancelled"\) showNextReward\(\)/, "boss replacement cancel reopens the pending reward");
assert.doesNotMatch(bossRewards, /result\.status === "cancelled"\) advanceReward/, "boss replacement cancel never consumes a reward");
assert.match(recruit, /smartLineupResult = optimizeLineupsForNewPlayer[\s\S]*onCommitted:[\s\S]*committedSideEffects/);
const persistence = fs.readFileSync("js/gameplay-persistence.js", "utf8");
assert.match(persistence, /catch \(error\)[\s\S]*kind: "mutation"[\s\S]*onMutationError/);
assert.doesNotMatch(persistence, /kind: "mutation"[\s\S]{0,500}reportFailure\?/);
assert.doesNotMatch(source, /mutate: \(\) => \{\}/);

// Final persistence audit: no gameplay renderer/controller may directly own RunState writes.
// The only intentional direct save callsites in production are the central app adapter and
// PermanentEffects' idempotent outbox fallback. Post-boss checkpoint creation is a best-effort
// snapshot taken only after an already-verified canonical commit.
function productionJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? productionJsFiles(full) : entry.isFile() && entry.name.endsWith(".js") ? [full.replaceAll("\\", "/")] : [];
  });
}
function directRunStorageCalls(file) {
  const text = fs.readFileSync(file, "utf8");
  return [...text.matchAll(/\bRunState\.(save|touch|createCheckpoint)\s*\(/g)].map((match) => match[1]);
}
const observedOwners = Object.fromEntries(
  productionJsFiles("js")
    .map((file) => [file, directRunStorageCalls(file)])
    .filter(([, calls]) => calls.length)
    .sort(([a], [b]) => a.localeCompare(b)),
);
assert.deepStrictEqual(observedOwners, {
  "js/app.js": ["save", "createCheckpoint"],
  "js/permanent-effects.js": ["save", "save"],
}, `unexpected direct RunState persistence ownership:\n${JSON.stringify(observedOwners, null, 2)}`);

const runMapControllerSource = fs.readFileSync("js/map/run-map-controller.js", "utf8");
assert.doesNotMatch(runMapControllerSource, /\bRunState\.(?:save|touch|createCheckpoint)\s*\(/, "RunMapController must be a read-only renderer/orchestrator; map state changes commit through persistGameplayMutation");
const runResumeControllerSource = fs.readFileSync("js/run-entry/run-resume-controller.js", "utf8");
assert.doesNotMatch(runResumeControllerSource, /ensureCurrentZone\(\);[\s\S]*renderMap\(\);/, "resume-to-map must not depend on a persistence-owning render path");

console.log("app gameplay persistence callsite ownership: ok");
