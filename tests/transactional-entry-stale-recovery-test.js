"use strict";
const assert=require('assert'); const BudgetStorage=require('./helpers/budget-storage'); const {load}=require('./helpers/production-runtime');
const run={runId:'entry',seasonId:'ie1',phase:'map',bossIndex:0,teamLevel:0,lives:2,fiveVFive:{formationId:'1-2-1',slots:{}},roster:[],lineup:[],bench:[],inventory:[],statistics:{},currentZone:{seed:'z',currentNodeId:'random',pendingNodeId:'random',startNodeId:'start',path:['start','random'],completedNodeIds:[],nodes:[{id:'start',type:'start',layer:0},{id:'random',type:'random',revealedType:'five_v_five',layer:1}],edges:[['start','random']]},activeMatch:null};
const seasonDb={seasonId:'ie1',players:[],bossOrder:[{teamId:'b',teamName:'B'}],formations:{eleven:[]}};
const storage=new BudgetStorage(Infinity); const rt=load(storage,{run,seasonDb}); const c=rt.context;
c.FiveVFive={formationById:()=>({slots:[]})}; c.RunStatistics.createStableMatchId=()=> 'stable';
const old=rt.seam.getRun().currentZone.nodes[1]; const save=c.RunState.save.bind(c.RunState); let failed=false; c.RunState.save=(value)=>{if(!failed){failed=true; throw Object.assign(new Error('stale'),{code:'stale-write'})} return save(value)};
rt.seam.dispatchNode(old,'five_v_five'); assert.equal(rt.canonical.activeMatch,null); assert.notStrictEqual(old,rt.seam.getRun().currentZone.nodes[1]);
c.RunState.save=save; rt.seam.dispatchNode(rt.seam.getRun().currentZone.nodes[1],'five_v_five'); assert.equal(rt.canonical.activeMatch.matchId,'stable'); assert.equal(rt.canonical.phase,'match'); console.log('ok');
