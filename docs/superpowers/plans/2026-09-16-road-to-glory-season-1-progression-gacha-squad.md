# Road to Glory Season 1 — Progression, Gacha and Squad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure RTG Season 1 progression/economy/squad rules on top of the isolated foundation, without UI or interactive match resolution.

**Architecture:** All gameplay rules remain pure synchronous functions over the RTG campaign aggregate. Durable mutations are applied through `RoadToGloryRepository.update()`, giving one IndexedDB transaction per logical action. Random outcomes use deterministic streams derived from `campaignSeed` and monotonic counters so reload cannot reroll gacha or secondary rewards.

**Tech Stack:** Vanilla JavaScript IIFE modules, Node 22 tests, local JSON Season 1 data, foundation modules from PR 1.

**Spec:** `docs/superpowers/specs/2026-09-16-road-to-glory-season-1-design.md`

## Global Constraints

- This plan starts only after the Foundation PR is reviewed/merged.
- Start from the then-current `origin/main` and record its SHA.
- No cloud/Firebase, normal run, current MatchSimulator, Album write, Hall or Development mutations.
- Pull cost: 300 RTG Tokens.
- Rarity weights: Normale 40, Buono 27, Forte 18, Elite 10, Mondiale 5, Leggenda 0.
- Duplicate refunds: Normale 40, Buono 60, Forte 85, Elite 120, Mondiale 160, Leggenda 300.
- Secondary rewards: 100@70%, 110@20%, 125@8%, 150@2%.
- Main rewards: Occult 210, Wild 225, Brainwashing 240, Otaku 255, Shuriken 285, Farm 330, Kirkwood 390, Royal 465, Zeus 540, Raimon 630.
- 2 lives per checkpoint segment; checkpoints after Brainwashing, Farm and Zeus.
- Main constraints and caps are exactly those in the approved spec.
- All squad power calculations use level-20 resolved players.

---

## File Structure

Create:

- `js/road-to-glory/rtg-rng.js` — deterministic named RNG streams.
- `js/road-to-glory/rtg-progression.js` — map advancement, checkpoint/lives, first-clear rewards and secondary reward selection.
- `js/road-to-glory/rtg-gacha.js` — unlocked pool, rarity roll, duplicate handling.
- `js/road-to-glory/rtg-squad-runtime.js` — accessible roster, lineup/bench legality, team power and main-match constraints.
- `tests/rtg-rng-test.js`
- `tests/rtg-progression-test.js`
- `tests/rtg-gacha-test.js`
- `tests/rtg-squad-runtime-test.js`
- `tests/rtg-season1-balance-contract-test.js`
- `tests/rtg-progression-load-order-test.js`

Modify:

- `index.html` — add these pure runtimes after RTG Foundation modules.

### Task 1: Add deterministic RTG random streams

**Files:**
- Create: `js/road-to-glory/rtg-rng.js`
- Test: `tests/rtg-rng-test.js`

**Interfaces:**
- Produces: `RoadToGloryRng.float(seed, stream, index) -> number in [0,1)`
- Produces: `RoadToGloryRng.int(seed, stream, index, maxExclusive)`
- Produces: `RoadToGloryRng.weightedPick(items, weightFn, roll)`

- [ ] **Step 1: Write the failing deterministic RNG test**

```js
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const c = { globalThis:null, Math, String, Number, Object, Array };
c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-rng.js","utf8"), c);

const a = c.RoadToGloryRng.float("campaign-A","gacha",0);
const b = c.RoadToGloryRng.float("campaign-A","gacha",0);
const other = c.RoadToGloryRng.float("campaign-A","gacha",1);
assert.strictEqual(a,b);
assert.notStrictEqual(a,other);
assert(a >= 0 && a < 1);

const picked = c.RoadToGloryRng.weightedPick(
  [{id:"a",w:40},{id:"b",w:60}],
  x => x.w,
  0.41
);
assert.strictEqual(picked.id,"b");
console.log("rtg-rng-test: PASS");
```

- [ ] **Step 2: Run and verify failure**

Run `node tests/rtg-rng-test.js`.

- [ ] **Step 3: Implement hash + stateless PRNG**

Reuse the proven FNV-style hash / Mulberry-style arithmetic from `js/match-simulator.js`, but expose it as stateless indexed draws:

