import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import type { z } from "zod";
import { properties, spaceVenues } from "../src/data.ts";
import type { Property, SpaceVenue } from "../src/types.ts";

type Catalogue = {
  listProperties: (options?: { fresh?: boolean }) => Promise<Property[]>;
  listSpaces: (options?: { fresh?: boolean }) => Promise<SpaceVenue[]>;
};
type RequestOptions = Pick<RequestInit, "cache">;
type Requester = <T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestOptions,
) => Promise<T>;
type PendingRequest = {
  path: string;
  options: RequestOptions;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const globalsBefore = {
  fetch: Object.getOwnPropertyDescriptor(globalThis, "fetch"),
  window: Object.getOwnPropertyDescriptor(globalThis, "window"),
};
let fixtureId = 0;
let passed = 0;

// Each fixture imports the real catalogue into its own module instance. Only its
// two environment-dependent imports are substituted; the real Zod schemas parse
// every scripted response. Hooks are removed before any request is exercised.
async function fixture() {
  const suffix = String(++fixtureId);
  const catalogueUrl = new URL(
    `../src/platform/catalog.ts?catalogue-smoke=${suffix}`,
    import.meta.url,
  ).href;
  const apiUrl = `kasa-catalogue-smoke:api-${suffix}`;
  const configUrl = `kasa-catalogue-smoke:config-${suffix}`;
  const intercepted = new Set<string>();
  const requests: PendingRequest[] = [];
  const request: Requester = (path, schema, options = {}) =>
    new Promise<unknown>((resolve, reject) => {
      requests.push({ path, options, resolve, reject });
    }).then((value) => schema.parse(value));
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === apiUrl || specifier === configUrl)
        return { url: specifier, shortCircuit: true };
      if (context.parentURL === catalogueUrl) {
        if (specifier === "./api") {
          intercepted.add("api");
          return { url: apiUrl, shortCircuit: true };
        }
        if (specifier === "./config") {
          intercepted.add("config");
          return { url: configUrl, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === apiUrl)
        return {
          format: "module",
          shortCircuit: true,
          source: `
            let request;
            export function install(value) { request = value; }
            export function apiRequest(...args) { return request(...args); }
          `,
        };
      if (url === configUrl)
        return {
          format: "module",
          shortCircuit: true,
          source: 'export const appConfig = { country: "demo" };',
        };
      return nextLoad(url, context);
    },
  });
  let client: Catalogue;
  try {
    const controller = (await import(apiUrl)) as {
      install: (request: Requester) => void;
    };
    controller.install(request);
    client = (await import(catalogueUrl)) as Catalogue;
    assert.deepEqual(intercepted, new Set(["api", "config"]));
  } finally {
    hook.deregister();
  }
  return { client, requests };
}

type Item = Property | SpaceVenue;
const endpoints = [
  {
    name: "properties",
    load: (client: Catalogue) => client.listProperties,
    item: properties[0],
    invalidItem: { ...properties[0], price: -1 },
  },
  {
    name: "spaces",
    load: (client: Catalogue) => client.listSpaces,
    item: spaceVenues[0],
    invalidItem: {
      ...spaceVenues[0],
      spaces: [{ ...spaceVenues[0].spaces[0], capacity: -1 }],
    },
  },
] as const;

function page(item: Item, id = item.id) {
  return {
    items: [{ ...structuredClone(item), id, ignoredServerField: "stripped" }],
    total: 1,
    nextOffset: null,
  };
}
function expected(item: Item, id = item.id) {
  return [{ ...structuredClone(item), id }];
}
function captured(
  request: PendingRequest | undefined,
  endpoint: string,
  fresh: boolean,
): asserts request is PendingRequest {
  assert.ok(request, "The operation must issue a new request");
  assert.equal(request.path, `${endpoint}?limit=100`);
  assert.equal(request.options.cache, fresh ? "no-store" : undefined);
}

