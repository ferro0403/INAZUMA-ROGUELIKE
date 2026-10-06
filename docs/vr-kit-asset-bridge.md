# VR kit asset bridge POC

This branch adds the browser-side seam needed to consume offline Blender renders without putting Blender or extracted Victory Road data in the web app.

## Runtime contract

The browser resolves a developer-only selection as:

```
playerId + kitId -> PLAYER_KIT_VISUALS manifest -> fullbodyUrl -> PlayerVisuals detail fallback chain
```

The normal portrait/card pipeline is unchanged. If a generated kit image fails, the detail view falls back to the seasonal/global fullbody and then portrait.

## How to test on the deploy preview

Open the preview with `?dev=1`, navigate to a supported player's detail modal, and use **Divisa VR · DEV**.

The committed manifest contains only diagnostic SVG routing fixtures for Mark (1), Axel (2), and Xene (1096). It intentionally contains no extracted/proprietary render asset.

When the Blender batch exporter is ready, replace a diagnostic entry with a real generated `fullbodyUrl` such as:

```json
{
  "kitId": "backwater-raimon-home",
  "label": "Backwater Raimon · Home",
  "variant": "home",
  "fullbodyUrl": "assets/vr-players/1096/backwater-raimon-home.webp",
  "expectedAssetUrl": "assets/vr-players/1096/backwater-raimon-home.webp",
  "diagnostic": false
}
```

The storage key is isolated from canonical run/permanent state:

`inazuma.rtg.player-kit-selection.v1`

That makes this a reversible preview seam, not a gameplay-save migration.
