"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const ctx = {console};
ctx.globalThis = ctx;
ctx.RoadToGloryRng = {weightedPick: (items) => items[0], float: () => 0};
vm.createContext(ctx);
for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-progression.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), ctx, {filename: file});
}
const C = ctx.RoadToGloryConfig;
const P = ctx.RoadToGloryProgression;
const copy = value => JSON.parse(JSON.stringify(value));

function fresh(sid) {
  return {
    activeSeasonId: sid, campaignSeed: "checkpoint-five-seasons-" + sid,
    currentNodeId: C.buildSeasonNodes(sid)[0].id, checkpointMainIndex: -1,
    lives: 2, seasonComplete: false, tokens: 1234, furthestNodeIndex: 0,
    defeatedTeamIds: [], firstClearMatchIds: [], attemptsByNode: {},
    seasonTransitionRewardedIds: ["unrelated:permanent"],
    gachaAcquiredCards: [{cardId:"free_agents::100"}],
  };
}
function assertPermanentUnchanged(before, after) {
  for (const field of ["tokens", "gachaAcquiredCards", "firstClearMatchIds", "seasonTransitionRewardedIds", "activeSeasonId"]) {
    assert.deepEqual(copy(after[field]), copy(before[field]), field + " should survive a lost life or rollback");
  }
}
for (const sid of C.SEASON_IDS) {
  const cfg = C.season(sid);
  const nodes = C.buildSeasonNodes(sid);
  const checkpoints = Array.from(cfg.checkpointMainIndexes);
  const expected = cfg.mainTeams.map((_, i) => i)
    .filter(i => (i + 1) % 3 === 0 && i < cfg.mainTeams.length - 1);
  test(sid + ": checkpoint every three MAIN victories, not every replay or secondary win", () => {
    assert.deepEqual(checkpoints, expected);
    let s = fresh(sid), mostRecentCheckpoint = -1;
    let seenMain = 0;
    for (const node of nodes) {
      assert.equal(s.currentNodeId, node.id, "story must advance in sequence: " + node.id);
      const before = s;
      if (node.type === "main") {
        s = P.recordMainVictory(s, {teamId: node.teamId, matchId: "won-" + sid + "-" + node.teamId});
        seenMain++;
        if (checkpoints.includes(node.mainIndex)) {
          mostRecentCheckpoint = node.mainIndex;
          assert.equal(s.lives, 2, "a checkpoint must refill both lives");
          const target = s.currentNodeId;
          const simulatedNextMain = "main:" + cfg.mainTeams[node.mainIndex + 1];
          const trial = {...copy(s), lives: 2, currentNodeId: simulatedNextMain, checkpointMainIndex: -1};
          const first = P.recordMainLoss(trial, {nodeId: simulatedNextMain});
          assert.equal(first.lives, 1);
          assert.equal(first.currentNodeId, simulatedNextMain, "first main loss must NOT rewind");
          const exhausted = P.recordMainLoss(first, {nodeId: simulatedNextMain});
          assert.equal(exhausted.currentNodeId, target, "second main loss must rewind to earned checkpoint");
          assert.equal(exhausted.lives, 2);
          assert.equal(exhausted.checkpointMainIndex, node.mainIndex, "stale numeric checkpoint must be repaired");
          assertPermanentUnchanged(trial, exhausted);
          const next = nodes[nodes.findIndex(n => n.id === node.id) + 1];
          if (next && next.type === "secondary") {
            const initialSecondary = {...copy(s), lives: 2};
            const secondaryFirst = P.recordSecondaryResult(initialSecondary, {
              nodeId: next.id, result: "loss", attemptNumber: 7
            });
            assert.equal(secondaryFirst.lives, 1);
            assert.equal(secondaryFirst.currentNodeId, next.id, "first secondary loss must NOT rewind");
            assert.equal(secondaryFirst.attemptsByNode[next.id].lastResult, "loss");
            const secondarySecond = P.recordSecondaryResult(secondaryFirst, {
              nodeId: next.id, result: "loss", attemptNumber: 8
            });
            assert.equal(secondarySecond.lives, 2);
            assert.equal(secondarySecond.currentNodeId, target, "second secondary loss must rewind");
            assert.equal(secondarySecond.attemptsByNode[next.id].lastAttempt, 8);
            assertPermanentUnchanged(initialSecondary, secondarySecond);
          }
        }
      } else {
        s = P.recordSecondaryResult(s, {nodeId: node.id, result:"victory", attemptNumber:1});
        assert.equal(s.checkpointMainIndex, mostRecentCheckpoint, "secondaries must not move main checkpoint");
      }
      assert.equal(s.checkpointMainIndex, mostRecentCheckpoint);
      assert.equal(P.nodeIndex(s), nodes.findIndex(n => n.id === s.currentNodeId));
      assert.notEqual(before, s, "state updates must be immutable");
    }
    assert.equal(seenMain, cfg.mainTeams.length);
    assert.equal(s.seasonComplete, true);
  });
  test(sid + ": two lives before first checkpoint, with legacy/stale checkpoint safety", () => {
    const original = fresh(sid);
    const first = P.recordMainLoss(original, {nodeId: original.currentNodeId});
    assert.equal(first.lives, 1);
    assert.equal(first.currentNodeId, original.currentNodeId);
    const second = P.recordMainLoss(first, {nodeId: original.currentNodeId});
    assert.equal(second.lives, 2);
    assert.equal(second.currentNodeId, original.currentNodeId);
    assert.equal(second.checkpointMainIndex, -1);
    assertPermanentUnchanged(original, second);

    const fake = {...fresh(sid), checkpointMainIndex: checkpoints.at(-1), lives: 1};
    const repaired = P.recordMainLoss(fake, {nodeId:fake.currentNodeId});
    assert.equal(repaired.checkpointMainIndex, -1, "a phantom checkpoint must never unlock later chapters");
    assert.equal(repaired.currentNodeId, original.currentNodeId);

    const achieved = {...fresh(sid), lives: 1, checkpointMainIndex: -1,
      defeatedTeamIds: cfg.mainTeams.slice(0, 3),
      currentNodeId: "main:" + cfg.mainTeams[3]};
    const restored = P.recordMainLoss(achieved, {nodeId:achieved.currentNodeId});
    const earnedIndex = nodes.findIndex(n => n.id === "main:" + cfg.mainTeams[2]);
    assert.equal(restored.currentNodeId, nodes[earnedIndex + 1].id,
      "a previously earned checkpoint must be recovered even from a stale save");
    assert.equal(restored.checkpointMainIndex, 2);
  });
  test(sid + ": secondary draw is not a defeat; completed season farming does not rewind", () => {
    const secondary = nodes.find(n => n.type === "secondary");
    const s = {...fresh(sid), currentNodeId: secondary.id};
    const drawn = P.recordSecondaryResult(s, {nodeId:secondary.id,result:"draw",attemptNumber:1});
    assert.equal(drawn.currentNodeId, secondary.id);
    assert.equal(drawn.lives, 2);
    const completed = {...copy(drawn), seasonComplete: true, lives: 2, currentNodeId: nodes.at(-1).id};
    const lost = P.recordSecondaryResult(completed, {nodeId:secondary.id,result:"loss",attemptNumber:2});
    assert.equal(lost.lives, 1);
    assert.equal(lost.currentNodeId, completed.currentNodeId);
    const exhausted = P.recordSecondaryResult(lost, {nodeId:secondary.id,result:"loss",attemptNumber:3});
    assert.equal(exhausted.lives, 2);
    assert.equal(exhausted.currentNodeId, completed.currentNodeId);
  });
}
