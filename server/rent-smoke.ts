import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import {
  constants,
  copyFileSync,
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
  savedNotificationsSchema,
  type SavedNotification,
} from "../src/platform/documentNotificationContracts.ts";
import {
  persistedRentDetailSchema,
  persistedRentListSchema,
  persistedRentMutationSchema,
  type PersistedRentRecord as RentRecord,
  type PersistedRentSummary as RecordSummary,
  type PersistedRentSnapshot as Snapshot,
} from "../src/platform/persistedRentContracts.ts";
interface Mutation {
  record: RentRecord;
  replayed: boolean;
}
interface Client {
  account: PublicAccount;
  cookie: string;
  csrfToken: string;
}
interface Session {
  account: PublicAccount | null;
  csrfToken: string | null;
}
interface Page {
  records: RecordSummary[];
  nextCursor: string | null;
}
interface Notifications {
  notifications: SavedNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

const directory = mkdtempSync(join(tmpdir(), "kasa-rent-smoke-"));
const databasePath = join(directory, "rent.sqlite");
const migrationPath = join(directory, "migration.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Synthetic-rent-only-password-123";
const pdf = Buffer.from("%PDF-1.4\nSynthetic test document only\n%%EOF\n");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Luanda",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const future = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
  .toISOString()
  .slice(0, 10);
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let base = "";
let checks = 0;

async function start(path = databasePath) {
  service = createAccountRouter({
    databasePath: path,
    allowedOrigins: [origin],
  });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "rent-smoke";
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
  base = `http://127.0.0.1:${address.port}/api/v1/account`;
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
async function group(label: string) {
  checks += 1;
  console.log(`✓ ${label}`);
  await stop();
  await start();
}
async function request<T = unknown>(
  path: string,
  options: {
    client?: Client;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    omitOrigin?: boolean;
    omitCsrf?: boolean;
  } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.omitOrigin ? {} : { Origin: origin }),
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.client
        ? {
            Cookie: options.client.cookie,
            "X-Kasa-Account-Id": options.client.account.id,
          }
        : {}),
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
  assert.equal(JSON.stringify(payload).includes(password), false);
  assert.equal(JSON.stringify(payload).includes(databasePath), false);
  if (response.ok && path.split("?", 1)[0] === "/notifications")
    savedNotificationsSchema.parse(payload);
  if (response.ok && /^\/properties\/[^/]+\/rent-records(?:\?|$)/.test(path))
    (options.method === "POST"
      ? persistedRentMutationSchema
      : persistedRentListSchema
    ).parse(payload);
  if (response.ok && /^\/rent-records\//.test(path))
    (options.method
      ? persistedRentMutationSchema
      : persistedRentDetailSchema
    ).parse(payload);
  return { response, payload };
}
function failure(
  result: { response: Response; payload: unknown },
  status: number,
  code?: string,
) {
  assert.equal(result.response.status, status, JSON.stringify(result.payload));
  const error = result.payload as {
    error: { code: string; message: string };
    requestId: string;
  };
  if (code) assert.equal(error.error.code, code);
  assert.equal(typeof error.error.message, "string");
  assert.equal(error.requestId, "rent-smoke");
}
async function register(name: string): Promise<Client> {
  const result = await request<Session>("/register", {
    method: "POST",
    body: {
      displayName: name,
      email: `${name}@example.invalid`,
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
    csrfToken: result.payload.csrfToken,
    cookie: cookie.split(";")[0],
  };
}
async function detail(id: string, client: Client) {
  const result = await request<{ record: RentRecord }>(`/rent-records/${id}`, {
    client,
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  return result.payload.record;
}
async function list(propertyId: string, client: Client, query = "") {
  const result = await request<Page>(
    `/properties/${propertyId}/rent-records${query}`,
    { client },
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  return result.payload;
}
async function alerts(client: Client) {
  const result = await request<Notifications>("/notifications", { client });
  assert.equal(result.response.status, 200);
  return result.payload;
}
function creation(tenant: Client, extra: Record<string, unknown> = {}) {
  const mutationId: string = randomUUID();
  return {
    mutationId,
    tenantAccountId: tenant.account.id,
    period: "2024-02",
    currency: "AOA",
    amountDueMinor: 1234567,
    dueOn: "2024-02-29",
    ...extra,
  };
}
function transfer(record: RentRecord, extra: Record<string, unknown> = {}) {
  return {
    mutationId: randomUUID(),
    version: record.version,
    amountMinor: record.amountDueMinor,
    transferredOn: today,
    reference: "  SYNTHETIC-TRANSFER-ONLY  ",
    note: "  Invented payment details, no banking action.  ",
    ...extra,
  };
}
async function createDue(
  propertyId: string,
  client: Client,
  body: ReturnType<typeof creation>,
) {
  const result = await request<Mutation>(
    `/properties/${propertyId}/rent-records`,
    { method: "POST", client, body },
  );
  assert.equal(
    result.response.status,
    result.payload.replayed ? 200 : 201,
    JSON.stringify(result.payload),
  );
  return result.payload;
}
async function action(
  record: RentRecord,
  client: Client,
  operation: "transfer" | "review" | "void",
  body: Record<string, unknown>,
) {
  return request<Mutation>(`/rent-records/${record.id}/${operation}`, {
    method: "POST",
    client,
    body: { mutationId: randomUUID(), version: record.version, ...body },
  });
}
function snapshot(record: RentRecord): Snapshot {
  return {
    amountDueMinor: record.amountDueMinor,
    dueOn: record.dueOn,
    status: record.status,
    transfer: record.transfer,
    correctionReason: record.correctionReason,
    voidReason: record.voidReason,
    confirmedAt: record.confirmedAt,
  };
}
function changed(
  before: RentRecord,
  after: RentRecord,
  actor: Client,
  kind: string,
) {
  assert.equal(after.version, before.version + 1);
  assert.deepEqual(after.history.slice(0, -1), before.history);
  const event = after.history.at(-1)!;
  assert.equal(event.actorId, actor.account.id);
  assert.equal(event.actorName, actor.account.displayName);
  assert.equal(event.kind, kind);
  assert.equal(event.version, after.version);
  assert.deepEqual(event.before, snapshot(before));
  assert.deepEqual(event.after, snapshot(after));
}

try {
  await start();
  const owner = await register("rent-owner");
  const tenant = await register("rent-tenant");
  const other = await register("rent-other-tenant");
  const workspace = (
    await request<{ workspace: { id: string } }>("/workspaces", {
      method: "POST",
      client: owner,
      body: { name: "Synthetic rent portfolio" },
    })
  ).payload.workspace;
  async function property(name: string) {
    const result = await request<{ property: { id: string } }>(
      `/workspaces/${workspace.id}/properties`,
      {
        method: "POST",
        client: owner,
        body: { name, address: "Invented address for local tests" },
      },
    );
    assert.equal(result.response.status, 201);
    return result.payload.property;
  }
  const home = await property("Rent fixture home");
  const unassigned = await property("Unassigned rent fixture");
  async function connect(client: Client, propertyId = home.id) {
    const invitation = (
      await request<{ invitation: { code: string } }>(
        `/properties/${propertyId}/invitations`,
        {
          method: "POST",
          client: owner,
          body: { accountId: client.account.id },
        },
      )
    ).payload.invitation;
    assert.equal(
      (
        await request("/invitations/accept", {
          method: "POST",
          client,
          body: { code: invitation.code },
        })
      ).response.status,
      200,
    );
  }
  await connect(tenant);
  await connect(other);
  failure(
    await request(`/properties/${home.id}/rent-records`),
    401,
    "AUTH_REQUIRED",
  );
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      body: creation(tenant),
    }),
    401,
    "AUTH_REQUIRED",
  );
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      omitCsrf: true,
      body: creation(tenant),
    }),
    403,
    "CSRF_DENIED",
  );
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      omitOrigin: true,
      body: creation(tenant),
    }),
    403,
    "ORIGIN_DENIED",
  );
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      headers: {
        "X-Kasa-Account-Id": tenant.account.id,
        "X-CSRF-Token": "wrong",
      },
      body: creation(tenant),
    }),
    401,
    "ACCOUNT_CHANGED",
  );
  const forbiddenCreate = await request(`/properties/${home.id}/rent-records`, {
    method: "POST",
    client: tenant,
    body: creation(tenant),
  });
  assert.ok([403, 404].includes(forbiddenCreate.response.status));
  failure(
    await request(`/properties/${unassigned.id}/rent-records`, {
      client: tenant,
    }),
    404,
    "NOT_FOUND",
  );
  await group(
    "rent records require current saved-account identity, owner authority, origin and CSRF; public roles cannot grant access",
  );

  const invalidCreate = [
    { amountDueMinor: 0 },
    { amountDueMinor: -1 },
    { amountDueMinor: 1.1 },
    { amountDueMinor: "123" },
    { amountDueMinor: 100000000001 },
    { currency: "EUR" },
    { period: "2024-2" },
    { period: "2024-13" },
    { dueOn: "2024-02-30" },
    { dueOn: "2023-02-29" },
    { dueOn: "2024-03-01" },
    { dueOn: "2024-02-29T00:00:00Z" },
    { mutationId: "bad" },
    { ownerId: owner.account.id },
    { status: "confirmed" },
  ];
  for (const extra of invalidCreate)
    failure(
      await request(`/properties/${home.id}/rent-records`, {
        method: "POST",
        client: owner,
        body: creation(tenant, extra),
      }),
      422,
      "VALIDATION_ERROR",
    );
  const createBody = creation(tenant);
  let due = (await createDue(home.id, owner, createBody)).record;
  assert.equal(due.currency, "AOA");
  assert.equal(due.amountDueMinor, 1234567);
  assert.equal(due.status, "awaiting_transfer");
  assert.equal(due.tenantAccessActive, true);
  assert.equal(due.transfer, null);
  assert.equal(due.version, 1);
  assert.equal(due.history.length, 1);
  assert.equal(due.history[0].kind, "created");
  assert.equal(due.history[0].actorId, owner.account.id);
  assert.equal(due.history[0].before, null);
  assert.deepEqual(due.history[0].after, snapshot(due));
  const replay = await createDue(home.id, owner, createBody);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.record, due);
  const uppercaseReplay = await createDue(home.id, owner, {
    ...createBody,
    mutationId: createBody.mutationId.toUpperCase(),
    tenantAccountId: tenant.account.id.toUpperCase(),
  });
  assert.equal(uppercaseReplay.replayed, true);
  assert.deepEqual(uppercaseReplay.record, due);
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      body: creation(tenant),
    }),
    409,
    "DUPLICATE_PERIOD",
  );
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      body: { ...createBody, amountDueMinor: 99 },
    }),
    409,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal((await list(home.id, tenant)).records.length, 1);
  assert.equal((await list(home.id, other)).records.length, 0);
  failure(
    await request(`/rent-records/${due.id}`, { client: other }),
    404,
    "NOT_FOUND",
  );
  const summary = (await list(home.id, owner)).records[0];
  assert.equal(Object.hasOwn(summary, "history"), false);
  assert.equal(
    (await alerts(tenant)).notifications.filter(
      (item) => item.resourceId === due.id,
    ).length,
    1,
  );
  assert.equal((await alerts(owner)).notifications.length, 0);
  assert.equal((await alerts(other)).notifications.length, 0);
  await group(
    "monthly dues use exact AOA minor units and valid calendar dates; duplicates, client-forged fields and cross-tenant reads are refused",
  );

  const editBody = {
    mutationId: randomUUID(),
    version: due.version,
    amountDueMinor: 2345678,
    dueOn: "2024-02-28",
  };
  const edited = await request<Mutation>(`/rent-records/${due.id}`, {
    method: "PATCH",
    client: owner,
    body: editBody,
  });
  assert.equal(edited.response.status, 200);
  changed(due, edited.payload.record, owner, "terms_updated");
  due = edited.payload.record;
  const editReplay = await request<Mutation>(`/rent-records/${due.id}`, {
    method: "PATCH",
    client: owner,
    body: editBody,
  });
  assert.equal(editReplay.response.status, 200);
  assert.equal(editReplay.payload.replayed, true);
  assert.deepEqual(editReplay.payload.record, due);
  const noOp = await request<Mutation>(`/rent-records/${due.id}`, {
    method: "PATCH",
    client: owner,
    body: {
      mutationId: randomUUID(),
      version: due.version,
      amountDueMinor: due.amountDueMinor,
      dueOn: due.dueOn,
    },
  });
  assert.equal(noOp.response.status, 200);
  assert.deepEqual(noOp.payload.record, due);
  failure(
    await request(`/rent-records/${due.id}`, {
      method: "PATCH",
      client: owner,
      body: { ...editBody, mutationId: randomUUID() },
    }),
    409,
    "VERSION_CONFLICT",
  );
  const tenantEdit = await request(`/rent-records/${due.id}`, {
    method: "PATCH",
    client: tenant,
    body: { ...editBody, mutationId: randomUUID(), version: due.version },
  });
  assert.ok([403, 404].includes(tenantEdit.response.status));
  const beforeTransfer = due;
  const reportBody = transfer(due, {
    amountMinor: due.amountDueMinor - 1,
    mutationId: createBody.mutationId,
  });
  const reported = await action(due, tenant, "transfer", reportBody);
  assert.equal(reported.response.status, 200);
  changed(due, reported.payload.record, tenant, "transfer_reported");
  due = reported.payload.record;
  assert.equal(due.status, "awaiting_confirmation");
  failure(
    await action(due, owner, "review", {
      decision: "request_correction",
      reason: "Reused owner create key",
      mutationId: createBody.mutationId,
    }),
    409,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(due.transfer?.reference, "SYNTHETIC-TRANSFER-ONLY");
  assert.equal(
    due.transfer?.note,
    "Invented payment details, no banking action.",
  );
  failure(
    await action(due, owner, "review", { decision: "confirm" }),
    409,
    "AMOUNT_MISMATCH",
  );
  failure(
    await action(due, tenant, "review", { decision: "confirm" }),
    403,
    "FORBIDDEN",
  );
  failure(
    await action(beforeTransfer, other, "transfer", transfer(beforeTransfer)),
    404,
    "NOT_FOUND",
  );
  failure(
    await action(due, owner, "transfer", transfer(due)),
    403,
    "FORBIDDEN",
  );
  failure(
    await request(`/rent-records/${due.id}`, {
      method: "PATCH",
      client: owner,
      body: {
        mutationId: randomUUID(),
        version: due.version,
        amountDueMinor: due.transfer!.amountMinor,
        dueOn: due.dueOn,
      },
    }),
    409,
    "INVALID_STATE",
  );
  const reportReplay = await action(
    beforeTransfer,
    tenant,
    "transfer",
    reportBody,
  );
  assert.equal(reportReplay.response.status, 200);
  assert.equal(reportReplay.payload.replayed, true);
  assert.deepEqual(reportReplay.payload.record, due);
  failure(
    await action(beforeTransfer, tenant, "transfer", {
      ...reportBody,
      mutationId: randomUUID(),
    }),
    409,
    "VERSION_CONFLICT",
  );
  await group(
    "only the owner edits never-reported terms; tenant reports preserve exact amounts and owners cannot confirm mismatches or rewrite due amounts afterward",
  );

  for (const extra of [
    { amountMinor: 0 },
    { amountMinor: 1.01 },
    { amountMinor: 100000000001 },
    { transferredOn: future },
    { transferredOn: "2023-02-29" },
    { transferredOn: "2024-02-30" },
    { reference: " " },
    { reference: "two\nlines" },
    { reference: "x".repeat(101) },
    { note: "x".repeat(1001) },
    { tenantAccountId: other.account.id },
  ])
    failure(
      await action(due, tenant, "transfer", transfer(due, extra)),
      422,
      "VALIDATION_ERROR",
    );
  failure(
    await action(due, owner, "review", {
      decision: "request_correction",
      reason: " ",
    }),
    422,
    "VALIDATION_ERROR",
  );
  failure(
    await action(due, owner, "review", {
      decision: "request_correction",
      reason: "x".repeat(501),
    }),
    422,
    "VALIDATION_ERROR",
  );
  const correctionBody = {
    mutationId: randomUUID(),
    version: due.version,
    decision: "request_correction",
    reason: "  Please correct the exact transfer amount.  ",
  };
  const corrected = await action(due, owner, "review", correctionBody);
  assert.equal(corrected.response.status, 200);
  changed(due, corrected.payload.record, owner, "correction_requested");
  due = corrected.payload.record;
  assert.equal(due.status, "needs_correction");
  assert.equal(
    due.correctionReason,
    "Please correct the exact transfer amount.",
  );
  failure(
    await action(due, owner, "review", { decision: "confirm" }),
    409,
    "INVALID_STATE",
  );
  const revisedBody = transfer(due);
  const revised = await action(due, tenant, "transfer", revisedBody);
  assert.equal(revised.response.status, 200);
  changed(due, revised.payload.record, tenant, "transfer_reported");
  due = revised.payload.record;
  assert.equal(due.correctionReason, null);
  const confirmedBody = {
    mutationId: randomUUID(),
    version: due.version,
    decision: "confirm",
  };
  const confirmed = await action(due, owner, "review", confirmedBody);
  assert.equal(confirmed.response.status, 200);
  changed(due, confirmed.payload.record, owner, "confirmed");
  due = confirmed.payload.record;
  assert.equal(due.status, "confirmed");
  assert.ok(due.confirmedAt);
  const finalSnapshot = JSON.stringify(due);
  const historicalRetry = await action(
    beforeTransfer,
    tenant,
    "transfer",
    reportBody,
  );
  assert.equal(historicalRetry.response.status, 200);
  assert.equal(historicalRetry.payload.replayed, true);
  assert.deepEqual(historicalRetry.payload.record, due);
  failure(
    await action(due, tenant, "transfer", transfer(due)),
    409,
    "INVALID_STATE",
  );
  failure(
    await action(due, owner, "void", {
      reason: "Cannot rewrite confirmed record",
    }),
    409,
    "INVALID_STATE",
  );
  failure(
    await action(due, owner, "review", {
      decision: "request_correction",
      reason: "Cannot reopen",
    }),
    409,
    "INVALID_STATE",
  );
  assert.equal(JSON.stringify(await detail(due.id, owner)), finalSnapshot);
  assert.equal((await alerts(other)).notifications.length, 0);
  const ownerNotifications = await alerts(owner);
  assert.equal(
    JSON.stringify(ownerNotifications).includes("SYNTHETIC-TRANSFER"),
    false,
  );
  assert.equal(
    JSON.stringify(ownerNotifications).includes("Invented payment details"),
    false,
  );
  await group(
    "correction and exact-amount confirmation create immutable before/after audit events; confirmed rows remain terminal and retries return the current authorized record",
  );

  const voidCreate = creation(tenant, {
    period: "2024-03",
    dueOn: "2024-03-01",
    amountDueMinor: 1,
  });
  let voidDue = (await createDue(home.id, owner, voidCreate)).record;
  failure(
    await action(voidDue, tenant, "void", { reason: "Tenant cannot void" }),
    403,
    "FORBIDDEN",
  );
  failure(
    await action(voidDue, owner, "void", { reason: " " }),
    422,
    "VALIDATION_ERROR",
  );
  const voidBody = {
    mutationId: randomUUID(),
    version: voidDue.version,
    reason: "  Replace mistaken monthly terms.  ",
  };
  const voided = await action(voidDue, owner, "void", voidBody);
  assert.equal(voided.response.status, 200);
  changed(voidDue, voided.payload.record, owner, "voided");
  voidDue = voided.payload.record;
  assert.equal(voidDue.status, "voided");
  assert.equal(voidDue.voidReason, "Replace mistaken monthly terms.");
  const replacement = (
    await createDue(home.id, owner, {
      ...voidCreate,
      mutationId: randomUUID(),
      amountDueMinor: 100000000000,
    })
  ).record;
  assert.notEqual(replacement.id, voidDue.id);
  assert.equal(replacement.amountDueMinor, 100000000000);
  const voidReplay = await action(voidDue, owner, "void", voidBody);
  assert.equal(voidReplay.response.status, 200);
  assert.equal(voidReplay.payload.replayed, true);
  failure(
    await action(voidDue, tenant, "transfer", transfer(voidDue)),
    409,
    "INVALID_STATE",
  );
  failure(await createRequest(createBody), 409, "DUPLICATE_PERIOD");
  async function createRequest(body: ReturnType<typeof creation>) {
    return request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      body: { ...body, mutationId: randomUUID() },
    });
  }
  await group(
    "voiding requires an owner reason, keeps history and permits an explicit replacement; confirmed months still reject duplicate dues",
  );

  // Evidence is an already-shared private document, never an implicit upload/share or payment action.
  async function upload(
    client: Client,
    propertyId: string,
    sharing: "private" | "shared" = "private",
    recipientAccountId?: string,
  ) {
    const result = await request<{
      document: { id: string; version: number; title: string };
    }>(`/properties/${propertyId}/documents`, {
      method: "POST",
      client,
      body: {
        title: "Synthetic transfer evidence",
        filename: "evidence.pdf",
        mimeType: "application/pdf",
        contentBase64: pdf.toString("base64"),
        sharing,
        ...(recipientAccountId ? { recipientAccountId } : {}),
      },
    });
    assert.equal(result.response.status, 201);
    return result.payload.document;
  }
  const privateEvidence = await upload(tenant, home.id);
  const sharedEvidence = await upload(tenant, home.id, "shared");
  const otherEvidence = await upload(other, home.id, "shared");
  const ownerEvidence = await upload(
    owner,
    home.id,
    "shared",
    tenant.account.id,
  );
  const evidenceDue = (
    await createDue(
      home.id,
      owner,
      creation(tenant, { period: "2024-04", dueOn: "2024-04-01" }),
    )
  ).record;
  for (const evidenceDocumentId of [
    privateEvidence.id,
    otherEvidence.id,
    ownerEvidence.id,
    randomUUID(),
  ])
    failure(
      await action(
        evidenceDue,
        tenant,
        "transfer",
        transfer(evidenceDue, { evidenceDocumentId }),
      ),
      422,
      "INVALID_EVIDENCE",
    );
  const withEvidence = await action(
    evidenceDue,
    tenant,
    "transfer",
    transfer(evidenceDue, { evidenceDocumentId: sharedEvidence.id }),
  );
  assert.equal(withEvidence.response.status, 200);
  assert.equal(
    withEvidence.payload.record.transfer?.evidenceDocumentId,
    sharedEvidence.id,
  );
  const privateList = await request<{
    documents: { id: string; sharing: string }[];
  }>(`/properties/${home.id}/documents`, { client: tenant });
  assert.equal(
    privateList.payload.documents.find((item) => item.id === privateEvidence.id)
      ?.sharing,
    "private",
  );
  const unshare = await request<{
    document: { id: string; version: number; title: string };
  }>(`/documents/${sharedEvidence.id}`, {
    method: "PATCH",
    client: tenant,
    body: {
      version: sharedEvidence.version,
      title: sharedEvidence.title,
      sharing: "private",
      archived: false,
    },
  });
  assert.equal(unshare.response.status, 200);
  assert.equal(
    (await detail(evidenceDue.id, owner)).transfer?.evidenceDocumentId,
    sharedEvidence.id,
  );
  assert.equal(
    (
      await fetch(`${base}/documents/${sharedEvidence.id}/content`, {
        headers: {
          Cookie: owner.cookie,
          "X-Kasa-Account-Id": owner.account.id,
        },
      })
    ).status,
    404,
  );
  const sharedAgain = await request<{ document: { version: number } }>(
    `/documents/${sharedEvidence.id}`,
    {
      method: "PATCH",
      client: tenant,
      body: {
        version: unshare.payload.document.version,
        title: sharedEvidence.title,
        sharing: "shared",
        archived: false,
      },
    },
  );
  assert.equal(sharedAgain.response.status, 200);
  const archivedEvidence = await request(`/documents/${sharedEvidence.id}`, {
    method: "PATCH",
    client: tenant,
    body: {
      version: sharedAgain.payload.document.version,
      title: sharedEvidence.title,
      sharing: "shared",
      archived: true,
    },
  });
  assert.equal(archivedEvidence.response.status, 200);
  assert.equal(
    (
      await fetch(`${base}/documents/${sharedEvidence.id}/content`, {
        headers: {
          Cookie: owner.cookie,
          "X-Kasa-Account-Id": owner.account.id,
        },
      })
    ).status,
    404,
  );
  failure(
    await action(
      withEvidence.payload.record,
      tenant,
      "transfer",
      transfer(withEvidence.payload.record, {
        evidenceDocumentId: sharedEvidence.id,
      }),
    ),
    422,
    "INVALID_EVIDENCE",
  );
  await connect(tenant, unassigned.id);
  const foreignEvidence = await upload(tenant, unassigned.id, "shared");
  failure(
    await action(
      withEvidence.payload.record,
      tenant,
      "transfer",
      transfer(withEvidence.payload.record, {
        evidenceDocumentId: foreignEvidence.id,
      }),
    ),
    422,
    "INVALID_EVIDENCE",
  );
  await group(
    "evidence must be the tenant's active same-property document already shared to the owner; recording rent never silently shares private files",
  );

  const removedCreate = creation(tenant, {
    period: "2024-05",
    dueOn: "2024-05-01",
  });
  let removedDue = (await createDue(home.id, owner, removedCreate)).record;
  const removedReport = transfer(removedDue);
  const removedReported = await action(
    removedDue,
    tenant,
    "transfer",
    removedReport,
  );
  assert.equal(removedReported.response.status, 200);
  removedDue = removedReported.payload.record;
  const oldAlertIds = (await alerts(tenant)).notifications
    .filter((item) => item.resourceId === removedDue.id)
    .map((item) => item.id);
  assert.ok(oldAlertIds.length);
  assert.equal(
    (
      await request(`/properties/${home.id}/tenants/${tenant.account.id}`, {
        method: "DELETE",
        client: owner,
        body: {},
      })
    ).response.status,
    200,
  );
  failure(
    await request(`/rent-records/${removedDue.id}`, { client: tenant }),
    404,
    "NOT_FOUND",
  );
  failure(
    await action(removedDue, tenant, "transfer", removedReport),
    404,
    "NOT_FOUND",
  );
  const ownerRetained = await detail(removedDue.id, owner);
  assert.equal(ownerRetained.tenantAccessActive, false);
  assert.deepEqual(ownerRetained.history, removedDue.history);
  const confirmRemoved = await action(ownerRetained, owner, "review", {
    decision: "confirm",
  });
  assert.ok([403, 409].includes(confirmRemoved.response.status));
  await connect(tenant);
  failure(
    await request(`/rent-records/${removedDue.id}`, { client: tenant }),
    404,
    "NOT_FOUND",
  );
  failure(
    await action(removedDue, tenant, "transfer", removedReport),
    404,
    "NOT_FOUND",
  );
  assert.equal((await list(home.id, tenant)).records.length, 0);
  assert.equal(
    (await alerts(tenant)).notifications.some((item) =>
      oldAlertIds.includes(item.id),
    ),
    false,
  );
  const postRejoin = await detail(removedDue.id, owner);
  assert.equal(postRejoin.tenantAccessActive, false);
  const removedVoided = await action(postRejoin, owner, "void", {
    reason: "Close record after assignment ended",
  });
  assert.equal(removedVoided.response.status, 200);
  assert.equal(removedVoided.payload.record.status, "voided");
  const newMembershipDue = (
    await createDue(home.id, owner, {
      ...removedCreate,
      mutationId: randomUUID(),
    })
  ).record;
  assert.equal(newMembershipDue.tenantAccessActive, true);
  assert.equal(
    (await detail(newMembershipDue.id, tenant)).id,
    newMembershipDue.id,
  );
  assert.equal((await list(home.id, tenant)).records.length, 1);
  await group(
    "removal permanently revokes old-rent access and retries; rejoining creates a new membership without restoring old rows or alerts, while owners retain audit and may void",
  );

  const pageHome = await property("Paginated rent history");
  await connect(tenant, pageHome.id);
  await connect(other, pageHome.id);
  const pagedRecords: RentRecord[] = [];
  for (let index = 0; index < 23; index += 1) {
    const period = `${2030 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    pagedRecords.push(
      (
        await createDue(
          pageHome.id,
          owner,
          creation(tenant, { period, dueOn: `${period}-01` }),
        )
      ).record,
    );
  }
  const otherDue = (
    await createDue(
      pageHome.id,
      owner,
      creation(other, { period: "2030-01", dueOn: "2030-01-01" }),
    )
  ).record;
  await stop();
  const paginationFixture = new DatabaseSync(databasePath);
  paginationFixture
    .prepare("UPDATE local_rent_records SET created_at=? WHERE property_id=?")
    .run(Date.now(), pageHome.id);
  paginationFixture.close();
  await start();
  const pageOne = await list(pageHome.id, tenant);
  assert.equal(pageOne.records.length, 20);
  assert.ok(pageOne.nextCursor);
  const pageTwo = await list(
    pageHome.id,
    tenant,
    `?before=${encodeURIComponent(pageOne.nextCursor)}`,
  );
  assert.equal(pageTwo.records.length, 3);
  assert.equal(pageTwo.nextCursor, null);
  assert.deepEqual(
    [...pageOne.records, ...pageTwo.records].map((record) => record.id),
    pagedRecords
      .map((record) => record.id)
      .toSorted()
      .reverse(),
  );
  assert.ok(
    [...pageOne.records, ...pageTwo.records].every(
      (record) => !Object.hasOwn(record, "history"),
    ),
  );
  assert.deepEqual(
    (await list(pageHome.id, other)).records.map((record) => record.id),
    [otherDue.id],
  );
  for (const before of [
    "bad",
    `-1:${randomUUID()}`,
    `99999999999999999:${randomUUID()}`,
    "1:wrong",
  ])
    failure(
      await request(
        `/properties/${pageHome.id}/rent-records?before=${encodeURIComponent(before)}`,
        { client: tenant },
      ),
      422,
      "VALIDATION_ERROR",
    );
  failure(
    await request(`/properties/${pageHome.id}/rent-records?role=owner`, {
      client: tenant,
    }),
    422,
    "VALIDATION_ERROR",
  );
  await group(
    "20-record cursor pages remain tenant-scoped with tied timestamps and no skipped or duplicate rows; summaries do not embed full history",
  );

  const atomicCreate = creation(tenant, {
    period: "2024-06",
    dueOn: "2024-06-01",
  });
  let atomicDue = (await createDue(home.id, owner, atomicCreate)).record;
  const atomicBody = transfer(atomicDue);
  const initialAtomic = JSON.stringify(atomicDue);
  await stop();
  const faultFixture = new DatabaseSync(databasePath);
  faultFixture.exec(
    "CREATE TRIGGER smoke_fail_rent_notification BEFORE INSERT ON local_notifications WHEN NEW.kind LIKE 'rent_%' BEGIN SELECT RAISE(ABORT, 'synthetic rent notification failure'); END;",
  );
  faultFixture.close();
  await start();
  failure(await action(atomicDue, tenant, "transfer", atomicBody), 500);
  assert.equal(
    JSON.stringify(await detail(atomicDue.id, owner)),
    initialAtomic,
  );
  const failedCreate = creation(tenant, {
    period: "2024-07",
    dueOn: "2024-07-01",
  });
  failure(
    await request(`/properties/${home.id}/rent-records`, {
      method: "POST",
      client: owner,
      body: failedCreate,
    }),
    500,
  );
  assert.equal(
    (await list(home.id, owner)).records.some(
      (record) => record.period === "2024-07",
    ),
    false,
  );
  await stop();
  const clearFault = new DatabaseSync(databasePath);
  clearFault.exec("DROP TRIGGER smoke_fail_rent_notification");
  assert.equal(
    clearFault
      .prepare(
        "SELECT count(*) AS count FROM local_rent_mutations WHERE mutation_id IN (?,?)",
      )
      .get(atomicBody.mutationId, failedCreate.mutationId)?.count,
    0,
  );
  clearFault.close();
  await start();
  const atomicRetry = await action(atomicDue, tenant, "transfer", atomicBody);
  assert.equal(atomicRetry.response.status, 200);
  assert.equal(atomicRetry.payload.replayed, false);
  atomicDue = atomicRetry.payload.record;
  assert.equal((await createDue(home.id, owner, failedCreate)).replayed, false);
  assert.equal(
    (await alerts(owner)).notifications.filter(
      (item) => item.resourceId === atomicDue.id,
    ).length,
    1,
  );
  const parallelBody = {
    mutationId: randomUUID(),
    version: atomicDue.version,
    decision: "confirm",
  };
  const parallel = await Promise.all([
    action(atomicDue, owner, "review", parallelBody),
    action(atomicDue, owner, "review", parallelBody),
  ]);
  assert.ok(parallel.every((item) => item.response.status === 200));
  assert.deepEqual(parallel.map((item) => item.payload.replayed).sort(), [
    false,
    true,
  ]);
  assert.deepEqual(parallel[0].payload.record, parallel[1].payload.record);
  atomicDue = parallel[0].payload.record;
  await group(
    "rent rows, immutable history, retry receipts and notifications commit atomically; failed operations can retry safely and simultaneous identical requests mutate once",
  );

  const cappedDue = (
    await createDue(
      home.id,
      owner,
      creation(tenant, { period: "2024-08", dueOn: "2024-08-01" }),
    )
  ).record;
  await stop();
  const historyFixture = new DatabaseSync(databasePath);
  const addHistory = historyFixture.prepare(
    "INSERT INTO local_rent_history(id,record_id,actor_id,actor_name,kind,version,before_json,after_json,created_at) VALUES(?,?,?,?,'terms_updated',?,?,?,?)",
  );
  historyFixture.exec("BEGIN");
  for (let version = 2; version <= 99; version += 1)
    addHistory.run(
      randomUUID(),
      cappedDue.id,
      owner.account.id,
      owner.account.displayName,
      version,
      JSON.stringify(snapshot(cappedDue)),
      JSON.stringify(snapshot(cappedDue)),
      Date.now(),
    );
  historyFixture
    .prepare("UPDATE local_rent_records SET version=99 WHERE id=?")
    .run(cappedDue.id);
  historyFixture.exec("COMMIT");
  historyFixture.close();
  await start();
  const cappedCurrent = await detail(cappedDue.id, owner);
  assert.equal(cappedCurrent.history.length, 99);
  const cappedMutation = {
    mutationId: randomUUID(),
    version: 99,
    amountDueMinor: cappedCurrent.amountDueMinor + 1,
    dueOn: cappedCurrent.dueOn,
  };
  failure(
    await request(`/rent-records/${cappedCurrent.id}`, {
      method: "PATCH",
      client: owner,
      body: cappedMutation,
    }),
    409,
    "LIMIT_REACHED",
  );
  assert.deepEqual(await detail(cappedCurrent.id, owner), cappedCurrent);
  const closeAtCapacity = await action(cappedCurrent, owner, "void", {
    reason: "Use the reserved final event to close this record",
  });
  assert.equal(closeAtCapacity.response.status, 200);
  changed(cappedCurrent, closeAtCapacity.payload.record, owner, "voided");
  assert.equal(closeAtCapacity.payload.record.history.length, 100);
  assert.equal(closeAtCapacity.payload.record.version, 100);
  const afterCapReplacement = await createDue(
    home.id,
    owner,
    creation(tenant, {
      period: cappedCurrent.period,
      dueOn: cappedCurrent.dueOn,
    }),
  );
  assert.notEqual(afterCapReplacement.record.id, cappedCurrent.id);
  await group(
    "the history cap rejects nonterminal event100 atomically while reserving the final event for closing a record and creating an explicit replacement",
  );

  const persistedBeforeRestart = await detail(atomicDue.id, owner);
  const persistedAlerts = await alerts(tenant);
  const confirmedAlert = persistedAlerts.notifications.find(
    (item) =>
      item.resourceId === atomicDue.id && item.kind === "rent_confirmed",
  );
  assert.ok(confirmedAlert);
  assert.equal(
    (
      await request(`/notifications/${confirmedAlert.id}`, {
        method: "PATCH",
        client: tenant,
        body: { read: true },
      })
    ).response.status,
    200,
  );
  const documentBeforeMigration = await upload(
    owner,
    home.id,
    "shared",
    tenant.account.id,
  );
  const maintenance = (
    await request<{ request: { id: string } }>(
      `/properties/${home.id}/maintenance`,
      {
        method: "POST",
        client: tenant,
        body: {
          title: "Retained maintenance",
          description: "Synthetic migration fixture",
          priority: "normal",
        },
      },
    )
  ).payload.request;
  await stop();
  await start();
  assert.deepEqual(await detail(atomicDue.id, owner), persistedBeforeRestart);
  const restartReplay = await action(atomicDue, owner, "review", parallelBody);
  assert.equal(restartReplay.response.status, 200);
  assert.equal(restartReplay.payload.replayed, true);
  assert.deepEqual(restartReplay.payload.record, persistedBeforeRestart);
  assert.ok(
    (await alerts(tenant)).notifications.find(
      (item) => item.id === confirmedAlert.id,
    )?.readAt,
  );
  await stop();
  copyFileSync(databasePath, migrationPath, constants.COPYFILE_EXCL);
  const v3 = new DatabaseSync(migrationPath);
  v3.exec(
    "DROP TABLE local_viewing_mutations; DROP TABLE local_viewing_history; DROP TABLE local_viewings; DROP TABLE local_market_mutations; DROP TABLE local_market_messages; DROP TABLE local_market_participants; DROP TABLE local_market_conversations; DROP TABLE local_market_listings; DROP TABLE local_rent_mutations; DROP TABLE local_rent_history; DROP TABLE local_rent_records; DROP INDEX local_tenant_membership; ALTER TABLE local_property_tenants DROP COLUMN membership_id; DELETE FROM local_notifications WHERE kind LIKE 'rent_%'; PRAGMA user_version=3;",
  );
  const oldNotificationRows = v3
    .prepare("SELECT * FROM local_notifications ORDER BY id")
    .all();
  v3.close();
  await start(migrationPath);
  assert.equal(
    (await request<Session>("/session", { client: owner })).payload.account?.id,
    owner.account.id,
  );
  assert.equal((await list(home.id, tenant)).records.length, 0);
  const retainedBytes = await fetch(
    `${base}/documents/${documentBeforeMigration.id}/content`,
    {
      headers: {
        Cookie: tenant.cookie,
        "X-Kasa-Account-Id": tenant.account.id,
      },
    },
  );
  assert.equal(retainedBytes.status, 200);
  assert.deepEqual(Buffer.from(await retainedBytes.arrayBuffer()), pdf);
  assert.ok(
    (
      await request<{ requests: { id: string }[] }>(
        `/properties/${home.id}/maintenance`,
        { client: tenant },
      )
    ).payload.requests.some((item) => item.id === maintenance.id),
  );
  const newMigrated = await createDue(home.id, owner, creation(tenant));
  assert.equal(newMigrated.record.tenantAccessActive, true);
  await stop();
  const migrated = new DatabaseSync(migrationPath);
  assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 6);
  assert.deepEqual(
    migrated
      .prepare(
        "SELECT * FROM local_notifications WHERE kind NOT LIKE 'rent_%' ORDER BY id",
      )
      .all(),
    oldNotificationRows,
  );
  assert.ok(
    migrated
      .prepare("SELECT membership_id FROM local_property_tenants")
      .all()
      .every(
        (row) =>
          typeof row.membership_id === "string" &&
          row.membership_id.length === 36,
      ),
  );
  migrated.close();
  checks += 1;
  console.log(
    "✓ rent history, retry receipts and read state survive restart; v3→v6 preserves accounts, sessions, documents, memberships, maintenance and existing notification rows",
  );

  console.log(
    `Rent checks passed (${checks} groups; local synthetic records only).`,
  );
} finally {
  await stop();
  const allowed = new Set(
    ["rent", "migration"].flatMap((name) =>
      [".sqlite", ".sqlite-wal", ".sqlite-shm", ".sqlite-journal"].map(
        (suffix) => `${name}${suffix}`,
      ),
    ),
  );
  const entries = readdirSync(directory);
  assert.ok(entries.length <= allowed.size);
  for (const entry of entries) {
    const stat = lstatSync(join(directory, entry));
    assert.ok(allowed.has(entry) && stat.isFile() && !stat.isSymbolicLink());
  }
  for (const entry of entries) unlinkSync(join(directory, entry));
  assert.ok(lstatSync(directory).isDirectory());
  rmdirSync(directory);
}
