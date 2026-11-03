import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PrivateDataStore } from "./private-data-store.ts";

export type WorkspaceRole = "owner" | "tenant";
export type MaintenanceStatus = "open" | "in_progress" | "resolved";
export type MaintenancePriority = "normal" | "urgent";

export interface WorkspaceProperty {
  id: string;
  workspaceId: string;
  name: string;
  address: string;
  version: number;
  tenantCount: number;
}

export interface PropertyWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  version: number;
  properties: WorkspaceProperty[];
}

export interface MaintenanceHistoryEntry {
  id: string;
  actorId: string;
  actorName: string;
  kind: "created" | "status_changed" | "comment";
  message: string;
  status: MaintenanceStatus;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  history: MaintenanceHistoryEntry[];
}

interface WorkspaceRow {
  id: string;
  name: string;
  version: number;
  owner_account_id: string;
}

interface PropertyRow {
  id: string;
  workspace_id: string;
  name: string;
  address: string;
  version: number;
  owner_account_id: string;
  tenant_count: number;
}

interface InvitationRow {
  id: string;
  property_id: string;
  account_id: string;
  expires_at: number;
  accepted_at: number | null;
  revoked_at: number | null;
}

interface MaintenanceRow {
  id: string;
  property_id: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  version: number;
  created_at: number;
  updated_at: number;
  created_by: string;
}

interface HistoryRow {
  id: string;
  actor_id: string;
  actor_name: string;
  kind: MaintenanceHistoryEntry["kind"];
  message: string;
  status: MaintenanceStatus;
  created_at: number;
}

export class WorkspaceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function unavailable(): never {
  throw new WorkspaceError(404, "NOT_FOUND", "This record is unavailable.");
}

function capacityReached(): never {
  throw new WorkspaceError(
    409,
    "LIMIT_REACHED",
    "This local workspace has reached its current record limit.",
  );
}

function inviteUnavailable(): never {
  throw new WorkspaceError(
    404,
    "INVITATION_UNAVAILABLE",
    "This invitation is unavailable or has expired.",
  );
}

