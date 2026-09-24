(function (global) {
  "use strict";

  const mainTeams = Object.freeze([
    "occult", "wild", "brainwashing", "otaku", "shuriken",
    "farm", "kirkwood", "royal", "zeus", "raimon",
  ]);

  const formations = Object.freeze([
    Object.freeze({ id:"4-3-3", name:"4-3-3", type:"11v11", requirements:Object.freeze({GK:1,DF:4,MF:3,FW:3}), slotRoles:Object.freeze(["FW","FW","FW","MF","MF","MF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"4-4-2", name:"4-4-2", type:"11v11", requirements:Object.freeze({GK:1,DF:4,MF:4,FW:2}), slotRoles:Object.freeze(["FW","FW","MF","MF","MF","MF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"4-3-1-2", name:"4-3-1-2", type:"11v11", requirements:Object.freeze({GK:1,DF:4,MF:4,FW:2}), slotRoles:Object.freeze(["FW","FW","MF","MF","MF","MF","DF","DF","DF","DF","GK"]), displayRows:Object.freeze([Object.freeze({role:"FW",count:2}),Object.freeze({role:"MF",displayRole:"TQ",count:1}),Object.freeze({role:"MF",count:3}),Object.freeze({role:"DF",count:4}),Object.freeze({role:"GK",count:1})]) }),
    Object.freeze({ id:"4-2-4", name:"4-2-4", type:"11v11", requirements:Object.freeze({GK:1,DF:4,MF:2,FW:4}), slotRoles:Object.freeze(["FW","FW","FW","FW","MF","MF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"3-4-3", name:"3-4-3", type:"11v11", requirements:Object.freeze({GK:1,DF:3,MF:4,FW:3}), slotRoles:Object.freeze(["FW","FW","FW","MF","MF","MF","MF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"5-4-1", name:"5-4-1", type:"11v11", requirements:Object.freeze({GK:1,DF:5,MF:4,FW:1}), slotRoles:Object.freeze(["FW","MF","MF","MF","MF","DF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"4-5-1", name:"4-5-1", type:"11v11", requirements:Object.freeze({GK:1,DF:4,MF:5,FW:1}), slotRoles:Object.freeze(["FW","MF","MF","MF","MF","MF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"5-3-2", name:"5-3-2", type:"11v11", requirements:Object.freeze({GK:1,DF:5,MF:3,FW:2}), slotRoles:Object.freeze(["FW","FW","MF","MF","MF","DF","DF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"2-4-4", name:"2-4-4", type:"11v11", requirements:Object.freeze({GK:1,DF:2,MF:4,FW:4}), slotRoles:Object.freeze(["FW","FW","FW","FW","MF","MF","MF","MF","DF","DF","GK"]) }),
    Object.freeze({ id:"3-3-4", name:"3-3-4", type:"11v11", requirements:Object.freeze({GK:1,DF:3,MF:3,FW:4}), slotRoles:Object.freeze(["FW","FW","FW","FW","MF","MF","MF","DF","DF","DF","GK"]) }),
    Object.freeze({ id:"2-5-3", name:"2-5-3", type:"11v11", requirements:Object.freeze({GK:1,DF:2,MF:5,FW:3}), slotRoles:Object.freeze(["FW","FW","FW","MF","MF","MF","MF","MF","DF","DF","GK"]) }),
    Object.freeze({ id:"3-5-2", name:"3-5-2", type:"11v11", requirements:Object.freeze({GK:1,DF:3,MF:5,FW:2}), slotRoles:Object.freeze(["FW","FW","MF","MF","MF","MF","MF","DF","DF","DF","GK"]), displayRows:Object.freeze([Object.freeze({role:"FW",count:2}),Object.freeze({role:"MF",count:5}),Object.freeze({role:"DF",count:3}),Object.freeze({role:"GK",count:1})]) }),
  ]);

  const mainRewards = Object.freeze({
    occult: 250, wild: 275, brainwashing: 300, otaku: 325, shuriken: 350,
    farm: 400, kirkwood: 450, royal: 500, zeus: 575, raimon: 650,
  });

  const constraints = Object.freeze({
    occult: Object.freeze({ cap: 75, minRecruit: 0, recentCount: 0, recentWindow: 0 }),
    wild: Object.freeze({ cap: 77, minRecruit: 1, recentCount: 0, recentWindow: 0 }),
    brainwashing: Object.freeze({ cap: 79, minRecruit: 2, recentCount: 0, recentWindow: 0 }),
    otaku: Object.freeze({ cap: 77, minRecruit: 2, recentCount: 1, recentWindow: 2 }),
    shuriken: Object.freeze({ cap: 80, minRecruit: 3, recentCount: 1, recentWindow: 2 }),
    farm: Object.freeze({ cap: 81, minRecruit: 3, recentCount: 1, recentWindow: 2 }),
    kirkwood: Object.freeze({ cap: 83, minRecruit: 4, recentCount: 2, recentWindow: 3 }),
    royal: Object.freeze({ cap: 86, minRecruit: 4, recentCount: 2, recentWindow: 3 }),
    zeus: Object.freeze({ cap: 87, minRecruit: 5, recentCount: 2, recentWindow: 3 }),
    raimon: Object.freeze({ cap: 87, minRecruit: 6, recentCount: 3, recentWindow: 3 }),
  });

  const SEASON1 = Object.freeze({
    seasonId: "ie1",
    mainTeams,
    formations,
    checkpointMainIndexes: Object.freeze([2, 5, 8]),
    visualBlocks: Object.freeze([
      Object.freeze([0, 2]), Object.freeze([3, 5]),
      Object.freeze([6, 8]), Object.freeze([9, 9]),
    ]),
    livesPerCheckpoint: 2,
    pullCost: 300,
    mainRewards,
    secondaryRewards: Object.freeze([
      Object.freeze({ amount: 150, weight: 55 }),
      Object.freeze({ amount: 165, weight: 25 }),
      Object.freeze({ amount: 180, weight: 15 }),
      Object.freeze({ amount: 200, weight: 5 }),
    ]),
    rarityWeights: Object.freeze({ Normale: 40, Buono: 27, Forte: 18, Elite: 10, Mondiale: 5, Leggenda: 0 }),
    duplicateRefunds: Object.freeze({ Normale: 40, Buono: 60, Forte: 85, Elite: 120, Mondiale: 160, Leggenda: 300 }),
    constraints,
  });

  function buildSeasonNodes(seasonId) {
    if (String(seasonId || "") !== SEASON1.seasonId) return Object.freeze([]);
    const nodes = [];
    mainTeams.forEach((teamId, mainIndex) => {
      nodes.push(Object.freeze({
        id: `main:${teamId}`, type: "main", teamId, mainIndex,
        checkpointAfter: SEASON1.checkpointMainIndexes.includes(mainIndex),
      }));
      if (mainIndex >= mainTeams.length - 1) return;
      const beforeTeamId = mainTeams[mainIndex + 1];
      const userCap = constraints[beforeTeamId].cap;
      for (let slot = 1; slot <= 2; slot += 1) {
        nodes.push(Object.freeze({
          id: `secondary:${teamId}:${beforeTeamId}:${slot}`,
          type: "secondary", afterTeamId: teamId, beforeTeamId, slot,
          userCap,
          opponentTargetMin: Math.max(70, userCap - 4),
          opponentTargetMax: userCap - 1,
        }));
      }
    });
    return Object.freeze(nodes);
  }

  const season2Matches = Object.freeze([
    Object.freeze({ teamId:"secret_service", special:true, cap:74, minRecruit:0, recentCount:0, recentWindow:0 }),
    Object.freeze({ teamId:"gemini_storm", cap:76, minRecruit:1, recentCount:0, recentWindow:0 }),
    Object.freeze({ teamId:"alpine_ie2", special:true, cap:78, minRecruit:1, recentCount:0, recentWindow:0 }),
    Object.freeze({ teamId:"epsilon", cap:78, minRecruit:2, recentCount:1, recentWindow:3 }),
    Object.freeze({ teamId:"royal_academy_redux", cap:80, minRecruit:2, recentCount:1, recentWindow:3 }),
    Object.freeze({ teamId:"cloister_divinity", special:true, cap:79, minRecruit:3, recentCount:1, recentWindow:3 }),
    Object.freeze({ teamId:"epsilon_plus", cap:81, minRecruit:3, recentCount:1, recentWindow:3 }),
    Object.freeze({ teamId:"super_triple_c", special:true, cap:79, minRecruit:4, recentCount:2, recentWindow:4 }),
    Object.freeze({ teamId:"diamond_dust", cap:82, minRecruit:4, recentCount:2, recentWindow:4 }),
    Object.freeze({ teamId:"fauxshore", special:true, cap:81, minRecruit:5, recentCount:2, recentWindow:4 }),
    Object.freeze({ teamId:"prominence", cap:82, minRecruit:5, recentCount:2, recentWindow:4 }),
    Object.freeze({ teamId:"chaos", cap:85, minRecruit:6, recentCount:2, recentWindow:4 }),
    Object.freeze({ teamId:"genesis", cap:86, minRecruit:6, recentCount:3, recentWindow:5 }),
    Object.freeze({ teamId:"mary_times", special:true, cap:82, minRecruit:7, recentCount:3, recentWindow:5 }),
    Object.freeze({ teamId:"dark_emperors", cap:87, minRecruit:7, recentCount:3, recentWindow:5 }),
    Object.freeze({ teamId:"zeus", special:true, cap:84, minRecruit:8, recentCount:3, recentWindow:5 }),
    Object.freeze({ teamId:"raimon_inazuma_eleven_2", cap:89, minRecruit:8, recentCount:4, recentWindow:6 }),
  ]);
  const season2Teams = Object.freeze(season2Matches.map(entry=>entry.teamId));
  const season2Constraints = Object.freeze(Object.fromEntries(season2Matches.map(entry=>[
    entry.teamId,
    Object.freeze({cap:entry.cap,minRecruit:entry.minRecruit,recentCount:entry.recentCount,recentWindow:entry.recentWindow})
  ])));
  const season2Rewards = Object.freeze(Object.fromEntries(season2Matches.map((entry,index)=>[entry.teamId,275+index*30])));
  const SEASON2 = Object.freeze({
    seasonId:"ie1_s2",
    mainTeams:season2Teams,
    importantMatches:season2Matches,
    formations,
    checkpointMainIndexes:Object.freeze([4,10,14]),
    visualBlocks:Object.freeze([Object.freeze([0,4]),Object.freeze([5,10]),Object.freeze([11,14]),Object.freeze([15,16])]),
    livesPerCheckpoint:2,
    pullCost:300,
    mainRewards:season2Rewards,
    secondaryRewards:SEASON1.secondaryRewards,
    rarityWeights:SEASON1.rarityWeights,
    duplicateRefunds:SEASON1.duplicateRefunds,
    constraints:season2Constraints,
    routeBackground:"assets/rtg/rtg-season2-route-map.webp",
  });
  function season(seasonId){
    return String(seasonId||"")==="ie1_s2"?SEASON2:SEASON1;
  }
  const buildSeason1Nodes=buildSeasonNodes;
  function buildAnySeasonNodes(seasonId){
    const sid=String(seasonId||"ie1");
    if(sid==="ie1")return buildSeason1Nodes("ie1");
    if(sid!=="ie1_s2")return Object.freeze([]);
    const nodes=[];
    season2Matches.forEach((match,index)=>{
      nodes.push(Object.freeze({
        id:`main:${match.teamId}`,type:"main",teamId:match.teamId,mainIndex:index,special:!!match.special,
        checkpointAfter:SEASON2.checkpointMainIndexes.includes(index),
      }));
      if(index>=season2Matches.length-1)return;
      const beforeTeamId=season2Matches[index+1].teamId;
      const userCap=season2Constraints[beforeTeamId].cap;
      nodes.push(Object.freeze({
        id:`secondary:${match.teamId}:${beforeTeamId}:1`,type:"secondary",afterTeamId:match.teamId,beforeTeamId,slot:1,
        userCap,opponentTargetMin:Math.max(70,userCap-4),opponentTargetMax:userCap-1,
      }));
    });
    return Object.freeze(nodes);
  }

  global.RoadToGloryConfig = Object.freeze({ SEASON1, SEASON2, season, buildSeasonNodes:buildAnySeasonNodes });
})(globalThis);
