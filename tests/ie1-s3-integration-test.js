const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const season = read('data/IE1_S3_season_compact.json');
const free = read('data/FREE_AGENTS_compact.json');
const visuals = read('data/PLAYER_VISUALS.json');

assert.strictEqual(season.seasonId, 'ie1_s3');
assert.strictEqual(season.requiresProfileAwareRuntime, true);
assert.strictEqual(season.teams.length, 41); assert.strictEqual(season.bossOrder.length, 12); assert.strictEqual(season.specialMatches.length, 7);
assert.strictEqual(season.players.length, 584); assert.strictEqual(season.profiles.length, 584); assert.strictEqual(season.recruitmentPool.entries.length, 291);
assert.strictEqual(season.globalFreeAgentPatch.players.length, 3); assert.strictEqual(season.validation.counts.combinedUniqueGameplayPlayers, 587);
assert.strictEqual(season.validation.counts.roleSwitchProfiles, 4); assert.strictEqual(season.warnings.length, 0); assert.strictEqual(season.validation.status, 'passed');
const bosses = [
 ['big_waves',1,80,'4-4-2'],['desert_lions',3,82,'4-4-2'],['fire_dragon',5,84,'4-3-1-2'],['queen_s_knights',7,85,'4-4-2'],['the_empire',9,86,'4-4-2'],['unicorn',11,87,'4-3-1-2'],['orpheus',13,88,'4-3-1-2'],['the_kingdom',15,88,'4-3-1-2'],['dark_angels',16,89,'4-2-4'],['little_gigantes',17,90,'4-4-2'],['team_ogre',19,92,'4-3-3'],['inazuma_national',20,94,'4-3-3']
];
assert.deepStrictEqual(season.bossOrder.map(b => [b.teamId,b.bossLevel,b.teamOverall,b.bossFormation]), bosses);
assert.deepStrictEqual(season.bossOrder.map(b => b.order), Array.from({length:12}, (_, index) => index + 1));
const darkAngels = season.bossOrder[8];
const darkTeam = season.teams.find(team => team.teamId === 'dark_angels');
assert(darkTeam); assert.strictEqual(darkTeam.teamStars, 4.5); assert.strictEqual(darkTeam.playerIds.length, 11);
assert.strictEqual(darkAngels.startingXI.length, 11); assert(darkAngels.startingXI.every(entry => entry.level === 16));
assert(darkAngels.startingXIProfileIds.every(id => id.endsWith('@dark_angels')));
const profilesById = new Map(season.profiles.map(profile => [profile.profileId, profile]));
const roles = darkAngels.startingXIProfileIds.map(id => profilesById.get(id).normalizedRole).sort();
assert.deepStrictEqual(roles, ['DF','DF','DF','DF','FW','FW','FW','FW','GK','MF','MF']);
assert.strictEqual(darkAngels.rewardPool, 'all_exported_team_players'); assert.strictEqual(darkAngels.unlocksTeamPool, true);
assert.strictEqual(darkAngels.rewardPoolProfileIds.length, 11); assert(darkAngels.rewardPoolProfileIds.every(id => profilesById.has(id) && id.endsWith('@dark_angels')));
assert.strictEqual(season.bossOrder.at(-1).teamId, 'inazuma_national'); assert.strictEqual(season.bossOrder.at(-1).order, 12);
assert.strictEqual(new Set(season.players.map(player => player.playerId)).size, season.players.length);
assert.strictEqual(new Set(season.profiles.map(profile => profile.profileId)).size, season.profiles.length);
const playersById = new Map(season.players.map(player => [player.playerId, player]));
const kirkwood = season.teams.find(team => team.teamId === 'kirkwood');
assert(kirkwood);
assert.deepStrictEqual(kirkwood.playerIds, ['161','171','162','173','159','160','167','174','163','170','168','166','164','172','165']);
assert.deepStrictEqual(kirkwood.playerProfileIds, ['161@kirkwood','171@kirkwood','162@kirkwood','173@kirkwood','159@kirkwood','160@kirkwood','167@kirkwood','174@kirkwood','163@kirkwood','170@kirkwood','168@kirkwood','166@kirkwood','164@kirkwood','172@kirkwood','165@kirkwood']);
for (const legacyId of ['4462','4464','4466']) assert(!season.players.some(player => String(player.playerId) === legacyId));
for (const legacyProfileId of ['4462@kirkwood','4464@kirkwood','4466@kirkwood']) assert(!season.profiles.some(profile => profile.profileId === legacyProfileId));
const kirkwoodExpected = [
  ['161','Alfred Meenan',75],
  ['160','Malcolm Night',80],
  ['162','Dan Mirthful',75],
  ['164','Toby Damian',75],
  ['166','Zachary Moore',77],
];
for (const [playerId, name, overall] of kirkwoodExpected) {
  const player = playersById.get(playerId);
  assert(player, `Kirkwood player ${playerId} must exist`);
  assert.strictEqual(player.name, name);
  assert.strictEqual(player.finalOverall, overall);
  assert.strictEqual(player.portraitUrl, visuals.players[playerId].portraitUrl);
  assert(visuals.players[playerId].frontFullbodyUrl, `${name} must have a canonical fullbody render`);
}
assert.strictEqual(playersById.get('166').element, 'Forest');
assert.strictEqual(season.players.filter(player => player.name === 'Toby Damian' && player.teamIds?.includes('kirkwood')).length, 1);
assert.strictEqual(season.players.find(player => player.name === 'Toby Damian' && player.teamIds?.includes('kirkwood')).playerId, '164');
for (const playerId of ['160','162','166']) {
  assert(recruitment.some(entry => String(entry.playerId) === playerId && entry.profileId === `${playerId}@kirkwood`));
}
assert(!recruitment.some(entry => ['4462','4464','4466'].includes(String(entry.playerId))));
assert.deepStrictEqual(season.legacyPlayerCompatibility.idAliases, {'4464':'162','4462':'160','4466':'166'});
assert.deepStrictEqual(season.legacyPlayerCompatibility.profileAliases, {
  '4464@kirkwood':'162@kirkwood',
  '4462@kirkwood':'160@kirkwood',
  '4466@kirkwood':'166@kirkwood',
});
assert(darkTeam.playerIds.every(id => playersById.has(id))); assert(darkTeam.playerProfileIds.every(id => profilesById.has(id)));
for (const key of ['teamFiles','teams','bosses','canonicalPlayers','profiles','combinedUniqueGameplayPlayers','warnings']) assert.strictEqual(season.validation.counts[key], season.summary[key]);
const specials = [[2,'neo_national',3,82],[4,'brocken_brigade',7,84],[5,'the_cape_crusaders',9,83],[6,'rose_griffons',11,84],[7,'team_d',14,84],[8,'team_zoolan',16,85],[9,'red_matador',17,85]];
assert.deepStrictEqual(season.specialMatches.map(s => [s.zoneIndex,s.teamId,s.matchLevel,s.teamOverall]), specials);
for (const match of season.specialMatches) { assert.strictEqual(match.reward.candidateCount,3); assert.strictEqual(match.reward.pickCount,1); assert.strictEqual(match.reward.guaranteedPlayerId,null); assert.strictEqual(match.reward.unlocksTeamPullPool,true); assert.deepStrictEqual([match.mapPlacement.layer,match.mapPlacement.column],[3,1]); }
const recruitment = season.recruitmentPool.entries;
assert.strictEqual(recruitment.filter(e => e.sourceKind === 'season3_recruitment_profile').length,288);
assert.strictEqual(recruitment.filter(e => e.sourceKind === 'global_free_agent').length,3);
assert(!recruitment.some(e => String(e.playerId) === '1196'));
for (const id of ['2083','258','2411']) { assert(recruitment.some(e => String(e.playerId) === id)); assert.strictEqual(free.players.filter(p => String(p.playerId) === id).length,1); }
assert(season.profiles.some(p => p.profileId === '1196@neo_national')); assert(!recruitment.some(e => String(e.playerId)==='1196' && e.sourceTeamId==='royal_academy_redux'));
const minimums = season.recruitmentRules.pullFreeAgents.minimumFinalOverallByBossIndex;
assert.deepStrictEqual(season.rules.pullFreeAgentsMinimumFinalOverallByBossIndex, minimums);
assert.deepStrictEqual(season.rules.pullFreeAgentsMinimumFinalOverallByBossIndex,[72,73,74,75,76,77,78,79,80,80,81,82]);
assert.deepStrictEqual(minimums,[72,73,74,75,76,77,78,79,80,80,81,82]); assert.strictEqual(season.recruitmentRules.pullFreeAgents.maximumFinalOverall,null); assert.strictEqual(season.recruitmentRules.pullFreeAgents.noMaximumPotential,true);
const effectiveFloor = (index) => Math.max(75, minimums[index]); const eligible = (overall,index) => overall >= effectiveFloor(index); assert(eligible(89,0)); assert(!eligible(72,0)); assert(!eligible(74,7)); assert(eligible(79,7)); assert(eligible(89,7));
const formation = season.formations.eleven.find(f => f.id === '4-3-1-2'); assert.deepStrictEqual(formation.requirements,{GK:1,DF:4,MF:4,FW:2}); assert.strictEqual(formation.displayRoleMap.TQ,'MF'); assert(!season.players.some(p => p.position === 'TQ'));
const nakata = season.profiles.find(p => p.playerId === 'custom_0001' && p.teamId === 'orpheus'); assert(nakata); assert.strictEqual(nakata.portraitUrl,'assets/players/season3/custom_0001_nakata_portrait.webp'); assert.strictEqual(nakata.frontFullbodyUrl,'assets/players/season3/custom_0001_nakata_fullbody.webp'); assert(fs.existsSync(nakata.portraitUrl)); assert(fs.existsSync(nakata.frontFullbodyUrl));

