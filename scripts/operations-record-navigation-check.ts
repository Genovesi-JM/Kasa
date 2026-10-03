import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  applicationView,
  createInitialApplicationState,
  revealApplication,
  updateApplication,
  updateApplicationView,
  visibleApplicationRecords,
} from "../src/components/applicationState";
import {
  addMaintenanceReport,
  changeMaintenanceStatus,
  createInitialMaintenanceState,
  createMaintenanceFilters,
  filterMaintenanceRecords,
  maintenanceView,
  revealMaintenanceRecord,
  scheduleMaintenanceVisit,
  updateMaintenanceReportDraft,
  updateMaintenanceView,
  visibleMaintenanceRecords,
  type MaintenanceState,
} from "../src/components/maintenanceState";
import {
  buildPropertyOperationsSummary,
  type PropertyActivity,
  type PropertyOperationsInput,
} from "../src/components/propertyOperationsSummary";
import {
  confirmRentRecord,
  createInitialRentRecordState,
  recordRentTransfer,
  visibleRentRecords,
} from "../src/components/rentRecordState";

const at = (minute: number) =>
  new Date(`2032-05-10T12:${String(minute).padStart(2, "0")}:00.000Z`);
const initial = createInitialMaintenanceState();
const tenantHomeRecords = visibleMaintenanceRecords(initial, "tenant");
const active = tenantHomeRecords.find(
  (record) => record.status !== "Resolved",
)!;
const resolved = tenantHomeRecords.find(
  (record) => record.status === "Resolved",
)!;
const foreign = initial.records.find((record) => record.propertyId !== 1)!;
assert.ok(active && resolved && foreign);
const defaults = createMaintenanceFilters();
const layouts = ["Board", "List"] as const;
const sorts = [
  "Urgent first",
  "Newest reported",
  "Oldest unresolved",
  "Scheduled visit",
];
const roles = ["tenant", "landlord"] as const;

// Exact target reveal removes hiding constraints, preserving layout and every non-hiding sort.
let privateState = updateMaintenanceReportDraft(initial, "tenant", {
  title: "PRIVATE TENANT DRAFT",
});
privateState = updateMaintenanceReportDraft(privateState, "landlord", {
  title: "PRIVATE OWNER DRAFT",
});
for (const role of roles) {
  for (const layout of layouts) {
    for (const sort of sorts) {
      for (const target of [active, resolved]) {
        const obstructed = updateMaintenanceView(privateState, role, {
          layout,
          filters: {
            query: "No matching title",
            status: "New",
            priority: "Urgent",
            category: "AC",
            property: "1",
            sort,
          },
        });
        assert.equal(
          filterMaintenanceRecords(
            visibleMaintenanceRecords(obstructed, role),
            maintenanceView(obstructed, role).filters,
          ).some((record) => record.id === target.id),
          false,
        );
        const opened = revealMaintenanceRecord(obstructed, role, target.id);
        const expectedSort =
          target.status === "Resolved" && sort === "Oldest unresolved"
            ? "Urgent first"
            : sort;
        assert.deepEqual(maintenanceView(opened, role), {
          layout,
          filters: { ...defaults, sort: expectedSort },
        });
        assert.ok(
          filterMaintenanceRecords(
            visibleMaintenanceRecords(opened, role),
            maintenanceView(opened, role).filters,
          ).some((record) => record.id === target.id),
        );
        assert.equal(opened.records, obstructed.records);
        assert.equal(opened.reportDrafts, obstructed.reportDrafts);
        assert.equal(opened.nextId, obstructed.nextId);
        const other = role === "tenant" ? "landlord" : "tenant";
        assert.equal(opened.views[other], obstructed.views[other]);
        assert.equal(revealMaintenanceRecord(opened, role, target.id), opened);
        for (const invalidId of [
          999,
          Number.NaN,
          String(target.id) as unknown as number,
          foreign.id,
        ])
          assert.equal(
            revealMaintenanceRecord(obstructed, role, invalidId),
            obstructed,
          );
      }
    }
  }
}
for (const role of ["provider", "spaceOperator", "admin"] as Role[])
  assert.equal(
    revealMaintenanceRecord(privateState, role, active.id),
    privateState,
  );
assert.equal(revealMaintenanceRecord(initial, "tenant", active.id), initial);
const otherOccupant: MaintenanceState = {
  ...privateState,
  records: privateState.records.map((record) =>
    record.id === active.id
      ? { ...record, tenant: "Another occupant" }
      : record,
  ),
};
const otherObstructed = updateMaintenanceView(otherOccupant, "landlord", {
  filters: { query: "No match" },
});
assert.equal(
  revealMaintenanceRecord(otherObstructed, "tenant", active.id),
  otherObstructed,
);
assert.notEqual(
  revealMaintenanceRecord(otherObstructed, "landlord", active.id),
  otherObstructed,
);

