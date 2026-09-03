"use strict";

const assert = require("assert");
const fs = require("fs");

const controllerPath = "js/run-entry/initial-draft-controller.js";
const viewPath = "js/run-entry/initial-draft-view.js";
assert(fs.existsSync(controllerPath));
assert(fs.existsSync(viewPath));
const controller = fs.readFileSync(controllerPath, "utf8");
const view = fs.readFileSync(viewPath, "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

for (const forbidden of ["RunState.save", "RunStorage", "Firebase", "Firestore", "CloudRestore", "CloudSave", "InazumaCloudSave", "AlbumProgress.unlock", "DevelopmentAccountV3", "HallOfFameStorage"]) {
  assert(!controller.includes(forbidden), `controller must not own ${forbidden}`);
  assert(!view.includes(forbidden), `view must not own ${forbidden}`);
}
for (const label of ["initial-formation-phase", "initial-draft-start", "initial-draft-pick"]) assert(controller.includes(`label: "${label}"`));
for (const token of [":initial_draft:", "RecruitmentPoolRuntime.effectiveProfiledPlayers", "eligibleInitialDraftPlayers", "freeAgentsOnly", "profileId", "SeasonRegistry?.isSeasonSource", "DraftEngine.start", "DraftEngine.choose", "ensureFiveVFive();", "reconcileSquadRosterState(current)", "enqueueAlbumRecruit", "unlockAlbumRecruit"]) assert(controller.includes(token), `missing controller invariant: ${token}`);
for (const token of ["formation-choice-screen", "data-formation", "aria-pressed", "Prima decisione", "initial-draft-screen", "Scelta ${draftState.step + 1}", "progress-track", "candidate-grid pull-offer-grid initial-draft-grid", 'button: true, extraClass: "initial-draft-card", applyPermanent: true']) assert(view.includes(token), `missing view contract: ${token}`);
assert(controller.indexOf("enqueueAlbumRecruit") < controller.indexOf("onCommitted()"));
assert(controller.indexOf("onCommitted()") < controller.lastIndexOf("unlockAlbumRecruit"));
assert(controller.includes("new Map(draftPlayers.map((player) => [String(player.playerId), player]))"));
assert(controller.includes("draftState.candidates.map((id) => draftById.get(String(id))).filter(Boolean)"));
assert(controller.includes("button.addEventListener(\"click\", () =>"), "application callbacks use explicit closures");
assert(controller.includes("DraftEngine.choose(current, playerId, draftPlayers,"), "the click uses the pool captured by its render, matching BASE");
assert(!controller.includes("currentDraftPlayers"), "the click does not recalculate the pool");
assert(!/create\([^)]*\)[\s\S]*?const draftState = getRun\(\)\.draft/.test(controller), "no creation-time draft snapshot");
assert(app.includes("InitialDraftView.create"));
assert(app.includes("InitialDraftController.create"));
assert(!app.includes('label: "initial-draft-pick"'), "old implementation removed from app.js");
assert(index.indexOf("initial-draft-view.js") < index.indexOf("js/app.js"));
assert(index.indexOf("initial-draft-controller.js") < index.indexOf("js/app.js"));
console.log("initial formation/draft domain characterization: ok");
