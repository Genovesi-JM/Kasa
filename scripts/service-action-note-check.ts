import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markNotificationRead,
} from "../src/components/notificationState";
import { reconcileServiceNotifications } from "../src/components/serviceNotifications";
import {
  actOnServiceRequest,
  applyServiceActionCommand,
  createInitialServiceRequestState,
  discardServiceActionNoteDraft,
  hasServiceActionNoteDraft,
  latestServiceQuote,
  saveServiceQuote,
  serviceActionNoteDraft,
  serviceActionNoteDrafts,
  updateServiceActionNote,
  updateServiceActionNoteDraft,
  updateServiceQuoteDraft,
  workspaceServiceProvider,
  type ServiceActionCommand,
  type ServiceNoteTarget,
  type ServiceRequestAction,
  type ServiceRequestState,
} from "../src/components/serviceRequestState";
import type { Role } from "../src/types";

const now = new Date(2032, 4, 10, 12);
const initial = createInitialServiceRequestState(now);
const initialJson = JSON.stringify(initial);
const id = initial.records.find(
  (item) =>
    item.customerRole === "tenant" &&
    item.providerName === workspaceServiceProvider,
)!.id;
const otherId = initial.records.find(
  (item) => item.customerRole === "landlord",
)!.id;
const foreignId = initial.records.find(
  (item) => item.providerName !== workspaceServiceProvider,
)!.id;
const refusal = { type: "decline-request" } as const;
const cancellation = { type: "cancel" } as const;
const completion = { type: "complete" } as const;
const providerText =
  "  PRIVATE_REFUSAL: unfinished refusal\nnot a completion report.  ";
const customerText = "  PRIVATE_CANCEL: unfinished cancellation reason.  ";
const quoteText = " PRIVATE_Q1: unfinished reason for this particular quote ";
function record(state: ServiceRequestState, target = id) {
  const result = state.records.find((item) => item.id === target);
  assert.ok(result);
  return result;
}
function read(
  state: ServiceRequestState,
  role: Role,
  target: ServiceNoteTarget,
  requestId = id,
) {
  const result = serviceActionNoteDraft(state, role, requestId, target);
  assert.ok(result);
  return result;
}
function put(
  state: ServiceRequestState,
  role: Role,
  target: ServiceNoteTarget,
  note: string,
  requestId = id,
) {
  return updateServiceActionNoteDraft(state, role, requestId, target, note);
}
function quote(state: ServiceRequestState, amount = "125.50", requestId = id) {
  const result = saveServiceQuote(
    updateServiceQuoteDraft(state, "provider", requestId, {
      amount,
      scope:
        "Inspect and repair the outlet, including labour and all agreed materials.",
      date: "2032-05-12",
      time: "14:00",
      validUntil: "2032-05-11",
    }),
    "provider",
    requestId,
    now,
  );
  assert.equal(result.issue, undefined);
  assert.deepEqual(result.errors, {});
  return result.state;
}
function assertDraftOnly(
  before: ServiceRequestState,
  after: ServiceRequestState,
) {
  assert.equal(after.records, before.records);
  assert.equal(after.drafts, before.drafts);
  assert.equal(after.quoteDrafts, before.quoteDrafts);
  assert.equal(after.views, before.views);
  assert.equal(after.nextId, before.nextId);
  assert.equal(after.actionReceipt, before.actionReceipt);
  let feed = reconcileServiceNotifications(
    createInitialNotificationState(),
    before,
  );
  const firstEvent = feed.items.find((item) => item.serviceEvent);
  if (firstEvent)
    feed = markNotificationRead(feed, firstEvent.role, firstEvent.id);
  assert.equal(reconcileServiceNotifications(feed, after), feed);
}

