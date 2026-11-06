"use strict";
// Dal Passo 3 gli eventi sono file dati (data/events/). Il gioco li carica all'avvio con GameEvents.load(); i test
// che caricano un modulo di evento in una sandbox registrano qui gli stessi file, nello stesso modo.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function loadEvents(context) {
  if (!vm.isContext(context)) vm.createContext(context);
  if (!context.globalThis) context.globalThis = context;
  if (!context.GameEvents) vm.runInContext(read("js/events/event-registry.js"), context);
  for (const id of JSON.parse(read("data/events/index.json")).events) {
    if (!context.GameEvents.get(id)) context.GameEvents.register(JSON.parse(read(`data/events/${id}.json`)));
  }
  return context;
}

module.exports = { loadEvents };
