import type { Role } from "../types";

export const savedHomesIntents = ["All", "Rent", "Buy"] as const;
export const savedHomesSorts = [
  "Recently saved",
  "Newest listing",
  "Price: low to high",
  "Price: high to low",
] as const;

export type SavedHomesIntent = (typeof savedHomesIntents)[number];
export type SavedHomesSort = (typeof savedHomesSorts)[number];
export interface SavedHomesView {
  intent: SavedHomesIntent;
  sort: SavedHomesSort;
}
export type SavedHomesViewState = Record<Role, SavedHomesView>;
export interface SavedHomesViewPatch {
  intent?: string;
  sort?: string;
}

const roles = new Set<Role>([
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
]);
const defaults = (): SavedHomesView => ({
  intent: "All",
  sort: "Recently saved",
});

/** Keep local browsing controls separate from the saved collections themselves. */
export function createInitialSavedHomesViewState(): SavedHomesViewState {
  return {
    tenant: defaults(),
    landlord: defaults(),
    provider: defaults(),
    spaceOperator: defaults(),
    admin: defaults(),
  };
}

/** Return a snapshot so changing a caller's controls cannot mutate stored state. */
export function savedHomesView(
  state: SavedHomesViewState,
  role: Role,
): SavedHomesView {
  return roles.has(role) ? { ...state[role] } : defaults();
}

export function updateSavedHomesView(
  state: SavedHomesViewState,
  role: Role,
  patch: SavedHomesViewPatch,
): SavedHomesViewState {
  if (!roles.has(role)) return state;
  const current = state[role];
  const intent = savedHomesIntents.includes(patch.intent as SavedHomesIntent)
    ? (patch.intent as SavedHomesIntent)
    : current.intent;
  const sort = savedHomesSorts.includes(patch.sort as SavedHomesSort)
    ? (patch.sort as SavedHomesSort)
    : current.sort;
  if (current.intent === intent && current.sort === sort) return state;
  return { ...state, [role]: { intent, sort } };
}

export function resetSavedHomesView(
  state: SavedHomesViewState,
  role: Role,
): SavedHomesViewState {
  return updateSavedHomesView(state, role, defaults());
}
