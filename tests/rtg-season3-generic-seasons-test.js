const assert=require('assert'),fs=require('fs'),vm=require('vm');
const context={console};context.globalThis=context;
for(const file of ['js/road-to-glory/rtg-card-identity.js','js/road-to-glory/rtg-rng.js','js/road-to-glory/rtg-config.js','js/road-to-glory/rtg-state.js','js/road-to-glory/rtg-gacha.js','js/road-to-glory/rtg-progression.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const C=context.RoadToGloryConfig,S=C.SEASON3,nodes=Array.from(C.buildSeasonNodes('ie1_s3'));
assert.deepStrictEqual(Array.from(C.SEASON_IDS),['ie1','ie1_s2','ie1_s3']);
assert.strictEqual(S.seasonNumber,3);assert.strictEqual(S.previousSeasonId,'ie1_s2');assert.strictEqual(S.nextSeasonId,null);
assert.strictEqual(S.routeBackground,'assets/rtg/rtg-season3-route-map-user.webp');assert.strictEqual(S.livesPerCheckpoint,2);assert.strictEqual(S.pullCost,300);assert.strictEqual(S.recruitmentPullCost,150);
const order=['big_waves','neo_national','desert_lions','fire_dragon','brocken_brigade','queen_s_knights','the_cape_crusaders','the_empire','rose_griffons','unicorn','team_d','orpheus','team_zoolan','the_kingdom','red_matador','dark_angels','little_gigantes','team_ogre','inazuma_national'];
assert.deepStrictEqual(Array.from(S.mainTeams),order);assert.strictEqual(nodes.filter(x=>x.type==='main').length,19);assert.strictEqual(nodes.filter(x=>x.type==='secondary').length,18);assert.strictEqual(nodes.length,37);assert.strictEqual(nodes[0].id,'main:big_waves');assert.strictEqual(nodes.at(-1).id,'main:inazuma_national');
assert.deepStrictEqual(Array.from(S.checkpointMainIndexes),[2,5,8,11,14,17]);
assert.deepStrictEqual(order.map(x=>S.constraints[x].cap),[80,82,82,84,84,84,82,85,83,86,83,87,84,87,84,88,89,91,93]);
assert.deepStrictEqual(order.map(x=>S.constraints[x].minRecruit),[0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9]);
for(const x of order){const q=S.constraints[x],count=Math.floor(q.minRecruit/2);assert.strictEqual(q.recentCount,count);assert.strictEqual(q.recentWindow,count?count+2:0);}
let state=context.RoadToGloryState.createInitial({campaignSeed:'s3'});state.activeSeasonId='ie1_s3';state.currentNodeId=nodes[0].id;state.squads.ie1_s3={formationId:null,lineup:[],bench:[],activeRoleVariantByCardId:{}};assert.strictEqual(context.RoadToGloryState.validate(state).activeSeasonId,'ie1_s3');
for(const node of nodes){if(node.type==='main')state=context.RoadToGloryProgression.recordMainVictory(state,{teamId:node.teamId,matchId:node.id});else state=context.RoadToGloryProgression.recordSecondaryResult(state,{nodeId:node.id,result:'victory',attemptNumber:1});}
assert.strictEqual(state.seasonComplete,true);assert.strictEqual(state.currentNodeId,'main:inazuma_national');
const db=require('../data/IE1_S3_season_compact.json'),G=context.RoadToGloryGacha;
const base={campaignSeed:'g',activeSeasonId:'ie1_s3',tokens:1000,defeatedTeamIds:[],gachaAcquiredCards:[],gacha:{pullCount:0}};
const normalBase={...base,defeatedTeamIds:['big_waves']};const normalPool=G.previewPool(normalBase,db,[],'team');assert(normalPool.candidates.length>0);const normalPull=G.pull(normalBase,{seasonDb:db,mode:'team'});assert.strictEqual(normalPull.state.tokens,700);assert.strictEqual(normalPull.state.gacha.pullCount,1);
const pool=G.recruitmentCandidates(base,db);assert.strictEqual(pool.length,288);assert(pool.every(x=>x.cardId===`ie1_s3::${x.profileId}`&&x.sourceKind==='season'));assert(!pool.some(x=>x.profileId==null));
assert.strictEqual(G.previewPool(base,db,[],'recruitment').candidates.length,288);
const pulled=G.pull(base,{seasonDb:db,mode:'recruitment'});assert.strictEqual(pulled.state.tokens,850);assert.strictEqual(pulled.state.gacha.pullCount,0);assert.strictEqual(pulled.state.gacha.recruitmentPullCount,1);assert(pulled.state.gachaAcquiredCards.some(x=>x.cardId===pulled.result.cardId));assert(pulled.result.cardId.startsWith('ie1_s3::'));
console.log('RTG Season 3 generic seasons tests passed');
