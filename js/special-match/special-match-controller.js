(function (global) {
  "use strict";

  function create(deps) {
    const runtime = () => global.SpecialMatchRuntime;
    function byId(id) { return runtime().byId(deps.getSeasonDb(), id); }
    function forNode(node) { return runtime().forNode(deps.getSeasonDb(), node); }
    function teamPlayers(special) { return runtime().teamPlayers(deps.getSeasonDb(), special); }
    function fromNode(node, previousNodeId = null, run = deps.getRun()) { return runtime().fromNode(run, deps.getSeasonDb(), node, previousNodeId); }

    function createForSelectedNode(current, selectedNode, previousNodeId) {
      if (selectedNode.type !== "special_match") throw new Error("Node is not a special match");
      return current.activeMatch?.type === "special_match" && current.activeMatch.nodeId === selectedNode.id
        ? current.activeMatch : fromNode(selectedNode, previousNodeId, current);
    }

    function recoverAccess() {
      const run = deps.getRun();
      if (!run || run.pendingSpecialMatchReward) return false;
      if (run.activeMatch?.type === "special_match") {
        if (run.phase === "match") return true;
        const identity = deps.matchIdentity(run.activeMatch);
        return deps.commitMatch("special-match-access-recovery", identity, (_match, current) => { current.phase = "match"; }).ok;
      }
      const pending = run.currentZone?.nodes?.find((node) => String(node.id) === String(run.currentZone?.pendingNodeId));
      if (pending?.type !== "special_match") return false;
      const nodeId = pending.id;
      return deps.persistMutation({
        label: "special-match-entry-recovery",
        mutate: (current) => {
          if (current.activeMatch || String(current.currentZone?.pendingNodeId) !== String(nodeId)) throw new Error("Special match recovery state changed");
          const currentNode = current.currentZone?.nodes?.find((node) => String(node.id) === String(nodeId));
          if (currentNode?.type !== "special_match") throw new Error("Special match recovery node changed");
          current.activeMatch = fromNode(currentNode, current.currentZone.currentNodeId, current);
          current.phase = "match";
        },
        onCommitted: (_value, current) => deps.mountMatch(current.activeMatch),
      }).ok;
    }

    function complete(result) {
      const match = deps.getRun()?.activeMatch;
      if (!match?.simulation || match.simulation.resolutionApplied) return;
      const identity = deps.matchIdentity(match);
      const committed = deps.commitMatch("special-match-resolution", identity, (currentMatch, current) => {
        if (currentMatch.simulation.resolutionApplied) return { applied: false };
        currentMatch.simulation.resolutionApplied = true;
        currentMatch.result = result;
        currentMatch.state = result === "victory" ? "completed-victory" : "completed-defeat";
        deps.applyConsecutiveLoss(result, current);
        if (currentMatch.simulation.score) currentMatch.score = [currentMatch.simulation.score.user, currentMatch.simulation.score.opponent];
        deps.applyStatistics(currentMatch, result, current);
        const node = current.currentZone?.nodes?.find((item) => item.id === currentMatch.nodeId);
        if (result === "victory") {
          runtime().complete(current, deps.getSeasonDb(), currentMatch, result);
          if (node) deps.completeNode(current.currentZone, node.id);
          currentMatch.pendingPostMatchAction = { type: "special-reward", toast: "Vittoria: +1 livello e scelta giocatore" };
        } else {
          deps.restoreAfterLoss(current, currentMatch.previousNodeId, currentMatch.type, { save: false });
          deps.enqueueGameOver(current);
          currentMatch.pendingPostMatchAction = { type: current.gameOver ? "game-over" : "map", toast: current.gameOver ? "Hai perso l'ultima vita. La run è terminata." : "Sconfitta: torni al nodo precedente." };
        }
        current.phase = "match";
        current.activeMatch = currentMatch;
        deps.appendFinalMessage(result, "special_match", currentMatch);
        return { applied: true };
      }, { onCommitted: deps.onResolutionCommitted });
      if (!committed.ok) return deps.stopAfterPersistenceFailure();
      deps.renderCommittedResult();
    }

    return { byId, forNode, teamPlayers, fromNode, createForSelectedNode, recoverAccess, complete };
  }

  global.SpecialMatchControllerRuntime = { create };
})(globalThis);
