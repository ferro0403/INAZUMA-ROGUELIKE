"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css", "rtg-theme.css"), "utf8");
const squadView = fs.readFileSync(path.join(root, "js", "road-to-glory", "rtg-squad-view.js"), "utf8");
const runView = fs.readFileSync(path.join(root, "js", "road-to-glory", "rtg-run-view.js"), "utf8");
const matchView = fs.readFileSync(path.join(root, "js", "road-to-glory", "rtg-match-view.js"), "utf8");

assert(
  css.includes('url("../assets/home/inazuma-stadium-mobile-light.jpeg")'),
  "RTG run/squad/prematch should reuse the real mobile stadium background from the game assets"
);
assert(
  css.includes('url("../assets/home/inazuma-stadium-desktop-light.jpeg")'),
  "RTG should switch to the real desktop stadium background on wider screens"
);
assert(
  /\.rtg-prematch-shell\.rtg-prematch-revolution\s*>\s*\.rtg-prematch-topbar\s*\{[^}]*display\s*:\s*none\s*!important/s.test(css),
  "Pre-match must remove the redundant Road to Glory title band"
);
assert(
  /\.rtg-prematch-matchup::before\s*\{[^}]*background\s*:\s*#ffd21f/s.test(css),
  "Pre-match matchup banner should use a strong gold graphic rail instead of a blank white panel"
);
assert(
  /\.rtg-prematch-matchup::after\s*\{[^}]*display\s*:\s*none\s*!important/s.test(css),
  "Pre-match banner must remove the decorative black wedge that overlaps the opponent side"
);
assert(
  /\.rtg-prematch-matchup\s+\.rtg-matchup-vs\s+span\s*\{[^}]*background\s*:\s*#111216\s*!important[^}]*color\s*:\s*#ffd21f\s*!important/s.test(css),
  "Pre-match VS must be a deliberate black/gold centerpiece"
);
assert(
  /compactPlayerCardMarkup\(player,\s*\{/s.test(squadView) && /playerCard\(entry,\s*"catalog"\)/s.test(squadView),
  "RTG catalog must reuse the game's existing compactPlayerCardMarkup renderer"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4\s*,\s*minmax\(0\s*,\s*84px\)\)\s*!important/s.test(css),
  "RTG catalog should use the same four-across compact-card footprint as the squad"
);
assert(
  !/\.rtg-modal\s+\.rtg-catalog-grid\s+\.rtg-catalog-player-card\s+\.player-portrait-wrap/.test(css),
  "RTG catalog must not override the normal card portrait anatomy"
);
assert(
  !css.includes("width:min(152px,100%)!important"),
  "RTG catalog must not force oversized 152px cards"
);
assert(
  /data-rtg-vending-machine/.test(runView) && /rtg-vending-machine-v5/.test(runView),
  "RTG vending should expose the polished lightweight 2.5D machine"
);
assert(
  /\.rtg-vending-machine-v5\s*\{[^}]*perspective\(900px\)/s.test(css),
  "RTG vending should use subtle perspective rather than a full WebGL model"
);
assert(
  /\.rtg-vending-window-v5\s*\{[^}]*box-shadow/s.test(css) && /\.rtg-vending-depth-v5\s*\{/s.test(css),
  "RTG vending should keep dimensional glass and cabinet depth"
);
assert(
  /rtg-vending-crank-turn/.test(css) && /rtg-vending-capsule-rattle/.test(css),
  "RTG vending pull should retain a lightweight crank and capsule animation"
);

assert(
  /const events = Array\.from\(match\.log \|\| \[\]\);/.test(matchView),
  "RTG action recap must retain and render the complete match log instead of only the last four actions"
);
assert(
  !/Array\.from\(match\.log \|\| \[\]\)\.slice\(-4\)/.test(matchView),
  "RTG action recap must not truncate the match log to four entries"
);
assert(
  /\.rtg-match-shell\.rtg-match-revolution\s*\{[^}]*background\s*:\s*#fff\s*!important/s.test(css),
  "Live RTG match should use true white as its main surface instead of the old cream background"
);
assert(
  /\.rtg-match-scoreboard\.rtg-match-topbar\s*\{[^}]*background\s*:\s*#111216\s*!important/s.test(css),
  "Live scoreboard should use the game's true black treatment"
);
assert(
  /\.rtg-match-shell\.rtg-match-revolution\s+\.rtg-match-scoreboard\s+\.rtg-score-capsule\s*\{[^}]*background\s*:\s*#ffd21f\s*!important/s.test(css),
  "Live scoreboard score capsule should keep the strong game gold even against legacy specificity"
);
assert(
  /\.rtg-match-shell\.rtg-match-revolution\s+\.rtg-match-scoreboard\s+\.rtg-score-team\s+b\s*\{[^}]*white-space\s*:\s*normal\s*!important[^}]*overflow\s*:\s*visible\s*!important/s.test(css),
  "Live scoreboard must wrap long team names without ellipsis or overlapping the score"
);
assert(
  /\.rtg-live-commandbar\s*\{[^}]*background\s*:\s*#fff\s*!important[^}]*border\s*:\s*3px solid #111216\s*!important/s.test(css),
  "Possession/zone/status banner should be true white with a hard black frame"
);
assert(
  /\.rtg-match-event-feed\s*\{[^}]*background\s*:\s*#fff\s*!important[^}]*border\s*:\s*3px solid #111216\s*!important/s.test(css),
  "Action recap should use the white/black/gold live-match treatment"
);
assert(
  /\.rtg-match-shell\s+\.rtg-duel-result-banner\.is-win\s*\{[^}]*linear-gradient\([^}]*#d9efff/s.test(css),
  "A duel won by the user should use a redesigned blue result banner"
);
assert(
  /\.rtg-match-shell\s+\.rtg-duel-result-banner\.is-loss\s*\{[^}]*linear-gradient\([^}]*#ffe0dc/s.test(css),
  "A duel won by the opponent should use a redesigned red result banner"
);

assert(
  /\.rtg-duel-versus-board\s+\.rtg-duel-panel-heading\s*\{[^}]*display\s*:\s*none\s*!important/s.test(css),
  "Live duel should remove the redundant TU/DIFESA and opponent/action banner"
);
assert(
  /\.rtg-duel-choice-head\s*>\s*span\s*\{[^}]*display\s*:\s*none\s*!important/s.test(css),
  "Live duel should hide the redundant first-tap/second-tap explanation"
);
assert(
  /\.rtg-duel-versus-board\s+\.rtg-duel-portrait-panel\s*\{[^}]*border-radius\s*:\s*8px\s*!important/s.test(css),
  "Live duel player cards should use subtly rounded corners"
);
assert(
  /\.rtg-match-shell\.rtg-match-revolution\s+\.rtg-match-scoreboard\s+\.rtg-abandon-button\s*\{[^}]*height\s*:\s*34px\s*!important[^}]*background\s*:\s*#c94b52\s*!important[^}]*border-radius\s*:\s*6px\s*!important/s.test(css),
  "Live match abandon control should be a compact red labeled button"
);

assert(
  /\.rtg-duel-card--clean\s+\.rtg-duel-versus-board:not\([^}]*\)\s+\.rtg-duel-portrait-panel\s*\{[^}]*grid-template-rows\s*:\s*auto\s*!important[^}]*height\s*:\s*auto\s*!important[^}]*min-height\s*:\s*0\s*!important/s.test(css),
  "Live duel cards should collapse the orphaned fixed row after hiding the panel heading"
);

console.log("rtg-final-visual-pass-test: PASS");
