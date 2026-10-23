# RTG — second visual pass

Baseline: Netlify preview #451, branch `style/rtg-final-ui-polish`,
SHA `2adf4daff3b009d4582440f6ec6e49a6889df794`.
Deploy `6aac890f001ffa00080c015c` verified ready against that SHA.
New branch `style/rtg-second-visual-pass`; no main merge/rebase.

## Changes

The first pass left decorative backgrounds below existing important declarations,
and a floating close button added unwanted space to modal headers. This pass edits
existing CSS owners: a black/gold Hub hero, dark section strips, visible field lines,
stronger prematch composition, compact white controls, connected match timeline,
full-width modal title bands and a richer capsule-machine backdrop.
Five-player pitch rows wrap at mobile widths without shrinking canonical cards.
The close control is absolutely positioned and retains a 44px target.

Only three existing CSS sheets and their index cache keys change production output.
No production JavaScript, view renderer, data, economy, RNG, persistence or save change.
Player-card anatomy rules are byte-identical to the verified baseline.
`tests/rtg-visual-review.html` is an isolated manual review fixture using existing
view renderers and synthetic roster/match data. It runs no controller/storage code,
writes no saves, and is not linked from the game. Widths: 320/390/430/768.

## Checks before push

- RTG: 53/53 tests pass; no test assertions edited.
- All 161 production JS files pass node --check; fixture module also passes.
- git diff --check passes against the exact Netlify baseline.
- Protected js/ and data/ directories: zero diff.
- Card anatomy selectors in all edited sheets: identical to baseline.

Native Safari/iPhone interaction remains a manual gate. Do not merge this draft
until the deployed preview has been checked on the target device.

## Rendered follow-up

Reviewed deployed fixture screenshots for squad, prematch, match, catalog, picker,
vending and Hub at 390px. This exposed inherited opponent crest/name grid placement
and dark picker/catalog text. Corrected both before handoff. Added 320px grid
adaptation around unchanged cards. Full suite: 285/332 pass, the same 47 failures
as the pristine baseline; no new failing test. Native Safari is not verified.
