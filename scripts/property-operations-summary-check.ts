import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  buildPropertyOperationsSummary,
  type PropertyOperationsInput,
} from "../src/components/propertyOperationsSummary";
import {
  createInitialApplicationState,
  submitRentalApplication,
  updateApplication,
} from "../src/components/applicationState";
import {
  addMaintenanceReport,
  changeMaintenanceStatus,
  createInitialMaintenanceState,
  scheduleMaintenanceVisit,
  type MaintenanceState,
} from "../src/components/maintenanceState";
import {
  confirmRentRecord,
  createInitialRentRecordState,
  recordRentTransfer,
  requestRentCorrection,
} from "../src/components/rentRecordState";

const now = new Date(2026, 9, 2, 12, 0);
const later = new Date(2026, 9, 2, 13, 0);
const base: PropertyOperationsInput = {
  role: "landlord",
  now,
  rentState: createInitialRentRecordState(),
  applicationState: createInitialApplicationState(),
  maintenanceState: createInitialMaintenanceState(),
};
const unchanged = JSON.stringify(base);
const owner = buildPropertyOperationsSummary(base);
assert.deepEqual(
  owner.properties.map((property) => property.id),
  [1],
);
assert.equal(owner.today, "2026-10-02");
assert.equal(owner.currentPeriod, "2026-10");
assert.equal(owner.currentRent.length, 1);
assert.equal(owner.currentRent[0].status, "Awaiting transfer details");
assert.equal(owner.currentRentDueCents, 185000);
assert.equal(owner.currentRentConfirmedCents, 0);
assert.equal(owner.currentRentConfirmedCount, 0);
assert.equal(owner.rentAwaitingOwner.length, 1);
assert.equal(owner.rentNeedsDetails.length, 1);
assert.equal(owner.rentNeedsCorrection.length, 0);
assert.deepEqual(
  owner.applicationRecords.map((record) => record.id),
  [1, 3],
);
assert.deepEqual(
  owner.pendingApplications.map((record) => record.id),
  [1],
);
assert.equal(owner.openMaintenanceCount, 1);
assert.deepEqual(
  owner.maintenanceRecords.map((record) => record.id),
  [1, 4],
);
assert.equal(owner.recentMaintenance?.id, 1);
assert.deepEqual(owner.nextVisits, []);
assert.ok(
  owner.recentActivity.every((entry) => entry.property === properties[0].title),
);
assert.equal(
  JSON.stringify(base),
  unchanged,
  "Building summaries never mutates source state or ordering",
);

const tenant = buildPropertyOperationsSummary({ ...base, role: "tenant" });
assert.deepEqual(
  tenant.properties.map((property) => property.id),
  [1],
);
assert.deepEqual(
  tenant.applicationRecords.map((record) => record.id),
  [3],
);
assert.deepEqual(tenant.pendingApplications, []);
assert.equal(tenant.currentRent[0].tenantId, "tenant-ines");
assert.equal(tenant.openMaintenanceCount, 1);
assert.ok(
  tenant.recentActivity.every(
    (entry) => !entry.id.startsWith("application-1-"),
  ),
);

