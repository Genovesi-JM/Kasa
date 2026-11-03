import { strict as assert } from "node:assert";
import {
  constants,
  copyFileSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import { createAccountRouter } from "./accounts.ts";
import type { PublicAccount } from "./account-store.ts";
import {
  privateDocumentListSchema,
  privateDocumentResponseSchema,
  savedNotificationsSchema,
  savedNotificationResponseSchema,
  readAllNotificationsSchema,
  type PrivateDocument,
  type SavedNotification,
} from "../src/platform/documentNotificationContracts.ts";

const directory = mkdtempSync(join(tmpdir(), "kasa-private-documents-smoke-"));
const databasePath = join(directory, "documents.sqlite");
const migrationPath = join(directory, "migration.sqlite");
const capacityPath = join(directory, "capacity.sqlite");
const origin = "http://127.0.0.1:5174";
const password = "Local-document-fixture-password-123";
// Fixed 32-byte test key so the whole suite exercises at-rest encryption.
const documentKey = Buffer.from(
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
  "hex",
);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aANsAAAAASUVORK5CYII=",
  "base64",
);
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1,
  0, 1, 0, 0, 0xff, 0xd9,
]);
let service: ReturnType<typeof createAccountRouter> | undefined;
let server: Server | undefined;
let base = "";
let checks = 0;