// Active defaults are detached and do not insert work; inactive purposes never borrow text.
assert.deepEqual(read(initial, "provider", refusal), {
  target: refusal,
  note: "",
  editable: true,
});
assert.deepEqual(read(initial, "tenant", cancellation), {
  target: cancellation,
  note: "",
  editable: true,
});
assert.equal(serviceActionNoteDraft(initial, "provider", id, completion), null);
assert.equal(
  serviceActionNoteDraft(initial, "tenant", id, {
    type: "decline",
    quoteId: "missing",
  }),
  null,
);
assert.deepEqual(serviceActionNoteDrafts(initial, "provider", id), []);
assert.equal(
  hasServiceActionNoteDraft(initial, "provider", id, refusal),
  false,
);
assert.equal(
  discardServiceActionNoteDraft(initial, "provider", id, refusal),
  initial,
);
const defaultRead = read(initial, "provider", refusal);
Object.assign(defaultRead, { note: "Do not retain a read" });
Object.assign(defaultRead.target!, { type: "complete" });
assert.deepEqual(read(initial, "provider", refusal), {
  target: refusal,
  note: "",
  editable: true,
});
assert.equal(JSON.stringify(initial), initialJson);
const blank = put(initial, "provider", refusal, "");
assert.equal(hasServiceActionNoteDraft(blank, "provider", id, refusal), true);
assert.equal(read(blank, "provider", refusal).note, "");
assert.equal(put(blank, "provider", refusal, ""), blank);
assert.equal(serviceActionNoteDrafts(blank, "provider", id).length, 1);
assertDraftOnly(initial, blank);
assert.equal(put(initial, "provider", completion, "Wrong phase"), initial);
for (const value of [null, undefined, 12, {}, "x".repeat(2001)])
  assert.equal(put(initial, "provider", refusal, value as string), initial);
assert.equal(
  read(put(initial, "provider", refusal, "x".repeat(2000)), "provider", refusal)
    .note.length,
  2000,
);

let requested = put(initial, "provider", refusal, providerText);
requested = put(requested, "tenant", cancellation, customerText);
requested = put(
  requested,
  "provider",
  refusal,
  "PRIVATE other request provider note",
  otherId,
);
requested = put(
  requested,
  "landlord",
  cancellation,
  "PRIVATE owner cancellation note",
  otherId,
);
assert.equal(read(requested, "provider", refusal).note, providerText);
assert.equal(read(requested, "tenant", cancellation).note, customerText);
assertDraftOnly(initial, requested);
const returned = read(requested, "provider", refusal);
Object.assign(returned, { note: "Changed outside the helper" });
Object.assign(returned.target!, { type: "complete" });
const returnedList = serviceActionNoteDrafts(requested, "provider", id);
Object.assign(returnedList[0], { note: "Changed through list" });
Object.assign(returnedList[0].target!, { type: "complete" });
assert.equal(read(requested, "provider", refusal).note, providerText);
assert.deepEqual(read(requested, "provider", refusal).target, refusal);

// Publishing a quote leaves a prior refusal draft private and read-only.
const published = quote(requested);
const q1 = latestServiceQuote(record(published))!;
const declineQ1 = { type: "decline", quoteId: q1.id } as const;
assert.equal(read(published, "provider", refusal).note, providerText);
assert.equal(read(published, "provider", refusal).editable, false);
assert.equal(
  put(published, "provider", refusal, "Cannot rewrite inactive purpose"),
  published,
);
assert.equal(read(published, "tenant", declineQ1).note, "");
const quoted = put(published, "tenant", declineQ1, quoteText);
assertDraftOnly(published, quoted);
const detachedQuote = read(quoted, "tenant", declineQ1);
Object.assign(detachedQuote.target!, {
  quoteId: "Do not redirect stored draft",
});
assert.deepEqual(read(quoted, "tenant", declineQ1).target, declineQ1);
assert.equal(read(quoted, "tenant", cancellation).note, customerText);

