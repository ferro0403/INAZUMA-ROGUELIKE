const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/gameplay-persistence.js", "utf8"), context);

function harness({ failure = null, unreadable = false } = {}) {
  let failureMode = failure;
  let unreadableMode = unreadable;
  let canonical = { seasonId: "s1", value: 0, inventory: ["item-1"], roster: ["out"], lineup: ["out"], bench: ["reserve"] };
  let runtime = structuredClone(canonical);
  let saveAttempts = 0;
  let loadAttempts = 0;
  const events = [];
  const persist = context.GameplayPersistence.create({
    cloneRun: structuredClone,
    getRun: () => runtime,
    replaceRun: (next) => { runtime = next; context.run = next; },
    save: (next) => {
      saveAttempts += 1;
      if (failureMode) { const error = new Error(failureMode); error.code = failureMode; throw error; }
      canonical = structuredClone(next);
    },
    load: (_season, options) => {
      loadAttempts += 1;
      assert.strictEqual(options.readOnly, true);
      if (unreadableMode) throw new Error("corrupt");
      return structuredClone(canonical);
    },
    stopRuntime: () => events.push("stopped"),
    reportFailure: (message, kind) => events.push([kind, message]),
  });
  return {
    persist, events,
    setFailure: (next) => { failureMode = next; },
    setUnreadable: (next) => { unreadableMode = next; },
    get runtime() { return runtime; }, get canonical() { return canonical; },
    get saveAttempts() { return saveAttempts; }, get loadAttempts() { return loadAttempts; },
  };
}

const families = ["formation", "draft-start", "draft-completion", "consumable", "recruit-normal", "recruit-replacement", "trade", "lineup-swap"];
for (const label of families) {
  const h = harness({ failure: "quota" });
  let success = 0;
  const action = () => h.persist({ label, mutate: (run) => { run.value += 1; run.inventory.pop(); }, onCommitted: () => { success += 1; } });
  assert.strictEqual(action().ok, false);
  assert.strictEqual(success, 0, `${label}: no false success`);
  assert.strictEqual(h.runtime.value, 0, `${label}: memory recovered`);
  assert.deepStrictEqual(h.runtime.inventory, ["item-1"], `${label}: inventory recovered`);
  assert.strictEqual(context.run, h.runtime, `${label}: global reference replaced`);
  h.setFailure(null);
  assert.strictEqual(action().ok, true, `${label}: same-runtime retry succeeds`);
  assert.strictEqual(h.canonical.value, 1, `${label}: retry effect exactly once`);
  assert.deepStrictEqual(h.canonical.inventory, [], `${label}: retry removal exactly once`);
  assert.strictEqual(success, 1, `${label}: continuation exactly once`);
}

for (const code of ["stale-write", "write-locked"]) {
  const stale = harness({ failure: code });
  const result = stale.persist({ mutate: (run) => { run.roster = ["incoming"]; } });
  assert.strictEqual(result.kind, "stale");
  assert.deepStrictEqual(stale.runtime.roster, ["out"]);
}

const unreadable = harness({ failure: "quota", unreadable: true });
let committed = 0;
const result = unreadable.persist({ mutate: (run) => { run.value += 1; run.inventory.pop(); }, onCommitted: () => { committed += 1; } });
assert.strictEqual(result.kind, "unreadable");
assert.strictEqual(result.canonical, null);
assert.strictEqual(unreadable.runtime.value, 0);
assert.deepStrictEqual(unreadable.runtime.inventory, ["item-1"]);
assert.strictEqual(context.run, unreadable.runtime);
assert.strictEqual(committed, 0);
assert.strictEqual(unreadable.saveAttempts, 1, "fallback is not written back");
assert.strictEqual(unreadable.loadAttempts, 1, "only read-only recovery is attempted");
assert.match(unreadable.events[1][1], /non è leggibile/);

console.log("app gameplay persistence transactions: ok");
