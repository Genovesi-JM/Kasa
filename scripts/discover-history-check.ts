import assert from "node:assert/strict";
import { properties } from "../src/data";
import { readAppRoute, type AppRoute } from "../src/navigation";
import type { Role } from "../src/types";
import {
  createDiscoverHistory,
  readDiscoverHistory,
} from "../src/components/discoverHistory";
import {
  applyDiscoverSearch,
  createDiscoverFilters,
  createInitialDiscoverState,
  discoverSearch,
  MAX_DISCOVER_QUERY,
  MAX_DISCOVER_ZONE_POINTS,
  type DiscoverFilters,
  type DiscoverIntent,
  type DiscoverSearch,
} from "../src/components/discoverState";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const intents: DiscoverIntent[] = ["Rent", "Buy"];
const route = readAppRoute("?view=discover&role=tenant&intent=Rent&q=Gràcia");
const original: DiscoverSearch = {
  query: "Gràcia",
  filters: {
    ...createDiscoverFilters(),
    maxPrice: "2000",
    minPrice: "1000",
    bedrooms: "2",
    bathrooms: "1",
    propertyType: "Apartment",
    minSize: "75",
    furnishing: "Furnished",
    petPolicy: "Pets allowed",
    availability: "Available now",
    verifiedOnly: true,
    features: ["Lift", "Outdoor space"],
    viewMode: "map",
    showMoreFilters: true,
    sort: "Price: low to high",
    drawnZone: [
      [41.3, 2.1],
      [41.4, 2.1],
      [41.4, 2.2],
    ],
  },
};
const history = createDiscoverHistory(route, original)!;
assert.ok(history);
assert.deepEqual(readDiscoverHistory(history, route), original);
assert.deepEqual(
  readDiscoverHistory(JSON.parse(JSON.stringify(history)), route),
  original,
  "History snapshots survive browser-style serialization",
);
assert.notEqual(history.filters, original.filters);
assert.notEqual(history.filters.features, original.filters.features);
assert.notEqual(history.filters.drawnZone[0], original.filters.drawnZone[0]);
const copied = readDiscoverHistory(history, route)!;
copied.filters.features.push("Parking");
copied.filters.drawnZone[0][0] = 40;
assert.deepEqual(readDiscoverHistory(history, route), original);
const createSource = structuredClone(original);
const created = createDiscoverHistory(route, createSource)!;
createSource.filters.maxPrice = "1500";
createSource.filters.features.length = 0;
createSource.filters.drawnZone[0][0] = 0;
assert.deepEqual(readDiscoverHistory(created, route), original);

// Back to an earlier query must recover that entry's full filters, not those
// from the saved search that most recently replaced the workspace's controls.
const secondRoute = { ...route, query: "Eixample" };
const secondSearch: DiscoverSearch = {
  query: secondRoute.query,
  filters: { ...createDiscoverFilters(), maxPrice: "1500" },
};
const secondHistory = createDiscoverHistory(secondRoute, secondSearch)!;
const afterSecondSearch = applyDiscoverSearch(
  createInitialDiscoverState(),
  route.role,
  route.intent,
  secondSearch,
);
const restoredFirst = applyDiscoverSearch(
  afterSecondSearch,
  route.role,
  route.intent,
  readDiscoverHistory(history, route)!,
);
assert.deepEqual(
  discoverSearch(restoredFirst, route.role, route.intent),
  original,
);
const restoredSecond = applyDiscoverSearch(
  restoredFirst,
  route.role,
  route.intent,
  readDiscoverHistory(secondHistory, secondRoute)!,
);
assert.deepEqual(
  discoverSearch(restoredSecond, route.role, route.intent),
  secondSearch,
);
assert.deepEqual(readDiscoverHistory(history, route), original);

for (const role of roles) {
  for (const intent of intents) {
    const scopedRoute = { ...route, role, intent };
    const scopedSearch: DiscoverSearch = {
      ...original,
      filters: {
        ...original.filters,
        minPrice: intent === "Rent" ? "1000" : "300000",
        maxPrice: intent === "Rent" ? "2000" : "650000",
      },
    };
    const scopedHistory = createDiscoverHistory(scopedRoute, scopedSearch)!;
    assert.deepEqual(
      readDiscoverHistory(scopedHistory, scopedRoute),
      scopedSearch,
    );
    const property = properties.find((item) => item.listingType === intent)!;
    const detailRoute = readAppRoute(
      `?role=${role}&view=property&property=${property.id}&q=Gràcia&from=saved`,
    );
    assert.deepEqual(
      readDiscoverHistory(scopedHistory, detailRoute),
      scopedSearch,
    );
    assert.deepEqual(
      readDiscoverHistory(
        createDiscoverHistory(detailRoute, scopedSearch),
        scopedRoute,
      ),
      scopedSearch,
      "Property details and discovery can carry the same scoped search context",
    );
    for (const otherRole of roles.filter((value) => value !== role))
      assert.equal(
        readDiscoverHistory(scopedHistory, { ...scopedRoute, role: otherRole }),
        null,
        "Another workspace cannot replay this search snapshot",
      );
    assert.equal(
      readDiscoverHistory(scopedHistory, {
        ...scopedRoute,
        intent: intent === "Rent" ? "Buy" : "Rent",
      }),
      null,
    );
  }
}
for (const view of [
  "overview",
  "saved",
  "spaces",
  "services",
  "spaceVenue",
] as const) {
  const otherRoute = { ...route, view };
  assert.equal(createDiscoverHistory(otherRoute, original), null);
  assert.equal(readDiscoverHistory(history, otherRoute), null);
}
for (const query of ["", "Eixample", "gràcia", "Gràcia lift"])
  assert.equal(readDiscoverHistory(history, { ...route, query }), null);
