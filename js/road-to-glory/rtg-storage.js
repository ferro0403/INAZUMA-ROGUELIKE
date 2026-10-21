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

    return Object.freeze({ open, read, write, update, remove, close });
  }

  global.RoadToGloryStorage = Object.freeze({ DB_NAME, DB_VERSION, STORE_NAME, DEFAULT_KEY, create });
})(globalThis);
