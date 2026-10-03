import { strict as assert } from "node:assert";
import {
  fetchConfiguredApi,
  resolveApiTarget,
} from "../src/platform/api-transport.ts";

// Pure module + injected fetch: no dotenv, browser, credentials or network.
const production = { origin: "https://kasa.example", development: false };
let passed = 0;
function accepted(base: string, path: string, expected: string) {
  assert.equal(resolveApiTarget(base, path, production).href, expected);
  passed++;
}
accepted(
  "/api/v1/",
  "properties?limit=100",
  "https://kasa.example/api/v1/properties?limit=100",
);
accepted(
  "https://api.example/v1",
  "config?country=ES%2Ftest",
  "https://api.example/v1/config?country=ES%2Ftest",
);
accepted("/api/v1/", "spaces/1", "https://kasa.example/api/v1/spaces/1");

for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
  const origin = `http://${hostname}:5173`;
  assert.equal(
    resolveApiTarget("/api/v1/", "health", { origin, development: false })
      .origin,
    origin,
  );
  assert.equal(
    resolveApiTarget(`http://${hostname}:8787/api/v1/`, "health", {
      origin,
      development: true,
    }).port,
    "8787",
  );
  assert.throws(
    () =>
      resolveApiTarget(`http://${hostname}:8787/api/v1/`, "health", {
        origin,
        development: false,
      }),
    /invalid API destination/,
  );
  passed += 3;
}

const invalidBases = [
  "",
  "http://api.example/v1/",
  "file:///api/v1/",
  "ftp://api.example/",
  "https://username:secret@api.example/v1/",
  "https://api.example/v1/?key=secret",
  "https://api.example/v1/#private",
  "https://api.example/v1/?",
  "https://api.example/v1/#",
  "https://api.example\\v1/",
  "https://api.example/\nv1/",
  " https://api.example/v1/",
  "http://127.0.0.1:8787/api/v1/",
];
let calls = 0;
const fakeResponse = new Response("{}", { status: 200 });
const fetcher: typeof fetch = async () => {
  calls++;
  return fakeResponse;
};
for (const base of invalidBases) {
  assert.throws(
    () => fetchConfiguredApi(base, "health", {}, production, fetcher),
    /^Error: Kasa rejected an invalid API destination\.$/,
  );
  passed++;
}
for (const path of [
  "",
  "/health",
  "//other.example/x",
  "https://other.example/x",
  "../health",
  "a/../../health",
  "./health",
  "a//b",
  "a/./b",
  "a/",
  "%2e%2e/health",
  "a%2fb",
  "a%252fb",
  "health#fragment",
  "health\\other",
  "health\n",
  "?only=query",
]) {
  assert.throws(
    () => fetchConfiguredApi("/api/v1/", path, {}, production, fetcher),
    /^Error: Kasa rejected an invalid API destination\.$/,
  );
  passed++;
}
assert.equal(calls, 0);
passed++;

for (const requested of ["follow", "manual"] as const) {
  const controller = new AbortController();
  let actualCalls = 0;
  const result = await fetchConfiguredApi(
    "/api/v1/",
    "health",
    {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      redirect: requested,
      cache: "no-store",
      signal: controller.signal,
    },
    production,
    async (target, options) => {
      actualCalls++;
      assert.equal(String(target), "https://kasa.example/api/v1/health");
      assert.equal(options?.redirect, "error");
      assert.equal(options?.credentials, "include");
      assert.equal(options?.method, "POST");
      assert.equal(options?.body, "{}");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.signal, controller.signal);
      return fakeResponse;
    },
  );
  assert.equal(result, fakeResponse);
  assert.equal(actualCalls, 1);
  passed++;
}
let failures = 0;
await assert.rejects(
  fetchConfiguredApi("/api/v1/", "health", {}, production, async () => {
    failures++;
    throw new TypeError("synthetic redirect rejection");
  }),
  /synthetic redirect rejection/,
);
assert.equal(failures, 1);
passed++;
console.log(`${passed} API destination checks passed; no network requests.`);

await import("./catalog-client-smoke.ts");
