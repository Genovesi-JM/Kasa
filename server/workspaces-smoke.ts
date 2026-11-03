import { strict as assert } from "node:assert";
import { createHash, randomBytes, randomUUID, scrypt } from "node:crypto";
import {
  chmodSync,
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
import type { PublicAccount } from "./account-store.ts";
import {
  acceptedInvitationSchema,
  createdWorkspaceSchema,
  issuedInvitationSchema,
  maintenanceListSchema,
  maintenanceResponseSchema,
  propertyAccessSchema,
  propertyResponseSchema,
  removedTenantSchema,
  revokedInvitationSchema,
  workspacesResponseSchema,
} from "../src/platform/workspaceContracts.ts";

const directory = mkdtempSync(join(tmpdir(), "kasa-workspaces-smoke-"));
const databasePath = join(directory, "workspaces.sqlite");
const migrationPath = join(directory, "migration.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Local-workspace-test-fixture-123";
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let baseUrl = "";
let checks = 0;

interface Client {
  cookie: string;
  csrfToken: string;
  account: PublicAccount;
}

interface AccountPayload {
  account: PublicAccount | null;
  csrfToken: string | null;
}

interface ErrorPayload {
  error: { code: string; message: string };
  requestId: string;
}

interface Property {
  id: string;
  workspaceId: string;
  name: string;
  address: string;
  version: number;
  tenantCount: number;
}

interface Workspace {
  id: string;
  name: string;
  role: "owner" | "tenant";
  version: number;
  properties: Property[];
}

interface Invitation {
  id: string;
  propertyId: string;
  accountId: string;
  code: string;
  expiresAt: string;
}

interface Maintenance {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  priority: "normal" | "urgent";
  status: "open" | "in_progress" | "resolved";
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: {
    id: string;
    actorId: string;
    actorName: string;
    kind: "created" | "status_changed" | "comment";
    message: string;
    status: string;
    createdAt: string;
  }[];
}

interface Access {
  tenants: { accountId: string; displayName: string }[];
  invitations: {
    id: string;
    accountId: string;
    expiresAt: string;
    status: "pending" | "accepted" | "revoked" | "expired";
  }[];
}

async function start(path = databasePath) {
  service = createAccountRouter({
    databasePath: path,
    allowedOrigins: [origin],
  });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "workspace-smoke";
    next();
  });
  app.use("/api/v1/account", service.router);
  server = createServer(app);
  await new Promise<void>((done, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}/api/v1/account`;
}

async function stop() {
  if (server) {
    await new Promise<void>((done, reject) =>
      server!.close((error) => (error ? reject(error) : done())),
    );
    server = undefined;
  }
  service?.close();
  service = undefined;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
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
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.client ? { Cookie: options.client.cookie } : {}),
      ...(options.client && !options.omitCsrf
        ? { "X-CSRF-Token": options.client.csrfToken }
        : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json()) as T;
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-kasa-data-mode"), "local-persisted");
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(password), false);
  assert.equal(serialized.includes(databasePath), false);
  assert.equal(serialized.includes("password_hash"), false);
  assert.equal(serialized.includes("code_hash"), false);
  if (response.ok) {
    // Validate actual server payloads with the same pure schemas used by the UI.
    const pathname = path.split("?", 1)[0];
    if (pathname === "/workspaces") {
      (options.method === "POST"
        ? createdWorkspaceSchema
        : workspacesResponseSchema
      ).parse(payload);
    } else if (pathname === "/invitations/accept") {
      acceptedInvitationSchema.parse(payload);
    } else if (/^\/invitations\/[^/]+$/.test(pathname)) {
      revokedInvitationSchema.parse(payload);
    } else if (/^\/properties\/[^/]+\/invitations$/.test(pathname)) {
      issuedInvitationSchema.parse(payload);
    } else if (/^\/properties\/[^/]+\/access$/.test(pathname)) {
      propertyAccessSchema.parse(payload);
    } else if (/^\/properties\/[^/]+\/tenants\/[^/]+$/.test(pathname)) {
      removedTenantSchema.parse(payload);
    } else if (/^\/properties\/[^/]+\/maintenance$/.test(pathname)) {
      (options.method === "POST"
        ? maintenanceResponseSchema
        : maintenanceListSchema
      ).parse(payload);
    } else if (/^\/maintenance\/[^/]+$/.test(pathname)) {
      maintenanceResponseSchema.parse(payload);
    } else if (
      /^\/workspaces\/[^/]+\/properties$/.test(pathname) ||
      /^\/properties\/[^/]+$/.test(pathname)
    ) {
      propertyResponseSchema.parse(payload);
    }
  }
  return { response, payload };
}

function expectError(
  result: { response: Response; payload: unknown },
  status: number,
  code: string,
) {
  assert.equal(result.response.status, status);
  const payload = result.payload as ErrorPayload;
  assert.equal(payload.error.code, code);
  assert.equal(typeof payload.error.message, "string");
  assert.equal(payload.requestId, "workspace-smoke");
}

async function register(name: string): Promise<Client> {
  const result = await request<AccountPayload>("/register", {
    method: "POST",
    body: {
      displayName: name,
      email: `${name.toLowerCase()}@example.invalid`,
      password,
      locale: "pt",
    },
  });
  assert.equal(result.response.status, 201);
  assert.ok(result.payload.account);
  assert.ok(result.payload.csrfToken);
  const cookie = result.response.headers.get("set-cookie");
  assert.ok(cookie);
  return {
    account: result.payload.account,
    cookie: cookie.split(";")[0],
    csrfToken: result.payload.csrfToken,
  };
}

function passed(label: string) {
  checks += 1;
  console.log(`✓ ${label}`);
}

/** Independently preserve the previous version's actual database contract. */
async function createVersionOneFixture() {
  const salt = randomBytes(32).toString("hex");
  const passwordHash = await new Promise<Buffer>((done, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : done(key)),
    ),
  );
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const database = new DatabaseSync(migrationPath);
  chmodSync(migrationPath, 0o600);
  database.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
      locale TEXT NOT NULL CHECK(locale IN ('pt','en','es','fr','ar','zh')),
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      password_scheme TEXT NOT NULL DEFAULT 'scrypt-n131072-r8-p1-v1'
        CHECK(password_scheme = 'scrypt-n131072-r8-p1-v1'),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE account_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX account_sessions_owner ON account_sessions(account_id);
    CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
    PRAGMA user_version=1;
  `);
  const now = Date.now();
  database
    .prepare(
      "INSERT INTO accounts(id,email,display_name,locale,password_salt,password_hash,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      "migration@example.invalid",
      "Existing profile",
      "fr",
      salt,
      passwordHash.toString("hex"),
      3,
      now,
      now,
    );
  database
    .prepare(
      "INSERT INTO account_sessions(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)",
    )
    .run(
      createHash("sha256").update(token).digest("hex"),
      id,
      now + 60_000,
      now,
    );
  database.close();
  return { id, cookie: `kasa_account_session=${token}` };
}

