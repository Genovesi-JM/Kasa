import assert from "node:assert/strict";
import type { Role } from "../src/types";
import type { ZonePoint } from "../src/components/mapGeometry";
import {
  applyDiscoverSearch,
  createDiscoverFilters,
  createInitialDiscoverState,
  discoverSearch,
  MAX_DISCOVER_QUERY,
  MAX_DISCOVER_ZONE_POINTS,
  resetDiscoverFilters,
  startDiscoverSearch,
  updateDiscoverQuery,
  updateDiscoverState,
  type DiscoverFilters,
  type DiscoverIntent,
} from "../src/components/discoverState";
import {
  createInitialSavedSearchState,
  saveSearch,
} from "../src/components/savedSearchState";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const intents: DiscoverIntent[] = ["Rent", "Buy"];
const initial = createInitialDiscoverState();
for (const role of roles) {
  assert.notEqual(initial[role].Rent, initial[role].Buy);
  assert.notEqual(
    initial[role].Rent.filters.features,
    initial[role].Buy.filters.features,
  );
  assert.notEqual(
    initial[role].Rent.filters.drawnZone,
    initial[role].Buy.filters.drawnZone,
  );
  for (const other of roles.filter((item) => item !== role)) {
    assert.notEqual(initial[role], initial[other]);
    assert.notEqual(
      initial[role].Rent.filters.features,
      initial[other].Rent.filters.features,
    );
    assert.notEqual(
      initial[role].Buy.filters.drawnZone,
      initial[other].Buy.filters.drawnZone,
    );
  }
}
const rentalSearch = updateDiscoverState(
  initial,
  "tenant",
  "Rent",
  (filters) => ({
    ...filters,
    minPrice: "1000",
    maxPrice: "2000",
    propertyType: "Apartment",
    bedrooms: "2",
    bathrooms: "2",
    furnishing: "Furnished",
    petPolicy: "Pets allowed",
    minSize: "75",
    availability: "Available now",
    verifiedOnly: true,
    features: ["Lift", "Outdoor space"],
    sort: "Price: low to high",
    viewMode: "map",
    showMoreFilters: true,
    drawnZone: [
      [41.3, 2.1],
      [41.4, 2.1],
      [41.4, 2.2],
    ],
  }),
);
const rentalQuery = updateDiscoverQuery(
  rentalSearch,
  "tenant",
  "Rent",
  "Gràcia lift",
);
assert.equal(rentalQuery.tenant.Rent.query, "Gràcia lift");
assert.equal(
  rentalQuery.tenant.Buy,
  initial.tenant.Buy,
  "Rental updates cannot affect purchase filters or query",
);
assert.equal(
  initial.tenant.Rent.filters.maxPrice,
  "Any price",
  "Previous state remains unchanged",
);
for (const role of roles.filter((item) => item !== "tenant"))
  assert.equal(
    rentalQuery[role],
    initial[role],
    "Workspace changes are isolated",
  );
const purchaseSearch = updateDiscoverState(
  rentalQuery,
  "tenant",
  "Buy",
  (filters) => ({
    ...filters,
    minPrice: "300000",
    maxPrice: "650000",
    sort: "Largest",
  }),
);
const bothSearches = updateDiscoverQuery(
  purchaseSearch,
  "tenant",
  "Buy",
  "Sarrià",
);
assert.equal(
  bothSearches.tenant.Rent,
  rentalQuery.tenant.Rent,
  "Rent retains exact query, filters, map and sort while searching Buy",
);
assert.equal(bothSearches.tenant.Buy.filters.maxPrice, "650000");
assert.equal(bothSearches.tenant.Rent.filters.maxPrice, "2000");
assert.equal(bothSearches.tenant.Buy.query, "Sarrià");
const ownerSearch = updateDiscoverQuery(
  bothSearches,
  "landlord",
  "Rent",
  "Eixample",
);
assert.equal(
  ownerSearch.tenant,
  bothSearches.tenant,
  "The landlord query cannot alter the tenant's search",
);
assert.equal(ownerSearch.landlord.Rent.query, "Eixample");
assert.equal(ownerSearch.landlord.Buy.query, "");

