import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  actOnViewingRequest,
  createInitialPropertyRequestState,
  createViewingRequest,
  discardViewingActionDraft,
  hasViewingActionDraft,
  pendingViewingProposal,
  saveViewingProposal,
  selectViewingRequest,
  setViewingFilter,
  updateViewingActionDraft,
  updateViewingDraft,
  viewingActionDraft,
  type PropertyRequestState,
  type ViewingActionDraft,
} from "../src/components/propertyRequestState";

const now = new Date(2032, 4, 10, 12);
const initial = createInitialPropertyRequestState();
const initialJson = JSON.stringify(initial);
function create(state: PropertyRequestState, propertyId = 1) {
  const result = createViewingRequest(
    updateViewingDraft(state, "tenant", propertyId, {
      date: "2032-05-12",
      time: "14:00",
      note: "A local viewing request",
    }),
    "tenant",
    propertyId,
    now,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}

// Sequential real requests provide an older closed record beside the active one.
const first = create(initial);
const oldPrivate = {
  date: "invalid date",
  time: "",
  note: "Older owner draft",
};
const older = actOnViewingRequest(
  updateViewingActionDraft(first.state, "landlord", first.id, oldPrivate),
  "tenant",
  first.id,
  { type: "cancel" },
  now,
);
const current = create(older);
const id = current.id;
const foreign = create(current.state, 2);
const foreignId = foreign.id;
let base = updateViewingDraft(foreign.state, "tenant", 3, {
  date: "",
  time: "",
  note: "Unsent new request",
});
for (const role of ["tenant", "landlord"] as const)
  base = setViewingFilter(
    selectViewingRequest(base, role, first.id),
    role,
    "History",
  );
const baseJson = JSON.stringify(base);
function read(state: PropertyRequestState, role: Role, requestId = id) {
  const draft = viewingActionDraft(state, role, requestId);
  assert.ok(draft);
  return draft;
}
function record(state: PropertyRequestState, requestId = id) {
  const value = state.viewings.find((item) => item.id === requestId);
  assert.ok(value);
  return value;
}
function update(
  state: PropertyRequestState,
  role: Role,
  patch: Partial<ViewingActionDraft>,
  requestId = id,
) {
  return updateViewingActionDraft(state, role, requestId, patch);
}
function assertPrivateOnly(
  before: PropertyRequestState,
  after: PropertyRequestState,
  role: Role,
  requestId = id,
) {
  assert.equal(
    after.viewings,
    before.viewings,
    "Drafts cannot alter history or agreements",
  );
  assert.equal(after.drafts, before.drafts);
  assert.equal(after.views, before.views);
  assert.equal(after.nextId, before.nextId);
  for (const actor of [
    "tenant",
    "landlord",
    "provider",
    "spaceOperator",
    "admin",
  ] as const)
    if (actor !== role)
      assert.equal(after.actionDrafts?.[actor], before.actionDrafts?.[actor]);
  for (const otherId of [first.id, id, foreignId])
    if (otherId !== requestId)
      assert.equal(
        after.actionDrafts?.[role]?.[otherId],
        before.actionDrafts?.[role]?.[otherId],
      );
}
function assertUnrelatedActionData(
  before: PropertyRequestState,
  after: PropertyRequestState,
  actor: Role,
) {
  assert.equal(after.drafts, before.drafts);
  assert.equal(after.views, before.views);
  assert.equal(after.nextId, before.nextId);
  assert.equal(record(after, first.id), record(before, first.id));
  assert.equal(record(after, foreignId), record(before, foreignId));
  assert.equal(
    after.actionDrafts?.[actor]?.[first.id],
    before.actionDrafts?.[actor]?.[first.id],
  );
  for (const other of ["tenant", "landlord"] as const)
    if (other !== actor)
      assert.equal(after.actionDrafts?.[other], before.actionDrafts?.[other]);
}

// Reads are detached defaults, including terminal records, without materializing drafts.
for (const role of ["tenant", "landlord"] as const) {
  assert.equal(hasViewingActionDraft(base, role, id), false);
  const defaultDraft = read(base, role);
  assert.deepEqual(defaultDraft, {
    date: "2032-05-12",
    time: "14:00",
    note: "",
  });
  defaultDraft.date = "Mutated default";
  defaultDraft.note = "Must not persist";
  assert.equal(read(base, role).date, "2032-05-12");
  assert.equal(read(base, role).note, "");
  assert.equal(discardViewingActionDraft(base, role, id), base);
}
assert.deepEqual(read(base, "landlord", first.id), oldPrivate);
assert.equal(hasViewingActionDraft(base, "landlord", first.id), true);
assert.equal(hasViewingActionDraft(base, "tenant", first.id), false);
assert.equal(read(base, "tenant", first.id).note, "");
assert.equal(JSON.stringify(base), baseJson);

// Recognized raw strings are retained without coercion, trimming, or length loss.
const raw = {
  date: " not a date ",
  time: "25:99",
  note: "  PRIVATE owner\nraw note  ",
};
let retained = update(base, "landlord", raw);
retained = update(retained, "tenant", {
  date: "2033-01-01",
  time: "23:59",
  note: "  PRIVATE tenant cancellation\n  ",
});
assert.deepEqual(read(retained, "landlord"), raw);
assert.deepEqual(read(retained, "tenant"), {
  date: "2032-05-12",
  time: "14:00",
  note: "  PRIVATE tenant cancellation\n  ",
});
assertPrivateOnly(base, update(base, "landlord", raw), "landlord");
assert.equal(update(retained, "landlord", raw), retained);
assert.equal(
  update(retained, "tenant", { note: read(retained, "tenant").note }),
  retained,
);
const returned = read(retained, "landlord");
returned.date = "changed";
returned.time = "00:00";
returned.note = "changed";
assert.deepEqual(read(retained, "landlord"), raw);
const huge = {
  date: "x".repeat(2001),
  time: "y".repeat(2001),
  note: "z".repeat(2001),
};
const hugeState = update(retained, "landlord", huge);
assert.deepEqual(read(hugeState, "landlord"), huge);
const invalidSave = saveViewingProposal(hugeState, "landlord", id, now);
assert.equal(invalidSave.state, hugeState);
assert.equal(invalidSave.proposalId, null);
assert.ok(invalidSave.errors.date);
assert.ok(invalidSave.errors.time);
assert.ok(invalidSave.errors.note);

for (const role of ["tenant", "landlord"] as const) {
  const empty = update(base, role, { note: "" });
  assert.equal(hasViewingActionDraft(empty, role, id), true);
  assert.equal(update(empty, role, { note: "" }), empty);
  assert.deepEqual(read(empty, role), read(base, role));
  assertPrivateOnly(base, empty, role);
  for (const patch of [
    {},
    { unknown: "text" },
    { note: null },
    { note: 7 },
    { date: false, time: undefined, note: {} },
    null,
    undefined,
    "note",
    12,
    Object.create({ note: "inherited" }) as unknown,
  ]) {
    assert.equal(
      update(base, role, patch as Partial<ViewingActionDraft>),
      base,
    );
    assert.equal(
      update(retained, role, patch as Partial<ViewingActionDraft>),
      retained,
    );
  }
}
assert.equal(
  update(base, "tenant", { date: "2033-01-01", time: "16:00" }),
  base,
);
const mixed = update(base, "landlord", {
  date: 3,
  time: "",
  note: " raw ",
} as unknown as Partial<ViewingActionDraft>);
assert.deepEqual(read(mixed, "landlord"), {
  date: "2032-05-12",
  time: "",
  note: " raw ",
});

// A proposal saves exact public terms and consumes only the submitting actor's draft.
const proposalInput = update(retained, "landlord", {
  date: "2032-05-13",
  time: "15:30",
  note: "  A different appointment works better.\n ",
});
const proposalInputJson = JSON.stringify(proposalInput);
const saved = saveViewingProposal(proposalInput, "landlord", id, now);
assert.equal(saved.issue, null);
assert.deepEqual(saved.errors, {});
assert.ok(saved.proposalId);
const proposed = saved.state;
const proposal = pendingViewingProposal(record(proposed))!;
assert.equal(proposal.id, saved.proposalId);
assert.deepEqual(proposal.terms, { date: "2032-05-13", time: "15:30" });
assert.equal(proposal.note, "A different appointment works better.");
assert.equal(hasViewingActionDraft(proposed, "landlord", id), false);
assert.equal(hasViewingActionDraft(proposed, "tenant", id), true);
assertUnrelatedActionData(proposalInput, proposed, "landlord");
assert.deepEqual(read(proposed, "landlord"), { ...proposal.terms, note: "" });
assert.equal(JSON.stringify(proposalInput), proposalInputJson);

// Immediate decisions publish no private text and preserve even incomplete drafts.
const immediateAccepted = actOnViewingRequest(
  hugeState,
  "landlord",
  id,
  { type: "accept-request" },
  now,
);
assert.equal(record(immediateAccepted).status, "Agreed");
assert.equal(immediateAccepted.actionDrafts, hugeState.actionDrafts);
assert.equal(record(immediateAccepted).history.at(-1)!.note, undefined);
assert.deepEqual(
  record(immediateAccepted).agreedTerms,
  record(hugeState).requestedTerms,
);
for (const type of ["accept-proposal", "decline-proposal"] as const) {
  const prepared = update(update(proposed, "landlord", raw), "tenant", {
    note: "PRIVATE cancellation ".repeat(100),
  });
  const decided = actOnViewingRequest(
    prepared,
    "tenant",
    id,
    { type, proposalId: proposal.id },
    now,
  );
  assert.notEqual(decided, prepared);
  assert.equal(decided.actionDrafts, prepared.actionDrafts);
  assert.equal(record(decided).history.at(-1)!.note, undefined);
  assert.equal(
    JSON.stringify(record(decided).history).includes("PRIVATE"),
    false,
  );
  assert.equal(
    record(decided).status,
    type === "accept-proposal" ? "Agreed" : "Pending",
  );
}

// Explicit cancellation/refusal consumes the actor, keeping the other party's draft recoverable.
for (const scenario of [
  { state: retained, actor: "landlord", type: "decline-request" },
  { state: retained, actor: "tenant", type: "cancel" },
  { state: immediateAccepted, actor: "landlord", type: "cancel" },
  { state: immediateAccepted, actor: "tenant", type: "cancel" },
] as const) {
  const prepared = update(scenario.state, scenario.actor, {
    note: "  Explicit local reason.\n ",
  });
  const preparedJson = JSON.stringify(prepared);
  const closed = actOnViewingRequest(
    prepared,
    scenario.actor,
    id,
    { type: scenario.type },
    now,
  );
  assert.equal(
    record(closed).status,
    scenario.type === "cancel" ? "Cancelled" : "Declined",
  );
  assert.equal(record(closed).history.at(-1)!.note, "Explicit local reason.");
  assert.equal(hasViewingActionDraft(closed, scenario.actor, id), false);
  assertUnrelatedActionData(prepared, closed, scenario.actor);
  const other = scenario.actor === "landlord" ? "tenant" : "landlord";
  assert.equal(hasViewingActionDraft(closed, other, id), true);
  assert.deepEqual(read(closed, other), read(prepared, other));
  for (const role of ["tenant", "landlord"] as const) {
    assert.equal(
      update(closed, role, {
        date: "2032-05-15",
        time: "10:00",
        note: "No closed changes",
      }),
      closed,
    );
    assert.equal(saveViewingProposal(closed, role, id, now).state, closed);
    assert.equal(
      actOnViewingRequest(closed, role, id, { type: "cancel" }, now),
      closed,
    );
  }
  const discarded = discardViewingActionDraft(closed, other, id);
  assert.equal(hasViewingActionDraft(discarded, other, id), false);
  assert.equal(discardViewingActionDraft(discarded, other, id), discarded);
  assertPrivateOnly(closed, discarded, other);
  assert.equal(record(discarded).agreedTerms, record(closed).agreedTerms);
  assert.equal(record(discarded).history, record(closed).history);
  assert.equal(JSON.stringify(prepared), preparedJson);
}
const absentCancellation = actOnViewingRequest(
  base,
  "tenant",
  id,
  { type: "cancel" },
  now,
);
assert.equal(record(absentCancellation).status, "Cancelled");
assert.equal(absentCancellation.actionDrafts, base.actionDrafts);

// Failed actions and stale proposal IDs cannot clear any retained draft.
for (const type of ["decline-request", "cancel"] as const) {
  for (const note of ["", "  ", "ab", "x".repeat(1001)]) {
    const invalid = update(retained, "landlord", { note });
    assert.equal(
      actOnViewingRequest(invalid, "landlord", id, { type }, now),
      invalid,
    );
  }
}
const secondInput = update(proposed, "landlord", {
  date: "2032-05-14",
  time: "11:00",
  note: "A newer proposed appointment",
});
const second = saveViewingProposal(secondInput, "landlord", id, now);
assert.ok(second.proposalId);
assert.notEqual(second.proposalId, proposal.id);
const withRaw = update(second.state, "landlord", raw);
for (const type of ["accept-proposal", "decline-proposal"] as const)
  assert.equal(
    actOnViewingRequest(
      withRaw,
      "tenant",
      id,
      { type, proposalId: proposal.id },
      now,
    ),
    withRaw,
  );
const noChange = update(proposed, "landlord", {
  note: "Retain this invalid retry",
});
assert.equal(
  saveViewingProposal(noChange, "landlord", id, now).state,
  noChange,
);
assert.equal(
  saveViewingProposal(noChange, "landlord", id, now).errors.time,
  "noChanges",
);

// Discard is exact and scoped even when visible filters hide the target record.
const discardedOwner = discardViewingActionDraft(retained, "landlord", id);
assertPrivateOnly(retained, discardedOwner, "landlord");
assert.equal(hasViewingActionDraft(discardedOwner, "landlord", id), false);
assert.equal(hasViewingActionDraft(discardedOwner, "landlord", first.id), true);
const discardedOlder = discardViewingActionDraft(
  retained,
  "landlord",
  first.id,
);
assertPrivateOnly(retained, discardedOlder, "landlord", first.id);
assert.equal(
  hasViewingActionDraft(discardedOlder, "landlord", first.id),
  false,
);
assert.deepEqual(read(discardedOlder, "landlord"), raw);

for (const role of [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "invalid" as Role,
] as const) {
  assert.equal(viewingActionDraft(retained, role, "missing"), null);
  assert.equal(hasViewingActionDraft(retained, role, "missing"), false);
  assert.equal(update(retained, role, raw, "missing"), retained);
  assert.equal(discardViewingActionDraft(retained, role, "missing"), retained);
  if (role === "tenant" || role === "landlord") continue;
  assert.equal(viewingActionDraft(retained, role, id), null);
  assert.equal(hasViewingActionDraft(retained, role, id), false);
  assert.equal(update(retained, role, raw), retained);
  assert.equal(discardViewingActionDraft(retained, role, id), retained);
}
assert.equal(viewingActionDraft(retained, "landlord", foreignId), null);
assert.equal(hasViewingActionDraft(retained, "landlord", foreignId), false);
assert.equal(update(retained, "landlord", raw, foreignId), retained);
assert.equal(
  discardViewingActionDraft(retained, "landlord", foreignId),
  retained,
);
const foreignTenantDraft = update(
  retained,
  "tenant",
  { note: "My other property request" },
  foreignId,
);
assert.equal(
  hasViewingActionDraft(foreignTenantDraft, "tenant", foreignId),
  true,
);
assertPrivateOnly(retained, foreignTenantDraft, "tenant", foreignId);

// Matching display names cannot override a conflicting tenant ID or property ownership.
for (const test of [
  { patch: { tenantId: "another-tenant" }, roles: ["tenant"] },
  { patch: { propertyId: 2 }, roles: ["landlord"] },
  { patch: { propertyId: 999 }, roles: ["tenant", "landlord"] },
  { patch: { role: "landlord" as Role }, roles: ["tenant", "landlord"] },
]) {
  const changed = {
    ...retained,
    viewings: retained.viewings.map((item) =>
      item.id === id ? { ...item, ...test.patch } : item,
    ),
  };
  for (const role of test.roles as Role[]) {
    assert.equal(viewingActionDraft(changed, role, id), null);
    assert.equal(hasViewingActionDraft(changed, role, id), false);
    assert.equal(update(changed, role, raw), changed);
    assert.equal(discardViewingActionDraft(changed, role, id), changed);
  }
}
assert.equal(JSON.stringify(initial), initialJson);
assert.equal(JSON.stringify(base), baseJson);
console.log("Viewing action draft checks passed.");
