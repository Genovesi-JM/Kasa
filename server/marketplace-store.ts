import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  LocalListing,
  LocalListingInput,
  PrivateConversation,
  PrivateMessage,
} from "../src/platform/localMarketplaceContracts.ts";
import { WorkspaceError } from "./workspace-store.ts";

type Status = LocalListing["status"];
interface ListingRow {
  id: string;
  property_id: string;
  data_json: string;
  intent: LocalListingInput["intent"];
  status: Status;
  version: number;
  created_at: number;
  updated_at: number;
  owner_account_id: string;
  owner_name: string;
}
interface ConversationRow {
  id: string;
  listing_id: string;
  owner_account_id: string;
  visitor_account_id: string;
  version: number;
  updated_at: number;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  author_id: string;
  sequence: number;
  body: string;
  created_at: number;
}
interface Receipt {
  fingerprint: string;
  resource_id: string;
  message_id: string | null;
}
export interface MarketplaceQuery {
  offset: number;
  limit: number;
  q?: string;
  city?: string;
  intent?: LocalListingInput["intent"];
  type?: LocalListingInput["propertyType"];
  pets?: LocalListingInput["pets"];
  minPriceMinor?: number;
  maxPriceMinor?: number;
  sort?: "recent" | "price_asc" | "price_desc";
}
type Mutation = { mutationId: string };
type ListingCreate = LocalListingInput & Mutation & { propertyId: string };
type ListingUpdate = LocalListingInput &
  Mutation & { version: number; status: Status };
const listingSelect = `SELECT l.*, w.owner_account_id, a.display_name AS owner_name
  FROM local_market_listings l
  JOIN local_properties p ON p.id=l.property_id
  JOIN local_workspaces w ON w.id=p.workspace_id
  JOIN accounts a ON a.id=w.owner_account_id`;
const iso = (timestamp: number) => new Date(timestamp).toISOString();
function fail(status: number, code: string, message: string): never {
  throw new WorkspaceError(status, code, message);
}