const rentId = owner.currentRent[0].id;
const rentDraft = {
  amount: "1850",
  transferredOn: "2026-10-01",
  reference: "EXAMPLE-OCT",
  note: "Recorded in test",
};
const recorded = recordRentTransfer(
  base.rentState,
  "tenant",
  rentId,
  rentDraft,
  now,
);
const afterRecord = buildPropertyOperationsSummary({
  ...base,
  rentState: recorded,
});
assert.equal(afterRecord.rentNeedsDetails.length, 0);
assert.equal(afterRecord.rentAwaitingOwner.length, 2);
assert.equal(afterRecord.currentRentConfirmedCents, 0);
assert.equal(afterRecord.recentActivity[0].view, "rent");
const corrected = requestRentCorrection(
  recorded,
  "landlord",
  rentId,
  "Check the reference.",
  now,
);
assert.equal(
  buildPropertyOperationsSummary({ ...base, rentState: corrected })
    .rentNeedsCorrection.length,
  1,
);
const resubmitted = recordRentTransfer(
  corrected,
  "tenant",
  rentId,
  { ...rentDraft, reference: "EXAMPLE-REVISED" },
  now,
);
const confirmed = confirmRentRecord(resubmitted, "landlord", rentId, later);
const afterConfirmation = buildPropertyOperationsSummary({
  ...base,
  rentState: confirmed,
  now: later,
});
assert.equal(afterConfirmation.currentRentConfirmedCents, 185000);
assert.equal(afterConfirmation.currentRentConfirmedCount, 1);
assert.equal(
  afterConfirmation.rentAwaitingOwner.length,
  1,
  "September still requires review",
);
assert.equal(afterConfirmation.rentNeedsCorrection.length, 0);
assert.equal(afterConfirmation.recentActivity[0].view, "rent");
assert.match(afterConfirmation.recentActivity[0].label, /Owner confirmed/);

const reviewed = updateApplication(
  base.applicationState,
  1,
  "landlord",
  { type: "mark-reviewed" },
  now,
);
const approved = updateApplication(
  reviewed,
  1,
  "landlord",
  { type: "approve" },
  later,
);
const afterApproval = buildPropertyOperationsSummary({
  ...base,
  applicationState: approved,
  now: later,
});
assert.equal(afterApproval.pendingApplications.length, 0);
assert.equal(
  afterApproval.applicationRecords.find((record) => record.id === 1)?.status,
  "Approved",
);
assert.equal(afterApproval.recentActivity[0].view, "applications");
const tenantApplication = submitRentalApplication(
  base.applicationState,
  "tenant",
  properties[1],
  {
    moveInDate: "2026-10-10",
    householdSize: 2,
    introduction: "Example application",
  },
  now,
);
const tenantAfterApply = buildPropertyOperationsSummary({
  ...base,
  role: "tenant",
  applicationState: tenantApplication,
});
assert.equal(tenantAfterApply.pendingApplications.length, 1);
assert.equal(tenantAfterApply.applicationRecords.length, 2);
assert.deepEqual(
  tenantAfterApply.properties.map((property) => property.id),
  [1],
  "Applying does not create a tenancy or new current home",
);
const ownerAfterForeignApply = buildPropertyOperationsSummary({
  ...base,
  applicationState: tenantApplication,
});
assert.equal(ownerAfterForeignApply.pendingApplications.length, 1);
assert.ok(
  ownerAfterForeignApply.applicationRecords.every(
    (record) => record.propertyId === 1,
  ),
);