// Neither no-note action discards or silently republishes any unfinished text.
const accepted = applyServiceActionCommand(quoted, {
  token: "accept-preserves-notes",
  role: "tenant",
  requestId: id,
  action: { type: "accept", quoteId: q1.id },
  at: now.getTime(),
});
assert.equal(record(accepted).status, "Accepted");
assert.equal(accepted.actionNoteDrafts, quoted.actionNoteDrafts);
assert.equal(read(accepted, "tenant", cancellation).note, customerText);
assert.equal(read(accepted, "tenant", declineQ1).note, quoteText);
assert.equal(read(accepted, "tenant", declineQ1).editable, false);
assert.equal(record(accepted).history.at(-1)!.note, undefined);
const inProgress = applyServiceActionCommand(accepted, {
  token: "start-preserves-notes",
  role: "provider",
  requestId: id,
  action: { type: "start" },
  at: now.getTime(),
});
assert.equal(record(inProgress).status, "In progress");
assert.equal(inProgress.actionNoteDrafts, accepted.actionNoteDrafts);
assert.equal(read(inProgress, "provider", refusal).note, providerText);
assert.equal(read(inProgress, "provider", refusal).editable, false);
assert.equal(read(inProgress, "provider", completion).note, "");
assert.equal(read(inProgress, "provider", completion).editable, true);
assert.equal(
  hasServiceActionNoteDraft(inProgress, "provider", id, completion),
  false,
);
assert.equal(read(inProgress, "tenant", cancellation).editable, false);
assert.equal(record(inProgress).history.at(-1)!.note, undefined);
const emptyCompletion = applyServiceActionCommand(inProgress, {
  token: "completion-does-not-borrow-refusal",
  role: "provider",
  requestId: id,
  action: { type: "complete", note: "" },
  at: now.getTime(),
});
assert.equal(emptyCompletion.actionReceipt?.issue, "note");
assert.equal(emptyCompletion.records, inProgress.records);
assert.equal(emptyCompletion.actionNoteDrafts, inProgress.actionNoteDrafts);

// Each reason action consumes only its target when its retained text still matches.
const reasonCases: Array<{
  state: ServiceRequestState;
  role: Role;
  target: ServiceNoteTarget;
  action: (note: string) => ServiceRequestAction;
}> = [
  {
    state: requested,
    role: "provider",
    target: refusal,
    action: (note) => ({ type: "decline-request", note }),
  },
  {
    state: quoted,
    role: "tenant",
    target: cancellation,
    action: (note) => ({ type: "cancel", note }),
  },
  {
    state: quoted,
    role: "tenant",
    target: declineQ1,
    action: (note) => ({ type: "decline", quoteId: q1.id, note }),
  },
  {
    state: inProgress,
    role: "provider",
    target: completion,
    action: (note) => ({ type: "complete", note }),
  },
];
for (const [index, test] of reasonCases.entries()) {
  const submitted = "Explicit submitted reason";
  const retained = put(test.state, test.role, test.target, `  ${submitted}\n `);
  const before = JSON.stringify(retained);
  for (const note of ["", "  ", "ab", "x".repeat(2001)]) {
    assert.equal(
      actOnServiceRequest(retained, test.role, id, test.action(note), now),
      retained,
    );
    assert.equal(
      read(retained, test.role, test.target).note,
      `  ${submitted}\n `,
    );
  }
  for (const newerText of [false, true]) {
    const capturedCommand: ServiceActionCommand = {
      token: `reason-${index}-${newerText}`,
      role: test.role,
      requestId: id,
      action: test.action(` ${submitted} `),
      at: now.getTime(),
    };
    const current = newerText
      ? put(retained, test.role, test.target, "PRIVATE newer unsent text")
      : retained;
    const result = applyServiceActionCommand(current, capturedCommand);
    assert.equal(result.actionReceipt?.issue, null);
    assert.ok(result.actionReceipt?.eventId);
    assert.equal(record(result).history.at(-1)!.note, submitted);
    assert.equal(
      hasServiceActionNoteDraft(result, test.role, id, test.target),
      newerText,
    );
    if (newerText)
      assert.equal(
        read(result, test.role, test.target).note,
        "PRIVATE newer unsent text",
      );
    assert.equal(result.quoteDrafts, current.quoteDrafts);
    assert.equal(result.drafts, current.drafts);
    assert.equal(
      result.actionNoteDrafts?.[test.role]?.[otherId],
      current.actionNoteDrafts?.[test.role]?.[otherId],
    );
    for (const role of [
      "tenant",
      "landlord",
      "provider",
      "spaceOperator",
      "admin",
    ] as const)
      if (role !== test.role)
        assert.equal(
          result.actionNoteDrafts?.[role],
          current.actionNoteDrafts?.[role],
        );
    const remaining = serviceActionNoteDrafts(current, test.role, id).filter(
      (item) => JSON.stringify(item.target) !== JSON.stringify(test.target),
    );
    for (const expected of remaining) {
      assert.ok(
        serviceActionNoteDrafts(result, test.role, id).some(
          (item) =>
            JSON.stringify(item.target) === JSON.stringify(expected.target) &&
            item.note === expected.note,
        ),
      );
    }
    const feed = reconcileServiceNotifications(
      createInitialNotificationState(),
      result,
    );
    assert.equal(JSON.stringify(feed).includes("PRIVATE newer"), false);
  }
  assert.equal(JSON.stringify(retained), before);
}
const sameTextTargets = put(
  put(quoted, "tenant", cancellation, "Same text, separate intent"),
  "tenant",
  declineQ1,
  "Same text, separate intent",
);
const declinedOnly = actOnServiceRequest(
  sameTextTargets,
  "tenant",
  id,
  { type: "decline", quoteId: q1.id, note: "Same text, separate intent" },
  now,
);
assert.equal(
  hasServiceActionNoteDraft(declinedOnly, "tenant", id, declineQ1),
  false,
);
assert.equal(
  read(declinedOnly, "tenant", cancellation).note,
  "Same text, separate intent",
);

