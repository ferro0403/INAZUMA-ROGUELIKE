(function (global) {
  "use strict";

  function create(options = {}) {
    const devMode = options.devMode === true;
    const getRun = options.getRun || (() => null);
    const getUi = options.getUi || (() => ({}));
    const getActiveSeason = options.getActiveSeason || (() => null);
    const failures = [];

    function repairResultMessage(result = {}) {
      if (result.blocker) return `Riparazione non applicata: ${result.blocker}`;
      return result.repaired === true ? "Riparazione salvataggio completata. Report copiato." : "Nessuna modifica necessaria. Report copiato.";
    }

    function mountPersistenceTools() {
      if (!devMode) return false;
      global.addEventListener("DOMContentLoaded", () => {
        const tools = document.createElement("aside");
        tools.className = "persistence-dev-tools";
        tools.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top, 0px) + 8px);right:calc(env(safe-area-inset-right, 0px) + 8px);z-index:10000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:min(300px,calc(100vw - 16px));pointer-events:none";
        tools.innerHTML = '<button type="button" data-dev-diagnostics-trigger aria-expanded="false" aria-controls="dev-diagnostics-menu" style="pointer-events:auto;min-width:44px;min-height:36px;padding:6px 10px">DEV</button><div id="dev-diagnostics-menu" data-dev-diagnostics-menu hidden style="pointer-events:auto;background:#05080f;border:1px solid #52627a;border-radius:10px;padding:8px;box-shadow:0 10px 28px #000a;max-width:100%"><button type="button" data-persistence-diagnostic>COPIA DIAGNOSTICA SALVATAGGIO</button><button type="button" data-raw-save-diagnostic>COPIA RAW SAVE IE1/IE2</button><button type="button" data-persistence-repair>RIPARA SALVATAGGIO</button><span data-persistence-feedback role="status" aria-live="polite" style="display:block;color:#fff;font:700 11px sans-serif;margin-top:6px"></span></div>';
        const trigger = tools.querySelector("[data-dev-diagnostics-trigger]");
        const menu = tools.querySelector("[data-dev-diagnostics-menu]");
        const setOpen = (open) => { menu.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); };
        trigger.onclick = () => setOpen(menu.hidden);
        document.addEventListener("click", (event) => { if (!menu.hidden && !tools.contains(event.target)) setOpen(false); });
        const feedback = tools.querySelector("[data-persistence-feedback]");
        const download = (text) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = `inazuma-raw-save-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 0); };
        const copy = async (value, fallback = false) => { const text = JSON.stringify(value, null, 2); try { if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable"); await navigator.clipboard.writeText(text); return true; } catch (error) { if (fallback) download(text); else throw error; return false; } finally { console.info("Inazuma persistence report", value); } };
        tools.querySelector("[data-persistence-diagnostic]").onclick = async () => { try { await copy(await global.InazumaPersistenceDiagnostics.snapshot()); } finally { setOpen(false); } };
        tools.querySelector("[data-raw-save-diagnostic]").onclick = async () => { try { const copied = await copy(await global.InazumaPersistenceDiagnostics.exportRawLegacySaves(), true); feedback.textContent = copied ? "DIAGNOSTICA RAW COPIATA" : "CLIPBOARD NON DISPONIBILE: JSON SCARICATO"; } finally { setOpen(false); } };
        tools.querySelector("[data-persistence-repair]").onclick = async () => { try { const result = await global.InazumaPersistenceDiagnostics.repair(); await copy(result); alert(repairResultMessage(result)); } finally { setOpen(false); } };
        document.body.appendChild(tools);
      });
      return true;
    }

    function recordGameplayFailure(label, stage, error, kind = null) {
      if (!devMode) return null;
      const current = getRun();
      const ui = getUi();
      const seasonId = current?.seasonId || getActiveSeason()?.id || null;
      let canonical = null; let storage = null;
      try { canonical = seasonId ? global.RunState.load(seasonId, { readOnly: true }) : null; } catch (_) {}
      try { storage = seasonId ? global.RunStorage?.diagnostics?.(seasonId) : null; } catch (_) {}
      const match = current?.activeMatch || ui?.match || null;
      const entry = {
        at: new Date().toISOString(), label: label || "unknown", stage, kind,
        seasonId, runId: current?.runId || null, phase: current?.phase || null,
        error: { name: error?.name || null, code: error?.code || null, stage: error?.stage || null, message: error?.message || String(error || ""), recoverable: error?.recoverable === true },
        generation: { memory: current?.storageGeneration ?? null, canonical: canonical?.storageGeneration ?? storage?.canonicalGeneration ?? null, expected: error?.generation ?? current?.storageGeneration ?? null },
        commitId: { memory: current?.storageCommitId || null, canonical: canonical?.storageCommitId || storage?.canonicalCommitId || null },
        canonicalRunId: canonical?.runId || storage?.canonicalRunId || null,
        match: match ? { matchId: match.matchId || null, type: match.type || null, state: match.state || null, simulationState: match.simulation?.state || null, resolutionApplied: match.simulation?.resolutionApplied === true } : null,
        node: { currentNodeId: current?.currentZone?.currentNodeId || null, pendingNodeId: current?.currentZone?.pendingNodeId || null },
        storage: storage ? { bytes: storage.bytes, totalKnownBytes: storage.totalKnownBytes, headGeneration: storage.headGeneration, backupGeneration: storage.backupGeneration, headMatchesCanonical: storage.headMatchesCanonical } : null,
      };
      failures.push(entry);
      if (failures.length > 20) failures.shift();
      console.error("Gameplay persistence diagnostic", entry);
      return entry;
    }

    function matchDiagnostics() {
      const run = getRun();
      const match = run?.activeMatch;
      const effects = run?.permanentEffectOutbox || [];
      return { runId: run?.runId, matchId: match?.matchId, matchType: match?.type, phase: run?.phase, simulationState: match?.simulation?.state, resolutionApplied: match?.simulation?.resolutionApplied === true, result: match?.result, winner: match?.simulation?.winner, revealedCount: match?.simulation?.revealedCount, timelineLength: match?.simulation?.timeline?.length, pendingPostMatchAction: match?.pendingPostMatchAction || null, lives: run?.lives, gameOver: run?.gameOver, finalization: run?.finalization?.status || null, permanentEffects: { pending: effects.filter((effect) => effect.status === "pending").length, applied: effects.filter((effect) => effect.status === "applied").length }, postBossFlow: run?.postBossFlow?.status || null };
    }

    function installGlobals() {
      if (!devMode) return false;
      global.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__ = () => global.RunState.clone(failures);
      global.__INAZUMA_MATCH_DIAGNOSTICS__ = matchDiagnostics;
      return true;
    }

    return { repairResultMessage, mountPersistenceTools, recordGameplayFailure, matchDiagnostics, installGlobals };
  }

  global.AppDevDiagnosticsRuntime = { create };
})(globalThis);
