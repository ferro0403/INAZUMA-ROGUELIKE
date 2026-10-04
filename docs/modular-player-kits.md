# Modular player kits

## Goal

Allow a canonical Inazuma Roguelike player to keep the same identity while the visible football kit changes independently. The browser does **not** read Victory Road G4 files. G4 extraction and rendering are an offline asset-production step; production only receives transparent web images plus a compact catalog.

This first implementation is presentation-only. It does not add persistence, run fields, cloud fields, economy, match rules or progression changes.

## Why this boundary

Victory Road character research shows a modular character family: a head/model identity can be associated with body/uniform, arms/neck, shoes and other equipment. The browser game already owns generic visual resolution in `js/player/player-visuals.js`, so modular kit composition extends that presentation owner instead of adding logic to `app.js` or persistence.

When the modular catalog has no complete compatible entry, the existing `frontFullbodyUrl -> portraitUrl -> placeholder` path remains authoritative.

## Runtime files

- `js/player/player-kit-catalog.js`: generated catalog loaded synchronously before the renderer. It is intentionally empty until locally produced assets are added.
- `js/player/player-kit-visuals.js`: pure resolver and layered markup builder.
- `js/player/player-visuals.js`: existing visual authority; asks the modular renderer for detail art and otherwise returns the legacy fullbody.
- `css/player-kit-visuals.css`: stacks transparent layers and switches to the legacy image if a required layer fails.
- `scripts/build-player-kit-catalog.js`: validates authoring metadata and generates the synchronous catalog.

Compact cards and match portraits remain on the normal portrait path. A kit is only relevant where the body is visible.

## Catalog contract

Example authoring input:

```json
{
  "schemaVersion": 1,
  "defaultKitId": "raimon",
  "requiredLayers": ["body", "head", "arms", "shoes"],
  "players": {
    "PLAYER_ID": {
      "bodyProfile": "u000101",
      "defaultKitId": "raimon",
      "layers": {
        "head": { "src": "assets/player-kits/players/PLAYER_ID/head.webp", "z": 40 },
        "arms": { "src": "assets/player-kits/players/PLAYER_ID/arms.webp", "z": 30 },
        "shoes": { "src": "assets/player-kits/players/PLAYER_ID/shoes.webp", "z": 20 }
      }
    }
  },
  "kits": {
    "raimon": {
      "profiles": {
        "u000101": {
          "layers": {
            "body": { "src": "assets/player-kits/kits/raimon/u000101/body.webp", "z": 10 }
          }
        }
      }
    }
  }
}
```

Generate the runtime catalog with:

```bash
node scripts/build-player-kit-catalog.js path/to/player-kit-authoring.json
```

All generated paths must remain under `assets/player-kits/`. The builder rejects absolute paths, URLs, path traversal, unknown kits and a default kit that does not have a compatible body profile.

## Kit selection priority

The renderer resolves a kit without writing any state:

1. explicit `kitId` passed by a caller;
2. `player.visualKitId`;
3. `player.kitId`;
4. the player's `defaultKitId` in the catalog;
5. catalog `defaultKitId`.

This deliberately creates the integration seam for the future kit-selection UI without defining a persistence contract in this PR.

## Required-layer safety

A composite is rendered only when every required layer exists. Default production requirements are:

- `body`
- `head`
- `arms`
- `shoes`

Optional layers may fail independently and are hidden. If a required image fails to load at runtime, the entire composite is hidden and the existing static fullbody is shown. A broken asset set therefore cannot leave a player half-rendered.

## Victory Road asset-production pipeline

The intended local pipeline is:

1. Use **VictoryTool** against a legally obtained Victory Road dump to resolve character model metadata, body profile, uniform model, shoes/gloves and related character-part tables.
2. Use **G4 Blender Tools** on the same local dump to import the head and compatible modular parts with the correct shared skeleton.
3. Render every reusable part with exactly the same pose, camera, framing, canvas size and transparent background.
4. Store only the web-ready rendered layers required by Inazuma Roguelike under `assets/player-kits/`; do not commit the original dump.
5. Map Victory Road identities to the game's stable canonical `playerId`.
6. Run `build-player-kit-catalog.js`.
7. Run the player-kit test and full regression gate.

The important visual validation is not just that files exist: head/neck/arms/body/shoes must align at pixel level for every body profile used by a kit.

## POC coverage

`tests/player-kit-visuals-test.js` exercises three characters (Mark, Axel and a second body-profile fixture) against two kits. It verifies:

- default and player-specific kit selection;
- changing Axel from the second kit to the first;
- a second body profile;
- incompatible-kit rejection;
- deterministic layer order;
- legacy fullbody fallback when a required part is absent;
- fallback when a required image errors.

The fixture uses paths only; no copyrighted Victory Road model or texture is included.

## Deferred: persistent kit choice

Persisting a chosen kit is intentionally **not** part of this implementation. That step changes a saved/account contract and must be designed against the current persistence authority and backward-compatibility rules. The rendering engine already accepts `visualKitId`, so persistence can be added later without changing the composition model.
