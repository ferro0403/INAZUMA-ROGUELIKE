"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const index=fs.readFileSync("index.html","utf8");
const ordered=[
  "js/road-to-glory/rtg-album-view.js",
  "js/road-to-glory/rtg-run-view.js",
  "js/road-to-glory/rtg-vending-controller.js",
  "js/road-to-glory/rtg-controller.js",
];
let previous=-1;
for(const file of ordered){const position=index.indexOf(file);assert(position>previous,`${file} load order`);previous=position;}
const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};context.globalThis=context;vm.createContext(context);
for(const file of ordered)vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
assert.strictEqual(typeof context.RoadToGloryAlbumView.create,"function");
assert.strictEqual(typeof context.RoadToGloryRunView.create,"function");
assert.strictEqual(typeof context.RoadToGloryVendingController.create,"function");
assert.strictEqual(typeof context.RoadToGloryController.create,"function");
const view=context.RoadToGloryRunView.create({escapeHtml:value=>String(value??""),teamEmblemMarkup:id=>`<i>${id}</i>`});
for(const method of ["tabs","lockedMarkup","runMarkup","albumCollectionMarkup","albumTeamsMarkup","albumRosterMarkup","requirementsMarkup","nodeModalMarkup","vendingMarkup","pullResultMarkup"])assert.strictEqual(typeof view[method],"function",`${method} public API`);
console.log("rtg-split-module-contract-test: extracted load order and facade API PASS");
