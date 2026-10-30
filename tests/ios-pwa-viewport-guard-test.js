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
assert(index.includes("css/ios-pwa-viewport-guard.css?v=20261030-standalone-safe-top-v2"), "cache bust new safe top");
assert(index.indexOf("A Home Screen PWA") < index.indexOf("css/game.css"), "set class before styles");
assert(/html\.ios-pwa-safe-top body\s*\{\s*padding-top:\s*var\(--ios-pwa-top-clearance\)/.test(css), "document, not individual panels, receives clearance");
assert(css.includes("max(54px, env(safe-area-inset-top, 0px))"), "cover full iOS status bar with fallback");
assert(css.includes(".topbar") && css.includes(".squad-topbar"), "sticky headers stay visible");
assert(css.includes(".squad-screen:not(.rtg-squad-shell)"), "leave independent squad scroller usable");
assert(!/background(-color|-image)?\s*:/.test(css), "retain all existing backgrounds");

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
