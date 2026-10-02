import { properties } from "../data";
import { ownedProperties } from "../propertyScope";
import type { Property } from "../types";
import {
  visibleApplicationRecords,
  type ApplicationRecord,
  type ApplicationState,
} from "./applicationState";
import {
  maintenanceHomesForRole,
  visibleMaintenanceRecords,
  type MaintenanceRecord,
  type MaintenanceState,
} from "./maintenanceState";
import {
  rentToday,
  visibleRentRecords,
  type RentRecord,
  type RentRecordState,
} from "./rentRecordState";

export type PropertyOverviewRole = "tenant" | "landlord";

export interface PropertyOperationsInput {
  role: PropertyOverviewRole;
  rentState: RentRecordState;
  applicationState: ApplicationState;
  maintenanceState: MaintenanceState;
  now?: Date;
}

export interface PropertyVisitSummary {
  record: MaintenanceRecord;
  startsAt: number;
}

export interface PropertyActivity {
  id: string;
  view: "rent" | "applications" | "maintenance";
  property: string;
  label: string;
  at: string;
}

export interface PropertyOperationsSummary {
  role: PropertyOverviewRole;
  today: string;
  currentPeriod: string;
  properties: Property[];
  rentRecords: RentRecord[];
  currentRent: RentRecord[];
  currentRentDueCents: number;
  currentRentConfirmedCents: number;
  currentRentConfirmedCount: number;
  rentAwaitingOwner: RentRecord[];
  rentNeedsDetails: RentRecord[];
  rentNeedsCorrection: RentRecord[];
  applicationRecords: ApplicationRecord[];
  pendingApplications: ApplicationRecord[];
  maintenanceRecords: MaintenanceRecord[];
  openMaintenance: MaintenanceRecord[];
  openMaintenanceCount: number;
  recentMaintenance: MaintenanceRecord | undefined;
  nextVisits: PropertyVisitSummary[];
  recentActivity: PropertyActivity[];
}

function visitTime(record: MaintenanceRecord): number {
  const visit = record.visit;
  if (
    !visit ||
    !/^\d{4}-\d{2}-\d{2}$/.test(visit.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(visit.time)
  )
    return NaN;
  const date = new Date(`${visit.date}T${visit.time}:00`);
  if (
    rentToday(date) !== visit.date ||
    date.getHours() !== Number(visit.time.slice(0, 2)) ||
    date.getMinutes() !== Number(visit.time.slice(3))
  )
    return NaN;
  return date.getTime();
}

/** Derive operational summaries from visible records, without assuming tenancy, occupancy or bank verification. */
export function buildPropertyOperationsSummary({
  role,
  rentState,
  applicationState,
  maintenanceState,
  now = new Date(),
}: PropertyOperationsInput): PropertyOperationsSummary {
  const today = rentToday(now);
  const currentPeriod = today.slice(0, 7);
  const tenantHomeIds = new Set(
    maintenanceHomesForRole("tenant").map((home) => home.id),
  );
  const workspaceProperties =
    role === "landlord"
      ? ownedProperties(role)
      : properties.filter((property) => tenantHomeIds.has(property.id));
  const ownedIds = new Set(workspaceProperties.map((property) => property.id));
  const rentRecords = visibleRentRecords(rentState, role)
    .filter((record) => role !== "landlord" || ownedIds.has(record.propertyId))
    .sort(
      (left, right) =>
        right.period.localeCompare(left.period) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id),
    );
  const currentRent = rentRecords.filter(
    (record) => record.period === currentPeriod,
  );
  const currentConfirmed = currentRent.filter(
    (record) => record.status === "Confirmed",
  );
  const applicationRecords = visibleApplicationRecords(applicationState, role)
    .slice()
    .sort(
      (left, right) =>
        right.submittedAt.localeCompare(left.submittedAt) || right.id - left.id,
    );
  const maintenanceRecords = visibleMaintenanceRecords(
    maintenanceState,
    role,
  ).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id,
  );
  const openMaintenance = maintenanceRecords.filter(
    (record) => record.status !== "Resolved",
  );
  const nextVisits = openMaintenance
    .filter(
      (record) =>
        record.status === "Scheduled" || record.status === "In progress",
    )
    .map((record) => ({ record, startsAt: visitTime(record) }))
    .filter(
      (visit) =>
        Number.isFinite(visit.startsAt) && visit.startsAt > now.getTime(),
    )
    .sort(
      (left, right) =>
        left.startsAt - right.startsAt || left.record.id - right.record.id,
    );
  const recentActivity: PropertyActivity[] = [
    ...rentRecords.flatMap((record) =>
      record.activity.map((entry) => ({
        id: `rent-${record.id}-${entry.id}`,
        view: "rent" as const,
        property: record.property,
        label: entry.label,
        at: entry.at,
      })),
    ),
    ...applicationRecords.flatMap((record) =>
      record.activity.map((entry) => ({
        id: `application-${record.id}-${entry.id}`,
        view: "applications" as const,
        property: record.property,
        label: entry.label,
        at: entry.at,
      })),
    ),
    ...maintenanceRecords.flatMap((record) =>
      record.history.map((entry) => ({
        id: `maintenance-${record.id}-${entry.id}`,
        view: "maintenance" as const,
        property: record.property,
        label: entry.description,
        at: entry.at,
      })),
    ),
  ]
    .filter(
      (entry) =>
        Number.isFinite(Date.parse(entry.at)) &&
        Date.parse(entry.at) <= now.getTime(),
    )
    .sort(
      (left, right) =>
        Date.parse(right.at) - Date.parse(left.at) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 6);
  return {
    role,
    today,
    currentPeriod,
    properties: workspaceProperties,
    rentRecords,
    currentRent,
    currentRentDueCents: currentRent.reduce(
      (sum, record) => sum + record.amountDueCents,
      0,
    ),
    currentRentConfirmedCents: currentConfirmed.reduce(
      (sum, record) => sum + record.amountDueCents,
      0,
    ),
    currentRentConfirmedCount: currentConfirmed.length,
    rentAwaitingOwner: rentRecords.filter(
      (record) => record.status === "Awaiting owner confirmation",
    ),
    rentNeedsDetails: rentRecords.filter(
      (record) => record.status === "Awaiting transfer details",
    ),
    rentNeedsCorrection: rentRecords.filter(
      (record) => record.status === "Needs correction",
    ),
    applicationRecords,
    pendingApplications: applicationRecords.filter(
      (record) => record.status === "Review" || record.status === "Documents",
    ),
    maintenanceRecords,
    openMaintenance,
    openMaintenanceCount: openMaintenance.length,
    recentMaintenance: maintenanceRecords[0],
    nextVisits,
    recentActivity,
  };
}
