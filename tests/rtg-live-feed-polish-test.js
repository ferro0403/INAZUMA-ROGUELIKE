"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
let observed=null,scrolled=null;
const styleNodes=[];
const latest={scrollIntoView:opts=>{scrolled=opts;}};
const list={children:[{},{}],lastElementChild:latest,querySelector:sel=>sel==="li.is-latest"?latest:null,scrollTop:0,scrollHeight:900};
const documentElement={appendChild:node=>styleNodes.push(node)};
const document={
  documentElement,
  head:{appendChild:node=>styleNodes.push(node)},
  getElementById:()=>null,
  createElement:()=>({id:"",textContent:""}),
  querySelector:sel=>sel===".rtg-match-ticker-list"?list:null,
};
class MutationObserver{constructor(cb){this.cb=cb;}observe(target,options){observed={target,options,cb:this.cb};}}
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,document,MutationObserver};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/moves/move-presentation.js","utf8"),c);
assert(styleNodes.length>0,"RTG live-feed style must be installed");
const css=styleNodes[0].textContent;
assert.match(css,/rtg-halftime-field-panel>\.rtg-halftime-section-title\{display:none!important\}/);
assert.match(css,/match-event--user[^}]*#2d8fd5/i);
assert.match(css,/match-event--opponent[^}]*#d65353/i);
assert.deepStrictEqual(scrolled,{block:"end",behavior:"smooth"},"feed must immediately follow latest action");
assert(observed?.options?.subtree&&observed?.options?.childList,"feed must keep following after match rerenders");
console.log("rtg-live-feed-polish-test: PASS");
