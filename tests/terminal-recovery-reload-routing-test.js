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

  const legacyAuth = { status: "authenticated", uid: "legacy-u" };
  let legacyJournal = { uid: legacyAuth.uid, operationId: "hfb5b3aa3", targetCloudRevision: 9428, targetCloudCommitId: null };
  let legacyTerminal = false, abandon = 0, legacyFresh = 0, releaseLegacy, markAbandoned;
  const abandoned = new Promise(resolve => { markAbandoned = resolve; });
  const legacyOptions = {
    auth: legacyAuth,
    readJournal: () => legacyJournal,
    terminalRecoveryActive: () => legacyTerminal,
    normalAssociate: () => { throw new Error("normal association must stay fenced"); },
    abandonNonResumable: async () => { abandon += 1; legacyJournal = null; legacyTerminal = true; markAbandoned(); },
    freshComparison: () => { legacyFresh += 1; return new Promise(resolve => { releaseLegacy = resolve; }); },
    publish: () => {},
  };
  const legacyA = coordinator.route(legacyOptions);
  const legacyB = coordinator.route(legacyOptions);
  await abandoned;
  const legacyRetry = coordinator.retry(legacyOptions);
  await Promise.resolve();
  assert.equal(abandon, 1, "concurrent legacy routes abandon the non-resumable journal once");
  assert.equal(legacyFresh, 1, "bootstrap plus retry share the same terminal fresh comparison");
  assert.equal(coordinator.isRunning(legacyAuth.uid), true, "legacy terminal transition stays registered as in-flight");
  releaseLegacy({ classification: "conflict" });
  await Promise.all([legacyA, legacyB, legacyRetry]);
  assert.equal(coordinator.isRunning(legacyAuth.uid), false, "single-flight lock is released after terminal comparison");

  console.log("terminal recovery routes journal abandonment and reload/retry through one single-flight: ok");
})().catch(error => { console.error(error); process.exit(1); });
