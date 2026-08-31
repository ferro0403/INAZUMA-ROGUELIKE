from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


app_path = Path("js/app.js")
app = app_path.read_text()

app = replace_once(
    app,
    '    if (global.MapEngine.normalizeSpecialMatchNode(run, seasonDb)) global.RunState.save(run);',
    '''    const specialNormalizationProbe = global.RunState.clone(run);
    if (global.MapEngine.normalizeSpecialMatchNode(specialNormalizationProbe, seasonDb)) {
      const normalized = persistGameplayMutation({
        label: "special-node-normalize-resume",
        mutate: (current) => {
          const previousSpecialNode = current.currentZone?.nodes?.find((node) => node.type === "special_match") || null;
          const activeSpecial = current.activeMatch?.type === "special_match" ? current.activeMatch : null;
          const activeSpecialNodeId = activeSpecial?.nodeId == null ? null : String(activeSpecial.nodeId);
          const changed = global.MapEngine.normalizeSpecialMatchNode(current, seasonDb);
          if (!changed) return { changed: false };
          if (activeSpecial && previousSpecialNode && activeSpecialNodeId === String(previousSpecialNode.id)) {
            const normalizedSpecialNode = current.currentZone?.nodes?.find((node) => node.type === "special_match"
              && (!activeSpecial.specialMatchId || String(node.specialMatchId) === String(activeSpecial.specialMatchId)));
            if (!normalizedSpecialNode) throw Object.assign(new Error("Normalized special match node unavailable"), { code: "special-node-normalization-mismatch" });
            activeSpecial.nodeId = normalizedSpecialNode.id;
          }
          return { changed: true };
        },
      });
      if (!normalized.ok) return renderMapFailureRecovery();
    }''',
    "resume special normalization",
)

app = replace_once(
    app,
    '''      const resolved = ui.bossMatchState.startsWith("completed");
      const simulating = ui.bossMatchState === "simulating";
      app.innerHTML = `''',
    '''      const resolved = ui.bossMatchState.startsWith("completed");
      const simulating = ui.bossMatchState === "simulating";
      const canEditFiveMatch = match.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!match.simulation || match.simulation.state === "pre-match");
      app.innerHTML = `''',
    "five editability state",
)

app = replace_once(
    app,
    '<button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-five-team" ${resolved ? "disabled" : ""}>',
    '<button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-five-team" ${canEditFiveMatch ? "" : "disabled"}>',
    "five edit button state",
)

app = replace_once(
    app,
    '    const cont = document.getElementById("continue-match-result");\n    const status = document.querySelector(".boss-match-result-panel p");',
    '    const cont = document.getElementById("continue-match-result");\n    const editFive = document.getElementById("edit-five-team");\n    const status = document.querySelector(".boss-match-result-panel p");',
    "five edit control lookup",
)

app = replace_once(
    app,
    '''    if (simulate) {
      simulate.disabled = Boolean(ui.matchStartLocked) || simulating || completed;
      simulate.textContent = ui.matchStartLocked ? "Avvio..." : simulating ? "Simulazione..." : completed ? "Risultato definitivo" : "Simula partita";
    }
    if (skip) {''',
    '''    if (simulate) {
      simulate.disabled = Boolean(ui.matchStartLocked) || simulating || completed;
      simulate.textContent = ui.matchStartLocked ? "Avvio..." : simulating ? "Simulazione..." : completed ? "Risultato definitivo" : "Simula partita";
    }
    if (editFive) {
      const activeFiveMatch = ui.match?.type === "five_v_five" ? ui.match : null;
      const canEditFiveMatch = activeFiveMatch?.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!activeFiveMatch.simulation || activeFiveMatch.simulation.state === "pre-match");
      editFive.disabled = !canEditFiveMatch;
    }
    if (skip) {''',
    "five edit dynamic control lock",
)

app = replace_once(
    app,
    '      document.getElementById("edit-five-team").addEventListener("click", () => { ui.returnToMatchContext = { type: match.type, nodeId: match.nodeId, scroll: scrollSnapshot() }; match.returnScroll = ui.returnToMatchContext.scroll; persistMatchState(); renderFiveVFive({ returnToMatch: true }); });',
    '''      document.getElementById("edit-five-team").addEventListener("click", (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;
        const activeMatch = run?.activeMatch;
        const editable = activeMatch?.type === "five_v_five"
          && activeMatch.state === "pre-match"
          && ui.bossMatchState === "pre-match"
          && (!activeMatch.simulation || activeMatch.simulation.state === "pre-match");
        if (!editable) { button.disabled = true; return; }
        button.disabled = true;
        const capturedScroll = scrollSnapshot();
        const identity = matchTransactionIdentity(activeMatch);
        const committed = commitMatchMutation("five-match-edit-entry", identity, (currentMatch, current) => {
          if (currentMatch.state !== "pre-match" || (currentMatch.simulation && currentMatch.simulation.state !== "pre-match")) {
            throw Object.assign(new Error("5v5 match is no longer editable"), { code: "five-match-edit-locked" });
          }
          currentMatch.returnScroll = capturedScroll;
          current.phase = "five";
          return { type: currentMatch.type, nodeId: currentMatch.nodeId, scroll: capturedScroll };
        });
        if (!committed.ok) return renderMapFailureRecovery();
        ui.returnToMatchContext = committed.value;
        return renderFiveVFive({ persist: false, returnToMatch: true });
      });''',
    "five edit transactional handler",
)

app_path.write_text(app)

index_path = Path("index.html")
index_path.write_text(replace_once(
    index_path.read_text(),
    'js/app.js?v=20260831-match-hardening-pr363-8',
    'js/app.js?v=20260831-match-hardening-pr363-9',
    "app cache buster",
))

terminal_path = Path("tests/terminal-recovery-read-only-bootstrap-test.js")
terminal_path.write_text(replace_once(
    terminal_path.read_text(),
    'js\\/app\\.js\\?v=20260831-match-hardening-pr363-8',
    'js\\/app\\.js\\?v=20260831-match-hardening-pr363-9',
    "terminal cache assertion",
))

legacy_path = Path("tests/failure-lock-five-edit-flow-test.js")
legacy = legacy_path.read_text()
legacy = replace_once(
    legacy,
    '''    const original = frozenMatch();
    const h = runtime(runFor({ phase: "match", activeMatch: original }));
    h.rt.seam.renderMatch();''',
    '''    const original = frozenMatch();
    original.state = "pre-match";
    original.simulation.state = "pre-match";
    const h = runtime(runFor({ phase: "match", activeMatch: original }));
    h.rt.seam.renderMatch();
    const preEditSimulation = structuredClone(h.rt.seam.getRun().activeMatch.simulation);''',
    "legitimate five edit pre-match fixture",
)
legacy = replace_once(
    legacy,
    '    assert.equal(reopened.canonical.activeMatch.simulation.seed, original.simulation.seed);',
    '    assert.equal(reopened.canonical.activeMatch.simulation.seed, preEditSimulation.seed);',
    "five reopen seed assertion",
)
legacy = replace_once(
    legacy,
    '    assert.deepEqual(reopened.canonical.activeMatch.simulation, original.simulation);',
    '    assert.deepEqual(reopened.canonical.activeMatch.simulation, preEditSimulation);',
    "five return simulation assertion",
)
legacy_path.write_text(legacy)

print("PR363 surgical patch applied")