try {
  await start();
  expectError(await request("/workspaces"), 401, "AUTH_REQUIRED");
  const owner = await register("Owner");
  const tenant = await register("Tenant");
  const outsider = await register("Outsider");
  assert.notEqual(owner.account.id, tenant.account.id);
  assert.notEqual(owner.account.id, outsider.account.id);
  passed(
    "three separate local identities are registered; anonymous workspace access is refused",
  );

  assert.deepEqual(
    (
      await request<{ workspaces: Workspace[] }>("/workspaces", {
        client: owner,
      })
    ).payload.workspaces,
    [],
  );
  expectError(
    await request("/workspaces", {
      method: "POST",
      client: owner,
      omitCsrf: true,
      body: { name: "Denied" },
    }),
    403,
    "CSRF_DENIED",
  );
  expectError(
    await request("/workspaces", {
      method: "POST",
      client: owner,
      omitOrigin: true,
      body: { name: "Denied" },
    }),
    403,
    "ORIGIN_DENIED",
  );
  expectError(
    await request("/workspaces", {
      method: "POST",
      client: owner,
      headers: { Origin: "null" },
      body: { name: "Denied" },
    }),
    403,
    "ORIGIN_DENIED",
  );
  expectError(
    await request("/workspaces", {
      method: "POST",
      client: owner,
      body: {
        name: "Denied",
        ownerAccountId: outsider.account.id,
        role: "admin",
      },
    }),
    422,
    "VALIDATION_ERROR",
  );
  const created = await request<{ workspace: Workspace }>("/workspaces", {
    method: "POST",
    client: owner,
    body: { name: "Owner local portfolio" },
  });
  assert.equal(created.response.status, 201);
  const workspace = created.payload.workspace;
  assert.equal(workspace.role, "owner");
  assert.ok(workspace.id);
  assert.deepEqual(
    (
      await request<{ workspaces: Workspace[] }>("/workspaces?role=admin", {
        client: outsider,
      })
    ).payload.workspaces,
    [],
  );
  for (const [client, expectedAccount] of [
    [owner, tenant.account.id],
    [tenant, owner.account.id],
  ] as const) {
    expectError(
      await request("/workspaces", {
        client,
        headers: { "X-Kasa-Account-Id": expectedAccount },
      }),
      401,
      "ACCOUNT_CHANGED",
    );
  }
  assert.equal(
    (await request<AccountPayload>("/session", { client: owner })).payload
      .account?.id,
    owner.account.id,
  );
  expectError(
    await request("/workspaces", {
      method: "POST",
      client: owner,
      headers: {
        "X-Kasa-Account-Id": tenant.account.id,
        "X-CSRF-Token": tenant.csrfToken,
      },
      body: { name: "Stale account write" },
    }),
    401,
    "ACCOUNT_CHANGED",
  );
  assert.equal(
    (await request("/workspaces", { client: owner, omitCsrf: true })).response
      .status,
    200,
  );
  passed(
    "workspace creation is authenticated and CSRF-protected; role spoofing and stale cross-account tabs cannot grant access",
  );

  const properties: Property[] = [];
  for (const name of ["Apartment A", "Apartment B"]) {
    const result = await request<{ property: Property }>(
      `/workspaces/${workspace.id}/properties`,
      {
        method: "POST",
        client: owner,
        body: { name, address: `${name}, private test address` },
      },
    );
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.property.workspaceId, workspace.id);
    properties.push(result.payload.property);
  }
  const [propertyA, propertyB] = properties;
  expectError(
    await request(`/workspaces/${workspace.id}/properties`, {
      method: "POST",
      client: tenant,
      body: { name: "Injected", address: "Other owner's property" },
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(`/properties/${propertyA.id}`, {
      method: "PATCH",
      client: outsider,
      body: { name: "Injected", address: "New address", version: 1 },
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(`/properties/${propertyA.id}`, {
      method: "PATCH",
      client: owner,
      body: { name: " ", address: "New address", version: 1 },
    }),
    422,
    "VALIDATION_ERROR",
  );
  const propertyEdit = await request<{ property: Property }>(
    `/properties/${propertyA.id}`,
    {
      method: "PATCH",
      client: owner,
      body: {
        name: "Apartment A updated",
        address: "Updated private address",
        version: 1,
      },
    },
  );
  assert.equal(propertyEdit.response.status, 200);
  assert.equal(propertyEdit.payload.property.version, 2);
  expectError(
    await request(`/properties/${propertyA.id}`, {
      method: "PATCH",
      client: owner,
      body: { name: "Stale", address: "Stale", version: 1 },
    }),
    409,
    "VERSION_CONFLICT",
  );
  expectError(
    await request(`/properties/${propertyA.id}/access`, { client: tenant }),
    404,
    "NOT_FOUND",
  );
  passed(
    "property creation and editable records are owner-scoped, validated and protected against stale overwrites",
  );

  async function invite(property: Property, account: Client) {
    const result = await request<{ invitation: Invitation }>(
      `/properties/${property.id}/invitations`,
      {
        method: "POST",
        client: owner,
        body: { accountId: account.account.id },
      },
    );
    assert.equal(result.response.status, 201);
    const invitation = result.payload.invitation;
    assert.match(invitation.code, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(invitation.accountId, account.account.id);
    assert.equal(invitation.propertyId, property.id);
    const remaining = Date.parse(invitation.expiresAt) - Date.now();
    assert.ok(
      remaining > 24 * 60 * 60 * 1_000 - 10_000 &&
        remaining <= 24 * 60 * 60 * 1_000,
    );
    return invitation;
  }
  const invitation = await invite(propertyA, tenant);
  expectError(
    await request("/invitations/accept", {
      method: "POST",
      client: outsider,
      body: { code: invitation.code },
    }),
    404,
    "INVITATION_UNAVAILABLE",
  );
  const accepted = await request<{ propertyId: string; workspaceId: string }>(
    "/invitations/accept",
    {
      method: "POST",
      client: tenant,
      body: { code: invitation.code },
    },
  );
  assert.equal(accepted.response.status, 200);
  assert.deepEqual(accepted.payload, {
    propertyId: propertyA.id,
    workspaceId: workspace.id,
  });
  expectError(
    await request("/invitations/accept", {
      method: "POST",
      client: tenant,
      body: { code: invitation.code },
    }),
    404,
    "INVITATION_UNAVAILABLE",
  );
  const tenantWorkspaces = (
    await request<{ workspaces: Workspace[] }>("/workspaces", {
      client: tenant,
    })
  ).payload.workspaces;
  assert.equal(tenantWorkspaces.length, 1);
  assert.equal(tenantWorkspaces[0].role, "tenant");
  assert.deepEqual(
    tenantWorkspaces[0].properties.map((property) => property.id),
    [propertyA.id],
  );
  const access = (
    await request<Access>(`/properties/${propertyA.id}/access`, {
      client: owner,
    })
  ).payload;
  assert.deepEqual(access.tenants, [
    { accountId: tenant.account.id, displayName: tenant.account.displayName },
  ]);
  assert.equal(
    access.invitations.find((item) => item.id === invitation.id)?.status,
    "accepted",
  );
  assert.equal(JSON.stringify(access).includes(invitation.code), false);
  expectError(
    await request(`/properties/${propertyA.id}/invitations`, {
      method: "POST",
      client: tenant,
      body: { accountId: outsider.account.id },
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(`/properties/${propertyA.id}`, {
      method: "PATCH",
      client: tenant,
      body: { name: "Tenant mutation", address: "Denied", version: 2 },
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(`/properties/${propertyA.id}/access`, { client: tenant }),
    404,
    "NOT_FOUND",
  );
  passed(
    "recipient-bound 24-hour invitations are single-use; tenants see only assigned properties and cannot manage access",
  );

  const revoked = await invite(propertyB, outsider);
  expectError(
    await request(`/invitations/${revoked.id}`, {
      method: "DELETE",
      client: outsider,
      body: {},
    }),
    404,
    "NOT_FOUND",
  );
  const revocation = await request<{ revoked: boolean }>(
    `/invitations/${revoked.id}`,
    {
      method: "DELETE",
      client: owner,
      body: {},
    },
  );
  assert.equal(revocation.payload.revoked, true);
  expectError(
    await request("/invitations/accept", {
      method: "POST",
      client: outsider,
      body: { code: revoked.code },
    }),
    404,
    "INVITATION_UNAVAILABLE",
  );
  const expiry = await invite(propertyB, outsider);
  await stop();
  const inspection = new DatabaseSync(databasePath);
  const storedInvitations = inspection
    .prepare("SELECT code_hash FROM local_property_invitations")
    .all();
  assert.ok(
    storedInvitations.some(
      (row) =>
        row.code_hash ===
        createHash("sha256").update(invitation.code).digest("hex"),
    ),
  );
  assert.ok(
    storedInvitations.every(
      (row) =>
        ![invitation.code, revoked.code, expiry.code].includes(
          String(row.code_hash),
        ),
    ),
  );
  inspection
    .prepare(
      "UPDATE local_property_invitations SET expires_at = ? WHERE id = ?",
    )
    .run(Date.now() - 1, expiry.id);
  inspection.close();
  await start();
  expectError(
    await request("/invitations/accept", {
      method: "POST",
      client: outsider,
      body: { code: expiry.code },
    }),
    404,
    "INVITATION_UNAVAILABLE",
  );
  const propertyBAccess = (
    await request<Access>(`/properties/${propertyB.id}/access`, {
      client: owner,
    })
  ).payload;
  assert.equal(
    propertyBAccess.invitations.find((item) => item.id === expiry.id)?.status,
    "expired",
  );
  assert.equal(
    propertyBAccess.invitations.find((item) => item.id === revoked.id)?.status,
    "revoked",
  );
  assert.deepEqual(
    (
      await request<{ workspaces: Workspace[] }>("/workspaces", {
        client: outsider,
      })
    ).payload.workspaces,
    [],
  );
  passed(
    "invitation codes are stored only as hashes; revocation and expiry survive restart and confer no membership",
  );

  const description = "The kitchen sink is leaking under the cabinet.";
  const createdRequest = await request<{ request: Maintenance }>(
    `/properties/${propertyA.id}/maintenance`,
    {
      method: "POST",
      client: tenant,
      body: { title: "Leaking sink", description, priority: "urgent" },
    },
  );
  assert.equal(createdRequest.response.status, 201);
  const ticket = createdRequest.payload.request;
  assert.equal(ticket.createdBy, tenant.account.id);
  assert.equal(ticket.status, "open");
  assert.equal(ticket.version, 1);
  assert.equal(ticket.description, description);
  assert.equal(ticket.history[0]?.actorId, tenant.account.id);
  assert.equal(ticket.history[0]?.kind, "created");
  assert.equal(ticket.history[0]?.actorName, "Tenant");
  assert.equal(
    (
      await request("/profile", {
        method: "PATCH",
        client: tenant,
        body: { displayName: "Renamed tenant", locale: "pt", version: 1 },
      })
    ).response.status,
    200,
  );
  for (const [client, property] of [
    [tenant, propertyB],
    [outsider, propertyA],
  ] as const) {
    expectError(
      await request(`/properties/${property.id}/maintenance`, {
        method: "POST",
        client,
        body: { title: "Denied", description: "Private", priority: "normal" },
      }),
      404,
      "NOT_FOUND",
    );
    expectError(
      await request(`/properties/${property.id}/maintenance`, { client }),
      404,
      "NOT_FOUND",
    );
  }
  expectError(
    await request(`/properties/${propertyA.id}/maintenance`, {
      method: "POST",
      client: tenant,
      body: {
        title: "Forged",
        description: "Private",
        priority: "normal",
        createdBy: owner.account.id,
        role: "owner",
      },
    }),
    422,
    "VALIDATION_ERROR",
  );
  expectError(
    await request(`/maintenance/${ticket.id}`, {
      method: "PATCH",
      client: tenant,
      body: { version: 1, status: "resolved" },
    }),
    403,
    "FORBIDDEN",
  );
  expectError(
    await request(`/maintenance/${ticket.id}`, {
      method: "PATCH",
      client: outsider,
      body: { version: 1, message: "Denied" },
    }),
    404,
    "NOT_FOUND",
  );
  const commented = await request<{ request: Maintenance }>(
    `/maintenance/${ticket.id}`,
    {
      method: "PATCH",
      client: tenant,
      body: { version: 1, message: "Water supply is now turned off." },
    },
  );
  assert.equal(commented.response.status, 200);
  assert.equal(commented.payload.request.version, 2);
  assert.equal(commented.payload.request.status, "open");
  assert.equal(
    commented.payload.request.history.at(-1)?.actorId,
    tenant.account.id,
  );
  assert.equal(commented.payload.request.history.at(-1)?.kind, "comment");
  assert.equal(
    commented.payload.request.history.at(-1)?.actorName,
    "Renamed tenant",
  );
  assert.equal(commented.payload.request.history[0]?.actorName, "Tenant");
  expectError(
    await request(`/maintenance/${ticket.id}`, {
      method: "PATCH",
      client: owner,
      body: { version: 1, status: "in_progress" },
    }),
    409,
    "VERSION_CONFLICT",
  );
  const progressed = await request<{ request: Maintenance }>(
    `/maintenance/${ticket.id}`,
    {
      method: "PATCH",
      client: owner,
      body: {
        version: 2,
        status: "in_progress",
        message: "A plumber is scheduled for tomorrow.",
      },
    },
  );
  assert.equal(progressed.response.status, 200);
  assert.equal(progressed.payload.request.version, 3);
  assert.equal(progressed.payload.request.status, "in_progress");
  assert.equal(
    progressed.payload.request.history.at(-1)?.actorId,
    owner.account.id,
  );
  const resolved = await request<{ request: Maintenance }>(
    `/maintenance/${ticket.id}`,
    {
      method: "PATCH",
      client: owner,
      body: { version: 3, status: "resolved" },
    },
  );
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.payload.request.version, 4);
  assert.equal(resolved.payload.request.status, "resolved");
  assert.deepEqual(resolved.payload.request.history[0], ticket.history[0]);
  passed(
    "tenant repair requests, tenant comments and owner status updates have server-derived actors, immutable history and version checks",
  );

  const secondTenantInvite = await invite(propertyA, outsider);
  assert.equal(
    (
      await request("/invitations/accept", {
        method: "POST",
        client: outsider,
        body: { code: secondTenantInvite.code },
      })
    ).response.status,
    200,
  );
  const otherTicket = await request<{ request: Maintenance }>(
    `/properties/${propertyA.id}/maintenance`,
    {
      method: "POST",
      client: outsider,
      body: {
        title: "Private second tenant issue",
        description: "Other tenant's private description",
        priority: "normal",
      },
    },
  );
  assert.equal(otherTicket.response.status, 201);
  const tenantTickets = (
    await request<{ requests: Maintenance[] }>(
      `/properties/${propertyA.id}/maintenance`,
      { client: tenant },
    )
  ).payload.requests;
  const otherTickets = (
    await request<{ requests: Maintenance[] }>(
      `/properties/${propertyA.id}/maintenance`,
      { client: outsider },
    )
  ).payload.requests;
  assert.deepEqual(
    tenantTickets.map((item) => item.id),
    [ticket.id],
  );
  assert.deepEqual(
    otherTickets.map((item) => item.id),
    [otherTicket.payload.request.id],
  );
  expectError(
    await request(`/maintenance/${otherTicket.payload.request.id}`, {
      method: "PATCH",
      client: tenant,
      body: { version: 1, message: "Unauthorized cross-tenant comment" },
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(
      `/properties/${propertyA.id}/tenants/${outsider.account.id}`,
      {
        method: "DELETE",
        client: tenant,
        body: {},
      },
    ),
    404,
    "NOT_FOUND",
  );
  const removed = await request<{ removed: boolean }>(
    `/properties/${propertyA.id}/tenants/${outsider.account.id}`,
    {
      method: "DELETE",
      client: owner,
      body: {},
    },
  );
  assert.equal(removed.payload.removed, true);
  expectError(
    await request(`/properties/${propertyA.id}/maintenance`, {
      client: outsider,
    }),
    404,
    "NOT_FOUND",
  );
  expectError(
    await request(`/maintenance/${otherTicket.payload.request.id}`, {
      method: "PATCH",
      client: outsider,
      body: { version: 1, message: "Former tenant cannot continue" },
    }),
    404,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await request<{ requests: Maintenance[] }>(
        `/properties/${propertyA.id}/maintenance`,
        { client: owner },
      )
    ).payload.requests.length,
    2,
  );
  passed(
    "tenants cannot read or mutate each other's tickets; removing access takes effect immediately and preserves owner audit records",
  );

  await stop();
  await start();
  const ownerWorkspaces = (
    await request<{ workspaces: Workspace[] }>("/workspaces", { client: owner })
  ).payload.workspaces;
  assert.equal(ownerWorkspaces[0]?.properties.length, 2);
  assert.equal(
    ownerWorkspaces[0]?.properties.find((item) => item.id === propertyA.id)
      ?.name,
    "Apartment A updated",
  );
  const restoredTicket = (
    await request<{ requests: Maintenance[] }>(
      `/properties/${propertyA.id}/maintenance`,
      { client: tenant },
    )
  ).payload.requests[0];
  assert.deepEqual(restoredTicket, resolved.payload.request);
  assert.deepEqual(
    (
      await request<{ workspaces: Workspace[] }>("/workspaces", {
        client: outsider,
      })
    ).payload.workspaces,
    [],
  );
  passed(
    "properties, assignments, maintenance history and access removal persist across server restart",
  );

  // Fill only known test records, then verify writes cannot partially exceed caps.
  for (let index = 2; index < 25; index += 1) {
    assert.equal(
      (
        await request(`/properties/${propertyA.id}/maintenance`, {
          method: "POST",
          client: owner,
          body: {
            title: `Bounded local record ${index}`,
            description: "Capacity fixture",
            priority: "normal",
          },
        })
      ).response.status,
      201,
    );
  }
  expectError(
    await request(`/properties/${propertyA.id}/maintenance`, {
      method: "POST",
      client: owner,
      body: {
        title: "Beyond capacity",
        description: "Must not be inserted",
        priority: "normal",
      },
    }),
    409,
    "LIMIT_REACHED",
  );
  assert.equal(
    (
      await request<{ requests: Maintenance[] }>(
        `/properties/${propertyA.id}/maintenance`,
        { client: owner },
      )
    ).payload.requests.length,
    25,
  );
  await stop();
  const historyDatabase = new DatabaseSync(databasePath);
  const existingCount = Number(
    historyDatabase
      .prepare(
        "SELECT count(*) AS count FROM local_maintenance_history WHERE request_id = ?",
      )
      .get(ticket.id)?.count,
  );
  const insertHistory = historyDatabase.prepare(
    "INSERT INTO local_maintenance_history(id,request_id,actor_id,actor_name,kind,message,status,sequence,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
  );
  for (let sequence = existingCount + 1; sequence <= 49; sequence += 1) {
    insertHistory.run(
      randomUUID(),
      ticket.id,
      owner.account.id,
      "Owner",
      "comment",
      "Bounded history fixture",
      "resolved",
      sequence,
      Date.now(),
    );
  }
  historyDatabase.close();
  await start();
  expectError(
    await request(`/maintenance/${ticket.id}`, {
      method: "PATCH",
      client: owner,
      body: {
        version: 4,
        status: "in_progress",
        message: "Two events would exceed capacity",
      },
    }),
    409,
    "LIMIT_REACHED",
  );
  const unchanged = (
    await request<{ requests: Maintenance[] }>(
      `/properties/${propertyA.id}/maintenance`,
      { client: tenant },
    )
  ).payload.requests[0];
  assert.equal(unchanged.version, 4);
  assert.equal(unchanged.status, "resolved");
  assert.equal(unchanged.history.length, 49);
  const finalComment = await request<{ request: Maintenance }>(
    `/maintenance/${ticket.id}`,
    {
      method: "PATCH",
      client: owner,
      body: { version: 4, message: "The final allowed event" },
    },
  );
  assert.equal(finalComment.response.status, 200);
  assert.equal(finalComment.payload.request.history.length, 50);
  assert.equal(finalComment.payload.request.version, 5);
  expectError(
    await request(`/maintenance/${ticket.id}`, {
      method: "PATCH",
      client: owner,
      body: { version: 5, status: "in_progress" },
    }),
    409,
    "LIMIT_REACHED",
  );
  const capped = (
    await request<{ requests: Maintenance[] }>(
      `/properties/${propertyA.id}/maintenance`,
      { client: tenant },
    )
  ).payload.requests[0];
  assert.equal(capped.version, 5);
  assert.equal(capped.status, "resolved");
  assert.equal(capped.history.length, 50);
  passed(
    "local record limits fail explicitly and multi-event history writes are atomic at the capacity boundary",
  );

  await stop();
  const legacy = await createVersionOneFixture();
  await start(migrationPath);
  const restored = await request<AccountPayload>("/session", {
    headers: { Cookie: legacy.cookie },
  });
  assert.equal(restored.payload.account?.id, legacy.id);
  assert.equal(restored.payload.account?.displayName, "Existing profile");
  assert.equal(restored.payload.account?.locale, "fr");
  assert.equal(restored.payload.account?.version, 3);
  const login = await request<AccountPayload>("/login", {
    method: "POST",
    body: { email: "migration@example.invalid", password },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.account?.id, legacy.id);
  await stop();
  const migrated = new DatabaseSync(migrationPath);
  assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 6);
  assert.equal(
    migrated.prepare("SELECT count(*) AS count FROM accounts").get()?.count,
    1,
  );
  assert.ok(
    Number(
      migrated.prepare("SELECT count(*) AS count FROM account_sessions").get()
        ?.count,
    ) >= 1,
  );
  migrated.close();
  passed(
    "version-one accounts, password hashes, profile versions and sessions survive migration to version six",
  );
  console.log(
    `Workspace integration checks passed (${checks} groups; local test identities only).`,
  );
} finally {
  await stop();
  const allowed = new Set(
    ["workspaces", "migration"].flatMap((name) =>
      [".sqlite", ".sqlite-wal", ".sqlite-shm", ".sqlite-journal"].map(
        (suffix) => `${name}${suffix}`,
      ),
    ),
  );
  const entries = readdirSync(directory);
  assert.ok(entries.length <= allowed.size);
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = lstatSync(path);
    assert.ok(allowed.has(entry) && info.isFile() && !info.isSymbolicLink());
  }
  for (const entry of entries) unlinkSync(join(directory, entry));
  const folder = lstatSync(directory);
  assert.ok(folder.isDirectory() && !folder.isSymbolicLink());
  rmdirSync(directory);
}
