import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { WorkspaceError } from "./workspace-store.ts";
import {
  maxViewingAdvanceDays,
  viewingTimeZone,
  type SavedViewing,
  type SavedViewingActionInput,
  type SavedViewingCreateInput,
  type SavedViewingDetail,
  type SavedViewingEvent,
} from "../src/platform/persistedViewingContracts.ts";

/** Local appointments only: no external delivery, attendance or venue availability is inferred. */
export function migrateViewingStore(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE local_viewings (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES local_market_conversations(id),
        property_id TEXT NOT NULL REFERENCES local_properties(id),
        owner_account_id TEXT NOT NULL REFERENCES accounts(id),
        requester_account_id TEXT NOT NULL REFERENCES accounts(id),
        status TEXT NOT NULL CHECK(status IN ('requested','proposed','confirmed','declined','cancelled')),
        starts_at INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 180 AND duration_minutes%15=0),
        note TEXT NOT NULL CHECK(length(note)<=1000),
        version INTEGER NOT NULL CHECK(version>0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK(owner_account_id!=requester_account_id)
      ) STRICT;
      CREATE INDEX local_viewing_conversation ON local_viewings(conversation_id,created_at,id);
      CREATE INDEX local_viewing_property_time ON local_viewings(property_id,status,starts_at);
      CREATE INDEX local_viewing_requester_time ON local_viewings(requester_account_id,status,starts_at);
      CREATE TABLE local_viewing_history (
        id TEXT PRIMARY KEY,
        viewing_id TEXT NOT NULL REFERENCES local_viewings(id),
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        actor_role TEXT NOT NULL CHECK(actor_role IN ('owner','requester')),
        note TEXT NOT NULL CHECK(length(note)<=1000),
        action TEXT NOT NULL CHECK(action IN ('request','propose','confirm','accept','decline','cancel')),
        version INTEGER NOT NULL CHECK(version>0),
        before_json TEXT,
        after_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(viewing_id,version)
      ) STRICT;
      CREATE TABLE local_viewing_mutations (
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        mutation_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        viewing_id TEXT NOT NULL REFERENCES local_viewings(id),
        created_at INTEGER NOT NULL,
        PRIMARY KEY(actor_id,mutation_id)
      ) STRICT;
      PRAGMA user_version=6;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

interface Context {
  id: string;
  listing_id: string;
  property_id: string;
  owner_account_id: string;
  visitor_account_id: string;
  listing_status: "draft" | "visible" | "paused";
  listing_title: string;
  blocked: number;
}
interface ViewingRow {
  id: string;
  conversation_id: string;
  property_id: string;
  owner_account_id: string;
  requester_account_id: string;
  status: SavedViewing["status"];
  starts_at: number;
  duration_minutes: number;
  note: string;
  version: number;
  created_at: number;
  updated_at: number;
}
interface HistoryRow {
  id: string;
  actor_id: string;
  actor_role: "owner" | "requester";
  note: string;
  action: SavedViewingEvent["action"];
  version: number;
  before_json: string | null;
  after_json: string;
  created_at: number;
}
const iso = (value: number) => new Date(value).toISOString();
function fail(status: number, code: string, message: string): never {
  throw new WorkspaceError(status, code, message);
}

export function createViewingStore(database: DatabaseSync) {
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
  function context(actorId: string, conversationId: string): Context {
    const row = database
      .prepare(
        `SELECT c.*,l.property_id,l.status AS listing_status,
      json_extract(l.data_json,'$.title') AS listing_title,
      (SELECT coalesce(max(blocked),0) FROM local_market_participants WHERE conversation_id=c.id) AS blocked
      FROM local_market_conversations c JOIN local_market_listings l ON l.id=c.listing_id
      JOIN local_market_participants p ON p.conversation_id=c.id
      WHERE c.id=? AND p.account_id=?`,
      )
      .get(conversationId, actorId) as Context | undefined;
    if (
      !row ||
      (row.owner_account_id !== actorId && row.visitor_account_id !== actorId)
    )
      fail(404, "NOT_FOUND", "The conversation is not available.");
    return row;
  }
  function rowFor(actorId: string, id: string) {
    const row = database
      .prepare("SELECT * FROM local_viewings WHERE id=?")
      .get(id) as ViewingRow | undefined;
    if (!row) fail(404, "NOT_FOUND", "The viewing request is not available.");
    const chat = context(actorId, row.conversation_id);
    if (
      row.owner_account_id !== actorId &&
      row.requester_account_id !== actorId
    )
      fail(404, "NOT_FOUND", "The viewing request is not available.");
    return { row, chat };
  }
  function snapshot(row: ViewingRow): SavedViewingEvent["after"] {
    return {
      status: row.status,
      startsAt: iso(row.starts_at),
      endsAt: iso(row.starts_at + row.duration_minutes * 60000),
      durationMinutes: row.duration_minutes,
    };
  }
  function summary(
    actorId: string,
    row: ViewingRow,
    chat: Context,
  ): SavedViewing {
    return {
      ...snapshot(row),
      id: row.id,
      conversationId: row.conversation_id,
      listingId: chat.listing_id,
      listingTitle: chat.listing_title,
      isListingOwner: row.owner_account_id === actorId,
      timeZone: viewingTimeZone,
      note: row.note,
      version: row.version,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }
  function detail(actorId: string, id: string): SavedViewingDetail {
    const { row, chat } = rowFor(actorId, id);
    const history = database
      .prepare(
        "SELECT * FROM local_viewing_history WHERE viewing_id=? ORDER BY version",
      )
      .all(id) as unknown as HistoryRow[];
    return {
      viewing: summary(actorId, row, chat),
      history: history.map((event) => ({
        id: event.id,
        sequence: event.version,
        action: event.action,
        actorRole: event.actor_role,
        mine: event.actor_id === actorId,
        note: event.note,
        before:
          event.before_json === null
            ? null
            : (JSON.parse(event.before_json) as SavedViewingEvent["before"]),
        after: JSON.parse(event.after_json) as SavedViewingEvent["after"],
        createdAt: iso(event.created_at),
      })),
    };
  }
  function fingerprint(operation: string, target: string, input: object) {
    return createHash("sha256")
      .update(JSON.stringify([operation, target, input]))
      .digest("hex");
  }
  function receipt(actorId: string, mutationId: string, hash: string) {
    const previous = database
      .prepare(
        "SELECT fingerprint,viewing_id FROM local_viewing_mutations WHERE actor_id=? AND mutation_id=?",
      )
      .get(actorId, mutationId) as
      { fingerprint: string; viewing_id: string } | undefined;
    if (previous && previous.fingerprint !== hash)
      fail(
        409,
        "MUTATION_CONFLICT",
        "This retry identifier was already used for different details.",
      );
    return previous;
  }
  function saveReceipt(
    actorId: string,
    mutationId: string,
    hash: string,
    id: string,
  ) {
    database
      .prepare(
        "INSERT INTO local_viewing_mutations(actor_id,mutation_id,fingerprint,viewing_id,created_at) VALUES(?,?,?,?,?)",
      )
      .run(actorId, mutationId, hash, id, Date.now());
  }
  function event(
    actorId: string,
    row: ViewingRow,
    action: SavedViewingEvent["action"],
    before: SavedViewingEvent["before"],
  ) {
    database
      .prepare(
        "INSERT INTO local_viewing_history(id,viewing_id,actor_id,actor_role,note,action,version,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        row.id,
        actorId,
        row.owner_account_id === actorId ? "owner" : "requester",
        row.note,
        action,
        row.version,
        before === null ? null : JSON.stringify(before),
        JSON.stringify(snapshot(row)),
        row.updated_at,
      );
  }
  function availableMessaging(chat: Context) {
    if (chat.blocked)
      fail(
        409,
        "CONVERSATION_BLOCKED",
        "New viewing arrangements are blocked in this conversation.",
      );
  }
  function futureTime(startsAt: number, now: number) {
    if (
      !Number.isFinite(startsAt) ||
      startsAt % 60000 !== 0 ||
      startsAt <= now ||
      startsAt > now + maxViewingAdvanceDays * 86400000
    )
      fail(
        422,
        "VALIDATION_ERROR",
        "Choose a future whole-minute time within the next 180 days.",
      );
  }
  function assertNoConflict(row: ViewingRow) {
    const conflict = database
      .prepare(
        `SELECT id FROM local_viewings WHERE id!=? AND status='confirmed'
      AND (property_id=? OR requester_account_id=?) AND starts_at<?
      AND starts_at+duration_minutes*60000>? LIMIT 1`,
      )
      .get(
        row.id,
        row.property_id,
        row.requester_account_id,
        row.starts_at + row.duration_minutes * 60000,
        row.starts_at,
      );
    if (conflict)
      fail(
        409,
        "SLOT_CONFLICT",
        "This viewing time overlaps another confirmed viewing for this property or requester.",
      );
  }
  return {
    get: detail,
    list(
      actorId: string,
      conversationId: string,
      query: { offset: number; limit: number },
    ) {
      const chat = context(actorId, conversationId);
      const total = (
        database
          .prepare(
            "SELECT count(*) AS count FROM local_viewings WHERE conversation_id=?",
          )
          .get(conversationId) as { count: number }
      ).count;
      const rows = database
        .prepare(
          "SELECT * FROM local_viewings WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
        )
        .all(
          conversationId,
          query.limit,
          query.offset,
        ) as unknown as ViewingRow[];
      return {
        viewings: rows.map((row) => summary(actorId, row, chat)),
        total,
        nextOffset:
          query.offset + rows.length < total
            ? query.offset + rows.length
            : null,
      };
    },
    create(
      actorId: string,
      conversationId: string,
      input: SavedViewingCreateInput,
    ) {
      return transaction(() => {
        const chat = context(actorId, conversationId);
        if (chat.visitor_account_id !== actorId)
          fail(
            403,
            "FORBIDDEN",
            "Only the requester can start a viewing request.",
          );
        const hash = fingerprint("viewing.create", conversationId, input);
        const previous = receipt(actorId, input.mutationId, hash);
        if (previous)
          return { ...detail(actorId, previous.viewing_id), replayed: true };
        if (chat.listing_status !== "visible")
          fail(
            409,
            "LISTING_UNAVAILABLE",
            "The listing is not accepting new viewing requests.",
          );
        availableMessaging(chat);
        const now = Date.now();
        const start = Date.parse(input.startsAt);
        futureTime(start, now);
        if (
          database
            .prepare(
              `SELECT id FROM local_viewings WHERE conversation_id=? AND
          (status IN ('requested','proposed') OR (status='confirmed' AND starts_at+duration_minutes*60000>?)) LIMIT 1`,
            )
            .get(conversationId, now)
        )
          fail(
            409,
            "ACTIVE_VIEWING_EXISTS",
            "This conversation already has an active viewing request.",
          );
        const count = (
          database
            .prepare(
              "SELECT count(*) AS count FROM local_viewings WHERE conversation_id=?",
            )
            .get(conversationId) as { count: number }
        ).count;
        if (count >= 50)
          fail(
            409,
            "LIMIT_REACHED",
            "This local conversation has reached its 50-viewing record limit.",
          );
        const id = randomUUID();
        database
          .prepare(
            `INSERT INTO local_viewings(id,conversation_id,property_id,owner_account_id,requester_account_id,status,starts_at,duration_minutes,note,version,created_at,updated_at)
          VALUES(?,?,?,?,?,'requested',?,?,?,1,?,?)`,
          )
          .run(
            id,
            conversationId,
            chat.property_id,
            chat.owner_account_id,
            actorId,
            start,
            input.durationMinutes,
            input.note,
            now,
            now,
          );
        event(actorId, rowFor(actorId, id).row, "request", null);
        saveReceipt(actorId, input.mutationId, hash, id);
        return { ...detail(actorId, id), replayed: false };
      });
    },
    act(actorId: string, id: string, input: SavedViewingActionInput) {
      return transaction(() => {
        const { row, chat } = rowFor(actorId, id);
        const hash = fingerprint("viewing.action", id, input);
        const previous = receipt(actorId, input.mutationId, hash);
        if (previous)
          return { ...detail(actorId, previous.viewing_id), replayed: true };
        if (input.version !== row.version)
          fail(
            409,
            "VERSION_CONFLICT",
            "The viewing changed. Reload before acting.",
          );
        const isOwner = row.owner_account_id === actorId;
        if (
          (["propose", "confirm", "decline"].includes(input.action) &&
            !isOwner) ||
          (input.action === "accept" && isOwner)
        )
          fail(
            403,
            "FORBIDDEN",
            "This action is not available to this participant.",
          );
        const valid =
          input.action === "propose" || input.action === "decline"
            ? ["requested", "proposed"].includes(row.status)
            : input.action === "confirm"
              ? row.status === "requested"
              : input.action === "accept"
                ? row.status === "proposed"
                : ["requested", "proposed", "confirmed"].includes(row.status);
        if (!valid)
          fail(
            409,
            "INVALID_TRANSITION",
            "This viewing cannot be changed in that way.",
          );
        const terminal =
          input.action === "cancel" || input.action === "decline";
        if (!terminal) availableMessaging(chat);
        const now = Date.now();
        const next = {
          ...row,
          starts_at:
            input.action === "propose"
              ? Date.parse(input.startsAt)
              : row.starts_at,
          duration_minutes:
            input.action === "propose"
              ? input.durationMinutes
              : row.duration_minutes,
          status: (input.action === "propose"
            ? "proposed"
            : input.action === "cancel"
              ? "cancelled"
              : input.action === "decline"
                ? "declined"
                : "confirmed") as SavedViewing["status"],
          note: input.note,
          version: row.version + 1,
          updated_at: now,
        };
        if (!terminal) futureTime(next.starts_at, now);
        if (next.status === "confirmed") assertNoConflict(next);
        if (
          input.action === "propose" &&
          row.status === "proposed" &&
          row.starts_at === next.starts_at &&
          row.duration_minutes === next.duration_minutes &&
          row.note === next.note
        ) {
          saveReceipt(actorId, input.mutationId, hash, id);
          return { ...detail(actorId, id), replayed: false };
        }
        if (row.version >= (terminal ? 50 : 49))
          fail(
            409,
            "LIMIT_REACHED",
            "This local viewing has reached its change limit; the final event is reserved for cancellation or decline.",
          );
        database
          .prepare(
            "UPDATE local_viewings SET status=?,starts_at=?,duration_minutes=?,note=?,version=?,updated_at=? WHERE id=?",
          )
          .run(
            next.status,
            next.starts_at,
            next.duration_minutes,
            next.note,
            next.version,
            next.updated_at,
            id,
          );
        event(actorId, next, input.action, snapshot(row));
        saveReceipt(actorId, input.mutationId, hash, id);
        return { ...detail(actorId, id), replayed: false };
      });
    },
  };
}
export type ViewingStore = ReturnType<typeof createViewingStore>;
