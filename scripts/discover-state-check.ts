import assert from "node:assert/strict";
import {
  createInitialDiscoverState,
  resetDiscoverFilters,
  updateDiscoverState,
} from "../src/components/discoverState";

const initial = createInitialDiscoverState();
assert.notEqual(initial.Rent, initial.Buy);
assert.notEqual(initial.Rent.features, initial.Buy.features);
assert.notEqual(initial.Rent.drawnZone, initial.Buy.drawnZone);

const rentalSearch = updateDiscoverState(initial, "Rent", (filters) => ({
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
}));
assert.equal(
  rentalSearch.Buy,
  initial.Buy,
  "A rental search cannot leak filters into Buy",
);
assert.equal(
  initial.Rent.maxPrice,
  "Any price",
  "Updates leave prior state untouched",
);
const bothSearches = updateDiscoverState(rentalSearch, "Buy", (filters) => ({
  ...filters,
  minPrice: "300000",
  maxPrice: "650000",
  sort: "Largest",
}));
assert.equal(
  bothSearches.Rent,
  rentalSearch.Rent,
  "Returning to Rent retains the exact filters, map zone and sort",
);
assert.equal(bothSearches.Buy.maxPrice, "650000");
assert.equal(bothSearches.Rent.maxPrice, "2000");

const reset = updateDiscoverState(bothSearches, "Rent", resetDiscoverFilters);
assert.equal(
  reset.Rent.viewMode,
  "map",
  "Reset keeps the chosen result layout",
);
assert.equal(
  reset.Rent.showMoreFilters,
  true,
  "Reset does not collapse an open filter panel",
);
assert.equal(reset.Rent.maxPrice, "Any price");
assert.equal(reset.Rent.minPrice, "0");
assert.equal(reset.Rent.sort, "Recommended");
assert.deepEqual(reset.Rent.drawnZone, []);
assert.deepEqual(reset.Rent.features, []);
assert.equal(
  reset.Buy,
  bothSearches.Buy,
  "Reset applies only to the current intent",
);
assert.deepEqual(
  createInitialDiscoverState(),
  initial,
  "Fresh workspaces have independent clean searches",
);
console.log(
  "Discover state checks passed: independent Rent/Buy prices, persistent filters/map/sort and scoped resets.",
);
