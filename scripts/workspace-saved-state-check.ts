import assert from "node:assert/strict";
import { createDiscoverFilters } from "../src/components/discoverState";
import {
  deleteSavedSearch,
  renameSavedSearch,
  saveSearch,
} from "../src/components/savedSearchState";
import {
  createInitialWorkspaceSavedState,
  updateWorkspaceFavourites,
  toggleWorkspaceSpaceFavourite,
  updateWorkspaceSavedSearches,
} from "../src/components/workspaceSavedState";
import type { Role } from "../src/types";

const initial = createInitialWorkspaceSavedState();
assert.deepEqual(initial.tenant.favourites, [2]);
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as Role[]) {
  assert.deepEqual(initial[role].favourites, []);
  assert.deepEqual(initial[role].searches.records, []);
  assert.notEqual(initial[role].searches, initial.tenant.searches);
  assert.notEqual(initial[role].favourites, initial.tenant.favourites);
}

const search = {
  query: "Eixample",
  intent: "Rent" as const,
  filters: createDiscoverFilters(),
};
const tenantSaved = updateWorkspaceSavedSearches(initial, "tenant", (state) =>
  saveSearch(state, search),
);
const tenantId = tenantSaved.tenant.searches.records[0].id;
assert.equal(tenantSaved.landlord, initial.landlord);
assert.equal(tenantSaved.tenant.searches.records.length, 1);
assert.equal(initial.tenant.searches.records.length, 0);

const ownerSaved = updateWorkspaceSavedSearches(
  tenantSaved,
  "landlord",
  (state) => saveSearch(state, { ...search, intent: "Buy" }),
);
const ownerId = ownerSaved.landlord.searches.records[0].id;
const renamed = updateWorkspaceSavedSearches(ownerSaved, "tenant", (state) =>
  renameSavedSearch(state, tenantId, "My rental search"),
);
assert.equal(renamed.tenant.searches.records[0].label, "My rental search");
assert.equal(
  renamed.landlord,
  ownerSaved.landlord,
  "Renaming under a shared local id does not touch another workspace",
);
const removed = updateWorkspaceSavedSearches(renamed, "landlord", (state) =>
  deleteSavedSearch(state, ownerId),
);
assert.equal(removed.landlord.searches.records.length, 0);
assert.equal(
  removed.tenant.searches.records[0].label,
  "My rental search",
  "Switching back retains the tenant search",
);

const ownerFavourite = updateWorkspaceFavourites(removed, "landlord", [1]);
const tenantRemovedFavourite = updateWorkspaceFavourites(
  ownerFavourite,
  "tenant",
  (current) => current.filter((id) => id !== 2),
);
assert.deepEqual(tenantRemovedFavourite.tenant.favourites, []);
assert.deepEqual(tenantRemovedFavourite.landlord.favourites, [1]);
assert.equal(tenantRemovedFavourite.landlord, ownerFavourite.landlord);
assert.equal(tenantRemovedFavourite.tenant.searches, removed.tenant.searches);
assert.equal(
  updateWorkspaceSavedSearches(
    tenantRemovedFavourite,
    "tenant",
    (current) => current,
  ),
  tenantRemovedFavourite,
);
assert.equal(
  updateWorkspaceFavourites(
    tenantRemovedFavourite,
    "tenant",
    (current) => current,
  ),
  tenantRemovedFavourite,
);
assert.deepEqual(createInitialWorkspaceSavedState().tenant.favourites, [2]);
const savedVenue = toggleWorkspaceSpaceFavourite(initial, "tenant", 1);
assert.deepEqual(savedVenue.tenant.spaceFavourites, [1]);
assert.deepEqual(
  savedVenue.tenant.favourites,
  [2],
  "Venue IDs do not mix with home favourites",
);
assert.equal(savedVenue.landlord, initial.landlord);
const bothSaved = toggleWorkspaceSpaceFavourite(savedVenue, "landlord", 2);
assert.deepEqual(bothSaved.tenant.spaceFavourites, [1]);
assert.deepEqual(bothSaved.landlord.spaceFavourites, [2]);
assert.deepEqual(
  toggleWorkspaceSpaceFavourite(bothSaved, "tenant", 1).tenant.spaceFavourites,
  [],
);
assert.equal(
  toggleWorkspaceSpaceFavourite(bothSaved, "tenant", Number.NaN),
  bothSaved,
);
assert.deepEqual(initial.tenant.spaceFavourites, [], "Saving is immutable");
console.log(
  "Workspace saved-state checks passed: isolated home/venue favourites and searches, rename/delete across personas and retained state after switching.",
);
