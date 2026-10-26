"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const r = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(r.status ?? 1); }
const assert = require("assert"), { client } = require("./helpers/rtg-cloud-client");
const { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function stop(value) { value.c.dispatchEvent(new value.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }
async function waitFor(check) { for (let i = 0; i < 80; i++) { if (check()) return; await delay(50); } assert(check(), "committed local RTG must autosync after an overlapping upload"); }
(async () => {
  const backend = createAuthenticatedFirestoreBackend(), pc = await client(backend);
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  let once = true;
  backend.backend.beforeBatchCommit = async () => { if (once) { once = false; enter(); await held; } };
  await pc.repo.update("first", state => { state.tokens += 1; return state; });
  const upload = pc.api.syncNow(); await entered;
  await pc.repo.update("overlapping", state => { state.tokens += 2; return state; });
  await delay(2100); // Let the existing debounce expire while upload is in flight.
  release(); await upload;
  const cloudTokens = () => {
    const manifest = backend.documents.get(backend.manifestPath);
    const sector = backend.documents.get(`users/test-user/saveCommits/${manifest.cloudCommitId}/sectors/rtg`);
    return pc.c.InazumaCloudSaveCore.decodeFirestorePayload(sector.payload).shared.tokens;
  };
  try { await waitFor(() => cloudTokens() === 903); assert.equal((await pc.repo.read()).tokens, 903); }
  finally { stop(pc); }
  const phone = await client(backend);
  let enteredConflict, releaseConflict;
  const conflictEntered = new Promise(resolve => { enteredConflict = resolve; });
  const conflictHold = new Promise(resolve => { releaseConflict = resolve; });
  once = true;
  backend.backend.beforeBatchCommit = async () => { if (once) { once = false; enteredConflict(); await conflictHold; } };
  assert.equal(phone.api.requestConflictResolution("local"), true);
  const resolving = phone.api.resolveConflictUseLocal(); await conflictEntered;
  await phone.repo.update("during-explicit-choice", state => { state.tokens += 11; return state; });
  releaseConflict(); await resolving;
  try {
    assert(phone.api.getState().pendingSectors.includes("rtg"), "explicit local resolution must not clear a newer commit");
    await waitFor(() => cloudTokens() === 911);
  } finally { stop(phone); }
  console.log("rtg-cloud-concurrent-commit-test: PASS (overlapping upload, expired debounce, explicit local choice preserves newer dirt)");
})().catch(error => { console.error(error); process.exitCode = 1; });
