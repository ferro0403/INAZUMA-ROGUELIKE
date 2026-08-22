const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/gameplay-persistence.js", "utf8"), context);

function harness({ failure = null, unreadable = false } = {}) {
  let canonical = { seasonId: "s1", value: 0, inventory: ["item-1"], roster: ["out"] };
  let runtime = structuredClone(canonical);
  const events = [];
  const persist = context.GameplayPersistence.create({
    getRun: () => runtime,
    replaceRun: (next) => { runtime = next; context.run = next; },
    save: (next) => {
      if (failure) { const error = new Error(failure); error.code = failure; throw error; }
      canonical = structuredClone(next);
    },
    load: (_season, options) => {
      assert.strictEqual(options.readOnly, true);
      if (unreadable) throw new Error("corrupt");
      return structuredClone(canonical);
    },
    stopRuntime: () => events.push("stopped"),
    reportFailure: (message, kind) => events.push([kind, message]),
  });
  return { persist, events, get runtime() { return runtime; }, get canonical() { return canonical; } };
}

const families = ["formation", "equip", "unequip", "consumable", "recruit-normal", "recruit-replacement", "initial-draft", "trade", "map-node", "life-loss"];
for (const label of families) {
  const ok = harness();
  let success = 0;
  assert.strictEqual(ok.persist({ label, mutate: (run) => { run.value += 1; }, onCommitted: () => { success += 1; } }).ok, true);
  assert.strictEqual(success, 1, `${label}: success continuation`);
  assert.strictEqual(ok.canonical.value, 1, `${label}: canonical commit`);

  const failed = harness({ failure: "quota" });
  let falseSuccess = 0;
  assert.strictEqual(failed.persist({ label, mutate: (run) => { run.value += 1; run.inventory.pop(); }, onCommitted: () => { falseSuccess += 1; } }).ok, false);
  assert.strictEqual(falseSuccess, 0, `${label}: no false success`);
  assert.strictEqual(failed.runtime.value, 0, `${label}: memory recovered`);
  assert.deepStrictEqual(failed.runtime.inventory, ["item-1"], `${label}: inventory recovered`);
  assert.strictEqual(context.run, failed.runtime, `${label}: global reference replaced`);
  failureRetry(failed, label);
}

function failureRetry(previous, label) {
  const retry = harness();
  retry.persist({ label: `${label}-retry`, mutate: (run) => { run.value += 1; } });
  assert.strictEqual(retry.canonical.value, 1, `${label}: retry exactly once`);
}

for (const code of ["stale-write", "write-locked"]) {
  const stale = harness({ failure: code });
  const result = stale.persist({ mutate: (run) => { run.roster = ["incoming"]; } });
  assert.strictEqual(result.kind, "stale");
  assert.deepStrictEqual(stale.runtime.roster, ["out"]);
  assert.match(stale.events[1][1], /altra scheda/);
}

const unreadable = harness({ failure: "quota", unreadable: true });
assert.strictEqual(unreadable.persist({ mutate: (run) => { run.value += 1; } }).kind, "unreadable");
assert.match(unreadable.events[1][1], /non è leggibile/);

console.log("app gameplay persistence transactions: ok");
