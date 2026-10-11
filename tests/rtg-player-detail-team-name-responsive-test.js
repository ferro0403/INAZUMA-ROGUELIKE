"use strict";

const assert=require("assert");
const fs=require("fs");

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("css/player-detail-team-name-fit.css","utf8");
const view=fs.readFileSync("js/player/player-view.js","utf8");
const rtgCss=fs.readFileSync("css/rtg-theme.css","utf8");
const style='css/player-detail-team-name-fit.css?v=20261011-shared-team-ellipsis-1';
assert(html.includes(style),"Responsive shared-detail stylesheet is not loaded");
assert(html.indexOf(style)>html.indexOf("css/rtg-theme.css"),
  "The shared player-detail fix must load AFTER the overriding RTG theme rules");
assert(html.indexOf(style)<html.indexOf("</head>"),
  "The shared team-name fix must be a stylesheet in the document head");
assert(view.includes('class="player-detail-team"')&&view.includes('<strong title="${escapeHtml(teamIdentity.name)}"'),
  "The team-name fix must target the shared card component and preserve its full title");
assert(view.includes('aria-label="Squadra ${escapeHtml(teamIdentity.name)}"'),
  "The untruncated team name must remain accessible");
assert(view.includes('const teamBadge = teamIdentity.name'),
  "Shared team identity must be used by every Season");
assert(!css.includes("@import"),"CSS fix must not import or duplicate the legacy theme");

const base=css.match(/\.player-detail-modal \.player-detail-team \{([^}]+)\}/)?.[1]||"";
const name=css.match(/\.player-detail-modal \.player-detail-team strong \{([^}]+)\}/)?.[1]||"";
const role=css.match(/\.player-detail-modal \.player-detail-hero:has\(\.player-detail-rtg-role-switch\) \.player-detail-team \{([^}]+)\}/)?.[1]||"";
assert(/display:\s*flex\s*;/.test(base),"Team badge needs a shrinkable flex layout");
assert(/width:\s*max-content\s*;/.test(base),"Team badge should grow to show the full name where possible");
assert(/max-width:\s*min\(580px,\s*calc\(100vw\s*-\s*180px\)\)/.test(base),
  "Banner must reserve the desktop Legacy/close-button lane");
assert(/min-width:\s*0\s*!important/.test(name),"Name must be able to shrink below intrinsic width");
assert(/display:\s*block\s*!important/.test(name),"Safari's old -webkit-box must be reset");
assert(/white-space:\s*nowrap\s*!important/.test(name),"Long names must remain single line");
assert(/overflow:\s*hidden\s*!important/.test(name)&&/text-overflow:\s*ellipsis\s*!important/.test(name),
  "Long names must show visible ellipsis instead of bare clipping");
assert(/-webkit-line-clamp:\s*unset\s*!important/.test(name),
  "The previous two-line iPhone clamp must be disabled");
assert(/max-width:\s*min\(520px,\s*calc\(100vw\s*-\s*240px\)\)\s*!important/.test(role),
  "Switchable-role details must reserve both top-right buttons");
assert(css.includes("@media (max-width: 520px)")&&css.includes("@media (max-width: 370px)"),
  "Narrow phones must have dedicated responsive limits");
assert(css.includes("calc(100vw - 200px)")&&css.includes("calc(100vw - 185px)"),
  "Role-switch badge must not overlap even at 320-370px");
assert(/max-width:calc\(100% - 188px\)!important/.test(rtgCss),
  "Original RTG percentage cap changed; re-evaluate the later override before proceeding");

console.log("Shared Player Detail: full team-name title, iPhone ellipsis, controlled badge lanes, all Seasons PASS");