const reset = updateDiscoverState(
  ownerSearch,
  "tenant",
  "Rent",
  resetDiscoverFilters,
);
assert.equal(
  reset.tenant.Rent.query,
  "Gràcia lift",
  "Reset preserves the selected role/intent query",
);
assert.equal(reset.tenant.Rent.filters.viewMode, "map");
assert.equal(reset.tenant.Rent.filters.showMoreFilters, true);
assert.equal(reset.tenant.Rent.filters.maxPrice, "Any price");
assert.equal(reset.tenant.Rent.filters.minPrice, "0");
assert.equal(reset.tenant.Rent.filters.sort, "Recommended");
assert.deepEqual(reset.tenant.Rent.filters.drawnZone, []);
assert.deepEqual(reset.tenant.Rent.filters.features, []);
assert.equal(reset.tenant.Buy, ownerSearch.tenant.Buy);
assert.equal(reset.landlord, ownerSearch.landlord);
const restarted = startDiscoverSearch(
  ownerSearch,
  "tenant",
  "Rent",
  "  Gràcia lift  ",
);
assert.deepEqual(
  restarted.tenant.Rent,
  reset.tenant.Rent,
  "Explicit repeated search resets conflicting constraints and normalizes query",
);
assert.equal(restarted.tenant.Buy, ownerSearch.tenant.Buy);
assert.equal(restarted.landlord, ownerSearch.landlord);
const cleared = updateDiscoverQuery(ownerSearch, "tenant", "Rent", "");
assert.equal(cleared.tenant.Rent.query, "");
assert.deepEqual(
  cleared.tenant.Rent.filters,
  ownerSearch.tenant.Rent.filters,
  "Editing query alone preserves intentional filters",
);
assert.equal(
  updateDiscoverQuery(initial, "tenant", "Rent", "Gràcia ").tenant.Rent.query,
  "Gràcia ",
  "Typing a separator must not collapse a multi-word controlled input",
);
assert.equal(
  updateDiscoverQuery(initial, "tenant", "Rent", "x".repeat(1000)).tenant.Rent
    .query.length,
  MAX_DISCOVER_QUERY,
);

const selected = discoverSearch(ownerSearch, "tenant", "Rent");
selected.filters.features.push("Parking");
selected.filters.drawnZone[0][0] = 0;
assert.deepEqual(ownerSearch.tenant.Rent.filters.features, [
  "Lift",
  "Outdoor space",
]);
assert.equal(
  ownerSearch.tenant.Rent.filters.drawnZone[0][0],
  41.3,
  "Reading state never exposes retained nested arrays",
);
const callback = updateDiscoverState(
  ownerSearch,
  "tenant",
  "Rent",
  (filters) => {
    filters.features.push("Parking");
    filters.drawnZone[0][0] = 41.2;
    return filters;
  },
);
assert.equal(callback.tenant.Rent.filters.drawnZone[0][0], 41.2);
assert.equal(
  ownerSearch.tenant.Rent.filters.drawnZone[0][0],
  41.3,
  "Functional callbacks cannot mutate old search snapshots",
);
const direct = createDiscoverFilters();
direct.features = ["Lift", "Lift", "Unknown"];
direct.drawnZone = [[40, 2]];
const directUpdate = updateDiscoverState(initial, "tenant", "Rent", direct);
direct.features.push("Parking");
direct.drawnZone[0][0] = 0;
assert.deepEqual(directUpdate.tenant.Rent.filters.features, ["Lift"]);
assert.deepEqual(
  directUpdate.tenant.Rent.filters.drawnZone,
  [[40, 2]],
  "Partial outlines and feature arrays are cloned from caller input",
);