const withReport = addMaintenanceReport(
  base.maintenanceState,
  "tenant",
  {
    propertyId: "1",
    title: "Window handle stuck",
    description: "The bedroom window handle no longer turns.",
    category: "General repair",
    priority: "Medium",
    accessNotes: "Example access note",
  },
  now,
);
const reportId = withReport.records[0].id;
const afterReport = buildPropertyOperationsSummary({
  ...base,
  maintenanceState: withReport,
});
assert.equal(afterReport.openMaintenanceCount, 2);
assert.equal(afterReport.recentMaintenance?.id, reportId);
assert.equal(afterReport.recentActivity[0].view, "maintenance");
const scheduled = scheduleMaintenanceVisit(
  withReport,
  "landlord",
  reportId,
  { date: "2026-10-03", time: "09:30", provider: "Example Repairs" },
  now,
);
const earlierVisit = scheduleMaintenanceVisit(
  scheduled,
  "landlord",
  1,
  { date: "2026-10-02", time: "16:00", provider: "Example Plumbing" },
  now,
);
const withVisits = buildPropertyOperationsSummary({
  ...base,
  maintenanceState: earlierVisit,
});
assert.deepEqual(
  withVisits.nextVisits.map((entry) => entry.record.id),
  [1, reportId],
);
assert.equal(
  withVisits.nextVisits[0].startsAt,
  new Date(2026, 9, 2, 16).getTime(),
);
const started = changeMaintenanceStatus(
  earlierVisit,
  "landlord",
  1,
  { type: "start" },
  now,
);
assert.equal(
  buildPropertyOperationsSummary({ ...base, maintenanceState: started })
    .nextVisits.length,
  2,
);
const resolved = changeMaintenanceStatus(
  started,
  "landlord",
  1,
  { type: "resolve", note: "The sample repair is complete." },
  later,
);
const afterResolved = buildPropertyOperationsSummary({
  ...base,
  maintenanceState: resolved,
  now: later,
});
assert.equal(afterResolved.openMaintenanceCount, 1);
assert.deepEqual(
  afterResolved.nextVisits.map((entry) => entry.record.id),
  [reportId],
  "Resolved visits leave the upcoming list even when their recorded date is future",
);
assert.equal(afterResolved.recentMaintenance?.status, "Resolved");
const cancelled = changeMaintenanceStatus(
  earlierVisit,
  "landlord",
  1,
  { type: "cancel-visit" },
  later,
);
assert.deepEqual(
  buildPropertyOperationsSummary({
    ...base,
    maintenanceState: cancelled,
    now: later,
  }).nextVisits.map((entry) => entry.record.id),
  [reportId],
);

const invalidVisit: MaintenanceState = {
  ...scheduled,
  records: scheduled.records.map((record) =>
    record.id === reportId
      ? {
          ...record,
          visit: { date: "2026-02-30", time: "09:30", provider: "Example" },
        }
      : record,
  ),
};
assert.deepEqual(
  buildPropertyOperationsSummary({ ...base, maintenanceState: invalidVisit })
    .nextVisits,
  [],
);
assert.deepEqual(
  buildPropertyOperationsSummary({
    ...base,
    maintenanceState: scheduled,
    now: new Date(2026, 9, 4),
  }).nextVisits,
  [],
);
assert.equal(
  buildPropertyOperationsSummary({
    ...base,
    now: new Date(2026, 8, 30, 23, 59),
  }).currentPeriod,
  "2026-09",
);
assert.equal(
  buildPropertyOperationsSummary({ ...base, now: new Date(2026, 9, 1) })
    .currentPeriod,
  "2026-10",
);
const november = buildPropertyOperationsSummary({
  ...base,
  rentState: confirmed,
  now: new Date(2026, 10, 1),
});
assert.equal(november.currentPeriod, "2026-11");
assert.deepEqual(november.currentRent, []);
assert.equal(november.currentRentDueCents, 0);
assert.equal(november.currentRentConfirmedCount, 0);
assert.equal(
  november.currentRentConfirmedCents,
  0,
  "October confirmation is not shown as a November payment",
);
assert.equal(november.rentRecords.length, 3, "Older periods remain available");
assert.equal(
  buildPropertyOperationsSummary({ ...base, now: new Date(2027, 0, 1) })
    .currentPeriod,
  "2027-01",
);
assert.ok(
  buildPropertyOperationsSummary({
    ...base,
    now: new Date(2026, 7, 1),
  }).recentActivity.every(
    (entry) => Date.parse(entry.at) <= new Date(2026, 7, 1).getTime(),
  ),
);

const empty = buildPropertyOperationsSummary({
  ...base,
  rentState: { records: [] },
  applicationState: { records: [] },
  maintenanceState: { records: [], nextId: 1 },
});
assert.equal(empty.openMaintenanceCount, 0);
assert.deepEqual(empty.pendingApplications, []);
assert.deepEqual(empty.currentRent, []);
assert.deepEqual(empty.recentActivity, []);
assert.equal(empty.recentMaintenance, undefined);
console.log(
  "Property operations summary checks passed: owner/tenant scopes, live rent/application/repair transitions, current-period totals, upcoming visit order, cancellation/resolution, activity isolation, immutable summaries and month/year rollover.",
);
