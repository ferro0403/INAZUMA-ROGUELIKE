from pathlib import Path

path = Path("js/app.js")
source = path.read_text(encoding="utf-8")

old_section = '''  function navigateToSectionRoot(section, context = {}) {
    const destination = getSectionRootDestination(section).destination;
    if (destination === "map" && run?.activeMatch) return leaveMatchViaSectionRoot();
    closeModal({ invokeOnClose: false });
    if (destination === "home") return renderHome();
    if (destination === "seasonSelection") {
      if (run) { try { global.RunState.save(run); } catch (error) { console.error("save failed (seasonSelection nav)", error); } }
      return renderSeasonSelect();
    }
    if (destination === "map") {
      if (run) { run.phase = "map"; try { global.RunState.save(run); } catch (error) { console.error("save failed (map nav)", error); } }
      return renderMap();
    }
    if (destination === "albumRoot") return renderAlbumCollections();
    if (destination === "albumTeams") return renderAlbumTeams(context.collectionId || ui.albumCollectionId || global.AlbumProgress.DEFAULT_COLLECTION_ID);
    if (destination === "hallRoot") return renderHallOfFame();
    return renderHome();
  }
'''
new_section = '''  function navigateToSectionRoot(section, context = {}) {
    const destination = getSectionRootDestination(section).destination;
    if (destination === "map" && run?.activeMatch) return leaveMatchViaSectionRoot();
    if (destination === "map" && run) {
      if (run.phase === "map") {
        closeModal({ invokeOnClose: false });
        return renderMap({ persist: false });
      }
      const committed = persistGameplayMutation({
        label: "section-root-map-navigation",
        mutate: (current) => { current.phase = "map"; },
      });
      if (!committed.ok) return null;
      closeModal({ invokeOnClose: false });
      return renderMap({ persist: false });
    }
    closeModal({ invokeOnClose: false });
    if (destination === "home") return renderHome();
    if (destination === "seasonSelection") return renderSeasonSelect();
    if (destination === "map") return renderMap({ persist: false });
    if (destination === "albumRoot") return renderAlbumCollections();
    if (destination === "albumTeams") return renderAlbumTeams(context.collectionId || ui.albumCollectionId || global.AlbumProgress.DEFAULT_COLLECTION_ID);
    if (destination === "hallRoot") return renderHallOfFame();
    return renderHome();
  }
'''

old_bottom = '''  function bindBottomNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModal({ invokeOnClose: false });
        const destination = button.dataset.nav;
        if (destination === "map") {
          return resumePostBossFlowOrMap();
        } else if (destination === "squad") {
          ensurePostBossFlow({ clearMatch: true });
          run.phase = "squad";
          try { global.RunState.save(run); } catch (error) { console.error("save failed (squad nav)", error); }
          renderSquad();
        } else if (destination === "inventory") {
          renderInventory();
        } else if (destination === "five") {
          openFiveVFiveEditor();
        }
      });
    });
  }
'''
new_bottom = '''  function bindBottomNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const destination = button.dataset.nav;
        if (destination === "map") {
          closeModal({ invokeOnClose: false });
          return resumePostBossFlowOrMap();
        } else if (destination === "squad") {
          ensurePostBossFlow({ clearMatch: true });
          if (run.phase === "squad") {
            closeModal({ invokeOnClose: false });
            return renderSquad();
          }
          const committed = persistGameplayMutation({
            label: "bottom-nav-squad-navigation",
            mutate: (current) => { current.phase = "squad"; },
          });
          if (!committed.ok) return null;
          closeModal({ invokeOnClose: false });
          return renderSquad();
        } else if (destination === "inventory") {
          closeModal({ invokeOnClose: false });
          return renderInventory();
        } else if (destination === "five") {
          closeModal({ invokeOnClose: false });
          return openFiveVFiveEditor();
        }
        return null;
      });
    });
  }
'''

section_matches = source.count(old_section)
bottom_matches = source.count(old_bottom)
if section_matches != 1:
    raise SystemExit(f"section-root block mismatch: {section_matches} matches")
if bottom_matches != 1:
    raise SystemExit(f"bottom-nav block mismatch: {bottom_matches} matches")

path.write_text(source.replace(old_section, new_section).replace(old_bottom, new_bottom), encoding="utf-8")
