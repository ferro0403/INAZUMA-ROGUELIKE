# Road to Glory Season 1 — Interactive Match Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic, resumable RTG 11v11 match engine where the final score emerges from real encounter outcomes, including two-use moves, strategic hidden AI choices, halftime changes, extra time and penalties.

**Architecture:** The engine is a pure state machine over `state.activeMatch`. Every random draw is derived from stable seed/counter inputs, and every user decision advances one canonical state. The AI move choice is created before the user confirms and stored in the pending encounter, proving that it cannot react to the hidden user choice.

**Tech Stack:** Vanilla JavaScript IIFE modules, deterministic RTG RNG from PR 2, existing Season/player/move resolvers, Node 22 assertion tests.

**Spec:** `docs/superpowers/specs/2026-09-16-road-to-glory-season-1-design.md`

## Global Constraints

- This plan starts only after the Foundation and Progression/Gacha/Squad PRs are reviewed/merged.
- Do not change or call current `MatchSimulator.simulate()` for RTG match outcomes.
- Regulation generates 20–28 encounter/action sequences and targets 16–20 manual choices.
- User decisions cover both attack and defense contexts: midfield, dribble, defense, shot and save.
- Each player has 2 total move uses for the whole match, shared across role-specific moves.
- Move uses do not recharge at halftime, extra time or penalties.
- Lineup/role changes happen only at halftime; all 4 bench players may be used under role-by-role substitution legality.
- Encounter probability is always clamped to 10%–90%.
- Element cycle: Fire > Forest > Wind > Mountain > Fire.
- Player element advantage is ±5 percentage points.
- Move element advantage is ±5 percentage points only when both sides use moves.
- AI must not inspect the user's current hidden choice.
- Main draw → extra time → penalties. Secondary draw ends with no reward/life loss.
- Reload must resume the exact same opponent, score, move uses, decisions and shootout state.

---

## File Structure

Create:

- `js/road-to-glory/rtg-encounter-runtime.js` — action stats, move bonus, elements and final probability.
- `js/road-to-glory/rtg-ai-policy.js` — strategic move-use policy that consumes only pre-choice information.
- `js/road-to-glory/rtg-opponent-generator.js` — seeded S1 Free Agent XI generator inside a target strength band.
- `js/road-to-glory/rtg-penalty-runtime.js` — move overrides and hidden left/center/right shootout.
- `js/road-to-glory/rtg-match-engine.js` — full state machine and resume contract.
- `tests/rtg-encounter-runtime-test.js`
- `tests/rtg-ai-policy-test.js`
- `tests/rtg-opponent-generator-test.js`
- `tests/rtg-penalty-runtime-test.js`
- `tests/rtg-match-engine-test.js`
- `tests/rtg-match-resume-test.js`
- `tests/rtg-match-statistical-calibration-test.js`
- `tests/rtg-match-load-order-test.js`

Modify:

- `index.html` — add match engine modules after RTG progression modules.

### Task 1: Implement the approved encounter math

**Files:**
- Create: `js/road-to-glory/rtg-encounter-runtime.js`
- Test: `tests/rtg-encounter-runtime-test.js`

**Interfaces:**
- Produces: `specificAverage(player, kind)`
- Produces: `baseStrength(player, kind)`
- Produces: `moveBonus(power)`
- Produces: `elementModifier(attackerElement, defenderElement)`
- Produces: `probability({ actor, opponent, kind, actorMove, opponentMove })`
- Produces: `compatibleMoveType(kind, side)`

- [ ] **Step 1: Write exact formula tests**

Use players with flat stats so expectations are arithmetic, not approximate.

```js
const player = {
  overall:80, attack:90, control:75, speed:70, grit:85,
  physical:78, stamina:82, defense:60, save:20, element:"Fuoco"
};
assert.strictEqual(runtime.specificAverage(player,"shot"), (90+75+85)/3);
assert.strictEqual(runtime.baseStrength(player,"shot"), 0.5*80 + 0.5*((90+75+85)/3));
assert.strictEqual(runtime.moveBonus(50),5);
assert.strictEqual(runtime.moveBonus(80),8.5);
assert.strictEqual(runtime.moveBonus(110),12);
```

