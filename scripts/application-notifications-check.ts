import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  addApplicationEvidenceFiles,
  applicationEvidenceDraft,
  applicationEvidenceSummary,
  applicationView,
  createInitialApplicationState,
  submitApplicationEvidence,
  submitRentalApplication,
  updateApplication,
  updateApplicationEvidenceNote,
  updateApplicationView,
  updateRentalApplicationDraft,
  type ApplicationRecord,
  type ApplicationState,
} from "../src/components/applicationState";
import {
  openRentalApplicationNotification,
  reconcileRentalApplicationNotifications,
} from "../src/components/applicationNotifications";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  type KasaNotification,
  type NotificationState,
} from "../src/components/notificationState";

const time = (minute: number) =>
  new Date(`2032-05-10T12:${String(minute).padStart(2, "0")}:00.000Z`);
const initial = createInitialApplicationState();
const seeds = createInitialNotificationState();
const sharedId = 3;
const privateNote =
  "PRIVATE_NOTE: explanatory details only for the application participants.";
const file = new File(["PRIVATE_FILE_CONTENT"], "PRIVATE_FILENAME.txt", {
  type: "text/plain",
  lastModified: 123,
});
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
type Kind = NonNullable<KasaNotification["rentalApplicationEvent"]>["kind"];
const activity = (state: NotificationState) =>
  state.items.filter((item) => item.rentalApplicationEvent);
function record(state: ApplicationState, id = sharedId) {
  const found = state.records.find((item) => item.id === id);
  assert.ok(found);
  return found;
}
function only(value: ApplicationRecord): ApplicationState {
  return { ...initial, records: [value] };
}
function notice(
  state: NotificationState,
  kind: Kind,
  minute: number,
  id = sharedId,
) {
  const found = activity(state).find(
    (item) =>
      item.rentalApplicationEvent!.kind === kind &&
      item.rentalApplicationEvent!.applicationId === id &&
      item.rentalApplicationEvent!.occurredAt === time(minute).toISOString(),
  );
  assert.ok(found, `Expected ${kind} at minute ${minute}`);
  return found;
}
function request(
  state: ApplicationState,
  minute: number,
  documentIds = ["income", "reference"],
  id = sharedId,
) {
  const next = updateApplication(
    state,
    id,
    "landlord",
    {
      type: "request-documents",
      documentIds,
      note: `${privateNote} Revision ${minute}`,
    },
    time(minute),
  );
  assert.notEqual(next, state);
  return next;
}
function respond(state: ApplicationState, minute: number, id = sharedId) {
  const draft = applicationEvidenceDraft(state, "tenant", id)!;
  const result = submitApplicationEvidence(
    state,
    "tenant",
    id,
    draft.revision,
    draft.requestId,
    time(minute),
  );
  assert.equal(result.issue, null);
  assert.ok(result.responseId);
  return { state: result.state, responseId: result.responseId };
}

// Seed activity and private drafts never become newly recorded evidence notifications.
assert.ok(
  initial.records.every((item) =>
    item.activity.every((event) => event.source === "sample"),
  ),
);
assert.equal(reconcileRentalApplicationNotifications(seeds, initial), seeds);
const privateComposer = updateRentalApplicationDraft(
  initial,
  "tenant",
  2,
  { introduction: privateNote },
  time(0),
);
assert.equal(
  reconcileRentalApplicationNotifications(seeds, privateComposer),
  seeds,
);
const requested = request(privateComposer, 0);
const requestFeed = reconcileRentalApplicationNotifications(seeds, requested);
assert.equal(activity(requestFeed).length, 1);
const firstNotice = notice(requestFeed, "evidence-requested", 0);
assert.equal(firstNotice.role, "tenant");
assert.equal(firstNotice.destination, "applications");
const emptyDraft = applicationEvidenceDraft(requested, "tenant", sharedId)!;
assert.equal(
  submitApplicationEvidence(
    requested,
    "tenant",
    sharedId,
    emptyDraft.revision,
    emptyDraft.requestId,
    time(1),
  ).state,
  requested,
);
const attached = addApplicationEvidenceFiles(
  updateApplicationEvidenceNote(requested, "tenant", sharedId, privateNote),
  "tenant",
  sharedId,
  "income",
  [file],
  time(1),
);
assert.equal(attached.added, 1);
assert.equal(
  reconcileRentalApplicationNotifications(requestFeed, attached.state),
  requestFeed,
);
const readRequest = markNotificationRead(requestFeed, "tenant", firstNotice.id);
const partial = respond(attached.state, 1);
const partialFeed = reconcileRentalApplicationNotifications(
  readRequest,
  partial.state,
);
const firstResponse = notice(partialFeed, "evidence-response-saved", 1);
assert.equal(firstResponse.role, "landlord");
assert.equal(firstResponse.read, false);
assert.equal(notice(partialFeed, "evidence-requested", 0).read, true);
assert.deepEqual(
  applicationEvidenceSummary(record(partial.state)).outstandingDocumentIds,
  ["reference"],
);
assert.equal(record(partial.state).status, "Approved");
assert.equal(
  record(partial.state).evidenceResponses!.at(-1)!.files[0].file,
  file,
);

