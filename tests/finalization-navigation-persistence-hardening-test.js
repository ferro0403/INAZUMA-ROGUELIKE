"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadController(initialRun, persistBehavior) {
  let run = structuredClone(initialRun);
  let celebrationGo = null;
  let summaryRenders = 0;
  let persistenceCalls = 0;
  let summaryTeam = null;
  const errors = [];

  const context = {
    console: { log: console.log, warn: console.warn, error: (...args) => errors.push(args) },
    structuredClone,
    RestoreGameplayRoutingGate: { enter: () => true },
    PermanentEffects: { resumeFinalization: () => ({ completed: true }) },
    HallOfFameStorage: { listSummaries: () => [{ hallTeamId: "hall-1" }] },
    RunState: { save: () => { throw Object.assign(new Error("quota blocked"), { code: "storage-quota-exceeded" }); } },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/finalization/finalization-controller.js", "utf8"), context, { filename: "finalization-controller.js" });

  const team = { hallTeamId: "hall-1", teamName: "Champions" };
  const controller = context.FinalizationController.create({
    getRun: () => run,
    view: {
      renderCelebration: (_team, go) => { celebrationGo = go; return "celebration"; },
      renderSummary: (renderedTeam) => { summaryRenders += 1; summaryTeam = renderedTeam; return "summary"; },
      renderPending: () => "pending",
    },
    toast: () => {},
    recoverCanonicalRun: () => {},
    resolveDevelopment: ({ onComplete }) => onComplete(),
    championTeam: () => team,
    renderHome: () => "home",
    persistMutation: (options) => {
      persistenceCalls += 1;
      return persistBehavior({
        options,
        getRun: () => run,
        setRun: (next) => { run = structuredClone(next); },
        apply: () => {
          const next = structuredClone(run);
          options.mutate(next);
          run = next;
          return { ok: true, run: next };
        },
      });
    },
  });

  return {
    controller,
    get run() { return run; },
    get celebrationGo() { return celebrationGo; },
    get summaryRenders() { return summaryRenders; },
    get persistenceCalls() { return persistenceCalls; },
    get summaryTeam() { return summaryTeam; },
    errors,
  };
}

// Hard failure: the mounted Celebration UI must not advance or mutate runtime.
{
  let fail = true;
  const h = loadController({ phase: "final-celebration", hallTeamId: "hall-1", finalization: { status: "complete" } }, ({ apply }) => {
    if (fail) return { ok: false, error: { code: "storage-quota-exceeded" } };
    return apply();
  });
  h.controller.renderCelebration("hall-1", { developmentResolved: true });
  assert.equal(typeof h.celebrationGo, "function");
  h.celebrationGo();
  assert.equal(h.run.phase, "final-celebration", "failed persistence must not advance runtime phase");
  assert.equal(h.summaryRenders, 0, "failed persistence must not render Summary");
  fail = false;
  h.celebrationGo();
  assert.equal(h.run.phase, "final-summary");
  assert.equal(h.summaryRenders, 1, "same-mounted retry must advance after commit");
  assert.equal(h.persistenceCalls, 2, "one failed attempt and one successful commit");
}

// Ambiguous verification failure: canonical state may already own final-summary.
{
  let ambiguous = true;
  const h = loadController({ phase: "final-celebration", hallTeamId: "hall-1", finalization: { status: "complete" } }, ({ options, getRun, setRun, apply }) => {
    if (ambiguous) {
      ambiguous = false;
      const canonical = structuredClone(getRun());
      options.mutate(canonical);
      setRun(canonical); // models adapter rebase after an ambiguous primary readback
      return { ok: false, error: { code: "canonical-verification-failed" } };
    }
    return apply();
  });
  h.controller.renderCelebration("hall-1", { developmentResolved: true });
  h.celebrationGo();
  assert.equal(h.run.phase, "final-summary", "ambiguous commit rebase may reveal canonical final-summary");
  assert.equal(h.summaryRenders, 0, "ambiguous result must not switch UI before explicit retry");
  h.celebrationGo();
  assert.equal(h.summaryRenders, 1, "same-mounted retry must render canonically committed Summary");
  assert.equal(h.persistenceCalls, 1, "retry over already-canonical final-summary must be read-only");
}

// Direct/reopen Summary is read-only when canonical phase + Hall identity are already correct.
{
  const h = loadController({ phase: "final-summary", hallTeamId: "hall-1", finalization: { status: "complete" } }, () => {
    throw new Error("reopen must not persist");
  });
  h.controller.renderSummary("hall-1", { developmentResolved: true });
  assert.equal(h.summaryRenders, 1);
  assert.equal(h.persistenceCalls, 0, "final-summary reopen/render must not create a new save");
  assert.equal(h.summaryTeam.hallTeamId, "hall-1");
}

// Direct legacy transition into Summary must also be commit-first.
{
  let fail = true;
  const h = loadController({ phase: "final-celebration", hallTeamId: "hall-1", finalization: { status: "complete" } }, ({ apply }) => {
    if (fail) return { ok: false, error: { code: "storage-quota-exceeded" } };
    return apply();
  });
  h.controller.renderSummary("hall-1", { developmentResolved: true });
  assert.equal(h.run.phase, "final-celebration");
  assert.equal(h.summaryRenders, 0);
  fail = false;
  h.controller.renderSummary("hall-1", { developmentResolved: true });
  assert.equal(h.run.phase, "final-summary");
  assert.equal(h.summaryRenders, 1);
}

console.log("finalization navigation hardening: commit-first Celebration→Summary, ambiguous retry and read-only reopen OK");
