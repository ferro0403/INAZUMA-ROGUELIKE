# RTG final UI polish — review candidate

## Exact baseline

PR #447, `preview/rtg-netlify`, commit `663339f0d55f544c7a2e4b1448d3c515e1e3baa6`.
Verified against GitHub head, successful Netlify commit status, bot deploy comment and
Netlify deploy `6aac4537125c35000805a789` (ready, review 447, same branch/SHA).
The SHA in the PR description is stale; it was not used. No main merge/rebase.
Branch: `style/rtg-final-ui-polish`; PR targets the baseline branch so its diff is only this polish.

## Scope and visual language

Existing run references: `game.css` home/club controls, five-match section headers,
formation badges, hard ink borders and yellow CTAs. RTG load order remains
`game.css` → `road-to-glory.css` → `rtg-theme.css` (imports `rtg-theme-base.css`).
No new override stylesheet. Existing owners updated; obsolete mobile scoreboard
corrections removed. Theme !important count reduced from 500 to 469.

- Hub: left-aligned hero, clearer title/CTA rhythm, diagonal yellow field and icon tiles.
- Match: horizontal clock rail above a wider score row, larger crests, wrapping team names;
  compact status band and connected action timeline instead of repeated heavy boxes.
- Formation: shared green field markings, clearer team switching and framed section headers.
- Squad: compact 32px swap controls, section accents, structured management buttons,
  framed save strip and bottom safe-area spacing.
- Modal/catalog: white shell, 16px search inputs, 44px filters/close target, stronger headers.
- Vending: subtle radial sports pattern, dark wallet strip and aligned probability rows.
- Prematch: crest-led matchup, central VS and grouped formation/OVR information.

No new text or gameplay controls. Shared tokens remain local to RTG.

## Safety

All `js/` (including view renderers, controller, RNG and storage) and `data/` files are
byte-identical to the baseline. Every CSS rule selecting player-card anatomy,
portraits, player names, role, OVR or level is unchanged in all three edited sheets.
Only RTG-specific Hub selectors changed in `game.css`. No save schema, economy,
transaction, migration, recovery, cloud or old-save compatibility changes.

## Verification and limitations

Full existing Node suite: 332 files, initially 284 PASS / 48 FAIL. Of those failures,
47 reproduce on the pristine baseline. The one changed presentation assertion
required nowrap team names; it was explicitly updated to expect wrapping, matching
the requested mobile readability. It now passes: aggregate 285 PASS / 47 pre-existing
FAIL / 0 skipped. Existing gameplay tests were not modified or weakened.
Fresh RTG tests and all browser-script syntax checks run separately before publication.
Whitespace diff checked against the exact baseline.

The ten supplied screenshots were inspected, including a second source-level review
of mobile cascade ownership. This is NOT a completed rendered second polish pass.
Local browser verification was blocked: the remote browser rejects localhost, and
local Playwright has no browser binary; browser installation repeatedly timed out.
No claim of verified Safari/iPhone, zero overflow, uncut cards, scrolling or safe-area
behavior is made. The 500-campaign soak jobs were not run locally; this change is CSS-only.

Keep this PR DRAFT and do not merge until the new preview has passed the requested
10-screen visual review on iPhone/Safari, including both formation tabs, 3-5-2 at 320px,
long team names, picker/modal scroll, keyboard-open search, requirements disclosure,
save strip and bottom navigation. The baseline PR is preserved and is not updated.

## Deploy preview

Netlify Deploy Preview retrigger requested for PR #451 on 2026-09-18.
