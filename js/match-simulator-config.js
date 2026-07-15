(function (global) {
  "use strict";
  global.MatchSimulatorConfig = {
    playbackMs: 1500,
    eventDelayMs: 1500,
    forceWeights: { overall: 0.7, profile: 0.3 },
    profileWeights: { offense: 0.35, midfield: 0.25, defense: 0.25, goalkeeper: 0.15 },
    tacticalComponentWeights: { attack: 0.28, control: 0.20, defense: 0.22, save: 0.12, speed: 0.07, physical: 0.06, stamina: 0.05 },
    phases: {
      offense: { stats: { attack: .45, control: .20, speed: .15, grit: .10, physical: .10 }, roles: { FW: 1, MF: .65, DF: .25, GK: 0 } },
      midfield: { stats: { control: .35, stamina: .20, grit: .15, speed: .15, attack: .10, defense: .05 }, roles: { MF: 1, DF: .60, FW: .50, GK: 0 } },
      defense: { stats: { defense: .45, physical: .20, grit: .15, speed: .10, stamina: .10 }, roles: { DF: 1, MF: .60, FW: .20, GK: 0 } },
      goalkeeper: { stats: { save: .65, grit: .15, physical: .10, defense: .05, control: .05 } },
    },
    events: { eleven: { min: 12, max: 20, duration: 90 }, five: { min: 8, max: 10, duration: 30 } },
    scores: {
      eleven: [ { score:[1,0], weight:18 }, { score:[2,0], weight:15 }, { score:[2,1], weight:24 }, { score:[3,0], weight:8 }, { score:[3,1], weight:15 }, { score:[3,2], weight:12 }, { score:[4,1], weight:4 }, { score:[4,2], weight:4 } ],
      five: [ { score:[2,1], weight:12 }, { score:[3,1], weight:15 }, { score:[3,2], weight:20 }, { score:[4,2], weight:18 }, { score:[4,3], weight:15 }, { score:[5,2], weight:8 }, { score:[5,3], weight:8 }, { score:[6,3], weight:2 }, { score:[6,4], weight:2 } ],
    },
    allowedEventTypes: ["save", "goal", "counter", "long_shot", "post", "crossbar", "shot", "defensive_stop", "first_half_start", "second_half_start"],
  };
})(globalThis);
