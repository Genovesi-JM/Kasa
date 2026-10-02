import { maintenance, properties } from "../data";
import type { Role } from "../types";

export const maintenanceStatuses = [
  "New",
  "Scheduled",
  "In progress",
  "Resolved",
] as const;
export const maintenanceCategories = [
  "Plumbing",
  "AC",
  "Electrical",
  "General repair",
] as const;
export const maintenancePriorities = ["Low", "Medium", "Urgent"] as const;
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];
export type MaintenanceCategory = (typeof maintenanceCategories)[number];
export type MaintenancePriority = (typeof maintenancePriorities)[number];

export interface MaintenanceHome {
  id: number;
  title: string;
  tenant: string;
}
const tenants: Record<number, string> = {
  1: "Inês Duarte",
  2: "Leo Bernard",
  3: "Maya Chen",
  4: "Owner report",
};
const homes: MaintenanceHome[] = properties
  .filter((property) => property.listingType === "Rent")
  .map((property) => ({
    id: property.id,
    title: property.title,
    tenant: tenants[property.id] || "Owner report",
  }));
const ownerHomeIds = new Set(
  properties
    .filter((property) => property.landlord === "Olivia Martín")
    .map((property) => property.id),
);

export interface MaintenanceVisit {
  date: string;
  time: string;
  provider: string;
}
export interface MaintenanceRecord {
  id: number;
  propertyId: number;
  property: string;
  tenant: string;
  title: string;
  description: string;
  accessNotes: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedAt: string;
  updatedAt: string;
  visit?: MaintenanceVisit;
  resolution?: string;
  history: Array<{
    id: string;
    at: string;
    actor: string;
    description: string;
  }>;
}
export interface MaintenanceState {
  records: MaintenanceRecord[];
  nextId: number;
}
export interface MaintenanceReportDraft {
  propertyId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  accessNotes: string;
}
export interface MaintenanceScheduleDraft {
  date: string;
  time: string;
  provider: string;
}
export type ReportErrors = Partial<
  Record<keyof MaintenanceReportDraft, string>
>;
export type ScheduleErrors = Partial<
  Record<keyof MaintenanceScheduleDraft, string>
>;
export interface MaintenanceFilters {
  query: string;
  status: string;
  priority: string;
  category: string;
  property: string;
  sort: string;
}
export type MaintenanceAction =
  | { type: "start" }
  | { type: "cancel-visit" }
  | { type: "resolve"; note: string }
  | { type: "reopen"; note: string };

export function maintenanceHomesForRole(role: Role): MaintenanceHome[] {
  if (role === "landlord")
    return homes.filter((home) => ownerHomeIds.has(home.id));
  if (role === "tenant")
    return homes.filter(
      (home) => home.id === 1 && home.tenant === "Inês Duarte",
    );
  return [];
}

export function visibleMaintenanceRecords(
  state: MaintenanceState,
  role: Role,
): MaintenanceRecord[] {
  const allowedHomes = maintenanceHomesForRole(role);
  return state.records.filter((record) =>
    allowedHomes.some(
      (home) =>
        home.id === record.propertyId &&
        (role === "landlord" || record.tenant === home.tenant),
    ),
  );
}

export function createInitialMaintenanceState(): MaintenanceState {
  const dates = [
    "2026-08-21T08:30:00Z",
    "2026-08-20T09:00:00Z",
    "2026-08-19T11:00:00Z",
    "2026-08-12T09:30:00Z",
  ];
  const categories: MaintenanceCategory[] = [
    "Plumbing",
    "AC",
    "Electrical",
    "General repair",
  ];
  const descriptions = [
    "The kitchen tap keeps dripping after it is fully closed. The cupboard underneath is dry.",
    "The living-room air conditioner needs a routine service and filter inspection.",
    "The power outlet beside the desk is no longer working. Please inspect the outlet and wiring.",
    "The bedroom blind was stuck and would not lift. The sample repair record is now resolved.",
  ];
  return {
    nextId: Math.max(...maintenance.map((request) => request.id)) + 1,
    records: maintenance.map((request, index) => {
      const home = homes.find((item) => item.title === request.property)!;
      const visit = request.provider
        ? {
            date:
              request.id === 2
                ? "2026-08-22"
                : request.id === 3
                  ? "2026-08-20"
                  : "2026-08-14",
            time: "10:00",
            provider: request.provider,
          }
        : undefined;
      return {
        id: request.id,
        propertyId: home.id,
        property: home.title,
        tenant: request.tenant,
        title: request.title,
        description: descriptions[index],
        accessNotes: "Coordinate access directly with the occupant.",
        category: categories[index],
        priority: request.priority,
        status: request.status,
        reportedAt: dates[index],
        updatedAt: dates[index],
        visit,
        resolution:
          request.status === "Resolved"
            ? "Sample record: the blind mechanism was repaired and checked."
            : undefined,
        history: [
          {
            id: `sample-maintenance-${request.id}`,
            at: dates[index],
            actor: "Sample record",
            description: `Request added with status ${request.status.toLowerCase()}.`,
          },
        ],
      };
    }),
  };
}

