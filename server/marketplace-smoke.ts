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
  localListingPageSchema,
  localListingDetailSchema,
  localListingMutationSchema,
  privateConversationPageSchema,
  privateMessagesPageSchema,
  privateMessageMutationSchema,
  privateConversationMutationSchema,
  privateConversationReadSchema,
  type LocalListing,
  type LocalListingInput,
  type PrivateConversation,
  type PrivateMessage,
} from "../src/platform/localMarketplaceContracts.ts";

interface Client {
  account: PublicAccount;
  cookie: string;
  csrfToken: string;
}
interface ListingMutation {
  listing: LocalListing;
  replayed: boolean;
}
interface MessageMutation {
  conversation: PrivateConversation;
  message: PrivateMessage;
  replayed: boolean;
}
interface MessagePage {
  conversation: PrivateConversation;
  messages: PrivateMessage[];
  latestSequence: number;
  nextBefore: number | null;
}
const directory = mkdtempSync(join(tmpdir(), "kasa-market-smoke-"));
const databasePath = join(directory, "market.sqlite");
const migrationPath = join(directory, "migration.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Local-market-synthetic-password-123";
const privateAddress = "Private-only street 999, apartment SECRET";
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let base = "";
let groups = 0;
async function start(path = databasePath) {
  service = createAccountRouter({
    databasePath: path,
    allowedOrigins: [origin],
  });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "market-smoke";
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
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-kasa-data-mode"), "local-persisted");
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(password), false);
  assert.equal(serialized.includes(databasePath), false);
  if (path.startsWith("/market")) {
    assert.equal(serialized.includes(privateAddress), false);
    assert.equal(serialized.includes("@example.invalid"), false);
    if (response.ok) {
      const route = path.split("?")[0];
      if (
        (route === "/market/listings" || route === "/market/my-listings") &&
        method === "GET"
      )
        localListingPageSchema.parse(payload);
      else if (route === "/market/conversations")
        privateConversationPageSchema.parse(payload);
      else if (route.endsWith("/messages") && method === "GET")
        privateMessagesPageSchema.parse(payload);
      else if (route.endsWith("/messages") || route.endsWith("/enquiries"))
        privateMessageMutationSchema.parse(payload);
      else if (route.endsWith("/block"))
        privateConversationMutationSchema.parse(payload);
      else if (route.endsWith("/read"))
        privateConversationReadSchema.parse(payload);
      else if (method === "GET") localListingDetailSchema.parse(payload);
      else localListingMutationSchema.parse(payload);
    }
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
    error: { code: string; message: string };
    requestId: string;
  };
  if (code) assert.equal(error.error.code, code);
  assert.equal(error.requestId, "market-smoke");
  assert.equal(typeof error.error.message, "string");
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
  return { ...result.payload, cookie: cookie.split(";")[0] };
}
const listingInput: LocalListingInput = {
  title: "Sunny local test apartment",
  description:
    "Synthetic listing for private local testing only, not a real offer.",
  city: "Luanda",
  area: "Talatona",
  intent: "Rent",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  areaSqm: 90,
  priceMinor: 45000000,
  currency: "AOA",
  furnished: false,
  pets: "ask",
};
function updateInput(listing: LocalListing, extra: object = {}) {
  return {
    mutationId: randomUUID(),
    version: listing.version,
    ...listingInput,
    intent: listing.intent,
    status: listing.status,
    ...extra,
  };
}
async function detail(id: string, client: Client) {
  const result = await request<{ listing: LocalListing }>(
    `/market/listings/${id}`,
    client,
  );
  assert.equal(result.response.status, 200);
  return result.payload.listing;
}
async function thread(id: string, client: Client) {
  const result = await request<MessagePage>(
    `/market/conversations/${id}/messages`,
    client,
  );
  assert.equal(result.response.status, 200);
  return result.payload;
}
const dropMarketplace =
  "DROP TABLE local_viewing_mutations; DROP TABLE local_viewing_history; DROP TABLE local_viewings; DROP TABLE local_market_mutations; DROP TABLE local_market_messages; DROP TABLE local_market_participants; DROP TABLE local_market_conversations; DROP TABLE local_market_listings;";
