import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import { createAccountRouter } from "./accounts.ts";
import { createAccountStore, type PublicAccount } from "./account-store.ts";

const directory = mkdtempSync(join(tmpdir(), "kasa-account-smoke-"));
const databasePath = join(directory, "accounts.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Only-local-test-password-123";
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let baseUrl = "";

interface Payload {
  account: PublicAccount | null;
  csrfToken: string | null;
  error?: { code: string; message: string; fields?: Record<string, string[]> };
  requestId?: string;
}
interface Client {
  cookie: string;
  csrfToken: string;
  account: PublicAccount;
}

async function start() {
  service = createAccountRouter({ databasePath, allowedOrigins: [origin] });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "account-smoke";
    next();
  });
  app.use("/api/v1/account", service.router);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}/api/v1/account`;
}

async function stop() {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
  service?.close();
  service = undefined;
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    rawBody?: string;
    client?: Client;
    headers?: Record<string, string>;
    omitOrigin?: boolean;
    omitCsrf?: boolean;
  } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.omitOrigin ? {} : { Origin: origin }),
      ...(options.body === undefined && options.rawBody === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.client ? { Cookie: options.client.cookie } : {}),
      ...(!options.omitCsrf && options.client
        ? { "X-CSRF-Token": options.client.csrfToken }
        : {}),
      ...options.headers,
    },
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const payload = (await response.json()) as Payload;
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-kasa-data-mode"), "local-persisted");
  assert.equal(Object.hasOwn(payload, "password"), false);
  assert.equal(JSON.stringify(payload).includes(password), false);
  assert.equal(JSON.stringify(payload).includes(databasePath), false);
  return { response, payload };
}

function expectError(
  result: Awaited<ReturnType<typeof request>>,
  status: number,
  code: string,
) {
  assert.equal(result.response.status, status);
  assert.equal(result.payload.error?.code, code);
  assert.equal(typeof result.payload.error?.message, "string");
  assert.equal(result.payload.requestId, "account-smoke");
}

function clientFrom(result: Awaited<ReturnType<typeof request>>): Client {
  const cookie = result.response.headers.get("set-cookie");
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/v1\/account/);
  assert.match(cookie, /Max-Age=604800/);
  assert.ok(result.payload.account);
  assert.equal(result.payload.account.emailVerified, false);
  assert.match(result.payload.csrfToken ?? "", /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(Object.keys(result.payload.account).sort(), [
    "displayName",
    "email",
    "emailVerified",
    "id",
    "locale",
    "version",
  ]);
  return {
    cookie: cookie.split(";")[0],
    csrfToken: result.payload.csrfToken!,
    account: result.payload.account,
  };
}

function passed(description: string) {
  console.log(`✓ ${description}`);
}

try {
  await start();
  assert.deepEqual((await request("/session")).payload, {
    account: null,
    csrfToken: null,
  });
  expectError(
    await request("/profile", {
      method: "PATCH",
      body: { displayName: "Private", locale: "pt", version: 1 },
    }),
    401,
    "AUTH_REQUIRED",
  );
  expectError(
    await request("/register", { method: "POST", body: {}, omitOrigin: true }),
    403,
    "ORIGIN_DENIED",
  );
  expectError(
    await request("/login", {
      method: "POST",
      body: {},
      headers: { Origin: "https://untrusted.example" },
    }),
    403,
    "ORIGIN_DENIED",
  );
  expectError(
    await request("/login", {
      method: "POST",
      body: {},
      headers: { "Content-Type": "text/plain" },
    }),
    422,
    "VALIDATION_ERROR",
  );
  passed(
    "anonymous access is read-only; origin and JSON requirements protect account writes",
  );
  expectError(
    await request("/login", {
      method: "POST",
      body: {},
      headers: { Origin: "null" },
    }),
    403,
    "ORIGIN_DENIED",
  );
  expectError(
    await request("/login", { method: "POST", rawBody: "{malformed" }),
    422,
    "VALIDATION_ERROR",
  );
  expectError(
    await request("/login", {
      method: "POST",
      rawBody: JSON.stringify({ padding: "x".repeat(17_000) }),
    }),
    422,
    "VALIDATION_ERROR",
  );
  passed(
    "malformed JSON and oversized bodies fail safely without entering credential verification",
  );

  expectError(
    await request("/register", {
      method: "POST",
      body: {
        displayName: " ",
        email: "not-email",
        password: "short",
        locale: "pt",
        role: "admin",
      },
    }),
    422,
    "VALIDATION_ERROR",
  );
  const registered = await request("/register", {
    method: "POST",
    body: {
      displayName: "  Ana Local  ",
      email: " ANA@example.test ",
      password,
      locale: "pt",
    },
  });
  assert.equal(registered.response.status, 201);
  const ana = clientFrom(registered);
  for (const cookie of [
    `${ana.cookie}; ${ana.cookie}`,
    "kasa_account_session=malformed%20cookie",
    `kasa_account_session=${"A".repeat(43)}`,
  ]) {
    assert.deepEqual(
      (await request("/session", { headers: { Cookie: cookie } })).payload,
      { account: null, csrfToken: null },
    );
  }
  assert.equal(ana.account.email, "ana@example.test");
  assert.equal(ana.account.displayName, "Ana Local");
  assert.equal(ana.account.version, 1);
  const again = await request("/session", { client: ana });
  assert.deepEqual(again.payload.account, ana.account);
  assert.equal(again.payload.csrfToken, ana.csrfToken);
  expectError(
    await request("/register", {
      method: "POST",
      body: {
        displayName: "Duplicate",
        email: "ANA@example.test",
        password,
        locale: "pt",
      },
    }),
    409,
    "ACCOUNT_EXISTS",
  );
  passed(
    "registration persists a normalized private identity and protected opaque cookie; duplicates are rejected",
  );

  const second = await request("/register", {
    method: "POST",
    body: {
      displayName: "Bruno Local",
      email: "bruno@example.test",
      password,
      locale: "en",
    },
  });
  const bruno = clientFrom(second);
  assert.notEqual(ana.account.id, bruno.account.id);
  assert.notEqual(ana.cookie, bruno.cookie);
  assert.notEqual(ana.csrfToken, bruno.csrfToken);
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: ana,
      omitCsrf: true,
      body: { displayName: "No CSRF", locale: "pt", version: 1 },
    }),
    403,
    "CSRF_DENIED",
  );
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: ana,
      headers: { "X-CSRF-Token": bruno.csrfToken },
      body: { displayName: "Other session", locale: "pt", version: 1 },
    }),
    403,
    "CSRF_DENIED",
  );
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: ana,
      body: {
        displayName: "Escalation",
        locale: "pt",
        version: 1,
        accountId: bruno.account.id,
        role: "admin",
      },
    }),
    422,
    "VALIDATION_ERROR",
  );
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: ana,
      body: {
        displayName: "Email overwrite",
        locale: "pt",
        version: 1,
        email: "bruno@example.test",
      },
    }),
    422,
    "VALIDATION_ERROR",
  );
  const updated = await request("/profile", {
    method: "PATCH",
    client: ana,
    body: { displayName: "Ana Updated", locale: "fr", version: 1 },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.account?.displayName, "Ana Updated");
  assert.equal(updated.payload.account?.version, 2);
  ana.account = updated.payload.account!;
  assert.deepEqual(
    (await request("/session", { client: bruno })).payload.account,
    bruno.account,
  );
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: ana,
      body: { displayName: "Stale edit", locale: "en", version: 1 },
    }),
    409,
    "VERSION_CONFLICT",
  );
  passed(
    "profile edits are owner-scoped, CSRF-protected, strictly validated and reject stale overwrites",
  );

  expectError(
    await request("/login", {
      method: "POST",
      body: { email: ana.account.email, password: "An-incorrect-password" },
    }),
    401,
    "INVALID_CREDENTIALS",
  );
  const unknown = await request("/login", {
    method: "POST",
    body: { email: "missing@example.test", password },
  });
  expectError(unknown, 401, "INVALID_CREDENTIALS");
  const authenticated = await request("/login", {
    method: "POST",
    client: ana,
    body: { email: ana.account.email, password },
  });
  assert.equal(authenticated.response.status, 200);
  const renewedAna = clientFrom(authenticated);
  assert.notEqual(ana.cookie, renewedAna.cookie);
  assert.deepEqual((await request("/session", { client: ana })).payload, {
    account: null,
    csrfToken: null,
  });
  assert.deepEqual(renewedAna.account, ana.account);
  passed(
    "login uses generic invalid-credential errors and rotates/revokes the prior session",
  );

  await stop();
  assert.equal(lstatSync(databasePath).mode & 0o077, 0);
  const inspection = new DatabaseSync(databasePath);
  const rows = inspection
    .prepare("SELECT password_hash,password_salt,password_scheme FROM accounts")
    .all();
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].password_hash, password);
  assert.notEqual(rows[0].password_hash, rows[1].password_hash);
  assert.notEqual(rows[0].password_salt, rows[1].password_salt);
  assert.equal(rows[0].password_scheme, "scrypt-n131072-r8-p1-v1");
  const sessions = inspection
    .prepare("SELECT token_hash FROM account_sessions")
    .all();
  const rawToken = renewedAna.cookie.split("=")[1];
  assert.equal(
    sessions.some((row) => row.token_hash === rawToken),
    false,
  );
  assert.ok(
    sessions.some(
      (row) =>
        row.token_hash === createHash("sha256").update(rawToken).digest("hex"),
    ),
  );
  inspection.close();
  await start();
  assert.deepEqual(
    (await request("/session", { client: renewedAna })).payload.account,
    ana.account,
  );
  assert.deepEqual(
    (await request("/session", { client: bruno })).payload.account,
    bruno.account,
  );
  passed(
    "database stores salted password hashes and hashed sessions; profiles and sessions survive a server restart",
  );

  expectError(
    await request("/logout", {
      method: "POST",
      body: {},
      client: renewedAna,
      omitCsrf: true,
    }),
    403,
    "CSRF_DENIED",
  );
  const loggedOut = await request("/logout", {
    method: "POST",
    body: {},
    client: renewedAna,
  });
  assert.equal(loggedOut.response.status, 200);
  assert.deepEqual(loggedOut.payload, { account: null, csrfToken: null });
  assert.match(
    loggedOut.response.headers.get("set-cookie") ?? "",
    /Expires=Thu, 01 Jan 1970/,
  );
  assert.deepEqual(
    (await request("/session", { client: renewedAna })).payload,
    { account: null, csrfToken: null },
  );
  assert.deepEqual(
    (await request("/session", { client: bruno })).payload.account,
    bruno.account,
  );
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: renewedAna,
      body: { displayName: "After logout", locale: "pt", version: 2 },
    }),
    401,
    "AUTH_REQUIRED",
  );
  passed("logout revokes the server session without affecting another account");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    expectError(
      await request("/login", {
        method: "POST",
        body: { email: "missing@example.test", password },
      }),
      401,
      "INVALID_CREDENTIALS",
    );
  }
  expectError(
    await request("/login", {
      method: "POST",
      body: { email: "missing@example.test", password },
    }),
    429,
    "RATE_LIMITED",
  );
  passed("repeated authentication failures are rate-limited");

  await stop();
  const expiryDatabase = new DatabaseSync(databasePath);
  expiryDatabase.prepare("UPDATE account_sessions SET expires_at = 0").run();
  expiryDatabase.close();
  await start();
  assert.deepEqual((await request("/session", { client: bruno })).payload, {
    account: null,
    csrfToken: null,
  });
  expectError(
    await request("/profile", {
      method: "PATCH",
      client: bruno,
      body: { displayName: "Expired", locale: "en", version: 1 },
    }),
    401,
    "AUTH_REQUIRED",
  );
  assert.throws(() => createAccountStore("relative.sqlite"), /absolute/);
  passed(
    "expired sessions cannot read accounts or write profiles; non-absolute storage paths are refused",
  );
  console.log("Account HTTP smoke checks passed (local test identities only).");
} finally {
  await stop();
  // Delete only this test's known, newly created private SQLite fixture files.
  const allowed = new Set([
    "accounts.sqlite",
    "accounts.sqlite-wal",
    "accounts.sqlite-shm",
    "accounts.sqlite-journal",
  ]);
  const entries = readdirSync(directory);
  assert.ok(
    entries.every(
      (entry) =>
        allowed.has(entry) && lstatSync(join(directory, entry)).isFile(),
    ),
  );
  for (const entry of entries) unlinkSync(join(directory, entry));
  rmdirSync(directory);
}
