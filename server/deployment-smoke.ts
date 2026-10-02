import { strict as assert } from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rmdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const entry = resolve(root, "build-api/server/index.js");
const children: ChildProcess[] = [];
const checks: string[] = [];
const emptyDirectory = await mkdtemp(join(tmpdir(), "kasa-readiness-"));

function passed(label: string) {
  checks.push(label);
  console.log(`✓ ${label}`);
}

async function freePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

async function start(
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: options.cwd || root,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      KASA_API_HOST: "127.0.0.1",
      KASA_API_PORT: String(port),
      KASA_API_ENV_FILE: join(emptyDirectory, "absent.env"),
      KASA_API_SERVE_WEB: "true",
      KASA_API_COUNTRY: "demo",
      KASA_API_DEMO_WRITES: "false",
      KASA_API_ALLOWED_ORIGINS: "https://kasa-pilot.example",
      ...options.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return { child, base, output };
    try {
      if ((await fetch(`${base}/api/v1/health`)).ok)
        return { child, base, output };
    } catch {
      // Only wait while this local child is starting.
    }
    await new Promise((done) => setTimeout(done, 75));
  }
  throw new Error(`Pilot process did not start: ${output}`);
}

try {
  const { child, base } = await start();
  assert.equal(child.exitCode, null);
  const ready = await fetch(`${base}/api/v1/ready`);
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("ratelimit"), null);
  assert.deepEqual(await ready.json(), {
    status: "ready",
    mode: "read_only_demo",
    data: "synthetic",
    persistence: "not_configured",
    productionReady: false,
    web: "available",
  });
  passed("compiled production runtime reports honest demo readiness");

  const page = await fetch(base);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /<title>Kasa/);
  assert.equal(page.headers.get("x-kasa-data-mode"), "synthetic-demo");
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(page.headers.get("ratelimit"), null);
  const bundlePath = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(bundlePath);
  const bundle = await fetch(new URL(bundlePath, base));
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get("content-type") || "", /javascript/);
  const nestedPage = await fetch(`${base}/properties`, {
    headers: { accept: "text/html" },
  });
  assert.equal(nestedPage.status, 200);
  passed("web entry, built assets and SPA navigation share the API origin");

  const catalogue = await fetch(`${base}/api/v1/properties`);
  assert.equal(catalogue.status, 200);
  const cataloguePayload = (await catalogue.json()) as { total: number };
  assert.ok(cataloguePayload.total > 0);
  for (const route of ["space-reservations", "rent-records/proofs"]) {
    const write = await fetch(`${base}/api/v1/${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kasa-demo-key": "irrelevant-demo-key",
      },
      body: "{}",
    });
    assert.equal(write.status, 503);
    const writeError = (await write.json()) as Record<string, unknown>;
    assert.equal(writeError.requestId, write.headers.get("x-request-id"));
  }
  passed(
    "catalogue remains available while every existing write route is disabled",
  );

  for (const path of ["/api/v1/missing", "/.env", "/assets/missing.js"]) {
    const response = await fetch(`${base}${path}`, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 404, path);
  }
  const blockedOrigin = await fetch(`${base}/api/v1/health`, {
    headers: { origin: "https://unapproved.example" },
  });
  assert.equal(blockedOrigin.status, 403);
  const originError = (await blockedOrigin.json()) as Record<string, unknown>;
  assert.equal(
    originError.requestId,
    blockedOrigin.headers.get("x-request-id"),
  );
  assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);
  assert.match(
    page.headers.get("content-security-policy") || "",
    /connect-src 'self'/,
  );
  passed(
    "unknown API/assets and dotfiles cannot fall through to successful HTML",
  );

  const missingWeb = await start({ cwd: emptyDirectory });
  assert.equal((await fetch(`${missingWeb.base}/api/v1/health`)).status, 200);
  assert.equal((await fetch(`${missingWeb.base}/api/v1/ready`)).status, 503);
  passed("missing web build fails readiness without conflating liveness");

  const unavailableContract = await fetch(
    `${missingWeb.base}/api/v1/openapi.yaml`,
  );
  assert.equal(unavailableContract.status, 500);
  assert.match(
    unavailableContract.headers.get("content-type") || "",
    /application\/json/,
  );
  assert.deepEqual(await unavailableContract.json(), {
    message: "The Kasa API could not complete this request.",
    requestId: unavailableContract.headers.get("x-request-id"),
  });
  passed(
    "unexpected resource failures return a sanitized error with a request ID",
  );

  const unsafe = await start({
    env: {
      KASA_API_DEMO_WRITES: "true",
      KASA_API_DEMO_KEY: "kasa-test-not-a-real-secret",
    },
  });
  assert.equal(unsafe.child.exitCode, 1);
  assert.match(unsafe.output, /must keep KASA_API_DEMO_WRITES=false/);
  passed("production launch refuses demo-write overrides even with a key");

  const normalizedCountry = await start({ env: { KASA_API_COUNTRY: " AO " } });
  assert.equal(normalizedCountry.child.exitCode, null);
  const countryConfig = await fetch(`${normalizedCountry.base}/api/v1/config`);
  assert.equal(countryConfig.status, 200);
  const countryPayload = (await countryConfig.json()) as Record<
    string,
    unknown
  >;
  assert.equal(countryPayload.country, "ao");
  assert.equal(countryPayload.currency, "AOA");
  assert.equal(countryPayload.readiness, "requires_market_approval");
  for (const country of ["", " ", "a", "abcdefghijklm"]) {
    const invalidCountry = await start({ env: { KASA_API_COUNTRY: country } });
    assert.equal(invalidCountry.child.exitCode, 1);
    assert.match(invalidCountry.output, /Invalid Kasa API configuration/);
    assert.match(invalidCountry.output, /KASA_API_COUNTRY/);
  }
  passed(
    "server country defaults use the same normalization and bounds as query values",
  );

  const exited = once(child, "exit");
  child.kill("SIGTERM");
  assert.equal((await exited)[0], 0);
  passed("SIGTERM cleanly closes the listener");

  const dockerfile = await readFile(resolve(root, "Dockerfile"), "utf8");
  const ignore = await readFile(resolve(root, ".dockerignore"), "utf8");
  assert.match(dockerfile, /FROM node:24-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /npm ci --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /CMD \["node", "build-api\/server\/index.js"\]/);
  assert.match(ignore, /^\*\*$/m);
  assert.match(ignore, /^\*\*\/\.env\*$/m);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./);
  passed(
    "image uses pinned Node, locked dependencies, non-root user and allowlisted inputs",
  );
  console.log(`\n${checks.length} deployment checks passed.`);
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  }
  await rmdir(emptyDirectory);
}