export function validateMaintenanceReport(
  draft: MaintenanceReportDraft,
  role: Role,
): ReportErrors {
  const errors: ReportErrors = {};
  if (
    !maintenanceHomesForRole(role).some(
      (home) => home.id === Number(draft.propertyId),
    )
  )
    errors.propertyId = "Choose a property available in this workspace.";
  if (draft.title.trim().length < 5 || draft.title.trim().length > 120)
    errors.title = "Use a title between 5 and 120 characters.";
  if (
    draft.description.trim().length < 12 ||
    draft.description.trim().length > 2000
  )
    errors.description = "Describe the issue in 12 to 2,000 characters.";
  if (!maintenanceCategories.includes(draft.category as MaintenanceCategory))
    errors.category = "Choose an issue category.";
  if (!maintenancePriorities.includes(draft.priority as MaintenancePriority))
    errors.priority = "Choose a priority.";
  if (draft.accessNotes.trim().length > 1000)
    errors.accessNotes = "Keep access notes under 1,000 characters.";
  return errors;
}

export function addMaintenanceReport(
  state: MaintenanceState,
  role: Role,
  draft: MaintenanceReportDraft,
  now = new Date(),
): MaintenanceState {
  if (Object.keys(validateMaintenanceReport(draft, role)).length) return state;
  const home = maintenanceHomesForRole(role).find(
    (item) => item.id === Number(draft.propertyId),
  )!;
  const at = now.toISOString();
  const record: MaintenanceRecord = {
    id: state.nextId,
    propertyId: home.id,
    property: home.title,
    tenant: home.tenant,
    title: draft.title.trim(),
    description: draft.description.trim(),
    accessNotes: draft.accessNotes.trim(),
    category: draft.category as MaintenanceCategory,
    priority: draft.priority as MaintenancePriority,
    status: "New",
    reportedAt: at,
    updatedAt: at,
    history: [
      {
        id: `maintenance-${state.nextId}-0`,
        at,
        actor: role === "tenant" ? home.tenant : "Property owner",
        description: "Issue recorded in this local workspace.",
      },
    ],
  };
  return { records: [record, ...state.records], nextId: state.nextId + 1 };
}

export function maintenanceDateValue(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function visitTimestamp(
  visit: Pick<MaintenanceVisit, "date" | "time">,
): number {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(visit.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(visit.time)
  )
    return NaN;
  const parsed = new Date(`${visit.date}T${visit.time}:00`);
  if (
    maintenanceDateValue(parsed) !== visit.date ||
    parsed.getHours() !== Number(visit.time.slice(0, 2)) ||
    parsed.getMinutes() !== Number(visit.time.slice(3))
  )
    return NaN;
  return parsed.getTime();
}

export function validateMaintenanceSchedule(
  draft: MaintenanceScheduleDraft,
  now = new Date(),
): ScheduleErrors {
  const errors: ScheduleErrors = {};
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(visitTimestamp({ date: draft.date, time: "12:00" }))
  )
    errors.date = "Choose a valid visit date.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
    errors.time = "Choose a valid visit time.";
  const timestamp = visitTimestamp(draft);
  if (
    !errors.date &&
    !errors.time &&
    (!Number.isFinite(timestamp) || timestamp <= now.getTime())
  )
    errors.date = "Choose a future visit date and time.";
  if (draft.provider.trim().length < 2 || draft.provider.trim().length > 100)
    errors.provider = "Enter a provider name between 2 and 100 characters.";
  return errors;
}

function ownerRecord(state: MaintenanceState, role: Role, id: number) {
  return role === "landlord"
    ? visibleMaintenanceRecords(state, role).find((record) => record.id === id)
    : undefined;
}

