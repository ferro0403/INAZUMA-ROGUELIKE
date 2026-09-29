# Road to Glory — Season 1 Design Specification

**Status:** Approved design baseline  
**Scope:** Road to Glory Season 1 only  
**Repository baseline:** `main` at `e1eeb0ce4db6bcead3bb965095e2b04a4fef8efe`  
**Date:** 2026-09-16

## 1. Purpose

Road to Glory (RTG) is a new game mode, separate from the existing roguelike runs. Season 1 is implemented and balanced first; Season 2 and Season 3 are future extensions that must reuse the same contracts rather than fork the mode.

RTG has only two top-level sections:

- **Run** — the vertical campaign map, main matches, secondary Free Agent matches, checkpoints, lives, RTG Tokens and the Season vending machine.
- **Squadra** — the permanent RTG collection plus lineup management for an 11+4 squad.

The mode is intentionally isolated from current run gameplay, current MatchSimulator behavior, cloud sync and existing permanent-account mutation paths.

## 2. Non-goals for Season 1

Season 1 RTG does **not**:

- change the existing roguelike run rules;
- change current MatchSimulator formulas or timelines;
- write to normal run state;
- write to cloud/Firebase;
- add a third RTG top-level section;
- add real-time 22-player movement, physics or a live field engine;
- add a new tension/energy resource;
- add free gacha pulls;
- add player upgrades from duplicates.

## 3. Access gate and the only Run → RTG bridge

RTG remains locked until the permanent account has at least **15 Free Agents unlocked through normal runs** and those players can form at least one valid 11v11 lineup, including at least one goalkeeper.

All Free Agents permanently unlocked through normal runs are available in RTG:

- Free Agents unlocked before RTG starts are available immediately.
- Free Agents unlocked later become available automatically on the next RTG read/refresh.
- RTG never writes back into run progression to grant, alter or remove those unlocks.

This Free Agent entitlement is the **only gameplay bridge** from normal runs into RTG.

## 4. Player ownership, level and Season resolution

All RTG players are treated as **level 20**.

Ownership is canonical by `playerId`. RTG does not own separate independent copies such as “Mark S1”, “Mark S2” and “Mark S3”.

When the active RTG Season changes in future implementations:

1. resolve the owned canonical `playerId` in the current Season;
2. if that Season has a valid profile/version, use that version;
3. otherwise fall back to the latest valid previous-Season version.

The active version may change:

- overall;
- final stats;
- active role / role variants;
- move;
- visual/profile data;
- card rarity and other Season-specific presentation data.

Historical lineup presets may be stored per Season, but ownership remains one canonical player identity.

## 5. Season 1 campaign order

Season 1 follows the current run boss order:

1. Occult
2. Wild
3. Brainwashing
4. Otaku
5. Shuriken
6. Farm
7. Kirkwood
8. Royal Academy
9. Zeus
10. Raimon

The current Season 1 dataset contains no special matches, so no special-match nodes are added in S1. Future Seasons must interleave their special matches in the same narrative positions used by the run.

Between every pair of main matches there are exactly **two secondary 11v11 matches against Free Agents**.

Season 1 therefore contains:

- 10 main matches;
- 18 secondary Free Agent matches;
- 28 playable map nodes total.

## 6. Map structure

The map is:

- linear;
- vertical;
- scrollable;
- continuous from start to end;
- visually split into four connected background blocks.

Visual blocks:

1. Occult → Wild → Brainwashing
2. Otaku → Shuriken → Farm
3. Kirkwood → Royal Academy → Zeus
4. Raimon / Season finale

The illustrated background is presentation only. Nodes, path state, emblems, locks, checkpoint state and completion state are real HTML/CSS UI layered above the background so progress never requires regenerating images.

## 7. Checkpoints and lives

Main matches use **2 lives** per checkpoint segment.

Rules:

- losing a main match consumes 1 life;
- at 0 lives, map position returns to the latest checkpoint and lives reset to 2;
- permanent RTG progress never rolls back;
- first-clear rewards never become claimable again after a checkpoint rollback;
- losing, drawing or abandoning a secondary Free Agent match never consumes a life.

Season 1 checkpoints:

- after Brainwashing;
- after Farm;
- after Zeus;
- Season completion after Raimon.

Main-match abandonment counts as a loss and consumes a life. Secondary-match abandonment gives no reward and no life penalty.

## 8. Secondary Free Agent matches

Each secondary match creates a **new random opponent XI when a new attempt starts**.