// Replacing Q1 with Q2 never turns Q1's private reason into a decision on Q2.
const revised = quote(quoted, "140");
const q2 = latestServiceQuote(record(revised))!;
const declineQ2 = { type: "decline", quoteId: q2.id } as const;
assert.notEqual(q1.id, q2.id);
assert.equal(read(revised, "tenant", declineQ1).note, quoteText);
assert.equal(read(revised, "tenant", declineQ1).editable, false);
assert.equal(read(revised, "tenant", declineQ2).note, "");
assert.equal(read(revised, "tenant", declineQ2).editable, true);
assert.equal(
  put(revised, "tenant", declineQ1, "Do not change historical intent"),
  revised,
);
assert.equal(
  actOnServiceRequest(
    revised,
    "tenant",
    id,
    { type: "decline", quoteId: q1.id, note: quoteText },
    now,
  ),
  revised,
);
const withQ2 = put(revised, "tenant", declineQ2, "PRIVATE Q2 reason");
assert.equal(read(withQ2, "tenant", declineQ1).note, quoteText);
assert.equal(read(withQ2, "tenant", declineQ2).note, "PRIVATE Q2 reason");
const withoutQ1 = discardServiceActionNoteDraft(
  withQ2,
  "tenant",
  id,
  declineQ1,
);
assert.equal(
  hasServiceActionNoteDraft(withoutQ1, "tenant", id, declineQ1),
  false,
);
assert.equal(read(withoutQ1, "tenant", declineQ2).note, "PRIVATE Q2 reason");
assert.equal(read(withoutQ1, "tenant", cancellation).note, customerText);
assertDraftOnly(withQ2, withoutQ1);
assert.equal(
  discardServiceActionNoteDraft(withoutQ1, "tenant", id, declineQ1),
  withoutQ1,
);

