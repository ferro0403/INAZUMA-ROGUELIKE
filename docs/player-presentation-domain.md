# Player presentation domain extraction

## Dependency and ownership map

| Classification | Owner/API | Inputs | Consumers |
|---|---|---|---|
| A — generic player visual | `PlayerVisuals`: `candidates`, `resolve`, `portraitUrl`, `imageFallbackAttributes`, `handleImageError` | player data, dynamic `getPlayerVisualsById`, HTML escaping | Squad, 5v5 editor/match, Inventory, Pull/Recruitment, Album, Hall snapshots, Development, finalization snapshots |
| B — generic player card | `PlayerView.compactCard` | resolved player, visual API, item presenter, card options | Squad, 5v5, Inventory equipment targeting, Hall roster |
| C — player detail view | `PlayerView.detailMarkup` | resolved/current/album/historical player, injected runtime resolution, team/origin and historical-stat presenters | Squad/current, Album/read-only, Hall/historical read-only, Development, Recruitment and Pull detail entry points |
| D — player detail controller | `PlayerDetailController.showFor`, `showRosterPlayer` | modal/toast callbacks, dynamic free-agent database, roster resolution, unequip adapter | all detail-opening consumers |
| E–K — domain-specific | remains in existing Squad, 5v5, Album, Hall, Development, Inventory and Match owners | domain state and persistence | unchanged |
| L — shared utility | `PlayerView.rarityClass`, `statIcon`, `STAT_LABELS` | presentation values only | player views and injected legacy consumers |

The visual dependency is deliberately dynamic: every resolution calls `getPlayerVisualsById()` and never retains the initial mutable map. The view receives already resolved data or explicit resolution adapters. The detail controller invokes `unequipPlayerItem`; it does not implement mutation or persistence.

## Consumer map

| Consumer | Helper/mode | Callback and authority |
|---|---|---|
| Squad | compact card; current detail | roster resolver; optional unequip delegates to Inventory owner |
| 5v5 | compact card and visual helpers | render/read-only card identity; match and lineup mutation remain in 5v5 |
| Inventory | compact card and visuals; current detail entry | equipment persistence remains in Inventory |
| Pull | player card/visual and detail entry | selection/recruitment callbacks remain in Pull/Recruitment |
| Recruitment | detail entry | recruitment mutation remains in Recruitment |
| Album | detail, `mode: album`, read-only | Album unlock/storage remains in Album |
| Hall | compact card; detail, `mode: historical`, read-only | historical stats are injected; Hall storage remains in Hall |
| Development | compact card/detail | effective-player resolution and account mutation remain in Development |
| Match/swap | visual helpers and dedicated match cards | Match/5v5 mutation remains in their owners |
| Finalization | portrait/fullbody resolution for snapshots | finalization and Hall writes remain outside Player Presentation |

## Compatibility and audits

`globalThis.handlePlayerImageError` remains installed before `app.js` can render markup. Existing class names, `data-*`, ARIA attributes, inline error-handler contract, modal classes, current/Album/historical strings, element badge hooks, and inventory/pull copy hooks are unchanged. The post-`app.js` augmentation script order is unchanged.

The new modules contain no RunStorage, gameplay persistence, cloud, Firebase/Firestore, Album/Hall/Development storage, or direct run-field mutation. All app-local capabilities are constructor dependencies. Browser listeners wrap application callbacks rather than passing `MouseEvent` as an application argument.
