import assert from "node:assert/strict";
import {
  addMaintenanceReport,
  changeMaintenanceStatus,
  createInitialMaintenanceState,
  createMaintenanceFilters,
  filterMaintenanceRecords,
  maintenanceHomesForRole,
  scheduleMaintenanceVisit,
  validateMaintenanceReport,
  validateMaintenanceSchedule,
  visibleMaintenanceRecords,
  type MaintenanceReportDraft,
} from "../src/components/maintenanceState";

const initial = createInitialMaintenanceState();
const now = new Date(2026, 9, 2, 12, 0, 0);
const report: MaintenanceReportDraft = {
  propertyId: "1",
  title: "  Balcony door sticking  ",
  description:
    "  The balcony door catches on the frame and cannot close fully.  ",
  category: "General repair",
  priority: "Medium",
  accessNotes: "Afternoons are best.",
};
const futureVisit = {
  date: "2026-10-03",
  time: "14:30",
  provider: "  Fixly  ",
};

assert.deepEqual(
  maintenanceHomesForRole("tenant").map((home) => home.id),
  [1],
);
assert.deepEqual(
  maintenanceHomesForRole("landlord").map((home) => home.id),
  [1],
  "Owner access follows Olivia's owned homes, not all rental listings",
);
assert.deepEqual(
  visibleMaintenanceRecords(initial, "tenant").map((record) => record.id),
  [1, 4],
);
assert.deepEqual(
  visibleMaintenanceRecords(initial, "landlord").map((record) => record.id),
  [1, 4],
);
for (const role of ["provider", "spaceOperator", "admin"] as const) {
  assert.equal(visibleMaintenanceRecords(initial, role).length, 0);
  assert.equal(addMaintenanceReport(initial, role, report, now), initial);
}
assert.deepEqual(validateMaintenanceReport(report, "tenant"), {});
assert(validateMaintenanceReport({ ...report, title: "   " }, "tenant").title);
assert(
  validateMaintenanceReport({ ...report, description: "short" }, "tenant")
    .description,
);
assert(
  validateMaintenanceReport({ ...report, category: "Invented" }, "tenant")
    .category,
);
assert(
  validateMaintenanceReport({ ...report, priority: "Critical" }, "tenant")
    .priority,
);
assert(
  validateMaintenanceReport(
    { ...report, accessNotes: "x".repeat(1001) },
    "tenant",
  ).accessNotes,
);
for (const role of ["tenant", "landlord"] as const) {
  assert(
    validateMaintenanceReport({ ...report, propertyId: "2" }, role).propertyId,
  );
  assert.equal(
    addMaintenanceReport(initial, role, { ...report, propertyId: "2" }, now),
    initial,
    "Neither persona can create a record for another owner's home",
  );
}

const reported = addMaintenanceReport(initial, "tenant", report, now);
const created = reported.records[0];
assert.equal(created.id, initial.nextId);
assert.equal(created.title, "Balcony door sticking");
assert.equal(created.tenant, "Inês Duarte");
assert.equal(created.status, "New");
assert.equal(created.reportedAt, now.toISOString());
assert.equal(created.history[0].actor, "Inês Duarte");
assert(
  visibleMaintenanceRecords(reported, "landlord").some(
    (record) => record.id === created.id,
  ),
  "Owner and own tenant can coordinate the same property record",
);
assert.equal(initial.records.length, 4, "Creation is immutable");
assert.equal(
  reported.records.find((record) => record.id === 2),
  initial.records[1],
);

assert.deepEqual(validateMaintenanceSchedule(futureVisit, now), {});
assert(
  validateMaintenanceSchedule({ ...futureVisit, date: "2026-02-30" }, now).date,
);
assert(
  validateMaintenanceSchedule({ ...futureVisit, date: "2026-10-01" }, now).date,
);
assert(
  validateMaintenanceSchedule(
    { ...futureVisit, date: "2026-10-02", time: "11:59" },
    now,
  ).date,
);
assert(
  validateMaintenanceSchedule({ ...futureVisit, time: "24:00" }, now).time,
);
assert(
  validateMaintenanceSchedule({ ...futureVisit, provider: " " }, now).provider,
);
assert.equal(
  scheduleMaintenanceVisit(reported, "tenant", created.id, futureVisit, now),
  reported,
);
assert.equal(
  scheduleMaintenanceVisit(reported, "landlord", 2, futureVisit, now),
  reported,
  "Owner cannot schedule another owner's record",
);
assert.equal(
  changeMaintenanceStatus(reported, "landlord", 2, { type: "start" }, now),
  reported,
);
assert.equal(
  changeMaintenanceStatus(
    reported,
    "tenant",
    created.id,
    { type: "start" },
    now,
  ),
  reported,
);

