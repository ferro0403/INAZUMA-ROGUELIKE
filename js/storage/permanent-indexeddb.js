(function (global) {
  "use strict";

  const DB_NAME = "inazumaRoguelikePermanent";
  const DB_VERSION = 1;
  const DEFAULT_RECORD_KEY = "state";
  const STORE_NAMES = Object.freeze(["meta", "album", "hall", "development"]);

  function isQuotaError(error) {
    return !!error && (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      Number(error.code) === 22 ||
      Number(error.code) === 1014 ||
      /quota/i.test(String(error.code || "")) ||
      /quota/i.test(String(error.message || ""))
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

  function assertStoreName(storeName) {
    const name = String(storeName || "");
    if (!STORE_NAMES.includes(name)) {
      throw Object.assign(new Error(`IndexedDB store non valido: ${name || "(vuoto)"}`), {
        code: "indexeddb-invalid-store",
        stage: "indexeddb-store-validation",
        storeName: name,
      });
    }
    return name;
  }

  function create(options = {}) {
    const indexedDbFactory = options.indexedDB || global.indexedDB;
    const databaseName = options.databaseName || DB_NAME;
    const databaseVersion = Number(options.databaseVersion || DB_VERSION);
    let openPromise = null;
    let openedDatabase = null;

    function factory() {
      if (!indexedDbFactory || typeof indexedDbFactory.open !== "function") {
        throw Object.assign(new Error("IndexedDB non disponibile in questo browser"), {
          code: "indexeddb-unavailable",
          stage: "indexeddb-open",
        });
      }
      return indexedDbFactory;
    }

    function open() {
      if (openedDatabase) return Promise.resolve(openedDatabase);
      if (openPromise) return openPromise;

      openPromise = new Promise((resolve, reject) => {
        let request;
        let blocked = false;
        try {
          request = factory().open(databaseName, databaseVersion);
        } catch (error) {
          reject(wrapError(error, "indexeddb-open-failed", "indexeddb-open"));
          return;
        }

        request.onupgradeneeded = () => {
          const db = request.result;
          STORE_NAMES.forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
          });
        };

        request.onblocked = () => {
          blocked = true;
          reject(Object.assign(new Error("Apertura IndexedDB bloccata da un'altra versione della pagina"), {
            code: "indexeddb-open-blocked",
            stage: "indexeddb-open",
          }));
        };

        request.onerror = () => {
          reject(wrapError(request.error, "indexeddb-open-failed", "indexeddb-open"));
        };

        request.onsuccess = () => {
          const db = request.result;
          if (blocked) {
            try { db.close(); } catch (_) {}
            return;
          }
          openedDatabase = db;
          openedDatabase.onversionchange = () => {
            try { openedDatabase.close(); } catch (_) {}
            openedDatabase = null;
            openPromise = null;
          };
          resolve(openedDatabase);
        };
      }).catch((error) => {
        openPromise = null;
        throw error;
      });

      return openPromise;
    }

    function close() {
      if (openedDatabase) {
        try { openedDatabase.close(); } catch (_) {}
      }
      openedDatabase = null;
      openPromise = null;
    }

    async function requestInStore(storeName, mode, operation, stage) {
      const name = assertStoreName(storeName);
      const db = await open();
      return new Promise((resolve, reject) => {
        let transaction;
        let request;
        let requestResult;
        let settled = false;

        const fail = (error, fallback = "indexeddb-transaction-failed") => {
          if (settled) return;
          settled = true;
          reject(wrapError(error, fallback, stage, { storeName: name }));
        };

        try {
          transaction = db.transaction(name, mode);
          request = operation(transaction.objectStore(name));
        } catch (error) {
          fail(error);
          return;
        }

        if (request && typeof request === "object") {
          request.onsuccess = () => { requestResult = request.result; };
          request.onerror = () => {
            requestResult = undefined;
          };
        }

        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(requestResult);
        };
        transaction.onabort = () => fail(transaction.error || request?.error, "indexeddb-transaction-aborted");
        transaction.onerror = () => {
          // IndexedDB normally follows this with `abort`; let `onabort` own the rejection.
        };
      });
    }

    function read(storeName, key = DEFAULT_RECORD_KEY) {
      return requestInStore(storeName, "readonly", (store) => store.get(String(key)), `indexeddb-${storeName}-read`);
    }

    async function write(storeName, value, key = DEFAULT_RECORD_KEY) {
      await requestInStore(storeName, "readwrite", (store) => store.put(value, String(key)), `indexeddb-${storeName}-write`);
      return value;
    }

    async function remove(storeName, key = DEFAULT_RECORD_KEY) {
      await requestInStore(storeName, "readwrite", (store) => store.delete(String(key)), `indexeddb-${storeName}-delete`);
      return true;
    }

    async function clear(storeName) {
      await requestInStore(storeName, "readwrite", (store) => store.clear(), `indexeddb-${storeName}-clear`);
      return true;
    }

    async function has(storeName, key = DEFAULT_RECORD_KEY) {
      return (await read(storeName, key)) !== undefined;
    }

    return Object.freeze({
      open,
      close,
      read,
      write,
      remove,
      clear,
      has,
      databaseName,
      databaseVersion,
      storeNames: STORE_NAMES,
    });
  }

  const defaultInstance = create();
  const api = Object.freeze({
    DB_NAME,
    DB_VERSION,
    DEFAULT_RECORD_KEY,
    STORE_NAMES,
    create,
    open: (...args) => defaultInstance.open(...args),
    close: (...args) => defaultInstance.close(...args),
    read: (...args) => defaultInstance.read(...args),
    write: (...args) => defaultInstance.write(...args),
    remove: (...args) => defaultInstance.remove(...args),
    clear: (...args) => defaultInstance.clear(...args),
    has: (...args) => defaultInstance.has(...args),
    _wrapError: wrapError,
    _assertStoreName: assertStoreName,
  });

  global.PermanentIndexedDb = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
