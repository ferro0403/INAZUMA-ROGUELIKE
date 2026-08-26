"use strict";

const fs = require("fs");
const vm = require("vm");

function snapshot(value) {
  return { exists: () => value !== undefined, data: () => structuredClone(value) };
}

function pathOf(ref) { return ref.path.join("/"); }

function createAuthenticatedFirestoreBackend() {
  const records = { stagedCommits: [], manifestReads: 0, casAttempts: 0, uploadedSectors: [], failures: [] };
  const documents = new Map();
  const backend = { failure: null, conflictOnce: false };
  const manifestPath = "users/test-user/cloudSave/manifest";
  return { backend, records, documents, manifestPath };
}

async function attachAuthenticatedCloud(context, options = {}) {
  const backendState = options.backendState || createAuthenticatedFirestoreBackend();
  const { backend, records, documents, manifestPath } = backendState;
  const maybeFail = stage => {
    if (!backend.failure) return;
    const error = Object.assign(new Error(backend.failure), { code: backend.failure });
    records.failures.push({ stage, code: backend.failure });
    throw error;
  };
  const doc = (_db, ...path) => ({ path });
  const read = async ref => {
    if (pathOf(ref) === manifestPath) records.manifestReads += 1;
    return snapshot(documents.get(pathOf(ref)));
  };
  const writeBatch = () => {
    const writes = [];
    return {
      set(ref, value) { writes.push(["set", ref, structuredClone(value)]); },
      delete(ref) { writes.push(["delete", ref]); },
      async commit() {
        maybeFail("batch.commit");
        for (const [operation, ref, value] of writes) {
          const path = pathOf(ref);
          if (operation === "delete") documents.delete(path); else documents.set(path, value);
          const commit = path.match(/saveCommits\/([^/]+)/)?.[1];
          if (commit) records.stagedCommits.push({ commitId: commit, path });
          const sector = path.match(/\/sectors\/([^/]+)$/)?.[1];
          if (sector) records.uploadedSectors.push(sector);
        }
      },
    };
  };
  const runTransaction = async (_db, callback) => {
    records.casAttempts += 1;
    maybeFail("transaction");
    const staged = [];
    await callback({
      get: async ref => {
        if (backend.conflictOnce) {
          backend.conflictOnce = false;
          const proposed = [...documents.entries()].filter(([key]) => key.includes("/metadata/manifest")).at(-1)?.[1];
          const competing = structuredClone(proposed);
          competing.cloudCommitId = "competing-server-commit";
          competing.sectorHashes.run_orion = "0".repeat(64);
          documents.set(manifestPath, competing);
        }
        return snapshot(documents.get(pathOf(ref)));
      },
      set(ref, value) { staged.push([ref, structuredClone(value)]); },
    });
    for (const [ref, value] of staged) documents.set(pathOf(ref), value);
  };

  const productionCore = require("../../js/cloud-save-core");
  Object.assign(context, {
    InazumaCloudSaveCore: Object.freeze({ ...productionCore, readLocalSnapshot: () => productionCore.readLocalSnapshot(context) }),
    InazumaCloudLocalMetadata: require("../../js/cloud-local-metadata"),
    InazumaCloudSyncProtocol: require("../../js/cloud-sync-protocol"),
    InazumaCloudMetadataProtocol: require("../../js/cloud-metadata-protocol"),
    InazumaCloudRestoreProtocol: require("../../js/cloud-restore-protocol"),
    InazumaRestoreRunReplacementPolicy: require("../../js/restore-run-replacement-policy"),
    InazumaCloudWriteFailurePolicy: require("../../js/cloud-write-failure-policy"),
    CloudRestoreResumeCoordinator: { route: ({ normalAssociate }) => normalAssociate(), retry: () => null },
    PersistenceBootstrapGate: { markAuth() {}, notify() {} },
    InazumaAccount: {
      ready: Promise.resolve(),
      getState: () => ({ status: "authenticated", uid: "test-user", profileComplete: true }),
      getFirestoreInstance: () => ({ mock: true }),
    },
  });
  const firebase = new vm.SyntheticModule(["doc", "getDoc", "getDocFromServer", "writeBatch", "runTransaction", "serverTimestamp"], function () {
    this.setExport("doc", doc); this.setExport("getDoc", read); this.setExport("getDocFromServer", read);
    this.setExport("writeBatch", writeBatch); this.setExport("runTransaction", runTransaction);
    this.setExport("serverTimestamp", () => "server-time");
  }, { context });
  const cloud = new vm.SourceTextModule(fs.readFileSync("js/firebase-cloud-save.js", "utf8"), { context, identifier: "firebase-cloud-save.js" });
  await cloud.link(() => firebase); await firebase.evaluate(); await cloud.evaluate(); await context.InazumaCloudSave.ready;
  await context.InazumaCloudSave.retryAssociation();
  return { ...backendState, api: context.InazumaCloudSave };
}

module.exports = { createAuthenticatedFirestoreBackend, attachAuthenticatedCloud };
