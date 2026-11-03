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
  savedViewingPageSchema,
  savedViewingDetailSchema,
  savedViewingMutationSchema,
  type SavedViewing,
  type SavedViewingDetail,
} from "../src/platform/persistedViewingContracts.ts";

interface Client {
  account: PublicAccount;
  cookie: string;
  csrfToken: string;
}
type Mutation = SavedViewingDetail & { replayed: boolean };
const directory = mkdtempSync(join(tmpdir(), "kasa-viewing-smoke-"));
const databasePath = join(directory, "viewings.sqlite");
const migrationPath = join(directory, "migration.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Synthetic-viewing-password-12345";
const now = Date.now;
const instant = (days = 1, minutes = 0) =>
  new Date(
    Math.ceil(now() / 60000) * 60000 + days * 86400000 + minutes * 60000,
  ).toISOString();
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let base = "";
let groups = 0;
const privateAddress = "PRIVATE VIEWING ADDRESS MUST NOT LEAK";
const identities: string[] = [];
async function start(path = databasePath) {
  service = createAccountRouter({
    databasePath: path,
    allowedOrigins: [origin],
  });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "viewing-smoke";
    next();
  });
  app.use("/api/v1/account", service.router);
  server = createServer(app);
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api/v1/account`;
}
async function stop() {
  if (server)
    await new Promise<void>((done, reject) =>
      server!.close((error) => (error ? reject(error) : done())),
    );
  server = undefined;
  service?.close();
  service = undefined;
}
async function group(label: string) {
  groups++;
  console.log(`✓ ${label}`);
  await stop();
  await start();
}
async function request<T = unknown>(
  path: string,
  client?: Client,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(client
        ? {
            Cookie: client.cookie,
            "X-CSRF-Token": client.csrfToken,
            "X-Kasa-Account-Id": client.account.id,
          }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as T;
  const text = JSON.stringify(payload);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-kasa-data-mode"), "local-persisted");
  assert.equal(text.includes(password), false);
  assert.equal(text.includes(databasePath), false);
  if (path.includes("/viewings")) {
    assert.equal(text.includes(privateAddress), false);
    assert.equal(text.includes("@example.invalid"), false);
    for (const id of identities)
      assert.equal(
        text.includes(id),
        false,
        "viewing DTOs must not expose account IDs",
      );
    if (response.ok)
      (method !== "GET"
        ? savedViewingMutationSchema
        : path.includes("/conversations/")
          ? savedViewingPageSchema
          : savedViewingDetailSchema
      ).parse(payload);
  }
  return { response, payload };
}
function failure(
  result: { response: Response; payload: unknown },
  status: number,
  code?: string,
) {
  assert.equal(result.response.status, status, JSON.stringify(result.payload));
  const error = result.payload as {
    error: { code: string };
    requestId: string;
  };
  if (code) assert.equal(error.error.code, code);
  assert.equal(error.requestId, "viewing-smoke");
}
async function register(name: string): Promise<Client> {
  const result = await request<{ account: PublicAccount; csrfToken: string }>(
    "/register",
    undefined,
    "POST",
    {
      displayName: name,
      email: `${name}@example.invalid`,
      password,
      locale: "pt",
    },
  );
  assert.equal(result.response.status, 201);
  const cookie = result.response.headers.get("set-cookie");
  assert.ok(cookie);
  identities.push(result.payload.account.id);
  return { ...result.payload, cookie: cookie.split(";")[0] };
}
function createInput(extra: object = {}) {
  return {
    mutationId: randomUUID(),
    startsAt: instant(),
    durationMinutes: 60,
    note: "Synthetic visit only",
    ...extra,
  };
}
function actionInput(
  viewing: SavedViewing,
  action: string,
  extra: object = {},
) {
  return {
    mutationId: randomUUID(),
    version: viewing.version,
    action,
    note: "",
    ...extra,
  };
}
async function detail(id: string, client: Client) {
  const result = await request<SavedViewingDetail>(
    `/market/viewings/${id}`,
    client,
  );
  assert.equal(result.response.status, 200);
  return result.payload;
}
async function create(
  conversationId: string,
  client: Client,
  input = createInput(),
) {
  const result = await request<Mutation>(
    `/market/conversations/${conversationId}/viewings`,
    client,
    "POST",
    input,
  );
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  return result.payload;
}
async function act(
  viewing: SavedViewing,
  client: Client,
  action: string,
  extra: object = {},
) {
  const result = await request<Mutation>(
    `/market/viewings/${viewing.id}/actions`,
    client,
    "POST",
    actionInput(viewing, action, extra),
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  return result.payload;
}
const listingInput = {
  title: "Synthetic viewing apartment",
  description: "Invented local listing, not an actual available property.",
  city: "Luanda",
  area: "Talatona",
  intent: "Rent",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 1,
  areaSqm: 70,
  priceMinor: 35000000,
  currency: "AOA",
  furnished: false,
  pets: "ask",
};
try {
  await start();
  const owner = await register("ViewingOwner"),
    visitor = await register("ViewingVisitor"),
    outsider = await register("ViewingOther");
  const workspace = (
    await request<{ workspace: { id: string } }>("/workspaces", owner, "POST", {
      name: "Viewing fixture workspace",
    })
  ).payload.workspace;
  async function propertyListing(intent = "Rent", existingProperty?: string) {
    const propertyId =
      existingProperty ??
      (
        await request<{ property: { id: string } }>(
          `/workspaces/${workspace.id}/properties`,
          owner,
          "POST",
          { name: "Private fixture", address: privateAddress },
        )
      ).payload.property.id;
    const created = await request<{ listing: { id: string } }>(
      "/market/listings",
      owner,
      "POST",
      { ...listingInput, intent, propertyId, mutationId: randomUUID() },
    );
    assert.equal(created.response.status, 201);
    const id = created.payload.listing.id;
    await request(`/market/listings/${id}`, owner, "PATCH", {
      ...listingInput,
      intent,
      mutationId: randomUUID(),
      version: 1,
      status: "visible",
    });
    return { id, propertyId, intent };
  }
  async function conversation(listingId: string, actor: Client) {
    const result = await request<{ conversation: { id: string } }>(
      `/market/listings/${listingId}/enquiries`,
      actor,
      "POST",
      { mutationId: randomUUID(), body: "Synthetic viewing enquiry" },
    );
    assert.equal(result.response.status, 201);
    return result.payload.conversation.id;
  }
  const listing = await propertyListing();
  const chat = await conversation(listing.id, visitor);
  const route = `/market/conversations/${chat}/viewings`;
  failure(await request(route), 401);
  failure(await request(route, undefined, "POST", createInput()), 401);
  failure(await request(route, outsider), 404, "NOT_FOUND");
  failure(
    await request(route, outsider, "POST", createInput()),
    404,
    "NOT_FOUND",
  );
  failure(await request(route, owner, "POST", createInput()), 403, "FORBIDDEN");
  failure(
    await request(route, visitor, "POST", createInput(), {
      "X-CSRF-Token": "wrong",
    }),
    403,
  );
  failure(
    await request(route, visitor, "POST", createInput(), {
      Origin: "https://evil.invalid",
    }),
    403,
  );
  failure(
    await request(route, visitor, "POST", createInput(), {
      "X-Kasa-Account-Id": owner.account.id,
    }),
    401,
  );
  await group(
    "viewing reads and writes require participant identity, CSRF, approved origin and requester authority; owner roles cannot be forged",
  );

  for (const patch of [
    { durationMinutes: 14 },
    { durationMinutes: 181 },
    { durationMinutes: 16 },
    { durationMinutes: "60" },
    { startsAt: instant(-1) },
    { startsAt: instant(181) },
    { startsAt: "2026-02-30T11:00:00.000Z" },
    { startsAt: instant().replace("Z", "+00:00") },
    { startsAt: instant().replace(":00.000Z", ":01.000Z") },
    { note: "x".repeat(1001) },
    { ownerAccountId: owner.account.id },
    { propertyId: listing.propertyId },
    { status: "confirmed" },
  ])
    failure(
      await request(route, visitor, "POST", createInput(patch)),
      422,
      "VALIDATION_ERROR",
    );
  const originalInput = createInput({ note: "  Original request  " });
  const first = await create(chat, visitor, originalInput);
  let viewing = first.viewing;
  assert.equal(viewing.status, "requested");
  assert.equal(viewing.note, "Original request");
  assert.equal(viewing.timeZone, "Africa/Luanda");
  assert.equal(first.history[0].actorRole, "requester");
  assert.equal(first.history[0].mine, true);
  assert.equal(first.history[0].before, null);
  const retry = await request<Mutation>(route, visitor, "POST", {
    ...originalInput,
    mutationId: originalInput.mutationId.toUpperCase(),
    note: "Original request",
  });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.replayed, true);
  assert.equal(retry.payload.viewing.id, viewing.id);
  failure(
    await request(route, visitor, "POST", {
      ...originalInput,
      note: "Different retry",
    }),
    409,
    "MUTATION_CONFLICT",
  );
  failure(
    await request(route, visitor, "POST", createInput()),
    409,
    "ACTIVE_VIEWING_EXISTS",
  );
  failure(
    await request(`/market/viewings/${viewing.id}`, outsider),
    404,
    "NOT_FOUND",
  );
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      outsider,
      "POST",
      actionInput(viewing, "cancel"),
    ),
    404,
    "NOT_FOUND",
  );
  for (const query of [
    "limit=51",
    "limit=0",
    "offset=-1",
    "offset=1e1",
    "offset=0&offset=1",
    "role=owner",
  ])
    failure(await request(`${route}?${query}`, visitor), 422);
  const page = await request<{ viewings: SavedViewing[]; total: number }>(
    route,
    owner,
  );
  assert.equal(page.payload.total, 1);
  assert.equal(Object.hasOwn(page.payload.viewings[0], "history"), false);
  assert.equal(page.payload.viewings[0].isListingOwner, true);
  await group(
    "strict whole-minute UTC times, real dates, 180-day bounds, duration/note limits, duplicate active requests and summaries preserve privacy and exact retries",
  );

  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      visitor,
      "POST",
      actionInput(viewing, "confirm"),
    ),
    403,
    "FORBIDDEN",
  );
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      owner,
      "POST",
      actionInput(viewing, "accept"),
    ),
    403,
    "FORBIDDEN",
  );
  const proposed = await act(viewing, owner, "propose", {
    startsAt: instant(1, 120),
    durationMinutes: 45,
    note: "Later time proposed",
  });
  viewing = proposed.viewing;
  assert.equal(viewing.status, "proposed");
  assert.equal(proposed.history.length, 2);
  assert.equal(proposed.history[1].actorRole, "owner");
  assert.equal(proposed.history[1].before?.status, "requested");
  const noOp = await act(viewing, owner, "propose", {
    startsAt: viewing.startsAt,
    durationMinutes: viewing.durationMinutes,
    note: viewing.note,
  });
  assert.equal(noOp.viewing.version, viewing.version);
  assert.equal(noOp.history.length, 2);
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      owner,
      "POST",
      actionInput(viewing, "confirm"),
    ),
    409,
    "INVALID_TRANSITION",
  );
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      visitor,
      "POST",
      actionInput(viewing, "accept", { version: 1 }),
    ),
    409,
    "VERSION_CONFLICT",
  );
  const acceptInput = actionInput(viewing, "accept", { note: "Agreed" });
  const accepted = await request<Mutation>(
    `/market/viewings/${viewing.id}/actions`,
    visitor,
    "POST",
    acceptInput,
  );
  assert.equal(accepted.response.status, 200);
  viewing = accepted.payload.viewing;
  assert.equal(viewing.status, "confirmed");
  assert.equal(viewing.version, 3);
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      owner,
      "POST",
      actionInput(viewing, "propose", {
        startsAt: instant(2),
        durationMinutes: 60,
      }),
    ),
    409,
    "INVALID_TRANSITION",
  );
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      owner,
      "POST",
      actionInput(viewing, "cancel", { startsAt: instant(2) }),
    ),
    422,
  );
  const cancelled = await act(viewing, owner, "cancel", {
    note: "Cancelled explicitly",
  });
  viewing = cancelled.viewing;
  assert.equal(cancelled.history.length, 4);
  assert.equal(viewing.status, "cancelled");
  const oldReplay = await request<Mutation>(
    `/market/viewings/${viewing.id}/actions`,
    visitor,
    "POST",
    acceptInput,
  );
  assert.equal(oldReplay.payload.replayed, true);
  assert.equal(oldReplay.payload.viewing.status, "cancelled");
  assert.equal(oldReplay.payload.history.length, 4);
  failure(
    await request(
      `/market/viewings/${viewing.id}/actions`,
      owner,
      "POST",
      actionInput(viewing, "cancel"),
    ),
    409,
    "INVALID_TRANSITION",
  );
  await group(
    "owner proposals require requester acceptance, confirmations cannot be silently rescheduled, history is immutable and exact retries return the current authorized record",
  );

  let current = (
    await create(chat, visitor, createInput({ startsAt: instant(2) }))
  ).viewing;
  await request(`/market/listings/${listing.id}`, owner, "PATCH", {
    ...listingInput,
    mutationId: randomUUID(),
    version: 2,
    status: "paused",
  });
  current = (await act(current, owner, "confirm")).viewing;
  assert.equal(current.status, "confirmed");
  current = (await act(current, visitor, "cancel")).viewing;
  failure(
    await request(route, visitor, "POST", createInput()),
    409,
    "LISTING_UNAVAILABLE",
  );
  await request(`/market/listings/${listing.id}`, owner, "PATCH", {
    ...listingInput,
    mutationId: randomUUID(),
    version: 3,
    status: "visible",
  });
  current = (await create(chat, visitor)).viewing;
  const chatVersion = (
    await request<{ conversation: { version: number } }>(
      `/market/conversations/${chat}/messages`,
      owner,
    )
  ).payload.conversation.version;
  await request(`/market/conversations/${chat}/block`, owner, "PATCH", {
    mutationId: randomUUID(),
    version: chatVersion,
    blocked: true,
  });
  failure(
    await request(
      `/market/viewings/${current.id}/actions`,
      owner,
      "POST",
      actionInput(current, "confirm"),
    ),
    409,
    "CONVERSATION_BLOCKED",
  );
  current = (await act(current, owner, "decline")).viewing;
  assert.equal(current.status, "declined");
  failure(
    await request(route, visitor, "POST", createInput()),
    409,
    "CONVERSATION_BLOCKED",
  );
  const blockedReplay = await request<Mutation>(
    route,
    visitor,
    "POST",
    originalInput,
  );
  assert.equal(blockedReplay.payload.replayed, true);
  assert.equal(blockedReplay.payload.viewing.id, viewing.id);
  await request(`/market/conversations/${chat}/block`, owner, "PATCH", {
    mutationId: randomUUID(),
    version: chatVersion + 1,
    blocked: false,
  });
  await group(
    "paused listings allow existing arrangements but not new requests; blocking stops arrangements while decline, cancellation, history and accepted retries remain usable",
  );

  const rentStart = instant(4);
  let reserved = (
    await create(chat, visitor, createInput({ startsAt: rentStart }))
  ).viewing;
  reserved = (await act(reserved, owner, "confirm")).viewing;
  const buy = await propertyListing("Buy", listing.propertyId);
  const buyChat = await conversation(buy.id, outsider);
  let overlapping = (
    await create(buyChat, outsider, createInput({ startsAt: rentStart }))
  ).viewing;
  failure(
    await request(
      `/market/viewings/${overlapping.id}/actions`,
      owner,
      "POST",
      actionInput(overlapping, "confirm"),
    ),
    409,
    "SLOT_CONFLICT",
  );
  assert.equal((await detail(overlapping.id, owner)).history.length, 1);
  overlapping = (
    await act(overlapping, owner, "propose", {
      startsAt: reserved.endsAt,
      durationMinutes: 30,
    })
  ).viewing;
  overlapping = (await act(overlapping, outsider, "accept")).viewing;
  assert.equal(overlapping.status, "confirmed");
  const otherListing = await propertyListing();
  const otherChat = await conversation(otherListing.id, visitor);
  let samePerson = (
    await create(otherChat, visitor, createInput({ startsAt: rentStart }))
  ).viewing;
  failure(
    await request(
      `/market/viewings/${samePerson.id}/actions`,
      owner,
      "POST",
      actionInput(samePerson, "confirm"),
    ),
    409,
    "SLOT_CONFLICT",
  );
  samePerson = (
    await act(samePerson, owner, "propose", {
      startsAt: reserved.endsAt,
      durationMinutes: 15,
    })
  ).viewing;
  samePerson = (await act(samePerson, visitor, "accept")).viewing;
  assert.equal(samePerson.status, "confirmed");
  await group(
    "confirmed appointments conflict across Rent/Buy for the same private property and across properties for the requester, while adjacent half-open slots are permitted",
  );

  const oldClock = Date.now;
  Date.now = () => now() + 6 * 86400000;
  try {
    failure(
      await request(
        `/market/viewings/${reserved.id}/actions`,
        owner,
        "POST",
        actionInput(reserved, "confirm"),
      ),
      409,
      "INVALID_TRANSITION",
    );
    const replayPast = await request<Mutation>(
      route,
      visitor,
      "POST",
      originalInput,
    );
    assert.equal(replayPast.payload.replayed, true);
    const pastCancelled = await act(reserved, visitor, "cancel");
    assert.equal(pastCancelled.viewing.status, "cancelled");
  } finally {
    Date.now = oldClock;
  }
  const pending = (
    await create(chat, visitor, createInput({ startsAt: instant(1) }))
  ).viewing;
  Date.now = () => now() + 2 * 86400000;
  try {
    failure(
      await request(
        `/market/viewings/${pending.id}/actions`,
        owner,
        "POST",
        actionInput(pending, "confirm"),
      ),
      422,
      "VALIDATION_ERROR",
    );
    const declined = await act(pending, owner, "decline");
    assert.equal(declined.viewing.status, "declined");
  } finally {
    Date.now = oldClock;
  }
  await group(
    "clock-sensitive validation is rechecked on confirmation, but accepted retries and explicit cancellation or decline remain available after the scheduled time",
  );

  const atomicInput = createInput({ startsAt: instant(10) });
  const faultDb = new DatabaseSync(databasePath);
  faultDb.exec(
    "CREATE TRIGGER fail_viewing_receipt BEFORE INSERT ON local_viewing_mutations BEGIN SELECT RAISE(ABORT,'Synthetic atomic failure'); END",
  );
  const beforeCount = (
    faultDb.prepare("SELECT count(*) AS count FROM local_viewings").get() as {
      count: number;
    }
  ).count;
  failure(await request(route, visitor, "POST", atomicInput), 500);
  assert.equal(
    (
      faultDb.prepare("SELECT count(*) AS count FROM local_viewings").get() as {
        count: number;
      }
    ).count,
    beforeCount,
  );
  faultDb.exec("DROP TRIGGER fail_viewing_receipt");
  faultDb.close();
  const concurrent = await Promise.all([
    request<Mutation>(route, visitor, "POST", atomicInput),
    request<Mutation>(route, visitor, "POST", atomicInput),
  ]);
  assert.deepEqual(concurrent.map((value) => value.payload.replayed).sort(), [
    false,
    true,
  ]);
  assert.equal(
    concurrent[0].payload.viewing.id,
    concurrent[1].payload.viewing.id,
  );
  const latest = concurrent[0].payload.viewing;
  const confirmInput = actionInput(latest, "confirm");
  const confirmations = await Promise.all([
    request<Mutation>(
      `/market/viewings/${latest.id}/actions`,
      owner,
      "POST",
      confirmInput,
    ),
    request<Mutation>(
      `/market/viewings/${latest.id}/actions`,
      owner,
      "POST",
      confirmInput,
    ),
  ]);
  assert.deepEqual(
    confirmations.map((value) => value.payload.replayed).sort(),
    [false, true],
  );
  assert.equal(confirmations[0].payload.history.length, 2);
  await group(
    "creation, snapshots, history and retry receipts commit atomically; concurrent create/confirm retries each mutate exactly once",
  );

  const persisted = await detail(latest.id, visitor);
  assert.equal(persisted.viewing.status, "confirmed");
  assert.equal(persisted.history.length, 2);
  const persistentReplay = await request<Mutation>(
    `/market/viewings/${latest.id}/actions`,
    owner,
    "POST",
    confirmInput,
  );
  assert.equal(persistentReplay.payload.replayed, true);
  await stop();
  const originalDb = new DatabaseSync(databasePath);
  const tables = [
    "accounts",
    "account_sessions",
    "local_properties",
    "local_market_listings",
    "local_market_conversations",
    "local_market_messages",
    "local_market_participants",
    "local_market_mutations",
  ];
  const before = tables.map((table) =>
    originalDb.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  );
  originalDb.close();
  copyFileSync(databasePath, migrationPath, constants.COPYFILE_EXCL);
  const previousDb = new DatabaseSync(migrationPath);
  previousDb.exec(
    "DROP TABLE local_viewing_mutations; DROP TABLE local_viewing_history; DROP TABLE local_viewings; PRAGMA user_version=5;",
  );
  previousDb.close();
  await start(migrationPath);
  const afterMigration = await request<{ account: PublicAccount }>(
    "/session",
    owner,
  );
  assert.equal(afterMigration.payload.account.id, owner.account.id);
  const migratedCreate = await create(
    chat,
    visitor,
    createInput({ startsAt: instant(15) }),
  );
  assert.equal(migratedCreate.viewing.status, "requested");
  await stop();
  const migrated = new DatabaseSync(migrationPath);
  assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 7);
  for (let index = 0; index < tables.length; index++)
    assert.deepEqual(
      migrated.prepare(`SELECT * FROM ${tables[index]} ORDER BY rowid`).all(),
      before[index],
    );
  assert.equal(
    migrated.prepare("PRAGMA integrity_check").get()?.integrity_check,
    "ok",
  );
  migrated.close();
  groups++;
  console.log(
    "✓ appointments, immutable history and retries survive reopening; schema5→6 preserves existing sessions, properties, catalogue, private messages and read/block state",
  );
  console.log(
    `Viewing checks passed (${groups} groups; synthetic local appointments only).`,
  );
} finally {
  Date.now = now;
  await stop();
  const allowed = new Set(
    ["viewings", "migration"].flatMap((name) =>
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