```js
function float(seed, stream, index) {
  const mixed = `${seed}::${stream}::${Math.max(0, Math.floor(Number(index)||0))}`;
  let a = hashSeed(mixed) || 1;
  a += 0x6D2B79F5;
  let t = a;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
```

`weightedPick` must ignore non-positive weights and return `null` if total weight is zero.

- [ ] **Step 4: Run test and commit**

```bash
node tests/rtg-rng-test.js
git add js/road-to-glory/rtg-rng.js tests/rtg-rng-test.js
git commit -m "feat: add deterministic RTG random streams"
```

### Task 2: Implement linear progression, lives and rewards

**Files:**
- Create: `js/road-to-glory/rtg-progression.js`
- Test: `tests/rtg-progression-test.js`

**Interfaces:**
- Produces: `nodeIndex(state)`
- Produces: `isNodeUnlocked(state, nodeId)`
- Produces: `recordMainVictory(state, { teamId, matchId })`
- Produces: `recordMainLoss(state, { nodeId })`
- Produces: `recordSecondaryResult(state, { nodeId, result, attemptNumber })`
- Produces: `nextNodeId(state)`

- [ ] **Step 1: Write progression tests**

Use a fresh `RoadToGloryState.createInitial({campaignSeed:"seed"})`.

Assert:

1. initial node is `main:occult`, lives=2, tokens=0;
2. first Occult victory:
   - tokens=210;
   - defeatedTeamIds includes `occult`;
   - firstClearMatchIds contains match ID;
   - furthest/current advance to the first Occult→Wild secondary;
3. replayed Occult victory after a future rollback gives 0 additional first-clear Tokens;
4. winning the current secondary samples one approved reward and advances furthest;
5. draw/loss/abandon on the current secondary leaves progression on that node;
6. replaying an older completed secondary awards Tokens but does not move furthest backward/forward incorrectly;
6. secondary draw/loss awards 0 and does not consume lives;
7. first main loss changes lives 2→1 without rollback;
8. second main loss changes lives 1→2 and resets current progression to the node immediately after the latest checkpoint;
9. beating Brainwashing sets checkpointMainIndex=2 and lives=2;
10. beating Raimon marks `seasonComplete:true`.

- [ ] **Step 2: Run and verify failure**

Run `node tests/rtg-progression-test.js`.

- [ ] **Step 3: Implement first-clear and checkpoint rules**

First-clear identity is team-based in S1. The first successful victory for a team:

```js
if (!state.defeatedTeamIds.includes(teamId)) {
  state.defeatedTeamIds.push(teamId);
  state.firstClearMatchIds.push(String(matchId));
  state.tokens += config.mainRewards[teamId];
}
```

A repeated required victory after checkpoint rollback advances map position but does not add reward or duplicate the team ID.

When a checkpoint main is completed:

```js
state.checkpointMainIndex = mainIndex;
state.lives = config.livesPerCheckpoint;
```

On the loss that reaches zero, set lives back to 2 and set current progression to the first map node after that checkpoint main; with no checkpoint, reset to `main:occult`.

- [ ] **Step 4: Implement deterministic secondary rewards**

Use:

```js
const reward = rng.weightedPick(
  config.secondaryRewards,
  item => item.weight,
  rng.float(state.campaignSeed, `secondary-reward:${nodeId}`, attemptNumber)
);
```

Only `result === "victory"` awards the sampled amount.

- [ ] **Step 5: Run and commit**

```bash
node tests/rtg-progression-test.js
git add js/road-to-glory/rtg-progression.js tests/rtg-progression-test.js
git commit -m "feat: add RTG season 1 progression rules"
```

### Task 3: Implement the Season 1 vending machine

**Files:**
- Create: `js/road-to-glory/rtg-gacha.js`
- Test: `tests/rtg-gacha-test.js`

**Interfaces:**
- Produces: `unlockedCandidates(state, seasonDb)`
- Produces: `availableRarityWeights(state, seasonDb)`
- Produces: `previewPool(state, seasonDb)`
- Produces: `pull(state, { seasonDb, accessiblePlayerIds }) -> { state, result }`
- Result shape:
  `{ playerId, rarity, duplicate, refund, cost, balanceAfter, pullNumber }`.

- [ ] **Step 1: Write pool/rate tests against real S1 data**

Load `data/IE1_season_compact.json`.

With only Occult defeated assert:

