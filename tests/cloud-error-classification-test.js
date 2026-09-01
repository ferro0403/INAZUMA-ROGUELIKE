"use strict";
const assert = require("assert"), policy = require("../js/cloud-write-failure-policy");
for (const code of ["permission-denied", "failed-precondition", "unavailable", "network-request-failed"]) { const result = policy.classifyCloudWriteFailure({ code }); assert.equal(result.status, "sync-error"); assert.equal(result.error, code); assert.equal(result.retryable, true); }
assert.deepEqual(policy.classifyCloudWriteFailure({ code: "cloud-cas-conflict" }), { status: "sync-conflict", error: "cloud-cas-conflict", retryable: false, needsManifestRefresh: true, problemSector: null });
const large = policy.classifyCloudWriteFailure({ code: "document-too-large", problemSector: "hall_index" }); assert.equal(large.status, "sync-error"); assert.equal(large.problemSector, "hall_index");
assert.equal(policy.classifyCloudWriteFailure({ code: "metadata-repair-needed" }).status, "metadata-repair-needed");
console.log("cloud production write failure classification: ok");