// Populate actual history transitions across records that share a property; activity must carry each source identity.
let applications = createInitialApplicationState();
applications = updateApplication(
  applications,
  1,
  "landlord",
  { type: "mark-reviewed" },
  at(1),
);
applications = updateApplication(
  applications,
  3,
  "landlord",
  {
    type: "request-documents",
    documentIds: ["income"],
    note: "Provide an explanatory local response.",
  },
  at(2),
);
const report = {
  propertyId: "1",
  title: "Window handle stuck",
  description: "The bedroom window handle no longer turns properly.",
  category: "General repair",
  priority: "Medium",
  accessNotes: "PRIVATE ACCESS NOTE",
};
let repairs = addMaintenanceReport(privateState, "tenant", report, at(3));
const firstRepairId = privateState.nextId;
const secondRepairId = repairs.nextId;
repairs = addMaintenanceReport(
  repairs,
  "landlord",
  { ...report, title: "Kitchen tap dripping", category: "Plumbing" },
  at(4),
);
assert.notEqual(firstRepairId, secondRepairId);
let rent = createInitialRentRecordState();
const rentId = rent.records.find(
  (record) =>
    record.propertyId === 1 && record.status === "Awaiting transfer details",
)!.id;
rent = recordRentTransfer(
  rent,
  "tenant",
  rentId,
  {
    amount: "1850",
    transferredOn: "2032-05-10",
    reference: "LOCAL-REFERENCE",
    note: "Private transfer note",
  },
  at(5),
);
rent = confirmRentRecord(rent, "landlord", rentId, at(6));
assert.equal(
  rent.records.find((record) => record.id === rentId)!.status,
  "Confirmed",
);
const input: PropertyOperationsInput = {
  role: "landlord",
  rentState: rent,
  applicationState: applications,
  maintenanceState: repairs,
  now: at(7),
};
const snapshot = JSON.stringify(input);
function checkSources(source: PropertyOperationsInput) {
  const summary = buildPropertyOperationsSummary(source);
  for (const entry of summary.recentActivity) {
    if (entry.view === "rent") {
      const sourceId: string = entry.recordId;
      const record = visibleRentRecords(source.rentState, source.role).find(
        (item) => item.id === sourceId,
      );
      assert.ok(record);
      assert.ok(
        record.activity.some(
          (event) => event.at === entry.at && event.label === entry.label,
        ),
      );
      assert.equal(entry.property, record.property);
    } else if (entry.view === "applications") {
      const sourceId: number = entry.recordId;
      const record = visibleApplicationRecords(
        source.applicationState,
        source.role,
      ).find((item) => item.id === sourceId);
      assert.ok(record);
      assert.ok(
        record.activity.some(
          (event) => event.at === entry.at && event.label === entry.label,
        ),
      );
      assert.equal(entry.property, record.property);
    } else {
      const sourceId: number = entry.recordId;
      const record = visibleMaintenanceRecords(
        source.maintenanceState,
        source.role,
      ).find((item) => item.id === sourceId);
      assert.ok(record);
      assert.ok(
        record.history.some(
          (event) => event.at === entry.at && event.description === entry.label,
        ),
      );
      assert.equal(entry.property, record.property);
    }
  }
  return summary;
}
const ownerSummary = checkSources(input);
assert.equal(ownerSummary.recentActivity.length, 6);
assert.deepEqual(
  ownerSummary.recentActivity
    .filter((entry) => entry.view === "applications")
    .map((entry) => entry.recordId)
    .sort(),
  [1, 3],
);
assert.deepEqual(
  ownerSummary.recentActivity
    .filter((entry) => entry.view === "maintenance")
    .map((entry) => entry.recordId)
    .sort(),
  [firstRepairId, secondRepairId],
);
assert.ok(
  ownerSummary.recentActivity
    .filter((entry) => entry.view === "rent")
    .every((entry) => entry.recordId === rentId),
);
assert.equal(
  new Set(ownerSummary.recentActivity.map((entry) => entry.property)).size,
  1,
);
const tenantSummary = checkSources({ ...input, role: "tenant" });
assert.equal(
  tenantSummary.recentActivity.some(
    (entry) => entry.view === "applications" && entry.recordId === 1,
  ),
  false,
);
assert.equal(
  tenantSummary.recentActivity.some(
    (entry) => entry.view === "applications" && entry.recordId === 3,
  ),
  true,
);
assert.equal(JSON.stringify(input), snapshot);