const context = { console, fetch: async () => ({ok:true,json:async()=>season}) }; context.globalThis=context; vm.createContext(context);
for (const file of ['js/profiled-season.js','js/season-registry.js','js/recruitment/player-identity.js','js/recruitment-pool.js','js/draft.js','js/level-progression.js','js/special-match.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
context.ProfiledSeasonRuntime.register('ie1_s3',season);
const legacyNight = context.ProfiledSeasonRuntime.resolveCanonicalPlayer('ie1_s3','4462');
assert(legacyNight); assert.strictEqual(legacyNight.name,'Malcolm Night'); assert.strictEqual(legacyNight.finalOverall,80); assert.strictEqual(legacyNight.legacyCanonicalPlayerId,'160');
const legacyNightProfile = context.ProfiledSeasonRuntime.resolveProfile('ie1_s3','4462@kirkwood');
assert(legacyNightProfile); assert.strictEqual(legacyNightProfile.name,'Malcolm Night'); assert.strictEqual(legacyNightProfile.playerId,'4462'); assert.strictEqual(legacyNightProfile.legacyCanonicalProfileId,'160@kirkwood');
const legacyMoore = context.ProfiledSeasonRuntime.resolveEffectiveBase({playerId:'4466',activeProfileId:'4466@kirkwood',activeRoleVariantId:'mf'},'ie1_s3');
assert.strictEqual(legacyMoore.name,'Zachary Moore'); assert.strictEqual(legacyMoore.finalOverall,77); assert.strictEqual(legacyMoore.playerId,'4466'); assert.strictEqual(legacyMoore.profileId,'4466@kirkwood');
const canonicalMoore = context.ProfiledSeasonRuntime.resolveEffectiveBase({playerId:'166',activeProfileId:'166@kirkwood',activeRoleVariantId:'mf'},'ie1_s3');
assert.strictEqual(canonicalMoore.name,'Zachary Moore'); assert.strictEqual(canonicalMoore.finalOverall,77); assert.strictEqual(canonicalMoore.playerId,'166');
assert(context.SeasonRegistry.list().some(s => s.id==='ie1_s3')); assert.strictEqual(context.SeasonRegistry.get('ie2').name,'Inazuma Eleven Ares');
const eligibility=context.RecruitmentPoolRuntime.eligibleForSeason3InitialDraft;
assert(eligibility({sourceKind:'season3_recruitment_profile',profileId:'low@team',finalOverall:72}));
assert(!eligibility({sourceKind:'global_free_agent',finalOverall:74})); assert(eligibility({sourceKind:'global_free_agent',finalOverall:75}));
const high=Array.from({length:6},(_,index)=>({playerId:`high-${index}`,position:'FW',sourceKind:'global_free_agent',finalOverall:81+index}));
const draftRun={seasonId:'ie1_s3',runId:'draft',draft:{roles:Array(6).fill('FW'),step:3,selectedIds:high.slice(0,3).map(p=>p.playerId),excludedIds:[],candidates:[high[3].playerId]}};
assert.strictEqual(context.DraftEngine.choose(draftRun,high[3].playerId,high,{slotRoles:Array(6).fill('FW')}),false,'fourth 81+ player remains selectable');
assert.strictEqual(draftRun.draft.selectedIds.length,4);
const levelRun={seasonId:'ie1_s3',teamLevel:0,teamLevelUnits:0,roster:[{playerId:'9',activeProfileId:'9@raimon',level:0,levelUnits:0}]}; context.ProfiledSeasonRuntime.addLevelUnits(levelRun,2,'a'); context.ProfiledSeasonRuntime.addLevelUnits(levelRun,2,'b'); context.ProfiledSeasonRuntime.addLevelUnits(levelRun,2,'c'); assert.deepStrictEqual([levelRun.teamLevel,levelRun.teamLevelUnits],[1,0]);
const special=season.specialMatches[0], rewardRun={seasonId:'ie1_s3',runId:'reward',teamLevel:0,teamLevelUnits:0,roster:[],bench:[],completedSpecialMatchIds:[],claimedSpecialMatchRewardIds:[],unlockedSpecialTeamIds:[],unlockedTeamIds:[]}; const result=context.SpecialMatchRuntime.complete(rewardRun,season,{specialMatchId:special.specialMatchId,nodeId:'node'},'victory'); assert.strictEqual(result.pendingReward.candidateProfileIds.length,3); assert(result.pendingReward.candidateProfileIds.every(id=>id.endsWith('@neo_national'))); assert(rewardRun.unlockedTeamIds.includes('neo_national')); assert.deepStrictEqual([rewardRun.teamLevel,rewardRun.teamLevelUnits],[1,0]); const again=context.SpecialMatchRuntime.complete(rewardRun,season,{specialMatchId:special.specialMatchId,nodeId:'node'},'victory'); assert.strictEqual(again.status,'already-completed'); assert.deepStrictEqual([rewardRun.teamLevel,rewardRun.teamLevelUnits],[1,0]);
console.log('ie1-s3-integration-test: database, recruitment, progression and special rewards OK');
