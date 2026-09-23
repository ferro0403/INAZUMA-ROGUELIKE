"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
  globalThis: null,
  Object,
  String,
  Boolean,
  Map,
  Set,
  Array,
  Number,
};
context.globalThis = context;
context.SeasonRegistry = {
  normalizeSeasonId(value) {
    const aliases = { season1: "ie1", season2: "ie1_s2", season3: "ie1_s3" };
    return aliases[String(value)] || String(value);
  },
  isSeasonSource(value) {
    return ["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"].includes(String(value));
  },
  player(playerId, seasonId) {
    if (String(seasonId) === "ie2" && String(playerId) === "167") {
      return { playerId: "167", legacyCanonicalPlayerId: "4469" };
    }
    return null;
  },
};
context.ProfiledSeasonRuntime = {
  canonicalPlayerId(seasonId, playerId) {
    if (String(seasonId) === "ie2" && String(playerId) === "167") return "4469";
    return String(playerId);
  },
};

vm.createContext(context);
vm.runInContext(
  fs.readFileSync("js/recruitment/player-identity.js", "utf8"),
  context,
  { filename: "js/recruitment/player-identity.js" }
);

const identity = context.PlayerIdentity;

// playerId remains the canonical character identity.
assert.strictEqual(identity.canonicalPlayerId({ playerId: "mark" }), "mark");

// Legacy Season is part of the card identity, so the same character can own
// multiple distinct cards without inventing a second playerId.
const markS1 = { playerId: "mark", legacySeasonId: "ie1", overall: 94 };
const markS2 = { playerId: "mark", legacySeasonId: "ie1_s2", overall: 95 };
assert.strictEqual(identity.cardId(markS1), "ie1::mark");
assert.strictEqual(identity.cardId(markS2), "ie1_s2::mark");
assert.notStrictEqual(identity.cardId(markS1), identity.cardId(markS2));
assert.strictEqual(identity.sameCard(markS1, markS2), false);

// The same Legacy card remains unique even if its runtime stats differ.
assert.strictEqual(
  identity.sameCard(markS1, { playerId: "mark", legacySeasonId: "ie1", overall: 99 }),
  true
);

// Explicit persisted cardId always wins, so future migrations can preserve
// already-issued identifiers without recomputing them.
const explicit = { playerId: "mark", legacySeasonId: "ie1", cardId: "issued-card-001" };
assert.strictEqual(identity.cardId(explicit), "issued-card-001");

// Season source and explicit fallback provide non-destructive identity for old
// records that do not yet carry legacySeasonId/cardId.
assert.strictEqual(identity.cardId({ playerId: "axel", source: "ie1_s2" }), "ie1_s2::axel");
assert.strictEqual(identity.cardId({ playerId: "axel" }, "season1"), "ie1::axel");

// With no season context at all, old saves retain their former playerId key
// instead of being treated as corrupted or forcibly migrated.
assert.strictEqual(identity.cardId({ playerId: "legacy-only" }), "legacy-only");

// Historical aliases canonicalize inside a Season so an old ID and corrected ID
// cannot become two copies of the same Legacy card.
assert.strictEqual(identity.cardId({ playerId: "167", legacySeasonId: "ie2" }), "ie2::4469");
assert.strictEqual(identity.cardId({ playerId: "4469", legacySeasonId: "ie2" }), "ie2::4469");

// Decoration is additive: playerId and stats are preserved.
const decorated = identity.withCardIdentity(markS2);
assert.strictEqual(decorated.playerId, "mark");
assert.strictEqual(decorated.overall, 95);
assert.strictEqual(decorated.cardId, "ie1_s2::mark");
assert.strictEqual(decorated.legacySeasonId, "ie1_s2");

console.log("legacy-card-identity-foundation-test: distinct Legacy cards + old-save fallback passed");
