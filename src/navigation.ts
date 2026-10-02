import { properties } from "./data";
import type { Role, View } from "./types";

export interface AppRoute {
  role: Role;
  view: View;
  intent: "Rent" | "Buy";
  propertyId: number;
  service: "discover" | "tasks" | "jobs" | "hire";
  query: string;
  returnTo: "discover" | "saved" | "portfolio" | "overview" | "insights";
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

function returnTargetForRole(target: AppRoute["returnTo"], role: Role) {
  return target === "insights" && role !== "landlord" ? "discover" : target;
}

export function readAppRoute(
  search: string,
  defaults: Partial<AppRoute> = {},
): AppRoute {
  const params = new URLSearchParams(search);
  const role = readChoice(params.get("role"), defaults.role, roles, "tenant");
  const view = readChoice(params.get("view"), defaults.view, views, "overview");
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

  return {
    role,
    view,
    intent,
    propertyId: selectedProperty.id,
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
  params.set("view", route.view);
  params.set("intent", route.intent);

  if (route.view === "property") {
    params.set("property", String(route.propertyId));
    params.set("from", returnTargetForRole(route.returnTo, route.role));
  } else {
    params.delete("property");
    params.delete("from");
  }
  if (route.view === "services") params.set("service", route.service);
  else params.delete("service");

  const query = normalizeQuery(route.query);
  if (query) params.set("q", query);
  else params.delete("q");
  return `?${params.toString()}`;
}
