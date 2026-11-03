import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  PrivateDataStore,
  NotificationKind,
} from "./private-data-store.ts";
import { WorkspaceError } from "./workspace-store.ts";

export type RentStatus =
  | "awaiting_transfer"
  | "awaiting_confirmation"
  | "needs_correction"
  | "confirmed"
  | "voided";
export type RentHistoryKind =
  | "created"
  | "terms_updated"
  | "transfer_reported"
  | "correction_requested"
  | "confirmed"
  | "voided";
export interface RentTransfer {
  amountMinor: number;
  transferredOn: string;
  reference: string;
  note: string;
  evidenceDocumentId: string | null;
}
export interface RentSnapshot {
  amountDueMinor: number;
  dueOn: string;
  status: RentStatus;
  transfer: RentTransfer | null;
  correctionReason: string | null;
  voidReason: string | null;
  confirmedAt: string | null;
}
export interface RentSummary extends RentSnapshot {
  id: string;
  propertyId: string;
  tenantAccountId: string;
  tenantName: string;
  period: string;
  currency: "AOA";
  tenantAccessActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface RentHistory {
  id: string;
  actorId: string;
  actorName: string;
  kind: RentHistoryKind;
  version: number;
  before: RentSnapshot | null;
  after: RentSnapshot;
  createdAt: string;
}
export interface RentRecord extends RentSummary {
  history: RentHistory[];
}
interface RentRow {
  id: string;
  property_id: string;
  tenant_account_id: string;
  tenant_name: string;
  membership_id: string;
  period: string;
  currency: "AOA";
  amount_due_minor: number;
  due_on: string;
  status: RentStatus;
  transfer_json: string | null;
  correction_reason: string | null;
  void_reason: string | null;
  confirmed_at: number | null;
  tenant_revoked_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
  owner_account_id: string;
  tenant_active: number;
}

export function migrateRentStore(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(
      "ALTER TABLE local_property_tenants ADD COLUMN membership_id TEXT NOT NULL DEFAULT ''",
    );
    const memberships = database
      .prepare("SELECT property_id,account_id FROM local_property_tenants")
      .all() as { property_id: string; account_id: string }[];
    for (const membership of memberships)
      database
        .prepare(
          "UPDATE local_property_tenants SET membership_id=? WHERE property_id=? AND account_id=?",
        )
        .run(randomUUID(), membership.property_id, membership.account_id);
    database.exec(`
      CREATE UNIQUE INDEX local_tenant_membership ON local_property_tenants(membership_id);
      CREATE TABLE local_rent_records (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES local_properties(id),
        tenant_account_id TEXT NOT NULL REFERENCES accounts(id),
        tenant_name TEXT NOT NULL,
        membership_id TEXT NOT NULL,
        period TEXT NOT NULL,
        currency TEXT NOT NULL CHECK(currency='AOA'),
        amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor BETWEEN 1 AND 100000000000),
        due_on TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('awaiting_transfer','awaiting_confirmation','needs_correction','confirmed','voided')),
        transfer_json TEXT,
        correction_reason TEXT,
        void_reason TEXT,
        confirmed_at INTEGER,
        tenant_revoked_at INTEGER,
        version INTEGER NOT NULL CHECK(version>0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX local_rent_active_period ON local_rent_records(property_id,tenant_account_id,period) WHERE status!='voided';
      CREATE INDEX local_rent_property ON local_rent_records(property_id,created_at,id);
      CREATE TABLE local_rent_history (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES local_rent_records(id),
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        actor_name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('created','terms_updated','transfer_reported','correction_requested','confirmed','voided')),
        version INTEGER NOT NULL CHECK(version>0),
        before_json TEXT,
        after_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(record_id,version)
      ) STRICT;
      CREATE TABLE local_rent_mutations (
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        mutation_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        record_id TEXT NOT NULL REFERENCES local_rent_records(id),
        created_at INTEGER NOT NULL,
        PRIMARY KEY(actor_id,mutation_id)
      ) STRICT;
      CREATE TABLE local_notifications_v4 (
        id TEXT PRIMARY KEY,
        recipient_account_id TEXT NOT NULL REFERENCES accounts(id),
        kind TEXT NOT NULL CHECK(kind IN ('maintenance_created','maintenance_updated','document_shared','rent_created','rent_terms_updated','rent_transfer_reported','rent_correction_requested','rent_confirmed','rent_voided')),
        property_id TEXT NOT NULL REFERENCES local_properties(id),
        resource_id TEXT NOT NULL,
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        actor_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        revoked_at INTEGER
      ) STRICT;
      INSERT INTO local_notifications_v4 SELECT * FROM local_notifications;
      DROP TABLE local_notifications;
      ALTER TABLE local_notifications_v4 RENAME TO local_notifications;
      CREATE INDEX local_notification_recipient ON local_notifications(recipient_account_id,revoked_at,created_at,id);
      CREATE INDEX local_notification_resource ON local_notifications(resource_id,kind);
      PRAGMA user_version=4;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function fail(status: number, code: string, message: string): never {
  throw new WorkspaceError(status, code, message);
}
function missing(): never {
  return fail(404, "NOT_FOUND", "This rent record is unavailable.");
}
function iso(value: number | null) {
  return value === null ? null : new Date(value).toISOString();
}
function snapshot(row: RentRow): RentSnapshot {
  return {
    amountDueMinor: row.amount_due_minor,
    dueOn: row.due_on,
    status: row.status,
    transfer: row.transfer_json
      ? (JSON.parse(row.transfer_json) as RentTransfer)
      : null,
    correctionReason: row.correction_reason,
    voidReason: row.void_reason,
    confirmedAt: iso(row.confirmed_at),
  };
}
function summary(row: RentRow): RentSummary {
  return {
    ...snapshot(row),
    id: row.id,
    propertyId: row.property_id,
    tenantAccountId: row.tenant_account_id,
    tenantName: row.tenant_name,
    period: row.period,
    currency: row.currency,
    tenantAccessActive: row.tenant_active === 1,
    version: row.version,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
const rowSelect = `SELECT r.*,w.owner_account_id,
  CASE WHEN r.tenant_revoked_at IS NULL AND EXISTS(SELECT 1 FROM local_property_tenants t WHERE t.property_id=r.property_id AND t.account_id=r.tenant_account_id AND t.membership_id=r.membership_id) THEN 1 ELSE 0 END AS tenant_active
  FROM local_rent_records r JOIN local_properties p ON p.id=r.property_id JOIN local_workspaces w ON w.id=p.workspace_id`;

export function createRentStore(
  database: DatabaseSync,
  privateData: PrivateDataStore,
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
  function property(accountId: string, propertyId: string, ownerOnly = false) {
    const row = database
      .prepare(
        `SELECT w.owner_account_id FROM local_properties p JOIN local_workspaces w ON w.id=p.workspace_id WHERE p.id=?`,
      )
      .get(propertyId) as { owner_account_id: string } | undefined;
    if (!row) missing();
    if (
      row.owner_account_id !== accountId &&
      (ownerOnly ||
        !database
          .prepare(
            "SELECT 1 FROM local_property_tenants WHERE property_id=? AND account_id=?",
          )
          .get(propertyId, accountId))
    )
      missing();
    return row.owner_account_id;
  }
  function readable(accountId: string, id: string): RentRow {
    const row = database.prepare(`${rowSelect} WHERE r.id=?`).get(id) as
      RentRow | undefined;
    if (
      !row ||
      (row.owner_account_id !== accountId &&
        !(row.tenant_account_id === accountId && row.tenant_active === 1))
    )
      missing();
    return row;
  }
  function detail(row: RentRow): RentRecord {
    const history = database
      .prepare(
        "SELECT * FROM local_rent_history WHERE record_id=? ORDER BY version",
      )
      .all(row.id) as {
      id: string;
      actor_id: string;
      actor_name: string;
      kind: RentHistoryKind;
      version: number;
      before_json: string | null;
      after_json: string;
      created_at: number;
    }[];
    return {
      ...summary(row),
      history: history.map((event) => ({
        id: event.id,
        actorId: event.actor_id,
        actorName: event.actor_name,
        kind: event.kind,
        version: event.version,
        before: event.before_json
          ? (JSON.parse(event.before_json) as RentSnapshot)
          : null,
        after: JSON.parse(event.after_json) as RentSnapshot,
        createdAt: iso(event.created_at)!,
      })),
    };
  }
  function assertOwner(row: RentRow, actorId: string) {
    if (row.owner_account_id !== actorId)
      fail(
        403,
        "FORBIDDEN",
        "Only the property owner can perform this action.",
      );
  }
  function assertActive(row: RentRow) {
    if (row.tenant_active !== 1)
      fail(
        409,
        "INVALID_STATE",
        "Tenant access was removed. Only voiding an unconfirmed record remains available.",
      );
  }
  function assertVersion(row: RentRow, version: number) {
    if (row.version !== version)
      fail(
        409,
        "VERSION_CONFLICT",
        "This rent record changed elsewhere. Reload before saving.",
      );
  }
  function assertUnconfirmed(row: RentRow) {
    if (row.status === "confirmed" || row.status === "voided")
      fail(
        409,
        "INVALID_STATE",
        "Confirmed and voided rent records cannot be changed.",
      );
  }
  function fingerprint(operation: string, target: string, input: unknown) {
    return createHash("sha256")
      .update(JSON.stringify([operation, target, input]))
      .digest("hex");
  }
  function replay(actorId: string, mutationId: string, hash: string) {
    const previous = database
      .prepare(
        "SELECT fingerprint,record_id FROM local_rent_mutations WHERE actor_id=? AND mutation_id=?",
      )
      .get(actorId, mutationId) as
      { fingerprint: string; record_id: string } | undefined;
    if (!previous) return null;
    // Never let an idempotency receipt bypass current permissions, even after rejoining.
    const current = readable(actorId, previous.record_id);
    if (previous.fingerprint !== hash)
      fail(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This retry identifier was already used for a different request.",
      );
    return { record: detail(current), replayed: true };
  }
  function remember(
    actorId: string,
    mutationId: string,
    hash: string,
    recordId: string,
  ) {
    database
      .prepare(
        "INSERT INTO local_rent_mutations(actor_id,mutation_id,fingerprint,record_id,created_at) VALUES(?,?,?,?,?)",
      )
      .run(actorId, mutationId, hash, recordId, Date.now());
    return { record: detail(readable(actorId, recordId)), replayed: false };
  }
  function append(
    actorId: string,
    row: RentRow,
    before: RentSnapshot | null,
    kind: RentHistoryKind,
  ) {
    const count = database
      .prepare(
        "SELECT count(*) AS count FROM local_rent_history WHERE record_id=?",
      )
      .get(row.id) as { count: number };
    // Keep a final audit slot for confirmation or voiding, so a full local
    // history cannot trap an incorrect unconfirmed monthly record forever.
    const terminal = kind === "confirmed" || kind === "voided";
    if (count.count >= (terminal ? 100 : 99))
      fail(
        409,
        "LIMIT_REACHED",
        "This local rent record has reached its editable history limit. The final audit slot is reserved for confirmation or voiding.",
      );
    const actor = database
      .prepare("SELECT display_name FROM accounts WHERE id=?")
      .get(actorId) as { display_name: string };
    database
      .prepare(
        "INSERT INTO local_rent_history(id,record_id,actor_id,actor_name,kind,version,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        row.id,
        actorId,
        actor.display_name,
        kind,
        row.version,
        before ? JSON.stringify(before) : null,
        JSON.stringify(snapshot(row)),
        row.updated_at,
      );
    privateData.notifyRent(
      row.property_id,
      row.id,
      row.tenant_account_id,
      actorId,
      `rent_${kind}` as NotificationKind,
    );
  }
  function change(
    actorId: string,
    row: RentRow,
    next: RentSnapshot,
    kind: RentHistoryKind,
  ) {
    database
      .prepare(
        `UPDATE local_rent_records SET amount_due_minor=?,due_on=?,status=?,transfer_json=?,correction_reason=?,void_reason=?,confirmed_at=?,version=version+1,updated_at=? WHERE id=? AND version=?`,
      )
      .run(
        next.amountDueMinor,
        next.dueOn,
        next.status,
        next.transfer ? JSON.stringify(next.transfer) : null,
        next.correctionReason,
        next.voidReason,
        next.confirmedAt ? Date.parse(next.confirmedAt) : null,
        Date.now(),
        row.id,
        row.version,
      );
    append(actorId, readable(actorId, row.id), snapshot(row), kind);
  }
  function validateEvidence(row: RentRow, id: string | null) {
    if (id === null) return;
    if (
      !database
        .prepare(
          "SELECT 1 FROM local_documents WHERE id=? AND property_id=? AND uploaded_by=? AND archived=0 AND sharing='shared' AND recipient_account_id=?",
        )
        .get(id, row.property_id, row.tenant_account_id, row.owner_account_id)
    )
      fail(
        422,
        "INVALID_EVIDENCE",
        "Choose your active document already shared with this property owner, or omit the attachment.",
      );
  }
  return {
    list(
      accountId: string,
      propertyId: string,
      before?: { time: number; id: string },
    ) {
      const ownerId = property(accountId, propertyId);
      const rows = database
        .prepare(
          `${rowSelect} WHERE r.property_id=? ${accountId === ownerId ? "" : "AND r.tenant_account_id=? AND r.tenant_revoked_at IS NULL AND EXISTS(SELECT 1 FROM local_property_tenants t WHERE t.property_id=r.property_id AND t.account_id=r.tenant_account_id AND t.membership_id=r.membership_id)"} ${before ? "AND (r.created_at<? OR (r.created_at=? AND r.id<?))" : ""} ORDER BY r.created_at DESC,r.id DESC LIMIT 21`,
        )
        .all(
          propertyId,
          ...(accountId === ownerId ? [] : [accountId]),
          ...(before ? [before.time, before.time, before.id] : []),
        ) as unknown as RentRow[];
      const page = rows.slice(0, 20);
      const last = page.at(-1);
      return {
        records: page.map(summary),
        nextCursor:
          rows.length > 20 && last ? `${last.created_at}:${last.id}` : null,
      };
    },
    get(accountId: string, id: string) {
      return detail(readable(accountId, id));
    },
    create(
      actorId: string,
      propertyId: string,
      input: {
        mutationId: string;
        tenantAccountId: string;
        period: string;
        currency: "AOA";
        amountDueMinor: number;
        dueOn: string;
      },
    ) {
      return transaction(() => {
        property(actorId, propertyId, true);
        const hash = fingerprint("create", propertyId, input);
        const previous = replay(actorId, input.mutationId, hash);
        if (previous) return previous;
        const tenant = database
          .prepare(
            "SELECT t.membership_id,a.display_name FROM local_property_tenants t JOIN accounts a ON a.id=t.account_id WHERE t.property_id=? AND t.account_id=?",
          )
          .get(propertyId, input.tenantAccountId) as
          { membership_id: string; display_name: string } | undefined;
        if (!tenant || input.tenantAccountId === actorId)
          fail(
            422,
            "VALIDATION_ERROR",
            "Choose an active tenant assigned to this property.",
          );
        if (
          database
            .prepare(
              "SELECT 1 FROM local_rent_records WHERE property_id=? AND tenant_account_id=? AND period=? AND status!='voided'",
            )
            .get(propertyId, input.tenantAccountId, input.period)
        )
          fail(
            409,
            "DUPLICATE_PERIOD",
            "An active rent record already exists for this tenant and month. Void an incorrect unconfirmed record first.",
          );
        const id = randomUUID();
        const now = Date.now();
        database
          .prepare(
            "INSERT INTO local_rent_records(id,property_id,tenant_account_id,tenant_name,membership_id,period,currency,amount_due_minor,due_on,status,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'awaiting_transfer',1,?,?)",
          )
          .run(
            id,
            propertyId,
            input.tenantAccountId,
            tenant.display_name,
            tenant.membership_id,
            input.period,
            input.currency,
            input.amountDueMinor,
            input.dueOn,
            now,
            now,
          );
        append(actorId, readable(actorId, id), null, "created");
        return remember(actorId, input.mutationId, hash, id);
      });
    },
    update(
      actorId: string,
      id: string,
      input: {
        mutationId: string;
        version: number;
        amountDueMinor: number;
        dueOn: string;
      },
    ) {
      return transaction(() => {
        const row = readable(actorId, id);
        assertOwner(row, actorId);
        const hash = fingerprint("update", id, input);
        const previous = replay(actorId, input.mutationId, hash);
        if (previous) return previous;
        assertActive(row);
        assertVersion(row, input.version);
        assertUnconfirmed(row);
        if (row.transfer_json !== null)
          fail(
            409,
            "INVALID_STATE",
            "Expected rent terms cannot change after a transfer has been reported. Void an incorrect unconfirmed record instead.",
          );
        if (input.dueOn.slice(0, 7) !== row.period)
          fail(
            422,
            "VALIDATION_ERROR",
            "The due date must be within the rent month.",
          );
        if (
          row.amount_due_minor !== input.amountDueMinor ||
          row.due_on !== input.dueOn
        )
          change(
            actorId,
            row,
            {
              ...snapshot(row),
              amountDueMinor: input.amountDueMinor,
              dueOn: input.dueOn,
            },
            "terms_updated",
          );
        return remember(actorId, input.mutationId, hash, id);
      });
    },
    transfer(
      actorId: string,
      id: string,
      input: RentTransfer & { mutationId: string; version: number },
    ) {
      return transaction(() => {
        const row = readable(actorId, id);
        if (row.tenant_account_id !== actorId)
          fail(
            403,
            "FORBIDDEN",
            "Only the assigned tenant can report their direct transfer.",
          );
        const hash = fingerprint("transfer", id, input);
        const previous = replay(actorId, input.mutationId, hash);
        if (previous) return previous;
        assertActive(row);
        assertVersion(row, input.version);
        assertUnconfirmed(row);
        validateEvidence(row, input.evidenceDocumentId);
        const transfer: RentTransfer = {
          amountMinor: input.amountMinor,
          transferredOn: input.transferredOn,
          reference: input.reference,
          note: input.note,
          evidenceDocumentId: input.evidenceDocumentId,
        };
        const next = {
          ...snapshot(row),
          transfer,
          status: "awaiting_confirmation" as const,
          correctionReason: null,
        };
        if (JSON.stringify(snapshot(row)) !== JSON.stringify(next))
          change(actorId, row, next, "transfer_reported");
        return remember(actorId, input.mutationId, hash, id);
      });
    },
    review(
      actorId: string,
      id: string,
      input: {
        mutationId: string;
        version: number;
        decision: "confirm" | "request_correction";
        reason?: string;
      },
    ) {
      return transaction(() => {
        const row = readable(actorId, id);
        assertOwner(row, actorId);
        const hash = fingerprint("review", id, input);
        const previous = replay(actorId, input.mutationId, hash);
        if (previous) return previous;
        assertActive(row);
        assertVersion(row, input.version);
        const current = snapshot(row);
        if (row.status !== "awaiting_confirmation" || !current.transfer)
          fail(
            409,
            "INVALID_STATE",
            "A tenant transfer report must be awaiting owner confirmation.",
          );
        if (input.decision === "confirm") {
          if (current.transfer.amountMinor !== row.amount_due_minor)
            fail(
              409,
              "AMOUNT_MISMATCH",
              "The reported amount must exactly match the expected rent before owner confirmation.",
            );
          change(
            actorId,
            row,
            {
              ...current,
              status: "confirmed",
              correctionReason: null,
              confirmedAt: new Date().toISOString(),
            },
            "confirmed",
          );
        } else
          change(
            actorId,
            row,
            {
              ...current,
              status: "needs_correction",
              correctionReason: input.reason!,
            },
            "correction_requested",
          );
        return remember(actorId, input.mutationId, hash, id);
      });
    },
    void(
      actorId: string,
      id: string,
      input: { mutationId: string; version: number; reason: string },
    ) {
      return transaction(() => {
        const row = readable(actorId, id);
        assertOwner(row, actorId);
        const hash = fingerprint("void", id, input);
        const previous = replay(actorId, input.mutationId, hash);
        if (previous) return previous;
        assertVersion(row, input.version);
        assertUnconfirmed(row);
        change(
          actorId,
          row,
          { ...snapshot(row), status: "voided", voidReason: input.reason },
          "voided",
        );
        return remember(actorId, input.mutationId, hash, id);
      });
    },
  };
}
export type RentStore = ReturnType<typeof createRentStore>;