Stat groups are exact:

- shot → attack, control, grit
- dribble → control, speed, grit
- defense → defense, physical, grit
- save → save, physical, grit
- midfield → control, stamina, grit

- [ ] **Step 2: Add probability and clamp tests**

The raw score conversion is:

```
scoreDelta = actorEffectiveStrength - opponentEffectiveStrength
baseProbability = 50 + 2.5 * scoreDelta
```

Then add element percentage points and clamp final result to 10–90.

Assert:

- equal scores, neutral elements → 50;
- +5 strength delta → 62.5;
- +10 strength delta → 75;
- huge positive/negative deltas → 90 / 10;
- favorable player element → +5 pp;
- favorable player + favorable move when both use moves → +10 pp;
- favorable player + unfavorable move → net 0 pp;
- if only one side uses a move, no move-element modifier applies.

- [ ] **Step 3: Add element alias coverage**

Normalize both player-data Italian and move-data English:

```js
{
  fuoco:"fire", fire:"fire",
  albero:"forest", forest:"forest", wood:"forest",
  vento:"wind", wind:"wind",
  montagna:"mountain", mountain:"mountain"
}
```

- [ ] **Step 4: Implement the runtime and run tests**

Run `node tests/rtg-encounter-runtime-test.js`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/road-to-glory/rtg-encounter-runtime.js tests/rtg-encounter-runtime-test.js
git commit -m "feat: add RTG encounter probability runtime"
```

### Task 2: Implement strategic AI with hidden pre-choice decisions

**Files:**
- Create: `js/road-to-glory/rtg-ai-policy.js`
- Test: `tests/rtg-ai-policy-test.js`

**Interfaces:**
- Produces: `chooseMove(context, roll) -> "move" | "normal"`
- Context contains only pre-user-choice values:
  `minute, period, score, encounterKind, baseProbabilityForAi, remainingUses, hasCompatibleMove`.

- [ ] **Step 1: Write behavior-band tests**

Define these exact baseline probabilities to spend a move:

```
no compatible move or 0 uses       -> 0%
AI base chance >= 75%               -> 15%
AI base chance 55–74.999%           -> 40%
AI base chance 45–54.999%           -> 60%
AI base chance 25–44.999%           -> 75%
AI base chance < 25%                -> 85%
```

Urgency adjustments:

- minute >= 75 and AI is drawing or losing → +10 pp;
- minute >= 85 and AI is losing → additional +10 pp;
- save/shot encounter at minute >= 80 → +5 pp;
- only 1 use remaining before minute 60 → -10 pp.

Clamp decision probability to 0–95%.

Tests pass explicit rolls immediately below/above each threshold.

- [ ] **Step 2: Prove the API cannot consume the user choice**

Call `chooseMove` with identical context while varying an unrelated `userChoice` property. Result must be identical because the implementation destructures only approved fields.

Also assert the function never mutates context.

- [ ] **Step 3: Implement and run**

Run `node tests/rtg-ai-policy-test.js`.

- [ ] **Step 4: Commit**

```bash
git add js/road-to-glory/rtg-ai-policy.js tests/rtg-ai-policy-test.js
git commit -m "feat: add strategic hidden RTG move AI"
```

### Task 3: Generate deterministic secondary Free Agent opponents

**Files:**
- Create: `js/road-to-glory/rtg-opponent-generator.js`
- Test: `tests/rtg-opponent-generator-test.js`

**Interfaces:**
- Produces: `generate({ seed, attemptNumber, freeAgentsDb, formations, targetMin, targetMax, playerResolver })`
- Returns:
  `{ formationId, playerIds, teamPower, name:"Svincolati" }`.

- [ ] **Step 1: Write generator tests using production Free Agent data**

Load `data/FREE_AGENTS_compact.json` and IE1 formations.

Assert for a fixed seed:

- exactly 11 unique player IDs;
- at least one GK;
- role counts match the selected formation;
- the same seed/attempt returns the same XI;
- attempt 2 returns a different XI when enough candidates exist;
- calculated Team Power is within the requested band;
- generator failure after bounded search throws `rtg-secondary-opponent-band-unavailable`, not an infinite loop.

- [ ] **Step 2: Implement bounded seeded search**

For each of at most 64 candidate constructions:

1. choose a valid formation from IE1 formations using deterministic RNG;
2. for each formation slot, pick a not-yet-used Free Agent of that role;
3. calculate RTG Team Power with the existing `RoadToGlorySquadRuntime.teamPower`;
4. return first candidate inside band;
5. otherwise retain closest candidate and throw with diagnostic min/max/closest after 64 attempts.

Never alter Free Agent records or permanent unlock state.

- [ ] **Step 3: Run and commit**

```bash
node tests/rtg-opponent-generator-test.js
git add js/road-to-glory/rtg-opponent-generator.js tests/rtg-opponent-generator-test.js
git commit -m "feat: add seeded RTG free agent opponents"
```

### Task 4: Implement penalties as a separate deterministic subsystem

**Files:**
- Create: `js/road-to-glory/rtg-penalty-runtime.js`
- Test: `tests/rtg-penalty-runtime-test.js`

**Interfaces:**
- Produces: `createShootout(seed)`
- Produces: `resolveKick(state, input)`
- Input:
  `{ attackingSide, shooterChoice, goalkeeperChoice, shooterMove, goalkeeperMove, encounterContext }`
- Direction values: `"left" | "center" | "right"`.

- [ ] **Step 1: Write the four rule families**

Assert:

1. shooter move + normal goalkeeper → automatic goal;
2. normal shooter + goalkeeper move → automatic save;
3. both moves → delegate to `RoadToGloryEncounterRuntime.probability` and sample the seeded roll;
4. both normal:
   - same direction → save;
   - different direction → goal.

- [ ] **Step 2: Test five kicks + sudden death state**

Shootout ends only when mathematically decided after equal kick opportunities. If tied after five each, continue pair-by-pair sudden death.

- [ ] **Step 3: Test tendency-aware AI without cheating**

Expose:

```js
aiDirection(history, seed, kickIndex)
```

The AI may increase weight toward the user's most frequent previous direction, but the current user direction is not supplied.

Given identical history/seed, current hidden user choice changes nothing about AI direction.

- [ ] **Step 4: Implement and commit**

```bash
node tests/rtg-penalty-runtime-test.js
git add js/road-to-glory/rtg-penalty-runtime.js tests/rtg-penalty-runtime-test.js
git commit -m "feat: add RTG penalty shootout runtime"
```

### Task 5: Implement the resumable match state machine

**Files:**
- Create: `js/road-to-glory/rtg-match-engine.js`
- Test: `tests/rtg-match-engine-test.js`

**Interfaces:**
- Produces:
  - `createMatch(input)`
  - `prepareNext(state, dependencies)`
  - `resolvePendingEncounter(state, userChoice, dependencies)`
  - `confirmHalftime(state, nextSquad, dependencies)`
  - `abandon(state)`
- Match state contains:
  `matchId, nodeId, matchType, attemptNumber, seed, period, actionTarget, manualTarget, actionIndex, manualResolved, score, possession, fieldZone, userSquad, opponentSquad, moveUsesByPlayerId, pendingEncounter, recentParticipants, log, shootout, status`.

- [ ] **Step 1: Test match creation**

For fixed input assert:

- actionTarget is 20–28;
- manualTarget is 16–20 and <= actionTarget;
- period is `first_half`;
- score 0–0;
- every user/opponent player begins with 2 remaining move uses;
- initial fieldZone is `midfield`;
- same input produces same match seed/targets.

- [ ] **Step 2: Implement the field-state transition model**

Each sequence has one decisive encounter.

Zones:

```
midfield -> attack -> shot
```

Rules for the possession side:

- win midfield → advance to attack;
- lose midfield → turnover, reset to midfield;
- win attack/dribble → advance to shot;
- lose attack/dribble → turnover, reset to midfield;
- win shot-vs-save → goal, give kickoff possession to conceding side, reset midfield;
- lose shot-vs-save → defending side gains possession, reset midfield.

This guarantees score changes only through resolved shot/save encounters.

- [ ] **Step 3: Implement participant selection with repetition guard**

Role targets:

- midfield → prefer MF, then DF/FW fallback;
- attack actor → prefer FW then MF;
- attack defender → prefer DF then MF;
- shot actor → prefer FW then MF;
- save defender → GK.

Weight candidates by the approved relevant stats and reduce a player's weight by 75% when they appeared in either of the last two decisive encounters. Never select the goalkeeper outside save contexts unless no legal player exists.

- [ ] **Step 4: Implement manual vs automatic sequence budget**

At match creation, deterministically choose exactly `manualTarget` regulation action indexes from `0..actionTarget-1`.

A manual index becomes a user decision only when the user's involved player has a compatible active move; otherwise resolve normal-vs-normal automatically and transfer the unused manual slot to the next eligible regulation encounter until the target is met or regulation ends.

Automatic encounters always use normal-vs-normal and never consume move uses.

- [ ] **Step 5: Persist the hidden AI choice in pending encounter preparation**

`prepareNext` must build:

```js
pendingEncounter = {
  encounterId,
  kind,
  actorSide,
  actorPlayerId,
  opponentPlayerId,
  normalPreviewProbability,
  aiChoice,
  aiMove:null_or_move_snapshot,
  preparedAtActionIndex
}
```

`aiChoice` is computed and fixed **before** `resolvePendingEncounter` receives the user's choice.

Test by cloning the same prepared match and resolving one copy with `normal`, the other with `move`; both copies must have identical stored `aiChoice`.

- [ ] **Step 6: Implement move-use accounting**

When a side chooses move:

- verify a compatible active-role move exists;
- verify remaining uses > 0;
- decrement that canonical player's remaining uses by exactly 1;
- use the same counter after a halftime role switch;
- never allow negative values.

Role-to-move compatibility:

- shot → move type `shot`;
- save → `save`;
- defense → `defense`;
- dribble → `dribble`;
- midfield → the active-role move may be used if present; both sides compare their currently active role move.

- [ ] **Step 7: Implement halftime boundary**

After half of regulation action indexes are completed, enter `halftime` and stop producing encounters.

`confirmHalftime`:

1. validates 11+4 squad legality;
2. validates role-by-role substitutions/active role variants;
3. validates main-match RTG Team Power and composition constraints;
4. preserves `moveUsesByPlayerId` by canonical ID;
5. changes period to `second_half`.

No lineup mutation is accepted outside halftime.

- [ ] **Step 8: Implement extra time and shootout routing**

At regulation end:

- secondary tied → status `completed-draw`;
- main non-tied → completed result;
- main tied → `extra_first`.

Extra time uses exactly 6 additional decisive sequences, 3 per extra-time half, with the same move counters and normal/manual mechanics. If still tied, initialize `shootout` and delegate kicks to `RoadToGloryPenaltyRuntime`.

- [ ] **Step 9: Run state-machine test and commit**

```bash
node tests/rtg-match-engine-test.js
git add js/road-to-glory/rtg-match-engine.js tests/rtg-match-engine-test.js
git commit -m "feat: add interactive RTG match state machine"
```

### Task 6: Prove exact resume behavior across reload boundaries

**Files:**
- Create: `tests/rtg-match-resume-test.js`

**Interfaces:**
- Uses the public state-machine API only.

- [ ] **Step 1: Add a serialization/reload matrix**

For each checkpoint below, JSON serialize/deserialize the active match, then continue both original and reloaded copies with identical future user choices:

- before first manual choice;
- after user uses first move;
- immediately before halftime;
- immediately after halftime substitution;
- second half after score change;
- start of extra time;
- mid-shootout.

At completion assert both copies have exactly identical:

- score;
- result;
- event log;
- remaining move uses;
- opponent snapshot;
- shootout history.

- [ ] **Step 2: Test secondary opponent anti-reroll**

Recreate the application repository around a persisted active secondary match. The generator must not be called when `activeMatch` already contains a frozen opponent snapshot.

- [ ] **Step 3: Run and commit**

```bash
node tests/rtg-match-resume-test.js
git add tests/rtg-match-resume-test.js
git commit -m "test: prove RTG match resume determinism"
```

### Task 7: Calibrate approved duel behavior on real Season 1 players

**Files:**
- Create: `tests/rtg-match-statistical-calibration-test.js`

**Interfaces:**
- No runtime API additions.

- [ ] **Step 1: Build deterministic real-player fixtures**

Load `data/IE1_season_compact.json` and `data/IE1_moves.json`.

Select fixtures by properties, not hardcoded celebrity names:

- weak: OVR 70–75;
- medium: OVR 78–83;
- strong: OVR 88+;
- strong move: power >= 80;
- weak move: power <= 60.

- [ ] **Step 2: Assert the approved ordering using calculated probabilities**

For compatible encounter types assert there exist fixtures satisfying:

- weak + strong move vs medium + normal → weak side probability > 50%;
- strong + normal vs weak + strong move → strong side probability > 50%;
- equal/similar players both using moves → stronger move produces higher probability than weaker move;
- no final probability leaves 10–90.

- [ ] **Step 3: Add seeded sampling sanity**

For representative probabilities 25%, 50%, 75%, evaluate 20,000 indexed RTG RNG draws and assert observed win rate is within ±1.5 percentage points of target.

This tests the sampler only; it does not change formulas based on random test results.

- [ ] **Step 4: Run and commit**

```bash
node tests/rtg-match-statistical-calibration-test.js
git add tests/rtg-match-statistical-calibration-test.js
git commit -m "test: calibrate RTG encounter behavior on season 1 data"
```

### Task 8: Wire match modules and run the PR regression gate

**Files:**
- Modify: `index.html`
- Create: `tests/rtg-match-load-order-test.js`

**Interfaces:**
- Script order:
  1. `rtg-encounter-runtime.js`
  2. `rtg-ai-policy.js`
  3. `rtg-opponent-generator.js`
  4. `rtg-penalty-runtime.js`
  5. `rtg-match-engine.js`

- [ ] **Step 1: Add load-order test and script tags**

The test must verify all dependencies are loaded before `rtg-match-engine.js` and that module evaluation performs no storage write or match creation.

- [ ] **Step 2: Run focused tests**

```bash
node tests/rtg-encounter-runtime-test.js
node tests/rtg-ai-policy-test.js
node tests/rtg-opponent-generator-test.js
node tests/rtg-penalty-runtime-test.js
node tests/rtg-match-engine-test.js
node tests/rtg-match-resume-test.js
node tests/rtg-match-statistical-calibration-test.js
node tests/rtg-match-load-order-test.js
```

- [ ] **Step 3: Run existing match regressions unchanged**

```bash
node tests/normal-match-moves-v2-suite.js
node tests/match-retry-seed-regression-test.js
node tests/match-recovery-fail-stop-runtime-test.js
node tests/shared-match-engine-production-e2e-test.js
node tests/boss-crash-matrix-test.js
```

- [ ] **Step 4: Verify protected current match files are untouched**

```bash
git diff origin/main...HEAD -- js/match-simulator.js js/match js/boss js/gameplay-persistence.js js/run-state.js
```

Expected: empty.

- [ ] **Step 5: Commit wiring**

```bash
git add index.html tests/rtg-match-load-order-test.js
git commit -m "chore: wire RTG interactive match engine"
```

## PR Gate

Open a dedicated Match Engine PR and leave it unmerged. This PR still adds no RTG Home entry: the engine must be fully testable before UI can make it reachable.