/** An opt-in authenticated LOCAL TEST catalogue, not a public listing service. */
export function migrateMarketplaceStore(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE local_market_listings (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES local_properties(id),
        intent TEXT NOT NULL CHECK(intent IN ('Rent','Buy')),
        data_json TEXT NOT NULL CHECK(json_valid(data_json)),
        status TEXT NOT NULL CHECK(status IN ('draft','visible','paused')),
        version INTEGER NOT NULL CHECK(version>0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(property_id,intent)
      ) STRICT;
      CREATE INDEX local_market_listing_catalogue ON local_market_listings(status,created_at,id);
      CREATE TABLE local_market_conversations (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES local_market_listings(id),
        owner_account_id TEXT NOT NULL REFERENCES accounts(id),
        visitor_account_id TEXT NOT NULL REFERENCES accounts(id),
        version INTEGER NOT NULL CHECK(version>0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK(owner_account_id!=visitor_account_id),
        UNIQUE(listing_id,visitor_account_id)
      ) STRICT;
      CREATE TABLE local_market_participants (
        conversation_id TEXT NOT NULL REFERENCES local_market_conversations(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
        read_through INTEGER NOT NULL DEFAULT 0 CHECK(read_through>=0),
        PRIMARY KEY(conversation_id,account_id)
      ) STRICT;
      CREATE INDEX local_market_participant_account ON local_market_participants(account_id,conversation_id);
      CREATE TABLE local_market_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES local_market_conversations(id),
        author_id TEXT NOT NULL REFERENCES accounts(id),
        sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 500),
        body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
        created_at INTEGER NOT NULL,
        UNIQUE(conversation_id,sequence)
      ) STRICT;
      CREATE TABLE local_market_mutations (
        actor_id TEXT NOT NULL REFERENCES accounts(id),
        mutation_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        message_id TEXT REFERENCES local_market_messages(id),
        created_at INTEGER NOT NULL,
        PRIMARY KEY(actor_id,mutation_id)
      ) STRICT;
      PRAGMA user_version=5;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function createMarketplaceStore(database: DatabaseSync) {
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
  function owner(actorId: string, propertyId: string) {
    const property = database
      .prepare(
        `SELECT w.owner_account_id FROM local_properties p
      JOIN local_workspaces w ON w.id=p.workspace_id WHERE p.id=?`,
      )
      .get(propertyId) as { owner_account_id: string } | undefined;
    if (!property || property.owner_account_id !== actorId)
      fail(404, "NOT_FOUND", "The property is not available.");
  }
  function listingRow(id: string): ListingRow {
    const row = database.prepare(`${listingSelect} WHERE l.id=?`).get(id) as
      ListingRow | undefined;
    if (!row) fail(404, "NOT_FOUND", "The listing is not available.");
    return row;
  }
  function listingDto(row: ListingRow, actorId: string): LocalListing {
    const isOwner = row.owner_account_id === actorId;
    return {
      ...(JSON.parse(row.data_json) as LocalListingInput),
      id: row.id,
      ...(isOwner ? { propertyId: row.property_id } : {}),
      ownerName: row.owner_name,
      isOwner,
      status: row.status,
      version: row.version,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }
  function visibleListing(actorId: string, id: string) {
    const row = listingRow(id);
    if (row.owner_account_id !== actorId && row.status !== "visible")
      fail(404, "NOT_FOUND", "The listing is not available.");
    return row;
  }
  function ownedListing(actorId: string, id: string) {
    const row = listingRow(id);
    if (row.owner_account_id !== actorId)
      fail(404, "NOT_FOUND", "The listing is not available.");
    return row;
  }
  function conversationRow(actorId: string, id: string): ConversationRow {
    const row = database
      .prepare(
        `SELECT c.* FROM local_market_conversations c
      JOIN local_market_participants p ON p.conversation_id=c.id
      WHERE c.id=? AND p.account_id=?`,
      )
      .get(id, actorId) as ConversationRow | undefined;
    if (
      !row ||
      (row.owner_account_id !== actorId && row.visitor_account_id !== actorId)
    )
      fail(404, "NOT_FOUND", "The conversation is not available.");
    return row;
  }
  function maximumSequence(id: string) {
    return (
      database
        .prepare(
          "SELECT coalesce(max(sequence),0) AS maximum FROM local_market_messages WHERE conversation_id=?",
        )
        .get(id) as { maximum: number }
    ).maximum;
  }
  function messageDto(row: MessageRow, actorId: string): PrivateMessage {
    return {
      id: row.id,
      sequence: row.sequence,
      mine: row.author_id === actorId,
      body: row.body,
      createdAt: iso(row.created_at),
    };
  }
  function conversationDto(
    row: ConversationRow,
    actorId: string,
  ): PrivateConversation {
    const listing = listingRow(row.listing_id);
    const isListingOwner = row.owner_account_id === actorId;
    const counterpart = isListingOwner
      ? row.visitor_account_id
      : row.owner_account_id;
    const name = database
      .prepare("SELECT display_name FROM accounts WHERE id=?")
      .get(counterpart) as { display_name: string };
    const me = database
      .prepare(
        "SELECT blocked,read_through FROM local_market_participants WHERE conversation_id=? AND account_id=?",
      )
      .get(row.id, actorId) as { blocked: number; read_through: number };
    const other = database
      .prepare(
        "SELECT blocked FROM local_market_participants WHERE conversation_id=? AND account_id=?",
      )
      .get(row.id, counterpart) as { blocked: number };
    const last = database
      .prepare(
        "SELECT * FROM local_market_messages WHERE conversation_id=? ORDER BY sequence DESC LIMIT 1",
      )
      .get(row.id) as MessageRow | undefined;
    const unread = database
      .prepare(
        "SELECT count(*) AS count FROM local_market_messages WHERE conversation_id=? AND author_id!=? AND sequence>?",
      )
      .get(row.id, actorId, me.read_through) as { count: number };
    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: (JSON.parse(listing.data_json) as LocalListingInput).title,
      listingIntent: listing.intent,
      listingStatus: listing.status,
      counterpartName: name.display_name,
      isListingOwner,
      blockedByMe: Boolean(me.blocked),
      blockedByOther: Boolean(other.blocked),
      version: row.version,
      updatedAt: iso(row.updated_at),
      unreadCount: unread.count,
      lastMessage: last
        ? {
            body: last.body,
            mine: last.author_id === actorId,
            createdAt: iso(last.created_at),
          }
        : null,
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
        "SELECT * FROM local_market_mutations WHERE actor_id=? AND mutation_id=?",
      )
      .get(actorId, mutationId) as Receipt | undefined;
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
    resourceId: string,
    messageId: string | null = null,
  ) {
    database
      .prepare(
        "INSERT INTO local_market_mutations(actor_id,mutation_id,fingerprint,resource_id,message_id,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(actorId, mutationId, hash, resourceId, messageId, Date.now());
  }
  function checkVersion(actual: number, expected: number) {
    if (actual !== expected)
      fail(
        409,
        "VERSION_CONFLICT",
        "The details changed. Reload before making this change.",
      );
  }
  function ensureUnique(
    propertyId: string,
    intent: LocalListingInput["intent"],
    exceptId = "",
  ) {
    if (
      database
        .prepare(
          "SELECT id FROM local_market_listings WHERE property_id=? AND intent=? AND id!=?",
        )
        .get(propertyId, intent, exceptId)
    )
      fail(
        409,
        "LISTING_EXISTS",
        "This property already has a listing for this purpose.",
      );
  }
  function messageMutation(
    actorId: string,
    id: string,
    messageId: string,
    replayed: boolean,
  ) {
    const row = conversationRow(actorId, id);
    const message = database
      .prepare(
        "SELECT * FROM local_market_messages WHERE id=? AND conversation_id=?",
      )
      .get(messageId, id) as MessageRow | undefined;
    if (!message) fail(404, "NOT_FOUND", "The message is not available.");
    return {
      conversation: conversationDto(row, actorId),
      message: messageDto(message, actorId),
      replayed,
    };
  }
  function appendMessage(actorId: string, row: ConversationRow, body: string) {
    if (
      database
        .prepare(
          "SELECT 1 FROM local_market_participants WHERE conversation_id=? AND blocked=1",
        )
        .get(row.id)
    )
      fail(
        409,
        "CONVERSATION_BLOCKED",
        "Messaging is blocked in this conversation.",
      );
    const sequence = maximumSequence(row.id) + 1;
    if (sequence > 500)
      fail(
        409,
        "LIMIT_REACHED",
        "This local test conversation has reached its 500-message limit.",
      );
    const id = randomUUID();
    const now = Date.now();
    database
      .prepare(
        "INSERT INTO local_market_messages(id,conversation_id,author_id,sequence,body,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(id, row.id, actorId, sequence, body, now);
    database
      .prepare(
        "UPDATE local_market_conversations SET version=version+1,updated_at=? WHERE id=?",
      )
      .run(now, row.id);
    return id;
  }
  function list(actorId: string, query: MarketplaceQuery, mine: boolean) {
    const conditions = [mine ? "w.owner_account_id=?" : "l.status='visible'"];
    const values: SQLInputValue[] = mine ? [actorId] : [];
    const literalLike = (value: string) =>
      `%${value.replace(/[\\%_]/g, "\\$&")}%`;
    if (query.q) {
      conditions.push(
        "(json_extract(l.data_json,'$.title') LIKE ? ESCAPE '\\' OR json_extract(l.data_json,'$.description') LIKE ? ESCAPE '\\' OR json_extract(l.data_json,'$.city') LIKE ? ESCAPE '\\' OR json_extract(l.data_json,'$.area') LIKE ? ESCAPE '\\')",
      );
      values.push(...Array<SQLInputValue>(4).fill(literalLike(query.q)));
    }
    for (const [key, value] of [
      ["city", query.city],
      ["propertyType", query.type],
      ["pets", query.pets],
    ] as const) {
      if (value !== undefined) {
        conditions.push(
          `json_extract(l.data_json,'$.${key}')=? COLLATE NOCASE`,
        );
        values.push(value);
      }
    }
    if (query.intent) {
      conditions.push("l.intent=?");
      values.push(query.intent);
    }
    if (query.minPriceMinor !== undefined) {
      conditions.push("json_extract(l.data_json,'$.priceMinor')>=?");
      values.push(query.minPriceMinor);
    }
    if (query.maxPriceMinor !== undefined) {
      conditions.push("json_extract(l.data_json,'$.priceMinor')<=?");
      values.push(query.maxPriceMinor);
    }
    const where = ` WHERE ${conditions.join(" AND ")}`;
    const total = (
      database
        .prepare(`SELECT count(*) AS count FROM (${listingSelect}${where})`)
        .get(...values) as { count: number }
    ).count;
    const order =
      query.sort === "price_asc"
        ? "json_extract(l.data_json,'$.priceMinor') ASC,"
        : query.sort === "price_desc"
          ? "json_extract(l.data_json,'$.priceMinor') DESC,"
          : "";
    const rows = database
      .prepare(
        `${listingSelect}${where} ORDER BY ${order} l.created_at DESC,l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...values, query.limit, query.offset) as unknown as ListingRow[];
    return {
      listings: rows.map((row) => listingDto(row, actorId)),
      total,
      nextOffset:
        query.offset + rows.length < total ? query.offset + rows.length : null,
    };
  }
  return {
    list,
    get(actorId: string, id: string) {
      return listingDto(visibleListing(actorId, id), actorId);
    },
    create(actorId: string, input: ListingCreate) {
      return transaction(() => {
        const { mutationId, propertyId, ...data } = input;
        owner(actorId, propertyId);
        const hash = fingerprint("listing.create", propertyId, input);
        const previous = receipt(actorId, mutationId, hash);
        if (previous)
          return {
            listing: listingDto(
              ownedListing(actorId, previous.resource_id),
              actorId,
            ),
            replayed: true,
          };
        ensureUnique(propertyId, data.intent);
        const count = database
          .prepare(
            `SELECT count(*) AS count FROM (${listingSelect} WHERE w.owner_account_id=?)`,
          )
          .get(actorId) as { count: number };
        if (count.count >= 100)
          fail(
            409,
            "LIMIT_REACHED",
            "This local test account has reached its 100-listing limit.",
          );
        const id = randomUUID();
        const now = Date.now();
        database
          .prepare(
            "INSERT INTO local_market_listings(id,property_id,intent,data_json,status,version,created_at,updated_at) VALUES(?,?,?,?,'draft',1,?,?)",
          )
          .run(id, propertyId, data.intent, JSON.stringify(data), now, now);
        saveReceipt(actorId, mutationId, hash, id);
        return {
          listing: listingDto(ownedListing(actorId, id), actorId),
          replayed: false,
        };
      });
    },
    update(actorId: string, id: string, input: ListingUpdate) {
      return transaction(() => {
        const row = ownedListing(actorId, id);
        const { mutationId, version, status, ...data } = input;
        const hash = fingerprint("listing.update", id, input);
        if (receipt(actorId, mutationId, hash))
          return { listing: listingDto(row, actorId), replayed: true };
        checkVersion(row.version, version);
        ensureUnique(row.property_id, data.intent, id);
        const serialized = JSON.stringify(data);
        if (row.data_json !== serialized || row.status !== status)
          database
            .prepare(
              "UPDATE local_market_listings SET intent=?,data_json=?,status=?,version=version+1,updated_at=? WHERE id=?",
            )
            .run(data.intent, serialized, status, Date.now(), id);
        saveReceipt(actorId, mutationId, hash, id);
        return {
          listing: listingDto(ownedListing(actorId, id), actorId),
          replayed: false,
        };
      });
    },
    enquire(actorId: string, id: string, input: Mutation & { body: string }) {
      return transaction(() => {
        const listing = listingRow(id);
        if (listing.owner_account_id === actorId)
          fail(
            422,
            "SELF_ENQUIRY",
            "You cannot contact yourself about your listing.",
          );
        const hash = fingerprint("listing.enquire", id, input);
        // Existing participants may recover an accepted request after the listing was paused.
        const existing = database
          .prepare(
            "SELECT * FROM local_market_conversations WHERE listing_id=? AND visitor_account_id=?",
          )
          .get(id, actorId) as ConversationRow | undefined;
        if (existing) conversationRow(actorId, existing.id);
        if (!existing && listing.status !== "visible")
          fail(404, "NOT_FOUND", "The listing is not available.");
        const previous = receipt(actorId, input.mutationId, hash);
        if (previous)
          return messageMutation(
            actorId,
            previous.resource_id,
            previous.message_id!,
            true,
          );
        if (listing.status !== "visible")
          fail(404, "NOT_FOUND", "The listing is not available.");
        let conversation = existing;
        if (!conversation) {
          for (const participant of [actorId, listing.owner_account_id]) {
            const count = database
              .prepare(
                "SELECT count(*) AS count FROM local_market_participants WHERE account_id=?",
              )
              .get(participant) as { count: number };
            if (count.count >= 200)
              fail(
                409,
                "LIMIT_REACHED",
                "A participant has reached the 200-conversation local test limit.",
              );
          }
          const conversationId = randomUUID();
          const now = Date.now();
          database
            .prepare(
              "INSERT INTO local_market_conversations(id,listing_id,owner_account_id,visitor_account_id,version,created_at,updated_at) VALUES(?,?,?,?,1,?,?)",
            )
            .run(
              conversationId,
              id,
              listing.owner_account_id,
              actorId,
              now,
              now,
            );
          for (const participant of [actorId, listing.owner_account_id])
            database
              .prepare(
                "INSERT INTO local_market_participants(conversation_id,account_id) VALUES(?,?)",
              )
              .run(conversationId, participant);
          conversation = conversationRow(actorId, conversationId);
        }
        const messageId = appendMessage(actorId, conversation, input.body);
        saveReceipt(
          actorId,
          input.mutationId,
          hash,
          conversation.id,
          messageId,
        );
        return messageMutation(actorId, conversation.id, messageId, false);
      });
    },
    conversations(
      actorId: string,
      query: Pick<MarketplaceQuery, "offset" | "limit">,
    ) {
      const from =
        "FROM local_market_conversations c JOIN local_market_participants p ON p.conversation_id=c.id WHERE p.account_id=?";
      const total = (
        database.prepare(`SELECT count(*) AS count ${from}`).get(actorId) as {
          count: number;
        }
      ).count;
      const rows = database
        .prepare(
          `SELECT c.* ${from} ORDER BY c.updated_at DESC,c.id DESC LIMIT ? OFFSET ?`,
        )
        .all(
          actorId,
          query.limit,
          query.offset,
        ) as unknown as ConversationRow[];
      return {
        conversations: rows.map((row) => conversationDto(row, actorId)),
        total,
        nextOffset:
          query.offset + rows.length < total
            ? query.offset + rows.length
            : null,
      };
    },
    messages(actorId: string, id: string, before?: number) {
      const row = conversationRow(actorId, id);
      const latestSequence = maximumSequence(id);
      const messages = database
        .prepare(
          "SELECT * FROM local_market_messages WHERE conversation_id=? AND sequence<? ORDER BY sequence DESC LIMIT 51",
        )
        .all(id, before ?? latestSequence + 1) as unknown as MessageRow[];
      const more = messages.length > 50;
      const page = messages.slice(0, 50).reverse();
      return {
        conversation: conversationDto(row, actorId),
        messages: page.map((message) => messageDto(message, actorId)),
        nextBefore: more ? page[0].sequence : null,
        latestSequence,
      };
    },
    send(actorId: string, id: string, input: Mutation & { body: string }) {
      return transaction(() => {
        const row = conversationRow(actorId, id);
        const hash = fingerprint("conversation.send", id, input);
        const previous = receipt(actorId, input.mutationId, hash);
        if (previous)
          return messageMutation(actorId, id, previous.message_id!, true);
        const messageId = appendMessage(actorId, row, input.body);
        saveReceipt(actorId, input.mutationId, hash, id, messageId);
        return messageMutation(actorId, id, messageId, false);
      });
    },
    read(actorId: string, id: string, throughSequence: number) {
      return transaction(() => {
        const row = conversationRow(actorId, id);
        if (throughSequence > maximumSequence(id))
          fail(
            422,
            "VALIDATION_ERROR",
            "You cannot mark future messages as read.",
          );
        database
          .prepare(
            "UPDATE local_market_participants SET read_through=max(read_through,?) WHERE conversation_id=? AND account_id=?",
          )
          .run(throughSequence, id, actorId);
        return { conversation: conversationDto(row, actorId) };
      });
    },
    block(
      actorId: string,
      id: string,
      input: Mutation & { version: number; blocked: boolean },
    ) {
      return transaction(() => {
        const row = conversationRow(actorId, id);
        const hash = fingerprint("conversation.block", id, input);
        if (receipt(actorId, input.mutationId, hash))
          return {
            conversation: conversationDto(row, actorId),
            replayed: true,
          };
        checkVersion(row.version, input.version);
        const result = database
          .prepare(
            "UPDATE local_market_participants SET blocked=? WHERE conversation_id=? AND account_id=? AND blocked!=?",
          )
          .run(Number(input.blocked), id, actorId, Number(input.blocked));
        if (result.changes)
          database
            .prepare(
              "UPDATE local_market_conversations SET version=version+1,updated_at=? WHERE id=?",
            )
            .run(Date.now(), id);
        saveReceipt(actorId, input.mutationId, hash, id);
        return {
          conversation: conversationDto(conversationRow(actorId, id), actorId),
          replayed: false,
        };
      });
    },
  };
}
export type MarketplaceStore = ReturnType<typeof createMarketplaceStore>;
