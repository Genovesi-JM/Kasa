import type { Role } from "../types";
import type { ZonePoint } from "./mapGeometry";

export interface DiscoverFilters {
  maxPrice: string;
  minPrice: string;
  viewMode: "list" | "map";
  verifiedOnly: boolean;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  furnishing: string;
  petPolicy: string;
  minSize: string;
  availability: string;
  features: string[];
  showMoreFilters: boolean;
  sort: string;
  drawnZone: ZonePoint[];
}

export type DiscoverIntent = "Rent" | "Buy";
/** Keep query outside filter snapshots so saved-search records remain compatible. */
export interface DiscoverSearch {
  query: string;
  filters: DiscoverFilters;
}
export type DiscoverState = Record<
  Role,
  Record<DiscoverIntent, DiscoverSearch>
>;
export type DiscoverFilterUpdate =
  DiscoverFilters | ((current: DiscoverFilters) => DiscoverFilters);
export const MAX_DISCOVER_QUERY = 200;
export const MAX_DISCOVER_ZONE_POINTS = 256;

const roles: readonly Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const intents: readonly DiscoverIntent[] = ["Rent", "Buy"];
const featureOptions = [
  "Outdoor space",
  "Parking",
  "Lift",
  "Air conditioning",
  "Accessible entry",
  "Bills included",
];
const optionFields: Partial<Record<keyof DiscoverFilters, readonly string[]>> =
  {
    viewMode: ["list", "map"],
    propertyType: ["All types", "Apartment", "House", "Studio", "Loft"],
    bedrooms: ["Any bedrooms", "1", "2", "3"],
    bathrooms: ["Any bathrooms", "1", "2", "3"],
    furnishing: ["Any furnishing", "Furnished", "Unfurnished"],
    petPolicy: ["Any pet policy", "Pets allowed", "No pets"],
    minSize: ["0", "50", "75", "100"],
    availability: ["Any availability", "Available now"],
    sort: [
      "Recommended",
      "Newest",
      "Price: low to high",
      "Price: high to low",
      "Largest",
    ],
  };

export function createDiscoverFilters(): DiscoverFilters {
  return {
    maxPrice: "Any price",
    minPrice: "0",
    viewMode: "list",
    verifiedOnly: false,
    propertyType: "All types",
    bedrooms: "Any bedrooms",
    bathrooms: "Any bathrooms",
    furnishing: "Any furnishing",
    petPolicy: "Any pet policy",
    minSize: "0",
    availability: "Any availability",
    features: [],
    showMoreFilters: false,
    sort: "Recommended",
    drawnZone: [],
  };
}

function emptySearch(): DiscoverSearch {
  return { query: "", filters: createDiscoverFilters() };
}
function emptyWorkspace(): Record<DiscoverIntent, DiscoverSearch> {
  return { Rent: emptySearch(), Buy: emptySearch() };
}
function allowed(role: Role, intent: DiscoverIntent) {
  return roles.includes(role) && intents.includes(intent);
}
function cloneFilters(filters: DiscoverFilters): DiscoverFilters {
  return {
    ...filters,
    features: [...filters.features],
    drawnZone: filters.drawnZone.map(([lat, lng]) => [lat, lng]),
  };
}
function validZone(zone: unknown): zone is ZonePoint[] {
  return (
    Array.isArray(zone) &&
    zone.length <= MAX_DISCOVER_ZONE_POINTS &&
    zone.every(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === "number" &&
        Number.isFinite(point[0]) &&
        Math.abs(point[0]) <= 90 &&
        typeof point[1] === "number" &&
        Number.isFinite(point[1]) &&
        Math.abs(point[1]) <= 180,
    )
  );
}
function normalizeFilters(
  current: DiscoverFilters,
  candidate: DiscoverFilters,
  intent: DiscoverIntent,
): DiscoverFilters {
  const next = cloneFilters(current);
  for (const field of Object.keys(
    optionFields,
  ) as (keyof typeof optionFields)[]) {
    const value = candidate[field];
    if (typeof value === "string" && optionFields[field]?.includes(value)) {
      Object.assign(next, { [field]: value });
    }
  }
  for (const field of ["verifiedOnly", "showMoreFilters"] as const) {
    if (typeof candidate[field] === "boolean") next[field] = candidate[field];
  }
  const maxPrices =
    intent === "Rent"
      ? ["Any price", "1500", "2000", "2500"]
      : ["Any price", "500000", "650000", "800000"];
  const minPrices =
    intent === "Rent" ? ["0", "1000", "1500"] : ["0", "300000", "500000"];
  if (maxPrices.includes(candidate.maxPrice))
    next.maxPrice = candidate.maxPrice;
  if (minPrices.includes(candidate.minPrice))
    next.minPrice = candidate.minPrice;
  if (Array.isArray(candidate.features))
    next.features = [
      ...new Set(
        candidate.features.filter(
          (value) =>
            typeof value === "string" && featureOptions.includes(value),
        ),
      ),
    ];
  // Partial outlines remain valid while drawing; reject malformed or oversized geometry intact.
  if (validZone(candidate.drawnZone))
    next.drawnZone = candidate.drawnZone.map(([lat, lng]) => [lat, lng]);
  return next;
}
function sameFilters(left: DiscoverFilters, right: DiscoverFilters) {
  return Object.keys(left).every((field) => {
    if (field === "features")
      return (
        left.features.length === right.features.length &&
        left.features.every((value, index) => value === right.features[index])
      );
    if (field === "drawnZone")
      return (
        left.drawnZone.length === right.drawnZone.length &&
        left.drawnZone.every(
          ([lat, lng], index) =>
            lat === right.drawnZone[index][0] &&
            lng === right.drawnZone[index][1],
        )
      );
    return (
      left[field as keyof DiscoverFilters] ===
      right[field as keyof DiscoverFilters]
    );
  });
}
function replaceSearch(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
  search: DiscoverSearch,
): DiscoverState {
  const current = state[role][intent];
  return current.query === search.query &&
    sameFilters(current.filters, search.filters)
    ? state
    : { ...state, [role]: { ...state[role], [intent]: search } };
}

