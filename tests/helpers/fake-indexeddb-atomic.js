"use strict";

// Transaction-aware fake used only by RTG atomic-storage regression tests.
// A readwrite transaction buffers writes until completion and discards them on
// abort, unlike the older single-request smoke-test fake.
function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeFakeIndexedDb(options = {}) {
  const databases = new Map();
  let openCalls = 0;
  let transactionCount = 0;
  function requestFor(tx, operation, key, fn) {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    tx._pending += 1;
    queueMicrotask(() => {
      if (tx._finished) return;
      try {
        if (options.writeError && tx.mode === "readwrite") throw options.writeError;
        if (operation === "put" && options.failPutKey === String(key)) {
          throw Object.assign(new Error("injected write failure"), { name: "QuotaExceededError" });
        }
        request.result = fn();
        request.onsuccess?.({ target: request });
        tx._pending -= 1;
        tx._scheduleComplete();
      } catch (error) {
        request.error = error;
        tx.error = error;
        request.onerror?.({ target: request });
        tx.onerror?.({ target: tx });
        tx._abort(error);
      }
    });
    return request;
  }
  function makeDatabase(state) {
    let closed = false;
    return {
      onversionchange: null,
      get objectStoreNames() {
        return { contains: (name) => state.stores.has(String(name)) };
      },
      createObjectStore(name) {
        if (!state.stores.has(String(name))) state.stores.set(String(name), new Map());
        return {};
      },
      transaction(name, mode) {
        if (closed) throw new Error("Database closed");
        const storeName = String(name);
        if (!state.stores.has(storeName)) throw new Error("Missing store " + storeName);
        transactionCount += 1;
        const source = state.stores.get(storeName);
        const staged = mode === "readwrite"
          ? new Map([...source].map(([key, value]) => [key, clone(value)]))
          : source;
        const tx = {
          mode, error: null, oncomplete: null, onerror: null, onabort: null,
          _pending: 0, _finished: false, _scheduled: false,
          _abort(error) {
            if (this._finished) return;
            this._finished = true;
            this.error = error;
            this.onabort?.({ target: this });
          },
          abort() { this._abort(this.error || new Error("aborted")); },
          _scheduleComplete() {
            if (this._finished || this._pending || this._scheduled) return;
            this._scheduled = true;
            queueMicrotask(() => {
              this._scheduled = false;
              if (this._finished || this._pending) return;
              this._finished = true;
              if (this.mode === "readwrite") state.stores.set(storeName, staged);
              this.oncomplete?.({ target: this });
            });
          },
          objectStore() {
            return {
              get: (key) => requestFor(tx, "get", key, () => clone(staged.get(String(key)))),
              put: (value, key) => requestFor(tx, "put", key, () => {
                staged.set(String(key), clone(value));
                return String(key);
              }),
              delete: (key) => requestFor(tx, "delete", key, () => {
                staged.delete(String(key));
              }),
              clear: () => requestFor(tx, "clear", "", () => staged.clear()),
            };
          },
        };
        return tx;
      },
      close() { closed = true; },
    };
  }
  return {
    open(name, version) {
      openCalls += 1;
      if (options.openThrows) throw options.openThrows;
      const request = {
        result: null, error: null, onupgradeneeded: null,
        onblocked: null, onerror: null, onsuccess: null,
      };
      queueMicrotask(() => {
        if (options.blocked) return request.onblocked?.({ target: request });
        if (options.openError) {
          request.error = options.openError;
          return request.onerror?.({ target: request });
        }
        let state = databases.get(String(name));
        const previousVersion = state?.version || 0;
        if (!state) {
          state = { version: 0, stores: new Map() };
          databases.set(String(name), state);
        }
        request.result = makeDatabase(state);
        if (version > previousVersion) {
          state.version = version;
          request.onupgradeneeded?.({
            oldVersion: previousVersion, newVersion: version, target: request,
          });
        }
        request.onsuccess?.({ target: request });
      });
      return request;
    },
    _openCalls: () => openCalls,
    _transactionCount: () => transactionCount,
    _databases: databases,
  };
}

module.exports = { makeFakeIndexedDb };
