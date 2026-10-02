import type { Role } from "../types";
import type { ZonePoint } from "./mapGeometry";

export type SpacesDiscoveryCategory = "All" | "Sports" | "Events";
export type SpacesDiscoverySort =
  "Recommended" | "Nearest" | "Price: low to high" | "Highest rated";
export interface SpacesDiscoveryFilters {
  category: SpacesDiscoveryCategory;
  query: string;
  sort: SpacesDiscoverySort;
  savedOnly: boolean;
  mapView: boolean;
  activity: string;
  availableToday: boolean;
  bookingMode: string;
  capacity: string;
  spaceMaxPrice: string;
  spaceAmenities: string[];
  drawnZone: ZonePoint[];
}
export type SpacesDiscoveryState = Record<Role, SpacesDiscoveryFilters>;
export type SpacesDiscoveryUpdate =
  | Partial<SpacesDiscoveryFilters>
  | ((current: SpacesDiscoveryFilters) => Partial<SpacesDiscoveryFilters>);
export const MAX_SPACES_DISCOVERY_QUERY = 200;
export const MAX_SPACES_DISCOVERY_ZONE_POINTS = 256;

const roles: readonly Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const categories: readonly SpacesDiscoveryCategory[] = [
  "All",
  "Sports",
  "Events",
];
const sorts: readonly SpacesDiscoverySort[] = [
  "Recommended",
  "Nearest",
  "Price: low to high",
  "Highest rated",
];
const sportsActivities = ["Padel", "Football", "Tennis", "Basketball"];
const eventActivities = [
  "Celebration",
  "Workshop",
  "Community event",
  "Reception",
];
const sportsAmenities = [
  "Lighting",
  "Changing rooms",
  "Parking",
  "Equipment rental",
  "Accessible entry",
];
const eventAmenities = [
  "Kitchen",
  "Catering allowed",
  "Parking",
  "Sound system",
  "Accessible entry",
];
const sportsPrices = ["30", "60", "100"];
const eventPrices = ["500", "800", "1200"];
const bookingModes = ["Any booking mode", "Instant Book", "Request to Book"];
const capacities = ["Any capacity", "4", "10", "50", "100"];