- candidates contain Occult team player IDs only;
- only Normale/Buono/Forte are available;
- Elite/Mondiale/Leggenda are absent from the active roll;
- available weights renormalize over 40/27/18 without changing their relative ratio.

After Shuriken is defeated assert Elite becomes available.

After Royal is defeated assert Mondiale becomes available.

Leggenda remains unavailable in S1 even if an artificial candidate has category `Leggenda`.

- [ ] **Step 2: Write pull mutation tests**

Start with tokens=300 and Occult defeated.

Assert:

- a pull always subtracts 300;
- `gacha.pullCount` increments exactly once;
- the selected player is added to `gachaAcquiredPlayerIds`;
- repeating the same campaign seed/counter inputs returns the same rarity/player;
- a duplicate adds the correct refund;
- a player already available from Free Agent entitlement is treated as duplicate **and** is still added to `gachaAcquiredPlayerIds`, because pulling that team card makes the canonical player count as an S1 gacha recruit;
- insufficient tokens throws `rtg-gacha-insufficient-tokens` without changing state;
- no defeated-team candidates throws `rtg-gacha-empty-pool`.

- [ ] **Step 3: Implement canonical candidate de-duplication**

Build candidates by iterating `state.defeatedTeamIds`, reading each matching S1 team `playerIds`, resolving Season players, then de-duplicating by canonical `playerId`.

Rarity is exactly `player.category`.

Do not derive rarity from overall or move power.

- [ ] **Step 4: Implement two-stage deterministic roll**

```js
const pullIndex = state.gacha.pullCount;
const rarityRoll = rng.float(state.campaignSeed, "gacha-rarity", pullIndex);
const rarity = rng.weightedPick(activeRarities, x => x.weight, rarityRoll).rarity;
const players = candidates.filter(player => player.category === rarity);
const playerRoll = rng.float(state.campaignSeed, `gacha-player:${rarity}`, pullIndex);
const player = players[Math.floor(playerRoll * players.length)];
```

Determine duplicate against the union supplied by `accessiblePlayerIds` **before** adding the gacha provenance.

Apply cost and refund in the same returned state mutation.

- [ ] **Step 5: Run and commit**

```bash
node tests/rtg-gacha-test.js
git add js/road-to-glory/rtg-gacha.js tests/rtg-gacha-test.js
git commit -m "feat: add RTG season 1 vending machine rules"
```

### Task 4: Implement accessible roster, 11+4 legality and RTG Team Power

**Files:**
- Create: `js/road-to-glory/rtg-squad-runtime.js`
- Test: `tests/rtg-squad-runtime-test.js`

**Interfaces:**
- Produces: `accessiblePlayerIds({ freeAgentIds, state })`
- Produces: `validateSquad({ state, seasonDb, freeAgentIds, playerResolver })`
- Produces: `teamPower({ lineup, activeSeasonId, playerResolver })`
- Produces: `mainEligibility({ teamId, state, seasonDb, freeAgentIds, playerResolver })`
- Produces: `recentDefeatedTeamIds(teamId, state, window)`

- [ ] **Step 1: Write accessible-roster and formation tests**

Assert:

- accessible IDs are union of current Free Agent entitlement + `gachaAcquiredPlayerIds`;
- 11 starters and 4 bench IDs are unique and accessible;
- lineup role counts exactly satisfy the selected Season formation requirements;
- bench may contain any legal accessible role mix;
- invalid overlap between starters and bench fails;
- all resolved players are requested at level 20.

- [ ] **Step 2: Write exact Team Power tests**

Use this approved implementation baseline for the moderate move contribution:

```
playerMoveTeamBonus =
  no compatible active move ? 0 :
  clamp((movePower - 50) / 30, 0, 2)

RTG Team Power =
  roundTo1(
    average(startingXI.overall) +
    average(startingXI.playerMoveTeamBonus)
  )
```

Assertions:

- eleven OVR-75 players with power-50 moves → 75.0;
- eleven OVR-75 players with power-80 moves → 76.0;
- eleven OVR-75 players with power-110 moves → 77.0;
- element never changes Team Power;
- bench never changes Team Power.

This keeps the map caps on the existing overall scale while making strong active moves consume visible cap space.

- [ ] **Step 3: Write composition-constraint tests**

Build state progression through the real S1 team order.

Assert exact requirements:

