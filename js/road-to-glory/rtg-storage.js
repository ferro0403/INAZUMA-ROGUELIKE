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
    const original = error instanceof Error ? error : new Error(String(error || fallbackCode));
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

    async function write(value, key = DEFAULT_KEY) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx;
        let request;
        try {
          tx = db.transaction(STORE_NAME, "readwrite");
          request = tx.objectStore(STORE_NAME).put(value, String(key));
        } catch (error) {
          reject(wrapError(error, "rtg-indexeddb-write-failed", "rtg-indexeddb-write"));
          return;
        }
        request.onerror = () => reject(wrapError(request.error, "rtg-indexeddb-write-failed", "rtg-indexeddb-write"));
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(wrapError(tx.error, "rtg-indexeddb-write-failed", "rtg-indexeddb-write"));
        tx.onabort = () => reject(wrapError(tx.error, "rtg-indexeddb-transaction-aborted", "rtg-indexeddb-write"));
      });
    }

    async function update(updater, key = DEFAULT_KEY) {
      if (typeof updater !== "function") throw new TypeError("RTG IndexedDB updater required");
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx;
        let nextValue;
        let settled = false;
        try {
          tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const getRequest = store.get(String(key));
          getRequest.onerror = () => {
            if (settled) return;
            settled = true;
            reject(wrapError(getRequest.error, "rtg-indexeddb-read-failed", "rtg-indexeddb-update"));
          };
          getRequest.onsuccess = () => {
            try {
              nextValue = updater(getRequest.result);
              if (nextValue && typeof nextValue.then === "function") {
                throw Object.assign(new Error("Async IndexedDB updater non supportato"), {
                  code: "rtg-indexeddb-async-updater-not-supported",
                  stage: "rtg-indexeddb-update",
                });
              }
              const putRequest = store.put(nextValue, String(key));
              putRequest.onerror = () => {
                if (settled) return;
                settled = true;
                reject(wrapError(putRequest.error, "rtg-indexeddb-write-failed", "rtg-indexeddb-update"));
              };
            } catch (error) {
              if (settled) return;
              settled = true;
              reject(error?.code ? error : wrapError(error, "rtg-indexeddb-update-failed", "rtg-indexeddb-update"));
              try { tx.abort(); } catch (_) {}
            }
          };
        } catch (error) {
          reject(wrapError(error, "rtg-indexeddb-update-failed", "rtg-indexeddb-update"));
          return;
        }
        tx.oncomplete = () => { if (!settled) { settled = true; resolve(nextValue); } };
        tx.onerror = () => {
          if (settled) return;
          settled = true;
          reject(wrapError(tx.error, "rtg-indexeddb-update-failed", "rtg-indexeddb-update"));
        };
        tx.onabort = () => {
          if (settled) return;
          settled = true;
          reject(wrapError(tx.error, "rtg-indexeddb-transaction-aborted", "rtg-indexeddb-update"));
        };
      });
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
    async function updateMany(keys, updater) {
      if (typeof updater !== "function") throw new TypeError("RTG multi-record updater required");
      const names = recordKeys(keys);
      const allowed = new Set(names);
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx, settled = false, lastError = null, output;
        const values = Object.create(null);
        let remaining = names.length;
        const fail = (error, stage = "rtg-indexeddb-update-many") => {
          if (settled) return;
          lastError = error?.code ? error : wrapError(error, "rtg-indexeddb-update-failed", stage);
          try { tx?.abort(); } catch (_) {}
          settled = true;
          reject(lastError);
        };
        try {
          tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          tx.oncomplete = () => { if (!settled) { settled = true; resolve(output); } };
          tx.onerror = () => {
            if (!lastError) lastError = wrapError(tx.error, "rtg-indexeddb-update-failed", "rtg-indexeddb-update-many");
          };
          tx.onabort = () => fail(lastError || tx.error || new Error("RTG transaction aborted"));
          for (const name of names) {
            const request = store.get(name);
            request.onerror = () => fail(request.error, "rtg-indexeddb-update-many-read");
            request.onsuccess = () => {
              if (settled) return;
              values[name] = request.result;
              if (--remaining !== 0) return;
              try {
                const mutation = updater(values);
                if (mutation && typeof mutation.then === "function") {
                  throw Object.assign(new Error("Async RTG multi-record updater not supported"), {
                    code: "rtg-indexeddb-async-updater-not-supported",
                    stage: "rtg-indexeddb-update-many",
                  });
                }
                if (!mutation || !mutation.writes || typeof mutation.writes !== "object" || Array.isArray(mutation.writes)) {
                  throw new TypeError("RTG multi-record updater must return { writes, value }");
                }
                const writes = Object.entries(mutation.writes);
                if (!writes.length || writes.some(([key]) => !allowed.has(key))) {
                  throw new TypeError("RTG multi-record update keys invalid");
                }
                output = mutation.value;
                for (const [key, value] of writes) {
                  const write = store.put(value, key);
                  write.onerror = () => fail(write.error, "rtg-indexeddb-update-many-write");
                }
              } catch (error) { fail(error); }
            };
          }
        } catch (error) { fail(error); }
      });
    }

    async function remove(key = DEFAULT_KEY) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(String(key));
        } catch (error) {
          reject(wrapError(error, "rtg-indexeddb-delete-failed", "rtg-indexeddb-delete"));
          return;
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(wrapError(tx.error, "rtg-indexeddb-delete-failed", "rtg-indexeddb-delete"));
        tx.onabort = () => reject(wrapError(tx.error, "rtg-indexeddb-transaction-aborted", "rtg-indexeddb-delete"));
      });
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
