"use strict";
// Dal Passo 3.3 il tipo e i parametri di ogni potere degli allenatori sono dati: catalogo (rtg-coaches.js) e file
// degli eventi (data/events/). I test che caricano il motore dei poteri in una sandbox caricano prima questi dati,
// come fa il gioco. Il catalogo vero sostituisce il finto { owned } dei test (stesso comportamento di owned).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadEvents } = require("./events");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function loadCoachPowerData(context) {
  if (!vm.isContext(context)) vm.createContext(context);
  if (!context.RoadToGloryCoaches?.CATALOG) vm.runInContext(read("js/road-to-glory/rtg-coaches.js"), context);
  loadEvents(context);
  if (!context.RoadToGloryCoachPowerTypes) vm.runInContext(read("js/road-to-glory/rtg-coach-power-types.js"), context);
  return context;
}

module.exports = { loadCoachPowerData };
