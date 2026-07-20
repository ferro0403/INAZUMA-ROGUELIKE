"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");

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

const mobileAlbumBlock = css.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert(mobileAlbumBlock.includes('.album-roster-header') && mobileAlbumBlock.includes('grid-template-areas: "title title" "progress action"'), "Mobile roster header must place progress left and Squadre action bottom-right");
assert(mobileAlbumBlock.includes('.album-roster-title') && mobileAlbumBlock.includes('grid-template-areas: "logo breadcrumb" "name name"'), "Mobile roster title must put logo and breadcrumb on top, then full-width name below");
assert(mobileAlbumBlock.includes('.album-team-logo--header { width: 48px; height: 48px;'), "Mobile header logo must be compact in the requested 42-56px range");
assert(mobileAlbumBlock.includes('.album-roster-logo img') && mobileAlbumBlock.includes('object-fit: contain'), "Mobile header logo image must keep proportions with object-fit contain");
assert(mobileAlbumBlock.includes('.album-roster-name') && mobileAlbumBlock.includes('-webkit-line-clamp: 2') && mobileAlbumBlock.includes('overflow-wrap: anywhere'), "Mobile team names must be allowed up to two wrapped lines");
assert(mobileAlbumBlock.includes('.album-roster-progress') && mobileAlbumBlock.includes('text-align: left'), "Mobile unlocked counter must stay left-aligned");
assert(mobileAlbumBlock.includes('.album-roster-action') && mobileAlbumBlock.includes('min-height: 44px') && mobileAlbumBlock.includes('white-space: nowrap'), "Mobile Squadre button must keep a tap-friendly visible target");
const desktopBlock = css.match(/@media \(min-width: 781px\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert(!desktopBlock.includes("album-roster-header"), "Desktop media rules must not redefine the Album roster header");

console.log("album-mobile-header-test passed");
