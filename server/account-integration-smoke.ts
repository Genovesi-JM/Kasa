import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { lstat, mkdtemp, readdir, rmdir, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const entry = resolve(root, "build-api/server/index.js");
const directory = await mkdtemp(join(tmpdir(), "kasa-account-integration-"));
const databasePath = join(directory, "accounts.sqlite");
const origin = "http://127.0.0.1:5174";
const children: ChildProcess[] = [];
const fixture = {
  displayName: "Integration account",
  email: "account.integration@example.invalid",
  password: "Local-only-integration-fixture-123",
  locale: "pt",
};

interface Payload {
  account?: {
    id: string;
    displayName: string;
    email: string;
    locale: string;
    version: number;
    emailVerified: boolean;
  } | null;
  csrfToken?: string | null;
  error?: { code: string; message: string };
  productionReady?: boolean;
  persistence?: string;
  workflows?: string;
  rentRecords?: string;
  marketplace?: string;
  viewings?: string;
  viewing?: { id: string; version: number; status: string; startsAt: string };
  history?: Array<{ id: string; sequence: number; action: string }>;
  listing?: {
    id: string;
    version: number;
    status: string;
    propertyId?: string;
  };
  conversation?: { id: string; unreadCount: number };
  message?: { id: string; sequence: number; body: string };
  messages?: Array<{ id: string; sequence: number; body: string }>;
  record?: {
    id: string;
    status: string;
    amountDueMinor: number;
    version: number;
    history: Array<{ id: string }>;
  };
  replayed?: boolean;
  documents?: string | Array<{ id: string; title: string }>;
  notifications?:
    string | Array<{ id: string; kind: string; readAt: string | null }>;
  document?: { id: string; version: number; title: string; sharing: string };
  invitation?: { code: string };
  workspace?: { id: string; name: string; role: string };
  workspaces?: Array<{
    id: string;
    properties: Array<{ id: string; name: string }>;
  }>;
  property?: { id: string; name: string; version: number };
  request?: { id: string; title: string; status: string; version: number };
  requests?: Array<{
    id: string;
    title: string;
    status: string;
    version: number;
  }>;
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

async function start(env: Record<string, string> = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      KASA_API_ENV_FILE: join(directory, "absent.env"),
      KASA_API_HOST: "127.0.0.1",
      KASA_API_PORT: String(port),
      KASA_API_ALLOWED_ORIGINS: origin,
      KASA_API_DEMO_WRITES: "false",
      KASA_API_SERVE_WEB: "false",
      KASA_API_COUNTRY: "ao",
      KASA_API_LOCAL_ACCOUNTS: "true",
      KASA_API_ACCOUNT_DB: databasePath,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const base = `http://127.0.0.1:${port}/api/v1`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return { child, base, output };
    try {
      if ((await fetch(`${base}/health`)).ok) return { child, base, output };
    } catch {
      // The child has not bound its loopback listener yet.
    }
    await new Promise((done) => setTimeout(done, 75));
  }
  throw new Error(`Account integration process did not start: ${output}`);
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = once(child, "exit");
  child.kill("SIGTERM");
  await stopped;
}

async function request(base: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, init);
  const payload = (await response.json()) as Payload;
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(fixture.password), false);
  assert.equal(serialized.includes(databasePath), false);
  assert.equal(serialized.includes("password_hash"), false);
  assert.equal(serialized.includes("token_hash"), false);
  return { response, payload };
}

function accountHeaders(extra: Record<string, string> = {}) {
  return { Origin: origin, "Content-Type": "application/json", ...extra };
}

