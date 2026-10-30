"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const index = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/ios-pwa-viewport-guard.css", "utf8");
const match = index.match(/<script>\s*\/\* Installed iOS PWA icons[\s\S]*?<\/script>/);
assert(match, "legacy iOS PWA geometry detector must load before UI");
const script = match[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
assert(index.includes("viewport-fit=cover"), "keep normal edge-to-edge viewport");
assert(!index.includes("black-translucent"), "do not restore deprecated iOS status bar mode");
assert(index.includes("css/ios-pwa-viewport-guard.css?v=20261030-install-geometry-v1"), "cache-busted production CSS required");
assert(index.indexOf("Installed iOS PWA icons") < index.indexOf("css/game.css"), "run detector before styles");
assert(/html\.ios-pwa-viewport-overlap body\s*\{\s*padding-top:\s*var\(--ios-pwa-top-clearance\)/.test(css), "clearance belongs to document, not to each screen");
assert(css.includes("max(64px, env(safe-area-inset-top, 0px))"), "fallback must cover installed PWA safe-area misreport");
assert(css.includes(".squad-screen:not(.rtg-squad-shell)"), "preserve independently scrolling RTG squad");
assert(css.includes(".rtg-tabs--main-style"), "sticky RTG tabs must clear native status bar");
assert(!/background(-image|-color)?\s*:/.test(css), "do not change the original Home/game backgrounds");

function detect({ ua="Mozilla/5.0 (iPhone; CPU iPhone OS 27_0)", standalone=true, screenHeight=844, innerHeight=844 } = {}) {
  let selected=null;
  const listeners={};
  const ctx={
    navigator:{userAgent:ua,platform:"iPhone",maxTouchPoints:5,standalone},
    window:{
      screen:{height:screenHeight},
      innerHeight,
      matchMedia:()=>({matches:standalone}),
      addEventListener:(event,handler)=>{listeners[event]=handler;}
    },
    document:{documentElement:{classList:{toggle:(name,enabled)=>{selected={name,enabled};}}}}
  };
  vm.runInNewContext(script,ctx,{filename:"index.html:inline-ios-pwa-detector"});
  return selected;
}
assert.equal(detect()?.enabled,true,"legacy installed PWA must receive top clearance");
assert.equal(detect({screenHeight:844,innerHeight:780})?.enabled,false,"new inset standalone viewport must not be double-padded");
assert.equal(detect({standalone:false})?.enabled,false,"normal Safari must remain unchanged");
assert.equal(detect({ua:"Mozilla/5.0 (Linux; Android 15)"})??null,null,"Android must remain unchanged");
console.log("ios-pwa-viewport-guard-test: PASS");
