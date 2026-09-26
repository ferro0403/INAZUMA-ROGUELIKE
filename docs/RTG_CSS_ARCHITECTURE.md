# Road to Glory CSS architecture

Baseline: `feature/rtg-shop-development` at `b9b821e091f708af36878952b8e9504d81f8435a`.

## Goal

RTG must have a deterministic cascade: every visual component has one presentation owner. Fixes must modify that owner instead of adding another finishing/override stylesheet.

## Current debt (baseline)

The current cascade is layered as follows:

1. `road-to-glory.css` — historical RTG implementation and original presentation.
2. `rtg-theme-base.css` — explicitly loaded after the legacy sheet and overrides the same RTG surfaces.
3. `rtg-theme-core.css` — imports `rtg-theme-base.css` and overrides the same surfaces again.
4. `rtg-theme.css` — imports `rtg-theme-core.css` and contains later fixes/polish.
5. Vending/version-specific RTG sheets add further presentation rules.

This means selector order and `!important` frequently decide ownership instead of component boundaries.

## Target ownership

The migration must converge on these responsibilities. This is an ownership map, not permission to create arbitrary patch files.

- `rtg-foundation.css`: RTG tokens, screen scope, typography defaults, focus/disabled states, shared RTG buttons and shared modal shell.
- `rtg-shell.css`: top bars, status HUD, bottom navigation, page containers and global responsive shell.
- `rtg-run.css`: campaign journey, route maps, nodes, requirements and run-only surfaces.
- `rtg-squad.css`: squad workspace, pitch, bench, replacement picker and RTG squad card placement. Canonical player-card anatomy remains owned by the shared game card styles.
- `rtg-match.css`: prematch, live match, scoreboard, ticker, duel presentation, result and penalty presentation.
- `rtg-vending.css`: the complete vending machine, wallet, pull/reveal presentation and its responsive rules.
- `rtg-economy.css`: shop/development/legacy economy screens when they share RTG-specific economy primitives; screen-specific rules remain scoped below their screen root.
- `rtg-responsive.css`: only cross-component breakpoint coordination that genuinely cannot live with an owner. Component-specific media queries stay with their owner.

During migration the historical files may remain loaded to preserve visual parity, but new presentation rules must go to the target owner and migrated selectors must be removed from their old owner in the same change.

## Mandatory rules

1. **One selector, one owner.** A component selector must not be redefined in a later RTG file merely to win the cascade.
2. **No finishing sheets.** Do not add files named or functioning as `fix`, `polish`, `tuning`, `override`, `depth`, `perspective`, `v2`, `v3`, etc. Modify the owning component file.
3. **RTG scope is mandatory.** RTG-only selectors must be rooted in an RTG surface (`.rtg-run-screen`, `.rtg-squad-shell`, `.rtg-prematch-shell`, `.rtg-match-shell`, `.rtg-modal`, `.rtg-development-screen`, `.rtg-shop-screen`, or another explicit RTG root).
4. **`!important` is exceptional.** New `!important` is allowed only when overriding an external/shared legacy declaration that cannot yet be migrated. The declaration must carry an adjacent comment naming that legacy dependency. Existing `!important` is migration debt, not precedent.
5. **No global card forks.** RTG may control card placement/size in an RTG container; rarity colors and canonical player-card anatomy remain shared owners unless a deliberate global card change is requested.
6. **Tokens before literals.** Repeated RTG ink/paper/yellow/border/shadow/spacing values belong in foundation custom properties. A component may define a local token only when the value is truly component-specific.
7. **Responsive rules stay with the component.** Do not append generic mobile fixes at the end of an unrelated file. `rtg-responsive.css` is reserved for coordination among multiple owners.
8. **State is explicit.** Prefer semantic state classes/attributes (`.active`, `.is-*`, `[aria-*]`) over selectors that depend on accidental DOM depth.
9. **Keep specificity low.** Prefer one RTG root + one component class. Deep descendant chains and selector duplication require justification.
10. **No visual redesign during cleanup.** CSS migration must preserve the approved Netlify appearance. Visual changes are separate changes after ownership is deterministic.

## Migration order

1. Freeze this document and add automated architecture guardrails.
2. Inventory the active RTG stylesheet load order and duplicate selector ownership.
3. Extract foundation/tokens without changing computed presentation.
4. Migrate shell/run ownership.
5. Migrate squad ownership.
6. Consolidate vending ownership, deleting superseded vending finishing layers.
7. Migrate prematch/match/duel ownership.
8. Migrate shop/development/legacy economy presentation.
9. Remove `rtg-theme-base.css`, `rtg-theme-core.css`, `rtg-theme.css` and historical declarations only after their selectors have an equivalent single owner.
10. Run desktop/mobile visual verification plus the full regression suite before merging.

## Definition of done

- RTG has a documented single owner for every presentation domain.
- No RTG feature requires adding a later override stylesheet to modify an existing component.
- No unexplained new `!important` declarations.
- Historical theme layers are removed from the HTML/import graph after migration.
- Existing RTG behavior and approved appearance are preserved on mobile and desktop.
- The architecture guard runs in CI and rejects regressions in these rules.
