# Shared Match Engine extraction

## Dependency map and ownership

The production path is: node dispatch (**match entry**) → durable `activeMatch` → read-only pre-match render → disposable preview → frozen simulation clone → `match-simulation-start` canonical commit → playback UI/timer → one durable timeline event per step → score/log projection → skip or natural completion → type-dispatched resolution → durable completed result → guarded Continue → `match-post-navigation` (or the existing Boss flow) → destination renderer.

Before this extraction, `app.js` owned identity, preview/simulation, playback timers, shared match rendering, resolution dispatch and Continue. It also retained the domain completion functions. After extraction, `MatchControllerRuntime` owns the generic lifecycle, while `app.js` wires the engine and retains domain mutations (`completeFiveMatch`) and adapters to the already extracted Boss and special-match controllers.

| Class | Ownership after extraction |
| --- | --- |
| A. Generic match engine | `js/match/match-controller.js`: identities, clone, preview freeze, start, playback, skip, force outcome, dispatch and Continue |
| B. 5v5-specific | lineup slot adapters, opponent creation, reward/resolution mutation remain injected from `app.js` / FiveVFive controller |
| C. Boss-specific | Boss metadata, reward, PostBoss and recovery remain in `BossFlowController` and are injected callbacks |
| D. `special_match`-specific | opponent metadata, rewards and completion remain in SpecialMatch controllers and are injected callbacks |
| E. Generic UI | shared 5v5/11v11 pre-match shell, scoreboard, log, controls and result projection are rendered by the engine |
| F. Persistence boundary | injected `persistGameplayMutation`; `commitMatchMutation` validates the canonical identity before every mutation |

The engine's read model adapters provide names, players, formations, levels and emblems without changing XI calculation or order. No Firebase dependency and no direct `RunState.save` call exists in the extracted module.

## Persistence, callback and timer contracts

`startMatchSimulation` preserves the strict order: locate canonical match → clone → freeze preview and stable seeded ID → assign simulating state → canonical commit → only then update controls/start the playback timeout. A failed commit clears the timeout, reloads mounted state from canonical runtime, releases start/resolution locks and leaves the same mounted action retryable.

One `ui.matchPlaybackTimer` timeout is owned by the engine. It is cleared before start/restart, skip, completed-unresolved resume and persistence-failure suspension. Each timer callback refreshes the live run and validates canonical identity through its transaction. Simulate uses `matchStartLocked`; canonical state and identity reject duplicate/stale Skip, Continue and timer callbacks; navigation records `postMatchNavigationApplied` durably.

A pre-match render clones the match before calling `ensureMatchPreview`; the preview seed, simulation, stable ID, score and timeline therefore never decorate canonical state. Freezing may change `matchId`, because the stable ID contains the real seed. A same-mounted Continue without an explicit identity follows the live canonical match; a callback carrying an explicit identity rejects a replacement match.

## Save-failure matrix

| Boundary / labels | Failure behavior |
| --- | --- |
| Start: `match-simulation-start` | stale/quota rolls back, no modal/result, timer stopped, retry enabled |
| Playback/skip: `match-playback-event`, `match-playback-completed`, `match-playback-skip` | canonical cursor/result wins, mounted runtime realigns, timer stopped |
| Resolution: `five-match-resolution`, `special-match-resolution`, Boss controller labels | no reward/result success before durable resolution; idempotent retry |
| Continue: `match-post-navigation` / Boss handoff labels | no false navigation; ambiguous canonical-verification recovery delegates to the existing canonical classifier |

## Refresh/reopen matrix

For all three match types, pre-match reopens as pre-match; simulating and mid-playback reopen from the canonical `revealedCount`; completed-unresolved re-enters resolution; resolution-applied completed renders Continue; pending navigation resumes from its durable domain flow. Playback cursor **is** persisted one event at a time; no new persistence schema was introduced.

## Parity and residual risks

Seed generation, `RunStatistics.createStableMatchId`, `MatchSimulator`, strength/probability formulas, winner, score and timeline generation are unchanged. Existing fixed-seed and retry characterization tests compare those payloads. UI strings and controls are moved without redesign. The remaining risk is the intentionally broad dependency-injection surface while `app.js` still owns 5v5/domain adapters; the next decomposition should not move GameOver/finalization into this engine.
