import assert from "node:assert/strict";
import type { Role } from "../src/types";
import type { ZonePoint } from "../src/components/mapGeometry";
import {
  createInitialSpacesDiscoveryState,
  MAX_SPACES_DISCOVERY_QUERY,
  MAX_SPACES_DISCOVERY_ZONE_POINTS,
  resetSpacesDiscoveryFilters,
  spacesDiscoveryActivityOptions,
  spacesDiscoveryAmenityOptions,
  spacesDiscoveryFilters,
  spacesDiscoveryPriceOptions,
  startSpacesDiscoverySearch,
  updateSpacesDiscovery,
  type SpacesDiscoveryFilters,
} from "../src/components/spacesDiscoveryState";

const initial = createInitialSpacesDiscoveryState();
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
for (const role of roles) {
  assert.equal(spacesDiscoveryFilters(initial, role).category, "Sports");
  for (const other of roles.filter((item) => item !== role)) {
    assert.notEqual(initial[role], initial[other]);
    assert.notEqual(
      initial[role].spaceAmenities,
      initial[other].spaceAmenities,
    );
    assert.notEqual(initial[role].drawnZone, initial[other].drawnZone);
  }
}
const zone: ZonePoint[] = [
  [41.38, 2.16],
  [41.39, 2.16],
  [41.39, 2.18],
];
const selectedAmenities = ["Lighting", "Parking", "Lighting"];
const tenant = updateSpacesDiscovery(initial, "tenant", {
  query: "Poblenou",
  activity: "Padel",
  sort: "Nearest",
  savedOnly: true,
  mapView: true,
  availableToday: true,
  bookingMode: "Request to Book",
  capacity: "4",
  spaceMaxPrice: "60",
  spaceAmenities: selectedAmenities,
  drawnZone: zone,
});
assert.deepEqual(tenant.tenant.spaceAmenities, ["Lighting", "Parking"]);
assert.deepEqual(tenant.tenant.drawnZone, zone);
assert.notEqual(tenant.tenant.drawnZone, zone);
assert.notEqual(tenant.tenant.drawnZone[0], zone[0]);
zone[0][0] = 0;
selectedAmenities[0] = "Kitchen";
assert.equal(
  tenant.tenant.drawnZone[0][0],
  41.38,
  "Input arrays must not mutate retained geometry",
);
assert.equal(tenant.tenant.spaceAmenities[0], "Lighting");
for (const role of roles.filter((item) => item !== "tenant"))
  assert.equal(
    tenant[role],
    initial[role],
    "An update cannot replace another workspace's filters",
  );
assert.deepEqual(
  createInitialSpacesDiscoveryState(),
  initial,
  "Previous state remains unchanged",
);
const read = spacesDiscoveryFilters(tenant, "tenant");
read.drawnZone[0][1] = 0;
read.spaceAmenities.push("Kitchen");
assert.equal(
  tenant.tenant.drawnZone[0][1],
  2.16,
  "Selectors return independent nested arrays",
);
assert.deepEqual(tenant.tenant.spaceAmenities, ["Lighting", "Parking"]);

const events = updateSpacesDiscovery(tenant, "tenant", { category: "Events" });
assert.equal(events.tenant.activity, "Any activity");
assert.equal(events.tenant.spaceMaxPrice, "Any price");
assert.deepEqual(
  events.tenant.spaceAmenities,
  ["Parking"],
  "Category switching preserves only still-visible amenities",
);
assert.equal(events.tenant.query, "Poblenou");
assert.deepEqual(events.tenant.drawnZone, tenant.tenant.drawnZone);
const eventFilters = updateSpacesDiscovery(events, "tenant", {
  activity: "Reception",
  spaceMaxPrice: "800",
  spaceAmenities: ["Kitchen", "Accessible entry"],
});
const all = updateSpacesDiscovery(eventFilters, "tenant", { category: "All" });
assert.equal(all.tenant.spaceMaxPrice, "800");
assert.equal(all.tenant.activity, "Reception");
assert.deepEqual(all.tenant.spaceAmenities, ["Kitchen", "Accessible entry"]);
assert.deepEqual(spacesDiscoveryPriceOptions("All"), [
  "30",
  "60",
  "100",
  "500",
  "800",
  "1200",
]);
assert.equal(spacesDiscoveryActivityOptions("All").length, 8);
assert.equal(spacesDiscoveryAmenityOptions("All").length, 8);
const sports = updateSpacesDiscovery(all, "tenant", { category: "Sports" });
assert.equal(sports.tenant.activity, "Any activity");
assert.equal(sports.tenant.spaceMaxPrice, "Any price");
assert.deepEqual(sports.tenant.spaceAmenities, ["Accessible entry"]);
const atomic = updateSpacesDiscovery(tenant, "tenant", {
  category: "Events",
  activity: "Celebration",
  spaceMaxPrice: "500",
  spaceAmenities: ["Kitchen", "Lighting"],
});
assert.equal(
  atomic.tenant.activity,
  "Celebration",
  "Category and compatible criteria can be changed atomically",
);
assert.equal(atomic.tenant.spaceMaxPrice, "500");
assert.deepEqual(atomic.tenant.spaceAmenities, ["Kitchen"]);

