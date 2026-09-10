"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function makeFakeIndexedDb(options = {}) {
  const databases = new Map();
  let openCalls = 0;

  function requestFor(transaction, executor) {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      if (transaction._finished) return;
      try {
        if (options.writeError && transaction.mode === "readwrite") throw options.writeError;
        request.result = executor();
        request.onsuccess?.({ target: request });
        queueMicrotask(() => transaction._complete());
      } catch (error) {
        request.error = error;
        transaction.error = error;
        request.onerror?.({ target: request });
        transaction.onerror?.({ target: transaction });
        transaction._abort(error);
      }
    });
    return request;
  }

  function makeDatabase(state) {
    let closed = false;
    return {
      get objectStoreNames() {
        return { contains: (name) => state.stores.has(String(name)) };
      },
      onversionchange: null,
      createObjectStore(name) {
        if (!state.stores.has(String(name))) state.stores.set(String(name), new Map());
        return {};
      },
      transaction(name, mode) {
        if (closed) throw new Error("Database closed");
        const storeName = String(name);
        if (!state.stores.has(storeName)) throw new Error(`Missing store ${storeName}`);
        const transaction = {
          mode,
          error: null,
          oncomplete: null,
          onabort: null,
          onerror: null,
          _finished: false,
          abort() { this._abort(this.error || new Error("aborted")); },
          _complete() {
            if (this._finished) return;
            this._finished = true;
            this.oncomplete?.({ target: this });
          },
          _abort(error) {
            if (this._finished) return;
            this._finished = true;
            this.error = error;
            this.onabort?.({ target: this });
          },
          objectStore() {
            const data = state.stores.get(storeName);
            return {
              get(key) { return requestFor(transaction, () => clone(data.get(String(key)))); },
              put(value, key) { return requestFor(transaction, () => { data.set(String(key), clone(value)); return String(key); }); },
              delete(key) { return requestFor(transaction, () => { data.delete(String(key)); return undefined; }); },
              clear() { return requestFor(transaction, () => { data.clear(); return undefined; }); },
            };
          },
        };
        return transaction;
      },
      close() { closed = true; },
    };
  }

  const factory = {
    open(name, version) {
      openCalls += 1;
      if (options.openThrows) throw options.openThrows;
      const request = { result: null, error: null, onupgradeneeded: null, onblocked: null, onerror: null, onsuccess: null };
      queueMicrotask(() => {
        if (options.blocked) {
          request.onblocked?.({ target: request });
          return;
        }
        if (options.openError) {
          request.error = options.openError;
          request.onerror?.({ target: request });
          return;
        }
        let state = databases.get(String(name));
        const oldVersion = state?.version || 0;
        if (!state) {
          state = { version: 0, stores: new Map() };
          databases.set(String(name), state);
        }
        const db = makeDatabase(state);
        request.result = db;
        if (version > oldVersion) {
          state.version = version;
          request.onupgradeneeded?.({ oldVersion, newVersion: version, target: request });
        }
        request.onsuccess?.({ target: request });
      });
      return request;
    },
    _openCalls: () => openCalls,
    _databases: databases,
  };
  return factory;
}

function loadModule(fakeIndexedDb) {
  const context = {
    globalThis: null,
    window: null,
    console,
    Error,
    TypeError,
    Object,
    Array,
    String,
    Number,
    Promise,
    JSON,
    Math,
    RegExp,
    indexedDB: fakeIndexedDb,
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/storage/permanent-indexeddb.js", "utf8"), context, { filename: "js/storage/permanent-indexeddb.js" });
  return context.PermanentIndexedDb;
}

(async function main() {
  {
    const fake = makeFakeIndexedDb();
    const api = loadModule(fake);
    assert.strictEqual(fake._openCalls(), 0, "loading the module must not open IndexedDB or mutate storage");
    assert.deepStrictEqual(Array.from(api.STORE_NAMES), ["meta", "album", "hall", "development"]);

    const db = api.create({ indexedDB: fake, databaseName: "test-db" });
    await db.open();
    assert.strictEqual(fake._openCalls(), 1);
    const state = fake._databases.get("test-db");
    assert.deepStrictEqual([...state.stores.keys()], ["meta", "album", "hall", "development"]);

    const album = { schemaVersion: 2, collections: { ie1: { unlockedPlayerIds: { p1: true } } } };
    await db.write("album", album);
    assert.deepStrictEqual(await db.read("album"), album);
    assert.strictEqual(await db.has("album"), true);

    const updated = await db.update("album", (current) => ({ ...current, revision: Number(current?.revision || 0) + 1 }));
    assert.strictEqual(updated.revision, 1, "update must return the value committed by the readwrite transaction");
    assert.strictEqual((await db.read("album")).revision, 1, "update must commit to the same singleton key");

    const replacement = { schemaVersion: 2, collections: {} };
    await db.write("album", replacement);
    assert.deepStrictEqual(await db.read("album"), replacement, "writes must replace the same singleton key");

    await db.write("meta", { complete: true }, "migration:album:v1");
    assert.deepStrictEqual(await db.read("meta", "migration:album:v1"), { complete: true });

    await db.remove("album");
    assert.strictEqual(await db.read("album"), undefined);
    assert.strictEqual(await db.has("album"), false);

    await db.write("development", { coins: 100 });
    await db.clear("development");
    assert.strictEqual(await db.read("development"), undefined);

    assert.throws(() => api._assertStoreName("shop"), (error) => error.code === "indexeddb-invalid-store");
    await assert.rejects(db.update("album", async () => ({})), (error) => error.code === "indexeddb-async-updater-not-supported");
    db.close();
  }

  {
    const fake = makeFakeIndexedDb({ blocked: true });
    const api = loadModule(fake);
    await assert.rejects(api.create({ indexedDB: fake }).open(), (error) => error.code === "indexeddb-open-blocked");
  }

  {
    const security = Object.assign(new Error("denied"), { name: "SecurityError" });
    const fake = makeFakeIndexedDb({ openThrows: security });
    const api = loadModule(fake);
    await assert.rejects(api.create({ indexedDB: fake }).open(), (error) => error.code === "storage-access-error" && error.stage === "indexeddb-open");
  }

  {
    const quota = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    const fake = makeFakeIndexedDb({ writeError: quota });
    const api = loadModule(fake);
    const db = api.create({ indexedDB: fake });
    await assert.rejects(db.write("hall", { teams: [] }), (error) => error.code === "storage-quota-exceeded" && error.storeName === "hall");
  }

  console.log("permanent-indexeddb-core-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
