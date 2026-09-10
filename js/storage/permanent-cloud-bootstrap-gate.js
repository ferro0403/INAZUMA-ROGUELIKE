const global = globalThis;

async function waitForDevelopmentDatabases() {
  if (global.__INAZUMA_DEVELOPMENT_DATABASES_READY__ === true || global.__INAZUMA_DEVELOPMENT_DATABASES_FAILED__ === true) return;
  await new Promise((resolve) => {
    const done = () => resolve();
    global.addEventListener?.("inazuma:development-databases-ready", done, { once: true });
  });
}

if (global.DevelopmentIndexedDbStorage?.ensureReady) {
  let development = await global.DevelopmentIndexedDbStorage.ensureReady();
  if (development?.reason === "development-base-data-not-ready") {
    await waitForDevelopmentDatabases();
    development = await global.DevelopmentIndexedDbStorage.ensureReady();
  }
}

await import("../firebase-cloud-save.js?v=20260831-run-local-only-pr366-2");
