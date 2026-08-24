(function(global){"use strict";
 const chunks=(items,size=400)=>{const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out};
 function casMatches(actual,expected,identity){return expected?!!actual&&identity(actual)===identity(expected):!actual}
 async function publish({store,expected,commitId,writes,manifest,identity=x=>JSON.stringify(x),isCurrent=()=>true,failChunk=-1}){let n=0;for(const chunk of chunks(writes)){if(n===failChunk)throw Object.assign(Error('staging-failed'),{code:'staging-failed'});await store.stage(commitId,chunk,n++);}const won=await store.cas(expected,manifest,identity);if(!won)throw Object.assign(Error('cloud-cas-conflict'),{code:'cloud-cas-conflict'});return{manifest,synced:isCurrent(),chunks:n}}
 function memory(){let manifest=null;const staged=new Map();return{stage:async(id,writes,n)=>{const v=staged.get(id)||[];v.push(...writes);staged.set(id,v)},cas:async(expected,next,identity)=>{if(!casMatches(manifest,expected,identity))return false;manifest=next;return true},manifest:()=>manifest,visible:()=>manifest?staged.get(manifest.cloudCommitId)||[]:[],staged:id=>staged.get(id)||[]}}
 const api=Object.freeze({chunks,casMatches,publish,memory});global.InazumaCloudSyncProtocol=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(globalThis);
