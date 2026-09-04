# Squad and 5v5 configuration extraction boundary

## Dependency map — Squad / 11v11 formation

`SquadControllerRuntime` owns roster role counts, formation eligibility, deterministic lineup/bench rearrangement, lineup/bench swaps, roster reconciliation, readiness validation, and the transactional mutation coordination for formation changes and swaps. It depends on the current local run, the season's 11v11 formations, effective-role and roster resolvers, `GameplayPersistence`, and the protected `RosterInvariants` boundary.

`SquadViewRuntime` owns the squad pitch, formation rows, tactical mini cards, bench, readiness feedback, formation picker, role-switch interaction, selection affordances, and squad-specific handlers. Shared concerns remain injected: player resolution/card markup/details, modal/toast, `FormationLayout`, tactics, navigation, scrolling, `ProfiledSeasonRuntime`, and the persistence boundary. Trade and equipment screens continue to call the generic tactical-card/pitch/bench APIs; they were not folded into the Squad view.

Navigation remains in `app.js`: bottom navigation selects `squad`, local run phase routing calls `renderSquad`, and map/post-boss navigation remains shared orchestration. Initial formation and Draft also remain in `app.js`, because they belong to run onboarding and Draft rather than editing an established squad.

## Dependency map — 5v5 configuration

`FiveVFiveControllerRuntime` owns configuration ensure/status, SmartLineup coordination, and transactional editor commits. The saved shape remains `run.fiveVFive = { formation, slots }`. It delegates the frozen rules (`ensure`, `assign`, `clearSlot`, `changeFormation`, `validate`, and `removeUnavailable`) to the existing `FiveVFive` domain and resolves role/overall from the current local run.

`FiveVFiveViewRuntime` owns the configuration pitch, formation selector, slot cards, filtered roster picker, assign/clear/save interactions, validation feedback, and entry/return UI. Shared cards, player resolution, navigation, toast, scroll, and match-return rendering are injected.

Match-only 5v5 field cards, opponent generation, simulation preview, playback, resolution, lives, and continuation remain in `app.js`. The prematch quick swap calls the narrow controller commit API but stays with match rendering.

## Secondary 11v11 matches

Secondary 11v11 matches are map nodes with `node.type === "special_match"`. The route is `enterNode` / `dispatchNode` → `enterMatchFromNode` → `SpecialMatchRuntime.fromNode` (through `specialMatchFromNode`) → `activeMatch.type === "special_match"` → the shared boss-style `renderMatch` 11v11 presentation and match execution. Their opponent definition comes from `seasonDb.specialMatches`; their user team consumes the normal `run.lineup` and `run.formationId`. They are not 5v5 nodes and no special-match execution moved in this extraction.

## 5v5 prematch characterization and follow-up

The current route is a `five_v_five` map node → `dispatchNode` → `enterMatchFromNode` → configuration validation → `createOrLoadFiveMatch` → persisted `activeMatch` with `state: "pre-match"` → `renderMatch`. The match action button invokes `startMatchSimulation`; playback and resolution remain in `app.js`.

The observed “PRE-PARTITA / IN ATTESA” hang is intentionally not fixed here. Follow-up investigation should focus on the handoff among the persisted `activeMatch.state`, the separately maintained `ui.bossMatchState`, an existing `simulation.state === "pre-match"`, and the start-button guards in `startMatchSimulation`/`renderMatch`. A stale UI state or a pre-existing simulation snapshot can prevent the expected transition even though configuration is valid.

## Persistence notes

Formation changes, lineup/bench swaps, and 5v5 edits retain the ordering: clone/current canonical state → mutate current by stable IDs → validate (`RosterInvariants` for squad writes and `FiveVFive.validate` for save/return) → persist → success UI. A failed save does not run `onCommitted`.

No new direct `RunState.save` was introduced. The legacy direct save in shared bottom-navigation routing when selecting `squad` remains unchanged, as does `ensureCurrentZone`'s legacy save when map normalization reports a non-generated change. Both are outside this extraction's gameplay-write rewrite scope.
