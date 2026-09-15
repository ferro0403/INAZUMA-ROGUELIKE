# Road to Glory Season 1 — UI and Production Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fully tested RTG Season 1 domain reachable in production through a simple two-tab Run/Squadra interface, vertical map, vending machine, static-field interactive match UI, halftime editor, and exact IndexedDB resume behavior.

**Architecture:** UI modules render existing pure RTG runtimes and never mutate state directly. `RoadToGloryController` is the only orchestration boundary: it lazy-opens the dedicated RTG repository after the access gate passes, commits one atomic repository mutation per durable user action, and renders only committed state. `js/app.js` remains a composition root with minimal dependency wiring.

**Tech Stack:** Vanilla JavaScript IIFE modules, existing app shell/modal/toast helpers, CSS, existing TeamEmblems/PlayerVisuals/PlayerView presentation helpers, dedicated RTG IndexedDB repository, Node 22 DOM/string characterization tests.

**Spec:** `docs/superpowers/specs/2026-09-16-road-to-glory-season-1-design.md`

## Global Constraints

- Start only after Foundation, Progression/Gacha/Squad and Match Engine PRs are reviewed/merged.
- Start from the then-current `origin/main`; record that SHA before editing.
- Work on a dedicated branch; do not merge automatically.
- Top-level RTG navigation is exactly **Run | Squadra**.
- RTG access remains locked until the 15-Free-Agent valid-lineup gate passes.
- The locked screen must not create/write an RTG campaign.
- No cloud/Firebase integration.
- No changes to current normal run gameplay, current MatchSimulator, normal RunStorage, permanent account stores or cloud restore.
- The field is static. No 22-player movement engine is introduced.
- Every durable UI success is rendered only after its RTG IndexedDB transaction commits.
- Home and normal-run UI must remain behaviorally unchanged except for the new RTG entry action.
- Map backgrounds are presentation-only; map state is represented by HTML/CSS nodes and persisted IDs.

---

## File Structure

Create:

- `js/road-to-glory/rtg-run-view.js` — Run tab: map, wallet/lives, match requirements, vending-machine modal.
- `js/road-to-glory/rtg-squad-view.js` — Squadra tab: 11+4 lineup, formation selection and accessible collection.
- `js/road-to-glory/rtg-match-view.js` — static pitch, VS card, probability reveal, halftime and penalties.
- `js/road-to-glory/rtg-controller.js` — production orchestration and atomic commit/render sequencing.
- `css/road-to-glory.css` — all RTG layout/responsive presentation.
- `assets/rtg/s1-map-01.webp`
- `assets/rtg/s1-map-02.webp`
- `assets/rtg/s1-map-03.webp`
- `assets/rtg/s1-map-04.webp`
- `tests/rtg-home-entry-test.js`
- `tests/rtg-run-view-test.js`
- `tests/rtg-squad-view-test.js`
- `tests/rtg-match-view-test.js`
- `tests/rtg-controller-transaction-test.js`
- `tests/rtg-production-integration-test.js`
- `tests/rtg-active-match-reopen-e2e-test.js`

Modify:

- `index.html` — load RTG CSS/UI modules in dependency order.
- `js/home/home-view.js` — add a Road to Glory action.
- `js/home/home-controller.js` — bind the Road to Glory action.
- `js/app.js` — minimal RTG composition/wiring only.
- `tests/home-layout-regression-test.js` — update approved Home action order.
- `tests/app-decomposition-contract-test.js` only if its source ownership assertions need the new RTG module names.

### Task 1: Create the four lightweight Season 1 map background assets

**Files:**
- Create: `assets/rtg/s1-map-01.webp`
- Create: `assets/rtg/s1-map-02.webp`
- Create: `assets/rtg/s1-map-03.webp`
- Create: `assets/rtg/s1-map-04.webp`

**Interfaces:**
- Presentation-only 9:16-ish vertical background segments.
- No text, node labels, logos, paths, locks or gameplay state baked into the images.
- Each final WebP should target <= 350 KB at mobile-appropriate resolution; HTML/CSS overlays contain all dynamic content.

- [ ] **Step 1: Generate four coherent map illustrations from fixed art direction**

Use the image-generation capability with this shared prompt, varying only the segment theme:

