import assert from "node:assert/strict";
import { estimateRentBudget } from "../src/components/affordability";
import {
  applyDiscoverSearch,
  createInitialDiscoverState,
  discoverSearch,
  updateDiscoverState,
} from "../src/components/discoverState";
import {
  createDiscoverHistory,
  readDiscoverHistory,
} from "../src/components/discoverHistory";
import {
  createInitialSavedSearchState,
  saveSearch,
} from "../src/components/savedSearchState";
import { readAppRoute } from "../src/navigation";

assert.deepEqual(estimateRentBudget("3000", "200"), {
  lower: 640,
  upper: 850,
});
assert.deepEqual(estimateRentBudget("5000", ""), {
  lower: 1400,
  upper: 1750,
});
assert.deepEqual(estimateRentBudget("3000", "1100"), { lower: 0, upper: 0 });
assert.deepEqual(estimateRentBudget("100.5", "0.5"), { lower: 27, upper: 34 });
for (const [income, costs] of [
  ["", "0"],
  ["0", "0"],
  ["-1", "0"],
  ["NaN", "0"],
  ["Infinity", "0"],
  ["1e309", "0"],
  ["3000", "-1"],
  ["3000", "Infinity"],
  ["3000", "invalid"],
  [String(Number.MAX_SAFE_INTEGER + 1), "0"],
])
  assert.equal(estimateRentBudget(income, costs), null);

for (const intent of ["Rent", "Buy"] as const) {
  const initial = createInitialDiscoverState();
  const custom = updateDiscoverState(initial, "tenant", intent, (filters) => ({
    ...filters,
    maxPrice: "850",
    bedrooms: "2",
  }));
  const search = discoverSearch(custom, "tenant", intent);
  assert.equal(search.filters.maxPrice, "850");
  assert.equal(initial.tenant[intent].filters.maxPrice, "Any price");
  assert.equal(custom.landlord[intent].filters.maxPrice, "Any price");

  const route = readAppRoute(`?view=discover&role=tenant&intent=${intent}`);
  const history = createDiscoverHistory(route, search);
  assert.deepEqual(readDiscoverHistory(history, route), search);
  const saved = saveSearch(createInitialSavedSearchState(), {
    ...search,
    intent,
  });
  const restored = applyDiscoverSearch(
    initial,
    "tenant",
    intent,
    saved.records[0],
  );
  assert.deepEqual(discoverSearch(restored, "tenant", intent), search);

  for (const bad of [
    "0",
    "-850",
    "850.5",
    "1e3",
    "NaN",
    "Infinity",
    " 850",
    "0850",
    "9007199254740992",
  ]) {
    assert.equal(
      updateDiscoverState(custom, "tenant", intent, (filters) => ({
        ...filters,
        maxPrice: bad,
      })),
      custom,
      `Reject malformed maximum price: ${bad}`,
    );
  }
  const reset = updateDiscoverState(custom, "tenant", intent, (filters) => ({
    ...filters,
    maxPrice: "Any price",
  }));
  assert.equal(reset.tenant[intent].filters.maxPrice, "Any price");
}
console.log("Affordability and custom-price round-trip checks passed.");
