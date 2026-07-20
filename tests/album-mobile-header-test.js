"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const season = JSON.parse(fs.readFileSync(path.join(root, "data/IE1_season_compact.json"), "utf8"));

const rosterMarkupStart = appJs.indexOf('<header class="topbar album-topbar album-roster-header">');
assert(rosterMarkupStart >= 0, "Album roster must expose a scoped header class");
const rosterMarkup = appJs.slice(rosterMarkupStart, appJs.indexOf('<section class="album-player-grid"', rosterMarkupStart));
assert(rosterMarkup.includes('album-roster-logo'), "Team logo must have a roster-header-specific hook");
assert(rosterMarkup.includes('album-roster-breadcrumb'), "Breadcrumb must have a roster-header-specific hook");
assert(rosterMarkup.includes('album-roster-name'), "Team name must have a roster-header-specific hook");
assert(rosterMarkup.includes('album-roster-progress'), "Unlocked counter must have a roster-header-specific hook");
assert(rosterMarkup.includes('album-roster-action'), "Teams action must have a roster-header-specific hook");
assert(rosterMarkup.includes('id="album-back-teams"') && rosterMarkup.includes('>Squadre</button>'), "Squadre must remain the existing button action");
assert(rosterMarkup.includes('${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)} giocatori sbloccati'), "Unlocked counter data must remain dynamic");
assert(appJs.includes('${players.map((player) =>') && appJs.includes('playerCard(player, { button: true, level: player.maxLevel || 20, database: player.albumDatabase })'), "Album player cards must still be rendered through the existing shared card loop");

assert(css.includes('@media (max-width: 700px)'), "Album mobile styles must use the existing mobile breakpoint");
assert(css.includes('grid-template-columns: auto minmax(0, 1fr) auto'), "Mobile roster header must expose compact logo/text/action columns");
assert(css.includes('grid-template-areas: "logo breadcrumb breadcrumb" "name name name" "progress progress action"'), "Mobile roster header must use three logical rows without reserving the action column above");
assert(css.includes('.album-roster-title, .album-roster-heading { display: contents; }'), "Mobile roster wrapper elements must not create nested columns that restrict text");
assert(css.includes('.album-team-logo--header { width: 48px; height: 48px;'), "Mobile header logo must be compact in the requested 42-52px range");
assert(css.includes('.album-roster-logo img') && css.includes('object-fit: contain'), "Mobile header logo image must keep proportions with object-fit contain");
assert(/\.album-roster-breadcrumb \{[^}]*white-space:\s*nowrap[^}]*word-break:\s*normal[^}]*overflow-wrap:\s*normal/.test(css), "Mobile breadcrumb must be forced to one normal, unbroken line");
assert(/\.album-roster-breadcrumb \{[^}]*font-size:\s*clamp\(10px, 3vw, 13px\)/.test(css), "Mobile breadcrumb font must be reduced responsively from the base eyebrow size");
assert(/\.album-roster-name \{[^}]*grid-area:\s*name[^}]*width:\s*100%[^}]*max-width:\s*none[^}]*white-space:\s*nowrap[^}]*word-break:\s*normal[^}]*overflow-wrap:\s*normal[^}]*text-overflow:\s*clip/.test(css), "Mobile team name must occupy the full header width and never wrap, break, or ellipsize");
assert(/\.album-roster-name \{[^}]*font-size:\s*clamp\(2rem, 8\.7vw, 3rem\)/.test(css), "Mobile team name font must be reduced responsively from the previous oversized value");
assert(!/\.album-roster-name \{[^}]*-webkit-line-clamp/.test(css), "Mobile team name must not use multiline clamping");
assert(!/\.album-roster-name \{[^}]*text-overflow:\s*ellipsis/.test(css), "Mobile team name must not use ellipsis");
assert(!/\.album-roster(?:-breadcrumb|-name|-progress)[^{]*\{[^}]*(?:word-break:\s*break-all|overflow-wrap:\s*anywhere)/.test(css), "Mobile roster header text must not use break-all or overflow-wrap anywhere");
assert(/\.album-roster-action \{[^}]*grid-area:\s*action[^}]*justify-self:\s*end[^}]*min-height:\s*44px[^}]*white-space:\s*nowrap/.test(css), "Mobile Squadre button must stay in the bottom-right action area with a tap-friendly target");
assert(/\.album-roster-progress \{[^}]*grid-area:\s*progress[^}]*text-align:\s*left[^}]*white-space:\s*nowrap/.test(css), "Mobile unlocked counter must stay left-aligned on one line");

const names = season.teams.map((team) => team.teamName);
assert.deepEqual([...names].sort(), ["Brainwashing", "Farm", "Kirkwood", "Occult", "Otaku", "Raimon", "Royal Academy", "Shuriken", "Wild", "Zeus"], "Season 1 team list must remain unchanged for coverage");
const longest = names.reduce((a, b) => (b.length > a.length ? b : a), "");
assert.equal(longest, "Royal Academy", "The longest Season 1 team name must be covered by the one-line mobile header rules");
for (const viewport of [360, 390, 430]) {
  const innerWidth = viewport - 24 - 32; // album padding + header padding at the existing mobile breakpoint
  const titlePx = Math.min(48, Math.max(32, viewport * 0.087));
  const approxLongestWidth = longest.length * titlePx * 0.54;
  assert(approxLongestWidth < innerWidth, `${longest} should fit on one line at ${viewport}px`);
  const breadcrumbPx = Math.min(13, Math.max(10, viewport * 0.03));
  const breadcrumbWidth = "ALBUM → INAZUMA ELEVEN 1".length * breadcrumbPx * 0.62;
  const breadcrumbSpace = innerWidth - 48 - 12;
  assert(breadcrumbWidth < breadcrumbSpace, `Breadcrumb should fit on one line at ${viewport}px`);
}

const desktopBlock = css.match(/@media \(min-width: 781px\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert(!desktopBlock.includes("album-roster-header"), "Desktop media rules must not redefine the Album roster header");

console.log("album-mobile-header-test passed");
