# Road to Glory Season 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the isolated, local-only RTG Season 1 domain foundation: immutable config, dedicated IndexedDB storage, schema-versioned campaign state, Free Agent access gate, canonical player resolution, and zero-write load-order wiring.

**Architecture:** RTG lives under `js/road-to-glory/` and never writes into normal run storage, permanent account stores, or cloud. One dedicated IndexedDB database contains one authoritative campaign aggregate so future gameplay actions can mutate state atomically. Existing Album unlock state is read-only input for RTG Free Agent entitlement.

**Tech Stack:** Vanilla JavaScript IIFE modules, browser IndexedDB, Node 22 `assert`/`vm` tests, existing `SeasonRegistry`, `ProfiledSeasonRuntime`, `PlayerIdentity`, `AlbumProgress`, and `MatchMoveRuntime`.

**Spec:** `docs/superpowers/specs/2026-09-16-road-to-glory-season-1-design.md`

## Global Constraints

- Start implementation from the then-current `origin/main`; record that SHA before editing.
- Never work directly on `main`; use a dedicated branch and leave the PR unmerged for review.
- Season 1 RTG is local IndexedDB only; no Firebase/cloud changes.
- Do not modify `RunStorage`, `gameplay-persistence`, `PermanentIndexedDb`, Album persistence, Hall persistence, Development persistence, cloud restore, or current `MatchSimulator`.
- RTG uses database `inazumaRoadToGlory`, version `1`.
- RTG is locked below 15 permanently unlocked Free Agents or when those Free Agents cannot form at least one valid 11v11 lineup with a GK.
- All RTG players resolve at level 20.
- `js/app.js` may receive only composition/wiring in later PRs; feature logic belongs in dedicated RTG modules.
- No implementation step may write persistent state during module load.

---

## File Structure

Create:

- `js/road-to-glory/rtg-config.js` — approved S1 campaign/economy/constraint constants and derived node order.
- `js/road-to-glory/rtg-storage.js` — dedicated IndexedDB adapter with one `campaign` store.
- `js/road-to-glory/rtg-state.js` — schema, defaults, normalization, validation and compact cloning.
- `js/road-to-glory/rtg-repository.js` — async read/create/update boundary over RTG storage.
- `js/road-to-glory/rtg-entitlements.js` — read-only Free Agent entitlement and access gate.
- `js/road-to-glory/rtg-player-resolver.js` — canonical ownership and Season/version fallback.
- `tests/helpers/fake-indexeddb-lite.js` — isolated IndexedDB test double for RTG tests.
- `tests/rtg-season1-config-test.js`
- `tests/rtg-indexeddb-storage-test.js`
- `tests/rtg-state-test.js`
- `tests/rtg-entitlements-test.js`
- `tests/rtg-player-resolver-test.js`
- `tests/rtg-foundation-load-order-test.js`

Modify:

- `index.html` — load foundation modules after their existing dependencies; no UI entry yet.

### Task 1: Freeze Season 1 RTG constants in code

**Files:**
- Create: `js/road-to-glory/rtg-config.js`
- Test: `tests/rtg-season1-config-test.js`

**Interfaces:**
- Produces: `global.RoadToGloryConfig.SEASON1`
- Produces: `global.RoadToGloryConfig.buildSeasonNodes(seasonId)`
- Produces immutable constants for pull cost, rewards, rarity weights/refunds, main constraints, checkpoint indices and map blocks.

- [ ] **Step 1: Write the failing config test**

```js
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: null, Object, Array, Set, Map, JSON, Math };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js", "utf8"), context);

const { SEASON1, buildSeasonNodes } = context.RoadToGloryConfig;
assert.deepStrictEqual(Array.from(SEASON1.mainTeams), [
  "occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"
]);
assert.strictEqual(SEASON1.pullCost, 300);
assert.deepStrictEqual(JSON.parse(JSON.stringify(SEASON1.rarityWeights)), {
  Normale:40, Buono:27, Forte:18, Elite:10, Mondiale:5, Leggenda:0
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(SEASON1.duplicateRefunds)), {
  Normale:40, Buono:60, Forte:85, Elite:120, Mondiale:160, Leggenda:300
});
assert.strictEqual(SEASON1.mainRewards.occult, 210);
assert.strictEqual(SEASON1.mainRewards.raimon, 630);
assert.deepStrictEqual(JSON.parse(JSON.stringify(SEASON1.secondaryRewards)), [
  { amount:100, weight:70 }, { amount:110, weight:20 }, { amount:125, weight:8 }, { amount:150, weight:2 }
]);

const nodes = Array.from(buildSeasonNodes("ie1"));
assert.strictEqual(nodes.length, 28);
assert.strictEqual(nodes[0].id, "main:occult");
assert.strictEqual(nodes.at(-1).id, "main:raimon");
assert.strictEqual(nodes.filter(n => n.type === "secondary").length, 18);
assert.deepStrictEqual(
  nodes.filter(n => n.checkpointAfter).map(n => n.teamId),
  ["brainwashing","farm","zeus"]
);
console.log("rtg-season1-config-test: PASS");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node tests/rtg-season1-config-test.js
```

