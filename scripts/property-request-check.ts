import assert from "node:assert/strict";
import {
  cancelViewingRequest,
  createInitialPropertyRequestState,
  futureLocalDate,
  isCurrentOrFutureDate,
  localDateValue,
  saveViewingRequest,
  validateRentalApplication,
  validateViewingRequest,
  viewingForProperty,
  type ViewingRequestDraft,
} from "../src/components/propertyRequestState";

const now = new Date(2026, 9, 2, 12, 30);
assert.equal(localDateValue(now), "2026-10-02");
assert.equal(futureLocalDate(1, new Date(2026, 11, 31, 23, 59)), "2027-01-01");
assert.equal(futureLocalDate(1, new Date(2028, 1, 28)), "2028-02-29");
assert.ok(isCurrentOrFutureDate("2026-10-02", now));
for (const date of [
  "",
  "tomorrow",
  "2026-10-01",
  "2026-02-30",
  "2026-13-01",
  "2026-10-2",
  "2026-10-32",
])
  assert.equal(isCurrentOrFutureDate(date, now), false, date);

const draft: ViewingRequestDraft = {
  date: "2026-10-03",
  time: "14:30",
  note: "  Saturday works best.  ",
};
assert.deepEqual(validateViewingRequest(draft, now), {});
assert.deepEqual(
  validateViewingRequest({ ...draft, date: "2026-10-02", time: "13:30" }, now),
  {},
);
assert.ok(
  validateViewingRequest({ ...draft, date: "2026-10-02", time: "12:00" }, now)
    .time,
);
for (const time of ["", "25:00", "12:60", "noon", "2:30"])
  assert.ok(validateViewingRequest({ ...draft, time }, now).time);
assert.ok(
  validateViewingRequest({ ...draft, note: "x".repeat(1001) }, now).note,
);
assert.deepEqual(
  validateRentalApplication(
    {
      moveInDate: "2026-10-02",
      householdSize: 1,
      introduction: "",
    },
    now,
  ),
  {},
);

const initial = createInitialPropertyRequestState();
const saved = saveViewingRequest(initial, "tenant", { id: 2 }, draft, now);
const request = viewingForProperty(saved, "tenant", 2)!;
assert.equal(initial.viewings.length, 0);
assert.equal(request.date, draft.date);
assert.equal(request.time, draft.time);
assert.equal(request.note, "Saturday works best.");
assert.equal(request.status, "Pending");
assert.equal(request.propertyId, 2);
assert.equal(viewingForProperty(saved, "tenant", 3), undefined);
assert.equal(viewingForProperty(saved, "landlord", 2), undefined);
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(
    saveViewingRequest(initial, role, { id: 2 }, draft, now),
    initial,
  );
  assert.equal(cancelViewingRequest(saved, role, 2, now), saved);
}
assert.equal(
  saveViewingRequest(
    initial,
    "tenant",
    { id: 2 },
    { ...draft, date: "2026-10-01" },
    now,
  ),
  initial,
);
const edited = saveViewingRequest(
  saved,
  "tenant",
  { id: 2 },
  { ...draft, time: "15:30", note: "Updated note." },
  new Date(2026, 9, 2, 13),
);
assert.equal(
  edited.viewings.length,
  1,
  "Editing replaces the same property request rather than duplicating it",
);
assert.equal(edited.viewings[0].id, request.id);
assert.equal(edited.viewings[0].createdAt, request.createdAt);
assert.equal(edited.viewings[0].time, "15:30");
assert.equal(saved.viewings[0].time, "14:30");
const otherProperty = saveViewingRequest(
  edited,
  "tenant",
  { id: 3 },
  draft,
  now,
);
const cancelled = cancelViewingRequest(otherProperty, "tenant", 2, now);
assert.equal(viewingForProperty(cancelled, "tenant", 2)?.status, "Cancelled");
assert.equal(viewingForProperty(cancelled, "tenant", 3)?.status, "Pending");
assert.equal(cancelViewingRequest(cancelled, "tenant", 2, now), cancelled);
assert.equal(cancelViewingRequest(cancelled, "tenant", 999, now), cancelled);
const reopened = saveViewingRequest(
  cancelled,
  "tenant",
  { id: 2 },
  { ...draft, date: "2026-10-04" },
  now,
);
assert.equal(reopened.viewings.length, 2);
assert.equal(viewingForProperty(reopened, "tenant", 2)?.status, "Pending");
assert.equal(viewingForProperty(reopened, "tenant", 2)?.date, "2026-10-04");
console.log(
  "Property request checks passed: local dates, date/time validation, tenant guard, retained values, edits, cancellation, duplicate prevention and property isolation.",
);
