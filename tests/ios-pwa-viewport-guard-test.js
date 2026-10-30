"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const index = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/ios-pwa-viewport-guard.css", "utf8");
const match = index.match(/<script>\s*\/\* A Home Screen PWA[\s\S]*?<\/script>/);
assert(match, "iOS PWA guard must load before styles");
const script = match[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
assert(index.includes("viewport-fit=cover"), "preserve viewport support");
assert(!index.includes("black-translucent"), "avoid deprecated status bar mode");
assert(!script.includes("screenHeight - viewportHeight"), "never gate protection on the unreliable viewport-height delta");
assert(index.includes("css/ios-pwa-viewport-guard.css?v=20261030-compact-safe-gutter-v4"), "cache bust new safe top");
assert(index.indexOf("A Home Screen PWA") < index.indexOf("css/game.css"), "set class before styles");
assert(/html\.ios-pwa-safe-top body\s*\{\s*padding-top:\s*var\(--ios-pwa-top-clearance\)/.test(css), "document, not individual panels, receives clearance");
assert(css.includes("--ios-pwa-top-clearance: 12px;"), "cover full iOS status bar with fallback");
assert(css.includes(".topbar") && css.includes(".squad-topbar"), "sticky headers stay visible");
assert(css.includes(".squad-screen:not(.rtg-squad-shell)"), "leave independent squad scroller usable");
assert(!/\bbackground(?:-image)?\s*:/.test(css), "no changes to screen backgrounds or imagery");
assert(css.includes("body::before") && css.includes("background-color: #d7e0d3"),
  "paint only the exposed status-bar gutter in native iOS background color");
assert(css.includes("html.ios-pwa-safe-top .development-screen") && css.includes("padding-top: 12px"),
  "avoid double safe-area padding on development center");
assert(/\.development-screen > \.topbar\s*\{\s*top:\s*0;/.test(css),
  "relative Development header must not shift down over its resource wallet");
assert(css.includes("html.ios-pwa-safe-top .album-screen") &&
       css.includes("html.ios-pwa-safe-top .shop-screen"),
  "deduplicate album/shop safe-area spacing");
assert(css.includes("html.ios-pwa-safe-top .rtg-prematch-shell.rtg-prematch-revolution") &&
  css.includes("padding-top: 8px"),
  "prematch must not duplicate the native safe-area offset");
assert(css.includes(".squad-topbar:not(.rtg-squad-topbar)") && css.includes("padding-top: 10px"),
  "plain squad topbar must not add the iOS status bar a second time");
const rtgMatchController = fs.readFileSync("js/road-to-glory/rtg-controller.js", "utf8");
assert(rtgMatchController.includes("renderHtml(matchView.matchMarkup(match),{preserveMatchTimeline:true});"),
  "the canonical RTG match renderer must be preserved, preventing blank live matches");
assert(!rtgMatchController.includes("\\n      const alreadyInLiveMatch"),
  "reject literal escaped newlines that comment out RTG match rendering");
assert(css.includes(".rtg-match-shell > .rtg-match-scoreboard") &&
       css.includes(".rtg-prematch-shell > .rtg-prematch-topbar") &&
       css.includes("position: relative"),
  "prevent large match and prematch headers covering the controls while scrolling");
assert(index.includes("css/ios-pwa-viewport-guard.css?v=20261030-compact-safe-gutter-v4"),
  "invalidate installed PWA CSS cache after layout fix");

function detect({ua="Mozilla/5.0 (iPhone; CPU iPhone OS 27_0)",platform="iPhone",standalone=true,screenHeight=844,innerHeight=759}={}) {
  let selected=null;
  const win={ screen:{height:screenHeight},innerHeight,
    matchMedia:()=>({matches:standalone}),
    addEventListener:()=>{} };
  const ctx={
    navigator:{userAgent:ua,platform,maxTouchPoints:platform==="MacIntel"?5:0,standalone},
    window:win,
    document:{documentElement:{classList:{toggle:(name,enabled)=>{selected={name,enabled};}}}}
  };
  vm.runInNewContext(script,ctx,{filename:"index.html:pwa-statusbar"});
  return selected;
}
assert.deepEqual({...detect({screenHeight:844,innerHeight:759})},{name:"ios-pwa-safe-top",enabled:true},
  "older PWA with screen/viewport delta must receive clearance");
assert.equal(detect({screenHeight:844,innerHeight:844})?.enabled,true,
  "full-height standalone PWA must receive clearance");
assert.equal(detect({standalone:false})?.enabled,false,
  "Safari must not get artificial blank space");
assert.equal(detect({ua:"Mozilla/5.0 (Linux; Android 15)",platform:"Linux"})??null,null,
  "Android must not be touched");
console.log("ios-pwa-viewport-guard-test: PASS");