interface Client {
  account: PublicAccount;
  cookie: string;
  csrfToken: string;
}
interface AccountPayload {
  account: PublicAccount | null;
  csrfToken: string | null;
}
interface NotificationPage {
  notifications: SavedNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

async function start(path = databasePath) {
  service = createAccountRouter({
    databasePath: path,
    allowedOrigins: [origin],
    documentKey,
  });
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "documents-smoke";
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

async function request<T>(
  path: string,
  options: {
    client?: Client;
    method?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
    omitOrigin?: boolean;
    omitCsrf?: boolean;
  } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.omitOrigin ? {} : { Origin: origin }),
      ...(options.body !== undefined || options.rawBody !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
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
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const payload = (await response.json()) as T;
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-kasa-data-mode"), "local-persisted");
  const text = JSON.stringify(payload);
  assert.equal(text.includes(password), false);
  assert.equal(text.includes(databasePath), false);
  assert.equal(text.includes("contentBase64"), false);
  if (response.ok) {
    const pathname = path.split("?", 1)[0];
    if (/^\/properties\/[^/]+\/documents$/.test(pathname))
      (options.method === "POST"
        ? privateDocumentResponseSchema
        : privateDocumentListSchema
      ).parse(payload);
    else if (/^\/documents\/[^/]+$/.test(pathname))
      privateDocumentResponseSchema.parse(payload);
    else if (pathname === "/notifications")
      savedNotificationsSchema.parse(payload);
    else if (pathname === "/notifications/read-all")
      readAllNotificationsSchema.parse(payload);
    else if (/^\/notifications\/[^/]+$/.test(pathname))
      savedNotificationResponseSchema.parse(payload);
  }
  return { response, payload };
}

function failure(
  result: { response: Response; payload: unknown },
  status: number,
  code?: string,
) {
  assert.equal(result.response.status, status);
  const payload = result.payload as {
    error: { code: string; message: string };
    requestId: string;
  };
  if (code) assert.equal(payload.error.code, code);
  assert.equal(typeof payload.error.message, "string");
  assert.equal(payload.requestId, "documents-smoke");
}

async function register(name: string): Promise<Client> {
  const result = await request<AccountPayload>("/register", {
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

async function content(document: PrivateDocument, client?: Client) {
  const response = await fetch(`${base}/documents/${document.id}/content`, {
    headers: client
      ? { Cookie: client.cookie, "X-Kasa-Account-Id": client.account.id }
      : {},
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  if (response.ok) {
    assert.equal(
      response.headers.get("content-type"),
      "application/octet-stream",
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^attachment;/,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, document.byteSize);
    return { response, bytes };
  }
  const payload = await response.json();
  return { response, bytes: null, payload };
}

const fileBody = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  filename: "test-document.pdf",
  mimeType: "application/pdf",
  contentBase64: pdf.toString("base64"),
  ...extra,
});
async function upload(
  propertyId: string,
  client: Client,
  body: ReturnType<typeof fileBody>,
) {
  const result = await request<{ document: PrivateDocument }>(
    `/properties/${propertyId}/documents`,
    { method: "POST", client, body },
  );
  assert.equal(result.response.status, 201);
  return result.payload.document;
}
async function patch(
  document: PrivateDocument,
  client: Client,
  changes: Record<string, unknown>,
) {
  return request<{ document: PrivateDocument }>(`/documents/${document.id}`, {
    method: "PATCH",
    client,
    body: {
      version: document.version,
      title: document.title,
      sharing: document.sharing,
      ...(document.recipientAccountId
        ? { recipientAccountId: document.recipientAccountId }
        : {}),
      archived: document.archived,
      ...changes,
    },
  });
}
async function notifications(client: Client, query = "") {
  const result = await request<NotificationPage>(`/notifications${query}`, {
    client,
  });
  assert.equal(result.response.status, 200);
  return result.payload;
}
function passed(label: string) {
  checks += 1;
  console.log(`✓ ${label}`);
}

try {
  await start();
  const owner = await register("document-owner");
  const tenant = await register("document-tenant");
  const outsider = await register("document-outsider");
  const workspace = (
    await request<{ workspace: { id: string } }>("/workspaces", {
      method: "POST",
      client: owner,
      body: { name: "Private document fixture" },
    })
  ).payload.workspace;
  const property = (
    await request<{ property: { id: string } }>(
      `/workspaces/${workspace.id}/properties`,
      {
        method: "POST",
        client: owner,
        body: { name: "Private test home", address: "Local synthetic address" },
      },
    )
  ).payload.property;
  async function connect(client: Client) {
    const invitation = (
      await request<{ invitation: { code: string } }>(
        `/properties/${property.id}/invitations`,
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
  await connect(outsider);
  assert.equal((await notifications(owner)).notifications.length, 0);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  failure(
    await request(`/properties/${property.id}/documents`),
    401,
    "AUTH_REQUIRED",
  );
  for (const rawBody of ["{", " ".repeat(1_600_000) + "{}"]) {
    failure(
      await request(`/properties/${property.id}/documents`, {
        method: "POST",
        rawBody,
      }),
      401,
      "AUTH_REQUIRED",
    );
    failure(
      await request(`/properties/${property.id}/documents`, {
        method: "POST",
        client: owner,
        omitCsrf: true,
        rawBody,
      }),
      403,
      "CSRF_DENIED",
    );
  }
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      omitOrigin: true,
      body: fileBody("Origin denied"),
    }),
    403,
    "ORIGIN_DENIED",
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      rawBody: "{",
      headers: {
        "X-Kasa-Account-Id": tenant.account.id,
        "X-CSRF-Token": "stale-token",
      },
    }),
    401,
    "ACCOUNT_CHANGED",
  );
  passed(
    "document uploads authenticate and check CSRF before parsing malformed or large payloads",
  );

  let ownerPrivate = await upload(
    property.id,
    owner,
    fileBody("Owner private record"),
  );
  let tenantPrivate = await upload(
    property.id,
    tenant,
    fileBody("Tenant private record"),
  );
  assert.equal(ownerPrivate.sharing, "private");
  assert.equal(ownerPrivate.recipientAccountId, null);
  assert.equal((await content(ownerPrivate, owner)).response.status, 200);
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await content(tenantPrivate, owner)).response.status, 404);
  assert.equal((await content(tenantPrivate, outsider)).response.status, 404);
  assert.equal((await content(ownerPrivate)).response.status, 401);
  const ownList = (
    await request<{ documents: PrivateDocument[] }>(
      `/properties/${property.id}/documents`,
      { client: owner },
    )
  ).payload.documents;
  const tenantList = (
    await request<{ documents: PrivateDocument[] }>(
      `/properties/${property.id}/documents`,
      { client: tenant },
    )
  ).payload.documents;
  assert.deepEqual(
    ownList.map((document) => document.id),
    [ownerPrivate.id],
  );
  assert.deepEqual(
    tenantList.map((document) => document.id),
    [tenantPrivate.id],
  );
  assert.equal((await notifications(owner)).notifications.length, 0);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  passed(
    "files default to private, including tenant files hidden from the property owner and other tenants",
  );

  const invalidBodies = [
    { contentBase64: "not base64!" },
    { contentBase64: `${pdf.toString("base64")}\n` },
    {
      contentBase64: Buffer.from(
        "<html><script>alert(1)</script></html>",
      ).toString("base64"),
    },
    { filename: "image.png", mimeType: "image/png" },
    { filename: "../record.pdf" },
    { filename: "directory\\record.pdf" },
    { filename: "record\nInjected.pdf" },
    { filename: "record\u202e.pdf" },
    { filename: "record.png" },
    { filename: "disk:record.pdf" },
  ];
  for (const extra of invalidBodies)
    failure(
      await request(`/properties/${property.id}/documents`, {
        method: "POST",
        client: owner,
        body: fileBody("Invalid fixture", extra),
      }),
      422,
      "INVALID_FILE",
    );
  const tooLarge = Buffer.alloc(1024 * 1024 + 1, 32);
  pdf.copy(tooLarge);
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Oversized", {
        contentBase64: tooLarge.toString("base64"),
      }),
    }),
    422,
    "INVALID_FILE",
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Unsupported MIME", { mimeType: "text/html" }),
    }),
    422,
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Forged uploader", { uploadedBy: tenant.account.id }),
    }),
    422,
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Private recipient", {
        recipientAccountId: tenant.account.id,
      }),
    }),
    422,
    "INVALID_RECIPIENT",
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: tenant,
      body: fileBody("Wrong counterpart", {
        sharing: "shared",
        recipientAccountId: outsider.account.id,
      }),
    }),
    422,
    "INVALID_RECIPIENT",
  );
  const cleanName = await upload(
    property.id,
    owner,
    fileBody("Sanitized filename", { filename: "<img onerror=alert(1)>.pdf" }),
  );
  assert.doesNotMatch(cleanName.filename, /[<>\r\n\\/]/);
  assert.deepEqual((await content(cleanName, owner)).bytes, pdf);
  for (const [filename, mimeType, bytes] of [
    ["image.png", "image/png", png],
    ["image.jpg", "image/jpeg", jpeg],
  ] as const) {
    const document = await upload(
      property.id,
      owner,
      fileBody("Supported signature", {
        filename,
        mimeType,
        contentBase64: bytes.toString("base64"),
      }),
    );
    assert.deepEqual((await content(document, owner)).bytes, bytes);
  }
  const boundaryBytes = Buffer.alloc(1024 * 1024, 32);
  pdf.copy(boundaryBytes);
  const boundaryDocument = await upload(
    property.id,
    owner,
    fileBody("Exactly one MiB", {
      contentBase64: boundaryBytes.toString("base64"),
    }),
  );
  assert.equal(boundaryDocument.byteSize, 1024 * 1024);
  assert.deepEqual(
    (await content(boundaryDocument, owner)).bytes,
    boundaryBytes,
  );
  passed(
    "canonical base64, signatures, MIME extensions, size and safe filenames are enforced; downloads are opaque attachments",
  );
  await stop();
  await start();

  const ownerShare = await patch(ownerPrivate, owner, {
    sharing: "shared",
    recipientAccountId: tenant.account.id,
  });
  assert.equal(ownerShare.response.status, 200);
  ownerPrivate = ownerShare.payload.document;
  const tenantShare = await patch(tenantPrivate, tenant, { sharing: "shared" });
  assert.equal(tenantShare.response.status, 200);
  tenantPrivate = tenantShare.payload.document;
  assert.equal(tenantPrivate.recipientAccountId, owner.account.id);
  assert.deepEqual((await content(ownerPrivate, tenant)).bytes, pdf);
  assert.deepEqual((await content(tenantPrivate, owner)).bytes, pdf);
  assert.equal((await content(ownerPrivate, outsider)).response.status, 404);
  failure(
    await patch(ownerPrivate, tenant, { title: "Recipient cannot edit" }),
    404,
    "NOT_FOUND",
  );
  failure(
    await patch(tenantPrivate, owner, {
      title: "Owner cannot edit another uploader",
    }),
    404,
    "NOT_FOUND",
  );
  failure(
    await patch(ownerPrivate, owner, { version: 1, title: "Stale title" }),
    409,
    "VERSION_CONFLICT",
  );
  failure(
    await patch(ownerPrivate, owner, { contentBase64: png.toString("base64") }),
    422,
  );
  assert.equal(
    (await notifications(tenant)).notifications.filter(
      (item) => item.kind === "document_shared",
    ).length,
    1,
  );
  assert.equal(
    (await notifications(owner)).notifications.filter(
      (item) => item.kind === "document_shared",
    ).length,
    1,
  );
  assert.equal((await notifications(outsider)).notifications.length, 0);
  const previousShareNotification = (await notifications(tenant))
    .notifications[0];
  const renamed = await patch(ownerPrivate, owner, {
    title: "Updated title, immutable original bytes",
  });
  assert.equal(renamed.response.status, 200);
  ownerPrivate = renamed.payload.document;
  assert.deepEqual((await content(ownerPrivate, owner)).bytes, pdf);
  assert.equal((await notifications(tenant)).notifications.length, 1);
  assert.equal(
    (await notifications(tenant)).notifications[0].id,
    previousShareNotification.id,
  );
  const noOp = await patch(ownerPrivate, owner, {});
  assert.equal(noOp.response.status, 200);
  assert.deepEqual(noOp.payload.document, ownerPrivate);
  assert.equal((await notifications(tenant)).notifications.length, 1);
  passed(
    "sharing is limited to the owner–assigned-tenant pair; only uploaders edit versioned metadata and title edits do not duplicate alerts",
  );

  const archived = await patch(ownerPrivate, owner, { archived: true });
  assert.equal(archived.response.status, 200);
  ownerPrivate = archived.payload.document;
  assert.equal(ownerPrivate.sharing, "private");
  assert.equal(ownerPrivate.recipientAccountId, null);
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await content(ownerPrivate, owner)).response.status, 200);
  assert.equal(
    (await notifications(tenant)).notifications.some(
      (item) => item.id === previousShareNotification.id,
    ),
    false,
  );
  failure(
    await request(`/notifications/${previousShareNotification.id}`, {
      method: "PATCH",
      client: tenant,
      body: { read: true },
    }),
    404,
    "NOT_FOUND",
  );
  const restored = await patch(ownerPrivate, owner, {
    archived: false,
    sharing: "shared",
    recipientAccountId: tenant.account.id,
  });
  assert.equal(restored.response.status, 200);
  ownerPrivate = restored.payload.document;
  assert.equal(ownerPrivate.sharing, "private");
  assert.equal(ownerPrivate.recipientAccountId, null);
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  ownerPrivate = (
    await patch(ownerPrivate, owner, {
      sharing: "shared",
      recipientAccountId: tenant.account.id,
    })
  ).payload.document;
  const restoredNotification = (await notifications(tenant)).notifications[0];
  assert.notEqual(restoredNotification.id, previousShareNotification.id);
  const unshared = await patch(ownerPrivate, owner, {
    sharing: "private",
    recipientAccountId: undefined,
  });
  assert.equal(unshared.response.status, 200);
  ownerPrivate = unshared.payload.document;
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  assert.equal(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${property.id}/documents`,
        { client: tenant },
      )
    ).payload.documents.some((item) => item.id === ownerPrivate.id),
    false,
  );
  passed(
    "archive and unshare revoke recipient access and alerts; restore stays private until a separate explicit sharing action",
  );

  ownerPrivate = (
    await patch(ownerPrivate, owner, {
      sharing: "shared",
      recipientAccountId: tenant.account.id,
    })
  ).payload.document;
  const replacedAlert = (await notifications(tenant)).notifications[0];
  ownerPrivate = (
    await patch(ownerPrivate, owner, {
      sharing: "shared",
      recipientAccountId: outsider.account.id,
    })
  ).payload.document;
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await content(ownerPrivate, outsider)).response.status, 200);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  failure(
    await request(`/notifications/${replacedAlert.id}`, {
      method: "PATCH",
      client: tenant,
      body: { read: true },
    }),
    404,
    "NOT_FOUND",
  );
  assert.equal((await notifications(outsider)).notifications.length, 1);
  ownerPrivate = (
    await patch(ownerPrivate, owner, {
      sharing: "private",
      recipientAccountId: undefined,
    })
  ).payload.document;
  assert.equal((await notifications(outsider)).notifications.length, 0);
  passed(
    "changing the explicit recipient immediately revokes the previous recipient's bytes and alerts without sharing to other tenants",
  );
  await stop();
  await start();

  const repair = (
    await request<{ request: { id: string; version: number } }>(
      `/properties/${property.id}/maintenance`,
      {
        method: "POST",
        client: tenant,
        body: {
          title: "Private leak",
          description: "Secret repair details must never appear in alerts",
          priority: "normal",
        },
      },
    )
  ).payload.request;
  const ownerAlerts = await notifications(owner);
  const createdAlert = ownerAlerts.notifications.find(
    (item) => item.resourceId === repair.id,
  )!;
  assert.ok(createdAlert);
  assert.equal(createdAlert.kind, "maintenance_created");
  assert.equal(
    JSON.stringify(ownerAlerts).includes("Secret repair details"),
    false,
  );
  assert.equal(
    (await notifications(tenant)).notifications.some(
      (item) => item.resourceId === repair.id,
    ),
    false,
  );
  assert.equal((await notifications(outsider)).notifications.length, 0);
  assert.equal(
    (
      await request(`/maintenance/${repair.id}`, {
        method: "PATCH",
        client: owner,
        body: {
          version: 1,
          status: "in_progress",
          message: "Sensitive owner comment",
        },
      })
    ).response.status,
    200,
  );
  const tenantAlert = (await notifications(tenant)).notifications.find(
    (item) => item.resourceId === repair.id,
  )!;
  assert.ok(tenantAlert);
  assert.equal(tenantAlert.kind, "maintenance_updated");
  assert.equal(
    (await notifications(tenant)).notifications.filter(
      (item) => item.resourceId === repair.id,
    ).length,
    1,
  );
  assert.equal(
    JSON.stringify(await notifications(tenant)).includes(
      "Sensitive owner comment",
    ),
    false,
  );
  failure(
    await request(`/maintenance/${repair.id}`, {
      method: "PATCH",
      client: owner,
      body: { version: 1, status: "resolved" },
    }),
    409,
    "VERSION_CONFLICT",
  );
  assert.equal(
    (await notifications(tenant)).notifications.filter(
      (item) => item.resourceId === repair.id,
    ).length,
    1,
  );
  const marked = await request<{ notification: SavedNotification }>(
    `/notifications/${tenantAlert.id}`,
    { method: "PATCH", client: tenant, body: { read: true } },
  );
  assert.equal(marked.response.status, 200);
  assert.ok(marked.payload.notification.readAt);
  const again = await request<{ notification: SavedNotification }>(
    `/notifications/${tenantAlert.id}`,
    { method: "PATCH", client: tenant, body: { read: true } },
  );
  assert.equal(
    again.payload.notification.readAt,
    marked.payload.notification.readAt,
  );
  failure(
    await request(`/notifications/${tenantAlert.id}`, {
      method: "PATCH",
      client: outsider,
      body: { read: true },
    }),
    404,
    "NOT_FOUND",
  );
  failure(
    await request(`/notifications/${tenantAlert.id}`, {
      method: "PATCH",
      client: tenant,
      body: { read: true },
      omitCsrf: true,
    }),
    403,
    "CSRF_DENIED",
  );
  const readAll = await request<{ updated: number }>(
    "/notifications/read-all",
    { method: "POST", client: owner, body: {} },
  );
  assert.ok(readAll.payload.updated >= 2);
  assert.equal(
    (
      await request<{ updated: number }>("/notifications/read-all", {
        method: "POST",
        client: owner,
        body: {},
      })
    ).payload.updated,
    0,
  );
  assert.equal((await notifications(owner)).unreadCount, 0);
  assert.equal(
    (await notifications(tenant)).notifications.find(
      (item) => item.id === tenantAlert.id,
    )?.readAt,
    marked.payload.notification.readAt,
  );
  passed(
    "maintenance notifications are transactional, private, counterpart-only, deduplicated per action and read state is account-scoped/idempotent",
  );
  await stop();
  await start();
  assert.equal(
    (await notifications(tenant)).notifications.find(
      (item) => item.id === tenantAlert.id,
    )?.readAt,
    marked.payload.notification.readAt,
  );

  ownerPrivate = (
    await patch(ownerPrivate, owner, {
      sharing: "shared",
      recipientAccountId: tenant.account.id,
    })
  ).payload.document;
  assert.equal(
    (
      await request(`/properties/${property.id}/tenants/${tenant.account.id}`, {
        method: "DELETE",
        client: owner,
        body: {},
      })
    ).response.status,
    200,
  );
  assert.equal((await content(ownerPrivate, tenant)).response.status, 404);
  assert.equal((await content(tenantPrivate, tenant)).response.status, 404);
  assert.equal((await content(tenantPrivate, owner)).response.status, 404);
  assert.equal((await notifications(tenant)).notifications.length, 0);
  assert.equal(
    (await notifications(owner)).notifications.some(
      (item) =>
        item.kind === "document_shared" && item.resourceId === tenantPrivate.id,
    ),
    false,
  );
  await connect(tenant);
  const ownerAfterJoin = (
    await request<{ documents: PrivateDocument[] }>(
      `/properties/${property.id}/documents`,
      { client: owner },
    )
  ).payload.documents.find((item) => item.id === ownerPrivate.id)!;
  const tenantAfterJoin = (
    await request<{ documents: PrivateDocument[] }>(
      `/properties/${property.id}/documents`,
      { client: tenant },
    )
  ).payload.documents.find((item) => item.id === tenantPrivate.id)!;
  assert.equal(ownerAfterJoin.sharing, "private");
  assert.equal(ownerAfterJoin.recipientAccountId, null);
  assert.equal(tenantAfterJoin.sharing, "private");
  assert.equal(tenantAfterJoin.recipientAccountId, null);
  assert.ok(ownerAfterJoin.version > ownerPrivate.version);
  assert.ok(tenantAfterJoin.version > tenantPrivate.version);
  assert.equal((await content(ownerAfterJoin, tenant)).response.status, 404);
  assert.equal((await content(tenantAfterJoin, owner)).response.status, 404);
  assert.equal(
    (await notifications(tenant)).notifications.filter(
      (item) => item.kind === "document_shared",
    ).length,
    0,
  );
  assert.equal(
    (await notifications(tenant)).notifications.some(
      (item) => item.id === tenantAlert.id,
    ),
    false,
  );
  assert.equal(
    (await notifications(owner)).notifications.filter(
      (item) => item.kind === "document_shared",
    ).length,
    0,
  );
  passed(
    "removing a tenant permanently unshares both directions; rejoining never resurrects old shared files or document alerts",
  );

  await stop();
  const pageFixture = new DatabaseSync(databasePath);
  const pageIds = Array.from({ length: 60 }, () => randomUUID());
  const sameTimestamp = Date.now();
  const addAlert = pageFixture.prepare(
    "INSERT INTO local_notifications(id,recipient_account_id,kind,property_id,resource_id,actor_id,actor_name,created_at) VALUES(?,?,'maintenance_updated',?,?,?,?,?)",
  );
  pageFixture.exec("BEGIN");
  for (const id of pageIds)
    addAlert.run(
      id,
      tenant.account.id,
      property.id,
      repair.id,
      owner.account.id,
      owner.account.displayName,
      sameTimestamp,
    );
  pageFixture.exec("COMMIT");
  pageFixture.close();
  await start();
  const firstPage = await notifications(tenant);
  assert.equal(firstPage.notifications.length, 50);
  assert.equal(firstPage.unreadCount, 60);
  assert.ok(firstPage.nextCursor);
  const secondPage = await notifications(
    tenant,
    `?before=${encodeURIComponent(firstPage.nextCursor)}`,
  );
  assert.equal(secondPage.notifications.length, 10);
  assert.equal(secondPage.unreadCount, 60);
  assert.equal(secondPage.nextCursor, null);
  assert.deepEqual(
    [...firstPage.notifications, ...secondPage.notifications].map(
      (item) => item.id,
    ),
    pageIds.toSorted().reverse(),
  );
  for (const before of [
    "bad",
    `-1:${randomUUID()}`,
    `99999999999999999:${randomUUID()}`,
    "123:not-a-uuid",
  ])
    failure(
      await request(`/notifications?before=${encodeURIComponent(before)}`, {
        client: tenant,
      }),
      422,
      "VALIDATION_ERROR",
    );
  failure(
    await request("/notifications?unexpected=1", { client: tenant }),
    422,
    "VALIDATION_ERROR",
  );
  assert.equal((await notifications(outsider)).notifications.length, 0);
  assert.equal(
    (
      await request<{ updated: number }>("/notifications/read-all", {
        method: "POST",
        client: tenant,
        body: {},
      })
    ).payload.updated,
    60,
  );
  assert.equal((await notifications(tenant)).unreadCount, 0);
  assert.ok(
    (
      await notifications(
        tenant,
        `?before=${encodeURIComponent(firstPage.nextCursor)}`,
      )
    ).notifications.every((item) => item.readAt !== null),
  );
  passed(
    "notification keyset pagination handles equal timestamps without omissions or duplicates; unread counts and read-all cover every authorized page",
  );

  await stop();
  const faultFixture = new DatabaseSync(databasePath);
  faultFixture.exec(
    "CREATE TRIGGER smoke_fail_notification BEFORE INSERT ON local_notifications BEGIN SELECT RAISE(ABORT, 'synthetic notification failure'); END;",
  );
  faultFixture.close();
  await start();
  const beforeDocuments = (
    await request<{ documents: PrivateDocument[] }>(
      `/properties/${property.id}/documents`,
      { client: owner },
    )
  ).payload.documents;
  failure(
    await patch(ownerAfterJoin, owner, {
      sharing: "shared",
      recipientAccountId: tenant.account.id,
    }),
    500,
  );
  assert.deepEqual(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${property.id}/documents`,
        { client: owner },
      )
    ).payload.documents,
    beforeDocuments,
  );
  failure(
    await request(`/properties/${property.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Atomic upload failure", {
        sharing: "shared",
        recipientAccountId: tenant.account.id,
      }),
    }),
    500,
  );
  assert.deepEqual(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${property.id}/documents`,
        { client: owner },
      )
    ).payload.documents,
    beforeDocuments,
  );
  const beforeRepairs = (
    await request<{ requests: unknown[] }>(
      `/properties/${property.id}/maintenance`,
      { client: owner },
    )
  ).payload.requests;
  failure(
    await request(`/maintenance/${repair.id}`, {
      method: "PATCH",
      client: owner,
      body: {
        version: 2,
        status: "resolved",
        message: "Atomic change failure",
      },
    }),
    500,
  );
  assert.deepEqual(
    (
      await request<{ requests: unknown[] }>(
        `/properties/${property.id}/maintenance`,
        { client: owner },
      )
    ).payload.requests,
    beforeRepairs,
  );
  assert.equal((await notifications(tenant)).unreadCount, 0);
  await stop();
  const clearFault = new DatabaseSync(databasePath);
  clearFault.exec("DROP TRIGGER smoke_fail_notification");
  clearFault.close();
  await start();
  passed(
    "a failed notification insert rolls back document uploads, sharing/version changes and maintenance history atomically",
  );

  const cappedProperty = (
    await request<{ property: { id: string } }>(
      `/workspaces/${workspace.id}/properties`,
      {
        method: "POST",
        client: owner,
        body: {
          name: "Capacity fixture",
          address: "Local synthetic capacity address",
        },
      },
    )
  ).payload.property;
  const cappedDocuments: PrivateDocument[] = [];
  for (let index = 0; index < 25; index += 1)
    cappedDocuments.push(
      await upload(
        cappedProperty.id,
        owner,
        fileBody(`Capacity document ${index + 1}`),
      ),
    );
  failure(
    await request(`/properties/${cappedProperty.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Twenty-sixth document"),
    }),
    409,
    "LIMIT_REACHED",
  );
  assert.equal(
    (await patch(cappedDocuments[0], owner, { archived: true })).response
      .status,
    200,
  );
  failure(
    await request(`/properties/${cappedProperty.id}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Archive does not bypass storage cap"),
    }),
    409,
    "LIMIT_REACHED",
  );
  assert.equal(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${cappedProperty.id}/documents`,
        { client: owner },
      )
    ).payload.documents.length,
    25,
  );
  failure(
    await request(`/properties/${cappedProperty.id}/documents`, {
      client: tenant,
    }),
    404,
    "NOT_FOUND",
  );
  failure(
    await request(`/properties/${cappedProperty.id}/documents`, {
      method: "POST",
      client: tenant,
      body: fileBody("Unassigned property"),
    }),
    404,
    "NOT_FOUND",
  );
  passed(
    "the per-property document cap includes archived files and unassigned tenants cannot list or upload files",
  );

  await stop();
  await start();
  const capacityProperties: string[] = [];
  for (let index = 0; index < 7; index += 1)
    capacityProperties.push(
      (
        await request<{ property: { id: string } }>(
          `/workspaces/${workspace.id}/properties`,
          {
            method: "POST",
            client: owner,
            body: {
              name: `Byte capacity fixture ${index + 1}`,
              address: "Local synthetic capacity address",
            },
          },
        )
      ).payload.property.id,
    );
  await stop();
  copyFileSync(databasePath, capacityPath, constants.COPYFILE_EXCL);
  const byteFixture = new DatabaseSync(capacityPath);
  const addBlob = byteFixture.prepare(
    "INSERT INTO local_documents(id,property_id,uploaded_by,uploaded_by_name,title,filename,mime_type,byte_size,content,sharing,recipient_account_id,version,archived,created_at,updated_at) SELECT ?,?,uploaded_by,uploaded_by_name,title,filename,mime_type,byte_size,content,'private',NULL,1,0,created_at,updated_at FROM local_documents WHERE id=?",
  );
  byteFixture.exec("BEGIN");
  for (let index = 0; index < 128; index += 1)
    addBlob.run(
      randomUUID(),
      capacityProperties[Math.floor(index / 25)],
      boundaryDocument.id,
    );
  byteFixture.exec("COMMIT");
  assert.ok(
    Number(
      byteFixture
        .prepare("SELECT sum(byte_size) AS total FROM local_documents")
        .get()?.total,
    ) >=
      128 * 1024 * 1024,
  );
  byteFixture.close();
  await start(capacityPath);
  failure(
    await request(`/properties/${capacityProperties[6]}/documents`, {
      method: "POST",
      client: owner,
      body: fileBody("Global storage cap"),
    }),
    409,
    "LIMIT_REACHED",
  );
  assert.equal(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${capacityProperties[6]}/documents`,
        { client: owner },
      )
    ).payload.documents.length,
    0,
  );
  await stop();
  await start();
  passed(
    "the global 128 MiB byte cap rejects new files atomically even when the destination property is empty",
  );

  await stop();
  copyFileSync(databasePath, migrationPath, constants.COPYFILE_EXCL);
  const old = new DatabaseSync(migrationPath);
  old.exec(
    "DROP TABLE local_viewing_mutations; DROP TABLE local_viewing_history; DROP TABLE local_viewings; DROP TABLE local_market_mutations; DROP TABLE local_market_messages; DROP TABLE local_market_participants; DROP TABLE local_market_conversations; DROP TABLE local_market_listings; DROP TABLE local_rent_mutations; DROP TABLE local_rent_history; DROP TABLE local_rent_records; DROP INDEX local_tenant_membership; ALTER TABLE local_property_tenants DROP COLUMN membership_id; DROP TABLE local_notifications; DROP TABLE local_documents; PRAGMA user_version=2;",
  );
  old.close();
  await start(migrationPath);
  assert.equal(
    (await request<AccountPayload>("/session", { client: owner })).payload
      .account?.id,
    owner.account.id,
  );
  assert.equal(
    (
      await request<{ workspaces: { id: string }[] }>("/workspaces", {
        client: owner,
      })
    ).payload.workspaces[0]?.id,
    workspace.id,
  );
  assert.ok(
    (
      await request<{ requests: { id: string }[] }>(
        `/properties/${property.id}/maintenance`,
        { client: tenant },
      )
    ).payload.requests.some((item) => item.id === repair.id),
  );
  assert.equal((await notifications(owner)).notifications.length, 0);
  assert.equal(
    (
      await request<{ documents: PrivateDocument[] }>(
        `/properties/${property.id}/documents`,
        { client: owner },
      )
    ).payload.documents.length,
    0,
  );
  await stop();
  const migrated = new DatabaseSync(migrationPath);
  assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 7);
  migrated.close();
  await start();
  assert.deepEqual((await content(ownerAfterJoin, owner)).bytes, pdf);
  assert.ok(
    (await notifications(owner)).notifications.find(
      (item) => item.id === createdAlert.id,
    )?.readAt,
  );
  passed(
    "binary files and read states survive restart; version-two migration preserves existing accounts, sessions, properties and maintenance",
  );

  // The whole suite above ran with a configured key and round-tripped content
  // transparently; confirm the bytes are actually encrypted at rest.
  await stop();
  const atRest = new DatabaseSync(databasePath);
  const storedRows = atRest
    .prepare(
      "SELECT content, content_iv, content_tag, byte_size FROM local_documents",
    )
    .all() as {
    content: Uint8Array;
    content_iv: Uint8Array | null;
    content_tag: Uint8Array | null;
    byte_size: number;
  }[];
  atRest.close();
  assert.ok(storedRows.length > 0, "at least one document is stored at rest");
  for (const row of storedRows) {
    assert.ok(
      row.content_iv && row.content_iv.length === 12,
      "each stored document carries a 12-byte GCM IV",
    );
    assert.ok(
      row.content_tag && row.content_tag.length === 16,
      "each stored document carries a 16-byte GCM auth tag",
    );
    assert.equal(
      row.content.length,
      row.byte_size,
      "GCM ciphertext preserves the recorded byte size",
    );
    assert.notDeepEqual(
      Buffer.from(row.content),
      pdf,
      "document bytes are not stored in the clear",
    );
  }
  await start();
  passed(
    "private documents are encrypted at rest with AES-256-GCM while downloads stay transparent",
  );
  console.log(
    `Private documents and notifications checks passed (${checks} groups).`,
  );
} finally {
  await stop();
  const allowed = new Set(
    ["documents", "migration", "capacity"].flatMap((name) =>
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
  const folder = lstatSync(directory);
  assert.ok(folder.isDirectory() && !folder.isSymbolicLink());
  rmdirSync(directory);
}
