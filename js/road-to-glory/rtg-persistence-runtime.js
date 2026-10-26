(function (global) {
  "use strict";

  // Shared across tabs and auth sessions. Completed generations remain durable
  // so callbacks captured before a restore cannot become writable again.
  const FENCE_KEY = "inazuma.rtg.restore-fence.v1";
  const GENERATION_EVENT = "inazuma:rtg-restore-generation-changed";
  function fail(code, extra = {}) {
    return Object.assign(new Error(code), { code, ...extra });
  }
  function storageError(error) {
    return global.PersistenceRecoveryGuard?.classifyStorageError?.(error, "storage-access-error", "rtg-restore-fence") ||
      fail(error?.name === "QuotaExceededError" ? "storage-quota-exceeded" : "storage-access-error", { cause: error });
  }
  function readFence() {
    let raw;
    try { raw = global.localStorage?.getItem(FENCE_KEY); }
    catch (error) { throw storageError(error); }
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value.generation !== "string" || !value.generation ||
          typeof value.uid !== "string" || !value.uid || typeof value.active !== "boolean") throw new Error("Invalid RTG fence");
      return value;
    } catch (error) { throw fail("restore-recovery-required", { cause: error }); }
  }
  function capture() { return readFence()?.generation || null; }
  function assertGeneration(token) {
    if (token !== capture()) throw fail("rtg-stale-runtime");
    return true;
  }
  function assertWritable(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, "expectedRtgGeneration")) assertGeneration(options.expectedRtgGeneration);
    global.PersistenceRecoveryGuard?.assertWritable(options);
    const fence = readFence();
    if (fence?.active && options.restoreOwnershipToken !== fence.generation) {
      throw fail(options.restoreOwnershipToken ? "restore-ownership-lost" : "restore-recovery-required", { operationId: fence.generation });
    }
    if (options.restoreOwnershipToken && fence && (!fence.active || options.restoreOwnershipToken !== fence.generation)) throw fail("restore-ownership-lost");
    return true;
  }
  function reserve(options = {}) {
    assertWritable(options);
    return global.PersistenceRecoveryGuard?.reserve(options);
  }
  function persist(value) {
    try { global.localStorage.setItem(FENCE_KEY, JSON.stringify(value)); }
    catch (error) { throw storageError(error); }
    if (typeof global.CustomEvent === "function") global.dispatchEvent?.(new global.CustomEvent(GENERATION_EVENT, { detail: value }));
    return value.generation;
  }
  function beginRestore(journal) {
    if (!journal?.operationId || !journal?.uid) throw fail("restore-ownership-lost");
    const previous = readFence();
    if (previous?.generation === journal.operationId && previous.uid === journal.uid) return previous.generation;
    if (previous?.active) throw fail("restore-ownership-lost");
    return persist({ generation: journal.operationId, uid: journal.uid, active: true });
  }
  function completeRestore(journal) {
    const fence = readFence();
    if (!fence || fence.generation !== journal?.operationId || fence.uid !== journal?.uid) throw fail("restore-ownership-lost");
    return fence.active ? persist({ ...fence, active: false }) : fence.generation;
  }

  // Keep controller instances and their child controllers bound to the
  // campaign generation they loaded. Only an explicit open may refresh it.
  function createControllerFence({ repository: source, onInvalidate } = {}) {
    let generation = capture(), invalid = false;
    function invalidate() { invalid = true; onInvalidate?.(); }
    function assertCurrent() {
      try { assertGeneration(generation); }
      catch (error) { invalidate(); throw error; }
      if (invalid) throw fail("rtg-stale-runtime");
    }
    function checkpoint() {
      assertCurrent();
      const token = generation;
      return () => { assertGeneration(token); assertCurrent(); };
    }
    function bindRepository(token) {
      const check = () => { assertGeneration(token); assertCurrent(); };
      return Object.freeze({
        ...source,
        async read(...args) {
          check(); const value = await source.read(...args); check(); return value;
        },
        async ensureCampaign(options = {}) {
          check();
          const value = await source.ensureCampaign({ ...options, expectedRtgGeneration: token });
          check(); return value;
        },
        async update(label, updater, options = {}) {
          check();
          const value = await source.update(label, current => { check(); return updater(current); }, { ...options, expectedRtgGeneration: token });
          check(); return value;
        },
      });
    }
    let repository = bindRepository(generation);
    function reopen() {
      assertWritable();
      const next = capture();
      if (invalid || next !== generation) {
        invalidate(); generation = next; invalid = false;
        repository = bindRepository(generation);
      }
      return repository;
    }
    function onGenerationChanged() {
      try { if (capture() !== generation) invalidate(); }
      catch (_) { invalidate(); }
    }
    global.addEventListener?.(GENERATION_EVENT, onGenerationChanged);
    global.addEventListener?.("storage", onGenerationChanged);
    return Object.freeze({ assertCurrent, checkpoint, reopen, get repository() { return repository; } });
  }
  const api = Object.freeze({ FENCE_KEY, GENERATION_EVENT, capture, assertGeneration, assertWritable, reserve, beginRestore, completeRestore, createControllerFence });
  global.RoadToGloryPersistence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
