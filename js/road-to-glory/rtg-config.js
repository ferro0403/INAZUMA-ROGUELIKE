(function (global) {
  "use strict";

  const mainTeams = Object.freeze([
    "occult", "wild", "brainwashing", "otaku", "shuriken",
    "farm", "kirkwood", "royal", "zeus", "raimon",
  ]);

  const mainRewards = Object.freeze({
    occult: 210, wild: 225, brainwashing: 240, otaku: 255, shuriken: 285,
    farm: 330, kirkwood: 390, royal: 465, zeus: 540, raimon: 630,
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
    checkpointMainIndexes: Object.freeze([2, 5, 8]),
    visualBlocks: Object.freeze([
      Object.freeze([0, 2]), Object.freeze([3, 5]),
      Object.freeze([6, 8]), Object.freeze([9, 9]),
    ]),
    livesPerCheckpoint: 2,
    pullCost: 300,
    mainRewards,
    secondaryRewards: Object.freeze([
      Object.freeze({ amount: 100, weight: 70 }),
      Object.freeze({ amount: 110, weight: 20 }),
      Object.freeze({ amount: 125, weight: 8 }),
      Object.freeze({ amount: 150, weight: 2 }),
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

  global.RoadToGloryConfig = Object.freeze({ SEASON1, buildSeasonNodes });
})(globalThis);
