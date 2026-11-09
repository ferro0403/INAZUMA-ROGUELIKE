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
    if (!context.GameEvents.get(id)) runExtensions(context, context.GameEvents.register(JSON.parse(read(`data/events/${id}.json`))));
  }
  return context;
}
// Pezzi aggiuntivi degli eventi (Passo 3.6d): nel gioco li carica il registro nella pagina, qui si eseguono nella sandbox.
function runExtensions(context, manifest) {
  for (const src of manifest?.extensions || []) vm.runInContext(read(src.split("?")[0]), context, { filename: src });
}

// Come il gioco con ?dev=1&evento=<id>: carica l'indice, gli eventi veri e l'evento finto (data/events/dev/<id>.json).
async function loadEventsWithDev(context, devEventId) {
  if (!vm.isContext(context)) vm.createContext(context);
  if (!context.globalThis) context.globalThis = context;
  if (!context.GameEvents) vm.runInContext(read("js/events/event-registry.js"), context);
  const fetcher = async (url) => {
    const file = path.join(ROOT, String(url));
    const ok = fs.existsSync(file);
    return { ok, status: ok ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
  };
  const loaded = await context.GameEvents.load(fetcher, { devEventId });
  for (const manifest of [...loaded, context.GameEvents.get(devEventId)].filter(Boolean)) runExtensions(context, manifest);
  return context;
}

module.exports = { loadEvents, loadEventsWithDev };
