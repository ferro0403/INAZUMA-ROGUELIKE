"use strict";
const fs = require("fs");

const appPath = "js/app.js";
let app = fs.readFileSync(appPath, "utf8");
const start = app.indexOf("  function persistChampionBeforeFinalUi(finalBoss = null) {");
const end = app.indexOf("\n  function championTeam(", start);
if (start < 0 || end <= start) throw new Error("persistChampionBeforeFinalUi anchors not found");
const replacement = `  function persistChampionBeforeFinalUi(finalBoss = null) {
    const boss = finalBoss || seasonDb.bossOrder[Math.min(Number(run.bossIndex || 1) - 1, seasonDb.bossOrder.length - 1)] || seasonDb.bossOrder.at(-1);
    if (!run.finalization) {
      const committed = persistGameplayMutation({
        label: "champion-finalization-entry",
        mutate: (current) => {
          current.completedAt = current.completedAt || new Date().toISOString();
          const snapshot = buildChampionSnapshot(boss);
          current.phase = "finalization";
          current.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId };
          global.PermanentEffects.enqueueHall(current, snapshot);
        },
      });
      if (!committed.ok) return null;
    }
    drainPermanentEffects();
    return run.hallTeamId ? global.HallOfFameStorage.getTeam(run.hallTeamId) : null;
  }
`;
app = app.slice(0, start) + replacement + app.slice(end);
fs.writeFileSync(appPath, app);

const ciPath = ".github/workflows/stacked-regression.yml";
let ci = fs.readFileSync(ciPath, "utf8");
const testLine = "            tests/finalization-entry-persistence-hardening-test.js\n";
if (!ci.includes(testLine.trim())) {
  const anchor = "            tests/finalization-ambiguous-commit-production-test.js\n";
  if (!ci.includes(anchor)) throw new Error("CI finalization anchor not found");
  ci = ci.replace(anchor, anchor + testLine);
  fs.writeFileSync(ciPath, ci);
}
