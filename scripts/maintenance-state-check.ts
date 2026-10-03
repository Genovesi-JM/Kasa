import assert from "node:assert/strict";
import {
  addMaintenanceReport,
  changeMaintenanceStatus,
  createInitialMaintenanceState,
  createMaintenanceFilters,
  discardMaintenanceReportDraft,
  filterMaintenanceRecords,
  maintenanceHomesForRole,
  hasMaintenanceReportDraft,
  maintenanceReportDraft,
  maintenanceReportIssues,
  maintenanceScheduleIssues,
  maintenanceNoteIssue,
  scheduleMaintenanceVisit,
  submitMaintenanceReport,
  updateMaintenanceReportDraft,
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
const workingSnapshot = JSON.stringify(working);
assert.equal(
  scheduleMaintenanceVisit(working, "landlord", created.id, futureVisit, now),
  working,
  "Saving an unchanged visit during work is a no-op, with no extra history",
);
const revisedVisit = {
  ...futureVisit,
  time: "16:00",
  provider: "Fixly follow-up",
};
const rescheduledWork = scheduleMaintenanceVisit(
  working,
  "landlord",
  created.id,
  revisedVisit,
  now,
);
assert.equal(
  rescheduledWork.records[0].status,
  "In progress",
  "Updating visit arrangements must preserve work already in progress",
);
assert.deepEqual(rescheduledWork.records[0].visit, revisedVisit);
assert.equal(
  rescheduledWork.records[0].history.length,
  working.records[0].history.length + 1,
);
assert.equal(
  scheduleMaintenanceVisit(
    rescheduledWork,
    "landlord",
    created.id,
    revisedVisit,
    now,
  ),
  rescheduledWork,
);
assert.equal(
  JSON.stringify(working),
  workingSnapshot,
  "Revising a visit leaves the previous state untouched",
);
assert.equal(
  changeMaintenanceStatus(
    rescheduledWork,
    "landlord",
    created.id,
    { type: "resolve", note: "The repair has been completed." },
    now,
  ).records[0].status,
  "Resolved",
  "Updated visits do not require starting the work again before resolution",
);
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
assert.deepEqual(maintenanceReportIssues(report, "tenant"), {});
assert.equal(
  maintenanceReportIssues({ ...report, title: " " }, "tenant").title,
  "title",
);
assert.equal(
  maintenanceScheduleIssues({ ...futureVisit, date: "2026-02-30" }, now).date,
  "invalidDate",
);
assert.equal(
  maintenanceScheduleIssues({ ...futureVisit, time: "24:00" }, now).time,
  "invalidTime",
);
assert.equal(
  maintenanceScheduleIssues(
    { ...futureVisit, date: "2026-10-02", time: "11:00" },
    now,
  ).date,
  "futureVisit",
);
assert.equal(
  maintenanceScheduleIssues({ ...futureVisit, provider: " " }, now).provider,
  "provider",
);
assert.equal(maintenanceNoteIssue(" short "), "note");
assert.equal(maintenanceNoteIssue("x".repeat(1001)), "note");
assert.equal(maintenanceNoteIssue("Valid repair description."), null);

// Report drafts retain incomplete input privately until an explicit successful submit.
const blankDraft = {
  propertyId: "1",
  title: "",
  description: "",
  category: "General repair",
  priority: "Medium",
  accessNotes: "",
};
assert.deepEqual(initial.reportDrafts, {});
for (const role of ["tenant", "landlord"] as const) {
  assert.equal(hasMaintenanceReportDraft(initial, role), false);
  assert.deepEqual(maintenanceReportDraft(initial, role), blankDraft);
  const detached = maintenanceReportDraft(initial, role)!;
  detached.title = "Cannot mutate defaults";
  assert.deepEqual(maintenanceReportDraft(initial, role), blankDraft);
  assert.equal(submitMaintenanceReport(initial, role, now).state, initial);
  assert.equal(submitMaintenanceReport(initial, role, now).recordId, null);
}
const rawInput = {
  propertyId: "",
  title: "  a  ",
  description: "",
  category: "",
  priority: "",
  accessNotes: " \n ",
};
const incomplete = updateMaintenanceReportDraft(initial, "tenant", rawInput);
assert.deepEqual(maintenanceReportDraft(incomplete, "tenant"), rawInput);
assert.equal(hasMaintenanceReportDraft(incomplete, "tenant"), true);
assert.equal(hasMaintenanceReportDraft(incomplete, "landlord"), false);
assert.deepEqual(maintenanceReportDraft(incomplete, "landlord"), blankDraft);
assert.equal(
  updateMaintenanceReportDraft(incomplete, "tenant", { ...rawInput }),
  incomplete,
);
assert.equal(
  updateMaintenanceReportDraft(incomplete, "tenant", {
    title: 42,
    extra: "unknown",
  } as unknown as Partial<MaintenanceReportDraft>),
  incomplete,
);
const detachedRetained = maintenanceReportDraft(incomplete, "tenant")!;
detachedRetained.accessNotes = "Cannot mutate retained data";
assert.equal(
  maintenanceReportDraft(incomplete, "tenant")!.accessNotes,
  rawInput.accessNotes,
);
assert.equal(incomplete.records, initial.records);
assert.equal(incomplete.nextId, initial.nextId);
assert.deepEqual(
  visibleMaintenanceRecords(incomplete, "tenant"),
  visibleMaintenanceRecords(initial, "tenant"),
);
assert.deepEqual(
  visibleMaintenanceRecords(incomplete, "landlord"),
  visibleMaintenanceRecords(initial, "landlord"),
);
assert.equal(
  JSON.stringify(incomplete.records).includes(rawInput.title),
  false,
);
assert.equal(
  submitMaintenanceReport(incomplete, "tenant", now).state,
  incomplete,
);
assert.deepEqual(
  submitMaintenanceReport(incomplete, "tenant", now).issues,
  maintenanceReportIssues(rawInput, "tenant"),
);
for (const role of ["provider", "spaceOperator", "admin"] as const) {
  assert.equal(maintenanceReportDraft(incomplete, role), null);
  assert.equal(hasMaintenanceReportDraft(incomplete, role), false);
  assert.equal(
    updateMaintenanceReportDraft(incomplete, role, report),
    incomplete,
  );
  assert.equal(discardMaintenanceReportDraft(incomplete, role), incomplete);
  assert.equal(
    submitMaintenanceReport(incomplete, role, now).state,
    incomplete,
  );
  assert.equal(submitMaintenanceReport(incomplete, role, now).recordId, null);
}
for (const role of ["tenant", "landlord"] as const) {
  const foreignHome = updateMaintenanceReportDraft(incomplete, role, {
    ...report,
    propertyId: "2",
  });
  assert.equal(
    maintenanceReportDraft(foreignHome, role)!.propertyId,
    "2",
    "Retain raw invalid input so the user can correct it",
  );
  const rejected = submitMaintenanceReport(foreignHome, role, now);
  assert.equal(rejected.state, foreignHome);
  assert.equal(rejected.recordId, null);
  assert.equal(rejected.issues.propertyId, "propertyId");
}
const ownerPrivate = {
  ...report,
  title: "Owner's private report",
  description: "Owner's unsent description with sufficient detail.",
};
const bothDrafts = updateMaintenanceReportDraft(
  updateMaintenanceReportDraft(incomplete, "tenant", report),
  "landlord",
  ownerPrivate,
);
assert.deepEqual(maintenanceReportDraft(bothDrafts, "tenant"), report);
assert.deepEqual(maintenanceReportDraft(bothDrafts, "landlord"), ownerPrivate);
assert.equal(bothDrafts.records, initial.records);
const discardedDraft = discardMaintenanceReportDraft(bothDrafts, "tenant");
assert.equal(hasMaintenanceReportDraft(discardedDraft, "tenant"), false);
assert.equal(
  discardedDraft.reportDrafts.landlord,
  bothDrafts.reportDrafts.landlord,
);
assert.equal(discardedDraft.records, bothDrafts.records);
assert.equal(
  discardMaintenanceReportDraft(discardedDraft, "tenant"),
  discardedDraft,
);
assert.equal(hasMaintenanceReportDraft(bothDrafts, "tenant"), true);

const submittedDraft = submitMaintenanceReport(bothDrafts, "tenant", now);
assert.deepEqual(submittedDraft.issues, {});
assert.equal(submittedDraft.recordId, bothDrafts.nextId);
assert.equal(
  submittedDraft.state.records.length,
  bothDrafts.records.length + 1,
);
assert.equal(submittedDraft.state.nextId, bothDrafts.nextId + 1);
const submittedRecord = submittedDraft.state.records.find(
  (item) => item.id === submittedDraft.recordId,
)!;
assert.equal(submittedRecord.propertyId, Number(report.propertyId));
assert.equal(submittedRecord.title, report.title.trim());
assert.equal(submittedRecord.description, report.description.trim());
assert.equal(submittedRecord.accessNotes, report.accessNotes.trim());
assert.equal(submittedRecord.category, report.category);
assert.equal(submittedRecord.priority, report.priority);
assert.equal(submittedRecord.status, "New");
assert.equal(submittedRecord.reportedAt, now.toISOString());
assert.equal(submittedRecord.history.length, 1);
assert.equal(submittedRecord.history[0].actor, "Inês Duarte");
assert.equal(hasMaintenanceReportDraft(submittedDraft.state, "tenant"), false);
assert.equal(
  submittedDraft.state.reportDrafts.landlord,
  bothDrafts.reportDrafts.landlord,
);
assert.equal(
  submitMaintenanceReport(submittedDraft.state, "tenant", now).state,
  submittedDraft.state,
);
assert.equal(
  submitMaintenanceReport(submittedDraft.state, "tenant", now).recordId,
  null,
);
for (const existing of bothDrafts.records)
  assert.equal(
    submittedDraft.state.records.find((item) => item.id === existing.id),
    existing,
  );
const submittedOwner = submitMaintenanceReport(
  submittedDraft.state,
  "landlord",
  now,
);
assert.equal(submittedOwner.recordId, submittedDraft.state.nextId);
assert.equal(
  submittedOwner.state.records[0].history[0].actor,
  "Property owner",
);
assert.equal(submittedOwner.state.records[0].title, ownerPrivate.title);
assert.equal(
  hasMaintenanceReportDraft(submittedOwner.state, "landlord"),
  false,
);
assert.equal(
  submittedOwner.state.records.find((item) => item.id === submittedRecord.id),
  submittedRecord,
);

// Existing record actions must not consume or overwrite unrelated report drafts.
const legacyAdd = addMaintenanceReport(bothDrafts, "tenant", report, now);
assert.equal(legacyAdd.reportDrafts, bothDrafts.reportDrafts);
const draftScheduled = scheduleMaintenanceVisit(
  legacyAdd,
  "landlord",
  legacyAdd.records[0].id,
  futureVisit,
  now,
);
const draftStarted = changeMaintenanceStatus(
  draftScheduled,
  "landlord",
  legacyAdd.records[0].id,
  { type: "start" },
  now,
);
const draftResolved = changeMaintenanceStatus(
  draftStarted,
  "landlord",
  legacyAdd.records[0].id,
  { type: "resolve", note: "The door was adjusted and checked." },
  now,
);
for (const state of [draftScheduled, draftStarted, draftResolved]) {
  assert.equal(state.reportDrafts, bothDrafts.reportDrafts);
  assert.deepEqual(maintenanceReportDraft(state, "tenant"), report);
  assert.deepEqual(maintenanceReportDraft(state, "landlord"), ownerPrivate);
}
assert.deepEqual(createInitialMaintenanceState().reportDrafts, {});
console.log(
  "Maintenance checks passed: private retained report drafts, guarded submission, report/schedule validation, structured issues, property/tenant scope, work-preserving visit updates, duplicate no-ops, explicit transitions, history and chronological filters.",
);