assert.equal(createDiscoverHistory(secondRoute, original), null);
assert.deepEqual(
  readDiscoverHistory(
    { ...history, query: "  Gràcia  " },
    { ...route, query: " Gràcia " },
  ),
  original,
);
const longQuery = "x".repeat(MAX_DISCOVER_QUERY + 50);
assert.equal(
  createDiscoverHistory(
    { ...route, query: longQuery },
    { ...original, query: longQuery },
  )?.query.length,
  MAX_DISCOVER_QUERY,
);

for (const malformed of [
  null,
  undefined,
  [],
  "history",
  0,
  {},
  { ...history, tag: "unrelated" },
  { ...history, version: 2 },
  { ...history, version: "1" },
  { ...history, query: 42 },
  { ...history, filters: null },
  { ...history, filters: [] },
  Object.create(history),
])
  assert.equal(readDiscoverHistory(malformed, route), null);

for (const field of Object.keys(original.filters)) {
  const incomplete = { ...original.filters } as Record<string, unknown>;
  delete incomplete[field];
  assert.equal(
    readDiscoverHistory({ ...history, filters: incomplete }, route),
    null,
  );
}
for (const filters of [
  { ...original.filters, maxPrice: 2000 },
  { ...original.filters, sort: "x".repeat(MAX_DISCOVER_QUERY + 1) },
  { ...original.filters, verifiedOnly: "true" },
  { ...original.filters, showMoreFilters: 1 },
  { ...original.filters, features: "Lift" },
  { ...original.filters, features: ["Lift", 1] },
  { ...original.filters, features: Array(3) },
  { ...original.filters, features: Array(65).fill("Lift") },
  { ...original.filters, drawnZone: "map" },
  { ...original.filters, drawnZone: Array(3) },
  { ...original.filters, drawnZone: [[41]] },
  { ...original.filters, drawnZone: [[41, 2, 3]] },
  { ...original.filters, drawnZone: [["41", 2]] },
  { ...original.filters, drawnZone: [[NaN, 2]] },
  { ...original.filters, drawnZone: [[41, Infinity]] },
  { ...original.filters, drawnZone: [[91, 2]] },
  { ...original.filters, drawnZone: [[41, 181]] },
  {
    ...original.filters,
    drawnZone: Array(MAX_DISCOVER_ZONE_POINTS + 1).fill([41, 2]),
  },
]) {
  assert.equal(readDiscoverHistory({ ...history, filters }, route), null);
  assert.equal(
    createDiscoverHistory(route, {
      ...original,
      filters: filters as DiscoverFilters,
    }),
    null,
  );
}
const withUnknownOptions = readDiscoverHistory(
  {
    ...history,
    filters: {
      ...original.filters,
      maxPrice: "650000",
      minPrice: "300000",
      propertyType: "Palace",
      viewMode: "unsupported",
      features: ["Lift", "Unknown", "Lift"],
    },
  },
  route,
)!;
assert.equal(withUnknownOptions.filters.maxPrice, "Any price");
assert.equal(withUnknownOptions.filters.minPrice, "0");
assert.equal(withUnknownOptions.filters.propertyType, "All types");
assert.equal(withUnknownOptions.filters.viewMode, "list");
assert.deepEqual(withUnknownOptions.filters.features, ["Lift"]);
assert.equal(withUnknownOptions.filters.bedrooms, "2");
assert.equal(
  readDiscoverHistory(history, {
    ...route,
    role: "guest",
  } as unknown as AppRoute),
  null,
);
assert.equal(
  createDiscoverHistory(
    { ...route, intent: "All" } as unknown as AppRoute,
    original,
  ),
  null,
);
const extra = {
  ...original,
  privateNote: "Not browsing state",
  filters: { ...original.filters, file: new Blob(["private file"]) },
};
const stripped = createDiscoverHistory(route, extra)!;
assert.deepEqual(Object.keys(stripped).sort(), [
  "filters",
  "intent",
  "query",
  "role",
  "tag",
  "version",
]);
assert.deepEqual(
  Object.keys(stripped.filters).sort(),
  Object.keys(createDiscoverFilters()).sort(),
);
assert.deepEqual(readDiscoverHistory(stripped, route), original);
console.log(
  "Property history checks passed: exact Back/Forward search snapshots, scoped route matching, serialization, detached arrays and malformed-state rejection.",
);