// Historical alerts survive acknowledgment, explicit closure, new request versions and note-only responses.
const acknowledged = updateApplication(
  partial.state,
  sharedId,
  "landlord",
  { type: "acknowledge-evidence", responseId: partial.responseId },
  time(2),
);
const firstRequestId = applicationEvidenceSummary(record(acknowledged))
  .latestRequest!.id;
const closed = updateApplication(
  acknowledged,
  sharedId,
  "landlord",
  { type: "close-evidence-request", requestId: firstRequestId },
  time(3),
);
assert.equal(
  reconcileRentalApplicationNotifications(partialFeed, closed),
  partialFeed,
);
const revised = request(closed, 4, ["reference"]);
const noteOnly = respond(
  updateApplicationEvidenceNote(revised, "tenant", sharedId, privateNote),
  5,
);
assert.equal(record(noteOnly.state).evidenceResponses!.at(-1)!.files.length, 0);
const third = request(noteOnly.state, 6, ["income"]);
const duplicate = updateApplication(
  third,
  sharedId,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income"],
    note: `${privateNote} Revision 6`,
  },
  time(7),
);
assert.equal(duplicate, third);
const reviewed = updateApplication(
  third,
  sharedId,
  "landlord",
  { type: "acknowledge-evidence", responseId: noteOnly.responseId },
  time(7),
);
const finalState = updateApplication(
  reviewed,
  sharedId,
  "landlord",
  {
    type: "close-evidence-request",
    requestId: applicationEvidenceSummary(record(reviewed)).latestRequest!.id,
  },
  time(8),
);
const feed = reconcileRentalApplicationNotifications(partialFeed, finalState);
assert.equal(activity(feed).length, 5);
assert.equal(record(finalState).status, "Approved");
assert.equal(record(finalState).reviewed, true);
assert.equal(notice(feed, "evidence-requested", 0).read, true);
assert.equal(notice(feed, "evidence-response-saved", 1).id, firstResponse.id);
assert.equal(notice(feed, "evidence-requested", 4).read, false);
assert.equal(notice(feed, "evidence-response-saved", 5).role, "landlord");
assert.equal(notice(feed, "evidence-requested", 6).role, "tenant");

// Pending missing-document responses with no request ID are legitimate; creating the application itself is not this event.
const pending = submitRentalApplication(
  {
    ...initial,
    records: initial.records.filter((item) => item.id !== sharedId),
  },
  "tenant",
  properties[0],
  { moveInDate: "2032-05-20", householdSize: 1, introduction: privateNote },
  time(9),
);
const pendingId = pending.records.at(-1)!.id;
assert.notEqual(pendingId, sharedId);
assert.equal(reconcileRentalApplicationNotifications(seeds, pending), seeds);
const unsolicited = respond(
  updateApplicationEvidenceNote(pending, "tenant", pendingId, privateNote),
  10,
  pendingId,
);
assert.equal(
  record(unsolicited.state, pendingId).evidenceResponses!.at(-1)!.requestId,
  null,
);
const unsolicitedFeed = reconcileRentalApplicationNotifications(
  seeds,
  unsolicited.state,
);
assert.equal(activity(unsolicitedFeed).length, 1);
assert.equal(
  notice(unsolicitedFeed, "evidence-response-saved", 10, pendingId).role,
  "landlord",
);
const laterApproved = updateApplication(
  updateApplication(
    unsolicited.state,
    pendingId,
    "landlord",
    { type: "mark-reviewed" },
    time(11),
  ),
  pendingId,
  "landlord",
  { type: "approve" },
  time(12),
);
assert.equal(
  reconcileRentalApplicationNotifications(unsolicitedFeed, laterApproved),
  unsolicitedFeed,
);