```text
Vertical 2D pseudo-3D cartoon football adventure map background for a mobile game,
bright cel-shaded anime sports atmosphere, playful hand-painted terrain, simplified
stadium/training-ground landmarks, exaggerated perspective, clean readable central
space for an HTML path overlay, no text, no logos, no characters, no UI, no node
icons, no watermarks. Match a colorful Inazuma-inspired football game interface
without copying any specific existing artwork. The top and bottom edges must blend
naturally into adjacent vertical map segments.
```

Segment themes:

1. **Early tournament** — suburban training grounds, school pitch, dusk-to-day progression.
2. **Mid tournament** — woodland/ninja/farm visual motifs expressed only through environment, not team logos.
3. **Elite tournament** — grand academy/stadium district, more dramatic lighting and scale.
4. **Finale** — championship stadium approach, celebratory sky and destination emphasis.

- [ ] **Step 2: Convert/export each approved segment to WebP and verify file budget**

Run:

```bash
python - <<'PY'
from pathlib import Path
from PIL import Image
for p in sorted(Path("assets/rtg").glob("s1-map-*.webp")):
    im = Image.open(p)
    print(p, im.size, p.stat().st_size)
    assert p.stat().st_size <= 350 * 1024, f"{p} exceeds 350 KB"
PY
```

Expected: all four files <= 350 KB.

- [ ] **Step 3: Commit assets separately**

```bash
git add assets/rtg/s1-map-*.webp
git commit -m "assets: add RTG season 1 map backgrounds"
```

### Task 2: Add the Home entry and locked access screen

**Files:**
- Modify: `js/home/home-view.js`
- Modify: `js/home/home-controller.js`
- Create: `tests/rtg-home-entry-test.js`
- Modify: `tests/home-layout-regression-test.js`

**Interfaces:**
- Home action ID: `open-rtg-home`
- Home label: `Road to Glory`
- HomeController dependency: `renderRoadToGlory`

- [ ] **Step 1: Write the failing Home entry test**

Read `js/home/home-view.js` and `js/home/home-controller.js`.

Assert:

```js
assert.match(view, /id:\s*"open-rtg-home"/);
assert.match(view, /label:\s*"Road to Glory"/);
assert.match(controller, /getElementById\("open-rtg-home"\)/);
assert.match(controller, /deps\.renderRoadToGlory/);
```

Also assert the Home action order is:

```
Negozio
Centro di Sviluppo
Album
Albo d’Oro
Road to Glory
Modalità
```

- [ ] **Step 2: Run and verify failure**

```bash
node tests/rtg-home-entry-test.js
node tests/home-layout-regression-test.js
```

- [ ] **Step 3: Add the Home action and controller binding**

Add to `HOME_SECONDARY_ACTIONS` before `Modalità`:

```js
{
  id: "open-rtg-home",
  label: "Road to Glory",
  description: "Costruisci la tua leggenda",
  icon: "⚽",
  className: "home-club-action--wide",
}
```

Bind:

```js
document
  .getElementById("open-rtg-home")
  ?.addEventListener("click", () => deps.renderRoadToGlory());
```

Do not query IndexedDB here. The controller callback owns the gate.

- [ ] **Step 4: Update the Home regression expectation and run**

Run both Home tests. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/home/home-view.js js/home/home-controller.js tests/rtg-home-entry-test.js tests/home-layout-regression-test.js
git commit -m "feat: add Road to Glory home entry"
```

### Task 3: Implement the vertical Run view and map node rendering

**Files:**
- Create: `js/road-to-glory/rtg-run-view.js`
- Create: `css/road-to-glory.css`
- Create: `tests/rtg-run-view-test.js`

**Interfaces:**
- Produces: `RoadToGloryRunView.create(deps)`
- View methods:
  - `lockedMarkup(access)`
  - `runMarkup({ state, nodes, seasonDb })`
  - `requirementsMarkup(eligibility)`
  - `vendingMarkup(model)`
  - `pullResultMarkup(result, player)`

- [ ] **Step 1: Write Run view characterization test**

Instantiate with simple `escapeHtml` and emblem stub.

For locked state assert copy contains:

```
Road to Glory
15 svincolati
```

For active run assert:

- exactly two top tabs: Run and Squadra;
- token balance and 2-life display exist;
- all 28 S1 node IDs render as `data-rtg-node-id`;
- exactly four `.rtg-map-block` containers;
- checkpoints appear after Brainwashing, Farm and Zeus;
- main nodes use team emblem dependency;
- secondary nodes use a generic Free Agent visual;
- completed old secondary nodes carry `data-rtg-farmable="true"`;
- locked future nodes are disabled;
- no third top-level tab exists.

- [ ] **Step 2: Implement semantic map markup**

Use one continuous:

```html
<main class="rtg-shell">
  <header class="rtg-header">...</header>
  <nav class="rtg-tabs">...</nav>
  <section class="rtg-map">...</section>