Expected: failure because `js/road-to-glory/rtg-config.js` does not exist.

- [ ] **Step 3: Implement the immutable config**

Implement an IIFE exposing this contract:

```js
(function (global) {
  "use strict";

  const mainTeams = Object.freeze([
    "occult","wild","brainwashing","otaku","shuriken",
    "farm","kirkwood","royal","zeus","raimon",
  ]);

  const mainRewards = Object.freeze({
    occult:210, wild:225, brainwashing:240, otaku:255, shuriken:285,
    farm:330, kirkwood:390, royal:465, zeus:540, raimon:630,
  });

  const constraints = Object.freeze({
    occult:{ cap:75, minRecruit:0, recentCount:0, recentWindow:0 },
    wild:{ cap:77, minRecruit:1, recentCount:0, recentWindow:0 },
    brainwashing:{ cap:79, minRecruit:2, recentCount:0, recentWindow:0 },
    otaku:{ cap:77, minRecruit:2, recentCount:1, recentWindow:2 },
    shuriken:{ cap:80, minRecruit:3, recentCount:1, recentWindow:2 },
    farm:{ cap:81, minRecruit:3, recentCount:1, recentWindow:2 },
    kirkwood:{ cap:83, minRecruit:4, recentCount:2, recentWindow:3 },
    royal:{ cap:86, minRecruit:4, recentCount:2, recentWindow:3 },
    zeus:{ cap:87, minRecruit:5, recentCount:2, recentWindow:3 },
    raimon:{ cap:87, minRecruit:6, recentCount:3, recentWindow:3 },
  });

  const SEASON1 = Object.freeze({
    seasonId:"ie1",
    mainTeams,
    checkpointMainIndexes:Object.freeze([2,5,8]),
    visualBlocks:Object.freeze([[0,2],[3,5],[6,8],[9,9]]),
    livesPerCheckpoint:2,
    pullCost:300,
    mainRewards,
    secondaryRewards:Object.freeze([
      Object.freeze({ amount:100, weight:70 }),
      Object.freeze({ amount:110, weight:20 }),
      Object.freeze({ amount:125, weight:8 }),
      Object.freeze({ amount:150, weight:2 }),
    ]),
    rarityWeights:Object.freeze({ Normale:40, Buono:27, Forte:18, Elite:10, Mondiale:5, Leggenda:0 }),
    duplicateRefunds:Object.freeze({ Normale:40, Buono:60, Forte:85, Elite:120, Mondiale:160, Leggenda:300 }),
    constraints,
  });

  function buildSeasonNodes(seasonId) {
    if (String(seasonId) !== "ie1") return [];
    const nodes = [];
    mainTeams.forEach((teamId, mainIndex) => {
      nodes.push(Object.freeze({
        id:`main:${teamId}`, type:"main", teamId, mainIndex,
        checkpointAfter:SEASON1.checkpointMainIndexes.includes(mainIndex),
      }));
      if (mainIndex < mainTeams.length - 1) {
        for (let slot = 1; slot <= 2; slot += 1) {
          nodes.push(Object.freeze({
            id:`secondary:${teamId}:${mainTeams[mainIndex + 1]}:${slot}`,
            type:"secondary", afterTeamId:teamId, beforeTeamId:mainTeams[mainIndex + 1], slot,
          }));
        }
      }
    });
    return Object.freeze(nodes);
  }

  global.RoadToGloryConfig = Object.freeze({ SEASON1, buildSeasonNodes });
})(globalThis);
```

- [ ] **Step 4: Run the config test**

Run `node tests/rtg-season1-config-test.js`.

Expected: `rtg-season1-config-test: PASS`.

- [ ] **Step 5: Commit**

```bash
git add js/road-to-glory/rtg-config.js tests/rtg-season1-config-test.js
git commit -m "feat: add RTG season 1 configuration"
```

### Task 2: Add dedicated RTG IndexedDB storage

