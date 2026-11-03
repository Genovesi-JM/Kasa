import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createAccountStore } from "./account-store.ts";
import { WorkspaceError } from "./workspace-store.ts";
import {
  localListingSchema,
  privateMessagesPageSchema,
  privateMessageMutationSchema,
  type LocalListingInput,
} from "../src/platform/localMarketplaceContracts.ts";

// Independent high-volume invariant checks; marketplace-smoke covers HTTP boundaries.
const directory = mkdtempSync(join(tmpdir(), "kasa-market-security-"));
const databasePath = join(directory, "security.sqlite");
let store: ReturnType<typeof createAccountStore> | undefined;
let checks = 0;
function passed(label: string) {
  checks += 1;
  console.log(`ok ${checks} - ${label}`);
}
function denied(action: () => unknown, code: string, status = 409) {
  assert.throws(
    action,
    (error) =>
      error instanceof WorkspaceError &&
      error.code === code &&
      error.status === status,
  );
}

try {
  store = createAccountStore(databasePath);
  const account = (name: string) => {
    const value = store!.createAccount(
      {
        email: `${name}@example.invalid`,
        displayName: name,
        locale: "pt",
        passwordSalt: "synthetic-security-fixture-not-a-login",
        passwordHash: "synthetic-security-fixture-not-a-login",
      },
      randomUUID(),
      Date.now() + 60_000,
    );
    assert.ok(value);
    return value;
  };
  const owner = account("Owner"),
    visitor = account("Visitor"),
    outsider = account("Outsider");
  const workspace = store.workspaces.createWorkspace(
    owner.id,
    "Synthetic workspace",
  );
  const property = store.workspaces.createProperty(owner.id, workspace.id, {
    name: "Private property name",
    address: "PRIVATE-ADDRESS-DO-NOT-PUBLISH",
  });
  const input: LocalListingInput = {
    title: "Synthetic public listing",
    description: "Invented property for local-only security checks.",
    city: "Luanda",
    area: "Talatona",
    intent: "Rent",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 80,
    priceMinor: 50_000_000,
    currency: "AOA",
    furnished: false,
    pets: "ask",
  };
  let listing = store.marketplace.create(owner.id, {
    ...input,
    propertyId: property.id,
    mutationId: randomUUID(),
  }).listing;
  denied(
    () => store!.marketplace.get(visitor.id, listing.id),
    "NOT_FOUND",
    404,
  );
  listing = store.marketplace.update(owner.id, listing.id, {
    ...input,
    status: "visible",
    version: listing.version,
    mutationId: randomUUID(),
  }).listing;
  const publicListing = localListingSchema.parse(
    store.marketplace.get(visitor.id, listing.id),
  );
  assert.equal(publicListing.propertyId, undefined);
  for (const secret of [property.id, property.address, owner.email, owner.id])
    assert.equal(JSON.stringify(publicListing).includes(secret), false);
  denied(
    () =>
      store!.marketplace.update(outsider.id, listing.id, {
        ...input,
        status: "paused",
        version: listing.version,
        mutationId: randomUUID(),
      }),
    "NOT_FOUND",
    404,
  );
  for (const query of ["%", "_", "' OR 1=1 --", "\\"])
    assert.equal(
      store.marketplace.list(
        visitor.id,
        { offset: 0, limit: 24, q: query },
        false,
      ).total,
      0,
    );
  passed(
    "explicit listing projection and literal search do not expose private property/account fields",
  );

  const firstInput = {
    mutationId: randomUUID(),
    body: "Invented initial enquiry",
  };
  const first = privateMessageMutationSchema.parse(
    store.marketplace.enquire(visitor.id, listing.id, firstInput),
  );
  const id = first.conversation.id;
  const ownSend = {
    mutationId: randomUUID(),
    body: "Synthetic owner response",
  };
  const response = store.marketplace.send(owner.id, id, ownSend);
  const outsiderActions = [
    () => store!.marketplace.messages(outsider.id, id),
    () => store!.marketplace.send(outsider.id, id, ownSend),
    () => store!.marketplace.read(outsider.id, id, 2),
    () =>
      store!.marketplace.block(outsider.id, id, {
        mutationId: randomUUID(),
        version: response.conversation.version,
        blocked: true,
      }),
  ];
  for (const action of outsiderActions) denied(action, "NOT_FOUND", 404);
  assert.equal(
    store.marketplace.conversations(outsider.id, { offset: 0, limit: 50 })
      .total,
    0,
  );
  assert.equal(store.marketplace.messages(owner.id, id).latestSequence, 2);
  passed(
    "outsider cannot read, send, mark read, block, or recover another actor's receipt",
  );

  let current = store.marketplace.messages(owner.id, id).conversation;
  store.marketplace.block(owner.id, id, {
    mutationId: randomUUID(),
    version: current.version,
    blocked: true,
  });
  current = store.marketplace.messages(visitor.id, id).conversation;
  store.marketplace.block(visitor.id, id, {
    mutationId: randomUUID(),
    version: current.version,
    blocked: true,
  });
  current = store.marketplace.messages(owner.id, id).conversation;
  const unblocked = store.marketplace.block(owner.id, id, {
    mutationId: randomUUID(),
    version: current.version,
    blocked: false,
  });
  assert.equal(unblocked.conversation.blockedByMe, false);
  assert.equal(unblocked.conversation.blockedByOther, true);
  for (const actor of [owner, visitor])
    denied(
      () =>
        store!.marketplace.send(actor.id, id, {
          mutationId: randomUUID(),
          body: "Must not insert",
        }),
      "CONVERSATION_BLOCKED",
    );
  const replay = store.marketplace.send(owner.id, id, ownSend);
  assert.equal(replay.replayed, true);
  assert.equal(replay.message.id, response.message.id);
  assert.equal(replay.conversation.blockedByOther, true);
  denied(
    () =>
      store!.marketplace.send(owner.id, id, {
        ...ownSend,
        body: "Altered replay",
      }),
    "MUTATION_CONFLICT",
  );
  assert.equal(store.marketplace.messages(owner.id, id).latestSequence, 2);
  listing = store.marketplace.update(owner.id, listing.id, {
    ...input,
    status: "paused",
    version: listing.version,
    mutationId: randomUUID(),
  }).listing;
  assert.equal(
    store.marketplace.enquire(visitor.id, listing.id, firstInput).message.id,
    first.message.id,
  );
  denied(
    () =>
      store!.marketplace.enquire(outsider.id, listing.id, {
        mutationId: randomUUID(),
        body: "Not published",
      }),
    "NOT_FOUND",
    404,
  );
  current = store.marketplace.messages(visitor.id, id).conversation;
  store.marketplace.block(visitor.id, id, {
    mutationId: randomUUID(),
    version: current.version,
    blocked: false,
  });
  store.marketplace.send(visitor.id, id, {
    mutationId: randomUUID(),
    body: "Existing chat works after listing pause",
  });
  passed(
    "independent participant blocking, paused-listing recovery and current-view replay are consistent",
  );

  // Fill without HTTP rate-limit noise to exercise atomic cap/rollback and all pagination boundaries.
  while (store.marketplace.messages(owner.id, id).latestSequence < 500)
    store.marketplace.send(visitor.id, id, {
      mutationId: randomUUID(),
      body: "Synthetic capacity fixture",
    });
  const cappedBefore = store.marketplace.messages(owner.id, id);
  const overLimit = {
    mutationId: randomUUID(),
    body: "Must roll back completely",
  };
  for (let retry = 0; retry < 2; retry++)
    denied(
      () => store!.marketplace.send(visitor.id, id, overLimit),
      "LIMIT_REACHED",
    );
  assert.deepEqual(store.marketplace.messages(owner.id, id), cappedBefore);
  const inspection = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(
      inspection
        .prepare(
          "SELECT count(*) AS n FROM local_market_mutations WHERE mutation_id=?",
        )
        .get(overLimit.mutationId)?.n,
      0,
    );
    assert.equal(
      inspection
        .prepare(
          "SELECT count(*) AS n FROM local_market_messages WHERE conversation_id=?",
        )
        .get(id)?.n,
      500,
    );
  } finally {
    inspection.close();
  }
  const sequences: number[] = [];
  let before: number | undefined;
  do {
    const page = privateMessagesPageSchema.parse(
      store.marketplace.messages(owner.id, id, before),
    );
    sequences.push(...page.messages.map((message) => message.sequence));
    before = page.nextBefore ?? undefined;
  } while (before !== undefined);
  assert.deepEqual(
    sequences.sort((a, b) => a - b),
    Array.from({ length: 500 }, (_, index) => index + 1),
  );
  assert.equal(new Set(sequences).size, 500);
  assert.equal(store.marketplace.messages(owner.id, id, 1).messages.length, 0);
  assert.equal(
    store.marketplace.read(owner.id, id, 100).conversation.unreadCount,
    400,
  );
  assert.equal(
    store.marketplace.read(owner.id, id, 1).conversation.unreadCount,
    400,
  );
  denied(
    () => store!.marketplace.read(owner.id, id, 501),
    "VALIDATION_ERROR",
    422,
  );
  assert.equal(
    store.marketplace.read(owner.id, id, 500).conversation.unreadCount,
    0,
  );
  passed(
    "500-message cap rolls back receipts/version and pagination/read cursors are exact and monotonic",
  );

  store.close();
  store = createAccountStore(databasePath);
  assert.equal(
    store.marketplace.messages(owner.id, id).conversation.unreadCount,
    0,
  );
  assert.equal(store.marketplace.messages(owner.id, id).latestSequence, 500);
  assert.equal(
    store.marketplace.send(owner.id, id, ownSend).message.id,
    response.message.id,
  );
  assert.equal(
    store.marketplace.enquire(visitor.id, listing.id, firstInput).message.id,
    first.message.id,
  );
  denied(() => store!.marketplace.messages(outsider.id, id), "NOT_FOUND", 404);
  passed(
    "restart preserves private scope, read cursor, cap and idempotent receipts",
  );
  console.log(
    `Marketplace independent security smoke passed (${checks} groups).`,
  );
} finally {
  store?.close();
  const files = readdirSync(directory);
  assert.ok(files.length <= 3);
  for (const file of files) {
    assert.ok(
      [
        "security.sqlite",
        "security.sqlite-wal",
        "security.sqlite-shm",
      ].includes(file),
    );
    const target = join(directory, file);
    const info = lstatSync(target);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1);
    unlinkSync(target);
  }
  rmdirSync(directory);
}