// Feed metadata is restricted to canonical property context and actual event times, never evidence contents.
for (const item of activity(feed)) {
  assert.deepEqual(
    Object.keys(item.rentalApplicationEvent!).sort(),
    ["kind", "applicationId", "propertyTitle", "occurredAt"].sort(),
  );
  assert.equal(item.rentalApplicationEvent!.propertyTitle, properties[0].title);
  assert.equal(item.destination, "applications");
  assert.ok(item.id.startsWith("rental-application:"));
}
const serialized = JSON.stringify(activity(feed));
for (const secret of [
  privateNote,
  file.name,
  "PRIVATE_FILE_CONTENT",
  "Inês Duarte",
  "income",
  "reference",
  "documentIds",
  "mimeType",
  "files",
  "reviewed",
])
  assert.equal(
    serialized.includes(secret),
    false,
    `Notifications must exclude ${secret}`,
  );
const renamed = only({ ...record(finalState), property: privateNote });
assert.ok(
  activity(reconcileRentalApplicationNotifications(seeds, renamed)).every(
    (item) =>
      item.rentalApplicationEvent!.propertyTitle === properties[0].title,
  ),
);

// Both party scopes and a canonical rental property are required; labels cannot override supplied identities.
for (const patch of [
  { tenantId: "other-tenant" },
  { tenantId: "" },
  { propertyId: 2 },
  { propertyId: 5 },
  { propertyId: 999 },
  { propertyId: undefined },
] as Partial<ApplicationRecord>[])
  assert.equal(
    activity(
      reconcileRentalApplicationNotifications(
        seeds,
        only({ ...record(finalState), ...patch }),
      ),
    ).length,
    0,
  );
const otherApplicant = request(initial, 13, ["income"], 1);
assert.equal(
  activity(reconcileRentalApplicationNotifications(seeds, otherApplicant))
    .length,
  0,
);

// Source provenance, actor, action, exact unique snapshot ID/version and canonical timestamp establish a genuine event.
const requestRecord = record(requested);
const requestEvent = requestRecord.activity.at(-1)!;
const responseRecord = record(partial.state);
const responseEvent = responseRecord.activity.at(-1)!;
for (const [sourceRecord, sourceEvent, kind] of [
  [requestRecord, requestEvent, "evidence-requested"],
  [responseRecord, responseEvent, "evidence-response-saved"],
] as const) {
  for (const patch of [
    { source: "sample" },
    { source: undefined },
    { actor: "admin" },
    { action: "approve" },
    { id: "" },
    { id: " " },
    { at: "invalid" },
    { at: "2032-05-10T12:00:00Z" },
    { at: time(30).toISOString() },
    { requestId: "missing", responseId: "missing" },
  ] as unknown as Array<Partial<ApplicationRecord["activity"][number]>>) {
    const invalid = only({
      ...sourceRecord,
      activity: sourceRecord.activity.map((event) =>
        event.id === sourceEvent.id ? { ...event, ...patch } : event,
      ),
    });
    assert.equal(
      activity(reconcileRentalApplicationNotifications(seeds, invalid)).some(
        (item) => item.rentalApplicationEvent!.kind === kind,
      ),
      false,
    );
  }
  const legacy = only({
    ...sourceRecord,
    activity: sourceRecord.activity.map((event) => ({
      id: event.id,
      label: event.label,
      at: event.at,
    })) as ApplicationRecord["activity"],
  });
  assert.equal(
    activity(reconcileRentalApplicationNotifications(seeds, legacy)).length,
    0,
  );
}
for (const snapshot of [
  [],
  [...requestRecord.evidenceRequests!, requestRecord.evidenceRequests![0]],
  requestRecord.evidenceRequests!.map((item) => ({ ...item, version: 99 })),
  requestRecord.evidenceRequests!.map((item) => ({
    ...item,
    createdAt: time(30).toISOString(),
  })),
])
  assert.equal(
    activity(
      reconcileRentalApplicationNotifications(
        seeds,
        only({ ...requestRecord, evidenceRequests: snapshot }),
      ),
    ).length,
    0,
  );
