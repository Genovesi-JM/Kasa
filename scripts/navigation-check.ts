import assert from "node:assert/strict";
import { properties, spaceVenues } from "../src/data";
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
  "expenses",
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
  venueId: null,
  spaceId: null,
  service: "discover",
  query: "",
  returnTo: "discover",
});

for (const role of roles) {
  for (const view of views) {
    const route: AppRoute = {
      ...initial,
      role,
      view,
      query: "Gràcia & lift",
      venueId: view === "spaceVenue" ? spaceVenues[0].id : null,
      spaceId: view === "spaceVenue" ? spaceVenues[0].spaces[0].id : null,
    };
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
              : view === "expenses" && role !== "landlord"
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

for (const role of roles) {
  const expected = role === "landlord" ? "expenses" : "overview";
  assert.equal(canonicalRoleView(role, "expenses"), expected);
  assert.equal(readAppRoute(`?role=${role}&view=expenses`).view, expected);
  assert.equal(
    readAppRoute(`?role=${role}`, { view: "expenses" }).view,
    expected,
  );
  assert.equal(
    readAppRoute(`?role=${role}&view=expenses`, {
      role: "landlord",
      view: "expenses",
    }).role,
    role,
    "Opening expense records cannot silently change workspaces",
  );
  const serialized: URLSearchParams = new URLSearchParams(
    appRouteUrl(
      { ...initial, role, view: "expenses" },
      "?app=1&campaign=phone&service=hire&property=1&from=insights&venue=1&space=11",
    ),
  );
  assert.equal(serialized.get("view"), expected);
  assert.equal(serialized.get("role"), role);
  assert.equal(serialized.get("campaign"), "phone");
  for (const key of ["service", "property", "from", "venue", "space"])
    assert.equal(serialized.has(key), false);
  assert.equal(readAppRoute(`?${serialized}`).view, expected);
}
assert.equal(readAppRoute("?role=unknown&view=expenses").view, "overview");

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
    readAppRoute(`?role=${role}&view=property&property=1&from=viewings`)
      .returnTo,
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
    readAppRoute(`?role=${role}&view=property&property=1`, {
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
    propertyId: firstRental.id,
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
      `?role=landlord&view=property&property=1&from=${encodeURIComponent(from)}`,
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
  "0",
  "unknown",
  "NaN",
  "Infinity",
  "1.2",
  "1.0",
  "-1",
  "+1",
  "01",
  " 1",
  "1 ",
  "9999",
  "1e0",
  "0x1",
  "9007199254740993",
  "property-draft-1",
]) {
  const route = readAppRoute(
    `?view=property&intent=Buy&property=${encodeURIComponent(invalidProperty)}`,
    { propertyId: firstRental.id },
  );
  assert.equal(
    route.propertyId,
    firstSale.id,
    `Invalid property ${invalidProperty} retains a safe browse selection by intent`,
  );
  assert.equal(
    route.view,
    "discover",
    "An invalid link cannot display the fallback property's detail",
  );
  assert.equal(route.intent, "Buy");
  const serialized = new URLSearchParams(
    appRouteUrl(
      route,
      "?property=bad&from=saved&venue=1&space=11&campaign=phone",
    ),
  );
  assert.equal(serialized.get("view"), "discover");
  assert.equal(serialized.get("intent"), "Buy");
  assert.equal(serialized.get("campaign"), "phone");
  for (const key of ["property", "from", "venue", "space"])
    assert.equal(serialized.has(key), false);
}

for (const role of roles) {
  for (const intent of ["Rent", "Buy"] as const) {
    for (const legacy of ["", "&propertyId=1", "&property=+1"]) {
      const route = readAppRoute(
        `?role=${role}&view=property&intent=${intent}&q=terrace${legacy}`,
      );
      assert.equal(route.view, "discover");
      assert.equal(route.role, role);
      assert.equal(route.intent, intent);
      assert.equal(route.query, "terrace");
    }
    assert.equal(
      readAppRoute("", { role, intent, view: "property" }).view,
      "discover",
    );
  }
}
for (const propertyId of [
  undefined,
  null,
  0,
  -1,
  1.1,
  NaN,
  Infinity,
  99999,
  Number.MAX_SAFE_INTEGER + 1,
]) {
  const defaultsRoute = readAppRoute("?view=property&intent=Buy", {
    propertyId: propertyId as number,
  });
  assert.equal(defaultsRoute.view, "discover");
  const serialized = new URLSearchParams(
    appRouteUrl(
      {
        ...initial,
        view: "property",
        propertyId: propertyId as number,
        intent: "Buy",
        query: "terrace",
      },
      "?property=1&from=saved&campaign=phone",
    ),
  );
  assert.equal(serialized.get("view"), "discover");
  assert.equal(serialized.get("intent"), "Buy");
  assert.equal(serialized.get("q"), "terrace");
  assert.equal(serialized.get("campaign"), "phone");
  assert.equal(serialized.has("property"), false);
  assert.equal(serialized.has("from"), false);
}
for (const role of roles) {
  for (const property of properties) {
    for (const returnTo of [
      "discover",
      "saved",
      "portfolio",
      "overview",
      "insights",
      "viewings",
    ] as const) {
      const expectedReturn =
        (returnTo === "insights" && role !== "landlord") ||
        (returnTo === "viewings" && role !== "tenant" && role !== "landlord")
          ? "discover"
          : returnTo;
      const route = readAppRoute("", {
        role,
        view: "property",
        propertyId: property.id,
        returnTo,
      });
      assert.equal(route.view, "property");
      assert.equal(route.propertyId, property.id);
      assert.equal(route.intent, property.listingType);
      assert.equal(route.returnTo, expectedReturn);
      const url = appRouteUrl(
        { ...route, intent: property.listingType === "Rent" ? "Buy" : "Rent" },
        "?app=1&campaign=phone&tag=one&tag=two",
      );
      const resolved = new URL(url, "https://example.com/Kasa/");
      assert.equal(resolved.pathname, "/Kasa/");
      assert.equal(
        resolved.searchParams.get("intent"),
        property.listingType,
        "Serialization derives intent from the actual listing",
      );
      assert.equal(resolved.searchParams.get("from"), expectedReturn);
      assert.equal(resolved.searchParams.get("campaign"), "phone");
      assert.deepEqual(resolved.searchParams.getAll("tag"), ["one", "two"]);
      assert.deepEqual(readAppRoute(url), route);
    }
  }
}
assert.equal(
  readAppRoute(`?view=property&property=${firstSale.id}`, {
    propertyId: firstRental.id,
  }).propertyId,
  firstSale.id,
  "An explicit valid URL takes precedence over defaults",
);
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
  venueId: null,
  spaceId: null,
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
    "?property=6&from=saved&service=hire&venue=1&space=11&q=old&campaign=phone&tag=one&tag=two",
  ),
);
for (const key of ["property", "from", "service", "venue", "space", "q"])
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