For Season 1:

- the opponent pool is the normal Free Agent pool only;
- the generated XI must be role-valid;
- the XI must fit the target strength band for that map position;
- once the attempt starts, its opponent roster and RNG seed are frozen;
- reload/reopen resumes the same attempt rather than rerolling it.

A completed or abandoned attempt allows the next attempt to generate a new opponent.

### Secondary strength band and linear progression

Each secondary node inherits its **user RTG Team Power cap** from the next main match.

Its random opponent target band is derived from that next-main cap:

```
secondaryUserCap = nextMainConstraint.cap
opponentTargetMin = max(70, secondaryUserCap - 4)
opponentTargetMax = secondaryUserCap - 1
```

Season 1 examples therefore range from 73–76 before Wild up to 83–86 before Zeus/Raimon.

The current furthest secondary node is mandatory for linear progression:

- victory advances to the next node;
- draw/loss/abandon leaves progression on that node;
- once cleared, that secondary node remains replayable later for farming;
- replaying an older cleared secondary can award Tokens but never changes the furthest progression position.

Future rule already reserved:

- Season 2 uses normal Free Agents only.
- Season 3 may additionally use players already eligible for S3 Free Agent pulls, according to S3 progression eligibility.

## 9. Squad structure and halftime changes

The playable RTG squad is **11 starters + 4 bench players**.

Formation and role legality follow the existing game's role-by-role substitution contract.

During a match:

- first-half lineup is locked;
- all substitutions and role changes happen only at halftime;
- all 4 bench players may be used;
- after halftime the lineup is locked again until the match ends.

For a dual-role player, role switching still follows role-by-role substitution:

1. remove the player from the current role with a same-role replacement;
2. while on the bench, switch the player's active role;
3. insert the player into a same-role slot for the new role.

Match constraints are revalidated against the new starting XI before the second half begins.

## 10. Move usage

### Free Agent exception

For Season 1, Free Agents intentionally have **no move**.

RTG must not invent, synthesize or assign a fallback technique to them. A Free Agent:

- can participate in every compatible base encounter;
- receives no move-strength bonus;
- never receives a move-element modifier;
- never exposes a move button;
- has no move-use counter to consume.

A future RTG update may add Free Agent moves through an explicit data source, but that is outside Season 1 scope.

Every player who has a configured move has **2 total move uses per match**.

The counter belongs to the player, not to an individual move.

For a dual-role player:

- the move exposed by RTG depends on the player's current active role;
- changing role at halftime does not reset the counter;
- example: a player who used 1/2 uses as FW and becomes DF has 1 use remaining for the DF-role move.

Move uses:

- do not recharge at halftime;
- do not recharge in extra time;
- do not recharge for penalties;
- fully reset at the start of the next match.

There are no different usage counts for stronger moves. A power-110 move and a power-50 move both consume one of the player's two uses.

## 11. Match model

RTG does **not** precompute a final score.

The final score emerges from match state and resolved encounters.

Target match pacing:

- at least 20 meaningful attacking/action sequences;
- baseline generation target: 20–28 sequences in regulation;
- approximately 16–20 manual user decisions in regulation;
- extra time may add additional decisions.

Automatic connective events may include possession changes, passes and selection of action participants. Manual decisions cover meaningful encounters across both attack and defense:

- midfield duel;
- dribble;
- defensive challenge;
- shot;
- goalkeeper save.

Participant selection is weighted by role and field phase, with repetition protection so the same player does not monopolize encounters.

## 12. Match presentation

The match screen keeps a **static field with both full formations visible**.

There is no continuous player movement in Season 1 RTG.

When a manual encounter occurs:

- the field remains visible underneath and is dimmed;
- a simple **player card VS player card** panel opens;
- the panel shows relevant player identity, role, element and overall; if a configured move exists, it also shows that move and remaining uses;
- the user sees a probability bar and percentage;
- the user confirms the contextual base action — **Tiro, Parata, Dribbling o Difesa** — or chooses the compatible move when one exists;
- only after confirmation is the AI choice revealed;
- the final probability is shown;
- the encounter resolves;
- the panel closes back to the static field.

The same VS component is reused for shot, save, dribble, defense and midfield encounters.

## 13. Base encounter strength

Each encounter computes a base score using both overall and action-specific stats:

```
specificAverage = average(relevantStats)
baseStrength = 0.50 * overall + 0.50 * specificAverage
```

Relevant stat groups:

