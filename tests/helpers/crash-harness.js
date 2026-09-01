"use strict";

const clone = (value) => JSON.parse(JSON.stringify(value));

function createCrashHarness(initial) {
  let canonical = clone(initial);
  let saves = 0;
  const history = [];
  return {
    save(runtime, label, { fail = false } = {}) {
      saves += 1;
      history.push({ number: saves, label, success: !fail });
      if (fail) throw Object.assign(new Error(`Injected failure: ${label}`), { code: "INJECTED_SAVE_FAILURE" });
      canonical = clone(runtime);
      return clone(canonical);
    },
    fresh() { return clone(canonical); },
    canonical() { return clone(canonical); },
    history() { return clone(history); },
  };
}

function once(list, value) {
  if (!list.includes(value)) list.push(value);
}

module.exports = { clone, createCrashHarness, once };
