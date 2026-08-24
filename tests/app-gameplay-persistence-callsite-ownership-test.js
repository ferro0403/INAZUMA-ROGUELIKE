const assert = require("assert");
const fs = require("fs");
const source = fs.readFileSync("js/app.js", "utf8");

function bodyBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `missing source range ${start}`);
  return source.slice(from, to);
}
const formation = bodyBetween("function renderFormationChoice", "function renderDraft");
assert.match(formation, /label: "initial-formation-phase"[\s\S]*mutate:/);
assert.match(formation, /label: "initial-draft-start"[\s\S]*DraftEngine\.start\(current/);
const draft = bodyBetween("function renderDraft", "function rosterCounts");
assert.match(draft, /label: "initial-draft-pick"[\s\S]*DraftEngine\.choose\(current/);
assert.match(draft, /DraftEngine\.choose\(current[\s\S]*current\.phase = "squad";[\s\S]*reconcileSquadRosterState\(current\)/);
assert.match(draft, /onCommitted:[\s\S]*completed \? renderSquad\(\) : renderDraft\(\)/);
const squadView = bodyBetween("function renderSquad()", "function replaceSquadPlayerCard");
assert.doesNotMatch(squadView, /RunState\.save|run\.phase\s*=|reconcileSquadRosterState/);
const lineup = bodyBetween("function handleSquadSelection", "function ensureCurrentZone");
assert.match(lineup, /label: "lineup-swap"[\s\S]*mutate:[\s\S]*firstList\[firstIndex\]/);
const trade = bodyBetween("function executeTrade", "function showTradeResult");
assert.match(trade, /mutate: \(current\)[\s\S]*executeProfileAwareTrade\(current/);
assert.match(trade, /mutate: \(current\)[\s\S]*current\.roster\[rosterIndex\]/);
assert.match(trade, /onMutationError:[\s\S]*trade-invalid[\s\S]*Offerta non più valida/);
const recruit = bodyBetween("function recruitPlayer", "function openBossPreviewModal");
for (const label of ["recruit-profile", "recruit", "recruit-replacement"]) assert.match(recruit, new RegExp(`label: "${label}"[\\s\\S]*?mutate: \\(current\\)`));
assert.match(recruit, /recruit-needs-replacement[\s\S]*showRecruitReplacement/);
assert.match(recruit, /committed-acquired[\s\S]*committed-upgraded[\s\S]*needs-replacement/);
assert.match(recruit, /chooseInventoryDiscardSelection[\s\S]*discardInstanceId[\s\S]*mutate: \(current\)/);
assert.doesNotMatch(recruit, /removeInventoryItem\(/);

const pull = bodyBetween("function openPull", "function openDevLegendaryPull");
assert.match(pull, /onRecover: \(\) => openPull\(node, pullType, options\)/, "normal/dev pull recovery rebuilds the authoritative flow");
assert.doesNotMatch(pull, /onRecover: \(\) => showPlayerOffer\(options\)/, "recovery must not reuse incomplete openPull options as an offer config");
const bossRewards = bodyBetween("function showNextBossReward", "function advanceBossReward");
assert.match(bossRewards, /result\.status === "cancelled"\) showNextBossReward\(\)/, "boss replacement cancel reopens the pending reward");
assert.doesNotMatch(bossRewards, /result\.status === "cancelled"\) advanceBossReward/, "boss replacement cancel never consumes a reward");
assert.match(recruit, /smartLineupResult = optimizeLineupsForNewPlayer[\s\S]*onCommitted:[\s\S]*committedSideEffects/);
const persistence = fs.readFileSync("js/gameplay-persistence.js", "utf8");
assert.match(persistence, /catch \(error\)[\s\S]*kind: "mutation"[\s\S]*onMutationError/);
assert.doesNotMatch(persistence, /kind: "mutation"[\s\S]{0,500}reportFailure\?/);
assert.doesNotMatch(source, /mutate: \(\) => \{\}/);
console.log("app gameplay persistence callsite ownership: ok");
