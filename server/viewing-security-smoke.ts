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
import type { LocalListingInput } from "../src/platform/localMarketplaceContracts.ts";
import {
  savedViewingCreateInputSchema,
  savedViewingActionInputSchema,
  savedViewingDetailSchema,
  savedViewingMutationSchema,
  savedViewingPageSchema,
  viewingLocalToUtc,
  viewingUtcToLocal,
  type SavedViewing,
} from "../src/platform/persistedViewingContracts.ts";

// Independent persistence/integrity tests; viewing-smoke exercises the real HTTP guards.
const directory = mkdtempSync(join(tmpdir(), "kasa-viewing-security-"));
const path = join(directory, "viewing.sqlite");
const realNow = Date.now;
const initialTime = Date.parse("2030-06-01T09:00:00.000Z");
let now = initialTime;
Date.now = () => now;
let store: ReturnType<typeof createAccountStore> | undefined;
let groups = 0;
function passed(label: string) {
  console.log(`ok ${++groups} - ${label}`);
}
function denied(run: () => unknown, code: string, status = 409) {
  assert.throws(
    run,
    (error) =>
      error instanceof WorkspaceError &&
      error.code === code &&
      error.status === status,
  );
}
const slot = (minutes: number) =>
  new Date(now + minutes * 60_000).toISOString();
