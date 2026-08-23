(function (global) {
  "use strict";

  const potentialByPlayerId = new Map();
  const contexts = new WeakMap();
  const snapshots = new WeakMap();
  const pendingDraftOptimization = new WeakSet();

  function playerIdOf(value) {
    return String(value?.playerId ?? value?.id ?? value ?? "");
  }

  function rememberPotential(playerId, resolved) {
    const id = playerIdOf(playerId);
    const potential = Number(resolved?.potential ?? resolved?.finalPotential ?? resolved?.finalOverall);
    if (id && Number.isFinite(potential)) potentialByPlayerId.set(id, potential);
    return resolved;
  }

  function installPotentialTracking() {
    const progression = global.InazumaProgression;
    if (progression?.getPlayerAtLevel && !progression.getPlayerAtLevel.__smartLineupWrapped) {
      const original = progression.getPlayerAtLevel.bind(progression);
      const wrapped = function getPlayerAtLevelWithPotential(player, ...args) {
        return rememberPotential(player, original(player, ...args));
      };
      wrapped.__smartLineupWrapped = true;
      progression.getPlayerAtLevel = wrapped;
    }

    const profiled = global.ProfiledSeasonRuntime;
    if (profiled?.resolveEffectivePlayerAtLevel && !profiled.resolveEffectivePlayerAtLevel.__smartLineupWrapped) {
      const original = profiled.resolveEffectivePlayerAtLevel.bind(profiled);
      const wrapped = function resolveProfileWithPotential(entry, ...args) {
        return rememberPotential(entry, original(entry, ...args));
      };
      wrapped.__smartLineupWrapped = true;
      profiled.resolveEffectivePlayerAtLevel = wrapped;
    }
  }

  function smartEnabled() {
    return global.RunState?.loadProfile?.().preferences?.smartAutoLineup === true;
  }

  function rememberContext(run, getRole, getOverall) {
    if (!run || typeof getRole !== "function" || typeof getOverall !== "function") return null;
    const context = { getRole, getOverall };
    contexts.set(run, context);
    return context;
  }

  function currentPotential(context, playerId) {
    const id = String(playerId);
    try { context?.getOverall?.(id); } catch (_) {}
    return Number(potentialByPlayerId.get(id)) || 0;
  }

  function elevenSlotRoles(run, context) {
    const lineup = Array.isArray(run?.lineup) ? run.lineup : [];
    if (!lineup.length) return [];
    const roles = lineup.map((id) => id ? context.getRole(String(id)) : null);
    return roles.every(Boolean) ? roles : [];
  }

  function optimizeRun(run, context = contexts.get(run), { elevenOnly = false } = {}) {
    if (!run || !context || !smartEnabled() || !global.SmartLineup?.optimizeAllLineups) return null;
    const formation = !elevenOnly && run.fiveVFive && global.FiveVFive?.formationById
      ? global.FiveVFive.formationById(run.fiveVFive.formation)
      : null;
    return global.SmartLineup.optimizeAllLineups(run, {
      enabled: true,
      getRole: context.getRole,
      getOverall: context.getOverall,
      getPotential: (id) => currentPotential(context, id),
      elevenSlotRoles: elevenSlotRoles(run, context),
      fiveFormation: formation,
    });
  }

  function rosterSignature(run) {
    return JSON.stringify((run?.roster || []).map((entry) => ({
      id: String(entry.playerId),
      level: Number(entry.level || 0),
      units: Number(entry.levelUnits || 0),
      profile: entry.activeProfileId || null,
      roleVariant: entry.activeRoleVariantId || null,
      potentialBoost: Number(entry.potentialBoost || 0),
      currentOverallBoost: Number(entry.currentOverallBoost || 0),
    })));
  }

  function runSnapshot(run) {
    return {
      roster: rosterSignature(run),
      formationId: String(run?.formationId || ""),
    };
  }

  function installDraftHook() {
    const draft = global.DraftEngine;
    if (!draft?.choose || draft.choose.__smartLineupWrapped) return;
    const original = draft.choose.bind(draft);
    const wrapped = function chooseWithSmartLineup(run, ...args) {
      const result = original(run, ...args);
      if (result === true) pendingDraftOptimization.add(run);
      return result;
    };
    wrapped.__smartLineupWrapped = true;
    draft.choose = wrapped;
  }

  function installFiveEnsureHook() {
    const five = global.FiveVFive;
    if (!five?.ensure || five.ensure.__smartLineupWrapped) return;
    const original = five.ensure.bind(five);
    const wrapped = function ensureWithSmartLineup(run, getRole, getOverall, ...args) {
      const state = original(run, getRole, getOverall, ...args);
      const context = rememberContext(run, getRole, getOverall);
      if (pendingDraftOptimization.has(run)) {
        pendingDraftOptimization.delete(run);
        optimizeRun(run, context);
      }
      snapshots.set(run, runSnapshot(run));
      return state;
    };
    wrapped.__smartLineupWrapped = true;
    five.ensure = wrapped;
  }

  function installNewPlayerHook() {
    const smart = global.SmartLineup;
    if (!smart?.optimizeLineupsForNewPlayer || smart.optimizeLineupsForNewPlayer.__smartLineupWrapped) return;
    const original = smart.optimizeLineupsForNewPlayer.bind(smart);
    const wrapped = function optimizeNewPlayerWithPotential(run, playerId, options = {}) {
      const context = rememberContext(run, options.getRole, options.getOverall) || contexts.get(run);
      const enriched = context ? {
        ...options,
        getPotential: (id) => currentPotential(context, id),
      } : options;
      return original(run, playerId, enriched);
    };
    wrapped.__smartLineupWrapped = true;
    smart.optimizeLineupsForNewPlayer = wrapped;
  }

  function installSaveHook() {
    const state = global.RunState;
    if (!state?.save || state.save.__smartLineupWrapped) return;
    const original = state.save.bind(state);
    const wrapped = function saveWithSmartLineup(run, ...args) {
      const before = snapshots.get(run);
      const current = runSnapshot(run);
      let rollback = null;
      try {
        if (before && (before.roster !== current.roster || before.formationId !== current.formationId)) {
          // SmartLineup is a pre-save derived mutation.  Keep the caller's
          // changes, but make every field touched by the optimizer atomic with
          // the canonical RunState commit.
          rollback = structuredClone(run);
          if (before.roster !== current.roster) optimizeRun(run);
          else optimizeRun(run, contexts.get(run), { elevenOnly: true });
        }
        const result = original(run, ...args);
        snapshots.set(run, runSnapshot(run));
        return result;
      } catch (error) {
        if (rollback) {
          Object.keys(run).forEach((key) => delete run[key]);
          Object.assign(run, rollback);
        }
        throw error;
      }
    };
    wrapped.__smartLineupWrapped = true;
    state.save = wrapped;
  }

  installPotentialTracking();
  installDraftHook();
  installFiveEnsureHook();
  installNewPlayerHook();
  installSaveHook();

  global.SmartLineupRuntime = Object.freeze({ optimizeRun });
})(globalThis);