// Terminal records keep inactive notes readable and exactly discardable, without shared effects.
const completed = actOnServiceRequest(
  put(inProgress, "provider", completion, "Completion text"),
  "provider",
  id,
  { type: "complete", note: "Completion text" },
  now,
);
const cancelled = actOnServiceRequest(
  quoted,
  "tenant",
  id,
  { type: "cancel", note: "Different actual cancellation" },
  now,
);
const refused = actOnServiceRequest(
  requested,
  "provider",
  id,
  { type: "decline-request", note: "Different actual refusal" },
  now,
);
for (const state of [completed, cancelled, refused]) {
  for (const [role, target, text] of [
    ["provider", refusal, providerText],
    ["tenant", cancellation, customerText],
  ] as const) {
    assert.equal(read(state, role, target).editable, false);
    assert.equal(read(state, role, target).note, text);
    assert.equal(
      put(state, role, target, "Cannot rewrite inactive notes"),
      state,
    );
    const discarded = discardServiceActionNoteDraft(state, role, id, target);
    assert.equal(hasServiceActionNoteDraft(discarded, role, id, target), false);
    assertDraftOnly(state, discarded);
  }
}

// Old generic values have no safe inferred purpose and remain opaque/read-only until discarded.
assert.equal(hasServiceActionNoteDraft(initial, "provider", id, null), false);
assert.equal(
  discardServiceActionNoteDraft(initial, "provider", id, null),
  initial,
);
for (const raw of ["", " \n\t "]) {
  const retained = updateServiceActionNote(initial, "provider", id, raw);
  assert.equal(hasServiceActionNoteDraft(retained, "provider", id, null), true);
  assert.deepEqual(serviceActionNoteDrafts(retained, "provider", id), [
    { target: null, note: raw, editable: false },
  ]);
  assert.equal(read(retained, "provider", refusal).note, "");
  const discarded = discardServiceActionNoteDraft(
    retained,
    "provider",
    id,
    null,
  );
  assert.equal(
    hasServiceActionNoteDraft(discarded, "provider", id, null),
    false,
  );
  assert.deepEqual(serviceActionNoteDrafts(discarded, "provider", id), []);
  assertDraftOnly(retained, discarded);
}
let legacy = updateServiceActionNote(
  initial,
  "provider",
  id,
  "PRIVATE legacy ambiguous provider note",
);
legacy = updateServiceActionNote(
  legacy,
  "tenant",
  id,
  "PRIVATE legacy ambiguous customer note",
);
assert.equal(read(legacy, "provider", refusal).note, "");
assert.equal(read(legacy, "tenant", cancellation).note, "");
assert.ok(
  serviceActionNoteDrafts(legacy, "provider", id).some(
    (item) =>
      item.target === null &&
      item.note === "PRIVATE legacy ambiguous provider note" &&
      !item.editable,
  ),
);
assert.equal(hasServiceActionNoteDraft(legacy, "provider", id, null), true);
const legacyRefused = actOnServiceRequest(
  legacy,
  "provider",
  id,
  { type: "decline-request", note: "PRIVATE legacy ambiguous provider note" },
  now,
);
assert.equal(legacyRefused.actionNotes, legacy.actionNotes);
const legacyWithNew = put(
  legacy,
  "provider",
  refusal,
  "A classified new refusal draft",
);
const legacyDiscarded = discardServiceActionNoteDraft(
  legacyWithNew,
  "provider",
  id,
  null,
);
assert.equal(
  hasServiceActionNoteDraft(legacyDiscarded, "provider", id, null),
  false,
);
assert.equal(
  read(legacyDiscarded, "provider", refusal).note,
  "A classified new refusal draft",
);
assert.equal(
  legacyDiscarded.actionNotes.tenant,
  legacyWithNew.actionNotes.tenant,
);
assertDraftOnly(legacyWithNew, legacyDiscarded);