try {
  await start();
  const owner = await register("MarketOwner");
  const visitor = await register("MarketVisitor");
  const outsider = await register("MarketOutsider");
  const workspace = await request<{ workspace: { id: string } }>(
    "/workspaces",
    owner,
    "POST",
    { name: "Local market owner workspace" },
  );
  assert.equal(workspace.response.status, 201);
  const workspaceId = workspace.payload.workspace.id;
  const property = await request<{ property: { id: string } }>(
    `/workspaces/${workspaceId}/properties`,
    owner,
    "POST",
    { name: "Private property", address: privateAddress },
  );
  assert.equal(property.response.status, 201);
  const propertyId = property.payload.property.id;
  const createInput = { mutationId: randomUUID(), propertyId, ...listingInput };
  for (const path of [
    "/market/listings",
    "/market/my-listings",
    "/market/conversations",
    `/market/listings/${randomUUID()}`,
    `/market/conversations/${randomUUID()}/messages`,
  ])
    failure(await request(path), 401, "AUTH_REQUIRED");
  failure(
    await request("/market/listings", undefined, "POST", createInput),
    401,
  );
  failure(
    await request("/market/listings", owner, "POST", createInput, {
      "X-CSRF-Token": "wrong",
    }),
    403,
  );
  failure(
    await request("/market/listings", owner, "POST", createInput, {
      Origin: "https://unapproved.invalid",
    }),
    403,
  );
  failure(
    await request("/market/listings", owner, "POST", createInput, {
      Origin: "",
    }),
    403,
  );
  failure(
    await request("/market/listings", owner, "GET", undefined, {
      "X-Kasa-Account-Id": visitor.account.id,
    }),
    401,
  );
  failure(
    await request("/market/listings", visitor, "POST", createInput),
    404,
    "NOT_FOUND",
  );
  await group(
    "authenticated local catalogue requires session, approved Origin, CSRF and matching expected identity; private property ownership is authoritative",
  );

  for (const extra of [
    { role: "owner" },
    { ownerAccountId: owner.account.id },
    { status: "visible" },
    { address: privateAddress },
    { email: "test@example.invalid" },
    { priceMinor: 1.2 },
    { priceMinor: 1e13 + 1 },
    { currency: "USD" },
    { title: "x" },
    { description: "short" },
    { pets: "yes" },
    { bedrooms: -1 },
  ])
    failure(
      await request("/market/listings", owner, "POST", {
        ...createInput,
        ...extra,
      }),
      422,
      "VALIDATION_ERROR",
    );
  const created = await request<ListingMutation>(
    "/market/listings",
    owner,
    "POST",
    createInput,
  );
  assert.equal(created.response.status, 201);
  let listing = created.payload.listing;
  assert.equal(listing.status, "draft");
  assert.equal(listing.isOwner, true);
  assert.equal(listing.propertyId, propertyId);
  const retry = await request<ListingMutation>(
    "/market/listings",
    owner,
    "POST",
    { ...createInput, mutationId: createInput.mutationId.toUpperCase() },
  );
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.replayed, true);
  assert.equal(retry.payload.listing.id, listing.id);
  failure(
    await request("/market/listings", owner, "POST", {
      ...createInput,
      mutationId: randomUUID(),
    }),
    409,
    "LISTING_EXISTS",
  );
  failure(
    await request("/market/listings", owner, "POST", {
      ...createInput,
      title: "Changed retry details",
    }),
    409,
    "MUTATION_CONFLICT",
  );
  failure(
    await request(`/market/listings/${listing.id}`, visitor),
    404,
    "NOT_FOUND",
  );
  const hidden = await request<{ listings: LocalListing[] }>(
    "/market/listings",
    owner,
  );
  assert.equal(hidden.payload.listings.length, 0);
  const mine = await request<{ listings: LocalListing[] }>(
    "/market/my-listings",
    owner,
  );
  assert.equal(mine.payload.listings.length, 1);
  const others = await request<{ listings: LocalListing[] }>(
    "/market/my-listings",
    visitor,
  );
  assert.equal(others.payload.listings.length, 0);
  const published = await request<ListingMutation>(
    `/market/listings/${listing.id}`,
    owner,
    "PATCH",
    updateInput(listing, { status: "visible" }),
  );
  assert.equal(published.response.status, 200);
  listing = published.payload.listing;
  const publicListing = await detail(listing.id, visitor);
  assert.equal(publicListing.isOwner, false);
  assert.equal(Object.hasOwn(publicListing, "propertyId"), false);
  failure(
    await request(
      `/market/listings/${listing.id}`,
      visitor,
      "PATCH",
      updateInput(listing),
    ),
    404,
    "NOT_FOUND",
  );
  failure(
    await request(
      `/market/listings/${listing.id}`,
      owner,
      "PATCH",
      updateInput(listing, { propertyId: randomUUID() }),
    ),
    422,
  );
  failure(
    await request(
      `/market/listings/${listing.id}`,
      owner,
      "PATCH",
      updateInput(listing, { version: 1 }),
    ),
    409,
    "VERSION_CONFLICT",
  );
  const unchanged = await request<ListingMutation>(
    `/market/listings/${listing.id}`,
    owner,
    "PATCH",
    updateInput(listing),
  );
  assert.equal(unchanged.payload.listing.version, listing.version);
  await group(
    "draft/publish/edit uses real ownership, strict metadata, exact retries, stable property binding, no-op stability and optimistic versions without leaking private fields",
  );

  const buy = await request<ListingMutation>(
    "/market/listings",
    owner,
    "POST",
    {
      ...createInput,
      mutationId: randomUUID(),
      intent: "Buy",
      priceMinor: 90000000,
      title: "Buy local test apartment",
    },
  );
  assert.equal(buy.response.status, 201);
  const buyListing = (
    await request<ListingMutation>(
      `/market/listings/${buy.payload.listing.id}`,
      owner,
      "PATCH",
      updateInput(buy.payload.listing, {
        intent: "Buy",
        priceMinor: 90000000,
        title: "Buy local test apartment",
        status: "visible",
      }),
    )
  ).payload.listing;
  failure(
    await request(
      `/market/listings/${buyListing.id}`,
      owner,
      "PATCH",
      updateInput(buyListing, { intent: "Rent" }),
    ),
    409,
    "LISTING_EXISTS",
  );
  for (const query of [
    "role=owner",
    "limit=0",
    "limit=51",
    "offset=-1",
    "offset=1.2",
    "offset=1e1",
    "limit=1&limit=2",
    "q=x&q=y",
    "minPriceMinor=900&maxPriceMinor=100",
    "sort=sql",
    "type=villa",
    "intent=rent",
    "pets=yes",
    "q=" + "x".repeat(121),
  ])
    failure(
      await request(`/market/listings?${query}`, visitor),
      422,
      "VALIDATION_ERROR",
    );
  const filtered = await request<{ listings: LocalListing[]; total: number }>(
    "/market/listings?q=Sunny&city=luanda&intent=Rent&type=apartment&pets=ask&minPriceMinor=40000000&maxPriceMinor=50000000",
    visitor,
  );
  assert.equal(filtered.payload.total, 1);
  assert.equal(filtered.payload.listings[0].id, listing.id);
  const literal = await request<{ total: number }>(
    "/market/listings?q=%25",
    visitor,
  );
  assert.equal(literal.payload.total, 0);
  const first = await request<{
    listings: LocalListing[];
    total: number;
    nextOffset: number | null;
  }>("/market/listings?sort=price_asc&limit=1", visitor);
  assert.equal(first.payload.listings[0].id, listing.id);
  assert.equal(first.payload.total, 2);
  assert.equal(first.payload.nextOffset, 1);
  const second = await request<{
    listings: LocalListing[];
    nextOffset: number | null;
  }>("/market/listings?sort=price_asc&limit=1&offset=1", visitor);
  assert.equal(second.payload.listings[0].id, buyListing.id);
  assert.equal(second.payload.nextOffset, null);
  await group(
    "catalogue search, literal wildcard escaping, price filters, sorting and bounded offset pagination are real and reject malformed queries",
  );

  failure(
    await request(`/market/listings/${listing.id}/enquiries`, owner, "POST", {
      mutationId: randomUUID(),
      body: "Contacting myself",
    }),
    422,
    "SELF_ENQUIRY",
  );
  const enquiry = {
    mutationId: randomUUID(),
    body: "Is this local test listing available?",
  };
  const contacted = await request<MessageMutation>(
    `/market/listings/${listing.id}/enquiries`,
    visitor,
    "POST",
    enquiry,
  );
  assert.equal(contacted.response.status, 201);
  const conversationId = contacted.payload.conversation.id;
  const messageId = contacted.payload.message.id;
  assert.equal(contacted.payload.message.sequence, 1);
  assert.equal(contacted.payload.conversation.isListingOwner, false);
  assert.equal(
    contacted.payload.conversation.counterpartName,
    owner.account.displayName,
  );
  const repeated = await request<MessageMutation>(
    `/market/listings/${listing.id}/enquiries`,
    visitor,
    "POST",
    enquiry,
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.payload.replayed, true);
  assert.equal(repeated.payload.message.id, messageId);
  failure(
    await request(`/market/listings/${listing.id}/enquiries`, visitor, "POST", {
      ...enquiry,
      body: "Changed replay",
    }),
    409,
    "MUTATION_CONFLICT",
  );
  const again = await request<MessageMutation>(
    `/market/listings/${listing.id}/enquiries`,
    visitor,
    "POST",
    {
      mutationId: randomUUID(),
      body: "A second enquiry in the same conversation",
    },
  );
  assert.equal(again.payload.conversation.id, conversationId);
  assert.equal(again.payload.message.sequence, 2);
  const ownerThread = await thread(conversationId, owner);
  assert.equal(ownerThread.conversation.unreadCount, 2);
  assert.equal(
    ownerThread.conversation.counterpartName,
    visitor.account.displayName,
  );
  assert.equal(ownerThread.conversation.isListingOwner, true);
  const outsiderList = await request<{ total: number }>(
    "/market/conversations",
    outsider,
  );
  assert.equal(outsiderList.payload.total, 0);
  for (const [suffix, method, body] of [
    ["messages", "GET", undefined],
    ["messages", "POST", { mutationId: randomUUID(), body: "No access" }],
    ["read", "POST", { throughSequence: 1 }],
    ["block", "PATCH", { mutationId: randomUUID(), version: 3, blocked: true }],
  ] as const)
    failure(
      await request(
        `/market/conversations/${conversationId}/${suffix}`,
        outsider,
        method,
        body,
      ),
      404,
      "NOT_FOUND",
    );
  await group(
    "enquiries derive the actual owner, reuse one participant-only conversation, persist one message per retry and isolate outsiders",
  );

  const send = {
    mutationId: randomUUID(),
    body: "Yes. Please continue in this private chat.",
  };
  const reply = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    owner,
    "POST",
    send,
  );
  assert.equal(reply.response.status, 201);
  assert.equal(reply.payload.message.sequence, 3);
  const replay = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    owner,
    "POST",
    send,
  );
  assert.equal(replay.payload.replayed, true);
  assert.equal(replay.payload.message.id, reply.payload.message.id);
  failure(
    await request(
      `/market/conversations/${conversationId}/messages`,
      owner,
      "POST",
      { ...send, body: "Changed" },
    ),
    409,
    "MUTATION_CONFLICT",
  );
  failure(
    await request(
      `/market/conversations/${conversationId}/messages`,
      visitor,
      "POST",
      { mutationId: enquiry.mutationId, body: enquiry.body },
    ),
    409,
    "MUTATION_CONFLICT",
  );
  for (const body of [
    { body: "   " },
    { body: "x".repeat(2001) },
    { body: "Hi", authorId: owner.account.id },
    { body: "Hi", sequence: 999 },
  ])
    failure(
      await request(
        `/market/conversations/${conversationId}/messages`,
        visitor,
        "POST",
        { mutationId: randomUUID(), ...body },
      ),
      422,
    );
  const visitorPage = await thread(conversationId, visitor);
  assert.equal(visitorPage.conversation.unreadCount, 1);
  const read = await request<{ conversation: PrivateConversation }>(
    `/market/conversations/${conversationId}/read`,
    visitor,
    "POST",
    { throughSequence: 3 },
  );
  assert.equal(read.payload.conversation.unreadCount, 0);
  assert.equal(
    read.payload.conversation.version,
    visitorPage.conversation.version,
  );
  const staleRead = await request<{ conversation: PrivateConversation }>(
    `/market/conversations/${conversationId}/read`,
    visitor,
    "POST",
    { throughSequence: 1 },
  );
  assert.equal(staleRead.payload.conversation.unreadCount, 0);
  failure(
    await request(
      `/market/conversations/${conversationId}/read`,
      visitor,
      "POST",
      { throughSequence: 4 },
    ),
    422,
  );
  failure(
    await request(
      `/market/conversations/${conversationId}/read`,
      visitor,
      "POST",
      { throughSequence: -1 },
    ),
    422,
  );
  assert.equal(
    (await thread(conversationId, owner)).conversation.unreadCount,
    2,
    "reading messages must not mark them read implicitly",
  );
  await group(
    "message retries and unread acknowledgements are persistent, monotonic, participant-scoped and never infer read state from a fetch",
  );

  const blockInput = {
    mutationId: randomUUID(),
    version: (await thread(conversationId, owner)).conversation.version,
    blocked: true,
  };
  const blocked = await request<{
    conversation: PrivateConversation;
    replayed: boolean;
  }>(
    `/market/conversations/${conversationId}/block`,
    owner,
    "PATCH",
    blockInput,
  );
  assert.equal(blocked.response.status, 200);
  assert.equal(blocked.payload.conversation.blockedByMe, true);
  const blockedRetry = await request<{
    conversation: PrivateConversation;
    replayed: boolean;
  }>(
    `/market/conversations/${conversationId}/block`,
    owner,
    "PATCH",
    blockInput,
  );
  assert.equal(blockedRetry.payload.replayed, true);
  for (const actor of [owner, visitor])
    failure(
      await request(
        `/market/conversations/${conversationId}/messages`,
        actor,
        "POST",
        { mutationId: randomUUID(), body: "Blocked send" },
      ),
      409,
      "CONVERSATION_BLOCKED",
    );
  failure(
    await request(`/market/listings/${listing.id}/enquiries`, visitor, "POST", {
      mutationId: randomUUID(),
      body: "Blocked enquiry",
    }),
    409,
    "CONVERSATION_BLOCKED",
  );
  assert.equal(
    (await thread(conversationId, visitor)).conversation.blockedByOther,
    true,
  );
  failure(
    await request(
      `/market/conversations/${conversationId}/block`,
      owner,
      "PATCH",
      { mutationId: randomUUID(), version: blockInput.version, blocked: false },
    ),
    409,
    "VERSION_CONFLICT",
  );
  const visitorUnblock = await request<{ conversation: PrivateConversation }>(
    `/market/conversations/${conversationId}/block`,
    visitor,
    "PATCH",
    {
      mutationId: randomUUID(),
      version: blocked.payload.conversation.version,
      blocked: false,
    },
  );
  assert.equal(visitorUnblock.payload.conversation.blockedByOther, true);
  assert.equal(
    visitorUnblock.payload.conversation.version,
    blocked.payload.conversation.version,
  );
  const noResend = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    owner,
    "POST",
    send,
  );
  assert.equal(noResend.payload.replayed, true);
  assert.equal(noResend.payload.message.sequence, 3);
  await request(
    `/market/conversations/${conversationId}/block`,
    owner,
    "PATCH",
    {
      mutationId: randomUUID(),
      version: blocked.payload.conversation.version,
      blocked: false,
    },
  );
  listing = (
    await request<ListingMutation>(
      `/market/listings/${listing.id}`,
      owner,
      "PATCH",
      updateInput(await detail(listing.id, owner), { status: "paused" }),
    )
  ).payload.listing;
  failure(
    await request(`/market/listings/${listing.id}`, visitor),
    404,
    "NOT_FOUND",
  );
  failure(
    await request(`/market/listings/${listing.id}/enquiries`, visitor, "POST", {
      mutationId: randomUUID(),
      body: "New paused enquiry",
    }),
    404,
  );
  const recovery = await request<MessageMutation>(
    `/market/listings/${listing.id}/enquiries`,
    visitor,
    "POST",
    enquiry,
  );
  assert.equal(recovery.payload.replayed, true);
  const continued = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    visitor,
    "POST",
    {
      mutationId: randomUUID(),
      body: "Existing conversation stays available after pause.",
    },
  );
  assert.equal(continued.response.status, 201);
  await group(
    "either participant can block both sends, only their own block can be removed, paused listings are hidden while accepted chat and safe retries remain available",
  );

  const seeded = new DatabaseSync(databasePath);
  const seedMessage = seeded.prepare(
    "INSERT INTO local_market_messages(id,conversation_id,author_id,sequence,body,created_at) VALUES(?,?,?,?,?,?)",
  );
  for (let sequence = 5; sequence <= 61; sequence++)
    seedMessage.run(
      randomUUID(),
      conversationId,
      sequence % 2 ? owner.account.id : visitor.account.id,
      sequence,
      `Pagination message ${sequence}`,
      Date.now(),
    );
  seeded.close();
  const latest = await thread(conversationId, owner);
  assert.equal(latest.latestSequence, 61);
  assert.equal(latest.messages.length, 50);
  assert.equal(latest.messages[0].sequence, 12);
  assert.equal(latest.nextBefore, 12);
  const older = await request<MessagePage>(
    `/market/conversations/${conversationId}/messages?before=12`,
    owner,
  );
  assert.equal(older.payload.messages.length, 11);
  assert.equal(older.payload.messages[0].sequence, 1);
  assert.equal(older.payload.nextBefore, null);
  assert.equal(older.payload.latestSequence, 61);
  assert.equal(
    (
      await request<MessagePage>(
        `/market/conversations/${conversationId}/messages?before=1`,
        owner,
      )
    ).payload.messages.length,
    0,
  );
  for (const query of [
    "before=0",
    "before=-1",
    "before=1.5",
    "before=1e2",
    "before=2&before=3",
    "limit=999",
    "before=9999999999999999",
  ])
    failure(
      await request(
        `/market/conversations/${conversationId}/messages?${query}`,
        owner,
      ),
      422,
    );
  const another = await request<MessageMutation>(
    `/market/listings/${buyListing.id}/enquiries`,
    visitor,
    "POST",
    { mutationId: randomUUID(), body: "Different local listing conversation" },
  );
  assert.equal(another.response.status, 201);
  const inbox = await request<{ total: number; nextOffset: number | null }>(
    "/market/conversations?limit=1",
    visitor,
  );
  assert.equal(inbox.payload.total, 2);
  assert.equal(inbox.payload.nextOffset, 1);
  await group(
    "message sequences paginate backwards without loss, preserve chronological display and expose stable maximum sequence independently of the page",
  );

  const concurrentInput = {
    mutationId: randomUUID(),
    body: "Exactly once across concurrent requests",
  };
  const concurrent = await Promise.all([
    request<MessageMutation>(
      `/market/conversations/${conversationId}/messages`,
      visitor,
      "POST",
      concurrentInput,
    ),
    request<MessageMutation>(
      `/market/conversations/${conversationId}/messages`,
      visitor,
      "POST",
      concurrentInput,
    ),
  ]);
  assert.deepEqual(concurrent.map((item) => item.payload.replayed).sort(), [
    false,
    true,
  ]);
  assert.equal(
    concurrent[0].payload.message.id,
    concurrent[1].payload.message.id,
  );
  const faultDb = new DatabaseSync(databasePath);
  faultDb.exec(
    "CREATE TRIGGER fail_market_receipt BEFORE INSERT ON local_market_mutations BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END",
  );
  const beforeFault = await thread(conversationId, visitor);
  const faultInput = { mutationId: randomUUID(), body: "Atomic rollback test" };
  failure(
    await request(
      `/market/conversations/${conversationId}/messages`,
      visitor,
      "POST",
      faultInput,
    ),
    500,
  );
  const afterFault = await thread(conversationId, visitor);
  assert.equal(afterFault.latestSequence, beforeFault.latestSequence);
  assert.equal(
    afterFault.conversation.version,
    beforeFault.conversation.version,
  );
  faultDb.exec("DROP TRIGGER fail_market_receipt");
  faultDb.close();
  const recovered = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    visitor,
    "POST",
    faultInput,
  );
  assert.equal(recovered.payload.replayed, false);
  assert.equal(
    recovered.payload.message.sequence,
    beforeFault.latestSequence + 1,
  );
  await group(
    "concurrent exact retries append once and receipt failures roll back messages, sequence and conversation version atomically",
  );

  const caps = new DatabaseSync(databasePath);
  const current = (await thread(conversationId, visitor)).latestSequence;
  for (let sequence = current + 1; sequence <= 500; sequence++)
    caps
      .prepare(
        "INSERT INTO local_market_messages(id,conversation_id,author_id,sequence,body,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        conversationId,
        owner.account.id,
        sequence,
        `Capacity message ${sequence}`,
        Date.now(),
      );
  caps.close();
  failure(
    await request(
      `/market/conversations/${conversationId}/messages`,
      visitor,
      "POST",
      { mutationId: randomUUID(), body: "Beyond capacity" },
    ),
    409,
    "LIMIT_REACHED",
  );
  const stillRetry = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    visitor,
    "POST",
    faultInput,
  );
  assert.equal(stillRetry.payload.replayed, true);
  const fullBlock = await request<{ conversation: PrivateConversation }>(
    `/market/conversations/${conversationId}/block`,
    visitor,
    "PATCH",
    {
      mutationId: randomUUID(),
      version: (await thread(conversationId, visitor)).conversation.version,
      blocked: true,
    },
  );
  assert.equal(fullBlock.response.status, 200);
  await group(
    "the explicit 500-message cap does not silently truncate records or prevent recovery, reads or blocking",
  );

  const bounds = new DatabaseSync(databasePath);
  for (let i = 0; i < 98; i++) {
    const id = randomUUID();
    bounds
      .prepare(
        "INSERT INTO local_properties(id,workspace_id,name,address,version,created_at) VALUES(?,?,?,?,1,?)",
      )
      .run(id, workspaceId, `Limit property ${i}`, privateAddress, Date.now());
    bounds
      .prepare(
        "INSERT INTO local_market_listings(id,property_id,intent,data_json,status,version,created_at,updated_at) VALUES(?,?,'Rent',?,'draft',1,?,?)",
      )
      .run(
        randomUUID(),
        id,
        JSON.stringify(listingInput),
        Date.now(),
        Date.now(),
      );
  }
  const limitPropertyId = randomUUID();
  bounds
    .prepare(
      "INSERT INTO local_properties(id,workspace_id,name,address,version,created_at) VALUES(?,?,?,?,1,?)",
    )
    .run(
      limitPropertyId,
      workspaceId,
      "Beyond limit property",
      privateAddress,
      Date.now(),
    );
  bounds.close();
  failure(
    await request("/market/listings", owner, "POST", {
      ...createInput,
      mutationId: randomUUID(),
      propertyId: limitPropertyId,
    }),
    409,
    "LIMIT_REACHED",
  );
  const bounds2 = new DatabaseSync(databasePath);
  for (let i = 0; i < 198; i++) {
    const actor = randomUUID();
    bounds2
      .prepare(
        "INSERT INTO accounts(id,email,display_name,locale,password_salt,password_hash,created_at,updated_at) VALUES(?,?,?,'pt','test','test',?,?)",
      )
      .run(
        actor,
        `limit-${i}@example.invalid`,
        `Limit actor ${i}`,
        Date.now(),
        Date.now(),
      );
    const id = randomUUID();
    bounds2
      .prepare(
        "INSERT INTO local_market_conversations(id,listing_id,owner_account_id,visitor_account_id,version,created_at,updated_at) VALUES(?,?,?,?,1,?,?)",
      )
      .run(id, buyListing.id, owner.account.id, actor, Date.now(), Date.now());
    for (const participant of [actor, owner.account.id])
      bounds2
        .prepare(
          "INSERT INTO local_market_participants(conversation_id,account_id) VALUES(?,?)",
        )
        .run(id, participant);
  }
  bounds2.close();
  failure(
    await request(
      `/market/listings/${buyListing.id}/enquiries`,
      outsider,
      "POST",
      { mutationId: randomUUID(), body: "New conversation beyond owner limit" },
    ),
    409,
    "LIMIT_REACHED",
  );
  const existingReply = await request<MessageMutation>(
    `/market/conversations/${another.payload.conversation.id}/messages`,
    owner,
    "POST",
    {
      mutationId: randomUUID(),
      body: "Existing conversations still work at account limit",
    },
  );
  assert.equal(existingReply.response.status, 201);
  const allMine = await request<{
    total: number;
    listings: LocalListing[];
    nextOffset: number | null;
  }>("/market/my-listings?limit=50", owner);
  assert.equal(allMine.payload.total, 100);
  assert.equal(allMine.payload.listings.length, 50);
  assert.equal(allMine.payload.nextOffset, 50);
  await group(
    "local capacity limits reject new listings and conversations explicitly while preserving existing chat and complete paginated totals",
  );

  const resumed = await thread(conversationId, visitor);
  assert.equal(resumed.latestSequence, 500);
  assert.equal(resumed.conversation.blockedByMe, true);
  const persistedRetry = await request<MessageMutation>(
    `/market/conversations/${conversationId}/messages`,
    visitor,
    "POST",
    concurrentInput,
  );
  assert.equal(persistedRetry.payload.replayed, true);
  assert.equal((await detail(listing.id, owner)).status, "paused");
  await stop();
  const originalDb = new DatabaseSync(databasePath);
  const beforeAccounts = originalDb
    .prepare("SELECT * FROM accounts ORDER BY id")
    .all();
  const beforeProperties = originalDb
    .prepare("SELECT * FROM local_properties ORDER BY id")
    .all();
  originalDb.close();
  copyFileSync(databasePath, migrationPath, constants.COPYFILE_EXCL);
  const old = new DatabaseSync(migrationPath);
  old.exec(`${dropMarketplace} PRAGMA user_version=4;`);
  old.close();
  await start(migrationPath);
  const session = await request<{ account: PublicAccount }>("/session", owner);
  assert.equal(session.payload.account.id, owner.account.id);
  const migratedCreate = await request<ListingMutation>(
    "/market/listings",
    owner,
    "POST",
    { ...createInput, mutationId: randomUUID() },
  );
  assert.equal(migratedCreate.response.status, 201);
  await stop();
  const migrated = new DatabaseSync(migrationPath);
  assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 6);
  assert.deepEqual(
    migrated.prepare("SELECT * FROM accounts ORDER BY id").all(),
    beforeAccounts,
  );
  assert.deepEqual(
    migrated.prepare("SELECT * FROM local_properties ORDER BY id").all(),
    beforeProperties,
  );
  assert.equal(
    migrated.prepare("PRAGMA integrity_check").get()?.integrity_check,
    "ok",
  );
  migrated.close();
  groups++;
  console.log(
    "✓ sessions, listings, messages, read/block state and exact retries survive restart; v4→v6 preserves existing accounts and private properties",
  );
  console.log(
    `Marketplace checks passed (${groups} groups; authenticated local synthetic fixtures only).`,
  );
} finally {
  await stop();
  const allowed = new Set(
    ["market", "migration"].flatMap((name) =>
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