for (const responses of [
  [],
  [...responseRecord.evidenceResponses!, responseRecord.evidenceResponses![0]],
  responseRecord.evidenceResponses!.map((item) => ({ ...item, version: 99 })),
  responseRecord.evidenceResponses!.map((item) => ({
    ...item,
    submittedAt: time(30).toISOString(),
  })),
  responseRecord.evidenceResponses!.map((item) => ({
    ...item,
    requestId: "missing-request",
  })),
])
  assert.equal(
    activity(
      reconcileRentalApplicationNotifications(
        seeds,
        only({ ...responseRecord, evidenceResponses: responses }),
      ),
    ).some(
      (item) => item.rentalApplicationEvent!.kind === "evidence-response-saved",
    ),
    false,
  );

for (const createdAt of ["invalid", "2032-05-10T12:00:00Z"]) {
  const invalidReference = only({
    ...responseRecord,
    evidenceRequests: responseRecord.evidenceRequests!.map((item) => ({
      ...item,
      createdAt,
    })),
  });
  assert.equal(
    activity(
      reconcileRentalApplicationNotifications(seeds, invalidReference),
    ).some(
      (item) => item.rentalApplicationEvent!.kind === "evidence-response-saved",
    ),
    false,
  );
}
const clockRollback = respond(
  updateApplicationEvidenceNote(
    request(initial, 31),
    "tenant",
    sharedId,
    privateNote,
  ),
  30,
);
const rollbackFeed = reconcileRentalApplicationNotifications(
  seeds,
  clockRollback.state,
);
assert.equal(
  activity(rollbackFeed).length,
  2,
  "Valid source linkage does not assume the device clock always advances",
);
assert.equal(
  notice(rollbackFeed, "evidence-response-saved", 30).role,
  "landlord",
);

// Reconciliation is idempotent, deduplicates event/receipt copies and preserves old reads while adding new unread activity.
assert.equal(reconcileRentalApplicationNotifications(feed, finalState), feed);
assert.deepEqual(
  activity(reconcileRentalApplicationNotifications(seeds, finalState)).map(
    (item) => item.id,
  ),
  activity(feed).map((item) => item.id),
);
const allRead = markAllNotificationsRead(
  markAllNotificationsRead(feed, "tenant"),
  "landlord",
);
assert.ok(activity(allRead).every((item) => item.read));
const freshRequest = request(finalState, 14, ["reference"]);
const afterRead = reconcileRentalApplicationNotifications(
  allRead,
  freshRequest,
);
assert.equal(activity(afterRead).filter((item) => !item.read).length, 1);
assert.equal(notice(afterRead, "evidence-requested", 14).read, false);
const receipt = notice(allRead, "evidence-requested", 0);
const duplicateFeed = reconcileRentalApplicationNotifications(
  {
    items: [
      ...allRead.items,
      { ...receipt, read: false },
      { ...receipt, role: "landlord", read: false },
    ],
  },
  finalState,
);
assert.equal(activity(duplicateFeed).length, 5);
assert.equal(notice(duplicateFeed, "evidence-requested", 0).read, true);
const repeated = {
  ...finalState,
  records: finalState.records.map((item) => ({
    ...item,
    activity: [
      ...item.activity,
      ...item.activity.map((event) => ({ ...event })),
    ],
  })),
};
assert.equal(
  activity(reconcileRentalApplicationNotifications(feed, repeated)).length,
  5,
);
const conflictingActivity = only({
  ...requestRecord,
  activity: [...requestRecord.activity, { ...requestEvent, actor: "tenant" }],
});
assert.equal(
  activity(reconcileRentalApplicationNotifications(seeds, conflictingActivity))
    .length,
  0,
);
const competingRequestEvents = only({
  ...requestRecord,
  activity: [
    ...requestRecord.activity,
    { ...requestEvent, id: "another-event-for-the-same-request" },
  ],
});
assert.equal(
  activity(
    reconcileRentalApplicationNotifications(seeds, competingRequestEvents),
  ).length,
  0,
);
const ambiguousApplication = {
  ...initial,
  records: [record(finalState), { ...record(finalState) }],
};
assert.equal(
  activity(reconcileRentalApplicationNotifications(seeds, ambiguousApplication))
    .length,
  0,
);
const removed = reconcileRentalApplicationNotifications(feed, {
  ...initial,
  records: [],
});
assert.deepEqual(
  removed.items,
  feed.items.filter((item) => !item.rentalApplicationEvent),
);