- **Shot:** attack, control, grit
- **Dribble:** control, speed, grit
- **Defense:** defense, physical, grit
- **Save:** save, physical, grit
- **Midfield:** control, stamina, grit

This makes overall the stable player-quality anchor while preserving real differentiation from the player's stat profile.

## 14. Move power contribution

A compatible move converts its catalog power into a bounded RTG strength bonus.

Season 1 baseline mapping:

```
moveBonus(power) = 5 + ((clamp(power, 50, 110) - 50) * 7 / 60)
```

Reference points:

- power 50 → +5.0 RTG strength
- power 80 → +8.5 RTG strength
- power 110 → +12.0 RTG strength

The move bonus is added to the acting player's effective encounter score.

This baseline must be validated with simulation against real S1 players before gameplay merge. Calibration may adjust constants while preserving the approved behavior:

- weak player + strong move can become favored over a medium player with no move;
- a clearly stronger player with no move normally remains favored over a weak player with a move;
- between similar players, move strength is important.

## 15. Score difference → probability

After move bonuses:

```
scoreDelta = actorEffectiveStrength - opponentEffectiveStrength
baseWinProbability = 50 + (2.5 * scoreDelta)
```

Percentages are percentage points.

Element modifiers are then applied and the final probability is clamped to **10%–90%**.

No extra hidden random stat modifier is applied. Randomness comes from sampling the final probability itself.

## 16. Element system

Element cycle:

**Fire > Forest/Tree > Wind > Mountain > Fire**

Element effects use percentage-point modifiers.

### Player element

Player element vs player element:

- favorable: +5 percentage points;
- unfavorable: -5 percentage points;
- neutral: 0.

### Move element

Move element is compared only when **both sides use moves**:

- favorable move element: +5 percentage points;
- unfavorable move element: -5 percentage points;
- neutral: 0.

Player and move modifiers stack and can cancel.

Examples:

- favorable player + favorable move = +10 pp;
- favorable player + unfavorable move = 0 pp;
- if only one side uses a move, there is no move-element comparison.

Final encounter probability is always clamped to 10%–90%.

## 17. User and AI move choice

The user does **not** see the AI's current choice before committing.

Flow:

1. show the base/current preview probability;
2. user chooses normal or move;
3. user confirms;
4. reveal the AI choice;
5. apply both move and element effects;
6. show final probability;
7. sample and resolve the encounter.

The AI is strategic, not purely random.

Its decision may use only information legitimately available before the user's current choice is revealed:

- current score;
- minute;
- encounter type;
- own strength;
- opponent base strength;
- own remaining move uses;
- whether the duel is favorable/even/unfavorable;
- match urgency.

The AI must not inspect the user's current hidden choice before choosing.

## 18. Extra time and penalties

### Main matches

A draw after regulation continues to extra time. A draw after extra time continues to penalties. A main match always produces a winner.

Move uses are not replenished.

### Secondary matches

A draw ends the match:

- no RTG Token reward;
- no life loss;
- node remains replayable.

### Penalties

Penalty shootout uses five kicks per side, then sudden death if tied.

If one side uses a compatible move and the other does not:

- shooting move vs normal save = automatic goal;
- normal shot vs goalkeeper move = automatic save.

If both use moves:

- resolve a normal RTG shot-vs-save encounter using the approved strength, move, element and probability rules.

If both use base actions without moves:

- shooter selects **left / center / right**;
- goalkeeper selects **left / center / right** without seeing the shooter's current choice;
- same zone = save;
- different zone = goal.

When the user controls the goalkeeper, the same hidden-choice rule applies in reverse.

Penalty AI may learn prior left/center/right tendencies from earlier kicks in the same shootout, but never reads the user's current choice.

### Base-action UI labels

The match UI never shows a generic button labeled `Normale`.

The base-action button is contextual:

- possession-side shot encounter → **Tiro**;
- goalkeeper response → **Parata**;
- possession-side dribble or midfield progression → **Dribbling**;
- defensive response or midfield stop → **Difesa**.

A player without a configured move, including Season 1 Free Agents, simply sees the relevant contextual base-action button.

## 19. RTG team power and lineup caps

Main-match eligibility uses a displayed **RTG Team Power**, not raw average overall.

RTG Team Power:

- is computed from the 11 starters only;
- is anchored primarily in level-20 player strength;
- includes a moderate contribution from each player's active role-compatible move;
- does not include element advantage because element is opponent-dependent.