// The request, exact quote and actor must all belong to the intended workspace.
for (const role of [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
  "unknown" as Role,
] as const) {
  if (role !== "provider") {
    assert.equal(serviceActionNoteDraft(requested, role, id, refusal), null);
    assert.equal(
      hasServiceActionNoteDraft(requested, role, id, refusal),
      false,
    );
    assert.equal(put(requested, role, refusal, "Wrong role"), requested);
    assert.equal(
      discardServiceActionNoteDraft(requested, role, id, refusal),
      requested,
    );
  }
  if (role !== "tenant") {
    assert.equal(serviceActionNoteDraft(quoted, role, id, declineQ1), null);
    assert.equal(hasServiceActionNoteDraft(quoted, role, id, declineQ1), false);
    assert.equal(put(quoted, role, declineQ1, "Wrong role"), quoted);
    assert.equal(
      discardServiceActionNoteDraft(quoted, role, id, declineQ1),
      quoted,
    );
  }
  assert.equal(
    serviceActionNoteDraft(requested, role, "missing", refusal),
    null,
  );
  assert.deepEqual(serviceActionNoteDrafts(requested, role, "missing"), []);
  assert.equal(
    discardServiceActionNoteDraft(requested, role, "missing", refusal),
    requested,
  );
}
const anotherQuoted = quote(quoted, "200", otherId);
const foreignQuoteId = latestServiceQuote(record(anotherQuoted, otherId))!.id;
for (const target of [
  { type: "decline", quoteId: foreignQuoteId },
  { type: "decline", quoteId: "missing" },
  { type: "decline", quoteId: "" },
] as const) {
  assert.equal(
    serviceActionNoteDraft(anotherQuoted, "tenant", id, target),
    null,
  );
  assert.equal(
    put(anotherQuoted, "tenant", target, "Do not bind another quote"),
    anotherQuoted,
  );
  assert.equal(
    discardServiceActionNoteDraft(anotherQuoted, "tenant", id, target),
    anotherQuoted,
  );
}
assert.equal(
  serviceActionNoteDraft(requested, "provider", foreignId, refusal),
  null,
);
assert.equal(
  put(requested, "provider", refusal, "Wrong provider", foreignId),
  requested,
);
assert.equal(
  discardServiceActionNoteDraft(requested, "provider", foreignId, refusal),
  requested,
);
for (const patch of [
  { providerName: "Casa Clara" },
  { category: "Cleaning" as const },
]) {
  const foreign = {
    ...requested,
    records: requested.records.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
  assert.equal(serviceActionNoteDraft(foreign, "provider", id, refusal), null);
  assert.deepEqual(serviceActionNoteDrafts(foreign, "provider", id), []);
  assert.equal(
    discardServiceActionNoteDraft(foreign, "provider", id, refusal),
    foreign,
  );
}
const wrongCustomer = {
  ...quoted,
  records: quoted.records.map((item) =>
    item.id === id ? { ...item, customerName: "Another tenant" } : item,
  ),
};
assert.equal(
  serviceActionNoteDraft(wrongCustomer, "tenant", id, declineQ1),
  null,
);
assert.deepEqual(serviceActionNoteDrafts(wrongCustomer, "tenant", id), []);
assert.equal(
  discardServiceActionNoteDraft(wrongCustomer, "tenant", id, declineQ1),
  wrongCustomer,
);
for (const target of [
  {},
  { type: "accept" },
  { type: "start" },
  { type: "decline" },
  { type: "decline", quoteId: 1 },
  null,
  undefined,
  "cancel",
])
  assert.equal(
    put(quoted, "tenant", target as ServiceNoteTarget, "Wrong target"),
    quoted,
  );
const duplicateQuote = {
  ...quoted,
  records: quoted.records.map((item) =>
    item.id === id ? { ...item, quotes: [...item.quotes, { ...q1 }] } : item,
  ),
};
assert.equal(
  serviceActionNoteDraft(duplicateQuote, "tenant", id, declineQ1),
  null,
);
assert.equal(
  put(duplicateQuote, "tenant", declineQ1, "Ambiguous quote"),
  duplicateQuote,
);
assert.equal(
  discardServiceActionNoteDraft(duplicateQuote, "tenant", id, declineQ1),
  duplicateQuote,
);
assert.equal(JSON.stringify(initial), initialJson);

console.log("Purpose-aware service action note checks passed.");