// Opaque activity keys are unrelated to navigation IDs; no composite parsing or title matching is permitted.
const confusingKey = "rent-application-maintenance-999-1-3";
const opaqueInput: PropertyOperationsInput = {
  ...input,
  rentState: {
    records: rent.records.map((record) => ({
      ...record,
      activity: record.activity.map((event) => ({
        ...event,
        id: confusingKey,
      })),
    })),
  },
  applicationState: {
    ...applications,
    records: applications.records.map((record) => ({
      ...record,
      activity: record.activity.map((event) => ({
        ...event,
        id: confusingKey,
      })),
    })),
  },
  maintenanceState: {
    ...repairs,
    records: repairs.records.map((record) => ({
      ...record,
      history: record.history.map((event) => ({ ...event, id: confusingKey })),
    })),
  },
};
const opaqueSummary = checkSources(opaqueInput);
const targets = (entries: PropertyActivity[]) =>
  entries.map((entry) => `${entry.view}:${entry.recordId}`).sort();
assert.deepEqual(
  targets(opaqueSummary.recentActivity),
  targets(ownerSummary.recentActivity),
);

// Earlier activity opens the current state of that exact record after it has progressed or resolved.
repairs = scheduleMaintenanceVisit(
  repairs,
  "landlord",
  firstRepairId,
  { date: "2032-05-11", time: "10:00", provider: "Local technician" },
  at(8),
);
repairs = changeMaintenanceStatus(
  repairs,
  "landlord",
  firstRepairId,
  { type: "start" },
  at(9),
);
repairs = changeMaintenanceStatus(
  repairs,
  "landlord",
  firstRepairId,
  { type: "resolve", note: "The window handle has been repaired locally." },
  at(10),
);
const currentRepair = repairs.records.find(
  (record) => record.id === firstRepairId,
)!;
assert.equal(currentRepair.status, "Resolved");
const historyOnlyInput: PropertyOperationsInput = {
  ...input,
  now: at(11),
  rentState: { records: [] },
  applicationState: { records: [] },
  maintenanceState: { ...repairs, records: [currentRepair] },
};
for (const role of roles) {
  const history = checkSources({ ...historyOnlyInput, role }).recentActivity;
  assert.equal(history.length, 4);
  assert.ok(
    history.every(
      (entry) =>
        entry.view === "maintenance" && entry.recordId === firstRepairId,
    ),
  );
  const hidden = updateMaintenanceView(repairs, role, {
    layout: "List",
    filters: { sort: "Oldest unresolved", query: "No match", status: "New" },
  });
  for (const entry of history) {
    assert.equal(entry.view, "maintenance");
    if (entry.view !== "maintenance")
      throw new Error("Expected maintenance activity");
    const opened = revealMaintenanceRecord(hidden, role, entry.recordId);
    assert.equal(
      opened.records.find((record) => record.id === entry.recordId),
      currentRepair,
    );
    assert.equal(maintenanceView(opened, role).filters.sort, "Urgent first");
    assert.ok(
      filterMaintenanceRecords(
        visibleMaintenanceRecords(opened, role),
        maintenanceView(opened, role).filters,
      ).includes(currentRepair),
    );
  }
}
applications = updateApplication(
  applications,
  1,
  "landlord",
  { type: "approve" },
  at(12),
);
const currentApplication = applications.records.find(
  (record) => record.id === 1,
)!;
assert.equal(currentApplication.status, "Approved");
const appHistory = checkSources({
  ...input,
  now: at(13),
  rentState: { records: [] },
  maintenanceState: { ...repairs, records: [] },
  applicationState: { ...applications, records: [currentApplication] },
}).recentActivity;
assert.ok(appHistory.length >= 2);
const hiddenApps = updateApplicationView(applications, "landlord", {
  query: "Hidden",
  status: "Draft",
  completeness: "100",
  sort: "Oldest submitted",
});
for (const entry of appHistory) {
  assert.equal(entry.view, "applications");
  if (entry.view !== "applications")
    throw new Error("Expected application activity");
  assert.equal(entry.recordId, currentApplication.id);
  const opened = revealApplication(hiddenApps, "landlord", entry.recordId);
  assert.equal(
    opened.records.find((record) => record.id === entry.recordId),
    currentApplication,
  );
  assert.equal(applicationView(opened, "landlord").sort, "Oldest submitted");
  assert.equal(applicationView(opened, "landlord").status, "All");
}

console.log(
  "Operations record navigation checks passed: exact scoped activity targets, opaque source IDs, current-history reveal, hiding-sort recovery and private workspace preservation.",
);
