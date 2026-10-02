import { properties, spaceVenues } from "./data";
import type { Role, View } from "./types";

export interface AppRoute {
  role: Role;
  view: View;
  intent: "Rent" | "Buy";
  propertyId: number;
  venueId: number | null;
  spaceId: number | null;
  service: "discover" | "tasks" | "jobs" | "hire";
  query: string;
  returnTo:
    "discover" | "saved" | "portfolio" | "overview" | "insights" | "viewings";
}

const roles: Record<Role, true> = {
  landlord: true,
  tenant: true,
  provider: true,
  spaceOperator: true,
  admin: true,
};

const views: Record<View, true> = {
  overview: true,
  discover: true,
  saved: true,
  property: true,
  portfolio: true,
  applications: true,
  viewings: true,
  messages: true,
  notifications: true,
  profile: true,
  rent: true,
  maintenance: true,
  documents: true,
  services: true,
  spaces: true,
  spaceVenue: true,
  spaceBookings: true,
  spaceOperator: true,
  spaceOnboarding: true,
  spacesPlan: true,
  provider: true,
  admin: true,
  diagnostics: true,
  insights: true,
  plan: true,
};

const intents: Record<AppRoute["intent"], true> = { Rent: true, Buy: true };
const services: Record<AppRoute["service"], true> = {
  discover: true,
  tasks: true,
  jobs: true,
  hire: true,
};
const returnTargets: Record<AppRoute["returnTo"], true> = {
  discover: true,
  saved: true,
  portfolio: true,
  overview: true,
  insights: true,
  viewings: true,
};

function readChoice<T extends string>(
  value: string | null,
  suppliedDefault: T | undefined,
  choices: Record<T, true>,
  fallback: T,
): T {
  if (value !== null && Object.hasOwn(choices, value)) return value as T;
  if (
    suppliedDefault !== undefined &&
    Object.hasOwn(choices, suppliedDefault)
  ) {
    return suppliedDefault;
  }
  return fallback;
}

function normalizeQuery(query: string) {
  return query.trim().slice(0, 200);
}

function positiveId(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function readSpaceId(
  value: string | null,
  suppliedDefault: number | null | undefined,
) {
  if (value === null) return suppliedDefault;
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/** Resolve only canonical catalogue records, never a local listing draft. */
function spaceSelection(
  venueId: number | null | undefined,
  spaceId: number | null | undefined,
) {
  const venue = positiveId(venueId)
    ? spaceVenues.find((item) => item.id === venueId)
    : undefined;
  if (!venue) return null;
  const units = venue.spaces.filter((unit) => positiveId(unit.id));
  const unit = units.find((item) => item.id === spaceId) ?? units[0];
  return unit ? { venueId: venue.id, spaceId: unit.id } : null;
}

/** Keep scoped operational screens inside their authorised workspace. */
export function canonicalRoleView(role: Role, view: View): View {
  if (view === "viewings" && role !== "tenant" && role !== "landlord")
    return "overview";
  if (view === "spaceOnboarding" && role !== "spaceOperator") return "overview";
  return view;
}

function returnTargetForRole(target: AppRoute["returnTo"], role: Role) {
  if (target === "viewings" && canonicalRoleView(role, target) !== target)
    return "discover";
  return target === "insights" && role !== "landlord" ? "discover" : target;
}

export function readAppRoute(
  search: string,
  defaults: Partial<AppRoute> = {},
): AppRoute {
  const params = new URLSearchParams(search);
  const role = readChoice(params.get("role"), defaults.role, roles, "tenant");
  let view = canonicalRoleView(
    role,
    readChoice(params.get("view"), defaults.view, views, "overview"),
  );
  let intent = readChoice(
    params.get("intent"),
    defaults.intent,
    intents,
    "Rent",
  );
  const rawProperty = params.get("property");
  const propertyId =
    rawProperty === null
      ? defaults.propertyId
      : /^\d+$/.test(rawProperty)
        ? Number(rawProperty)
        : undefined;
  const suppliedProperty = Number.isSafeInteger(propertyId)
    ? properties.find((property) => property.id === propertyId)
    : undefined;
  if (view === "property" && suppliedProperty) {
    intent = suppliedProperty.listingType;
  }
  const selectedProperty =
    suppliedProperty ??
    properties.find((property) => property.listingType === intent) ??
    properties[0];
  const selectedSpace =
    view === "spaceVenue"
      ? spaceSelection(
          readSpaceId(params.get("venue"), defaults.venueId),
          readSpaceId(params.get("space"), defaults.spaceId),
        )
      : null;
  if (view === "spaceVenue" && !selectedSpace) view = "spaces";

  return {
    role,
    view,
    intent,
    propertyId: selectedProperty.id,
    venueId: selectedSpace?.venueId ?? null,
    spaceId: selectedSpace?.spaceId ?? null,
    service: readChoice(
      params.get("service"),
      defaults.service,
      services,
      "discover",
    ),
    query: normalizeQuery(params.get("q") ?? defaults.query ?? ""),
    returnTo: returnTargetForRole(
      readChoice(
        params.get("from"),
        defaults.returnTo,
        returnTargets,
        "discover",
      ),
      role,
    ),
  };
}

export function appRouteUrl(route: AppRoute, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  let view = canonicalRoleView(route.role, route.view);
  const selectedSpace =
    view === "spaceVenue" ? spaceSelection(route.venueId, route.spaceId) : null;
  if (view === "spaceVenue" && !selectedSpace) view = "spaces";
  const hasEntryMode = [
    "present",
    "journey",
    "step",
    "finished",
    "app",
    "device",
    "simulator",
  ].some((key) => params.has(key));
  if (!hasEntryMode) params.set("app", "1");
  params.set("role", route.role);
  params.set("view", view);
  params.set("intent", route.intent);

  if (view === "property") {
    params.set("property", String(route.propertyId));
    params.set("from", returnTargetForRole(route.returnTo, route.role));
  } else {
    params.delete("property");
    params.delete("from");
  }
  if (view === "services") params.set("service", route.service);
  else params.delete("service");

  if (selectedSpace) {
    params.set("venue", String(selectedSpace.venueId));
    params.set("space", String(selectedSpace.spaceId));
  } else {
    params.delete("venue");
    params.delete("space");
  }

  const query = normalizeQuery(route.query);
  if (query) params.set("q", query);
  else params.delete("q");
  return `?${params.toString()}`;
}
