import type { AppRoute } from "../navigation";
import type { Role } from "../types";
import {
  applyDiscoverSearch,
  createInitialDiscoverState,
  discoverSearch,
  MAX_DISCOVER_QUERY,
  MAX_DISCOVER_ZONE_POINTS,
  type DiscoverFilters,
  type DiscoverIntent,
  type DiscoverSearch,
} from "./discoverState";

/** Contains browsing controls only; no workspace records or local files. */
export interface DiscoverHistoryState {
  tag: "kasa:discover";
  version: 1;
  role: Role;
  intent: DiscoverIntent;
  query: string;
  filters: DiscoverFilters;
}

const roles: readonly Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const stringFields = [
  "maxPrice",
  "minPrice",
  "viewMode",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "furnishing",
  "petPolicy",
  "minSize",
  "availability",
  "sort",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeQuery(value: string) {
  return value.trim().slice(0, MAX_DISCOVER_QUERY);
}

function eligible(route: AppRoute) {
  return (
    (route.view === "discover" || route.view === "property") &&
    roles.includes(route.role) &&
    (route.intent === "Rent" || route.intent === "Buy") &&
    typeof route.query === "string"
  );
}

/** Reject incomplete/nonserializable shapes before applying domain option rules. */
function validFilters(value: unknown): value is DiscoverFilters {
  if (!record(value)) return false;
  if (
    !stringFields.every(
      (field) =>
        Object.hasOwn(value, field) &&
        typeof value[field] === "string" &&
        value[field].length <= MAX_DISCOVER_QUERY,
    ) ||
    !Object.hasOwn(value, "verifiedOnly") ||
    typeof value.verifiedOnly !== "boolean" ||
    !Object.hasOwn(value, "showMoreFilters") ||
    typeof value.showMoreFilters !== "boolean"
  )
    return false;
  if (
    !Object.hasOwn(value, "features") ||
    !Array.isArray(value.features) ||
    value.features.length > 64 ||
    !Array.from(value.features).every(
      (feature: unknown) =>
        typeof feature === "string" && feature.length <= MAX_DISCOVER_QUERY,
    )
  )
    return false;
  return (
    Object.hasOwn(value, "drawnZone") &&
    Array.isArray(value.drawnZone) &&
    value.drawnZone.length <= MAX_DISCOVER_ZONE_POINTS &&
    Array.from(value.drawnZone).every(
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

/** A matching URL is required before a history entry can restore its filters. */
export function readDiscoverHistory(
  history: unknown,
  route: AppRoute,
): DiscoverSearch | null {
  if (
    !eligible(route) ||
    !record(history) ||
    !["tag", "version", "role", "intent", "query", "filters"].every((key) =>
      Object.hasOwn(history, key),
    ) ||
    history.tag !== "kasa:discover" ||
    history.version !== 1 ||
    history.role !== route.role ||
    history.intent !== route.intent ||
    typeof history.query !== "string" ||
    normalizeQuery(history.query) !== normalizeQuery(route.query) ||
    !validFilters(history.filters)
  )
    return null;
  const normalized = applyDiscoverSearch(
    createInitialDiscoverState(),
    route.role,
    route.intent,
    { query: history.query, filters: history.filters },
  );
  return discoverSearch(normalized, route.role, route.intent);
}

/** Snapshot the current search without retaining caller-owned nested arrays. */
export function createDiscoverHistory(
  route: AppRoute,
  search: DiscoverSearch,
): DiscoverHistoryState | null {
  if (!record(search)) return null;
  const normalized = readDiscoverHistory(
    {
      tag: "kasa:discover",
      version: 1,
      role: route.role,
      intent: route.intent,
      query: search.query,
      filters: search.filters,
    },
    route,
  );
  return normalized
    ? {
        tag: "kasa:discover",
        version: 1,
        role: route.role,
        intent: route.intent,
        ...normalized,
      }
    : null;
}