try {
  const first = await start();
  assert.equal(first.child.exitCode, null, first.output);
  const ready = await request(first.base, "/ready");
  assert.equal(
    ready.payload.persistence,
    "local_accounts_and_property_workspaces",
  );
  assert.equal(
    ready.payload.workflows,
    "local_property_membership_and_maintenance",
  );
  assert.equal(ready.payload.productionReady, false);
  assert.equal(ready.payload.documents, "local_private_files");
  assert.equal(ready.payload.notifications, "local_in_app");
  assert.equal(ready.payload.rentRecords, "local_direct_transfer_records");
  assert.equal(
    ready.payload.marketplace,
    "local_test_listings_and_private_chat",
  );
  assert.equal(ready.payload.viewings, "local_participant_viewing_requests");
  const anonymous = await request(first.base, "/account/session");
  assert.deepEqual(anonymous.payload, { account: null, csrfToken: null });
  assert.equal(
    anonymous.response.headers.get("x-kasa-data-mode"),
    "local-persisted",
  );
  assert.equal(anonymous.response.headers.get("cache-control"), "no-store");
  assert.equal(
    anonymous.response.headers.get("x-content-type-options"),
    "nosniff",
  );
  const catalogue = await request(first.base, "/properties");
  assert.equal(
    catalogue.response.headers.get("x-kasa-data-mode"),
    "synthetic-demo",
  );
  console.log(
    "✓ compiled API distinguishes durable local accounts/property workflows from synthetic catalogues",
  );

  for (const path of ["/account/register", "/AcCoUnT/register"]) {
    const oversized = await request(first.base, path, {
      method: "POST",
      headers: accountHeaders(),
      body: " ".repeat(17_000) + JSON.stringify(fixture),
    });
    assert.equal(oversized.response.status, 422, path);
    assert.equal(oversized.payload.error?.code, "VALIDATION_ERROR");
    assert.equal(oversized.response.headers.get("cache-control"), "no-store");
  }
  const malformed = await request(first.base, "/account/register", {
    method: "POST",
    headers: accountHeaders(),
    body: "{",
  });
  assert.equal(malformed.response.status, 422);
  assert.equal(malformed.payload.error?.code, "VALIDATION_ERROR");
  console.log(
    "✓ full API applies the smaller account body limit, including mixed-case routes",
  );

  const created = await request(first.base, "/account/register", {
    method: "POST",
    headers: accountHeaders(),
    body: JSON.stringify(fixture),
  });
  assert.equal(created.response.status, 201);
  assert.ok(created.payload.account);
  assert.equal(created.payload.account.emailVerified, false);
  const accountId = created.payload.account.id;
  const cookieHeader = created.response.headers.get("set-cookie");
  assert.ok(cookieHeader);
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Strict/);
  const cookie = cookieHeader.split(";")[0];
  assert.ok(created.payload.csrfToken);
  const sessionHeaders = accountHeaders({
    Cookie: cookie,
    "X-CSRF-Token": created.payload.csrfToken,
  });
  const updated = await request(first.base, "/account/profile?role=admin", {
    method: "PATCH",
    headers: sessionHeaders,
    body: JSON.stringify({
      displayName: "Persisted local profile",
      locale: "en",
      version: 1,
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.account?.id, accountId);
  assert.equal(updated.payload.account?.version, 2);
  assert.equal(Object.hasOwn(updated.payload.account!, "role"), false);
  for (const route of ["space-reservations", "rent-records/proofs"]) {
    const denied = await request(first.base, `/${route}`, {
      method: "POST",
      headers: sessionHeaders,
      body: "{}",
    });
    assert.equal(
      denied.response.status,
      503,
      "Account cookies must not enable demo writes",
    );
  }
  const workspace = await request(first.base, "/account/workspaces", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ name: "Private integration workspace" }),
  });
  assert.equal(workspace.response.status, 201);
  assert.equal(workspace.payload.workspace?.role, "owner");
  assert.ok(workspace.payload.workspace?.id);
  const workspaceId = workspace.payload.workspace.id;
  const property = await request(
    first.base,
    `/account/workspaces/${workspaceId}/properties`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        name: "Invented unit A",
        address: "Fictional local test address",
      }),
    },
  );
  assert.equal(property.response.status, 201);
  assert.ok(property.payload.property?.id);
  const propertyId = property.payload.property.id;
  const repair = await request(
    first.base,
    `/account/properties/${propertyId}/maintenance`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        title: "Local fixture repair",
        description: "Invented request, no real property.",
        priority: "normal",
      }),
    },
  );
  assert.equal(repair.response.status, 201);
  assert.ok(repair.payload.request?.id);
  const repairId = repair.payload.request.id;
  const progress = await request(
    first.base,
    `/account/maintenance/${repairId}`,
    {
      method: "PATCH",
      headers: sessionHeaders,
      body: JSON.stringify({
        version: 1,
        status: "in_progress",
        message: "Owner test update",
      }),
    },
  );
  assert.equal(progress.response.status, 200);
  assert.equal(progress.payload.request?.version, 2);
  const unauthorized = await request(
    first.base,
    `/account/properties/${propertyId}/maintenance?role=admin`,
  );
  assert.equal(unauthorized.response.status, 401);
  assert.equal(unauthorized.payload.error?.code, "AUTH_REQUIRED");

  const tenant = await request(first.base, "/account/register", {
    method: "POST",
    headers: accountHeaders(),
    body: JSON.stringify({
      ...fixture,
      email: "tenant.integration@example.invalid",
      displayName: "Integration tenant",
    }),
  });
  assert.equal(tenant.response.status, 201);
  assert.ok(tenant.payload.account && tenant.payload.csrfToken);
  const tenantCookie = tenant.response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(tenantCookie);
  const tenantHeaders = accountHeaders({
    Cookie: tenantCookie,
    "X-CSRF-Token": tenant.payload.csrfToken,
    "X-Kasa-Account-Id": tenant.payload.account.id,
  });
  const invitation = await request(
    first.base,
    `/account/properties/${propertyId}/invitations`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ accountId: tenant.payload.account.id }),
    },
  );
  assert.equal(invitation.response.status, 201);
  assert.ok(invitation.payload.invitation?.code);
  const accepted = await request(first.base, "/account/invitations/accept", {
    method: "POST",
    headers: tenantHeaders,
    body: JSON.stringify({ code: invitation.payload.invitation.code }),
  });
  assert.equal(accepted.response.status, 200);
  const fileBytes = Buffer.from(
    `%PDF-1.4\n${"% Invented local integration fixture\n".repeat(1000)}%%EOF\n`,
  );
  const fileBody = JSON.stringify({
    title: "Private integration file",
    filename: "local-fixture.pdf",
    mimeType: "application/pdf",
    contentBase64: fileBytes.toString("base64"),
    sharing: "private",
  });
  assert.ok(Buffer.byteLength(fileBody) > 16_384);
  const anonymousUpload = await request(
    first.base,
    `/account/properties/${propertyId}/documents`,
    {
      method: "POST",
      headers: accountHeaders(),
      body: fileBody,
    },
  );
  assert.equal(anonymousUpload.response.status, 401);
  const uploaded = await request(
    first.base,
    `/account/properties/${propertyId}/documents`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: fileBody,
    },
  );
  assert.equal(uploaded.response.status, 201);
  assert.ok(uploaded.payload.document?.id);
  const documentId = uploaded.payload.document.id;
  const privateDownload = await fetch(
    `${first.base}/account/documents/${documentId}/content`,
    {
      headers: tenantHeaders,
    },
  );
  assert.equal(privateDownload.status, 404);
  const shared = await request(first.base, `/account/documents/${documentId}`, {
    method: "PATCH",
    headers: sessionHeaders,
    body: JSON.stringify({
      version: uploaded.payload.document.version,
      title: "Shared integration file",
      sharing: "shared",
      recipientAccountId: tenant.payload.account.id,
      archived: false,
    }),
  });
  assert.equal(shared.response.status, 200);
  const notificationList = await request(first.base, "/account/notifications", {
    headers: tenantHeaders,
  });
  assert.equal(notificationList.response.status, 200);
  assert.ok(Array.isArray(notificationList.payload.notifications));
  const sharedNotification = notificationList.payload.notifications.find(
    (item) => item.kind === "document_shared",
  );
  assert.ok(sharedNotification);
  const readNotification = await request(
    first.base,
    `/account/notifications/${sharedNotification.id}`,
    {
      method: "PATCH",
      headers: tenantHeaders,
      body: JSON.stringify({ read: true }),
    },
  );
  assert.equal(readNotification.response.status, 200);

  const rentCreation = {
    mutationId: randomUUID(),
    tenantAccountId: tenant.payload.account.id,
    period: "2026-01",
    currency: "AOA",
    amountDueMinor: 35000000,
    dueOn: "2026-01-05",
  };
  const rent = await request(
    first.base,
    `/account/properties/${propertyId}/rent-records`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(rentCreation),
    },
  );
  assert.equal(rent.response.status, 201);
  assert.ok(rent.payload.record?.id);
  const rentId = rent.payload.record.id;
  const rentTransfer = await request(
    first.base,
    `/account/rent-records/${rentId}/transfer`,
    {
      method: "POST",
      headers: tenantHeaders,
      body: JSON.stringify({
        mutationId: randomUUID(),
        version: rent.payload.record.version,
        amountMinor: 35000000,
        transferredOn: "2026-01-04",
        reference: "INVENTED-TRANSFER-ONLY",
        note: "Synthetic local transfer report; no money was moved.",
        evidenceDocumentId: null,
      }),
    },
  );
  assert.equal(rentTransfer.response.status, 200);
  assert.equal(rentTransfer.payload.record?.status, "awaiting_confirmation");
  const rentConfirmation = {
    mutationId: randomUUID(),
    version: rentTransfer.payload.record!.version,
    decision: "confirm",
  };
  const confirmedRent = await request(
    first.base,
    `/account/rent-records/${rentId}/review`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(rentConfirmation),
    },
  );
  assert.equal(confirmedRent.response.status, 200);
  assert.equal(confirmedRent.payload.record?.status, "confirmed");
  assert.equal(confirmedRent.payload.record?.amountDueMinor, 35000000);
  const confirmedRentVersion = confirmedRent.payload.record!.version;
  const confirmedRentHistory = confirmedRent.payload.record!.history;
  const listingInput = {
    title: "Synthetic integration listing",
    description:
      "Invented local listing for the compiled test only, not a real offer.",
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
  const draftListing = await request(first.base, "/account/market/listings", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      ...listingInput,
      propertyId,
      mutationId: randomUUID(),
    }),
  });
  assert.equal(draftListing.response.status, 201);
  assert.ok(draftListing.payload.listing);
  const listingId = draftListing.payload.listing.id;
  const visibleListing = await request(
    first.base,
    `/account/market/listings/${listingId}`,
    {
      method: "PATCH",
      headers: sessionHeaders,
      body: JSON.stringify({
        ...listingInput,
        mutationId: randomUUID(),
        version: 1,
        status: "visible",
      }),
    },
  );
  assert.equal(visibleListing.response.status, 200);
  const enquiryInput = {
    mutationId: randomUUID(),
    body: "Synthetic enquiry through the compiled local API.",
  };
  const enquiry = await request(
    first.base,
    `/account/market/listings/${listingId}/enquiries`,
    {
      method: "POST",
      headers: tenantHeaders,
      body: JSON.stringify(enquiryInput),
    },
  );
  assert.equal(enquiry.response.status, 201);
  assert.ok(enquiry.payload.conversation && enquiry.payload.message);
  const conversationId = enquiry.payload.conversation.id;
  const enquiryMessageId = enquiry.payload.message.id;
  const readConversation = await request(
    first.base,
    `/account/market/conversations/${conversationId}/read`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ throughSequence: 1 }),
    },
  );
  assert.equal(readConversation.response.status, 200);
  assert.equal(readConversation.payload.conversation?.unreadCount, 0);
  const viewingInput = {
    mutationId: randomUUID(),
    startsAt: new Date(
      Math.ceil(Date.now() / 60000) * 60000 + 86400000,
    ).toISOString(),
    durationMinutes: 45,
    note: "Synthetic participant viewing; no external delivery.",
  };
  const viewing = await request(
    first.base,
    `/account/market/conversations/${conversationId}/viewings`,
    {
      method: "POST",
      headers: tenantHeaders,
      body: JSON.stringify(viewingInput),
    },
  );
  assert.equal(viewing.response.status, 201);
  assert.ok(viewing.payload.viewing);
  const viewingId = viewing.payload.viewing.id;
  const viewingConfirmation = {
    mutationId: randomUUID(),
    version: 1,
    action: "confirm",
    note: "Explicit owner agreement",
  };
  const confirmedViewing = await request(
    first.base,
    `/account/market/viewings/${viewingId}/actions`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(viewingConfirmation),
    },
  );
  assert.equal(confirmedViewing.response.status, 200);
  assert.equal(confirmedViewing.payload.viewing?.status, "confirmed");
  assert.equal(confirmedViewing.payload.history?.length, 2);
  await stop(first.child);
  assert.equal(first.child.exitCode, 0);

  const restarted = await start();
  assert.equal(restarted.child.exitCode, null, restarted.output);
  const restored = await request(restarted.base, "/account/session", {
    headers: { Cookie: cookie },
  });
  assert.equal(restored.payload.account?.id, accountId);
  assert.equal(
    restored.payload.account?.displayName,
    "Persisted local profile",
  );
  assert.equal(restored.payload.account?.locale, "en");
  assert.equal(restored.payload.account?.version, 2);
  const restoredWorkspaces = await request(
    restarted.base,
    "/account/workspaces",
    { headers: { Cookie: cookie } },
  );
  assert.equal(restoredWorkspaces.response.status, 200);
  assert.equal(
    restoredWorkspaces.payload.workspaces?.find(
      (item) => item.id === workspaceId,
    )?.properties[0].id,
    propertyId,
  );
  const restoredRepairs = await request(
    restarted.base,
    `/account/properties/${propertyId}/maintenance`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(restoredRepairs.response.status, 200);
  assert.equal(restoredRepairs.payload.requests?.[0].id, repairId);
  assert.equal(restoredRepairs.payload.requests?.[0].status, "in_progress");
  assert.equal(restoredRepairs.payload.requests?.[0].version, 2);
  const restoredFile = await fetch(
    `${restarted.base}/account/documents/${documentId}/content`,
    { headers: tenantHeaders },
  );
  assert.equal(restoredFile.status, 200);
  assert.match(
    restoredFile.headers.get("content-disposition") ?? "",
    /^attachment;/,
  );
  assert.equal(restoredFile.headers.get("x-content-type-options"), "nosniff");
  assert.equal(restoredFile.headers.get("cache-control"), "no-store");
  assert.equal(
    restoredFile.headers.get("content-type"),
    "application/octet-stream",
  );
  assert.deepEqual(Buffer.from(await restoredFile.arrayBuffer()), fileBytes);
  const restoredNotifications = await request(
    restarted.base,
    "/account/notifications",
    { headers: tenantHeaders },
  );
  assert.ok(Array.isArray(restoredNotifications.payload.notifications));
  assert.ok(
    restoredNotifications.payload.notifications.find(
      (item) => item.id === sharedNotification.id,
    )?.readAt,
  );
  const restoredRent = await request(
    restarted.base,
    `/account/rent-records/${rentId}`,
    { headers: tenantHeaders },
  );
  assert.equal(restoredRent.response.status, 200);
  assert.equal(restoredRent.payload.record?.status, "confirmed");
  assert.equal(restoredRent.payload.record?.version, confirmedRentVersion);
  assert.deepEqual(restoredRent.payload.record?.history, confirmedRentHistory);
  const replayedRent = await request(
    restarted.base,
    `/account/rent-records/${rentId}/review`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(rentConfirmation),
    },
  );
  assert.equal(replayedRent.response.status, 200);
  assert.equal(replayedRent.payload.replayed, true);
  assert.deepEqual(replayedRent.payload.record?.history, confirmedRentHistory);
  const restoredListing = await request(
    restarted.base,
    `/account/market/listings/${listingId}`,
    { headers: tenantHeaders },
  );
  assert.equal(restoredListing.response.status, 200);
  assert.equal(restoredListing.payload.listing?.status, "visible");
  assert.equal(
    Object.hasOwn(restoredListing.payload.listing!, "propertyId"),
    false,
  );
  const restoredConversation = await request(
    restarted.base,
    `/account/market/conversations/${conversationId}/messages`,
    { headers: sessionHeaders },
  );
  assert.equal(restoredConversation.response.status, 200);
  assert.equal(restoredConversation.payload.messages?.[0].id, enquiryMessageId);
  assert.equal(restoredConversation.payload.conversation?.unreadCount, 0);
  const replayedEnquiry = await request(
    restarted.base,
    `/account/market/listings/${listingId}/enquiries`,
    {
      method: "POST",
      headers: tenantHeaders,
      body: JSON.stringify(enquiryInput),
    },
  );
  assert.equal(replayedEnquiry.response.status, 200);
  assert.equal(replayedEnquiry.payload.replayed, true);
  assert.equal(replayedEnquiry.payload.message?.id, enquiryMessageId);
  const restoredViewing = await request(
    restarted.base,
    `/account/market/viewings/${viewingId}`,
    { headers: sessionHeaders },
  );
  assert.equal(restoredViewing.response.status, 200);
  assert.equal(restoredViewing.payload.viewing?.status, "confirmed");
  assert.equal(
    restoredViewing.payload.viewing?.startsAt,
    viewingInput.startsAt,
  );
  assert.deepEqual(
    restoredViewing.payload.history,
    confirmedViewing.payload.history,
  );
  const replayedViewing = await request(
    restarted.base,
    `/account/market/viewings/${viewingId}/actions`,
    {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(viewingConfirmation),
    },
  );
  assert.equal(replayedViewing.response.status, 200);
  assert.equal(replayedViewing.payload.replayed, true);
  assert.deepEqual(
    replayedViewing.payload.history,
    confirmedViewing.payload.history,
  );
  console.log(
    "✓ compiled participant viewing, owner confirmation, immutable history and exact retry survive process restart",
  );
  console.log(
    "✓ compiled local catalogue, private enquiry, read state and exact retry survive process restart without exposing private property IDs",
  );
  const loggedIn = await request(restarted.base, "/account/login", {
    method: "POST",
    headers: accountHeaders(),
    body: JSON.stringify({ email: fixture.email, password: fixture.password }),
  });
  assert.equal(loggedIn.response.status, 200);
  assert.equal(loggedIn.payload.account?.id, accountId);
  await stop(restarted.child);
  console.log(
    "✓ compiled API persists accounts, properties, maintenance, private files, notifications and owner-confirmed direct-transfer records across restart; rent retries remain idempotent and demo roles confer no access",
  );

  const disabled = await start({ KASA_API_LOCAL_ACCOUNTS: "false" });
  assert.equal(disabled.child.exitCode, null, disabled.output);
  const disabledSession = await request(disabled.base, "/account/session");
  assert.equal(disabledSession.response.status, 503);
  assert.equal(disabledSession.payload.error?.code, "accounts_disabled");
  assert.equal(
    disabledSession.response.headers.get("cache-control"),
    "no-store",
  );
  assert.equal(
    disabledSession.response.headers.get("x-kasa-data-mode"),
    "disabled",
  );
  await stop(disabled.child);
  const unsafeConfigurations: Record<string, string>[] = [
    { NODE_ENV: "production" },
    { KASA_API_HOST: "0.0.0.0" },
    { KASA_API_ALLOWED_ORIGINS: "https://public.example" },
    { KASA_API_ACCOUNT_DB: resolve(root, "dist", "accounts.sqlite") },
  ];
  for (const env of unsafeConfigurations) {
    const refused = await start(env);
    assert.equal(refused.child.exitCode, 1, refused.output);
    assert.doesNotMatch(refused.output, /Kasa API listening/);
  }
  console.log(
    "✓ disabled, production, public binding, public origin and web-root database boundaries are enforced at actual startup",
  );
} finally {
  for (const child of children) await stop(child);
  const info = await lstat(directory);
  assert.ok(info.isDirectory() && !info.isSymbolicLink());
  const files = await readdir(directory);
  assert.ok(files.length <= 4);
  for (const name of files) {
    assert.ok(
      [
        "accounts.sqlite",
        "accounts.sqlite-wal",
        "accounts.sqlite-shm",
        "accounts.sqlite-journal",
      ].includes(name),
    );
    const path = join(directory, name);
    const file = await lstat(path);
    assert.ok(file.isFile() && !file.isSymbolicLink());
    await unlink(path);
  }
  await rmdir(directory);
}