The exact aggregation function is calibrated with Season 1 roster simulation before merge, but it must preserve the approved caps below.

Team Power and composition constraints are validated:

- before kickoff;
- again after halftime changes.

Bench strength alone does not count toward the cap until those players enter the XI.

## 20. Manual Season 1 match constraints

A **Recluta S1** is a player obtained from the RTG S1 vending machine after that player's team has been defeated. Free Agents imported from normal runs do not count as S1 recruits.

A **recent recruit** belongs to one of the most recently defeated teams specified by the rule.

| Main match | RTG Team Power cap | Composition requirement |
|---|---:|---|
| Occult | ≤75 | none |
| Wild | ≤77 | at least 1 S1 recruit |
| Brainwashing | ≤79 | at least 2 S1 recruits |
| Otaku | ≤77 | at least 2 S1 recruits, including at least 1 from the last 2 defeated teams |
| Shuriken | ≤80 | at least 3 S1 recruits, including at least 1 from the last 2 defeated teams |
| Farm | ≤81 | at least 3 S1 recruits, including at least 1 from the last 2 defeated teams |
| Kirkwood | ≤83 | at least 4 S1 recruits, including at least 2 from the last 3 defeated teams |
| Royal Academy | ≤86 | at least 4 S1 recruits, including at least 2 from the last 3 defeated teams |
| Zeus | ≤87 | at least 5 S1 recruits, including at least 2 from the last 3 defeated teams |
| Raimon | ≤87 | at least 6 S1 recruits, including at least 3 from the last 3 defeated teams |

There are no player-specific mandatory-card requirements in Season 1.

There are no extra rarity caps in the S1 baseline. Strong cards are controlled by RTG Team Power and composition constraints.

Secondary matches use only their strength-band eligibility, without S1 recruit-composition requirements.

## 21. S1 vending machine

There is one vending machine for Season 1.

Defeating a main team:

- permanently marks that team defeated for RTG;
- adds that team's players to the S1 vending-machine pool;
- does **not** grant a free pull.

Pull cost is fixed at **300 RTG Tokens**.

The machine first rolls card rarity using RTG-specific weights, then selects uniformly among currently unlocked players of that rarity.

Season 1 rarity weights:

| Rarity | S1 rate | S1 state |
|---|---:|---|
| Normale | 40% | active |
| Buono | 27% | active |
| Forte | 18% | active |
| Elite | 10% | active |
| Mondiale | 5% | active |
| Leggenda | 0% | disabled |

`Leggenda` is part of the RTG rarity model from day one even though S1 contains no active Leggenda cards.

If an active rarity currently has no unlocked players, it is removed from that pull and the remaining active weights are renormalized.

The machine does not reroll owned players. An owned player may therefore be selected as a duplicate.

## 22. Duplicate refunds

Duplicates never upgrade the player.

They immediately refund RTG Tokens based on the rarity of the card pulled:

| Rarity | Refund |
|---|---:|
| Normale | 40 |
| Buono | 60 |
| Forte | 85 |
| Elite | 120 |
| Mondiale | 160 |
| Leggenda | 300 |

A duplicate Leggenda refunds the full 300-token pull cost.

## 23. Secondary rewards

A secondary-match win gives one of these token amounts:

| Reward | Probability |
|---:|---:|
| 100 | 70% |
| 110 | 20% |
| 125 | 8% |
| 150 | 2% |

The reward distribution is constant throughout RTG and is not increased by Season or map depth.

The sampled reward is committed atomically with match completion so reload cannot reroll the reward.

Loss/draw/abandon = 0 Tokens.

## 24. Main-match first-clear rewards

Main-match rewards are one-time only:

| Main match | RTG Tokens |
|---|---:|
| Occult | 210 |
| Wild | 225 |
| Brainwashing | 240 |
| Otaku | 255 |
| Shuriken | 285 |
| Farm | 330 |
| Kirkwood | 390 |
| Royal Academy | 465 |
| Zeus | 540 |
| Raimon | 630 |

Checkpoint rollback never makes a claimed first-clear reward claimable again.

## 25. Persistence architecture

Season 1 RTG is **local IndexedDB only**.

No RTG cloud sync is implemented in this scope.

To avoid migration risk to the existing permanent-account IndexedDB, RTG uses a dedicated database:

```
DB name: inazumaRoadToGlory
DB version: 1
```

