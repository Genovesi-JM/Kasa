import type {
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
  MaintenanceIssueCode,
} from "../../components/maintenanceState";
import type { OperationsKey } from "./types";

export const maintenanceStatusKeys = {
  New: "maintenance_statusNew",
  Scheduled: "maintenance_statusScheduled",
  "In progress": "maintenance_statusProgress",
  Resolved: "maintenance_statusResolved",
} as const satisfies Record<MaintenanceStatus, OperationsKey>;
export const maintenancePriorityKeys = {
  Low: "maintenance_priorityLow",
  Medium: "maintenance_priorityMedium",
  Urgent: "maintenance_priorityUrgent",
} as const satisfies Record<MaintenancePriority, OperationsKey>;
export const maintenanceCategoryKeys = {
  Plumbing: "maintenance_categoryPlumbing",
  AC: "maintenance_categoryAC",
  Electrical: "maintenance_categoryElectrical",
  "General repair": "maintenance_categoryGeneral",
} as const satisfies Record<MaintenanceCategory, OperationsKey>;
export const maintenanceSortKeys = {
  "Urgent first": "maintenance_sortUrgent",
  "Newest reported": "maintenance_sortNewest",
  "Oldest unresolved": "maintenance_sortOldest",
  "Scheduled visit": "maintenance_sortVisit",
} as const satisfies Record<string, OperationsKey>;
export const maintenanceViewKeys = {
  Board: "maintenance_board",
  List: "maintenance_list",
} as const satisfies Record<string, OperationsKey>;
export const maintenanceIssueKeys = {
  propertyId: "maintenance_errorProperty",
  title: "maintenance_errorTitle",
  description: "maintenance_errorDescription",
  category: "maintenance_errorCategory",
  priority: "maintenance_errorPriority",
  accessNotes: "maintenance_errorAccess",
  invalidDate: "maintenance_errorDate",
  invalidTime: "maintenance_errorTime",
  futureVisit: "maintenance_errorFuture",
  provider: "maintenance_errorProvider",
  note: "maintenance_errorNote",
} as const satisfies Record<MaintenanceIssueCode, OperationsKey>;

export function maintenanceFormatters(locale: string) {
  return {
    dateLabel: (value: string) =>
      new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    timeLabel: (value: string) =>
      new Date(value).toLocaleString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
  };
}
