import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  appRouteUrl,
  canonicalRoleView,
  readAppRoute,
  type AppRoute,
} from "../src/navigation";
import type { Role, View } from "../src/types";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const views: View[] = [
  "overview",
  "discover",
  "saved",
  "property",
  "portfolio",
  "applications",
  "viewings",
  "messages",
  "notifications",
  "profile",
  "rent",
  "maintenance",
  "documents",
  "services",
  "spaces",
  "spaceVenue",
  "spaceBookings",
  "spaceOperator",
  "spaceOnboarding",
  "spacesPlan",
  "provider",
  "admin",
  "diagnostics",
  "insights",
  "plan",
];
const initial = readAppRoute("");
const firstRental = properties.find(
  (property) => property.listingType === "Rent",
)!;
const firstSale = properties.find(
  (property) => property.listingType === "Buy",
)!;
assert.deepEqual(initial, {
  role: "tenant",
  view: "overview",
  intent: "Rent",
  propertyId: firstRental.id,
  service: "discover",
  query: "",
  returnTo: "discover",
});

for (const role of roles) {
  for (const view of views) {
    const route: AppRoute = { ...initial, role, view, query: "Gràcia & lift" };
    const url = appRouteUrl(route, "");
    assert.deepEqual(
      readAppRoute(url),
      {
        ...route,
        view:
          view === "viewings" && role !== "tenant" && role !== "landlord"
            ? "overview"
            : view === "spaceOnboarding" && role !== "spaceOperator"
              ? "overview"
              : view,
      },
      `${role}/${view} must round-trip`,
    );
    assert.ok(url.startsWith("?") && !url.startsWith("?/"));
    const resolved = new URL(url, "https://example.com/Kasa/");
    assert.equal(
      resolved.pathname,
      "/Kasa/",
      "Navigation must preserve GitHub Pages base paths",
    );
    assert.equal(resolved.origin, "https://example.com");
    assert.equal(resolved.searchParams.get("app"), "1");
  }
}

for (const role of roles) {
  const expected = role === "spaceOperator" ? "spaceOnboarding" : "overview";
  assert.equal(canonicalRoleView(role, "spaceOnboarding"), expected);
  assert.equal(
    readAppRoute(`?role=${role}&view=spaceOnboarding`).view,
    expected,
  );
  assert.equal(
    readAppRoute(`?role=${role}`, { view: "spaceOnboarding" }).view,
    expected,
  );
  const serialized = new URLSearchParams(
    appRouteUrl(
      { ...initial, role, view: "spaceOnboarding" },
      "?app=1&campaign=phone&service=hire&property=1&from=viewings",
    ),
  );
  assert.equal(serialized.get("view"), expected);
  assert.equal(
    serialized.get("role"),
    role,
    "Direct venue setup never changes identity",
  );
  assert.equal(serialized.get("campaign"), "phone");
  for (const key of ["service", "property", "from"])
    assert.equal(serialized.has(key), false);
}

for (const property of properties) {
  const route = readAppRoute(
    `?view=property&property=${property.id}&intent=${property.listingType === "Buy" ? "Rent" : "Buy"}&from=saved`,
  );
  assert.equal(route.propertyId, property.id);
  assert.equal(
    route.intent,
    property.listingType,
    "A detail link uses its listing's intent",
  );
  assert.equal(route.returnTo, "saved");
  assert.deepEqual(readAppRoute(appRouteUrl(route, "")), route);
}
for (const returnTo of [
  "portfolio",
  "overview",
  "insights",
  "viewings",
] as const) {
  const route = readAppRoute(
    `?role=landlord&view=property&property=1&from=${returnTo}`,
  );
  assert.equal(route.returnTo, returnTo);
  const restored = readAppRoute(appRouteUrl(route, ""));
  assert.equal(restored.returnTo, returnTo);
  assert.equal(
    new URL(appRouteUrl(route, ""), "https://example.com/Kasa/").pathname,
    "/Kasa/",
  );
}
for (const role of ["tenant", "landlord"] as const) {
  assert.equal(canonicalRoleView(role, "viewings"), "viewings");
  const route = readAppRoute(
    `?role=${role}&view=property&property=1&from=viewings`,
  );
  assert.equal(route.returnTo, "viewings");
  assert.deepEqual(readAppRoute(appRouteUrl(route, "")), route);
  const defaults = readAppRoute("", {
    role,
    view: "viewings",
    returnTo: "viewings",
  });
  assert.equal(defaults.view, "viewings");
  assert.equal(defaults.returnTo, "viewings");
}
for (const role of ["provider", "spaceOperator", "admin"] as const) {
  assert.equal(canonicalRoleView(role, "viewings"), "overview");
  assert.equal(
    readAppRoute(`?role=${role}&view=viewings`).view,
    "overview",
    `${role} cannot open the property-party viewing inbox`,
  );
  assert.equal(
    readAppRoute(`?role=${role}&view=property&from=viewings`).returnTo,
    "discover",
  );
  const defaultRoute = readAppRoute(`?role=${role}`, {
    role: "tenant",
    view: "viewings",
    returnTo: "viewings",
  });
  assert.equal(defaultRoute.view, "overview");
  assert.equal(defaultRoute.returnTo, "discover");
  const serialized = new URLSearchParams(
    appRouteUrl(
      { ...initial, role, view: "viewings", returnTo: "viewings" },
      "?property=1&from=viewings&service=hire&campaign=phone",
    ),
  );
  assert.equal(serialized.get("view"), "overview");
  for (const key of ["property", "from", "service"])
    assert.equal(serialized.has(key), false);
  assert.equal(serialized.get("campaign"), "phone");
  assert.equal(
    new URLSearchParams(
      appRouteUrl(
        { ...initial, role, view: "property", returnTo: "viewings" },
        "",
      ),
    ).get("from"),
    "discover",
  );
}
for (const malformed of ["Viewings", "viewings/", " viewings", "viewings "]) {
  const route = readAppRoute(
    `?role=tenant&view=${encodeURIComponent(malformed)}&from=${encodeURIComponent(malformed)}`,
  );
  assert.equal(route.view, "overview");
  assert.equal(route.returnTo, "discover");
}
for (const role of roles.filter((role) => role !== "landlord")) {
  assert.equal(
    readAppRoute(`?role=${role}&view=property&property=1&from=insights`)
      .returnTo,
    "discover",
    `${role} must not receive a return link to the owner-only Insights workspace`,
  );
  assert.equal(
    readAppRoute(`?role=${role}&view=property`, {
      role: "landlord",
      returnTo: "insights",
    }).returnTo,
    "discover",
    "Changing workspace also scopes a supplied Insights return default",
  );
  const url = appRouteUrl(
    { ...initial, role, view: "property", returnTo: "insights" },
    "",
  );
  assert.equal(new URLSearchParams(url).get("from"), "discover");
}
assert.equal(
  readAppRoute("?view=property", {
    role: "landlord",
    returnTo: "insights",
  }).returnTo,
  "insights",
);
for (const from of [
  "Insights",
  "insights/",
  " insights",
  "https://example.com/insights",
  "__proto__",
])
  assert.equal(
    readAppRoute(
      `?role=landlord&view=property&from=${encodeURIComponent(from)}`,
    ).returnTo,
    "discover",
    `Malformed return target ${from} falls back safely`,
  );