// A feed link reveals its real current application, preserving sort and private state, without deciding anything.
let obstructed = finalState;
for (const role of ["tenant", "landlord"] as const)
  obstructed = updateApplicationView(obstructed, role, {
    query: "No matching row",
    status: "Draft",
    property: "1",
    completeness: "100",
    sort: role === "tenant" ? "Most complete" : "Oldest submitted",
  });
for (const [item, role] of [
  [firstNotice, "tenant"],
  [firstResponse, "landlord"],
] as const) {
  const opened = openRentalApplicationNotification(obstructed, role, item);
  assert.ok(opened);
  assert.equal(opened.applicationId, sharedId);
  assert.deepEqual(applicationView(opened.state, role), {
    query: "",
    status: "All",
    property: "All properties",
    completeness: "Any completeness",
    sort: applicationView(obstructed, role).sort,
  });
  assert.equal(opened.state.records, obstructed.records);
  assert.equal(opened.state.rentalDrafts, obstructed.rentalDrafts);
  assert.equal(opened.state.evidenceDrafts, obstructed.evidenceDrafts);
  const other = role === "tenant" ? "landlord" : "tenant";
  assert.equal(opened.state.views?.[other], obstructed.views?.[other]);
  for (const wrongRole of roles.filter((value) => value !== role))
    assert.equal(
      openRentalApplicationNotification(obstructed, wrongRole, item),
      null,
    );
  assert.equal(
    openRentalApplicationNotification(
      { ...obstructed, records: [] },
      role,
      item,
    ),
    null,
  );
  assert.equal(
    openRentalApplicationNotification(obstructed, role, {
      ...item,
      id: "rental-application:forged",
    }),
    null,
  );
  const redirected = openRentalApplicationNotification(obstructed, role, {
    ...item,
    destination: "provider",
    rentalApplicationEvent: {
      ...item.rentalApplicationEvent!,
      applicationId: 1,
      propertyTitle: privateNote,
      occurredAt: time(59).toISOString(),
    },
  });
  assert.ok(redirected);
  assert.equal(redirected.applicationId, sharedId);
}
const expiredSource = {
  ...obstructed,
  records: obstructed.records.map((item) => ({ ...item, activity: [] })),
};
assert.equal(
  openRentalApplicationNotification(expiredSource, "tenant", firstNotice),
  null,
);

// Other activity namespaces retain their records/receipts and share descending time with deterministic ties.
const otherEvents: KasaNotification[] = [
  {
    ...seeds.items[0],
    id: "work:retained",
    read: true,
    workEvent: {
      kind: "application-reviewed",
      applicationId: "work-existing",
      opportunityTitle: "Existing opportunity",
      occurredAt: time(15).toISOString(),
    },
  },
  {
    ...seeds.items[0],
    id: "service:retained",
    read: true,
    serviceEvent: {
      kind: "quote-recorded",
      requestId: "service-existing",
      requestTitle: "Existing request",
      occurredAt: time(4).toISOString(),
    },
  },
  {
    ...seeds.items[0],
    id: "space-booking:retained",
    read: true,
    spaceBookingEvent: {
      kind: "proposal-recorded",
      bookingId: "space-existing",
      venueName: "Existing venue",
      spaceName: "Existing unit",
      occurredAt: time(4).toISOString(),
    },
  },
];
const mixed = reconcileRentalApplicationNotifications(
  { items: [...allRead.items, ...otherEvents] },
  finalState,
);
const timestamp = (item: KasaNotification) =>
  item.rentalApplicationEvent?.occurredAt ??
  item.workEvent?.occurredAt ??
  item.serviceEvent?.occurredAt ??
  item.spaceBookingEvent?.occurredAt;
const ordered = mixed.items.filter((item) => timestamp(item));
assert.deepEqual(
  ordered,
  [...ordered].sort(
    (a, b) =>
      timestamp(b)!.localeCompare(timestamp(a)!) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  ),
);
for (const item of otherEvents)
  assert.equal(
    mixed.items.find((entry) => entry.id === item.id),
    item,
  );
assert.ok(activity(mixed).every((item) => item.read));
assert.deepEqual(
  mixed.items.filter((item) => !timestamp(item)),
  allRead.items.filter((item) => !timestamp(item)),
);

console.log(
  "Application notification checks passed: genuine scoped evidence events, historical/partial/note-only responses, private payloads, stable receipts and mixed chronology, exact guarded reveal without decisions.",
);