function categoryOptions(
  category: SpacesDiscoveryCategory,
  sports: string[],
  events: string[],
): string[] {
  return category === "Sports"
    ? [...sports]
    : category === "Events"
      ? [...events]
      : [...new Set([...sports, ...events])];
}
/** The returned option arrays are independent so UI callers cannot mutate the catalogue. */
export function spacesDiscoveryActivityOptions(
  category: SpacesDiscoveryCategory,
): string[] {
  return categoryOptions(category, sportsActivities, eventActivities);
}
export function spacesDiscoveryAmenityOptions(
  category: SpacesDiscoveryCategory,
): string[] {
  return categoryOptions(category, sportsAmenities, eventAmenities);
}
export function spacesDiscoveryPriceOptions(
  category: SpacesDiscoveryCategory,
): string[] {
  return categoryOptions(category, sportsPrices, eventPrices);
}
function defaults(): SpacesDiscoveryFilters {
  return {
    category: "Sports",
    query: "",
    sort: "Recommended",
    savedOnly: false,
    mapView: false,
    activity: "Any activity",
    availableToday: false,
    bookingMode: "Any booking mode",
    capacity: "Any capacity",
    spaceMaxPrice: "Any price",
    spaceAmenities: [],
    drawnZone: [],
  };
}
function clone(filters: SpacesDiscoveryFilters): SpacesDiscoveryFilters {
  return {
    ...filters,
    spaceAmenities: [...filters.spaceAmenities],
    drawnZone: filters.drawnZone.map(([lat, lng]) => [lat, lng]),
  };
}
export function createInitialSpacesDiscoveryState(): SpacesDiscoveryState {
  return {
    tenant: defaults(),
    landlord: defaults(),
    provider: defaults(),
    spaceOperator: defaults(),
    admin: defaults(),
  };
}
/** Returning a copy protects retained arrays from mutations in view code or update callbacks. */
export function spacesDiscoveryFilters(
  state: SpacesDiscoveryState,
  role: Role,
): SpacesDiscoveryFilters {
  return roles.includes(role) && state[role] ? clone(state[role]) : defaults();
}
function sameFilters(
  left: SpacesDiscoveryFilters,
  right: SpacesDiscoveryFilters,
): boolean {
  return Object.keys(left).every((key) => {
    if (key === "spaceAmenities")
      return (
        left.spaceAmenities.length === right.spaceAmenities.length &&
        left.spaceAmenities.every(
          (value, index) => value === right.spaceAmenities[index],
        )
      );
    if (key === "drawnZone")
      return (
        left.drawnZone.length === right.drawnZone.length &&
        left.drawnZone.every(
          ([lat, lng], index) =>
            lat === right.drawnZone[index][0] &&
            lng === right.drawnZone[index][1],
        )
      );
    return (
      left[key as keyof SpacesDiscoveryFilters] ===
      right[key as keyof SpacesDiscoveryFilters]
    );
  });
}
function isZone(value: unknown): value is ZonePoint[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SPACES_DISCOVERY_ZONE_POINTS &&
    value.every(
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

export function updateSpacesDiscovery(
  state: SpacesDiscoveryState,
  role: Role,
  update: SpacesDiscoveryUpdate,
): SpacesDiscoveryState {
  if (!roles.includes(role)) return state;
  const current = spacesDiscoveryFilters(state, role);
  const patch = typeof update === "function" ? update(clone(current)) : update;
  if (!patch || typeof patch !== "object") return state;
  const next = clone(current);
  if (categories.includes(patch.category as SpacesDiscoveryCategory))
    next.category = patch.category!;
  if (typeof patch.query === "string")
    next.query = patch.query.slice(0, MAX_SPACES_DISCOVERY_QUERY);
  if (sorts.includes(patch.sort as SpacesDiscoverySort))
    next.sort = patch.sort!;
  for (const field of ["savedOnly", "mapView", "availableToday"] as const) {
    if (typeof patch[field] === "boolean") next[field] = patch[field];
  }
  if (
    typeof patch.bookingMode === "string" &&
    bookingModes.includes(patch.bookingMode)
  )
    next.bookingMode = patch.bookingMode;
  if (typeof patch.capacity === "string" && capacities.includes(patch.capacity))
    next.capacity = patch.capacity;
  const activities = spacesDiscoveryActivityOptions(next.category);
  const amenities = spacesDiscoveryAmenityOptions(next.category);
  const prices = spacesDiscoveryPriceOptions(next.category);
  if (
    patch.activity === "Any activity" ||
    activities.includes(patch.activity ?? "")
  )
    next.activity = patch.activity!;
  if (
    patch.spaceMaxPrice === "Any price" ||
    prices.includes(patch.spaceMaxPrice ?? "")
  )
    next.spaceMaxPrice = patch.spaceMaxPrice!;
  if (Array.isArray(patch.spaceAmenities))
    next.spaceAmenities = [
      ...new Set(
        patch.spaceAmenities.filter(
          (value) => typeof value === "string" && amenities.includes(value),
        ),
      ),
    ];
  // Category changes cannot leave a selected value absent from the rendered controls.
  if (next.activity !== "Any activity" && !activities.includes(next.activity))
    next.activity = "Any activity";
  if (
    next.spaceMaxPrice !== "Any price" &&
    !prices.includes(next.spaceMaxPrice)
  )
    next.spaceMaxPrice = "Any price";
  next.spaceAmenities = next.spaceAmenities.filter((value) =>
    amenities.includes(value),
  );
  // One- and two-point outlines are retained while the visitor draws; malformed geometry is rejected intact.
  if (patch.drawnZone !== undefined && isZone(patch.drawnZone))
    next.drawnZone = patch.drawnZone.map(([lat, lng]) => [lat, lng]);
  return sameFilters(current, next) ? state : { ...state, [role]: next };
}

/** Clear constraints while retaining the chosen query, category and list/map layout. */
export function resetSpacesDiscoveryFilters(
  state: SpacesDiscoveryState,
  role: Role,
): SpacesDiscoveryState {
  if (!roles.includes(role)) return state;
  const current = spacesDiscoveryFilters(state, role);
  return updateSpacesDiscovery(state, role, {
    ...defaults(),
    category: current.category,
    query: current.query,
    mapView: current.mapView,
  });
}
/** An explicit new search starts across both space categories, even when its query repeats. */
export function startSpacesDiscoverySearch(
  state: SpacesDiscoveryState,
  role: Role,
  query: string,
): SpacesDiscoveryState {
  if (!roles.includes(role) || typeof query !== "string") return state;
  const current = spacesDiscoveryFilters(state, role);
  return updateSpacesDiscovery(state, role, {
    ...defaults(),
    category: "All",
    query,
    mapView: current.mapView,
  });
}
