import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  actOnViewingRequest,
  createInitialPropertyRequestState,
  createViewingRequest,
  saveViewingProposal,
  selectedViewingRequest,
  selectViewingRequest,
  selectVisibleViewingRequest,
  setViewingFilter,
  updateViewingActionDraft,
  updateViewingDraft,
  viewingView,
  visibleViewingRequests,
  type PropertyRequestState,
  type ViewingFilter,
} from "../src/components/propertyRequestState";

const createdAt = new Date(2026, 9, 2, 12);
const now = new Date(2026, 9, 4, 12);

function request(
  state: PropertyRequestState,
  propertyId: number,
  date: string,
  at: Date,
  time = "14:30",
) {
  const result = createViewingRequest(
    updateViewingDraft(state, "tenant", propertyId, {
      date,
      time,
      note: "Local viewing request",
    }),
    "tenant",
    propertyId,
    at,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}

// Real sequential requests leave two terminal records and an elapsed agreement.
const first = request(
  createInitialPropertyRequestState(),
  1,
  "2026-10-03",
  createdAt,
);
const declined = actOnViewingRequest(
  updateViewingActionDraft(first.state, "landlord", first.id, {
    note: "That time is unavailable.",
  }),
  "landlord",
  first.id,
  { type: "decline-request" },
  createdAt,
);
assert.equal(declined.viewings[0].status, "Declined");
const second = request(declined, 1, "2026-10-03", createdAt);
const cancelled = actOnViewingRequest(
  second.state,
  "tenant",
  second.id,
  { type: "cancel" },
  createdAt,
);
assert.equal(cancelled.viewings.at(-1)!.status, "Cancelled");
const third = request(cancelled, 1, "2026-10-03", createdAt);
const elapsedAgreement = actOnViewingRequest(
  third.state,
  "landlord",
  third.id,
  { type: "accept-request" },
  createdAt,
);
assert.equal(elapsedAgreement.viewings.at(-1)!.status, "Agreed");
const current = request(elapsedAgreement, 1, "2026-10-05", now);
const foreignHome = request(current.state, 2, "2026-10-05", now);
let pending = updateViewingDraft(foreignHome.state, "tenant", 3, {
  date: "",
  time: "",
  note: "  Unsent request  ",
});
for (const role of ["tenant", "landlord"] as const) {
  pending = updateViewingActionDraft(pending, role, current.id, {
    note: `Private ${role} action draft`,
  });
  pending = selectViewingRequest(pending, role, first.id);
  pending = setViewingFilter(pending, role, "History");
}
const agreed = actOnViewingRequest(
  pending,
  "landlord",
  current.id,
  { type: "accept-request" },
  now,
);
assert.equal(
  agreed.viewings.find((row) => row.id === current.id)!.status,
  "Agreed",
);
function propose(state: PropertyRequestState) {
  const result = saveViewingProposal(
    updateViewingActionDraft(state, "landlord", current.id, {
      date: "2026-10-06",
      time: "16:00",
      note: "Please consider this later appointment.",
    }),
    "landlord",
    current.id,
    now,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.proposalId);
  return result.state;
}
const proposed = propose(pending);
const rescheduled = propose(agreed);

function checkSelection(
  source: PropertyRequestState,
  role: "tenant" | "landlord",
  filter: ViewingFilter,
  id: string,
  at = now,
) {
  const anchor = id === first.id ? second.id : first.id;
  const state = setViewingFilter(
    selectViewingRequest(source, role, anchor),
    role,
    filter,
  );
  const before = structuredClone(state);
  const visibleIds = visibleViewingRequests(state, role, at).map(
    (row) => row.id,
  );
  assert.ok(
    visibleIds.includes(id),
    `${role} ${filter}: expected visible fixture`,
  );
  const selected = selectVisibleViewingRequest(state, role, id, at);
  assert.notEqual(selected, state);
  assert.deepEqual(viewingView(selected, role), { filter, selectedId: id });
  assert.equal(selectedViewingRequest(selected, role, at)?.id, id);
  assert.deepEqual(
    visibleViewingRequests(selected, role, at).map((row) => row.id),
    visibleIds,
  );
  assert.equal(selected.viewings, state.viewings);
  assert.equal(selected.drafts, state.drafts);
  assert.equal(selected.actionDrafts, state.actionDrafts);
  assert.equal(selected.nextId, state.nextId);
  const otherRole = role === "tenant" ? "landlord" : "tenant";
  assert.equal(selected.views?.[otherRole], state.views?.[otherRole]);
  assert.deepEqual(state, before, "Row selection must not mutate its input");
  assert.equal(
    selectVisibleViewingRequest(selected, role, id, at),
    selected,
    "Repeated selection is an identity no-op",
  );
  return selected;
}

for (const role of ["tenant", "landlord"] as const) {
  for (const [state, filter, id, hiddenId] of [
    [pending, "All", current.id, null],
    [pending, "Pending", current.id, first.id],
    [proposed, "Proposed", current.id, first.id],
    [agreed, "Agreed", current.id, first.id],
    [pending, "History", first.id, current.id],
  ] as const) {
    const selected = checkSelection(state, role, filter, id);
    if (hiddenId) {
      assert.equal(
        selectVisibleViewingRequest(selected, role, hiddenId, now),
        selected,
        `${role} ${filter}: hidden row cannot change the filter or selection`,
      );
    }
  }
  checkSelection(pending, role, "History", third.id);
  checkSelection(rescheduled, role, "Proposed", current.id);
  checkSelection(rescheduled, role, "Agreed", current.id);

  // A row rendered just before the appointment cannot be selected from Agreed
  // at or after expiry, even if the same ID was previously selected there.
  const appointment = new Date(2026, 9, 5, 14, 30);
  const before = new Date(appointment.getTime() - 1);
  checkSelection(agreed, role, "Agreed", current.id, before);
  const historyBefore = setViewingFilter(agreed, role, "History");
  assert.equal(
    selectVisibleViewingRequest(historyBefore, role, current.id, before),
    historyBefore,
  );
  for (const at of [appointment, new Date(appointment.getTime() + 1)]) {
    const upcoming = setViewingFilter(agreed, role, "Agreed");
    assert.equal(
      selectVisibleViewingRequest(upcoming, role, current.id, at),
      upcoming,
    );
    checkSelection(agreed, role, "History", current.id, at);
    checkSelection(agreed, role, "All", current.id, at);
    checkSelection(rescheduled, role, "Proposed", current.id, at);
    for (const filter of ["Agreed", "History"] as const) {
      const filtered = setViewingFilter(rescheduled, role, filter);
      assert.equal(
        selectVisibleViewingRequest(filtered, role, current.id, at),
        filtered,
        "A pending time change neither extends the old agreement nor becomes an agreed history record",
      );
    }
  }

  const filtered = setViewingFilter(pending, role, "History");
  assert.equal(
    selectVisibleViewingRequest(filtered, role, current.id, now),
    filtered,
  );
  const revealed = selectViewingRequest(filtered, role, current.id);
  assert.deepEqual(
    viewingView(revealed, role),
    { filter: "All", selectedId: current.id },
    "External handoffs still deliberately reveal the exact scoped record",
  );
  assert.equal(revealed.viewings, filtered.viewings);
  assert.equal(revealed.drafts, filtered.drafts);
  assert.equal(revealed.actionDrafts, filtered.actionDrafts);
}

const allOwner = setViewingFilter(pending, "landlord", "All");
assert.equal(
  selectVisibleViewingRequest(allOwner, "landlord", foreignHome.id, now),
  allOwner,
);
checkSelection(pending, "tenant", "Pending", foreignHome.id);
const ownRecord = pending.viewings.find((row) => row.id === current.id)!;
const foreignTenant = {
  ...ownRecord,
  id: "foreign-tenant-request",
  tenantId: "another-tenant",
};
const scoped: PropertyRequestState = {
  ...pending,
  viewings: [...pending.viewings, foreignTenant],
};
const allTenant = setViewingFilter(scoped, "tenant", "All");
assert.equal(
  selectVisibleViewingRequest(allTenant, "tenant", foreignTenant.id, now),
  allTenant,
  "Display name does not grant tenant access",
);
checkSelection(scoped, "landlord", "Pending", foreignTenant.id);
for (const role of [
  "provider",
  "spaceOperator",
  "admin",
  "invalid",
] as Role[]) {
  assert.equal(
    selectVisibleViewingRequest(scoped, role, current.id, now),
    scoped,
  );
}
for (const role of ["tenant", "landlord"] as const) {
  const all = setViewingFilter(pending, role, "All");
  for (const id of [
    "",
    "missing-request",
    ` ${current.id} `,
    1 as unknown as string,
  ]) {
    assert.equal(selectVisibleViewingRequest(all, role, id, now), all);
  }
  const empty = createInitialPropertyRequestState();
  assert.equal(
    selectVisibleViewingRequest(empty, role, current.id, now),
    empty,
  );
  for (const invalidRecord of [
    { ...ownRecord, propertyId: 999 },
    { ...ownRecord, role: "admin" as const },
  ]) {
    const invalid: PropertyRequestState = { viewings: [invalidRecord] };
    assert.equal(
      selectVisibleViewingRequest(invalid, role, invalidRecord.id, now),
      invalid,
    );
  }
}

console.log(
  "Viewing selection checks passed: retained filters, scoped rows, exact expiry, draft isolation, and explicit reveal.",
);
