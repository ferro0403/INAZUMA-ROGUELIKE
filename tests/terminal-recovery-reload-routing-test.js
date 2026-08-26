"use strict";
const assert = require("assert");
const coordinator = require("../js/cloud-restore-resume-coordinator");

(async () => {
  const auth = { status: "authenticated", uid: "u" };
  let terminal = true, normal = 0, fresh = 0, concurrent = 0;
  const published = [];
  const options = {
    auth,
    readJournal: () => null,
    terminalRecoveryActive: () => terminal,
    normalAssociate: () => { normal += 1; },
    freshComparison: async () => { fresh += 1; throw Object.assign(new Error("unavailable"), { code: "unavailable" }); },
    publish: patch => published.push(patch),
  };
  const first = await coordinator.route(options);
  assert.equal(first.status, "restore-terminal-error");
  assert.equal(normal, 0, "terminal marker must bypass normal association");
  assert.equal(fresh, 1, "bootstrap routes to one fresh comparison attempt");
  assert.equal(published.at(-1).freshComparisonStatus, "retry-required");

  let release;
  const pendingOptions = { ...options, freshComparison: () => { concurrent += 1; return new Promise(resolve => { release = resolve; }); } };
  const a = coordinator.route(pendingOptions), b = coordinator.route(pendingOptions);
  await Promise.resolve();
  assert.equal(concurrent, 1, "concurrent bootstrap events share one comparison");
  release({ classification: "conflict" }); await Promise.all([a, b]);

  await coordinator.route(options);
  assert.equal(fresh, 2, "a later reload gets exactly one new retry");
  terminal = false; await coordinator.route(options);
  assert.equal(normal, 1, "normal association resumes only after terminal recovery is cleared");
  console.log("terminal marker resumes fresh comparison after reload without duplicate attempts: ok");
})().catch(error => { console.error(error); process.exit(1); });
