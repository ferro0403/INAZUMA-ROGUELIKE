from pathlib import Path

path = Path("js/app.js")
source = path.read_text(encoding="utf-8")

old = '''  function resumePostBossFlowOrMap() {
    const flow = resolvePendingRunFlow({ clearMatch: true });
    if (flow.destination !== "none") return navigateBossVictoryDestination(flow);
    ensureCurrentZone(); run.phase = "map";
    try { global.RunState.save(run); } catch (error) { console.error("save failed (resumePostBossFlowOrMap)", error); }
    return renderMap();
  }
'''

new = '''  function resumePostBossFlowOrMap() {
    const flow = resolvePendingRunFlow({ clearMatch: true });
    if (flow.destination !== "none") return navigateBossVictoryDestination(flow);
    const zone = run?.currentZone;
    const mapReady = run?.phase === "map"
      && zone
      && Array.isArray(zone.nodes)
      && Array.isArray(zone.edges)
      && Array.isArray(zone.path);
    if (mapReady) return renderMap({ persist: false });
    let zoneResult = null;
    const committed = persistGameplayMutation({
      label: "post-boss-map-navigation",
      mutate: (current) => {
        zoneResult = ensureCurrentZoneMutation(current);
        current.phase = "map";
      },
    });
    if (!committed.ok) return null;
    if (zoneResult?.generated) {
      try { global.RunState.createCheckpoint?.(run); }
      catch (error) { console.warn("Unable to persist map checkpoint", error); }
    }
    return renderMap({ persist: false });
  }
'''

count = source.count(old)
if count != 1:
    raise SystemExit(f"resumePostBossFlowOrMap block mismatch: {count} matches")

path.write_text(source.replace(old, new), encoding="utf-8")
