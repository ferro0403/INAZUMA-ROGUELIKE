const assert = require("assert");
const memory = new Map();
global.localStorage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
const album = require("../js/album-progress.js");
album.configureFreeAgentIds(["free-a", "free-b"]);
album.unlockAlbumPlayer("ie1", "free-a", { source: "ie1-pull", firstUnlockedAt: "2026-01-01T00:00:00.000Z" });
assert(album.isAlbumPlayerUnlocked("ie2", "free-a"));
assert.deepEqual(album.read().collections.ie1.unlockedPlayerIds["free-a"], album.read().collections.ie2.unlockedPlayerIds["free-a"]);
album.unlockAlbumPlayer("ie2", "free-b", { source: "ie2-pull" }); assert(album.isAlbumPlayerUnlocked("ie1", "free-b"));
album.unlockAlbumPlayer("ie1", "team-only", { source: "team" }); assert(!album.isAlbumPlayerUnlocked("ie2", "team-only"));

memory.set(album.STORAGE_KEY, JSON.stringify({ collections: {
  ie1: { unlockedPlayerIds: { "free-a": { firstUnlockedAt: "2025-01-01", firstSource: "old" }, "ie1-team": { firstUnlockedAt: "2025-01-02", firstSource: "team" } } },
  ie2: { unlockedPlayerIds: { "free-b": { firstUnlockedAt: "2025-01-03", firstSource: "old" }, "ie2-team": { firstUnlockedAt: "2025-01-04", firstSource: "team" } } },
} }));
album.configureFreeAgentIds(["free-a", "free-b"]);
const migrated = album.read();
for (const id of ["free-a", "free-b"]) for (const collection of ["ie1", "ie2"]) assert(migrated.collections[collection].unlockedPlayerIds[id]);
assert(!migrated.collections.ie2.unlockedPlayerIds["ie1-team"]); assert(!migrated.collections.ie1.unlockedPlayerIds["ie2-team"]);
const serialized = JSON.stringify(migrated); album.configureFreeAgentIds(["free-a", "free-b"]); assert.equal(JSON.stringify(album.read()), serialized);
console.log("album-free-agent-sync-test: bidirectional sync and idempotent migration OK");
