"use strict";
// Assert the CSS migration guard cannot be bypassed by introducing new debt.
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const root=path.resolve(__dirname,".."),cssDir=path.join(root,"css");
const guard=fs.readFileSync(path.join(__dirname,"rtg-css-architecture-test.js"),"utf8");
const original=(name)=>fs.readFileSync(path.join(cssDir,name),"utf8");
function run({replacements={},missing=[],extra=[]}={}){
  const removed=new Set(missing);
  const vfs={
    existsSync(p){return !removed.has(path.basename(String(p)))&&fs.existsSync(p);},
    readdirSync(p,...args){
      const list=fs.readdirSync(p,...args).filter(name=>!removed.has(name));
      return path.resolve(String(p))===cssDir?[...list,...extra]:list;
    },
    readFileSync(p,...args){
      const name=path.basename(String(p));
      return Object.prototype.hasOwnProperty.call(replacements,name)
        ?replacements[name]:fs.readFileSync(p,...args);
    },
  };
  vm.runInNewContext(guard,{
    __dirname:path.join(root,"tests"),
    require:name=>name==="fs"?vfs:require(name),
    console:{log(){}},
  },{filename:"rtg-css-architecture-test.js"});
}
function stripImport(source,filename){
  return source.split("\n").filter(line=>!(/^\s*@import\b/.test(line)&&line.includes("./"+filename))).join("\n");
}
const theme=original("rtg-theme.css"),core=original("rtg-theme-core.css"),legacy=original("road-to-glory.css");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
run(); // The deployed, active legacy imports are intentionally allowed.
assert.throws(()=>run({replacements:{"rtg-theme.css":stripImport(theme,"rtg-theme-core.css")}}),
  /transitional layer/,"Abandoned core CSS must be rejected");
assert.throws(()=>run({replacements:{"rtg-theme-core.css":stripImport(core,"rtg-theme-base.css")}}),
  /transitional layer/,"Abandoned base CSS must be rejected");
assert.throws(()=>run({replacements:{"index.html":index.replace(/<link[^>]+css\/rtg-theme\.css[^>]*>/,"")}}),
  /reachable/,"Unloaded CSS import chain must be rejected");
assert.throws(()=>run({extra:["rtg-vending-depth.css"]}),
  /Retired RTG stylesheet/,"Retired finishing layer must be rejected");
assert.throws(()=>run({extra:["rtg-theme-polish.css"]}),
  /finishing\/override/,"New override layer must be rejected");
assert.throws(()=>run({replacements:{"road-to-glory.css":legacy+"\n.rtg-vending-machine{outline:none}\n"}}),
  /selector debt increased/,"Extra legacy selector must be rejected");
assert.throws(()=>run({replacements:{"rtg-theme.css":theme+"\n.rtg-test{color:red!important}\n"}}),
  /important debt grew/,"New !important debt must be rejected");
// After a future verified migration, both legacy sheets and their imports
// may be removed together without creating an eternal fixture dependency.
run({missing:["rtg-theme-core.css","rtg-theme-base.css"],
  replacements:{"rtg-theme.css":stripImport(theme,"rtg-theme-core.css")}});
console.log("rtg-css-migration-contract-test: transition and negative guards PASS");
