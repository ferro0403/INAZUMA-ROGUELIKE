(function (global) {
  "use strict";

  const DB_NAME = "inazumaRoadToGlory";
  const DB_VERSION = 1;
  const STORE_NAME = "campaign";
  const DEFAULT_KEY = "state";

  function isQuotaError(error) {
    return !!error && (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      Number(error.code) === 22 || Number(error.code) === 1014 ||
      /quota/i.test(String(error.code || "")) || /quota/i.test(String(error.message || ""))
    );
  }

  function wrapError(error, fallbackCode, stage, extra = {}) {
    const original = error && typeof error === "object" ? error : new Error(String(error || fallbackCode));
    let code = fallbackCode;
    if (isQuotaError(original)) code = "storage-quota-exceeded";
    else if (original.name === "SecurityError") code = "storage-access-error";
    return Object.assign(new Error(original.message || code), {
      name: original.name || "Error",
      code,
      stage,
      cause: original,
      ...extra,
    });
  }

  function create(options = {}) {
    const indexedDbFactory = options.indexedDB || global.indexedDB;
    const databaseName = options.databaseName || DB_NAME;
    const databaseVersion = Number(options.databaseVersion || DB_VERSION);
    let openPromise = null;
    let openedDatabase = null;

    function factory() {
      if (!indexedDbFactory) {
        throw Object.assign(new Error("IndexedDB non disponibile"), {
          code: "indexeddb-unavailable",
          stage: "rtg-indexeddb-open",
        });
      }
      return indexedDbFactory;
    }

    function open() {
      if (openedDatabase) return Promise.resolve(openedDatabase);
      if (openPromise) return openPromise;
      openPromise = new Promise((resolve, reject) => {
        let request;
        try {
          request = factory().open(databaseName, databaseVersion);
        } catch (error) {
          openPromise = null;
          reject(wrapError(error, "rtg-indexeddb-open-failed", "rtg-indexeddb-open"));
          return;
        }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onblocked = () => {
          openPromise = null;
          reject(Object.assign(new Error("RTG IndexedDB open blocked"), {
            code: "rtg-indexeddb-open-blocked",
            stage: "rtg-indexeddb-open",
          }));
        };
        request.onerror = () => {
          openPromise = null;
          reject(wrapError(request.error, "rtg-indexeddb-open-failed", "rtg-indexeddb-open"));
        };
        request.onsuccess = () => {
          openedDatabase = request.result;
          openedDatabase.onversionchange = () => {
            try { openedDatabase.close(); } catch (_) {}
            openedDatabase = null;
            openPromise = null;
          };
          resolve(openedDatabase);
        };
      });
      return openPromise;
    }

    async function read(key = DEFAULT_KEY) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx;
        let request;
        try {
          tx = db.transaction(STORE_NAME, "readonly");
          request = tx.objectStore(STORE_NAME).get(String(key));
        } catch (error) {
          reject(wrapError(error, "rtg-indexeddb-read-failed", "rtg-indexeddb-read"));
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(wrapError(request.error, "rtg-indexeddb-read-failed", "rtg-indexeddb-read"));
        tx.onabort = () => reject(wrapError(tx.error, "rtg-indexeddb-transaction-aborted", "rtg-indexeddb-read"));
      });
    }

    async function write(value, key = DEFAULT_KEY, options = {}) {
      return mutate([String(key)], () => ({ writes: { [key]: value }, value }), options, "rtg-indexeddb-write", "rtg-indexeddb-write-failed");
    }

    async function update(updater, key = DEFAULT_KEY, options = {}) {
      if (typeof updater !== "function") return Promise.reject(new TypeError("RTG IndexedDB updater required"));
      return mutate([String(key)], records => {
        const value = updater(records[String(key)]);
        if (value && typeof value.then === "function") throw Object.assign(new Error("Async IndexedDB updater non supportato"), { code: "rtg-indexeddb-async-updater-not-supported" });
        return { writes: { [key]: value }, value };
      }, options, "rtg-indexeddb-update");
    }

    // A coherent snapshot of related RTG records. Unlike separate reads, all
    // requests belong to the same IndexedDB readonly transaction.
    function recordKeys(keys) {
      if (!Array.isArray(keys) || !keys.length || keys.some((key) => typeof key !== "string" || !key)) {
        throw new TypeError("RTG record keys required");
      }
      return Array.from(new Set(keys));
    }

    async function readMany(keys) {
      const names = recordKeys(keys);
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx, settled = false;
        const values = Object.create(null);
        const fail = (error) => {
          if (settled) return;
          settled = true;
          reject(wrapError(error, "rtg-indexeddb-read-failed", "rtg-indexeddb-read-many"));
        };
        try {
          tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          tx.oncomplete = () => { if (!settled) { settled = true; resolve(values); } };
          tx.onerror = () => fail(tx.error);
          tx.onabort = () => fail(tx.error);
          for (const name of names) {
            const request = store.get(name);
            request.onsuccess = () => { values[name] = request.result; };
            request.onerror = () => fail(request.error);
          }
        } catch (error) {
          if (tx) { try { tx.abort(); } catch (_) {} }
          fail(error);
        }
      });
    }

    // Update several records within one IDB readwrite transaction. The
    // updater is synchronous and returns { writes: { key: value }, value }.
    // A failed read, updater, put or commit aborts the entire logical change.
    async function updateMany(keys, updater, options = {}) {
      if (typeof updater !== "function") return Promise.reject(new TypeError("RTG multi-record updater required"));
      return mutate(recordKeys(keys), updater, options);
    }

    async function mutate(names, updater, options, mutationStage = "rtg-indexeddb-update-many", fallbackCode = "rtg-indexeddb-update-failed") {
      const runtime = global.RoadToGloryPersistence;
      const generation = runtime?.capture();
      const writeOptions = { expectedRtgGeneration: generation, ...options };
      // Reserve before the first await, then fence again at every transaction
      // boundary. Neither a completed restore nor another tab resets this token.
      const check = () => {
        runtime?.assertGeneration(generation);
        (runtime || global.PersistenceRecoveryGuard)?.assertWritable(writeOptions);
      };
      check();
      (runtime || global.PersistenceRecoveryGuard)?.reserve(writeOptions);
      const db = await open();
      check();
      return new Promise((resolve, reject) => {
        let tx, settled = false, lastError = null, output;
        const values = Object.create(null);
        const allowed = new Set(names);
        let remaining = names.length;
        const cleanup = () => {
          global.removeEventListener?.("inazuma:rtg-restore-generation-changed", onFence);
          global.removeEventListener?.("storage", onFence);
        };
        const fail = (error, stage = mutationStage, code = fallbackCode) => {
          if (settled) return;
          lastError = typeof error?.code === "string" && !isQuotaError(error) ? error : wrapError(error, code, stage);
          settled = true;
          cleanup();
          try { tx?.abort(); } catch (_) {}
          reject(lastError);
        };
        const onFence = () => { try { check(); } catch (error) { fail(error); } };
        try {
          check();
          tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          global.addEventListener?.("inazuma:rtg-restore-generation-changed", onFence);
          global.addEventListener?.("storage", onFence);
          tx.oncomplete = () => {
            if (settled) return;
            try { check(); } catch (error) { fail(error); return; }
            settled = true;
            cleanup();
            if (!options.suppressCloudEvent && !options.restoreOwnershipToken) {
              // Cloud listeners never determine the outcome of local gameplay.
              try {
                if (typeof global.CustomEvent === "function") global.dispatchEvent?.(new global.CustomEvent("inazuma:local-save-committed", { detail: { domain: "account-permanent", sector: "rtg" } }));
              } catch (_) {}
            }
            resolve(output);
          };
          tx.onerror = () => fail(tx.error);
          tx.onabort = () => fail(lastError || tx.error || new Error("RTG transaction aborted"));
          for (const name of names) {
            const request = store.get(name);
            request.onerror = () => fail(request.error, mutationStage === "rtg-indexeddb-update-many" ? "rtg-indexeddb-update-many-read" : mutationStage, mutationStage === "rtg-indexeddb-update" ? "rtg-indexeddb-read-failed" : fallbackCode);
            request.onsuccess = () => {
              if (settled) return;
              values[name] = request.result;
              if (--remaining !== 0) return;
              try {
                check();
                const mutation = updater(values);
                if (mutation && typeof mutation.then === "function") throw Object.assign(new Error("Async RTG multi-record updater not supported"), { code: "rtg-indexeddb-async-updater-not-supported" });
                if (!mutation || !mutation.writes || typeof mutation.writes !== "object" || Array.isArray(mutation.writes)) throw new TypeError("RTG multi-record updater must return { writes, value }");
                const writes = Object.entries(mutation.writes);
                const deletes = mutation.deletes || [];
                if ((!writes.length && !deletes.length) || [...writes.map(([key]) => key), ...deletes].some(key => !allowed.has(key))) throw new TypeError("RTG multi-record update keys invalid");
                check();
                output = mutation.value;
                for (const [key, value] of writes) {
                  check();
                  const write = store.put(value, key);
                  write.onerror = () => fail(write.error, "rtg-indexeddb-update-many-write");
                  write.onsuccess = onFence;
                }
                for (const key of deletes) {
                  check();
                  const request = store.delete(key);
                  request.onerror = () => fail(request.error, "rtg-indexeddb-delete");
                  request.onsuccess = onFence;
                }
              } catch (error) { fail(error); }
            };
          }
        } catch (error) { fail(error); }
      });
    }

    async function remove(key = DEFAULT_KEY, options = {}) {
      return mutate([String(key)], () => ({ writes: {}, deletes: [String(key)], value: true }), options, "rtg-indexeddb-delete", "rtg-indexeddb-delete-failed");
    }

    function close() {
      if (openedDatabase) {
        try { openedDatabase.close(); } catch (_) {}
      }
      openedDatabase = null;
      openPromise = null;
    }

    return Object.freeze({ open, read, readMany, write, update, updateMany, remove, close });
  }

  global.RoadToGloryStorage = Object.freeze({ DB_NAME, DB_VERSION, STORE_NAME, DEFAULT_KEY, create });
})(globalThis);