</main>
```

Each node is a real button:

```html
<button
  type="button"
  class="rtg-node rtg-node--main"
  data-rtg-node-id="main:occult"
  data-rtg-state="current"
>
  ...
</button>
```

Map block backgrounds use the four asset URLs in CSS and `background-size: cover`. Dynamic path lines and node status remain CSS/HTML only.

- [ ] **Step 3: Add responsive CSS**

Required properties:

- map width max 760px desktop;
- mobile fills viewport width;
- each background block uses `content-visibility:auto` and a sensible `contain-intrinsic-size`;
- node touch target >= 48px;
- no horizontal overflow;
- sticky compact RTG header/tabs allowed, but no permanently mounted heavy canvas;
- `prefers-reduced-motion` disables decorative transitions.

- [ ] **Step 4: Run and commit**

```bash
node tests/rtg-run-view-test.js
git add js/road-to-glory/rtg-run-view.js css/road-to-glory.css tests/rtg-run-view-test.js
git commit -m "feat: add RTG vertical season 1 map view"
```

### Task 4: Implement the simple Squadra tab

**Files:**
- Create: `js/road-to-glory/rtg-squad-view.js`
- Test: `tests/rtg-squad-view-test.js`

**Interfaces:**
- Produces: `RoadToGlorySquadView.create(deps)`
- Methods:
  - `renderModel({ state, freeAgentIds, seasonDb })`
  - `markup(model)`
  - `bind(root, actions)`

- [ ] **Step 1: Write model tests**

Assert:

- collection is union of unlocked Free Agents + gacha-acquired canonical IDs;
- every rendered player resolves at level 20;
- source badge distinguishes `Svincolato` and `RTG` provenance without creating duplicate cards for the same canonical ID;
- current 11 starters and 4 bench render once;
- formation picker lists only `seasonDb.formations.eleven`;
- active dual-role variant is rendered when present.

- [ ] **Step 2: Write interaction contract tests**

The view emits intents only:

```js
actions.onFormationChange(formationId)
actions.onSwap(firstPlayerId, secondPlayerId)
actions.onRoleChange(playerId, roleVariantId)
actions.onSave()
actions.onOpenPlayer(playerId)
```

It does not call repository/storage directly.

- [ ] **Step 3: Implement simple collection + 11/4 presentation**

Keep Season 1 UI intentionally compact:

- formation header;
- pitch with 11 slots;
- four bench slots;
- role/source filters for collection;
- player cards reuse existing portrait/rarity presentation dependencies where possible;
- no inventory, equipment, training or Development controls.

- [ ] **Step 4: Run and commit**

```bash
node tests/rtg-squad-view-test.js
git add js/road-to-glory/rtg-squad-view.js tests/rtg-squad-view-test.js
git commit -m "feat: add RTG squad view"
```

### Task 5: Implement the static-field match and VS decision view

**Files:**
- Create: `js/road-to-glory/rtg-match-view.js`
- Test: `tests/rtg-match-view-test.js`

**Interfaces:**
- Produces: `RoadToGloryMatchView.create(deps)`
- Methods:
  - `matchMarkup(match)`
  - `encounterMarkup(match, preview)`
  - `halftimeMarkup(model)`
  - `penaltyMarkup(match)`
  - `resultMarkup(match)`
  - `bind(root, actions)`

- [ ] **Step 1: Test static field contract**

Assert markup contains:

- both 11-player formations;
- score and period;
- no animation-loop/canvas/WebGL element;
- no continuously moving player controls;
- current move-use badges where relevant.

- [ ] **Step 2: Test VS encounter contract**

For a pending user encounter assert:

- user card;
- opponent card;
- base probability bar + percentage;
- `Normale` button;
- compatible move button with `X/2` remaining only when that player has a configured compatible move;
- for a Free Agent without a move, no empty/disabled technique slot is shown: only `Normale` is available;
- AI choice is **not** visible before user confirmation.

For resolved encounter assert:

- revealed AI choice;
- final percentage;
- win/loss outcome.

- [ ] **Step 3: Test penalties**

Normal-vs-normal user shooting markup exposes exactly:

```
Sinistra
Centro
Destra
```

When a compatible move remains, a separate move option is available.

Do not reveal goalkeeper AI direction before confirmation.

- [ ] **Step 4: Implement and commit**

```bash
node tests/rtg-match-view-test.js
git add js/road-to-glory/rtg-match-view.js tests/rtg-match-view-test.js
git commit -m "feat: add RTG static match and VS views"
```

### Task 6: Implement atomic RTG production orchestration

**Files:**
- Create: `js/road-to-glory/rtg-controller.js`
- Create: `tests/rtg-controller-transaction-test.js`

**Interfaces:**
- Produces: `RoadToGloryController.create(deps)`
- Public methods:
  - `open()`
  - `renderRun()`
  - `renderSquad()`
  - `openNode(nodeId)`
  - `startMatch(nodeId)`
  - `chooseEncounter(choice)`
  - `confirmHalftime(nextSquad)`
  - `choosePenalty(choice)`
  - `abandonMatch()`
  - `openVending()`
  - `pull()`
  - `saveSquad(nextSquad)`

- [ ] **Step 1: Test locked entry makes zero RTG writes**

Stub entitlement `accessStatus()` as locked. Stub repository methods to throw if called.

Call `controller.open()`.

Assert:

- locked view rendered;
- `repository.ensureCampaign`, `repository.update` and storage open are never called.

- [ ] **Step 2: Test unlocked lazy bootstrap**

For unlocked access:

1. load/read IE1 data;
2. call `repository.ensureCampaign()`;
3. if state has `activeMatch`, render the exact persisted match;
4. otherwise render Run tab.

The controller must not mutate normal `run` or `RunState`.

- [ ] **Step 3: Test vending pull commit ordering**

Stub `repository.update` to capture:

```js
current => RoadToGloryGacha.pull(current, {
  seasonDb,
  accessiblePlayerIds
}).state
```

The success/result modal must render only from `onCommitted`/resolved repository result, never before the Promise resolves.

On rejected write:

- token display remains at previously committed balance;
- no success card is shown;
- an error toast/render path is used.

- [ ] **Step 4: Test start-match atomic freeze**

Starting a secondary node must in one repository update:

- increment/store node attempt number;
- generate/freeze opponent snapshot;
- create `activeMatch`;
- store the match seed.

Starting a main node must:

- revalidate current squad eligibility;
- freeze opponent team from the S1 team starting XI;
- create `activeMatch`.

Render match only after commit.

- [ ] **Step 5: Test each encounter is one commit**

`chooseEncounter(choice)` calls one repository update that:

1. loads canonical `activeMatch`;
2. resolves the pending encounter with the already-frozen AI choice;
3. advances/prepares next match state as needed;
4. returns the committed campaign.

UI then renders the committed next state.

- [ ] **Step 6: Test terminal result handoff is exactly-once**

When `activeMatch.status` becomes terminal, a single repository update must:

- call main or secondary progression resolver;
- apply first-clear / lives / checkpoint / Tokens exactly once;
- clear `activeMatch`;
- preserve a compact last-result presentation snapshot if needed for the result modal.

Repeat invocation against already-cleared state must not award again.

- [ ] **Step 7: Test abandon behavior**

Main abandon:

- terminal defeat;
- one life consumed;
- checkpoint rollback if it was the last life.

Secondary abandon:

- 0 Tokens;
- 0 life loss;
- current node remains current when not yet cleared.

- [ ] **Step 8: Run and commit**

```bash
node tests/rtg-controller-transaction-test.js
git add js/road-to-glory/rtg-controller.js tests/rtg-controller-transaction-test.js
git commit -m "feat: add RTG production controller"
```

### Task 7: Wire halftime editor and role-by-role substitutions through the controller

**Files:**
- Modify: `js/road-to-glory/rtg-controller.js`
- Modify: `js/road-to-glory/rtg-squad-view.js`
- Modify: `js/road-to-glory/rtg-match-view.js`
- Extend: `tests/rtg-controller-transaction-test.js`
- Extend: `tests/rtg-match-view-test.js`

**Interfaces:**
- Halftime editor works on a draft copy; no durable write until `Conferma secondo tempo`.
- Role switch allowed only while that player is in the halftime bench draft.

- [ ] **Step 1: Add failing halftime tests**

Assert:

- swapping FW starter with DF bench directly is rejected;
- FW starter may first be replaced by another FW;
- once the dual-role player is on the bench, role variant may change to DF;
- then the player may replace a DF;
- all 4 bench players may participate;
- move uses remain keyed by canonical player ID and are unchanged by the role switch;
- invalid RTG Team Power or recruit composition prevents second-half confirmation.

- [ ] **Step 2: Implement draft-only halftime editing**

Keep:

```js
controllerHalftimeDraft = {
  formationId,
  lineup:[...],
  bench:[...],
  activeRoleVariantByPlayerId:{...}
}
```

in controller/UI memory only.

On confirmation, call one `repository.update` that delegates to `RoadToGloryMatchEngine.confirmHalftime`.

- [ ] **Step 3: Run tests and commit**

```bash
node tests/rtg-controller-transaction-test.js
node tests/rtg-match-view-test.js
git add js/road-to-glory/rtg-controller.js js/road-to-glory/rtg-squad-view.js js/road-to-glory/rtg-match-view.js tests/rtg-controller-transaction-test.js tests/rtg-match-view-test.js
git commit -m "feat: add RTG halftime squad editing"
```

### Task 8: Add minimal app composition and production script/style wiring

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Create: `tests/rtg-production-integration-test.js`

**Interfaces:**
- `app.js` creates dependencies only.
- New top-level function available to HomeController: `renderRoadToGlory()`.

- [ ] **Step 1: Write the failing integration ownership test**

Assert `js/app.js` contains composition references:

```js
RoadToGloryStorage.create
RoadToGloryRepository.create
RoadToGloryRunView.create
RoadToGlorySquadView.create
RoadToGloryMatchView.create
RoadToGloryController.create
```

But assert it does **not** contain RTG rule literals:

```js
for (const forbidden of [
  "Normale:40",
  "brainwashing:240",
  "scoreDelta",
  "opponentTargetMin",
  "duplicateRefunds",
]) assert.doesNotMatch(app, new RegExp(forbidden));
```

- [ ] **Step 2: Add minimal composition**

Create once:

```js
const rtgStorage = global.RoadToGloryStorage.create();
const rtgRepository = global.RoadToGloryRepository.create({
  storage: rtgStorage,
  seedFactory: () => global.crypto?.randomUUID?.() || `rtg-${Date.now()}`,
});
const rtgRunView = global.RoadToGloryRunView.create({...});
const rtgSquadView = global.RoadToGlorySquadView.create({...});
const rtgMatchView = global.RoadToGloryMatchView.create({...});
const rtgController = global.RoadToGloryController.create({
  repository: rtgRepository,
  runView: rtgRunView,
  squadView: rtgSquadView,
  matchView: rtgMatchView,
  getFreeAgentsDb: () => freeAgentsDb,
  getAlbumProgress: () => global.AlbumProgress,
  ...
});
function renderRoadToGlory() { return rtgController.open(); }
```

Pass `renderRoadToGlory` into `HomeController.create`.

Do not call `rtgStorage.open()` at app startup.

- [ ] **Step 3: Add CSS and UI script tags**

Load `css/road-to-glory.css` and the three view/controller scripts after all RTG pure runtime dependencies and before `js/app.js`.

- [ ] **Step 4: Run integration and decomposition tests**

```bash
node tests/rtg-production-integration-test.js
node tests/app-decomposition-contract-test.js
node tests/home-layout-regression-test.js
node tests/ui-smoke-test.js
```

- [ ] **Step 5: Commit**

```bash
git add index.html js/app.js tests/rtg-production-integration-test.js
git commit -m "feat: wire Road to Glory production entry"
```

### Task 9: Prove production reopen/resume and atomic economy behavior

**Files:**
- Create: `tests/rtg-active-match-reopen-e2e-test.js`

**Interfaces:**
- Exercise the real RTG repository + controller + fake IndexedDB with production S1 data.

- [ ] **Step 1: Test active-match reopen**

Scenario:

1. seed account with >=15 valid unlocked Free Agents;
2. ensure RTG campaign;
3. save a legal 11+4 S1 squad;
4. start a secondary;
5. resolve until first manual encounter;
6. use one move;
7. destroy controller/repository objects without deleting IndexedDB;
8. recreate them;
9. open RTG.

Assert the recreated controller renders:

- same match ID;
- same opponent XI;
- same score;
- same action index;
- same remaining move uses;
- same pending/next encounter state.

- [ ] **Step 2: Test gacha crash boundary**

Simulate a write error before transaction completion.

Assert:

- no 300-token spend remains;
- no new player remains;
- no duplicate refund remains;
- no pull count increments.

Then perform a successful transaction and assert all four effects commit consistently.

- [ ] **Step 3: Test first-clear exactly-once after checkpoint rollback**

Progress through a checkpoint segment, claim a main first clear, lose enough later matches to roll map position back, then re-win the already-cleared main.

Assert its main reward is not added again.

- [ ] **Step 4: Run and commit**

```bash
node tests/rtg-active-match-reopen-e2e-test.js
git add tests/rtg-active-match-reopen-e2e-test.js
git commit -m "test: verify RTG production persistence boundaries"
```

### Task 10: Final regression and production-path gate

**Files:**
- No new runtime files unless a failing test exposes a defect.

- [ ] **Step 1: Run every RTG test**

```bash
for f in tests/rtg-*-test.js; do
  echo "==> $f"
  node "$f"
