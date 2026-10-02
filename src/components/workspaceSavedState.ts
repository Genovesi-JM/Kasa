import type { Role } from "../types";
import {
  createInitialSavedSearchState,
  type SavedSearchState,
} from "./savedSearchState";

export interface WorkspaceSavedCollection {
  favourites: number[];
  spaceFavourites: number[];
  searches: SavedSearchState;
}

export type WorkspaceSavedState = Record<Role, WorkspaceSavedCollection>;
export type FavouriteUpdate = number[] | ((current: number[]) => number[]);
export type SavedSearchStateUpdate =
  SavedSearchState | ((current: SavedSearchState) => SavedSearchState);

/** Separate local collections for each sample workspace; not backend identity. */
export function createInitialWorkspaceSavedState(): WorkspaceSavedState {
  const empty = (): WorkspaceSavedCollection => ({
    favourites: [],
    spaceFavourites: [],
    searches: createInitialSavedSearchState(),
  });
  return {
    tenant: {
      favourites: [2],
      spaceFavourites: [],
      searches: createInitialSavedSearchState(),
    },
    landlord: empty(),
    provider: empty(),
    spaceOperator: empty(),
    admin: empty(),
  };
}

export function updateWorkspaceFavourites(
  state: WorkspaceSavedState,
  role: Role,
  update: FavouriteUpdate,
): WorkspaceSavedState {
  const collection = state[role];
  const favourites =
    typeof update === "function" ? update(collection.favourites) : update;
  if (favourites === collection.favourites) return state;
  return { ...state, [role]: { ...collection, favourites } };
}

export function updateWorkspaceSavedSearches(
  state: WorkspaceSavedState,
  role: Role,
  update: SavedSearchStateUpdate,
): WorkspaceSavedState {
  const collection = state[role];
  const searches =
    typeof update === "function" ? update(collection.searches) : update;
  if (searches === collection.searches) return state;
  return { ...state, [role]: { ...collection, searches } };
}

export function toggleWorkspaceSpaceFavourite(
  state: WorkspaceSavedState,
  role: Role,
  venueId: number,
): WorkspaceSavedState {
  if (!Number.isSafeInteger(venueId) || venueId <= 0) return state;
  const collection = state[role];
  const spaceFavourites = collection.spaceFavourites.includes(venueId)
    ? collection.spaceFavourites.filter((id) => id !== venueId)
    : [...collection.spaceFavourites, venueId];
  return { ...state, [role]: { ...collection, spaceFavourites } };
}