assert.equal(
  readAppRoute(`?view=discover&property=${firstSale.id}&intent=Rent`).intent,
  "Rent",
);

for (const invalidProperty of [
  "",
  "unknown",
  "NaN",
  "Infinity",
  "1.2",
  "-1",
  "9999",
  "1e0",
  "0x1",
  "9007199254740993",
]) {
  const route = readAppRoute(
    `?view=property&intent=Buy&property=${encodeURIComponent(invalidProperty)}`,
    { propertyId: firstRental.id },
  );
  assert.equal(
    route.propertyId,
    firstSale.id,
    `Invalid property ${invalidProperty} falls back by intent`,
  );
  assert.equal(route.intent, "Buy");
}
for (const invalidValue of [
  "",
  "bogus",
  "__proto__",
  "constructor",
  "toString",
]) {
  const route = readAppRoute(
    `?role=${invalidValue}&view=${invalidValue}&intent=${invalidValue}&service=${invalidValue}&from=${invalidValue}`,
  );
  assert.deepEqual(
    route,
    initial,
    "Unknown enum values, including prototype keys, are rejected",
  );
}

const defaults: Partial<AppRoute> = {
  role: "provider",
  view: "services",
  intent: "Buy",
  service: "jobs",
  query: "  electrician  ",
  returnTo: "saved",
};
assert.deepEqual(readAppRoute("", defaults), {
  ...defaults,
  propertyId: firstSale.id,
  query: "electrician",
});
assert.equal(
  readAppRoute("?role=bad&view=bad&service=bad", defaults).service,
  "jobs",
);
assert.equal(
  readAppRoute("?q=", defaults).query,
  "",
  "An explicit empty search clears defaults",
);
assert.equal(
  readAppRoute(`?q=${encodeURIComponent(`  ${"x".repeat(230)}  `)}`).query
    .length,
  200,
);
assert.equal(
  readAppRoute("?q=%20Gr%C3%A0cia%20%26%20lift%20").query,
  "Gràcia & lift",
);
assert.equal(
  readAppRoute("?view=property", { propertyId: firstSale.id }).intent,
  "Buy",
);

for (const service of ["discover", "tasks", "jobs", "hire"] as const) {
  const route: AppRoute = { ...initial, view: "services", service };
  assert.deepEqual(readAppRoute(appRouteUrl(route, "")), route);
}

for (const original of [
  "?present=1&journey=my-home&step=3&finished=1",
  "?device=ios&present=1",
  "?device=android&simulator=1",
  "?simulator=1",
  "?app=0",
]) {
  const before = new URLSearchParams(original);
  const after = new URLSearchParams(
    appRouteUrl({ ...initial, view: "messages" }, original),
  );
  for (const [key, value] of before) assert.equal(after.get(key), value);
  if (!before.has("app"))
    assert.equal(
      after.has("app"),
      false,
      "Existing entry modes must not become app-only links",
    );
}

const cleaned = new URLSearchParams(
  appRouteUrl(
    initial,
    "?property=6&from=saved&service=hire&q=old&campaign=phone&tag=one&tag=two",
  ),
);
for (const key of ["property", "from", "service", "q"])
  assert.equal(cleaned.has(key), false);
assert.equal(cleaned.get("campaign"), "phone");
assert.deepEqual(
  cleaned.getAll("tag"),
  ["one", "two"],
  "Unrelated repeated query parameters survive",
);
assert.equal(
  new URLSearchParams(
    appRouteUrl({ ...initial, query: `  ${"a".repeat(250)} ` }, ""),
  ).get("q")?.length,
  200,
);

console.log(
  `Application navigation passed: ${roles.length * views.length} role/view routes, scoped venue setup and viewing inbox/return, every property, owner-scoped Insights return, all service modes, invalid URLs, query limits, defaults and entry-mode preservation.`,
);
