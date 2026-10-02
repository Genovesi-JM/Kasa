import assert from "node:assert/strict";
import { properties } from "../src/data";
import { appRouteUrl, readAppRoute, type AppRoute } from "../src/navigation";
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
      route,
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
  `Application navigation passed: ${roles.length * views.length} role/view routes, every property, all service modes, invalid URLs, query limits, defaults and entry-mode preservation.`,
);
