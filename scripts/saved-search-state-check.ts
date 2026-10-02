import assert from "node:assert/strict";
import { createDiscoverFilters } from "../src/components/discoverState";
import {
  copySavedSearchFilters,
  createInitialSavedSearchState,
  deleteSavedSearch,
  findSavedSearch,
  renameSavedSearch,
  restoreSavedSearch,
  savedSearchSummary,
  saveSearch,
} from "../src/components/savedSearchState";

const filters = createDiscoverFilters();
filters.maxPrice = "2000";
filters.bedrooms = "2";
filters.features = ["Lift", "Outdoor space"];
filters.viewMode = "map";
filters.drawnZone = [
  [41.3, 2.1],
  [41.4, 2.1],
  [41.4, 2.2],
];
const search = { intent: "Rent" as const, query: "  Gràcia  ", filters };
const initial = createInitialSavedSearchState();
const saved = saveSearch(initial, search, new Date("2026-10-02T12:00:00Z"));
const record = saved.records[0];
assert.equal(initial.records.length, 0);
assert.equal(record.query, "Gràcia");
assert.equal(record.filters.maxPrice, "2000");
assert.notEqual(record.filters, filters);
assert.notEqual(record.filters.features, filters.features);
assert.notEqual(
  record.filters.drawnZone[0],
  filters.drawnZone[0],
  "Saved map vertices are detached snapshots",
);
assert.equal(
  saveSearch(saved, {
    ...search,
    query: "GRÀCIA",
    filters: { ...filters, features: ["Outdoor space", "Lift"] },
  }),
  saved,
  "Equivalent query/features do not create duplicate records",
);
assert.equal(findSavedSearch(saved, search)?.id, record.id);
const changedSearch = saveSearch(saved, {
  ...search,
  filters: { ...filters, maxPrice: "2500" },
});
assert.equal(
  changedSearch.records.length,
  2,
  "A different constraint is a separate search",
);
assert.equal(
  saveSearch(saved, { ...search, intent: "Buy" }).records.length,
  2,
  "Rental and purchase searches are distinct",
);

filters.features.push("Parking");
filters.drawnZone[0][0] = 99;
assert.equal(record.filters.features.length, 2);
assert.equal(record.filters.drawnZone[0][0], 41.3);
const reopened = copySavedSearchFilters(record.filters);
reopened.features.push("Air conditioning");
assert.equal(
  record.filters.features.length,
  2,
  "Editing a reopened search does not overwrite the saved snapshot",
);

const renamed = renameSavedSearch(
  saved,
  record.id,
  "  My Barcelona shortlist  ",
);
assert.equal(renamed.records[0].label, "My Barcelona shortlist");
assert.equal(renameSavedSearch(renamed, record.id, " "), renamed);
assert.equal(
  renamed.records[0].filters,
  record.filters,
  "Rename preserves filter snapshots",
);
const deleted = deleteSavedSearch(renamed, record.id);
assert.equal(deleted.records.length, 0);
assert.equal(deleted.nextId, saved.nextId);
const restored = restoreSavedSearch(deleted, renamed.records[0]);
assert.equal(restored.records[0].id, record.id);
assert.equal(restoreSavedSearch(restored, renamed.records[0]), restored);
assert.notEqual(
  saveSearch(deleted, search).records[0].id,
  record.id,
  "Deleting does not recycle search ids",
);
assert(savedSearchSummary(record).includes("Up to €2,000 / month"));
assert(savedSearchSummary(record).includes("2+ bedrooms"));
assert(savedSearchSummary(record).includes("Drawn map area (3 points)"));
assert(savedSearchSummary(record).includes("Map view"));
console.log(
  "Saved-search state checks passed: detached snapshots, duplicate handling, rename/delete/undo and complete filter summaries.",
);