// Venue links are public catalogue references, independent of customer requests.
for (const role of roles) {
  for (const venue of spaceVenues) {
    for (const unit of venue.spaces) {
      const route = readAppRoute(
        `?role=${role}&view=spaceVenue&venue=${venue.id}&space=${unit.id}&q=party`,
      );
      assert.equal(route.view, "spaceVenue");
      assert.equal(route.venueId, venue.id);
      assert.equal(route.spaceId, unit.id);
      assert.equal(route.role, role, "Opening a venue never changes workspace");
      const serialized = appRouteUrl(
        route,
        "?campaign=phone&tag=one&tag=two&property=4&from=saved&service=hire",
      );
      assert.deepEqual(readAppRoute(serialized), route);
      const resolved = new URL(
        serialized,
        "https://example.com/Kasa/?view=overview",
      );
      assert.equal(resolved.pathname, "/Kasa/");
      assert.equal(resolved.origin, "https://example.com");
      assert.equal(resolved.searchParams.get("venue"), String(venue.id));
      assert.equal(resolved.searchParams.get("space"), String(unit.id));
      assert.equal(resolved.searchParams.get("q"), "party");
      assert.equal(resolved.searchParams.get("campaign"), "phone");
      assert.deepEqual(resolved.searchParams.getAll("tag"), ["one", "two"]);
      for (const key of ["property", "from", "service"])
        assert.equal(resolved.searchParams.has(key), false);
    }
  }
}

for (const venue of spaceVenues) {
  const firstUnit = venue.spaces[0];
  const defaultUnit = venue.spaces.at(-1)!;
  const withoutUnit = readAppRoute(`?view=spaceVenue&venue=${venue.id}`);
  assert.equal(withoutUnit.spaceId, firstUnit.id);
  assert.equal(withoutUnit.venueId, venue.id);
  for (const invalidUnit of [
    "",
    "0",
    "-1",
    "1.2",
    "1e1",
    "+11",
    "011",
    `0${defaultUnit.id}`,
    " 11",
    "11 ",
    "0xB",
    "99999",
    "NaN",
    "Infinity",
    "9007199254740993",
    "__proto__",
    "space-draft-1-unit-1",
  ]) {
    const route = readAppRoute(
      `?view=spaceVenue&venue=${venue.id}&space=${encodeURIComponent(invalidUnit)}`,
      { spaceId: defaultUnit.id },
    );
    assert.equal(route.view, "spaceVenue");
    assert.equal(
      route.spaceId,
      firstUnit.id,
      `Invalid unit ${invalidUnit} falls back within its venue, not to a supplied default`,
    );
  }
  const foreignUnit = spaceVenues.find((item) => item.id !== venue.id)!
    .spaces[0];
  assert.equal(
    readAppRoute(`?view=spaceVenue&venue=${venue.id}&space=${foreignUnit.id}`)
      .spaceId,
    firstUnit.id,
  );
  const canonicalized = readAppRoute(
    appRouteUrl(
      {
        ...initial,
        view: "spaceVenue",
        venueId: venue.id,
        spaceId: foreignUnit.id,
      },
      "",
    ),
  );
  assert.equal(
    canonicalized.spaceId,
    firstUnit.id,
    "Serialization also prevents a cross-venue unit",
  );
  assert.equal(
    readAppRoute("", {
      view: "spaceVenue",
      venueId: venue.id,
      spaceId: defaultUnit.id,
    }).spaceId,
    defaultUnit.id,
  );
  assert.equal(
    readAppRoute(`?view=spaceVenue&venue=${venue.id}`, {
      spaceId: defaultUnit.id,
    }).spaceId,
    defaultUnit.id,
  );
  assert.equal(
    readAppRoute(
      appRouteUrl(
        { ...initial, view: "spaceVenue", venueId: venue.id, spaceId: null },
        "",
      ),
    ).spaceId,
    firstUnit.id,
  );
}

