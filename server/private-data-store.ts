import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { WorkspaceError } from "./workspace-store.ts";

// AES-256-GCM at-rest encryption for private document contents.
// GCM ciphertext is the same length as the plaintext, so byte_size and the
// `length(content) = byte_size` constraint stay valid; the 12-byte IV and
// 16-byte auth tag live in dedicated columns. A document is encrypted only
// when a key is configured; legacy rows (iv/tag NULL) are read as cleartext.
const GCM_IV_BYTES = 12;

function encryptContent(content: Buffer, key: Buffer) {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

function decryptContent(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
) {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export type DocumentSharing = "private" | "shared";
export type NotificationKind =
  | "maintenance_created"
  | "maintenance_updated"
  | "document_shared"
  | "rent_created"
  | "rent_terms_updated"
  | "rent_transfer_reported"
  | "rent_correction_requested"
  | "rent_confirmed"
  | "rent_voided";
export interface PrivateDocument {
  id: string;
  propertyId: string;
  title: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sharing: DocumentSharing;
  recipientAccountId: string | null;
  uploadedBy: string;
  uploadedByName: string;
  version: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface PrivateNotification {
  id: string;
  kind: NotificationKind;
  propertyId: string;
  resourceId: string;
  actorName: string;
  createdAt: string;
  readAt: string | null;
}
interface DocumentRow {
  id: string;
  property_id: string;
  title: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sharing: DocumentSharing;
  recipient_account_id: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  version: number;
  archived: number;
  created_at: number;
  updated_at: number;
}
interface NotificationRow {
  id: string;
  kind: NotificationKind;
  property_id: string;
  resource_id: string;
  actor_name: string;
  created_at: number;
  read_at: number | null;
}

const documentColumns =
  "d.id,d.property_id,d.title,d.filename,d.mime_type,d.byte_size,d.sharing,d.recipient_account_id,d.uploaded_by,d.uploaded_by_name,d.version,d.archived,d.created_at,d.updated_at";
const MAX_FILE_BYTES = 1024 * 1024;

function missing(): never {
  throw new WorkspaceError(404, "NOT_FOUND", "This record is unavailable.");
}
function invalidFile(): never {
  throw new WorkspaceError(
    422,
    "INVALID_FILE",
    "Choose a valid PDF, JPEG or PNG file of up to 1 MiB with a matching filename.",
  );
}
function documentView(row: DocumentRow): PrivateDocument {
  return {
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    filename: row.filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    sharing: row.sharing,
    recipientAccountId: row.recipient_account_id,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    version: row.version,
    archived: row.archived === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
function notificationView(row: NotificationRow): PrivateNotification {
  return {
    id: row.id,
    kind: row.kind,
    propertyId: row.property_id,
    resourceId: row.resource_id,
    actorName: row.actor_name,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at === null ? null : new Date(row.read_at).toISOString(),
  };
}

export function validatePrivateFile(input: {
  filename: string;
  mimeType: string;
  contentBase64: string;
}) {
  const normalized = input.filename.normalize("NFKC");
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const point = character.codePointAt(0)!;
    return point < 32 || (point >= 127 && point <= 159);
  });
  if (
    !normalized.trim() ||
    normalized.length > 255 ||
    hasControlCharacter ||
    /[:/\\\u202a-\u202e\u2066-\u2069]/u.test(normalized) ||
    input.contentBase64.length > 4 * Math.ceil(MAX_FILE_BYTES / 3) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      input.contentBase64,
    )
  )
    invalidFile();
  const content = Buffer.from(input.contentBase64, "base64");
  if (
    content.length === 0 ||
    content.length > MAX_FILE_BYTES ||
    content.toString("base64") !== input.contentBase64
  )
    invalidFile();
  const filename = normalized
    .replace(/[^\p{L}\p{M}\p{N} ._()-]/gu, "_")
    .trim()
    .replace(/^\.+/, "");
  if (!filename) invalidFile();
  const signatures = {
    "application/pdf": { extension: /\.pdf$/i, bytes: Buffer.from("%PDF-") },
    "image/png": {
      extension: /\.png$/i,
      bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    },
    "image/jpeg": {
      extension: /\.jpe?g$/i,
      bytes: Buffer.from([255, 216, 255]),
    },
  };
  const signature = Object.hasOwn(signatures, input.mimeType)
    ? signatures[input.mimeType as keyof typeof signatures]
    : undefined;
  if (
    !signature ||
    !signature.extension.test(filename) ||
    !content.subarray(0, signature.bytes.length).equals(signature.bytes)
  )
    invalidFile();
  return { content, filename, byteSize: content.length };
}

export function migratePrivateDataStore(database: DatabaseSync) {
  database.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE local_documents (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES local_properties(id),
      uploaded_by TEXT NOT NULL REFERENCES accounts(id),
      uploaded_by_name TEXT NOT NULL,
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 140),
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
      byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 1048576),
      content BLOB NOT NULL CHECK(length(content) = byte_size),
      sharing TEXT NOT NULL CHECK(sharing IN ('private','shared')),
      recipient_account_id TEXT REFERENCES accounts(id),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK((sharing = 'private' AND recipient_account_id IS NULL) OR (sharing = 'shared' AND recipient_account_id IS NOT NULL))
    ) STRICT;
    CREATE INDEX local_document_property ON local_documents(property_id);
    CREATE INDEX local_document_uploader ON local_documents(uploaded_by);
    CREATE TABLE local_notifications (
      id TEXT PRIMARY KEY,
      recipient_account_id TEXT NOT NULL REFERENCES accounts(id),
      kind TEXT NOT NULL CHECK(kind IN ('maintenance_created','maintenance_updated','document_shared')),
      property_id TEXT NOT NULL REFERENCES local_properties(id),
      resource_id TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES accounts(id),
      actor_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      read_at INTEGER,
      revoked_at INTEGER
    ) STRICT;
    CREATE INDEX local_notification_recipient ON local_notifications(recipient_account_id,revoked_at,created_at,id);
    CREATE INDEX local_notification_resource ON local_notifications(resource_id,kind);
    PRAGMA user_version=3;
    COMMIT;
  `);
}

// Adds at-rest encryption columns for private document contents. Additive and
// backward compatible: existing rows keep NULL iv/tag and are read as cleartext
// until re-uploaded. GCM preserves length, so the content/byte_size constraint
// is unaffected.
export function migrateDocumentEncryption(database: DatabaseSync) {
  // Idempotent: add each column only when absent so the step is safe to re-run
  // against a database that already carries the encryption columns.
  const existing = new Set(
    (
      database.prepare("PRAGMA table_info(local_documents)").all() as {
        name: string;
      }[]
    ).map((column) => column.name),
  );
  const additions = [
    ["content_iv", "ALTER TABLE local_documents ADD COLUMN content_iv BLOB;"],
    ["content_tag", "ALTER TABLE local_documents ADD COLUMN content_tag BLOB;"],
  ]
    .filter(([name]) => !existing.has(name))
    .map(([, statement]) => statement)
    .join("\n");
  database.exec(`
    BEGIN IMMEDIATE;
    ${additions}
    PRAGMA user_version=7;
    COMMIT;
  `);
}

export function createPrivateDataStore(
  database: DatabaseSync,
  documentKey: Buffer | null = null,
) {
  function transaction<T>(operation: () => T): T {
    database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  function propertyOwner(propertyId: string): string {
    const row = database
      .prepare(
        "SELECT w.owner_account_id FROM local_properties p JOIN local_workspaces w ON w.id=p.workspace_id WHERE p.id=?",
      )
      .get(propertyId) as { owner_account_id: string } | undefined;
    if (!row) missing();
    return row.owner_account_id;
  }
  function hasAccess(
    accountId: string,
    propertyId: string,
    ownerId = propertyOwner(propertyId),
  ) {
    return (
      ownerId === accountId ||
      Boolean(
        database
          .prepare(
            "SELECT 1 FROM local_property_tenants WHERE property_id=? AND account_id=?",
          )
          .get(propertyId, accountId),
      )
    );
  }
  function accessibleProperty(accountId: string, propertyId: string): string {
    const ownerId = propertyOwner(propertyId);
    if (!hasAccess(accountId, propertyId, ownerId)) missing();
    return ownerId;
  }
  function actorName(accountId: string): string {
    const actor = database
      .prepare("SELECT display_name FROM accounts WHERE id=?")
      .get(accountId) as { display_name: string } | undefined;
    if (!actor) missing();
    return actor.display_name;
  }
  function sharingRecipient(
    accountId: string,
    propertyId: string,
    sharing: DocumentSharing,
    requestedRecipient?: string,
  ): string | null {
    const ownerId = accessibleProperty(accountId, propertyId);
    if (sharing === "private") {
      if (requestedRecipient !== undefined)
        throw new WorkspaceError(
          422,
          "INVALID_RECIPIENT",
          "A private document has no recipient.",
        );
      return null;
    }
    const recipient = accountId === ownerId ? requestedRecipient : ownerId;
    if (
      !recipient ||
      recipient === accountId ||
      (accountId !== ownerId &&
        requestedRecipient !== undefined &&
        requestedRecipient !== ownerId) ||
      !hasAccess(recipient, propertyId, ownerId)
    ) {
      throw new WorkspaceError(
        422,
        "INVALID_RECIPIENT",
        "Choose an active recipient connected to this property.",
      );
    }
    return recipient;
  }
  function canRead(row: DocumentRow, accountId: string) {
    const ownerId = propertyOwner(row.property_id);
    return (
      hasAccess(accountId, row.property_id, ownerId) &&
      (row.uploaded_by === accountId ||
        (row.sharing === "shared" &&
          row.recipient_account_id === accountId &&
          row.archived === 0 &&
          hasAccess(row.uploaded_by, row.property_id, ownerId)))
    );
  }
  function readableDocument(
    accountId: string,
    documentId: string,
  ): DocumentRow {
    const row = database
      .prepare(`SELECT ${documentColumns} FROM local_documents d WHERE d.id=?`)
      .get(documentId) as DocumentRow | undefined;
    if (!row || !canRead(row, accountId)) missing();
    return row;
  }
  function revokeDocumentNotifications(documentId: string) {
    database
      .prepare(
        "UPDATE local_notifications SET revoked_at=coalesce(revoked_at,?) WHERE resource_id=? AND kind='document_shared'",
      )
      .run(Date.now(), documentId);
  }
  function notify(
    recipientId: string,
    kind: NotificationKind,
    propertyId: string,
    resourceId: string,
    actorId: string,
  ) {
    if (recipientId === actorId || !hasAccess(recipientId, propertyId)) return;
    database
      .prepare(
        "INSERT INTO local_notifications(id,recipient_account_id,kind,property_id,resource_id,actor_id,actor_name,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        recipientId,
        kind,
        propertyId,
        resourceId,
        actorId,
        actorName(actorId),
        Date.now(),
      );
  }
  const visibleNotifications = `FROM local_notifications n
    JOIN local_properties p ON p.id=n.property_id JOIN local_workspaces w ON w.id=p.workspace_id
    WHERE n.recipient_account_id=? AND n.revoked_at IS NULL
      AND (w.owner_account_id=? OR EXISTS(SELECT 1 FROM local_property_tenants t WHERE t.property_id=n.property_id AND t.account_id=?))
      AND ((n.kind IN ('maintenance_created','maintenance_updated') AND EXISTS(
        SELECT 1 FROM local_maintenance_requests r WHERE r.id=n.resource_id AND r.property_id=n.property_id
          AND (w.owner_account_id=? OR r.created_by=?)
      )) OR (n.kind='document_shared' AND EXISTS(
        SELECT 1 FROM local_documents d WHERE d.id=n.resource_id AND d.property_id=n.property_id
          AND d.sharing='shared' AND d.archived=0 AND d.recipient_account_id=?
          AND (d.uploaded_by=w.owner_account_id OR EXISTS(SELECT 1 FROM local_property_tenants t WHERE t.property_id=d.property_id AND t.account_id=d.uploaded_by))
      )) OR (n.kind IN ('rent_created','rent_terms_updated','rent_transfer_reported','rent_correction_requested','rent_confirmed','rent_voided') AND EXISTS(
        SELECT 1 FROM local_rent_records r WHERE r.id=n.resource_id AND r.property_id=n.property_id
          AND (w.owner_account_id=? OR (r.tenant_account_id=? AND r.tenant_revoked_at IS NULL AND EXISTS(
            SELECT 1 FROM local_property_tenants t WHERE t.property_id=r.property_id AND t.account_id=r.tenant_account_id AND t.membership_id=r.membership_id
          )))
      )))`;
  function notificationBindings(accountId: string) {
    return [
      accountId,
      accountId,
      accountId,
      accountId,
      accountId,
      accountId,
      accountId,
      accountId,
    ];
  }

  return {
    listDocuments(accountId: string, propertyId: string): PrivateDocument[] {
      accessibleProperty(accountId, propertyId);
      const rows = database
        .prepare(
          `SELECT ${documentColumns} FROM local_documents d WHERE d.property_id=? ORDER BY d.created_at DESC,d.id DESC`,
        )
        .all(propertyId) as unknown as DocumentRow[];
      return rows.filter((row) => canRead(row, accountId)).map(documentView);
    },
    uploadDocument(
      accountId: string,
      propertyId: string,
      input: {
        title: string;
        filename: string;
        mimeType: string;
        contentBase64: string;
        sharing: DocumentSharing;
        recipientAccountId?: string;
      },
    ) {
      // Membership is checked before decoding any content, and again in the write transaction.
      accessibleProperty(accountId, propertyId);
      const file = validatePrivateFile(input);
      return transaction(() => {
        const recipient = sharingRecipient(
          accountId,
          propertyId,
          input.sharing,
          input.recipientAccountId,
        );
        const propertyCount = database
          .prepare(
            "SELECT count(*) AS count FROM local_documents WHERE property_id=?",
          )
          .get(propertyId) as { count: number };
        const total = database
          .prepare(
            "SELECT coalesce(sum(byte_size),0) AS size FROM local_documents",
          )
          .get() as { size: number };
        if (
          propertyCount.count >= 25 ||
          total.size + file.byteSize > 128 * 1024 * 1024
        )
          throw new WorkspaceError(
            409,
            "LIMIT_REACHED",
            "The local private-document storage limit has been reached.",
          );
        const id = randomUUID();
        const now = Date.now();
        // Encrypt at rest when a key is configured; otherwise store cleartext.
        const stored = documentKey
          ? encryptContent(file.content, documentKey)
          : { ciphertext: file.content, iv: null, tag: null };
        database
          .prepare(
            "INSERT INTO local_documents(id,property_id,uploaded_by,uploaded_by_name,title,filename,mime_type,byte_size,content,content_iv,content_tag,sharing,recipient_account_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            propertyId,
            accountId,
            actorName(accountId),
            input.title,
            file.filename,
            input.mimeType,
            file.byteSize,
            stored.ciphertext,
            stored.iv,
            stored.tag,
            input.sharing,
            recipient,
            now,
            now,
          );
        if (recipient)
          notify(recipient, "document_shared", propertyId, id, accountId);
        return documentView(readableDocument(accountId, id));
      });
    },
    updateDocument(
      accountId: string,
      documentId: string,
      input: {
        title: string;
        sharing: DocumentSharing;
        recipientAccountId?: string;
        archived: boolean;
        version: number;
      },
    ) {
      return transaction(() => {
        const row = readableDocument(accountId, documentId);
        if (row.uploaded_by !== accountId) missing();
        if (row.version !== input.version)
          throw new WorkspaceError(
            409,
            "VERSION_CONFLICT",
            "This document changed elsewhere. Reload before saving.",
          );
        // Archiving revokes sharing. Restoring is deliberately private; sharing is a separate later edit.
        const forcePrivate = input.archived || row.archived === 1;
        const sharing = forcePrivate ? "private" : input.sharing;
        const recipient = sharingRecipient(
          accountId,
          row.property_id,
          sharing,
          forcePrivate ? undefined : input.recipientAccountId,
        );
        if (
          row.title === input.title &&
          row.sharing === sharing &&
          row.recipient_account_id === recipient &&
          row.archived === (input.archived ? 1 : 0)
        )
          return documentView(row);
        const wasShared = row.sharing === "shared" && row.archived === 0;
        const willShare = sharing === "shared" && !input.archived;
        const recipientChanged = row.recipient_account_id !== recipient;
        if (wasShared && (!willShare || recipientChanged))
          revokeDocumentNotifications(documentId);
        database
          .prepare(
            "UPDATE local_documents SET title=?,sharing=?,recipient_account_id=?,archived=?,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .run(
            input.title,
            sharing,
            recipient,
            input.archived ? 1 : 0,
            Date.now(),
            documentId,
            input.version,
          );
        if (willShare && recipient && (!wasShared || recipientChanged))
          notify(
            recipient,
            "document_shared",
            row.property_id,
            documentId,
            accountId,
          );
        return documentView(readableDocument(accountId, documentId));
      });
    },
    documentContent(accountId: string, documentId: string) {
      const row = readableDocument(accountId, documentId);
      const stored = database
        .prepare(
          "SELECT content,content_iv,content_tag FROM local_documents WHERE id=?",
        )
        .get(documentId) as {
        content: Uint8Array;
        content_iv: Uint8Array | null;
        content_tag: Uint8Array | null;
      };
      const ciphertext = Buffer.from(stored.content);
      // Encrypted rows carry an IV and auth tag; legacy rows are cleartext.
      const content =
        documentKey && stored.content_iv && stored.content_tag
          ? decryptContent(
              ciphertext,
              documentKey,
              Buffer.from(stored.content_iv),
              Buffer.from(stored.content_tag),
            )
          : ciphertext;
      return {
        document: documentView(row),
        content,
      };
    },
    notifyMaintenance(
      propertyId: string,
      requestId: string,
      createdBy: string,
      actorId: string,
      kind: "maintenance_created" | "maintenance_updated",
    ) {
      const ownerId = propertyOwner(propertyId);
      const recipient = actorId === ownerId ? createdBy : ownerId;
      notify(recipient, kind, propertyId, requestId, actorId);
    },
    notifyRent(
      propertyId: string,
      recordId: string,
      tenantId: string,
      actorId: string,
      kind: NotificationKind,
    ) {
      // The rent store invokes this inside the same transaction as its record and audit event.
      const ownerId = propertyOwner(propertyId);
      const recipient = actorId === ownerId ? tenantId : ownerId;
      if (
        recipient === tenantId &&
        !database
          .prepare(
            `SELECT 1 FROM local_rent_records r JOIN local_property_tenants t ON t.property_id=r.property_id AND t.account_id=r.tenant_account_id AND t.membership_id=r.membership_id WHERE r.id=? AND r.tenant_revoked_at IS NULL`,
          )
          .get(recordId)
      )
        return;
      notify(recipient, kind, propertyId, recordId, actorId);
    },
    revokePropertyPair(ownerId: string, propertyId: string, tenantId: string) {
      // Called within the tenant-removal transaction, before membership deletion.
      if (tenantId === ownerId) return;
      database
        .prepare(
          "UPDATE local_rent_records SET tenant_revoked_at=coalesce(tenant_revoked_at,?) WHERE property_id=? AND tenant_account_id=?",
        )
        .run(Date.now(), propertyId, tenantId);
      const rows = database
        .prepare(
          "SELECT id FROM local_documents WHERE property_id=? AND sharing='shared' AND ((uploaded_by=? AND recipient_account_id=?) OR (uploaded_by=? AND recipient_account_id=?))",
        )
        .all(propertyId, ownerId, tenantId, tenantId, ownerId) as {
        id: string;
      }[];
      for (const row of rows) revokeDocumentNotifications(row.id);
      database
        .prepare(
          "UPDATE local_documents SET sharing='private',recipient_account_id=NULL,version=version+1,updated_at=? WHERE property_id=? AND sharing='shared' AND ((uploaded_by=? AND recipient_account_id=?) OR (uploaded_by=? AND recipient_account_id=?))",
        )
        .run(Date.now(), propertyId, ownerId, tenantId, tenantId, ownerId);
      database
        .prepare(
          "UPDATE local_notifications SET revoked_at=coalesce(revoked_at,?) WHERE property_id=? AND recipient_account_id=?",
        )
        .run(Date.now(), propertyId, tenantId);
    },
    listNotifications(
      accountId: string,
      before?: { time: number; id: string },
    ) {
      const bindings = notificationBindings(accountId);
      const rows = database
        .prepare(
          `SELECT n.* ${visibleNotifications} ${before ? "AND (n.created_at < ? OR (n.created_at = ? AND n.id < ?))" : ""} ORDER BY n.created_at DESC,n.id DESC LIMIT 51`,
        )
        .all(
          ...bindings,
          ...(before ? [before.time, before.time, before.id] : []),
        ) as unknown as NotificationRow[];
      const count = database
        .prepare(
          `SELECT count(*) AS count ${visibleNotifications} AND n.read_at IS NULL`,
        )
        .get(...bindings) as { count: number };
      const notifications = rows.slice(0, 50);
      const last = notifications.at(-1);
      return {
        notifications: notifications.map(notificationView),
        unreadCount: count.count,
        nextCursor:
          rows.length > 50 && last ? `${last.created_at}:${last.id}` : null,
      };
    },
    readNotification(accountId: string, notificationId: string) {
      return transaction(() => {
        const row = database
          .prepare(`SELECT n.* ${visibleNotifications} AND n.id=?`)
          .get(...notificationBindings(accountId), notificationId) as
          NotificationRow | undefined;
        if (!row) missing();
        const readAt = row.read_at ?? Date.now();
        database
          .prepare(
            "UPDATE local_notifications SET read_at=coalesce(read_at,?) WHERE id=?",
          )
          .run(readAt, notificationId);
        return notificationView({ ...row, read_at: readAt });
      });
    },
    readAllNotifications(accountId: string) {
      return transaction(() => {
        const result = database
          .prepare(
            `UPDATE local_notifications SET read_at=? WHERE id IN (SELECT n.id ${visibleNotifications} AND n.read_at IS NULL)`,
          )
          .run(Date.now(), ...notificationBindings(accountId));
        return { updated: Number(result.changes) };
      });
    },
  };
}

export type PrivateDataStore = ReturnType<typeof createPrivateDataStore>;