- Wild: ≥1 gacha recruit;
- Brainwashing: ≥2;
- Otaku: ≥2 and ≥1 whose S1 team membership intersects the last 2 defeated teams;
- Shuriken: ≥3 and ≥1 / last 2;
- Farm: ≥3 and ≥1 / last 2;
- Kirkwood: ≥4 and ≥2 / last 3;
- Royal: ≥4 and ≥2 / last 3;
- Zeus: ≥5 and ≥2 / last 3;
- Raimon: ≥6 and ≥3 / last 3.

A Free Agent entitlement that was never pulled does not count as an S1 recruit.

A canonical player pulled as a duplicate while already available as Free Agent **does** count because it is present in `gachaAcquiredPlayerIds`.

Recent-team membership is based on the player's S1 team membership in the Season DB, not on an invented pull-source copy.

- [ ] **Step 4: Implement role-aware move power**

For each starting player:

1. resolve the level-20 active version;
2. resolve active role from lineup role/role variant;
3. call `RoadToGloryPlayerResolver.resolveMove(...)`;
4. map power to 0–2 team bonus using the formula above.

Round only the final team result to one decimal.

- [ ] **Step 5: Run and commit**

```bash
node tests/rtg-squad-runtime-test.js
git add js/road-to-glory/rtg-squad-runtime.js tests/rtg-squad-runtime-test.js
git commit -m "feat: add RTG squad eligibility and team power"
```

### Task 5: Characterize Season 1 economy and progression against production data

**Files:**
- Create: `tests/rtg-season1-balance-contract-test.js`

**Interfaces:**
- No runtime API changes.
- Locks the approved data/rule relationship to the actual `data/IE1_season_compact.json` and `data/IE1_moves.json`.

- [ ] **Step 1: Add production-data assertions**

The test must verify:

- S1 main team IDs exist in the exact approved order;
- every main team exposes a non-empty player pool;
- every S1 gacha candidate category is one of Normale/Buono/Forte/Elite/Mondiale;
- production counts remain:
  - Normale 12
  - Buono 45
  - Forte 54
  - Elite 35
  - Mondiale 11
- no S1 player has category Leggenda;
- first Elite availability occurs no later than Shuriken and first Mondiale availability no later than Royal;
- every starting XI player that has a configured RTG move resolves through `MatchMoveRuntime`;
- main reward total equals 3570 Tokens;
- secondary weights sum to 100.

- [ ] **Step 2: Run the contract test**

Run:

```bash
node tests/rtg-season1-balance-contract-test.js
```

Expected: PASS against current S1 data.

- [ ] **Step 3: Commit**

```bash
git add tests/rtg-season1-balance-contract-test.js
git commit -m "test: lock RTG season 1 balance contracts"
```

### Task 6: Wire pure progression modules and run the PR gate

**Files:**
- Modify: `index.html`
- Create: `tests/rtg-progression-load-order-test.js`

**Interfaces:**
- Script order after Foundation:
  1. `rtg-rng.js`
  2. `rtg-progression.js`
  3. `rtg-gacha.js`
  4. `rtg-squad-runtime.js`

- [ ] **Step 1: Add a zero-side-effect load-order test**

Load all RTG modules in a VM with storage write methods that throw. Pure runtime module evaluation must not call them.

- [ ] **Step 2: Add script tags and run focused tests**

```bash
node tests/rtg-rng-test.js
node tests/rtg-progression-test.js
node tests/rtg-gacha-test.js
node tests/rtg-squad-runtime-test.js
node tests/rtg-season1-balance-contract-test.js
node tests/rtg-progression-load-order-test.js
node tests/weighted-pull-extraction-test.js
node tests/canonical-player-identity-invariants-test.js
node tests/squad-view-dynamic-season-characterization-test.js
node tests/normal-match-moves-v2-suite.js
```

- [ ] **Step 3: Verify no protected-domain diff**

```bash
git diff origin/main...HEAD -- js/storage js/gameplay-persistence.js js/match-simulator.js js/album-progress.js js/storage/album-indexeddb.js js/cloud-save-core.js
```

Expected: empty.

- [ ] **Step 4: Commit wiring**

```bash
git add index.html tests/rtg-progression-load-order-test.js
git commit -m "chore: wire RTG progression runtimes"
```

## PR Gate

Open a dedicated Progression/Gacha/Squad PR and leave it unmerged. The PR must remain UI-invisible except for test seams; no Home action or new rendered screen is introduced in this phase.