const owner = updateSpacesDiscovery(eventFilters, "landlord", {
  query: "Tennis",
  spaceMaxPrice: "30",
});
assert.equal(
  owner.tenant,
  eventFilters.tenant,
  "Returning from another role retains exact tenant state",
);
assert.equal(owner.landlord.query, "Tennis");
const reset = resetSpacesDiscoveryFilters(owner, "tenant");
assert.equal(reset.tenant.query, "Poblenou");
assert.equal(reset.tenant.category, "Events");
assert.equal(reset.tenant.mapView, true);
assert.equal(reset.tenant.sort, "Recommended");
assert.equal(reset.tenant.activity, "Any activity");
assert.equal(reset.tenant.bookingMode, "Any booking mode");
assert.equal(reset.tenant.capacity, "Any capacity");
assert.equal(reset.tenant.spaceMaxPrice, "Any price");
assert.equal(reset.tenant.savedOnly, false);
assert.equal(reset.tenant.availableToday, false);
assert.deepEqual(reset.tenant.spaceAmenities, []);
assert.deepEqual(reset.tenant.drawnZone, []);
assert.equal(reset.landlord, owner.landlord);
const search = startSpacesDiscoverySearch(owner, "tenant", "Poblenou");
assert.equal(
  search.tenant.category,
  "All",
  "A repeated explicit search still resets conflicting category/constraints",
);
assert.equal(search.tenant.query, "Poblenou");
assert.equal(search.tenant.mapView, true);
assert.equal(search.tenant.savedOnly, false);
assert.equal(search.tenant.activity, "Any activity");
assert.deepEqual(search.tenant.drawnZone, []);
assert.deepEqual(search.tenant.spaceAmenities, []);
assert.equal(search.landlord, owner.landlord);
assert.equal(startSpacesDiscoverySearch(owner, "tenant", "").tenant.query, "");

for (const invalidRole of ["__proto__", "guest", "Tenant", ""]) {
  const role = invalidRole as Role;
  assert.equal(updateSpacesDiscovery(owner, role, { query: "leak" }), owner);
  assert.equal(resetSpacesDiscoveryFilters(owner, role), owner);
  assert.equal(startSpacesDiscoverySearch(owner, role, "leak"), owner);
  assert.equal(spacesDiscoveryFilters(owner, role).query, "");
}
const invalid = updateSpacesDiscovery(tenant, "tenant", {
  category: "Work",
  sort: "Bogus",
  bookingMode: "Instant",
  capacity: "-2",
  activity: "Reception",
  spaceMaxPrice: "500",
  savedOnly: "false",
} as unknown as Partial<SpacesDiscoveryFilters>);
assert.equal(
  invalid,
  tenant,
  "Unsupported scalar filter values cannot add hidden criteria",
);
for (const badZone of [
  [[NaN, 2]],
  [[41, Infinity]],
  [[91, 2]],
  [[41, -181]],
  [["41", 2]],
  [[41]],
  [[41, 2, 3]],
  null,
  Array.from({ length: MAX_SPACES_DISCOVERY_ZONE_POINTS + 1 }, () => [41, 2]),
]) {
  assert.equal(
    updateSpacesDiscovery(tenant, "tenant", {
      drawnZone: badZone as ZonePoint[],
    }),
    tenant,
    "Malformed or oversized outlines must leave the retained zone untouched",
  );
}
assert.deepEqual(
  updateSpacesDiscovery(initial, "tenant", { drawnZone: [[41, 2]] }).tenant
    .drawnZone,
  [[41, 2]],
  "Partial map outlines are retained while drawing",
);
assert.deepEqual(
  updateSpacesDiscovery(initial, "tenant", {
    drawnZone: [
      [41, 2],
      [42, 3],
    ],
  }).tenant.drawnZone,
  [
    [41, 2],
    [42, 3],
  ],
);
assert.equal(updateSpacesDiscovery(tenant, "tenant", {}).tenant, tenant.tenant);
const bounded = startSpacesDiscoverySearch(initial, "tenant", "x".repeat(1000));
assert.equal(bounded.tenant.query.length, MAX_SPACES_DISCOVERY_QUERY);
const callback = updateSpacesDiscovery(tenant, "tenant", (current) => {
  current.drawnZone[0][0] = 40;
  current.spaceAmenities.push("Accessible entry");
  return current;
});
assert.equal(callback.tenant.drawnZone[0][0], 40);
assert.equal(
  tenant.tenant.drawnZone[0][0],
  41.38,
  "Functional updater mutations cannot alter prior state",
);
const options = spacesDiscoveryActivityOptions("Sports");
options.push("Bogus");
assert.equal(spacesDiscoveryActivityOptions("Sports").includes("Bogus"), false);
console.log(
  "Spaces discovery checks passed: role retention, compatible category transitions, query reset semantics, immutable arrays and bounded map geometry.",
);