const saved = saveSearch(createInitialSavedSearchState(), {
  ...discoverSearch(ownerSearch, "tenant", "Rent"),
  intent: "Rent",
});
const snapshot = saved.records[0];
const applied = applyDiscoverSearch(reset, "tenant", snapshot.intent, snapshot);
assert.deepEqual(applied.tenant.Rent, {
  query: snapshot.query,
  filters: snapshot.filters,
});
assert.notEqual(
  applied.tenant.Rent.filters.features,
  snapshot.filters.features,
);
assert.notEqual(
  applied.tenant.Rent.filters.drawnZone[0],
  snapshot.filters.drawnZone[0],
);
assert.equal(applied.tenant.Buy, reset.tenant.Buy);
assert.equal(
  applied.landlord,
  reset.landlord,
  "Restoring a saved search affects only its selected workspace and intent",
);
const changedApplied = updateDiscoverState(
  applied,
  "tenant",
  "Rent",
  (filters) => ({ ...filters, features: [], drawnZone: [] }),
);
assert.deepEqual(snapshot.filters.features, ["Lift", "Outdoor space"]);
assert.equal(
  snapshot.filters.drawnZone.length,
  3,
  "Later edits do not change a saved search",
);
assert.deepEqual(changedApplied.tenant.Rent.filters.features, []);

for (const badZone of [
  [[NaN, 2]],
  [[41, Infinity]],
  [[91, 2]],
  [[41, 181]],
  [["41", 2]],
  [[41]],
  [[41, 2, 3]],
  Array.from({ length: MAX_DISCOVER_ZONE_POINTS + 1 }, () => [41, 2]),
]) {
  assert.equal(
    updateDiscoverState(ownerSearch, "tenant", "Rent", (filters) => ({
      ...filters,
      drawnZone: badZone as ZonePoint[],
    })),
    ownerSearch,
    "Malformed and oversized map geometry is rejected without losing retained outline",
  );
}
const invalidOptions = updateDiscoverState(
  ownerSearch,
  "tenant",
  "Rent",
  (filters) =>
    ({
      ...filters,
      maxPrice: "650000",
      minPrice: "300000",
      propertyType: "Palace",
      bedrooms: "100",
      sort: "Fake",
      viewMode: "other",
      verifiedOnly: "true",
    }) as unknown as DiscoverFilters,
);
assert.equal(
  invalidOptions,
  ownerSearch,
  "Unknown options and Buy prices cannot enter a rental search",
);
assert.equal(
  updateDiscoverState(ownerSearch, "tenant", "Rent", (filters) => filters),
  ownerSearch,
);
assert.equal(
  updateDiscoverQuery(
    ownerSearch,
    "tenant",
    "Rent",
    ownerSearch.tenant.Rent.query,
  ),
  ownerSearch,
);
for (const role of ["guest", "__proto__", "Tenant"] as unknown as Role[]) {
  let called = false;
  assert.equal(
    updateDiscoverState(ownerSearch, role, "Rent", (filters) => {
      called = true;
      return filters;
    }),
    ownerSearch,
  );
  assert.equal(called, false);
  assert.equal(
    updateDiscoverQuery(ownerSearch, role, "Rent", "leak"),
    ownerSearch,
  );
  assert.equal(
    startDiscoverSearch(ownerSearch, role, "Rent", "leak"),
    ownerSearch,
  );
  assert.equal(
    applyDiscoverSearch(ownerSearch, role, "Rent", snapshot),
    ownerSearch,
  );
  assert.deepEqual(discoverSearch(ownerSearch, role, "Rent"), {
    query: "",
    filters: createDiscoverFilters(),
  });
}
for (const intent of [
  "All",
  "__proto__",
  "rent",
] as unknown as DiscoverIntent[]) {
  assert.equal(
    updateDiscoverState(ownerSearch, "tenant", intent, createDiscoverFilters()),
    ownerSearch,
  );
  assert.equal(
    updateDiscoverQuery(ownerSearch, "tenant", intent, "leak"),
    ownerSearch,
  );
  assert.equal(
    startDiscoverSearch(ownerSearch, "tenant", intent, "leak"),
    ownerSearch,
  );
  assert.equal(
    applyDiscoverSearch(ownerSearch, "tenant", intent, snapshot),
    ownerSearch,
  );
  assert.equal(discoverSearch(ownerSearch, "tenant", intent).query, "");
}
for (const role of roles)
  for (const intent of intents)
    assert.equal(discoverSearch(initial, role, intent).query, "");
assert.deepEqual(createInitialDiscoverState(), initial);
console.log(
  "Property discovery checks passed: role/intent query and filter isolation, detached saved snapshots, explicit/reset semantics and bounded map geometry.",
);
