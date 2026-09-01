const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/gameplay-persistence.js", "utf8"), context);

let canonical = { seasonId: "s1", phase: "draft", draft: { step: 10 }, roster: [{ playerId: "starter" }], lineup: ["starter"], bench: [] };
let runtime = structuredClone(canonical);
let failSave = false;
let unreadable = false;
let saves = 0;
let loads = 0;
let squadRenders = 0;
let albumUnlocks = 0;
let actions = 0;

const persist = context.GameplayPersistence.create({
  cloneRun: structuredClone,
  getRun: () => runtime,
  replaceRun: (next) => { runtime = next; },
  save: (next) => {
    saves += 1;
    if (failSave) throw Object.assign(new Error("quota"), { code: "quota" });
    canonical = structuredClone(next);
  },
  load: () => {
    loads += 1;
    if (unreadable) throw new Error("corrupt");
    return structuredClone(canonical);
  },
});

function finalPick() {
  return persist({
    label: "initial-draft-pick",
    mutate: (current) => {
      current.roster.push({ playerId: "final" });
      current.bench.push("final");
      current.draft.step += 1;
      current.phase = "squad";
      actions += 1;
    },
    onCommitted: () => { albumUnlocks += 1; squadRenders += 1; },
  });
}

assert.strictEqual(finalPick().ok, true);
assert.strictEqual(canonical.phase, "squad");
assert.deepStrictEqual(canonical.bench, ["final"]);
assert.strictEqual(saves, 1, "final pick and squad transition have one canonical write");
assert.strictEqual(squadRenders, 1);
assert.strictEqual(albumUnlocks, 1);
const generationAfterCommit = saves;
function renderSquadView() { squadRenders += 1; }
renderSquadView();
assert.strictEqual(saves, generationAfterCommit, "view-only squad rendering performs no second save");

canonical = { seasonId: "s1", phase: "draft", draft: { step: 10 }, roster: [{ playerId: "starter" }], lineup: ["starter"], bench: [] };
runtime = structuredClone(canonical);
failSave = true;
const beforeFailureRenders = squadRenders;
const beforeFailureUnlocks = albumUnlocks;
assert.strictEqual(finalPick().ok, false);
assert.strictEqual(runtime.phase, "draft");
assert.deepStrictEqual(runtime.roster, [{ playerId: "starter" }]);
assert.strictEqual(squadRenders, beforeFailureRenders);
assert.strictEqual(albumUnlocks, beforeFailureUnlocks);

unreadable = true;
assert.strictEqual(finalPick().kind, "unreadable");
assert.strictEqual(runtime.phase, "draft", "unreadable canonical recovery falls back to before");
assert.strictEqual(squadRenders, beforeFailureRenders);

unreadable = false;
failSave = false;
const actionsBeforeRetry = actions;
assert.strictEqual(finalPick().ok, true, "same-runtime retry succeeds");
assert.strictEqual(canonical.phase, "squad");
assert.strictEqual(canonical.roster.filter((entry) => entry.playerId === "final").length, 1);
assert.strictEqual(canonical.draft.step, 11);
assert.strictEqual(actions, actionsBeforeRetry + 1, "retry applies the action once to recovered runtime");
assert.strictEqual(squadRenders, beforeFailureRenders + 1);
assert.strictEqual(albumUnlocks, beforeFailureUnlocks + 1);
assert.strictEqual(loads, 2, "only save failures load canonical state");

console.log("draft to squad persistence: ok");