The preferred S1 persistence model is one compact authoritative campaign aggregate in a dedicated object store so mutations spanning tokens, map progression, lives, gacha state and active match can be committed in one IndexedDB transaction.

Static player/team/move/map definitions are not duplicated into persistent state. Persist IDs, seeds, counters and compact snapshots only where required for deterministic resume.

RTG reads permanent Free Agent unlock entitlement from the existing canonical account source but does not mutate it.

## 26. Required persisted RTG state

The campaign state must be schema-versioned and contain at least:

- campaign identity / schema version;
- active Season ID;
- current map node / furthest progression;
- checkpoint identity;
- current lives;
- defeated main team IDs;
- completed / first-clear main match IDs;
- owned RTG player IDs obtained from vending machines;
- RTG Token balance;
- vending-machine state required for deterministic/atomic pulls;
- saved S1 lineup preset:
  - formation;
  - starter IDs;
  - bench IDs;
  - active role variant where needed;
- active match state or null.

Active match state must be sufficient to resume exactly:

- stable match ID;
- match type and node;
- attempt number / seed;
- generated opponent snapshot for secondary matches;
- current period/minute/action index;
- score;
- possession / action phase as needed by the encounter engine;
- lineup snapshot / current halftime-adjusted lineup;
- remaining move uses by canonical player ID;
- decisions and resolved events needed to resume deterministically;
- extra-time / shootout state when applicable.

## 27. Atomicity and anti-exploit rules

Every logical RTG action that changes durable state must commit atomically.

Examples:

- gacha pull = spend 300 + roll result + add ownership or refund duplicate;
- main victory = mark clear + unlock team pool + award first-clear tokens + move progression;
- secondary victory = resolve sampled reward + add tokens + close active attempt;
- main loss = resolve attempt + decrement life + apply checkpoint rollback if needed;
- halftime confirm = validate new XI + persist lineup + persist remaining uses before second half;
- encounter choice = persist the canonical next match state before success presentation.

The UI must not show durable success before the IndexedDB transaction succeeds.

## 28. Reload, crash and abandonment behavior

Reload/close during an active match resumes the exact same match:

- same opponent;
- same score;
- same action state;
- same remaining move uses;
- same seed;
- same already-resolved choices;
- same extra-time / shootout state.

Reload must never:

- reroll a secondary opponent;
- reroll a reward;
- restore consumed move uses;
- restore a spent gacha cost without rolling;
- duplicate a first-clear reward.

Explicit abandon follows Section 7 rules.

## 29. Architecture boundaries

RTG must live in dedicated modules. `js/app.js` may only provide minimal composition/wiring.

Expected domain boundaries:

- RTG state/persistence repository;
- RTG Season 1 rules/data;
- RTG player-version resolver;
- RTG vending machine;
- RTG team-power/eligibility;
- RTG match engine;
- RTG AI policy;
- RTG penalty engine;
- RTG map/controller;
- RTG squad/controller;
- RTG match presentation.

The existing normal `MatchSimulator` is not repurposed into this interactive match engine. Shared read-only catalogs, player identity helpers, move catalogs and visual resolvers may be reused through explicit interfaces.

## 30. Season 1 acceptance criteria

Season 1 RTG is complete only when:

1. access is blocked below the 15-Free-Agent valid-lineup gate;
2. all permanently unlocked Free Agents are visible/usable in RTG;
3. the S1 map contains the approved 10 main and 18 secondary nodes in order;
4. 2-life checkpoint behavior is crash-safe;
5. main-match constraints and halftime revalidation work;
6. S1 vending pool unlocks only defeated-team players and uses the approved rates/cost/refunds;
7. token rewards match the approved tables and cannot be farmed through reload exploits;
8. player level is always 20;
9. configured moves have two shared uses per player and role-dependent dual-role behavior, while Free Agents without moves remain normal-action-only;
10. matches are not pre-resolved and produce outcomes from encounter state;
11. regulation produces the approved action/decision pacing;
12. base strength, move bonus, element modifiers and 10–90 probability clamp are covered by deterministic tests;
13. AI decisions are hidden until the user confirms and do not inspect the user's current choice;
14. main draws resolve through extra time and penalties;
15. secondary draws give no reward and no life loss;
16. normal penalties use hidden left/center/right choices and move penalties use the approved overrides;
17. reload resumes active matches exactly;
18. RTG writes only to its dedicated IndexedDB and does not write to cloud or normal run state;
19. existing normal runs, Album, Development, Hall, cloud save and MatchSimulator behavior remain unchanged.
