(function (global) {
  "use strict";

  global.SEASON1_CONFIG = {
    saveKey: "inazumaRoguelikeSeason1Run_v1",
    saveVersion: 1,
    startingLives: 3,
    maxRoster: 15,
    startingRoster: 11,
    mapsPerBoss: 1,
    zoneLayers: 6,
    nodeCounts: [2, 3, 3, 2, 3, 2],
    legendaryUnlockBossIndex: 4,
    disabledNodeTypes: ["secondary_match", "coach"],
    lossPolicy: "restore_last_boss_checkpoint",
    nodeWeights: {
      five_v_five: 32,
      item: 15,
      pull_free_agents: 17,
      pull_unlocked_teams: 8,
      pull_legendary: 3,
      trade: 9,
      random: 16,
    },
    nodeLabels: {
      start: { label: "Partenza", icon: "◆", color: "#f6c85f" },
      five_v_five: { label: "Partita 5v5", icon: "5", color: "#e74c3c" },
      item: { label: "Oggetto", icon: "▣", color: "#f1c40f" },
      pull_free_agents: { label: "Pull svincolati", icon: "?", color: "#4aa3df" },
      pull_unlocked_teams: { label: "Pull squadre", icon: "★", color: "#8e67d4" },
      pull_legendary: { label: "Pull leggendario", icon: "✦", color: "#ff9f43" },
      trade: { label: "Scambio", icon: "⇄", color: "#31c48d" },
      random: { label: "Evento casuale", icon: "?", color: "#95a5a6" },
      boss: { label: "Boss", icon: "⚽", color: "#d63031" },
    },
    itemPool: [
      { id: "energy_drink", name: "Bevanda energetica", description: "Oggetto provvisorio della Season 1." },
      { id: "training_notes", name: "Appunti di allenamento", description: "Oggetto provvisorio della Season 1." },
      { id: "lucky_charm", name: "Portafortuna", description: "Oggetto provvisorio della Season 1." },
    ],
  };
})(globalThis);