for (const endpoint of endpoints) {
  // Ordinary discovery deduplicates pending requests and retains parsed success.
  {
    const { client, requests } = await fixture();
    const load = endpoint.load(client);
    const first = load();
    assert.equal(load(), first);
    assert.equal(load({}), first);
    assert.equal(load({ fresh: false }), first);
    assert.equal(requests.length, 1);
    captured(requests[0], endpoint.name, false);
    requests[0].resolve(page(endpoint.item));
    assert.deepEqual(await first, expected(endpoint.item));
    assert.equal(load(), first);
    assert.equal(requests.length, 1);
    passed++;

    // A fresh outage is observable even after successful browsing. Recovery is
    // another request, and neither outcome replaces the browsing snapshot.
    const outage = load({ fresh: true });
    const rejected = assert.rejects(outage, /synthetic outage/);
    captured(requests[1], endpoint.name, true);
    requests[1].reject(new Error("synthetic outage"));
    await rejected;
    assert.equal(load(), first);
    const recovery = load({ fresh: true });
    captured(requests[2], endpoint.name, true);
    requests[2].resolve(page(endpoint.item, 101));
    assert.deepEqual(await recovery, expected(endpoint.item, 101));
    assert.equal(load(), first);
    assert.deepEqual(await load(), expected(endpoint.item));
    assert.equal(requests.length, 3);
    passed++;
  }

  // Diagnostics performed before discovery cannot populate its cache.
  {
    const { client, requests } = await fixture();
    const load = endpoint.load(client);
    const fresh = load({ fresh: true });
    captured(requests[0], endpoint.name, true);
    requests[0].resolve(page(endpoint.item, 102));
    await fresh;
    const browse = load();
    captured(requests[1], endpoint.name, false);
    assert.notEqual(browse, fresh);
    requests[1].resolve(page(endpoint.item));
    assert.deepEqual(await browse, expected(endpoint.item));
    assert.equal(requests.length, 2);
    passed++;
  }

  // Browse and fresh requests keep separate results in either completion order.
  for (const browseFirst of [true, false]) {
    const { client, requests } = await fixture();
    const load = endpoint.load(client);
    const browse = load();
    const fresh = load({ fresh: true });
    captured(requests[0], endpoint.name, false);
    captured(requests[1], endpoint.name, true);
    assert.notEqual(fresh, browse);
    assert.equal(load(), browse);
    if (browseFirst) {
      requests[0].resolve(page(endpoint.item));
      await browse;
      requests[1].resolve(page(endpoint.item, 103));
    } else {
      requests[1].resolve(page(endpoint.item, 103));
      await fresh;
      requests[0].resolve(page(endpoint.item));
    }
    assert.deepEqual(await browse, expected(endpoint.item));
    assert.deepEqual(await fresh, expected(endpoint.item, 103));
    assert.equal(load(), browse);
    assert.equal(requests.length, 2);
    passed++;
  }

  // Overlapping fresh probes do not deduplicate, overwrite each other, or clear
  // a newer browsing retry when an older fresh request eventually rejects.
  {
    const { client, requests } = await fixture();
    const load = endpoint.load(client);
    const oldFresh = load({ fresh: true });
    const oldRejected = assert.rejects(oldFresh, /late fresh outage/);
    const failedBrowse = load();
    const browseRejected = assert.rejects(failedBrowse, /browse outage/);
    captured(requests[0], endpoint.name, true);
    captured(requests[1], endpoint.name, false);
    requests[1].reject(new Error("browse outage"));
    await browseRejected;
    const retry = load();
    assert.notEqual(retry, failedBrowse);
    captured(requests[2], endpoint.name, false);
    const freshA = load({ fresh: true });
    const freshB = load({ fresh: true });
    assert.notEqual(freshA, freshB);
    captured(requests[3], endpoint.name, true);
    captured(requests[4], endpoint.name, true);
    requests[4].resolve(page(endpoint.item, 105));
    assert.deepEqual(await freshB, expected(endpoint.item, 105));
    assert.equal(load(), retry);
    requests[0].reject(new Error("late fresh outage"));
    await oldRejected;
    assert.equal(
      load(),
      retry,
      "Fresh rejection must not clear pending browse",
    );
    requests[2].resolve(page(endpoint.item));
    assert.deepEqual(await retry, expected(endpoint.item));
    requests[3].resolve(page(endpoint.item, 104));
    assert.deepEqual(await freshA, expected(endpoint.item, 104));
    assert.equal(load(), retry, "Late fresh success must not replace browse");
    assert.equal(requests.length, 5);
    passed++;
  }

  // Response parsing is identical in both modes, including nested records and
  // page metadata. Invalid normal responses release only their own cache.
  {
    const malformed = [
      null,
      { ...page(endpoint.item), items: "not an array" },
      { ...page(endpoint.item), total: "1" },
      { ...page(endpoint.item), total: -1 },
      { ...page(endpoint.item), nextOffset: 0.5 },
      { ...page(endpoint.item), items: [{ ...endpoint.item, id: 0 }] },
      { ...page(endpoint.item), items: [endpoint.invalidItem] },
    ];
    const { client, requests } = await fixture();
    const load = endpoint.load(client);
    for (const value of malformed) {
      const pending = load();
      assert.equal(load(), pending);
      const rejected = assert.rejects(pending, { name: "ZodError" });
      const latest = requests.at(-1);
      captured(latest, endpoint.name, false);
      latest.resolve(value);
      await rejected;
    }
    assert.equal(requests.length, malformed.length);
    const browse = load();
    requests.at(-1)!.resolve(page(endpoint.item));
    assert.deepEqual(await browse, expected(endpoint.item));
    for (const value of malformed) {
      const pending = load({ fresh: true });
      const rejected = assert.rejects(pending, { name: "ZodError" });
      const latest = requests.at(-1);
      captured(latest, endpoint.name, true);
      latest.resolve(value);
      await rejected;
      assert.equal(load(), browse);
    }
    const empty = load({ fresh: true });
    requests.at(-1)!.resolve({ items: [], total: 0, nextOffset: null });
    assert.deepEqual(await empty, []);
    assert.equal(load(), browse);
    assert.equal(requests.length, malformed.length * 2 + 2);
    passed += malformed.length * 2 + 1;
  }
}