**Files:**
- Create: `tests/helpers/fake-indexeddb-lite.js`
- Create: `js/road-to-glory/rtg-storage.js`
- Test: `tests/rtg-indexeddb-storage-test.js`

**Interfaces:**
- Produces: `global.RoadToGloryStorage.DB_NAME === "inazumaRoadToGlory"`
- Produces: `global.RoadToGloryStorage.DB_VERSION === 1`
- Produces: `create({ indexedDB, databaseName, databaseVersion }) -> { open, read, write, update, remove, close }`
- The only store is `campaign`; default record key is `state`.
- `update` accepts a synchronous updater and commits read+write in the same readwrite transaction.

- [ ] **Step 1: Extract a minimal fake IndexedDB helper**

Create `tests/helpers/fake-indexeddb-lite.js` from the proven transaction semantics in `tests/permanent-indexeddb-core-test.js`. Export:

```js
module.exports = { makeFakeIndexedDb };
```

The fake must support `open`, `onupgradeneeded`, `transaction`, `get`, `put`, `delete`, `clear`, `oncomplete`, `onabort`, `onerror`, blocked open, SecurityError and QuotaExceededError injection.

- [ ] **Step 2: Write the failing storage test**

```js
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { makeFakeIndexedDb } = require("./helpers/fake-indexeddb-lite");

function load(fake) {
  const context = { globalThis:null, window:null, console, Error, Object, Array, String, Number, Promise, JSON, RegExp, indexedDB:fake };
  context.globalThis = context; context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-storage.js","utf8"), context);
  return context.RoadToGloryStorage;
}

(async () => {
  const fake = makeFakeIndexedDb();
  const api = load(fake);
  assert.strictEqual(api.DB_NAME, "inazumaRoadToGlory");
  assert.strictEqual(api.DB_VERSION, 1);
  assert.strictEqual(fake._openCalls(), 0);

  const db = api.create({ indexedDB:fake });
  await db.open();
  assert.deepStrictEqual([...fake._databases.get(api.DB_NAME).stores.keys()], ["campaign"]);

  await db.write({ schemaVersion:1, tokens:0 });
  const updated = await db.update(current => ({ ...current, tokens:Number(current.tokens)+210 }));
  assert.strictEqual(updated.tokens, 210);
  assert.strictEqual((await db.read()).tokens, 210);

  await assert.rejects(db.update(async current => current), error => error.code === "rtg-indexeddb-async-updater-not-supported");
  db.close();

  const blocked = load(makeFakeIndexedDb({ blocked:true }));
  await assert.rejects(blocked.create().open(), error => error.code === "rtg-indexeddb-open-blocked");

  const quotaError = Object.assign(new Error("quota"), { name:"QuotaExceededError" });
  const quotaFake = makeFakeIndexedDb({ writeError:quotaError });
  const quota = load(quotaFake).create({ indexedDB:quotaFake });
  await assert.rejects(quota.write({ schemaVersion:1 }), error => error.code === "storage-quota-exceeded");

  console.log("rtg-indexeddb-storage-test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 3: Run the failing test**

Run `node tests/rtg-indexeddb-storage-test.js`.

Expected: failure because the RTG storage module does not exist.

- [ ] **Step 4: Implement the adapter**

Implement a small adapter mirroring the error discipline of `js/storage/permanent-indexeddb.js`, but do not import or modify that protected module.

Core constants:

```js
const DB_NAME = "inazumaRoadToGlory";
const DB_VERSION = 1;
const STORE_NAME = "campaign";
const DEFAULT_KEY = "state";
```

`open()` creates only `campaign`. `read()` uses readonly. `write()` uses readwrite. `update(updater)` reads and writes within the same transaction and rejects Promise-returning updaters.

Map browser failures to stable codes:

- blocked → `rtg-indexeddb-open-blocked`
- SecurityError → `storage-access-error`
- QuotaExceededError → `storage-quota-exceeded`
- transaction abort → `rtg-indexeddb-transaction-aborted`

- [ ] **Step 5: Run the storage test**

Run `node tests/rtg-indexeddb-storage-test.js`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/fake-indexeddb-lite.js js/road-to-glory/rtg-storage.js tests/rtg-indexeddb-storage-test.js
git commit -m "feat: add isolated RTG IndexedDB storage"
```

### Task 3: Add the schema-versioned campaign aggregate and repository

**Files:**
- Create: `js/road-to-glory/rtg-state.js`
- Create: `js/road-to-glory/rtg-repository.js`
- Test: `tests/rtg-state-test.js`