/** Every workspace retains independent Rent/Buy queries, filters, map outlines and layouts. */
export function createInitialDiscoverState(): DiscoverState {
  return {
    tenant: emptyWorkspace(),
    landlord: emptyWorkspace(),
    provider: emptyWorkspace(),
    spaceOperator: emptyWorkspace(),
    admin: emptyWorkspace(),
  };
}

export function discoverSearch(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
): DiscoverSearch {
  if (!allowed(role, intent)) return emptySearch();
  const current = state[role][intent];
  return { query: current.query, filters: cloneFilters(current.filters) };
}

export function updateDiscoverState(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
  update: DiscoverFilterUpdate,
): DiscoverState {
  if (!allowed(role, intent)) return state;
  const current = discoverSearch(state, role, intent);
  const candidate =
    typeof update === "function"
      ? update(cloneFilters(current.filters))
      : update;
  if (!candidate || typeof candidate !== "object") return state;
  return replaceSearch(state, role, intent, {
    ...current,
    filters: normalizeFilters(current.filters, candidate, intent),
  });
}

/** Preserve typed spaces so controlled search fields still accept multi-word input. */
export function updateDiscoverQuery(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
  query: string,
): DiscoverState {
  if (!allowed(role, intent) || typeof query !== "string") return state;
  const current = discoverSearch(state, role, intent);
  return replaceSearch(state, role, intent, {
    ...current,
    query: query.slice(0, MAX_DISCOVER_QUERY),
  });
}

/** A deliberate new search clears constraints even when its query repeats. */
export function startDiscoverSearch(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
  query: string,
): DiscoverState {
  if (!allowed(role, intent) || typeof query !== "string") return state;
  const current = discoverSearch(state, role, intent);
  return replaceSearch(state, role, intent, {
    query: query.trim().slice(0, MAX_DISCOVER_QUERY),
    filters: resetDiscoverFilters(current.filters),
  });
}

/** Apply a saved snapshot atomically without sharing its arrays or resetting its selected constraints. */
export function applyDiscoverSearch(
  state: DiscoverState,
  role: Role,
  intent: DiscoverIntent,
  search: DiscoverSearch,
): DiscoverState {
  if (
    !allowed(role, intent) ||
    !search ||
    typeof search.query !== "string" ||
    !search.filters ||
    typeof search.filters !== "object"
  )
    return state;
  return replaceSearch(state, role, intent, {
    query: search.query.trim().slice(0, MAX_DISCOVER_QUERY),
    filters: normalizeFilters(createDiscoverFilters(), search.filters, intent),
  });
}

/** Clear constraints without changing how the visitor is viewing results. */
export function resetDiscoverFilters(
  current: DiscoverFilters,
): DiscoverFilters {
  return {
    ...createDiscoverFilters(),
    viewMode: current.viewMode,
    showMoreFilters: current.showMoreFilters,
  };
}