function replaceRecord(
  state: MaintenanceState,
  record: MaintenanceRecord,
  changes: Partial<MaintenanceRecord>,
  description: string,
  now: Date,
): MaintenanceState {
  const at = now.toISOString();
  const updated = {
    ...record,
    ...changes,
    updatedAt: at,
    history: [
      ...record.history,
      {
        id: `maintenance-${record.id}-${record.history.length}`,
        at,
        actor: "Property owner",
        description,
      },
    ],
  };
  return {
    ...state,
    records: state.records.map((item) =>
      item.id === record.id ? updated : item,
    ),
  };
}

export function scheduleMaintenanceVisit(
  state: MaintenanceState,
  role: Role,
  id: number,
  draft: MaintenanceScheduleDraft,
  now = new Date(),
): MaintenanceState {
  const record = ownerRecord(state, role, id);
  if (
    !record ||
    record.status === "Resolved" ||
    Object.keys(validateMaintenanceSchedule(draft, now)).length
  )
    return state;
  const visit = {
    date: draft.date,
    time: draft.time,
    provider: draft.provider.trim(),
  };
  if (
    record.status === "Scheduled" &&
    record.visit?.date === visit.date &&
    record.visit.time === visit.time &&
    record.visit.provider === visit.provider
  )
    return state;
  return replaceRecord(
    state,
    record,
    { visit, status: "Scheduled" },
    `Visit scheduled locally with ${visit.provider} for ${visit.date} at ${visit.time}.`,
    now,
  );
}

export function changeMaintenanceStatus(
  state: MaintenanceState,
  role: Role,
  id: number,
  action: MaintenanceAction,
  now = new Date(),
): MaintenanceState {
  const record = ownerRecord(state, role, id);
  if (!record) return state;
  if (action.type === "start") {
    if (record.status !== "New" && record.status !== "Scheduled") return state;
    return replaceRecord(
      state,
      record,
      { status: "In progress" },
      "Work marked in progress locally.",
      now,
    );
  }
  if (action.type === "cancel-visit") {
    if (record.status !== "Scheduled") return state;
    return replaceRecord(
      state,
      record,
      { status: "New", visit: undefined },
      "Scheduled visit removed locally; request returned to New.",
      now,
    );
  }
  const note = action.note.trim();
  if (note.length < 8 || note.length > 1000) return state;
  if (action.type === "resolve") {
    if (record.status !== "In progress") return state;
    return replaceRecord(
      state,
      record,
      { status: "Resolved", resolution: note },
      `Request resolved locally. ${note}`,
      now,
    );
  }
  if (record.status !== "Resolved") return state;
  return replaceRecord(
    state,
    record,
    { status: "New", resolution: undefined, visit: undefined },
    `Request reopened locally. ${note}`,
    now,
  );
}

export function createMaintenanceFilters(): MaintenanceFilters {
  return {
    query: "",
    status: "All statuses",
    priority: "All priorities",
    category: "All categories",
    property: "All properties",
    sort: "Urgent first",
  };
}

export function filterMaintenanceRecords(
  records: MaintenanceRecord[],
  filters: MaintenanceFilters,
): MaintenanceRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const urgency = { Urgent: 0, Medium: 1, Low: 2 };
  return records
    .filter(
      (record) =>
        (filters.status === "All statuses" ||
          record.status === filters.status) &&
        (filters.priority === "All priorities" ||
          record.priority === filters.priority) &&
        (filters.category === "All categories" ||
          record.category === filters.category) &&
        (filters.property === "All properties" ||
          String(record.propertyId) === filters.property) &&
        (filters.sort !== "Oldest unresolved" ||
          record.status !== "Resolved") &&
        `${record.title} ${record.description} ${record.property} ${record.tenant} ${record.category} ${record.visit?.provider || ""}`
          .toLocaleLowerCase()
          .includes(query),
    )
    .sort((a, b) => {
      const chronological = Date.parse(a.reportedAt) - Date.parse(b.reportedAt);
      if (filters.sort === "Newest reported")
        return -chronological || b.id - a.id;
      if (filters.sort === "Oldest unresolved")
        return chronological || a.id - b.id;
      if (filters.sort === "Scheduled visit") {
        const aVisit =
          a.status === "Scheduled" && a.visit
            ? visitTimestamp(a.visit)
            : Infinity;
        const bVisit =
          b.status === "Scheduled" && b.visit
            ? visitTimestamp(b.visit)
            : Infinity;
        return aVisit - bVisit || 0 || -chronological || b.id - a.id;
      }
      return (
        Number(a.status === "Resolved") - Number(b.status === "Resolved") ||
        urgency[a.priority] - urgency[b.priority] ||
        -chronological ||
        b.id - a.id
      );
    });
}
