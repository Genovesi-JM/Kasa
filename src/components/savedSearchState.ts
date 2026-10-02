import type { DiscoverFilters } from "./discoverState";

export interface SavedSearchInput {
  query: string;
  intent: "Rent" | "Buy";
  filters: DiscoverFilters;
}

export interface SavedSearch extends SavedSearchInput {
  id: string;
  label: string;
  createdAt: string;
}

export interface SavedSearchState {
  records: SavedSearch[];
  nextId: number;
}

export function createInitialSavedSearchState(): SavedSearchState {
  return { records: [], nextId: 1 };
}

export function copySavedSearchFilters(
  filters: DiscoverFilters,
): DiscoverFilters {
  return {
    ...filters,
    features: [...filters.features],
    drawnZone: filters.drawnZone.map((point) => [...point]),
  };
}

function fingerprint(search: SavedSearchInput) {
  const filters = search.filters;
  return JSON.stringify({
    intent: search.intent,
    query: search.query.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    filters: {
      maxPrice: filters.maxPrice,
      minPrice: filters.minPrice,
      viewMode: filters.viewMode,
      verifiedOnly: filters.verifiedOnly,
      propertyType: filters.propertyType,
      bedrooms: filters.bedrooms,
      bathrooms: filters.bathrooms,
      furnishing: filters.furnishing,
      petPolicy: filters.petPolicy,
      minSize: filters.minSize,
      availability: filters.availability,
      features: [...new Set(filters.features)].sort(),
      showMoreFilters: filters.showMoreFilters,
      sort: filters.sort,
      drawnZone: filters.drawnZone,
    },
  });
}

export function findSavedSearch(
  state: SavedSearchState,
  search: SavedSearchInput,
): SavedSearch | undefined {
  const target = fingerprint(search);
  return state.records.find((record) => fingerprint(record) === target);
}

export function saveSearch(
  state: SavedSearchState,
  search: SavedSearchInput,
  now = new Date(),
): SavedSearchState {
  if (findSavedSearch(state, search)) return state;
  const query = search.query.trim();
  const record: SavedSearch = {
    id: `saved-search-${state.nextId}`,
    label:
      `${search.intent === "Rent" ? "Rent" : "Buy"} · ${query || "Barcelona"}`.slice(
        0,
        80,
      ),
    query,
    intent: search.intent,
    filters: copySavedSearchFilters(search.filters),
    createdAt: now.toISOString(),
  };
  return { records: [record, ...state.records], nextId: state.nextId + 1 };
}

export function renameSavedSearch(
  state: SavedSearchState,
  id: string,
  name: string,
): SavedSearchState {
  const label = name.trim().slice(0, 80);
  if (
    !label ||
    !state.records.some((record) => record.id === id && record.label !== label)
  )
    return state;
  return {
    ...state,
    records: state.records.map((record) =>
      record.id === id ? { ...record, label } : record,
    ),
  };
}

export function deleteSavedSearch(
  state: SavedSearchState,
  id: string,
): SavedSearchState {
  if (!state.records.some((record) => record.id === id)) return state;
  return {
    ...state,
    records: state.records.filter((record) => record.id !== id),
  };
}

export function restoreSavedSearch(
  state: SavedSearchState,
  record: SavedSearch,
): SavedSearchState {
  if (
    state.records.some((item) => item.id === record.id) ||
    findSavedSearch(state, record)
  )
    return state;
  return { ...state, records: [record, ...state.records] };
}

export function savedSearchSummary(search: SavedSearchInput): string[] {
  const { filters, intent } = search;
  const euro = (value: string) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  const suffix = intent === "Rent" ? " / month" : "";
  const summary = [intent === "Rent" ? "For rent" : "For sale"];
  if (search.query.trim()) summary.push(`Search: “${search.query.trim()}”`);
  if (filters.minPrice !== "0" && filters.maxPrice !== "Any price")
    summary.push(
      `${euro(filters.minPrice)}–${euro(filters.maxPrice)}${suffix}`,
    );
  else if (filters.maxPrice !== "Any price")
    summary.push(`Up to ${euro(filters.maxPrice)}${suffix}`);
  else if (filters.minPrice !== "0")
    summary.push(`From ${euro(filters.minPrice)}${suffix}`);
  else summary.push("Any price");
  if (filters.propertyType !== "All types") summary.push(filters.propertyType);
  if (filters.bedrooms !== "Any bedrooms")
    summary.push(`${filters.bedrooms}+ bedrooms`);
  if (filters.bathrooms !== "Any bathrooms")
    summary.push(`${filters.bathrooms}+ bathrooms`);
  if (filters.furnishing !== "Any furnishing") summary.push(filters.furnishing);
  if (filters.petPolicy !== "Any pet policy") summary.push(filters.petPolicy);
  if (filters.minSize !== "0") summary.push(`At least ${filters.minSize} m²`);
  if (filters.availability !== "Any availability")
    summary.push(filters.availability);
  if (filters.verifiedOnly) summary.push("Checked listings only");
  summary.push(...filters.features);
  if (filters.drawnZone.length)
    summary.push(
      filters.drawnZone.length >= 3
        ? `Drawn map area (${filters.drawnZone.length} points)`
        : `Map outline in progress (${filters.drawnZone.length} points)`,
    );
  summary.push(
    `Sort: ${filters.sort}`,
    filters.viewMode === "map" ? "Map view" : "List view",
  );
  return summary;
}
