from pathlib import Path
import re

APP = Path('js/app.js')
INDEX = Path('index.html')
text = APP.read_text()

EXPECTED_APP_BLOB_MARKER = 'function renderFiveVFive(options = {})'
if EXPECTED_APP_BLOB_MARKER not in text:
    raise SystemExit('unexpected app.js baseline')


def replace_once(label, old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one occurrence, got {count}')
    text = text.replace(old, new, 1)

# 1) FiveVFive mutation helpers: current-run explicit; status becomes presentation-only.
replace_once('ensureFiveVFive currentRun', '''  function ensureFiveVFive() {
    if (!run || !run.roster?.length) return null;
    return global.FiveVFive.ensure(run, fiveRoleForPlayerId, fiveOverallForPlayerId);
  }
''', '''  function ensureFiveVFive(currentRun = run) {
    if (!currentRun || !currentRun.roster?.length) return null;
    return global.FiveVFive.ensure(
      currentRun,
      (id) => fiveRoleForPlayerId(id, currentRun),
      (id) => fiveOverallForPlayerId(id, currentRun)
    );
  }
''')

replace_once('fiveVFiveStatus read only', '''  function fiveVFiveStatus() {
    ensureFiveVFive();
    return global.FiveVFive.validate(run, fiveRoleForPlayerId);
  }
''', '''  function fiveVFiveStatus(currentRun = run, { autoFill = false } = {}) {
    if (!currentRun) return { valid: false, messages: ["Run non disponibile"], assignedCount: 0, formation: global.FiveVFive.formationById(null) };
    const snapshot = typeof structuredClone === "function" ? structuredClone(currentRun) : JSON.parse(JSON.stringify(currentRun));
    if (autoFill) ensureFiveVFive(snapshot);
    return global.FiveVFive.validate(snapshot, (id) => fiveRoleForPlayerId(id, snapshot));
  }
''')

# 2) Preserve historical ensure/autofill-before-validate inside the node-entry transaction.
replace_once('five node ensure before validate', '''          if (selectedNode.type === "five_v_five") {
            const status = global.FiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
            if (!status.valid) { current.phase = "five"; current.activeMatch = null; return { formationRequired: true }; }
            created = createOrLoadFiveMatch(selectedNode, current);
          }
''', '''          if (selectedNode.type === "five_v_five") {
            ensureFiveVFive(current);
            const status = global.FiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
            if (!status.valid) { current.phase = "five"; current.activeMatch = null; return { formationRequired: true }; }
            created = createOrLoadFiveMatch(selectedNode, current);
          }
''')

# 3) Reopen phase=five is presentation-only.
replace_once('resume five read only', '''    if (run.phase === "five") return renderFiveVFive({ returnToMatch: run.activeMatch?.type === "five_v_five" });
''', '''    if (run.phase === "five") return renderFiveVFive({ persist: false, returnToMatch: run.activeMatch?.type === "five_v_five" });
''')

# 4) Generic explicit editor entry for non-resume navigation.
insert_before = '''  function renderFiveVFive(options = {}) {
    run.phase = "five";
    ensureRunSchema();
    ensureFiveVFive();
    if (options.persist !== false) global.RunState.save(run);
    const status = fiveVFiveStatus();
'''
if text.count(insert_before) != 1:
    raise SystemExit('renderFiveVFive baseline block mismatch')
replacement = '''  function openFiveVFiveEditor(options = {}) {
    const returnToMatch = options.returnToMatch === true;
    const expectedIdentity = returnToMatch && run?.activeMatch?.type === "five_v_five" ? matchTransactionIdentity(run.activeMatch) : null;
    return persistGameplayMutation({
      label: options.label || "five-editor-entry",
      mutate: (current) => {
        if (expectedIdentity) canonicalMatchFor(current, expectedIdentity);
        ensureFiveVFive(current);
        current.phase = "five";
      },
      onCommitted: () => renderFiveVFive({ persist: false, returnToMatch }),
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
  }

  function commitFiveEditorMutation(label, mutate, options = {}) {
    const expectedIdentity = run?.activeMatch?.type === "five_v_five" ? matchTransactionIdentity(run.activeMatch) : null;
    return persistGameplayMutation({
      label,
      mutate: (current) => {
        if (expectedIdentity) canonicalMatchFor(current, expectedIdentity);
        return mutate(current);
      },
      onCommitted: options.onCommitted,
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
  }

  function renderFiveVFive(options = {}) {
    const status = fiveVFiveStatus(run);
'''
text = text.replace(insert_before, replacement, 1)

# Fallback state is presentation-only and prevents legacy/null editor crashes.
replace_once('five render formation state', '''    const formation = status.formation;
    const selectedSlot = ui.fiveVFiveSelectedSlot && formation.slots.some((slot) => slot.key === ui.fiveVFiveSelectedSlot)
      ? ui.fiveVFiveSelectedSlot
      : formation.slots.find((slot) => !run.fiveVFive.slots[slot.key])?.key || formation.slots[0].key;
''', '''    const formation = status.formation;
    const fiveState = run.fiveVFive || { formation: formation.id, slots: global.FiveVFive.emptySlots(formation.id) };
    const selectedSlot = ui.fiveVFiveSelectedSlot && formation.slots.some((slot) => slot.key === ui.fiveVFiveSelectedSlot)
      ? ui.fiveVFiveSelectedSlot
      : formation.slots.find((slot) => !fiveState.slots[slot.key])?.key || formation.slots[0].key;
''')

# Only the initial field render uses the stable presentation fallback; refresh paths use committed run.
needle = '${formation.slots.filter((slot) => slot.line === line).map((slot) => fiveSlotCard(slot, run.fiveVFive.slots[slot.key], status)).join("")}'
if text.count(needle) != 1:
    raise SystemExit(f'five pitch initial state count mismatch: {text.count(needle)}')
text = text.replace(needle, '${formation.slots.filter((slot) => slot.line === line).map((slot) => fiveSlotCard(slot, fiveState.slots[slot.key], status)).join("")}', 1)

# fiveRosterCard must tolerate a read-only legacy/null fiveVFive without mutating it.
replace_once('fiveRosterCard fallback', '''  function fiveRosterCard(entry, selectedSlot) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const slot = selectedSlot ? global.FiveVFive.formationById(run.fiveVFive.formation).slots.find((item) => item.key === selectedSlot) : null;
    const compatible = !slot || player.position === slot.role;
    const assignedSlot = Object.entries(run.fiveVFive.slots).find(([, id]) => String(id) === String(entry.playerId))?.[0];
''', '''  function fiveRosterCard(entry, selectedSlot) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const fiveState = run.fiveVFive || { formation: global.FiveVFive.formationById(null).id, slots: {} };
    const slot = selectedSlot ? global.FiveVFive.formationById(fiveState.formation).slots.find((item) => item.key === selectedSlot) : null;
    const compatible = !slot || player.position === slot.role;
    const assignedSlot = Object.entries(fiveState.slots || {}).find(([, id]) => String(id) === String(entry.playerId))?.[0];
''')

# 5) Any old generic navigation that relied on renderFiveVFive to persist now uses an explicit entry mutation.
nav_old = '''        } else if (destination === "five") {
          renderFiveVFive();
        }
'''
if text.count(nav_old) != 1:
    raise SystemExit(f'five nav call count mismatch: {text.count(nav_old)}')
text = text.replace(nav_old, '''        } else if (destination === "five") {
          openFiveVFiveEditor();
        }
''', 1)

# 6) Editor module change is transactional.
replace_once('five formation transaction', '''    document.querySelectorAll("[data-five-formation]").forEach((button) => button.addEventListener("click", () => {
      global.FiveVFive.changeFormation(run, button.dataset.fiveFormation, fiveRoleForPlayerId);
      ui.fiveVFiveSelectedSlot = null;
      global.RunState.save(run);
      runKeepingScroll(() => renderFiveVFive(options));
    }));
''', '''    document.querySelectorAll("[data-five-formation]").forEach((button) => button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      const nextFormation = button.dataset.fiveFormation;
      const committed = commitFiveEditorMutation("five-lineup-formation-change", (current) =>
        global.FiveVFive.changeFormation(current, nextFormation, (id) => fiveRoleForPlayerId(id, current)), {
          onCommitted: () => {
            ui.fiveVFiveSelectedSlot = null;
            runKeepingScroll(() => renderFiveVFive({ ...options, persist: false }));
          },
        });
      if (!committed.ok) return;
    }));
''')

# 7) Assign always mutates current canonical candidate, never a captured global run.
replace_once('five assign transaction', '''        const assigned = persistGameplayMutation({ label: "five-lineup-assign", mutate: () => global.FiveVFive.assign(run, ui.fiveVFiveSelectedSlot, playerButton.dataset.fivePlayer, fiveRoleForPlayerId), onCommitted: () => { ui.fiveVFiveSelectedSlot = null; toast("Giocatore assegnato alla formazione 5v5"); refreshFiveAfterAssignment(); }, rerender: ({ ok }) => { if (!ok) renderFiveVFive(options); } });
        if (!assigned.ok) return;
''', '''        const selectedSlotKey = ui.fiveVFiveSelectedSlot;
        const selectedPlayerId = playerButton.dataset.fivePlayer;
        playerButton.disabled = true;
        const assigned = commitFiveEditorMutation("five-lineup-assign", (current) =>
          global.FiveVFive.assign(current, selectedSlotKey, selectedPlayerId, (id) => fiveRoleForPlayerId(id, current)), {
            onCommitted: () => { ui.fiveVFiveSelectedSlot = null; toast("Giocatore assegnato alla formazione 5v5"); refreshFiveAfterAssignment(); },
          });
        if (!assigned.ok) return;
''')

# 8) Clear slot transactional.
replace_once('five clear transaction', '''    document.getElementById("clear-five-slot").addEventListener("click", (event) => {
      event.preventDefault();
      global.FiveVFive.clearSlot(run, ui.fiveVFiveSelectedSlot);
      ui.fiveVFiveSelectedSlot = null;
      global.RunState.save(run);
      refreshFiveAfterAssignment();
    });
''', '''    document.getElementById("clear-five-slot").addEventListener("click", (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button.disabled) return;
      const selectedSlotKey = ui.fiveVFiveSelectedSlot;
      if (!selectedSlotKey) return;
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-lineup-clear", (current) => global.FiveVFive.clearSlot(current, selectedSlotKey), {
        onCommitted: () => { ui.fiveVFiveSelectedSlot = null; refreshFiveAfterAssignment(); },
      });
      if (!committed.ok) return;
    });
''')

# 9) Save formation is a single normalization/validation transaction; no direct save.
replace_once('five save transaction', '''    document.getElementById("save-five").addEventListener("click", () => {
      const nextStatus = fiveVFiveStatus();
      if (!nextStatus.valid) return toast("Completa tutti e cinque gli slot prima di salvare.");
      global.RunState.save(run);
      toast("Formazione 5v5 salvata");
    });
''', '''    document.getElementById("save-five").addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      const preview = fiveVFiveStatus(run, { autoFill: true });
      if (!preview.valid) return toast("Completa tutti e cinque gli slot prima di salvare.");
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-lineup-save", (current) => {
        ensureFiveVFive(current);
        const currentStatus = global.FiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
        if (!currentStatus.valid) throw new Error(currentStatus.messages?.[0] || "Formazione 5v5 non valida");
        return currentStatus;
      }, {
        onCommitted: () => { toast("Formazione 5v5 salvata"); refreshFiveAfterAssignment(); },
      });
      if (!committed.ok) return;
    });
''')

# 10) Return from editor: validate/ensure + phase change in one transaction, UI only after commit.
replace_once('five back transaction', '''    document.getElementById("back-five-match")?.addEventListener("click", (event) => {
      event.preventDefault();
      const nextStatus = fiveVFiveStatus();
      if (!nextStatus.valid) return toast(nextStatus.messages?.[0] || "Formazione non valida: completa tutti gli slot prima di tornare alla partita.");
      const context = ui.returnToMatchContext || run.activeMatch;
      const match = run.activeMatch?.type === "five_v_five" ? run.activeMatch : null;
      if (!context || !match) return toast("Nessuna partita da riprendere.");
      run.phase = "match";
      global.RunState.save(run);
      ui.match = match;
      ui.bossMatchState = match.state || "pre-match";
      ui.bossMatchLog = match.log || visibleTimeline(match);
      renderMatch();
      restoreScroll(match.returnScroll || context.scroll || scrollSnapshot());
    });
''', '''    document.getElementById("back-five-match")?.addEventListener("click", (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button.disabled) return;
      const preview = fiveVFiveStatus(run, { autoFill: true });
      if (!preview.valid) return toast(preview.messages?.[0] || "Formazione non valida: completa tutti gli slot prima di tornare alla partita.");
      const context = ui.returnToMatchContext || run.activeMatch;
      const match = run.activeMatch?.type === "five_v_five" ? run.activeMatch : null;
      if (!context || !match) return toast("Nessuna partita da riprendere.");
      const fallbackScroll = match.returnScroll || context.scroll || scrollSnapshot();
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-match-edit-exit", (current) => {
        const currentMatch = current.activeMatch;
        ensureFiveVFive(current);
        const currentStatus = global.FiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
        if (!currentStatus.valid) throw new Error(currentStatus.messages?.[0] || "Formazione 5v5 non valida");
        current.phase = "match";
        return { scroll: currentMatch?.returnScroll || fallbackScroll };
      }, {
        onCommitted: (value, current) => {
          const currentMatch = current.activeMatch;
          ui.match = currentMatch;
          ui.bossMatchState = currentMatch?.state || "pre-match";
          ui.bossMatchLog = currentMatch?.log || visibleTimeline(currentMatch);
          renderMatch();
          restoreScroll(value?.scroll || fallbackScroll);
        },
      });
      if (!committed.ok) return;
    });
''')

# 11) Quick swap from the match screen is canonical or nonexistent.
replace_once('five quick swap transaction', '''    global.FiveFormationFloatingPicker?.prepare(picker, { onClose: () => restorePageScroll(pageScroll) });
    picker?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-five-player]");
      if (!button || !picker.contains(button) || button.disabled) return;
      if (!(match.state === "pre-match" && ui.bossMatchState === "pre-match" && (!match.simulation || match.simulation.state === "pre-match"))) return;
      global.FiveVFive.assign(run, slotKey, button.dataset.fivePlayer, fiveRoleForPlayerId);
      global.RunState.save(run);
      closePicker();
      renderMatch();
      afterNextPaint(() => { restorePageScroll(pageScroll); document.querySelector(`[data-five-match-side="user"][data-five-match-slot="${cssEscape(slotKey)}"]`)?.focus?.({ preventScroll: true }); });
    });
''', '''    global.FiveFormationFloatingPicker?.prepare(picker, { onClose: () => restorePageScroll(pageScroll) });
    picker?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-five-player]");
      if (!button || !picker.contains(button) || button.disabled) return;
      const liveMatch = run?.activeMatch;
      if (!(liveMatch?.type === "five_v_five" && liveMatch.state === "pre-match" && ui.bossMatchState === "pre-match" && (!liveMatch.simulation || liveMatch.simulation.state === "pre-match"))) return;
      const playerId = button.dataset.fivePlayer;
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-match-quick-swap", (current) => {
        const currentMatch = current.activeMatch;
        if (!(currentMatch?.type === "five_v_five" && currentMatch.state === "pre-match" && (!currentMatch.simulation || currentMatch.simulation.state === "pre-match"))) {
          throw new Error("La formazione 5v5 non è più modificabile");
        }
        return global.FiveVFive.assign(current, slotKey, playerId, (id) => fiveRoleForPlayerId(id, current));
      }, {
        onCommitted: (_value, current) => {
          ui.match = current.activeMatch;
          ui.bossMatchState = current.activeMatch?.state || "pre-match";
          ui.bossMatchLog = current.activeMatch?.log || [];
          closePicker();
          renderMatch();
          afterNextPaint(() => { restorePageScroll(pageScroll); document.querySelector(`[data-five-match-side="user"][data-five-match-slot="${cssEscape(slotKey)}"]`)?.focus?.({ preventScroll: true }); });
        },
      });
      if (!committed.ok) return;
    });
''')

# 12) Development reward presentation persistence is transactional; PermanentEffects remains untouched.
replace_once('development presentation transactions', '''    if (!run.developmentRewardPresentation || run.developmentRewardPresentation.endReason !== endReason) {
      run.developmentRewardPresentation = developmentRewardPresentation(defeatedBosses, endReason);
      global.RunState.save(run);
    }
    const continueFlow = () => { run.developmentRewardPresentation.seen = true; global.RunState.save(run); return onComplete(); };
    if (!run.developmentRewardPresentation.seen) return renderDevelopmentRewardReveal(run.developmentRewardPresentation, continueFlow);
    return onComplete();
''', '''    if (!run.developmentRewardPresentation || run.developmentRewardPresentation.endReason !== endReason) {
      const presentation = persistGameplayMutation({
        label: "development-reward-presentation-create",
        mutate: (current) => {
          const currentEffect = current.permanentEffectOutbox?.find((entry) => entry.id === effectId);
          if (currentEffect?.status !== "applied") throw new Error("Development effect must be applied before reward presentation");
          if (!current.developmentRewardPresentation || current.developmentRewardPresentation.endReason !== endReason) {
            current.developmentRewardPresentation = developmentRewardPresentation(defeatedBosses, endReason);
          }
          return current.developmentRewardPresentation;
        },
      });
      if (!presentation.ok) return renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
    }
    const continueFlow = () => {
      const committed = persistGameplayMutation({
        label: "development-reward-presentation-seen",
        mutate: (current) => {
          const currentPresentation = current.developmentRewardPresentation;
          if (!currentPresentation || currentPresentation.endReason !== endReason) throw new Error("Development reward presentation changed");
          currentPresentation.seen = true;
        },
        onCommitted: () => onComplete(),
        rerender: ({ ok }) => { if (!ok) renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete })); },
      });
      return committed;
    };
    if (!run.developmentRewardPresentation.seen) return renderDevelopmentRewardReveal(run.developmentRewardPresentation, continueFlow);
    return onComplete();
''')

# 13) Expose only thin production functions to realistic runtime tests.
replace_once('test seam additions', '''      renderGameOver,
      renderMatch,
      renderMap,
      renderMapFailureRecovery,
      ensureCurrentZoneMutation,
''', '''      renderGameOver,
      renderMatch,
      renderFiveVFive,
      openFiveVFiveEditor,
      openFiveMatchPlayerSwap,
      resolveDevelopmentEndRunFlow,
      renderMap,
      renderMapFailureRecovery,
      ensureCurrentZoneMutation,
''')

APP.write_text(text)

# Cache bust only because app.js changed.
index = INDEX.read_text()
old_cache = 'js/app.js?v=20260831-match-hardening-pr363-9'
new_cache = 'js/app.js?v=20260831-match-hardening-pr363-10'
if index.count(old_cache) != 1:
    raise SystemExit('index app cache baseline mismatch')
INDEX.write_text(index.replace(old_cache, new_cache, 1))

# Real FiveVFive runtime coverage. This deliberately uses the production js/five-v-five.js implementation.
Path('tests/five-cycle-final-hardening-test.js').write_text(r'''"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

function realFiveVFive() {
  const c = { globalThis: null }; c.globalThis = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync("js/five-v-five.js", "utf8"), c, { filename: "five-v-five.js" });
  return c.FiveVFive;
}

const players = [
  ["gk1","GK"],["gk2","GK"],["df1","DF"],["df2","DF"],["mf1","MF"],["mf2","MF"],["mf3","MF"],["fw1","FW"],["fw2","FW"],
  ["df3","DF"],["mf4","MF"]
].map(([playerId, position], i) => ({ playerId, name: playerId, position, category: "Normale", overall: 60 + i, finalOverall: 60 + i, stats: {} }));
const elevenRoles = ["GK","DF","DF","DF","MF","MF","MF","MF","FW","FW","FW"];
const seasonDb = {
  seasonId: "ie1", players,
  formations: { eleven: [{ id: "4-4-2", requirements: { GK: 1, DF: 3, MF: 4, FW: 3 }, slotRoles: elevenRoles }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-4-2", bossLevel: 1, startingXIPlayerIds: players.slice(0,11).map(p=>p.playerId) }],
};
function zone() { return { bossIndex:0,bossId:"boss",seed:"z",currentNodeId:"start",startNodeId:"start",pendingNodeId:null,completedNodeIds:["start"],path:["start"],nodes:[{id:"start",type:"start",layer:0},{id:"five-node",type:"five_v_five",layer:1}],edges:[["start","five-node"]] }; }
function fiveState(incomplete=false) { return { formation:"1-2-1", slots:{ FW:"fw1", MF1:"mf1", MF2: incomplete ? null : "mf2", DF:"df1", GK:"gk1" } }; }
function activeMatch() { return { matchId:"legacy-five-stable",type:"five_v_five",nodeId:"five-node",previousNodeId:"start",state:"pre-match",result:null,log:[],score:[0,0],opponentFormation:"1-2-1",opponents:[{slotKey:"FW",playerId:"o1"},{slotKey:"MF1",playerId:"o2"},{slotKey:"MF2",playerId:"o3"},{slotKey:"DF",playerId:"o4"},{slotKey:"GK",playerId:"o5"}],simulation:{state:"pre-match",seed:"seed-five",timeline:[],score:{user:0,opponent:0},displayedScore:{user:0,opponent:0},revealedCount:0,resolutionApplied:false} }; }
function runFor({phase="five", incomplete=false, match=null}={}) { return { version:2,runId:"five-hardening",seasonId:"ie1",phase,lives:2,gameOver:false,bossIndex:0,consecutiveLosses:0,completedBossIds:[],unlockedTeamIds:[],completedSpecialMatchIds:[],claimedSpecialMatchRewardIds:[],unlockedSpecialTeamIds:[],permanentEffectOutbox:[],roster:players.map(p=>({playerId:p.playerId,source:"ie1",level:0})),lineup:players.slice(0,11).map(p=>p.playerId),bench:[],inventory:[],formationId:"4-4-2",fiveVFive:fiveState(incomplete),teamIdentity:{name:"Raimon"},statistics:{},teamLevel:0,currentZone:zone(),activeMatch:match}; }
function harness(opts={}) {
  const storage = new BudgetStorage(Infinity);
  const FiveVFive = realFiveVFive();
  const fetch = async () => ({ok:false,json:async()=>({})});
  const rt = load(storage,{run:runFor(opts),seasonDb,contextOverrides:{FiveVFive,fetch}});
  rt.context.MapEngine.normalizeSpecialMatchNode=()=>false;
  rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;
  rt.context.RoguelikeRules.isProfileAwareRosterEntry=()=>false;
  rt.context.SeasonRegistry.player=id=>players.find(p=>p.playerId===String(id));
  rt.context.FiveFormationFloatingPicker={prepare(){},close(){}};
  return {storage,rt};
}
function failNextSave(rt,name="QuotaExceededError") {
  const real = rt.context.RunState.save.bind(rt.context.RunState); let attempts=0;
  rt.context.RunState.save=(value,options)=>{ attempts++; const e=new Error(name); e.name=name; throw e; };
  return {restore(){rt.context.RunState.save=real;}, attempts:()=>attempts};
}

(async()=>{
  // Presentation-only renderer: real validate/normalize is confined to a clone.
  {
    const {rt}=harness({phase:"five",incomplete:true});
    const liveBefore=structuredClone(rt.seam.getRun()); const canonicalBefore=structuredClone(rt.canonical);
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.seam.renderFiveVFive({persist:false});
    assert.equal(writes,0,"read-only five renderer must not save");
    assert.deepEqual(rt.seam.getRun(),liveBefore,"read-only five renderer must not mutate live run");
    assert.deepEqual(rt.canonical,canonicalBefore,"read-only five renderer must not mutate canonical run");
  }

  // Explicit editor entry persists autoFill before UI, in one transaction.
  {
    const {rt}=harness({phase:"squad",incomplete:true});
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    const result=rt.seam.openFiveVFiveEditor();
    assert.equal(result.ok,true); assert.equal(writes,1); assert.equal(rt.canonical.phase,"five");
    assert.ok(rt.canonical.fiveVFive.slots.MF2,"autoFill must be canonical before editor render");
  }

  // Re-render of already canonical phase=five performs no RunState.save and no drift.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    const before=structuredClone(rt.canonical); const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true});
    assert.equal(writes,0); assert.deepEqual(rt.canonical,before); assert.equal(rt.canonical.activeMatch.matchId,"legacy-five-stable");
  }

  // Clear-slot failure: one failed write, canonical and live rollback.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.getUi().fiveVFiveSelectedSlot="MF1"; rt.seam.renderFiveVFive({persist:false,returnToMatch:true});
    const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("clear-five-slot").click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
  }

  // Save formation failure (including ensure/autofill) rolls back.
  {
    const {rt}=harness({phase:"five",incomplete:true,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("save-five").click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Formation change failure through the real UI binding.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    const formationButton=rt.context.document.getElementById("formation-1-1-2"); formationButton.dataset.fiveFormation="1-1-2";
    const originalAll=rt.context.document.querySelectorAll.bind(rt.context.document);
    rt.context.document.querySelectorAll=(selector)=>selector==="[data-five-formation]"?[formationButton]:originalAll(selector);
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    formationButton.click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Assign failure via selector event uses current canonical run, not captured run.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.getUi().fiveVFiveSelectedSlot="MF1";
    const selector=rt.context.document.getElementById("controlled-five-selector"); selector.dataset.fivePlayer="mf3"; selector.disabled=false; selector.contains=()=>true;
    selector.closest=(query)=>query==="[data-five-player]"?selector:null;
    const originalQuery=rt.context.document.querySelector.bind(rt.context.document);
    rt.context.document.querySelector=(query)=>query===".five-selector"?selector:originalQuery(query);
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    selector.click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Return success preserves frozen identity/snapshot and commits phase exactly once.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const frozen=structuredClone(rt.canonical.activeMatch);
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0; rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.context.document.getElementById("back-five-match").click();
    assert.equal(writes,1); assert.equal(rt.canonical.phase,"match"); assert.equal(rt.canonical.activeMatch.matchId,frozen.matchId);
    assert.equal(rt.canonical.activeMatch.simulation.seed,frozen.simulation.seed); assert.deepEqual(rt.canonical.activeMatch.simulation,frozen.simulation);
  }

  // Return failure is fail-stop; retry through canonical resume works without reload.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("back-five-match").click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.equal(rt.canonical.phase,"five"); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
    failure.restore(); await rt.seam.resumeRun(); assert.equal(rt.canonical.phase,"five"); assert.equal(rt.canonical.activeMatch.matchId,before.activeMatch.matchId);
  }

  // Quick swap failure from match is rollback-only; picker success UI never runs.
  {
    const {rt}=harness({phase:"match",incomplete:false,match:activeMatch()});
    rt.seam.getUi().bossMatchState="pre-match";
    const field=rt.context.document.getElementById("controlled-five-field"); const picker=rt.context.document.getElementById("controlled-five-picker");
    picker.dataset.fivePlayer="mf3"; picker.disabled=false; picker.contains=()=>true; picker.closest=(q)=>q==="[data-five-player]"?picker:null;
    field.insertAdjacentHTML=()=>{}; field.querySelector=(q)=>q===".five-selector"?picker:null;
    const originalQuery=rt.context.document.querySelector.bind(rt.context.document);
    rt.context.document.querySelector=(q)=>q===".five-match-mobile-field"?field:originalQuery(q);
    assert.equal(rt.seam.openFiveMatchPlayerSwap("MF1",rt.seam.getRun().activeMatch),true);
    const before=structuredClone(rt.canonical); const failure=failNextSave(rt); picker.click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
  }

  console.log("five cycle final hardening: real FiveVFive, read-only rendering, atomic editor operations and rollback OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
''')

Path('tests/development-presentation-transaction-final-test.js').write_text(r'''"use strict";
const assert=require("assert");
const BudgetStorage=require("./helpers/budget-storage");
const {load}=require("./helpers/production-runtime");

function baseRun(){return {version:2,runId:"dev-presentation",seasonId:"ie1",phase:"gameover",gameOver:true,lives:0,bossIndex:2,completedBossIds:["b1","b2"],consecutiveLosses:0,unlockedTeamIds:[],completedSpecialMatchIds:[],claimedSpecialMatchRewardIds:[],unlockedSpecialTeamIds:[],roster:[],lineup:[],bench:[],inventory:[],formationId:null,fiveVFive:null,currentZone:null,activeMatch:null,permanentEffectOutbox:[],teamIdentity:{name:"Raimon"}};}
function harness(){const storage=new BudgetStorage(Infinity);const run=baseRun();const rt=load(storage,{run,seasonDb:{seasonId:"ie1",players:[],formations:{eleven:[]},bossOrder:[]},contextOverrides:{DevelopmentAccountV3:{processRunEnd(){throw new Error("must not reapply an already-applied effect")},read(){return {redeemedRunIds:[run.runId]}}}}});rt.context.MapEngine.normalizeSpecialMatchNode=()=>false;rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;const live=rt.seam.getRun();const id=rt.context.PermanentEffects.developmentId(live,"gameover");live.permanentEffectOutbox=[{id,type:rt.context.PermanentEffects.TYPES.DEVELOPMENT,payload:{runId:live.runId,seasonId:live.seasonId,endReason:"gameover",defeatedBosses:2},status:"applied",createdAt:new Date().toISOString(),appliedAt:new Date().toISOString()}];rt.context.RunState.save(live);return rt;}
function failNext(rt){const real=rt.context.RunState.save.bind(rt.context.RunState);let attempts=0;rt.context.RunState.save=(v,o)=>{attempts++;const e=new Error("Quota exceeded");e.name="QuotaExceededError";throw e;};return{restore(){rt.context.RunState.save=real},attempts:()=>attempts};}

(async()=>{
  // Presentation creation failure does not navigate or alter canonical presentation; effect stays applied.
  {
    const rt=harness();let completed=0;const before=structuredClone(rt.canonical);const failure=failNext(rt);
    rt.seam.resolveDevelopmentEndRunFlow({endReason:"gameover",onComplete:()=>{completed++;}});
    assert.equal(failure.attempts(),1);assert.equal(completed,0);assert.equal(rt.canonical.developmentRewardPresentation,undefined);assert.equal(rt.canonical.permanentEffectOutbox[0].status,"applied");assert.match(rt.seam.getAppMarkup(),/FINALIZZAZIONE NON SALVATA/);
    failure.restore();rt.context.document.getElementById("retry-terminal-effect").click();assert.ok(rt.canonical.developmentRewardPresentation);assert.equal(rt.canonical.developmentRewardPresentation.seen,false);assert.match(rt.seam.getAppMarkup(),/RICOMPENSE RUN/);
  }

  // Seen failure blocks onComplete/navigation; retry then success persists seen exactly once.
  {
    const rt=harness();let completed=0;rt.seam.resolveDevelopmentEndRunFlow({endReason:"gameover",onComplete:()=>{completed++;}});assert.ok(rt.canonical.developmentRewardPresentation);
    const coinsSnapshot=JSON.stringify(rt.context.DevelopmentAccountV3.read());const failure=failNext(rt);
    rt.context.document.getElementById("development-reward-continue").click();assert.equal(failure.attempts(),1);assert.equal(completed,0);assert.equal(rt.canonical.developmentRewardPresentation.seen,false);assert.match(rt.seam.getAppMarkup(),/FINALIZZAZIONE NON SALVATA/);
    failure.restore();rt.context.document.getElementById("retry-terminal-effect").click();assert.match(rt.seam.getAppMarkup(),/RICOMPENSE RUN/);rt.context.document.getElementById("development-reward-continue").click();assert.equal(completed,1);assert.equal(rt.canonical.developmentRewardPresentation.seen,true);assert.equal(JSON.stringify(rt.context.DevelopmentAccountV3.read()),coinsSnapshot);
    for(let i=0;i<10;i++){const reopened=rt.reopen();reopened.context.MapEngine.normalizeSpecialMatchNode=()=>false;reopened.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;assert.equal(reopened.canonical.developmentRewardPresentation.seen,true);assert.equal(reopened.canonical.permanentEffectOutbox[0].status,"applied");}
  }
  console.log("development reward presentation: create/seen fail-stop, retry and stable applied effect OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
''')

Path('tests/legacy-matchid-compatibility-final-test.js').write_text(r'''"use strict";
const assert=require("assert");
const fs=require("fs");
const app=fs.readFileSync("js/app.js","utf8");
const special=fs.readFileSync("js/special-match.js","utf8");
assert.match(app,/match\.matchId = global\.RunStatistics\?\.createStableMatchId\?\.\(run, match\) \|\| null;/,"Boss/5v5 constructors must retain stable matchId creation");
assert.match(special,/match\.matchId = \[run\.runId, node\.id, "special_match", attemptNumber\]\.join\("::"\);/,"Special constructor must retain historical stable matchId");
assert.doesNotMatch(app,/if \(!currentMatch\.matchId\).*createStableMatchId/s,"Do not invent a new matchId during transactional retry");
console.log("legacy matchId compatibility: historically supported constructors already persist stable ids; no preventive migration added");
''')

print('PR363 final hardening patch generated')
