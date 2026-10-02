import assert from "node:assert/strict";
import {
  marketplaceMatches,
  matchesSearch,
  normalizeSearch,
} from "../src/search";

assert.equal(normalizeSearch("  Gràcia  COURTYARD "), "gracia courtyard");
assert.ok(matchesSearch("gracia house", "Gràcia", "Courtyard house"));
assert.ok(matchesSearch("", "Any listing"));
assert.equal(matchesSearch("gracia beach", "Gràcia courtyard house"), false);
assert.ok(marketplaceMatches("gracia").rent.length > 0);
assert.ok(marketplaceMatches("gracia").buy.length > 0);
assert.ok(marketplaceMatches("electrical").services.length > 0);
assert.ok(marketplaceMatches("electrical").work.length > 0);
assert.ok(marketplaceMatches("padel").spaces.length > 0);
assert.ok(
  Object.values(marketplaceMatches("unmatchablezxy123")).every(
    (items) => items.length === 0,
  ),
);
console.log(
  "Marketplace search passed: accents, token order, categories and empty results.",
);