done
```

Expected: all PASS.

- [ ] **Step 2: Run protected normal-game regressions**

```bash
node tests/home-layout-regression-test.js
node tests/app-decomposition-contract-test.js
node tests/run-local-only-cloud-decoupling-test.js
node tests/permanent-indexeddb-core-test.js
node tests/album-indexeddb-cutover-test.js
node tests/canonical-player-identity-invariants-test.js
node tests/squad-view-dynamic-season-characterization-test.js
node tests/normal-match-moves-v2-suite.js
node tests/shared-match-engine-production-e2e-test.js
node tests/boss-crash-matrix-test.js
node tests/multi-season-persistence-stress-test.js
```

Expected: all PASS.

- [ ] **Step 3: Verify protected persistence and normal match files did not change**

```bash
git diff origin/main...HEAD --   js/storage/permanent-indexeddb.js   js/storage/album-indexeddb.js   js/storage/development-indexeddb.js   js/gameplay-persistence.js   js/run-state.js   js/match-simulator.js   js/cloud-save-core.js   js/firebase-cloud-save.js
```

Expected: empty.

- [ ] **Step 4: Browser verification before PR**

Run the project through its normal local static-server path, then verify on desktop and mobile viewport:

- Home loads and normal Run CTA still works;
- RTG locked account shows gate without creating a campaign;
- eligible account opens Run;
- vertical map scrolls without horizontal overflow;
- Squadra tab shows 11+4 and level-20 players;
- vending pull renders only after commit;
- static field and VS overlay fit mobile viewport;
- halftime editor works;
- reload during a match resumes exact state;
- leaving RTG and returning Home does not alter normal run state.

Capture console errors; expected: none.

- [ ] **Step 5: Run repository CI-equivalent regression gate**

Run the same Node 22 test groups used by the repository regression workflow, including the 500-run soak gates if practical before requesting merge review. RTG must not make existing deterministic campaign tests fail.

- [ ] **Step 6: Open PR and leave unmerged**

PR description must include:

- base `main` SHA used;
- the three prerequisite RTG PRs/commits;
- RTG tests executed;
- normal-game regression tests executed;
- persistence diff proof;
- explicit statement: **no cloud changes, no normal run save changes, no current MatchSimulator changes**.

## PR Gate

Do not merge automatically. The Season 1 RTG feature becomes user-reachable only in this final integration PR, after all lower-level PRs are already independently reviewed.
