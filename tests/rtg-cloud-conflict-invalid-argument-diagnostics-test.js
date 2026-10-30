"use strict";
const cp = require("node:child_process");
if (typeof require("node:vm").SourceTextModule !== "function") {
  const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { client } = require("./helpers/rtg-cloud-client");
const { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");
const { input } = require("./helpers/rtg-cloud-fixtures");
function stop(c) { c.c.dispatchEvent(new c.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }

(async () => {
  const backend = createAuthenticatedFirestoreBackend();
  const original = await client(backend);
  const local = input();
  local.shared.tokens = 7;
  const phone = await client(backend, local);
  try {
    assert.equal(phone.api.getState().status, "local-conflict");
    const cloudBefore = structuredClone(backend.documents.get(backend.manifestPath));
    const phoneBefore = structuredClone(await phone.storage.read("shared:account"));
    backend.backend.failure = "invalid-argument";
    assert.equal(phone.api.requestConflictResolution("local"), true);
    await phone.api.resolveConflictUseLocal();
    const failure = phone.api.getState();
    assert.equal(failure.status, "sync-error");
    assert.equal(failure.error, "invalid-argument");
    assert.equal(failure.errorOrigin, "explicit-local-conflict");
    assert.equal(failure.errorStage, "staging-manifest");
    assert.deepEqual(backend.documents.get(backend.manifestPath), cloudBefore,
      "a failed upload must never publish a replacement cloud manifest");
    assert.deepEqual(structuredClone(await phone.storage.read("shared:account")), phoneBefore,
      "the attempted upload never changes local RTG data");
    backend.backend.failure = null;
    await phone.api.retryAssociation();
    assert.equal(phone.api.getState().status, "local-conflict",
      "safe recheck must return to explicit selection; never repeat cloud overwrite automatically");
    assert.deepEqual(backend.documents.get(backend.manifestPath), cloudBefore,
      "the safe recheck must not perform a cloud write");
    const ui = fs.readFileSync("js/account-ui.js", "utf8");
    assert(ui.includes('cloudState.errorOrigin === "explicit-local-conflict"'));
    assert(ui.includes('data-cloud-save-retry>RICONTROLLA I PROGRESSI'));
    assert(ui.includes("safeUploadFailureLocation()"));
    assert(!ui.includes("error?.message"), "never disclose untrusted Firebase error payloads in UI");
    console.log("rtg-cloud-conflict-invalid-argument-diagnostics-test: PASS");
  } finally {
    backend.backend.failure = null;
    stop(phone);
    stop(original);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
