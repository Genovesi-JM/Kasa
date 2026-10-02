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

export type DiscoverState = Record<"Rent" | "Buy", DiscoverFilters>;
export type DiscoverFilterUpdate =
  DiscoverFilters | ((current: DiscoverFilters) => DiscoverFilters);

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

/** Rent and Buy retain separate searches, including separate price scales. */
export function createInitialDiscoverState(): DiscoverState {
  return { Rent: createDiscoverFilters(), Buy: createDiscoverFilters() };
}

export function updateDiscoverState(
  state: DiscoverState,
  intent: "Rent" | "Buy",
  update: DiscoverFilterUpdate,
): DiscoverState {
  const filters = typeof update === "function" ? update(state[intent]) : update;
  return { ...state, [intent]: filters };
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