const scheduled = scheduleMaintenanceVisit(
  reported,
  "landlord",
  created.id,
  futureVisit,
  now,
);
const scheduledRecord = scheduled.records.find(
  (record) => record.id === created.id,
)!;
assert.equal(scheduledRecord.status, "Scheduled");
assert.equal(scheduledRecord.visit?.provider, "Fixly");
assert.equal(scheduledRecord.history.length, 2);
assert.equal(
  scheduleMaintenanceVisit(scheduled, "landlord", created.id, futureVisit, now),
  scheduled,
  "Duplicate scheduling is a no-op",
);
const cancelled = changeMaintenanceStatus(
  scheduled,
  "landlord",
  created.id,
  { type: "cancel-visit" },
  now,
);
assert.equal(cancelled.records[0].status, "New");
assert.equal(cancelled.records[0].visit, undefined);
assert.equal(
  changeMaintenanceStatus(
    reported,
    "landlord",
    created.id,
    { type: "resolve", note: "A repair was completed." },
    now,
  ),
  reported,
  "A new request is not resolved without an explicit work transition",
);

const working = changeMaintenanceStatus(
  scheduled,
  "landlord",
  created.id,
  { type: "start" },
  now,
);
assert.equal(working.records[0].status, "In progress");
assert.equal(
  changeMaintenanceStatus(
    working,
    "landlord",
    created.id,
    { type: "resolve", note: " " },
    now,
  ),
  working,
);
const resolved = changeMaintenanceStatus(
  working,
  "landlord",
  created.id,
  { type: "resolve", note: "Door hinge adjusted and closing checked." },
  now,
);
assert.equal(resolved.records[0].status, "Resolved");
assert.equal(
  scheduleMaintenanceVisit(resolved, "landlord", created.id, futureVisit, now),
  resolved,
  "Resolved work must be reopened before scheduling",
);
const reopened = changeMaintenanceStatus(
  resolved,
  "landlord",
  created.id,
  { type: "reopen", note: "The door is catching again." },
  now,
);
assert.equal(reopened.records[0].status, "New");
assert.equal(reopened.records[0].visit, undefined);
assert.equal(reopened.records[0].resolution, undefined);
assert.equal(reopened.records[0].history.length, 5);
assert.equal(
  new Set(reopened.records[0].history.map((entry) => entry.id)).size,
  5,
);
assert.equal(
  reopened.records.find((record) => record.id === 2),
  initial.records[1],
);

const filters = createMaintenanceFilters();
const chronology = [
  { ...created, id: 99, reportedAt: "2025-12-31T12:00:00Z" },
  { ...created, id: 1, reportedAt: "2026-01-01T12:00:00Z" },
  {
    ...created,
    id: 50,
    reportedAt: "2026-02-01T12:00:00Z",
    status: "Resolved" as const,
  },
];
assert.deepEqual(
  filterMaintenanceRecords(chronology, {
    ...filters,
    sort: "Newest reported",
  }).map((record) => record.id),
  [50, 1, 99],
  "Sort uses timestamps rather than ids or month labels",
);
assert.deepEqual(
  filterMaintenanceRecords(chronology, {
    ...filters,
    sort: "Oldest unresolved",
  }).map((record) => record.id),
  [99, 1],
);
const visitRecords = [
  { ...created, id: 1 },
  {
    ...created,
    id: 2,
    status: "Scheduled" as const,
    visit: { date: "2026-10-04", time: "10:00", provider: "Fixly" },
  },
  {
    ...created,
    id: 3,
    status: "Scheduled" as const,
    visit: { date: "2026-10-03", time: "15:00", provider: "Fixly" },
  },
];
assert.deepEqual(
  filterMaintenanceRecords(visitRecords, {
    ...filters,
    sort: "Scheduled visit",
  }).map((record) => record.id),
  [3, 2, 1],
);
assert.equal(
  filterMaintenanceRecords(visitRecords, {
    ...filters,
    query: "fixly",
    status: "Scheduled",
    property: "1",
  }).length,
  2,
);
assert.equal(createInitialMaintenanceState().records.length, 4);
console.log(
  "Maintenance checks passed: report/schedule validation, property ownership, tenant isolation, explicit status transitions, history and chronological filters.",
);
