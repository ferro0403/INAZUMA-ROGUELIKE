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
  let mutationFailures = 0;
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
    reportMutationFailure: () => { mutationFailures += 1; },
  });
  return {
    persist, events,
    setFailure: (next) => { failureMode = next; },
    setUnreadable: (next) => { unreadableMode = next; },
    get runtime() { return runtime; }, get canonical() { return canonical; },
    get saveAttempts() { return saveAttempts; }, get loadAttempts() { return loadAttempts; },
    get mutationFailures() { return mutationFailures; },
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

const mutation = harness();
let mutationErrorCalls = 0;
let mutationCommits = 0;
const domainError = Object.assign(new Error("not eligible"), { code: "recruit-ineligible" });
const mutationResult = mutation.persist({
  mutate: (run) => { run.value = 99; run.inventory.pop(); throw domainError; },
  onMutationError: ({ error, stage, run, canonical }) => {
    mutationErrorCalls += 1;
    assert.strictEqual(error, domainError);
    assert.strictEqual(stage, "mutation");
    assert.strictEqual(run.value, 0);
    assert.strictEqual(canonical, undefined);
  },
  onCommitted: () => { mutationCommits += 1; },
});
assert.strictEqual(mutationResult.kind, "mutation");
assert.strictEqual(mutationResult.stage, "mutation");
assert.strictEqual(mutationResult.error, domainError, "the original diagnostic is preserved");
assert.strictEqual(mutation.saveAttempts, 0, "mutation failure never reaches save");
assert.strictEqual(mutation.loadAttempts, 0, "mutation failure does not load canonical storage");
assert.strictEqual(mutation.runtime.value, 0, "partial mutation is rolled back to before");
assert.deepStrictEqual(mutation.runtime.inventory, ["item-1"]);
assert.strictEqual(context.run, mutation.runtime, "global/runtime reference is realigned");
assert.strictEqual(mutationErrorCalls, 1);
assert.strictEqual(mutationCommits, 0);
assert.strictEqual(mutation.events.length, 0, "persistence failure reporting is reserved for save errors");
assert.strictEqual(mutation.mutationFailures, 0, "callsite callback owns an expected domain outcome");

const unexpected = harness();
unexpected.persist({ mutate: (run) => { run.value += 1; throw new Error("bug"); } });
assert.strictEqual(unexpected.mutationFailures, 1, "unexpected mutation errors use the mutation reporter");
assert.strictEqual(unexpected.saveAttempts, 0);

console.log("app gameplay persistence transactions: ok");