function createInput(minutes = 60, durationMinutes = 60) {
  return savedViewingCreateInputSchema.parse({
    mutationId: randomUUID(),
    startsAt: slot(minutes),
    durationMinutes,
  });
}
function actionInput(
  viewing: SavedViewing,
  action: string,
  extra: object = {},
) {
  return savedViewingActionInputSchema.parse({
    mutationId: randomUUID(),
    version: viewing.version,
    action,
    ...extra,
  });
}
function act(
  actor: string,
  viewing: SavedViewing,
  action: string,
  extra: object = {},
) {
  return savedViewingMutationSchema.parse(
    store!.viewings.act(actor, viewing.id, actionInput(viewing, action, extra)),
  );
}
function create(
  actor: string,
  conversation: string,
  minutes = 60,
  duration = 60,
) {
  return savedViewingMutationSchema.parse(
    store!.viewings.create(actor, conversation, createInput(minutes, duration)),
  );
}
function inspect<T>(read: (database: DatabaseSync) => T): T {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    return read(database);
  } finally {
    database.close();
  }
}
function existingRows() {
  return inspect((database) => {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'local_viewing%' ORDER BY name",
      )
      .all() as { name: string }[];
    return tables.map(({ name }) => {
      assert.match(name, /^[a-z_]+$/);
      return {
        name,
        rows: database.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all(),
      };
    });
  });
}
try {
  store = createAccountStore(path);
  function account(name: string) {
    const token = randomUUID();
    const value = store!.createAccount(
      {
        email: `${name}@example.invalid`,
        displayName: name,
        locale: "pt",
        passwordSalt: "synthetic-test-only",
        passwordHash: "synthetic-test-only",
      },
      token,
      now + 86_400_000,
    );
    assert.ok(value);
    return { ...value, token };
  }
  const owner = account("ViewingOwner"),
    visitor = account("ViewingVisitor"),
    other = account("OtherVisitor"),
    outsider = account("ViewingOutsider"),
    secondOwner = account("SecondOwner");
  const workspace = store.workspaces.createWorkspace(
    owner.id,
    "Synthetic viewing workspace",
  );
  const secondWorkspace = store.workspaces.createWorkspace(
    secondOwner.id,
    "Independent owner workspace",
  );
  function property(ownerId = owner.id, workspaceId = workspace.id) {
    return store!.workspaces.createProperty(ownerId, workspaceId, {
      name: "Private test property",
      address: "PRIVATE-ADDRESS-NOT-FOR-VIEWING-DTO",
    });
  }
  const home = property();
  const invite = store.workspaces.createInvitation(
    owner.id,
    home.id,
    visitor.id,
  );
  store.workspaces.acceptInvitation(visitor.id, invite.code);
  store.workspaces.createMaintenance(visitor.id, home.id, {
    title: "Synthetic repair",
    description: "Preserve this pre-viewing record",
    priority: "normal",
  });
  store.privateData.uploadDocument(visitor.id, home.id, {
    title: "Synthetic file",
    filename: "fixture.pdf",
    mimeType: "application/pdf",
    contentBase64: Buffer.from("%PDF-1.7\nSynthetic fixture").toString(
      "base64",
    ),
    sharing: "shared",
  });
  store.rent.create(owner.id, home.id, {
    mutationId: randomUUID(),
    tenantAccountId: visitor.id,
    period: "2030-06",
    currency: "AOA",
    amountDueMinor: 10000,
    dueOn: "2030-06-01",
  });
  const listingInput: LocalListingInput = {
    title: "Synthetic viewing listing",
    description: "Invented listing for independent local viewing tests.",
    city: "Luanda",
    area: "Talatona",
    intent: "Rent",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 80,
    priceMinor: 10000000,
    currency: "AOA",
    furnished: false,
    pets: "ask",
  };
  function listing(
    propertyId = home.id,
    intent: "Rent" | "Buy" = "Rent",
    ownerId = owner.id,
  ) {
    const data = { ...listingInput, intent };
    const created = store!.marketplace.create(ownerId, {
      ...data,
      propertyId,
      mutationId: randomUUID(),
    }).listing;
    return store!.marketplace.update(ownerId, created.id, {
      ...data,
      status: "visible",
      version: created.version,
      mutationId: randomUUID(),
    }).listing;
  }
  function conversation(listingId: string, requester = visitor.id) {
    return store!.marketplace.enquire(requester, listingId, {
      mutationId: randomUUID(),
      body: "Synthetic viewing enquiry",
    }).conversation.id;
  }
  let firstListing = listing();
  const mainConversation = conversation(firstListing.id);
  const preMigration = existingRows();
  store.close();
  store = undefined;
  const downgrade = new DatabaseSync(path);
  try {
    downgrade.exec(
      "DROP TABLE local_viewing_mutations; DROP TABLE local_viewing_history; DROP TABLE local_viewings; PRAGMA user_version=5;",
    );
  } finally {
    downgrade.close();
  }
  store = createAccountStore(path);
  assert.deepEqual(existingRows(), preMigration);
  assert.equal(store.accountForSession(visitor.token)?.id, visitor.id);
  assert.equal(
    inspect(
      (database) => database.prepare("PRAGMA user_version").get()?.user_version,
    ),
    7,
  );
  passed(
    "v5 to v6 migration preserves every existing table row, private file bytes, rent/history, alerts, chats and sessions",
  );

  const base = createInput();
  for (const startsAt of [
    "2030-02-30T10:00:00Z",
    "2030-06-01T10:00:01Z",
    "2030-06-01T10:00:00.001Z",
    "2030-06-01T11:00:00+01:00",
  ])
    assert.equal(
      savedViewingCreateInputSchema.safeParse({ ...base, startsAt }).success,
      false,
    );
  for (const durationMinutes of [0, 14, 16, 181, 60.5])
    assert.equal(
      savedViewingCreateInputSchema.safeParse({ ...base, durationMinutes })
        .success,
      false,
    );
  assert.equal(
    viewingLocalToUtc("2030-06-01T00:00"),
    "2030-05-31T23:00:00.000Z",
  );
  assert.equal(
    viewingUtcToLocal("2030-05-31T23:00:00.000Z"),
    "2030-06-01T00:00",
  );
  assert.equal(viewingLocalToUtc("2030-02-30T12:00"), null);
  denied(
    () => store!.viewings.create(visitor.id, mainConversation, createInput(0)),
    "VALIDATION_ERROR",
    422,
  );
  denied(
    () =>
      store!.viewings.create(
        visitor.id,
        mainConversation,
        createInput(180 * 24 * 60 + 1),
      ),
    "VALIDATION_ERROR",
    422,
  );
  const horizon = create(visitor.id, mainConversation, 180 * 24 * 60, 180);
  assert.equal(horizon.viewing.startsAt, slot(180 * 24 * 60));
  act(visitor.id, horizon.viewing, "cancel");
  passed(
    "whole-minute UTC, real calendar, Luanda day boundaries, duration increments and future horizon are strict",
  );

  denied(
    () => store!.viewings.create(owner.id, mainConversation, base),
    "FORBIDDEN",
    403,
  );
  const requested = savedViewingMutationSchema.parse(
    store.viewings.create(visitor.id, mainConversation, base),
  );
  const id = requested.viewing.id;
  for (const operation of [
    () => store!.viewings.get(outsider.id, id),
    () =>
      store!.viewings.list(outsider.id, mainConversation, {
        offset: 0,
        limit: 20,
      }),
    () => store!.viewings.create(outsider.id, mainConversation, base),
    () =>
      store!.viewings.act(
        outsider.id,
        id,
        actionInput(requested.viewing, "cancel"),
      ),
  ])
    denied(operation, "NOT_FOUND", 404);
  for (const action of ["confirm", "propose", "decline"])
    denied(
      () =>
        act(
          visitor.id,
          requested.viewing,
          action,
          action === "propose"
            ? { startsAt: slot(90), durationMinutes: 60 }
            : {},
        ),
      "FORBIDDEN",
      403,
    );
  denied(() => act(owner.id, requested.viewing, "accept"), "FORBIDDEN", 403);
  const publicDetail = savedViewingDetailSchema.parse(
    store.viewings.get(owner.id, id),
  );
  for (const secret of [
    owner.id,
    visitor.id,
    owner.email,
    visitor.email,
    home.id,
    home.address,
  ])
    assert.equal(JSON.stringify(publicDetail).includes(secret), false);
  const page = savedViewingPageSchema.parse(
    store.viewings.list(owner.id, mainConversation, { offset: 0, limit: 20 }),
  );
  assert.equal(page.viewings.length, 2);
  assert.equal(
    page.viewings.some((viewing) => viewing.id === id),
    true,
  );
  assert.equal(
    page.viewings.some((viewing) => "history" in viewing),
    false,
  );
  denied(
    () => create(visitor.id, mainConversation, 240),
    "ACTIVE_VIEWING_EXISTS",
  );
  const proposed = act(owner.id, requested.viewing, "propose", {
    startsAt: slot(90),
    durationMinutes: 45,
    note: "Synthetic alternative",
  });
  denied(
    () => act(visitor.id, requested.viewing, "accept"),
    "VERSION_CONFLICT",
  );
  const acceptPayload = actionInput(proposed.viewing, "accept");
  const requesterHistory = store.viewings.get(visitor.id, id).history;
  const confirmed = savedViewingMutationSchema.parse(
    store.viewings.act(visitor.id, id, acceptPayload),
  );
  assert.equal(confirmed.viewing.status, "confirmed");
  assert.deepEqual(confirmed.history.slice(0, 2), requesterHistory);
  denied(
    () =>
      act(owner.id, confirmed.viewing, "propose", {
        startsAt: slot(120),
        durationMinutes: 45,
      }),
    "INVALID_TRANSITION",
  );
  const cancelled = act(owner.id, confirmed.viewing, "cancel");
  const replay = store.viewings.act(visitor.id, id, acceptPayload);
  assert.equal(replay.replayed, true);
  assert.equal(replay.viewing.status, "cancelled");
  assert.equal(replay.history.length, cancelled.history.length);
  denied(
    () =>
      store!.viewings.act(visitor.id, id, {
        ...acceptPayload,
        note: "Changed retry",
      }),
    "MUTATION_CONFLICT",
  );
  assert.equal(
    store.viewings.create(visitor.id, mainConversation, base).viewing.status,
    "cancelled",
  );
  passed(
    "participant scope, role/state/version rules, private DTOs, immutable history and current authorized retry view hold",
  );

  const buyListing = listing(home.id, "Buy");
  const buyConversation = conversation(buyListing.id, other.id);
  const rentRequest = create(visitor.id, mainConversation, 300);
  const buyRequest = create(other.id, buyConversation, 330);
  const rentConfirmed = act(owner.id, rentRequest.viewing, "confirm");
  const conflicting = actionInput(buyRequest.viewing, "confirm");
  const beforeConflict = store.viewings.get(other.id, buyRequest.viewing.id);
  denied(
    () => store!.viewings.act(owner.id, buyRequest.viewing.id, conflicting),
    "SLOT_CONFLICT",
  );
  assert.deepEqual(
    store.viewings.get(other.id, buyRequest.viewing.id),
    beforeConflict,
  );
  assert.equal(
    inspect(
      (db) =>
        db
          .prepare(
            "SELECT count(*) AS n FROM local_viewing_mutations WHERE mutation_id=?",
          )
          .get(conflicting.mutationId)?.n,
    ),
    0,
  );
  const adjacent = act(owner.id, buyRequest.viewing, "propose", {
    startsAt: slot(360),
    durationMinutes: 60,
  });
  const adjacentConfirmed = act(other.id, adjacent.viewing, "accept");
  assert.equal(
    adjacentConfirmed.viewing.startsAt,
    rentConfirmed.viewing.endsAt,
  );
  const secondProperty = property(secondOwner.id, secondWorkspace.id);
  const secondListing = listing(secondProperty.id, "Rent", secondOwner.id);
  const secondConversation = conversation(secondListing.id);
  const globalRequest = create(visitor.id, secondConversation, 300);
  denied(
    () => act(secondOwner.id, globalRequest.viewing, "confirm"),
    "SLOT_CONFLICT",
  );
  act(owner.id, rentConfirmed.viewing, "cancel");
  const globalConfirmed = act(secondOwner.id, globalRequest.viewing, "confirm");
  assert.equal(globalConfirmed.viewing.status, "confirmed");
  act(secondOwner.id, globalConfirmed.viewing, "cancel");
  act(owner.id, adjacentConfirmed.viewing, "cancel");
  passed(
    "Rent/Buy share property conflict domain, requester conflicts span owners, pending slots do not hold and end/start adjacency is allowed",
  );

  const pending = create(visitor.id, mainConversation, 600);
  firstListing = store.marketplace.update(owner.id, firstListing.id, {
    ...listingInput,
    status: "paused",
    version: firstListing.version,
    mutationId: randomUUID(),
  }).listing;
  const pausedProposal = act(owner.id, pending.viewing, "propose", {
    startsAt: slot(660),
    durationMinutes: 60,
  });
  let thread = store.marketplace.messages(
    owner.id,
    mainConversation,
  ).conversation;
  store.marketplace.block(owner.id, mainConversation, {
    mutationId: randomUUID(),
    version: thread.version,
    blocked: true,
  });
  denied(
    () => act(visitor.id, pausedProposal.viewing, "accept"),
    "CONVERSATION_BLOCKED",
  );
  denied(
    () =>
      act(owner.id, pausedProposal.viewing, "propose", {
        startsAt: slot(720),
        durationMinutes: 60,
      }),
    "CONVERSATION_BLOCKED",
  );
  const declined = act(owner.id, pausedProposal.viewing, "decline");
  assert.equal(declined.viewing.status, "declined");
  thread = store.marketplace.messages(owner.id, mainConversation).conversation;
  store.marketplace.block(owner.id, mainConversation, {
    mutationId: randomUUID(),
    version: thread.version,
    blocked: false,
  });
  denied(
    () => create(visitor.id, mainConversation, 720),
    "LISTING_UNAVAILABLE",
  );
  firstListing = store.marketplace.update(owner.id, firstListing.id, {
    ...listingInput,
    status: "visible",
    version: firstListing.version,
    mutationId: randomUUID(),
  }).listing;
  const toCancel = create(visitor.id, mainConversation, 720);
  thread = store.marketplace.messages(
    visitor.id,
    mainConversation,
  ).conversation;
  store.marketplace.block(visitor.id, mainConversation, {
    mutationId: randomUUID(),
    version: thread.version,
    blocked: true,
  });
  denied(
    () => act(owner.id, toCancel.viewing, "confirm"),
    "CONVERSATION_BLOCKED",
  );
  assert.equal(
    store.viewings.create(visitor.id, mainConversation, base).viewing.status,
    "cancelled",
  );
  assert.equal(
    act(visitor.id, toCancel.viewing, "cancel").viewing.status,
    "cancelled",
  );
  denied(
    () => create(visitor.id, mainConversation, 780),
    "CONVERSATION_BLOCKED",
  );
  thread = store.marketplace.messages(
    visitor.id,
    mainConversation,
  ).conversation;
  store.marketplace.block(visitor.id, mainConversation, {
    mutationId: randomUUID(),
    version: thread.version,
    blocked: false,
  });
  passed(
    "paused listings allow existing negotiations, blocking stops agreement but never blocks decline/cancellation",
  );

  const pastPayload = createInput(1, 15);
  const past = store.viewings.create(visitor.id, mainConversation, pastPayload);
  now += 2 * 60_000;
  denied(() => act(owner.id, past.viewing, "confirm"), "VALIDATION_ERROR", 422);
  assert.equal(
    store.viewings.create(visitor.id, mainConversation, pastPayload).replayed,
    true,
  );
  act(owner.id, past.viewing, "decline");
  const expiresSoon = create(visitor.id, mainConversation, 1, 15);
  const expiresProposal = act(owner.id, expiresSoon.viewing, "propose", {
    startsAt: slot(1),
    durationMinutes: 15,
  });
  now += 2 * 60_000;
  denied(
    () => act(visitor.id, expiresProposal.viewing, "accept"),
    "VALIDATION_ERROR",
    422,
  );
  act(visitor.id, expiresProposal.viewing, "cancel");
  const early = create(visitor.id, mainConversation, 1, 15);
  const earlyConfirmed = act(owner.id, early.viewing, "confirm");
  now += 17 * 60_000;
  const next = create(visitor.id, mainConversation, 60);
  assert.equal(
    store.viewings.get(owner.id, earlyConfirmed.viewing.id).viewing.status,
    "confirmed",
  );
  assert.equal(
    act(visitor.id, earlyConfirmed.viewing, "cancel").viewing.status,
    "cancelled",
  );
  act(visitor.id, next.viewing, "cancel");
  passed(
    "past slots cannot be agreed, exact late retries recover, ended confirmations remain explicit and do not prevent a new request",
  );

  let capped = create(visitor.id, mainConversation, 120);
  while (capped.history.length < 49)
    capped = act(owner.id, capped.viewing, "propose", {
      startsAt: slot(120 + capped.history.length * 15),
      durationMinutes: 60,
      note: `Synthetic revision ${capped.history.length}`,
    });
  const capBefore = store.viewings.get(visitor.id, capped.viewing.id);
  const noOp = act(owner.id, capped.viewing, "propose", {
    startsAt: capped.viewing.startsAt,
    durationMinutes: capped.viewing.durationMinutes,
    note: capped.viewing.note,
  });
  assert.equal(noOp.viewing.version, 49);
  assert.equal(noOp.history.length, 49);
  denied(
    () =>
      act(owner.id, capped.viewing, "propose", {
        startsAt: slot(1000),
        durationMinutes: 60,
      }),
    "LIMIT_REACHED",
  );
  denied(() => act(visitor.id, capped.viewing, "accept"), "LIMIT_REACHED");
  assert.deepEqual(
    store.viewings.get(visitor.id, capped.viewing.id),
    capBefore,
  );
  const terminal = act(visitor.id, capped.viewing, "cancel");
  assert.equal(terminal.history.length, 50);
  assert.equal(terminal.history.at(-1)?.action, "cancel");
  assert.deepEqual(terminal.history.slice(0, 49), capBefore.history);
  passed(
    "event49 preserves the final cancellation slot and rejected changes cannot alter immutable history",
  );

  const currentCount = store.viewings.list(visitor.id, mainConversation, {
    offset: 0,
    limit: 50,
  }).total;
  for (let index = currentCount; index < 50; index++) {
    const value = create(visitor.id, mainConversation, 1800 + index * 60);
    act(owner.id, value.viewing, "decline");
  }
  const atCapacity = store.viewings.list(visitor.id, mainConversation, {
    offset: 0,
    limit: 50,
  });
  assert.equal(atCapacity.total, 50);
  const pagedIds: string[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = savedViewingPageSchema.parse(
      store.viewings.list(visitor.id, mainConversation, { offset, limit: 20 }),
    );
    pagedIds.push(...page.viewings.map((viewing) => viewing.id));
    offset = page.nextOffset;
  }
  assert.equal(new Set(pagedIds).size, 50);
  assert.deepEqual(
    pagedIds,
    atCapacity.viewings.map((viewing) => viewing.id),
  );
  denied(() => create(visitor.id, mainConversation, 10000), "LIMIT_REACHED");
  assert.deepEqual(
    store.viewings.list(visitor.id, mainConversation, { offset: 0, limit: 50 }),
    atCapacity,
  );
  store.close();
  store = undefined;
  store = createAccountStore(path);
  assert.deepEqual(store.viewings.get(visitor.id, terminal.viewing.id), {
    viewing: terminal.viewing,
    history: terminal.history,
  });
  assert.equal(
    store.viewings.act(visitor.id, id, acceptPayload).viewing.status,
    "cancelled",
  );
  denied(() => store!.viewings.get(outsider.id, id), "NOT_FOUND", 404);
  assert.equal(store.accountForSession(visitor.token)?.id, visitor.id);
  passed(
    "50-record lifetime cap is atomic and restart preserves scope, histories and retry receipts",
  );
  console.log(`Viewing independent security smoke passed (${groups} groups).`);
} finally {
  Date.now = realNow;
  store?.close();
  const files = readdirSync(directory);
  assert.ok(files.length <= 3);
  for (const name of files) {
    assert.ok(
      ["viewing.sqlite", "viewing.sqlite-wal", "viewing.sqlite-shm"].includes(
        name,
      ),
    );
    const target = join(directory, name),
      info = lstatSync(target);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1);
    unlinkSync(target);
  }
  rmdirSync(directory);
}