**Interfaces:**
- Produces: `RoadToGloryState.SCHEMA_VERSION === 1`
- Produces: `createInitial({ campaignSeed })`
- Produces: `normalize(raw)`
- Produces: `validate(state)`
- Produces: `RoadToGloryRepository.create({ storage, seedFactory })`
- Repository methods: `read()`, `ensureCampaign()`, `update(label, updater)`.

- [ ] **Step 1: Write the failing state/repository test**

The test must assert this exact initial durable shape:

```js
{
  schemaVersion:1,
  campaignId:"rtg-ie-trilogy",
  campaignSeed:"seed-1",
  activeSeasonId:"ie1",
  seasonComplete:false,
  tokens:0,
  lives:2,
  checkpointMainIndex:-1,
  currentNodeId:"main:occult",
  furthestNodeIndex:0,
  defeatedTeamIds:[],
  firstClearMatchIds:[],
  gachaAcquiredPlayerIds:[],
  gacha:{ pullCount:0 },
  squads:{
    ie1:{ formationId:null, lineup:[], bench:[], activeRoleVariantByPlayerId:{} }
  },
  attemptsByNode:{},
  activeMatch:null
}
```

Also assert:

- future schema versions throw `rtg-state-unsupported-schema`;
- duplicate IDs are normalized away;
- negative tokens are rejected;
- lives are clamped to 0–2;
- repository `ensureCampaign()` creates once and reads the same seed after reopen;
- repository updater failure leaves the stored state unchanged.

- [ ] **Step 2: Run and observe failure**

Run `node tests/rtg-state-test.js`.

- [ ] **Step 3: Implement state helpers**

Use JSON-safe cloning only. `normalize` must preserve unknown forward-compatible map entries only when schemaVersion is supported, deduplicate ID arrays, coerce token/life/index counters to safe integers, and ensure `squads.ie1` exists.

`validate` must throw stable errors for:

- wrong campaign ID;
- tokens < 0;
- unsupported active Season in S1 implementation;
- non-boolean `seasonComplete`;
- duplicate lineup/bench IDs;
- overlap between lineup and bench;
- non-object activeMatch.

- [ ] **Step 4: Implement repository update boundary**

`update(label, updater)` must call `storage.update` exactly once:

```js
async function update(label, updater) {
  if (typeof updater !== "function") throw new TypeError("RTG updater required");
  return storage.update(currentRaw => {
    const current = stateApi.normalize(currentRaw || stateApi.createInitial({ campaignSeed:seedFactory() }));
    const next = updater(stateApi.clone(current));
    if (next && typeof next.then === "function") {
      throw Object.assign(new Error("Async RTG updater not supported"), { code:"rtg-async-updater-not-supported", label });
    }
    return stateApi.validate(stateApi.normalize(next || current));
  });
}
```

No UI side effects live in the repository.

- [ ] **Step 5: Run the state test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/road-to-glory/rtg-state.js js/road-to-glory/rtg-repository.js tests/rtg-state-test.js
git commit -m "feat: add RTG campaign state repository"
```

### Task 4: Read Free Agent entitlement and enforce the 15-player gate

**Files:**
- Create: `js/road-to-glory/rtg-entitlements.js`
- Test: `tests/rtg-entitlements-test.js`

**Interfaces:**
- Produces: `unlockedFreeAgentIds({ albumProgress, freeAgentsDb }) -> string[]`
- Produces: `accessStatus({ albumProgress, freeAgentsDb, formations }) -> { unlocked, count, reason, formationIds }`

- [ ] **Step 1: Write the failing entitlement test**

Construct 16 Free Agents with roles sufficient for `4-3-3`; expose 14, 15-valid and 15-without-GK album states.

Use the real Album compact format:

```js
const albumState = {
  schemaVersion:2,
  sharedUnlockedPlayerIds:Object.fromEntries(unlockedIds.map(id => [id, { firstSource:"test" }])),
  collections:{ ie1:{ unlockedPlayerIds:{} } }
};
const albumProgress = { read:() => albumState };
```

Assertions:

- 14 unlocks → `unlocked:false`, reason `minimum-free-agents`;
- 15 with no GK → `unlocked:false`, reason `no-valid-formation`;
- 15 role-valid with GK → `unlocked:true`;
- an album-unlocked ID absent from `FREE_AGENTS_compact` is ignored;
- no writes are attempted on `AlbumProgress`.

- [ ] **Step 2: Run and verify failure**

Run `node tests/rtg-entitlements-test.js`.

- [ ] **Step 3: Implement gate logic**

Read only `albumProgress.read().sharedUnlockedPlayerIds`, intersect with `freeAgentsDb.players[].playerId`, then compute role counts from the Free Agent records.

A formation is valid when every `formation.requirements[role]` is met.

Do not call `AlbumProgress.write`, `unlockAlbumPlayer` or IndexedDB directly.

- [ ] **Step 4: Run entitlement test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/road-to-glory/rtg-entitlements.js tests/rtg-entitlements-test.js
git commit -m "feat: add RTG free agent access gate"
```

