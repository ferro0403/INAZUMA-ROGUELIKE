(function (global) {
  "use strict";

  function weightedChoice(entries, random) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = random() * total;
    for (const entry of entries) {
      cursor -= entry.weight;
      if (cursor <= 0) return entry.type;
    }
    return entries[entries.length - 1].type;
  }

  function availableTypes(run) {
    const config = global.SEASON1_CONFIG;
    return Object.entries(config.nodeWeights)
      .filter(([type, weight]) => {
        if (weight <= 0 || config.disabledNodeTypes.includes(type)) return false;
        if (type === "pull_unlocked_teams" && run.unlockedTeamIds.length === 0) return false;
        if (type === "pull_legendary" && run.bossIndex < config.legendaryUnlockBossIndex) return false;
        return true;
      })
      .map(([type, weight]) => ({ type, weight }));
  }

  function connectLayers(previous, next, random, edges) {
    previous.forEach((source, sourceIndex) => {
      const targetIndex = Math.min(
        next.length - 1,
        Math.round((sourceIndex / Math.max(1, previous.length - 1)) * (next.length - 1))
      );
      edges.push([source.id, next[targetIndex].id]);
      if (next.length > 1 && random() < 0.58) {
        const alternate = targetIndex + (random() < 0.5 ? -1 : 1);
        if (alternate >= 0 && alternate < next.length) edges.push([source.id, next[alternate].id]);
      }
    });

    next.forEach((target) => {
      if (!edges.some((edge) => edge[1] === target.id)) {
        const source = previous[Math.floor(random() * previous.length)];
        edges.push([source.id, target.id]);
      }
    });
  }

  function generate(run, boss) {
    const config = global.SEASON1_CONFIG;
    const seed = `${run.runId}:zone:${run.bossIndex}:${boss.teamId}`;
    const random = global.DraftEngine.randomFromSeed(seed);
    const types = availableTypes(run);
    const layers = [];
    const nodes = [];
    const edges = [];

    const start = { id: `zone_${run.bossIndex}_start`, type: "start", layer: 0, column: 0 };
    nodes.push(start);
    layers.push([start]);

    config.nodeCounts.forEach((count, layerIndex) => {
      const layer = Array.from({ length: count }, (_, column) => ({
        id: `zone_${run.bossIndex}_l${layerIndex + 1}_n${column}`,
        type: weightedChoice(types, random),
        layer: layerIndex + 1,
        column,
      }));
      nodes.push(...layer);
      layers.push(layer);
      connectLayers(layers[layers.length - 2], layer, random, edges);
    });

    const bossNode = {
      id: `zone_${run.bossIndex}_boss`,
      type: "boss",
      layer: layers.length,
      column: 0,
      bossId: boss.teamId,
    };
    nodes.push(bossNode);
    connectLayers(layers[layers.length - 1], [bossNode], random, edges);
    layers.push([bossNode]);

    return {
      bossIndex: run.bossIndex,
      bossId: boss.teamId,
      seed,
      nodes,
      edges,
      startNodeId: start.id,
      currentNodeId: start.id,
      completedNodeIds: [start.id],
      path: [start.id],
      pendingNodeId: null,
    };
  }

  function reachableNodeIds(zone) {
    return zone.edges
      .filter((edge) => edge[0] === zone.currentNodeId)
      .map((edge) => edge[1]);
  }

  function selectNode(zone, nodeId) {
    if (!reachableNodeIds(zone).includes(nodeId)) throw new Error("Node is not reachable");
    zone.pendingNodeId = nodeId;
    return zone.nodes.find((node) => node.id === nodeId);
  }

  function completeNode(zone, nodeId) {
    if (!zone.completedNodeIds.includes(nodeId)) zone.completedNodeIds.push(nodeId);
    zone.currentNodeId = nodeId;
    zone.pendingNodeId = null;
    zone.path.push(nodeId);
  }

  global.MapEngine = {
    generate,
    reachableNodeIds,
    selectNode,
    completeNode,
  };
})(globalThis);
