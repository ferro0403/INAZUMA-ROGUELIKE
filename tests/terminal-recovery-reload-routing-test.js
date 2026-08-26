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

  let journal = { uid: "legacy-u", operationId: "hfb5b3aa3", stage: "run-ie1", targetCloudRevision: 9428, targetCloudCommitId: null }, abandoned = 0, compared = 0, releaseLegacy;
  const legacyOptions = { auth: { status: "authenticated", uid: "legacy-u" }, readJournal: () => journal, terminalRecoveryActive: () => journal === null, abandonNonResumable: async () => { abandoned += 1; journal = null; }, freshComparison: () => { compared += 1; return new Promise(resolve => { releaseLegacy = resolve; }); } };
  const legacyA = coordinator.route(legacyOptions), legacyB = coordinator.route(legacyOptions);
  await Promise.resolve(); await Promise.resolve();
  const legacyRetry = coordinator.retry(legacyOptions);
  assert.equal(coordinator.isRunning("legacy-u"), true); assert.equal(abandoned, 1); assert.equal(compared, 1);
  const sharedResult = { classification: "conflict" }; releaseLegacy(sharedResult);
  assert.deepEqual(await legacyA, sharedResult); assert.deepEqual(await legacyB, sharedResult); assert.deepEqual(await legacyRetry, sharedResult);
  assert.equal(coordinator.isRunning("legacy-u"), false); assert.equal(abandoned, 1); assert.equal(compared, 1);

  let failedCalls = 0, failedRelease; const failedPatches = [];
  const failedOptions = { auth: { status: "authenticated", uid: "failed-u" }, readJournal: () => null, terminalRecoveryActive: () => true, freshComparison: () => { failedCalls += 1; return new Promise((_resolve, reject) => { failedRelease = reject; }); }, publish: patch => failedPatches.push(patch) };
  const failedA = coordinator.route(failedOptions), failedB = coordinator.retry(failedOptions); await Promise.resolve(); failedRelease(Object.assign(new Error("unavailable"), { code: "unavailable" }));
  const [failedResultA, failedResultB] = await Promise.all([failedA, failedB]); assert.deepEqual(failedResultA, failedResultB); assert.equal(failedCalls, 1); assert.equal(failedPatches.length, 1); assert.equal(failedPatches[0].freshComparisonStatus, "retry-required");

  let blocked = true, successCalls = 0, successRelease;
  const successOptions = { auth: { status: "authenticated", uid: "success-u" }, readJournal: () => null, terminalRecoveryActive: () => blocked, freshComparison: () => { successCalls += 1; return new Promise(resolve => { successRelease = () => { blocked = false; resolve({ classification: "equivalent" }); }; }); } };
  const successA = coordinator.route(successOptions), successB = coordinator.retry(successOptions); await Promise.resolve(); successRelease(); await Promise.all([successA, successB]); await Promise.resolve(); assert.equal(successCalls, 1); assert.equal(blocked, false); assert.equal(coordinator.isRunning("success-u"), false);
  console.log("terminal marker resumes fresh comparison after reload without duplicate attempts: ok");
})().catch(error => { console.error(error); process.exit(1); });