for (const invalidVenue of [
  "",
  "0",
  "-1",
  "1.2",
  "1.0",
  "1e0",
  "+1",
  "01",
  " 1",
  "1 ",
  "0x1",
  "99999",
  "NaN",
  "Infinity",
  "9007199254740993",
  "__proto__",
  "space-draft-1",
]) {
  const route = readAppRoute(
    `?role=landlord&view=spaceVenue&venue=${encodeURIComponent(invalidVenue)}&space=11&q=hall`,
    { venueId: spaceVenues[0].id, spaceId: spaceVenues[0].spaces[0].id },
  );
  assert.equal(
    route.view,
    "spaces",
    `Invalid venue ${invalidVenue} returns to browse`,
  );
  assert.equal(route.venueId, null);
  assert.equal(route.spaceId, null);
  assert.equal(route.query, "hall");
  assert.equal(route.role, "landlord");
  const canonical = new URLSearchParams(
    appRouteUrl(route, "?venue=bad&space=11&campaign=phone"),
  );
  assert.equal(canonical.get("view"), "spaces");
  assert.equal(canonical.has("venue"), false);
  assert.equal(canonical.has("space"), false);
  assert.equal(canonical.get("campaign"), "phone");
}
for (const legacy of [
  "?view=spaceVenue",
  "?view=spaceVenue&space=11",
  "?view=spaceVenue&venueId=1",
  "?view=spaceVenue&venue=+1",
]) {
  const route = readAppRoute(legacy);
  assert.equal(route.view, "spaces");
  assert.equal(route.venueId, null);
  assert.equal(route.spaceId, null);
}
for (const venueId of [
  null,
  undefined,
  0,
  -1,
  1.1,
  NaN,
  Infinity,
  99999,
  Number.MAX_SAFE_INTEGER + 1,
]) {
  const serialized = new URLSearchParams(
    appRouteUrl(
      {
        ...initial,
        view: "spaceVenue",
        venueId: venueId as number | null,
        spaceId: 11,
      },
      "?venue=1&space=11",
    ),
  );
  assert.equal(serialized.get("view"), "spaces");
  assert.equal(serialized.has("venue"), false);
  assert.equal(serialized.has("space"), false);
}
for (const view of views.filter((view) => view !== "spaceVenue")) {
  const route = readAppRoute(`?view=${view}&venue=1&space=11`, {
    venueId: 1,
    spaceId: 11,
  });
  assert.equal(route.venueId, null);
  assert.equal(route.spaceId, null);
  const serialized = new URLSearchParams(
    appRouteUrl({ ...route, venueId: 1, spaceId: 11 }, "?venue=1&space=11"),
  );
  assert.equal(
    serialized.has("venue"),
    false,
    `${view} must not retain a venue target`,
  );
  assert.equal(
    serialized.has("space"),
    false,
    `${view} must not retain a unit target`,
  );
}
for (const original of [
  "?present=1&journey=spaces&step=3&finished=1",
  "?device=ios&present=1",
  "?device=android&simulator=1",
  "?simulator=1",
  "?app=0",
]) {
  const before = new URLSearchParams(original);
  const after = new URLSearchParams(
    appRouteUrl(
      {
        ...initial,
        view: "spaceVenue",
        venueId: spaceVenues[0].id,
        spaceId: null,
      },
      original,
    ),
  );
  for (const [key, value] of before) assert.equal(after.get(key), value);
  if (!before.has("app")) assert.equal(after.has("app"), false);
  assert.equal(after.get("space"), String(spaceVenues[0].spaces[0].id));
}

console.log(
  `Application navigation passed: ${roles.length * views.length} role/view routes, every canonical venue/unit and property, invalid/legacy property and venue fallbacks, scoped owner expenses, venue setup and viewing inbox/return, all valid property return origins, all service modes, strict catalogue IDs, query limits, defaults and entry-mode preservation.`,
);
