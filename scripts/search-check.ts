import assert from "node:assert/strict";
import { workOpportunities } from "../src/data";
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
// The caller controls the published catalogue; an empty live catalogue must
// never silently restore sample jobs, and supplied local posts remain searchable.
assert.deepEqual(marketplaceMatches("", []).work, []);
const localOpportunity = {
  ...workOpportunities[0],
  id: "local-search-example",
  businessId: "sample-search-business",
  title: "Assistente de operações",
  business: "Empresa de exemplo",
  description: "Organizar o inventário da oficina",
  skills: ["Organização"],
};
assert.deepEqual(
  marketplaceMatches("operacoes organizacao", [localOpportunity]).work,
  [localOpportunity],
);
assert.deepEqual(marketplaceMatches("inventario", [localOpportunity]).work, [
  localOpportunity,
]);
assert.equal(
  marketplaceMatches("electrical", [localOpportunity]).work.length,
  0,
);
assert.ok(marketplaceMatches("electrical", []).services.length > 0);
assert.ok(marketplaceMatches("full time").work.length > 0);
console.log(
  "Marketplace search passed: accents, token order, categories and empty results.",
);