// Empty arrays are valid catalogue data. Preserve them in both modes so clients
// can render their empty states instead of substituting an unrelated sample.
const venueWithoutUnits: SpaceVenue = {
  ...structuredClone(spaceVenues[0]),
  spaces: [],
};
const venueWithoutSlots: SpaceVenue = {
  ...structuredClone(spaceVenues[0]),
  spaces: [{ ...structuredClone(spaceVenues[0].spaces[0]), slots: [] }],
};
const emptyCases = [
  ...endpoints.map((endpoint) => ({
    name: `${endpoint.name}: empty page`,
    endpoint: endpoint.name,
    load: endpoint.load,
    response: { items: [], total: 0, nextOffset: null },
    items: [] as Item[],
  })),
  ...[venueWithoutUnits, venueWithoutSlots].map((venue) => ({
    name: venue.spaces.length ? "unit without slots" : "venue without units",
    endpoint: "spaces",
    load: (client: Catalogue) => client.listSpaces,
    response: page(venue),
    items: expected(venue),
  })),
];
for (const example of emptyCases) {
  for (const fresh of [false, true]) {
    const { client, requests } = await fixture();
    const load = example.load(client);
    const pending = fresh ? load({ fresh: true }) : load();
    captured(requests[0], example.endpoint, fresh);
    requests[0].resolve(example.response);
    assert.deepEqual(
      await pending,
      example.items,
      `${example.name} remains valid in ${fresh ? "fresh" : "browse"} mode`,
    );
    if (!fresh) assert.equal(load(), pending);
    assert.equal(requests.length, 1);
    passed++;
  }
}

// Failures and probes on one endpoint cannot invalidate the other catalogue.
{
  const { client, requests } = await fixture();
  const propertyBrowse = client.listProperties();
  const spaceBrowse = client.listSpaces();
  const propertyRejected = assert.rejects(propertyBrowse, /property outage/);
  requests[0].reject(new Error("property outage"));
  requests[1].resolve(page(spaceVenues[0]));
  await propertyRejected;
  await spaceBrowse;
  const retry = client.listProperties();
  requests[2].resolve(page(properties[0]));
  await retry;
  const freshSpace = client.listSpaces({ fresh: true });
  const spaceRejected = assert.rejects(freshSpace, /space outage/);
  requests[3].reject(new Error("space outage"));
  await spaceRejected;
  assert.equal(client.listProperties(), retry);
  assert.equal(client.listSpaces(), spaceBrowse);
  assert.equal(requests.length, 4);
  passed++;
}

assert.deepEqual(
  Object.getOwnPropertyDescriptor(globalThis, "fetch"),
  globalsBefore.fetch,
);
assert.deepEqual(
  Object.getOwnPropertyDescriptor(globalThis, "window"),
  globalsBefore.window,
);
console.log(`${passed} catalogue client checks passed; no network requests.`);
