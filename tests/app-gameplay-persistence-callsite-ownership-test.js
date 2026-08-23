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
assert.match(draft, /onCommitted:[\s\S]*completed \? renderSquad\(\) : renderDraft\(\)/);
const lineup = bodyBetween("function handleSquadSelection", "function ensureCurrentZone");
assert.match(lineup, /label: "lineup-swap"[\s\S]*mutate:[\s\S]*firstList\[firstIndex\]/);
const trade = bodyBetween("function executeTrade", "function showTradeResult");
assert.match(trade, /mutate: \(current\)[\s\S]*executeProfileAwareTrade\(current/);
assert.match(trade, /mutate: \(current\)[\s\S]*current\.roster\[rosterIndex\]/);
const recruit = bodyBetween("function recruitPlayer", "function openBossPreviewModal");
for (const label of ["recruit-profile", "recruit", "recruit-replacement"]) assert.match(recruit, new RegExp(`label: "${label}"[\\s\\S]*?mutate: \\(current\\)`));
assert.doesNotMatch(source, /mutate: \(\) => \{\}/);
console.log("app gameplay persistence callsite ownership: ok");
