// Registro dei TIPI di potere degli allenatori (Passo 3.3). Un allenatore non ha piu' un potere scritto nel motore
// con "if (coachId === ...)": ha nei dati `power: { type, params }` (catalogo in rtg-coaches.js, oppure il file di un
// evento in data/events/). Il motore (rtg-coach-powers-runtime.js e rtg-coach-powers-prematch.js) legge il tipo e i
// parametri da qui. Un allenatore nuovo con un potere di tipo esistente si aggiunge solo con i dati.
(function (global) {
  "use strict";

  const int = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;
  const oneOf = (...values) => (value) => values.includes(value);

  // phase: "squad" (configurato in squadra) o "prematch" (scelto prima della partita, agisce sugli avversari).
  // requiresPtMode: il potere agisce solo nelle partite con i PT (ptModeVersion 1).
  // params: controllo di ogni parametro accettato dal tipo.
  const TYPES = Object.freeze({
    ptBoost: { phase: "squad", requiresPtMode: true, params: { picks: int(1, 3), amount: int(1, 500) } },
    halveMoveCost: { phase: "squad", requiresPtMode: true, params: { picks: int(1, 1), divisor: int(2, 4) } },
    benchCapOverride: { phase: "squad", params: { picks: int(1, 1), cap: int(1, 99) } },
    rarityUpgrade: { phase: "squad", requiresPtMode: true, params: { picks: int(1, 2) } },
    elementTransform: { phase: "squad", params: { picks: int(1, 2) } },
    requirementsOvrDiscount: { phase: "squad", params: { picks: int(1, 1), amount: int(1, 30),
      target: oneOf("ownStarter"), cardScope: oneOf("event") } },
    swapOpponentStarter: { phase: "prematch", params: { picks: int(2, 2) } },
    borrowOpponentReserve: { phase: "prematch", params: { picks: int(2, 2) } },
    drainOpponentPt: { phase: "prematch", requiresPtMode: true, params: { picks: int(2, 2), divisor: int(2, 10) } },
    blockOpponentMoves: { phase: "prematch", params: { picks: int(1, 1) } },
    swapOpponentPositions: { phase: "prematch", params: { picks: int(2, 2) } },
  });

  // Errori di un potere scritto nei dati (vuoto = valido). Usato dal test dei dati.
  function problems(power) {
    const definition = TYPES[power?.type];
    if (!definition) return [`tipo di potere sconosciuto: ${power?.type}`];
    const params = power.params && typeof power.params === "object" ? power.params : {};
    const errors = [];
    for (const [name, check] of Object.entries(definition.params)) {
      if (!check(params[name])) errors.push(`parametro ${name} non valido per ${power.type}`);
    }
    for (const name of Object.keys(params)) if (!definition.params[name]) errors.push(`parametro ${name} non previsto`);
    return errors;
  }

  const id = (value) => String(value ?? "");
  // Potere di un allenatore: prima il file di un evento (che lo possiede), poi il catalogo degli allenatori.
  // Ritorna { coachId, type, phase, requiresPtMode, params, eventCardPrefix } oppure null.
  function powerFor(coachId) {
    const key = id(coachId);
    for (const event of global.GameEvents?.all?.() || []) {
      const coach = (event.coaches || []).find((entry) => id(entry.id) === key);
      if (coach?.power) return describe(key, coach.power, event.save?.cardIdPrefix || "");
    }
    const coach = global.RoadToGloryCoaches?.BY_ID?.[key];
    return coach?.power ? describe(key, coach.power, "") : null;
  }
  function describe(coachId, power, eventCardPrefix) {
    const definition = TYPES[power.type];
    if (!definition || problems(power).length) return null;
    return Object.freeze({ coachId, type: power.type, phase: definition.phase, requiresPtMode: !!definition.requiresPtMode,
      params: Object.freeze({ ...power.params }), eventCardPrefix });
  }
  const typeOf = (coachId) => powerFor(coachId)?.type || "";

  global.RoadToGloryCoachPowerTypes = Object.freeze({ TYPES, problems, powerFor, typeOf });
})(globalThis);