function toProperty(row: PropertyRow): WorkspaceProperty {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    address: row.address,
    version: row.version,
    tenantCount: row.tenant_count,
  };
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Migration runs on the same guarded connection as the existing account store. */
export function migrateWorkspaceStore(database: DatabaseSync) {
  database.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE local_workspaces (
      id TEXT PRIMARY KEY,
      owner_account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX local_workspace_owner ON local_workspaces(owner_account_id);
    CREATE TABLE local_properties (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES local_workspaces(id),
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
      address TEXT NOT NULL CHECK(length(address) BETWEEN 1 AND 300),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX local_property_workspace ON local_properties(workspace_id);
    CREATE TABLE local_property_tenants (
      property_id TEXT NOT NULL REFERENCES local_properties(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(property_id,account_id)
    ) STRICT;
    CREATE INDEX local_tenant_account ON local_property_tenants(account_id);
    CREATE TABLE local_property_invitations (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES local_properties(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      code_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      accepted_at INTEGER,
      revoked_at INTEGER
    ) STRICT;
    CREATE INDEX local_invitation_property ON local_property_invitations(property_id);
    CREATE TABLE local_maintenance_requests (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES local_properties(id),
      created_by TEXT NOT NULL REFERENCES accounts(id),
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 140),
      description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 4000),
      priority TEXT NOT NULL CHECK(priority IN ('normal','urgent')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX local_maintenance_property ON local_maintenance_requests(property_id);
    CREATE INDEX local_maintenance_author ON local_maintenance_requests(created_by);
    CREATE TABLE local_maintenance_history (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES local_maintenance_requests(id),
      actor_id TEXT NOT NULL REFERENCES accounts(id),
      actor_name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('created','status_changed','comment')),
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','in_progress','resolved')),
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(request_id,sequence)
    ) STRICT;
    PRAGMA user_version=2;
    COMMIT;
  `);
}

/** Private property operations only: these records never enter the public demo catalogues. */
export function createWorkspaceStore(
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

  function count(sql: string, id: string) {
    return (database.prepare(sql).get(id) as { count: number }).count;
  }

  function ownerWorkspace(
    accountId: string,
    workspaceId: string,
  ): WorkspaceRow {
    const row = database
      .prepare(
        "SELECT * FROM local_workspaces WHERE id = ? AND owner_account_id = ?",
      )
      .get(workspaceId, accountId) as WorkspaceRow | undefined;
    if (!row) unavailable();
    return row;
  }

  function accessibleProperty(
    accountId: string,
    propertyId: string,
    ownerOnly = false,
  ): PropertyRow {
    const row = database
      .prepare(
        `SELECT p.*, w.owner_account_id,
        (SELECT count(*) FROM local_property_tenants t WHERE t.property_id = p.id) AS tenant_count
        FROM local_properties p JOIN local_workspaces w ON w.id = p.workspace_id
        WHERE p.id = ? AND (w.owner_account_id = ? OR (? = 0 AND EXISTS (
          SELECT 1 FROM local_property_tenants t WHERE t.property_id = p.id AND t.account_id = ?
        )))`,
      )
      .get(propertyId, accountId, ownerOnly ? 1 : 0, accountId) as
      PropertyRow | undefined;
    if (!row) unavailable();
    return row;
  }

  function historyFor(requestId: string): MaintenanceHistoryEntry[] {
    const rows = database
      .prepare(
        "SELECT * FROM local_maintenance_history WHERE request_id = ? ORDER BY sequence",
      )
      .all(requestId) as unknown as HistoryRow[];
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      kind: row.kind,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  function toRequest(row: MaintenanceRow): MaintenanceRequest {
    return {
      id: row.id,
      propertyId: row.property_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      createdBy: row.created_by,
      history: historyFor(row.id),
    };
  }

  function addHistory(
    requestId: string,
    actorId: string,
    kind: MaintenanceHistoryEntry["kind"],
    message: string,
    status: MaintenanceStatus,
    now: number,
  ) {
    const actor = database
      .prepare("SELECT display_name FROM accounts WHERE id = ?")
      .get(actorId) as { display_name: string } | undefined;
    if (!actor) unavailable();
    database
      .prepare(
        `INSERT INTO local_maintenance_history(
        id,request_id,actor_id,actor_name,kind,message,status,sequence,created_at
      ) VALUES(?,?,?,?,?,?,?,(SELECT coalesce(max(sequence),0)+1 FROM local_maintenance_history WHERE request_id = ?),?)`,
      )
      .run(
        randomUUID(),
        requestId,
        actorId,
        actor.display_name,
        kind,
        message,
        status,
        requestId,
        now,
      );
  }

  function invitationStatus(
    invitation: InvitationRow,
  ): "pending" | "accepted" | "revoked" | "expired" {
    if (invitation.revoked_at !== null) return "revoked";
    if (invitation.accepted_at !== null) return "accepted";
    return invitation.expires_at <= Date.now() ? "expired" : "pending";
  }

  return {
    listWorkspaces(accountId: string): PropertyWorkspace[] {
      const rows = database
        .prepare(
          `SELECT DISTINCT w.* FROM local_workspaces w
          WHERE w.owner_account_id = ? OR EXISTS (
            SELECT 1 FROM local_properties p JOIN local_property_tenants t ON t.property_id = p.id
            WHERE p.workspace_id = w.id AND t.account_id = ?
          ) ORDER BY w.created_at,w.id`,
        )
        .all(accountId, accountId) as unknown as WorkspaceRow[];
      return rows.map((workspace) => {
        const owner = workspace.owner_account_id === accountId;
        const properties = database
          .prepare(
            `SELECT p.*, w.owner_account_id,
            (SELECT count(*) FROM local_property_tenants t WHERE t.property_id = p.id) AS tenant_count
            FROM local_properties p JOIN local_workspaces w ON w.id = p.workspace_id
            WHERE p.workspace_id = ? AND (? = 1 OR EXISTS (
              SELECT 1 FROM local_property_tenants t WHERE t.property_id = p.id AND t.account_id = ?
            )) ORDER BY p.created_at,p.id`,
          )
          .all(
            workspace.id,
            owner ? 1 : 0,
            accountId,
          ) as unknown as PropertyRow[];
        return {
          id: workspace.id,
          name: workspace.name,
          version: workspace.version,
          role: owner ? "owner" : "tenant",
          properties: properties.map(toProperty),
        };
      });
    },
    createWorkspace(accountId: string, name: string): PropertyWorkspace {
      return transaction(() => {
        if (
          count(
            "SELECT count(*) AS count FROM local_workspaces WHERE owner_account_id = ?",
            accountId,
          ) >= 10
        )
          capacityReached();
        const id = randomUUID();
        database
          .prepare(
            "INSERT INTO local_workspaces(id,owner_account_id,name,created_at) VALUES(?,?,?,?)",
          )
          .run(id, accountId, name, Date.now());
        return { id, name, role: "owner", version: 1, properties: [] };
      });
    },
    createProperty(
      accountId: string,
      workspaceId: string,
      input: { name: string; address: string },
    ): WorkspaceProperty {
      return transaction(() => {
        ownerWorkspace(accountId, workspaceId);
        if (
          count(
            "SELECT count(*) AS count FROM local_properties WHERE workspace_id = ?",
            workspaceId,
          ) >= 20
        )
          capacityReached();
        const id = randomUUID();
        database
          .prepare(
            "INSERT INTO local_properties(id,workspace_id,name,address,created_at) VALUES(?,?,?,?,?)",
          )
          .run(id, workspaceId, input.name, input.address, Date.now());
        return toProperty(accessibleProperty(accountId, id, true));
      });
    },
    updateProperty(
      accountId: string,
      propertyId: string,
      input: { name: string; address: string; version: number },
    ): WorkspaceProperty {
      return transaction(() => {
        accessibleProperty(accountId, propertyId, true);
        const changed = database
          .prepare(
            "UPDATE local_properties SET name = ?, address = ?, version = version + 1 WHERE id = ? AND version = ?",
          )
          .run(input.name, input.address, propertyId, input.version);
        if (changed.changes !== 1)
          throw new WorkspaceError(
            409,
            "VERSION_CONFLICT",
            "This property changed elsewhere. Reload before saving.",
          );
        return toProperty(accessibleProperty(accountId, propertyId, true));
      });
    },
    propertyAccess(accountId: string, propertyId: string) {
      accessibleProperty(accountId, propertyId, true);
      const tenants = database
        .prepare(
          `SELECT t.account_id AS accountId,a.display_name AS displayName
        FROM local_property_tenants t JOIN accounts a ON a.id = t.account_id
        WHERE t.property_id = ? ORDER BY t.created_at,t.account_id`,
        )
        .all(propertyId);
      const invitations = database
        .prepare(
          "SELECT * FROM local_property_invitations WHERE property_id = ? ORDER BY created_at DESC,id",
        )
        .all(propertyId) as unknown as InvitationRow[];
      return {
        tenants,
        invitations: invitations.map((row) => ({
          id: row.id,
          accountId: row.account_id,
          expiresAt: new Date(row.expires_at).toISOString(),
          status: invitationStatus(row),
        })),
      };
    },
    createInvitation(ownerId: string, propertyId: string, accountId: string) {
      return transaction(() => {
        const property = accessibleProperty(ownerId, propertyId, true);
        if (property.owner_account_id === accountId)
          throw new WorkspaceError(
            409,
            "INVALID_INVITATION",
            "The owner already has access to this property.",
          );
        if (
          !database
            .prepare("SELECT id FROM accounts WHERE id = ?")
            .get(accountId)
        ) {
          throw new WorkspaceError(
            404,
            "ACCOUNT_NOT_FOUND",
            "Ask the recipient to share their existing Kasa account ID.",
          );
        }
        if (
          database
            .prepare(
              "SELECT 1 FROM local_property_tenants WHERE property_id = ? AND account_id = ?",
            )
            .get(propertyId, accountId)
        ) {
          throw new WorkspaceError(
            409,
            "ALREADY_CONNECTED",
            "This account is already connected to the property.",
          );
        }
        if (
          count(
            "SELECT count(*) AS count FROM local_property_invitations WHERE property_id = ?",
            propertyId,
          ) >= 500
        )
          capacityReached();
        const now = Date.now();
        // Replacing an unaccepted invitation invalidates its old code atomically.
        database
          .prepare(
            "UPDATE local_property_invitations SET revoked_at = ? WHERE property_id = ? AND account_id = ? AND accepted_at IS NULL AND revoked_at IS NULL",
          )
          .run(now, propertyId, accountId);
        const id = randomUUID();
        const code = randomBytes(32).toString("base64url");
        const expiresAt = now + 24 * 60 * 60 * 1000;
        database
          .prepare(
            "INSERT INTO local_property_invitations(id,property_id,account_id,code_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)",
          )
          .run(id, propertyId, accountId, hashCode(code), now, expiresAt);
        return {
          id,
          propertyId,
          accountId,
          code,
          expiresAt: new Date(expiresAt).toISOString(),
        };
      });
    },
    revokeInvitation(ownerId: string, invitationId: string) {
      return transaction(() => {
        const row = database
          .prepare("SELECT * FROM local_property_invitations WHERE id = ?")
          .get(invitationId) as InvitationRow | undefined;
        if (!row) unavailable();
        accessibleProperty(ownerId, row.property_id, true);
        if (row.accepted_at !== null)
          throw new WorkspaceError(
            409,
            "INVITATION_USED",
            "This invitation was accepted. Remove property access instead.",
          );
        database
          .prepare(
            "UPDATE local_property_invitations SET revoked_at = coalesce(revoked_at,?) WHERE id = ?",
          )
          .run(Date.now(), invitationId);
        return { revoked: true as const };
      });
    },
    acceptInvitation(accountId: string, code: string) {
      return transaction(() => {
        const now = Date.now();
        const row = database
          .prepare(
            "SELECT * FROM local_property_invitations WHERE code_hash = ? AND account_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?",
          )
          .get(hashCode(code), accountId, now) as InvitationRow | undefined;
        if (!row) inviteUnavailable();
        if (
          count(
            "SELECT count(*) AS count FROM local_property_tenants WHERE property_id = ?",
            row.property_id,
          ) >= 100
        )
          capacityReached();
        if (
          count(
            "SELECT count(*) AS count FROM local_property_tenants WHERE account_id = ?",
            accountId,
          ) >= 100
        )
          capacityReached();
        const property = database
          .prepare("SELECT workspace_id FROM local_properties WHERE id = ?")
          .get(row.property_id) as { workspace_id: string } | undefined;
        if (!property) inviteUnavailable();
        database
          .prepare(
            "INSERT INTO local_property_tenants(property_id,account_id,created_at,membership_id) VALUES(?,?,?,?) ON CONFLICT(property_id,account_id) DO NOTHING",
          )
          .run(row.property_id, accountId, now, randomUUID());
        database
          .prepare(
            "UPDATE local_property_invitations SET accepted_at = ? WHERE id = ?",
          )
          .run(now, row.id);
        database
          .prepare(
            "UPDATE local_properties SET version = version + 1 WHERE id = ?",
          )
          .run(row.property_id);
        return {
          propertyId: row.property_id,
          workspaceId: property.workspace_id,
        };
      });
    },
    removeTenant(ownerId: string, propertyId: string, accountId: string) {
      return transaction(() => {
        accessibleProperty(ownerId, propertyId, true);
        privateData.revokePropertyPair(ownerId, propertyId, accountId);
        const removed = database
          .prepare(
            "DELETE FROM local_property_tenants WHERE property_id = ? AND account_id = ?",
          )
          .run(propertyId, accountId);
        database
          .prepare(
            "UPDATE local_property_invitations SET revoked_at = ? WHERE property_id = ? AND account_id = ? AND accepted_at IS NULL AND revoked_at IS NULL",
          )
          .run(Date.now(), propertyId, accountId);
        if (removed.changes > 0)
          database
            .prepare(
              "UPDATE local_properties SET version = version + 1 WHERE id = ?",
            )
            .run(propertyId);
        return { removed: true as const };
      });
    },
    listMaintenance(
      accountId: string,
      propertyId: string,
    ): MaintenanceRequest[] {
      const property = accessibleProperty(accountId, propertyId);
      const rows = database
        .prepare(
          `SELECT * FROM local_maintenance_requests
        WHERE property_id = ? AND (? = 1 OR created_by = ?) ORDER BY updated_at DESC,id`,
        )
        .all(
          propertyId,
          property.owner_account_id === accountId ? 1 : 0,
          accountId,
        ) as unknown as MaintenanceRow[];
      return rows.map(toRequest);
    },
    createMaintenance(
      accountId: string,
      propertyId: string,
      input: {
        title: string;
        description: string;
        priority: MaintenancePriority;
      },
    ): MaintenanceRequest {
      return transaction(() => {
        accessibleProperty(accountId, propertyId);
        if (
          count(
            "SELECT count(*) AS count FROM local_maintenance_requests WHERE property_id = ?",
            propertyId,
          ) >= 25
        )
          capacityReached();
        const id = randomUUID();
        const now = Date.now();
        const row = database
          .prepare(
            "INSERT INTO local_maintenance_requests(id,property_id,created_by,title,description,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) RETURNING *",
          )
          .get(
            id,
            propertyId,
            accountId,
            input.title,
            input.description,
            input.priority,
            now,
            now,
          ) as MaintenanceRow | undefined;
        if (!row) unavailable();
        addHistory(id, accountId, "created", input.description, "open", now);
        privateData.notifyMaintenance(
          propertyId,
          id,
          accountId,
          accountId,
          "maintenance_created",
        );
        return toRequest(row);
      });
    },
    updateMaintenance(
      accountId: string,
      requestId: string,
      input: { version: number; status?: MaintenanceStatus; message?: string },
    ): MaintenanceRequest {
      return transaction(() => {
        const row = database
          .prepare("SELECT * FROM local_maintenance_requests WHERE id = ?")
          .get(requestId) as MaintenanceRow | undefined;
        if (!row) unavailable();
        const property = accessibleProperty(accountId, row.property_id);
        const owner = property.owner_account_id === accountId;
        if (!owner && row.created_by !== accountId) unavailable();
        if (!owner && input.status !== undefined)
          throw new WorkspaceError(
            403,
            "FORBIDDEN",
            "Only the property owner can change this request's status.",
          );
        if (input.version !== row.version)
          throw new WorkspaceError(
            409,
            "VERSION_CONFLICT",
            "This request changed elsewhere. Reload before saving.",
          );
        const changedStatus =
          input.status !== undefined && input.status !== row.status;
        if (!changedStatus && !input.message)
          throw new WorkspaceError(
            422,
            "VALIDATION_ERROR",
            "Add a message or choose a different status.",
          );
        const eventCount = count(
          "SELECT count(*) AS count FROM local_maintenance_history WHERE request_id = ?",
          requestId,
        );
        if (eventCount + (changedStatus ? 1 : 0) + (input.message ? 1 : 0) > 50)
          capacityReached();
        const status = input.status ?? row.status;
        const now = Date.now();
        const updated = database
          .prepare(
            "UPDATE local_maintenance_requests SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? RETURNING *",
          )
          .get(status, now, requestId, input.version) as
          MaintenanceRow | undefined;
        if (!updated)
          throw new WorkspaceError(
            409,
            "VERSION_CONFLICT",
            "This request changed elsewhere. Reload before saving.",
          );
        if (changedStatus)
          addHistory(requestId, accountId, "status_changed", "", status, now);
        if (input.message)
          addHistory(
            requestId,
            accountId,
            "comment",
            input.message,
            status,
            now,
          );
        privateData.notifyMaintenance(
          row.property_id,
          requestId,
          row.created_by,
          accountId,
          "maintenance_updated",
        );
        return toRequest(updated);
      });
    },
  };
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