### Task 5: Add canonical RTG player/Season resolution

**Files:**
- Create: `js/road-to-glory/rtg-player-resolver.js`
- Test: `tests/rtg-player-resolver-test.js`

**Interfaces:**
- Produces: `resolveVersion(playerId, activeSeasonId)`
- Produces: `resolveAtLevel20(playerId, activeSeasonId, roleVariantId = null)`
- Produces: `resolveMove(playerId, activeSeasonId, role)`
- Produces: `rarity(playerId, activeSeasonId)`

- [ ] **Step 1: Write resolver tests**

Use stub SeasonRegistry databases for `ie1`, `ie1_s2`, `ie1_s3` and a stub `ProfiledSeasonRuntime`.

Assert:

- S1 player resolves S1;
- S2 version replaces S1 when present;
- S3 missing version falls back to the latest valid earlier version;
- canonical `playerId` never changes;
- level is always 20 when progression resolver is called;
- role-specific move calls `MatchMoveRuntime.moveForPlayer(resolvedSeasonId, player, explicitRole)`;
- rarity comes from the resolved Season card/category and is not calculated from overall or move power.

- [ ] **Step 2: Run and verify failure**

Run `node tests/rtg-player-resolver-test.js`.

- [ ] **Step 3: Implement explicit fallback order**

Use:

```js
const ORDER = Object.freeze(["ie1","ie1_s2","ie1_s3"]);
```

For active Season index N, inspect N down to 0 and return the first Season where `SeasonRegistry.player(playerId, seasonId)` or a registered profile can resolve the canonical player.

For S1 implicit profiles, use the Season player directly. For profile-aware Seasons, use `ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel` with a synthetic owned entry carrying `level:20` and the selected role variant.

Never mutate run roster/profile state.

- [ ] **Step 4: Run resolver test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/road-to-glory/rtg-player-resolver.js tests/rtg-player-resolver-test.js
git commit -m "feat: add RTG canonical player resolver"
```

### Task 6: Wire foundation modules without boot-time writes

**Files:**
- Modify: `index.html` script list, after `js/moves/move-runtime.js` and before app composition.
- Test: `tests/rtg-foundation-load-order-test.js`

**Interfaces:**
- Foundation globals must exist before `js/app.js`.
- Loading scripts must not open IndexedDB or write Album/run/cloud state.

- [ ] **Step 1: Write load-order test**

Read `index.html` as text and assert this order:

```js
[
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-storage.js",
  "js/road-to-glory/rtg-state.js",
  "js/road-to-glory/rtg-repository.js",
  "js/road-to-glory/rtg-entitlements.js",
  "js/road-to-glory/rtg-player-resolver.js"
]
```

Also load all six modules in a VM with an IndexedDB fake whose `open` throws if called; module evaluation must complete without opening storage.

- [ ] **Step 2: Run and verify failure**

Run `node tests/rtg-foundation-load-order-test.js`.

- [ ] **Step 3: Add script tags**

Add cache-busted script tags in dependency order. Do not add Home UI, `app.js` wiring, CSS, cloud events or bootstrap calls in this PR.

- [ ] **Step 4: Run focused and regression tests**

```bash
node tests/rtg-season1-config-test.js
node tests/rtg-indexeddb-storage-test.js
node tests/rtg-state-test.js
node tests/rtg-entitlements-test.js
node tests/rtg-player-resolver-test.js
node tests/rtg-foundation-load-order-test.js
node tests/permanent-indexeddb-core-test.js
node tests/album-indexeddb-cutover-test.js
node tests/run-local-only-cloud-decoupling-test.js
node tests/app-decomposition-contract-test.js
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/rtg-foundation-load-order-test.js
git commit -m "chore: wire RTG foundation modules"
```

## PR Gate

Before opening the Foundation PR:

```bash
git diff origin/main...HEAD -- js/road-to-glory index.html tests/rtg-*
git diff origin/main...HEAD -- js/storage js/gameplay-persistence.js js/cloud-save-core.js
```

The second diff must be empty.

Run the repository regression workflow command set relevant to storage plus all new RTG tests. Open the PR and leave it unmerged for review.
