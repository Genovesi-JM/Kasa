import { properties, providers } from "../data";
import { workspaceLandlordName } from "../propertyScope";
import type { Role } from "../types";
import { maintenanceHomesForRole } from "./maintenanceState";

export const serviceCategories = [
  "Cleaning",
  "Plumbing",
  "Electrical",
  "AC & climate",
  "Handyman",
] as const;
export const workspaceServiceProvider = "Volt & Co.";
export type ServiceCategory = (typeof serviceCategories)[number];
export type ServiceCustomerRole = "tenant" | "landlord";
export type ServiceRequestStatus =
  | "Requested"
  | "Quoted"
  | "Accepted"
  | "Declined"
  | "Provider declined"
  | "Cancelled"
  | "In progress"
  | "Completed";
export interface ServiceRequestDraft {
  propertyId: string;
  category: string;
  providerName: string;
  title: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
}
export interface ServiceQuoteDraft {
  amount: string;
  scope: string;
  date: string;
  time: string;
  validUntil: string;
}
export interface ServiceQuote {
  id: string;
  version: number;
  amountCents: number;
  scope: string;
  date: string;
  time: string;
  validUntil: string;
  recordedAt: string;
  decision: "Pending" | "Accepted" | "Declined" | "Superseded";
  decidedAt?: string;
  decisionNote?: string;
}
export interface ServiceRequestHistory {
  id: string;
  at: string;
  actor: string;
  action:
    | "requested"
    | "quoted"
    | "accepted"
    | "declined"
    | "provider-declined"
    | "cancelled"
    | "started"
    | "completed";
  note?: string;
  quoteId?: string;
}
export interface ServiceRequestRecord {
  id: string;
  source: "sample" | "local";
  customerRole: ServiceCustomerRole;
  customerName: string;
  propertyId: number;
  category: ServiceCategory;
  providerName: string;
  title: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  status: ServiceRequestStatus;
  quotes: ServiceQuote[];
  history: ServiceRequestHistory[];
  createdAt: string;
  updatedAt: string;
}
export type ServiceRequestFilter = "active" | "history" | "all";
export interface ServiceRequestView {
  query: string;
  filter: ServiceRequestFilter;
  selectedId: string | null;
}
type ServiceRequestWorkspaceRole = ServiceCustomerRole | "provider";
export interface ServiceRequestState {
  records: ServiceRequestRecord[];
  drafts: Record<ServiceCustomerRole, Record<string, ServiceRequestDraft>>;
  quoteDrafts: Record<string, ServiceQuoteDraft>;
  actionNotes: Record<Role, Record<string, string>>;
  views: Record<ServiceRequestWorkspaceRole, ServiceRequestView>;
  nextId: number;
}
export type ServiceIssue =
  | "unavailable"
  | "property"
  | "category"
  | "provider"
  | "title"
  | "description"
  | "date"
  | "time"
  | "amount"
  | "scope"
  | "validUntil"
  | "note"
  | "status"
  | "staleQuote"
  | "expired"
  | "visitPast";
export type ServiceRequestErrors = Partial<
  Record<keyof ServiceRequestDraft, ServiceIssue>
>;
export type ServiceQuoteErrors = Partial<
  Record<keyof ServiceQuoteDraft, ServiceIssue>
>;
export type ServiceRequestAction =
  | { type: "accept"; quoteId: string }
  | { type: "decline"; quoteId: string; note: string }
  | { type: "decline-request"; note: string }
  | { type: "cancel"; note: string }
  | { type: "start" }
  | { type: "complete"; note: string };

export function isServiceCustomer(role: Role): role is ServiceCustomerRole {
  return role === "tenant" || role === "landlord";
}
const customerName = (role: ServiceCustomerRole) =>
  role === "tenant" ? "Inês Duarte" : workspaceLandlordName;
export function serviceProperties(role: Role) {
  return maintenanceHomesForRole(role)
    .map((home) => properties.find((property) => property.id === home.id)!)
    .filter(Boolean);
}
export function serviceProvidersForCategory(category: string) {
  return providers.filter((provider) => provider.type === category);
}
export function serviceDateValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function dateIsValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return serviceDateValue(new Date(year, month - 1, day)) === value;
}
function appointmentTimestamp(date: string, time: string): number | null {
  if (!dateIsValid(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.getHours() === Number(time.slice(0, 2)) &&
    parsed.getMinutes() === Number(time.slice(3))
    ? parsed.getTime()
    : null;
}
export function serviceAppointmentIsCurrent(
  date: string,
  time: string,
  now = new Date(),
): boolean {
  const timestamp = appointmentTimestamp(date, time);
  return (
    timestamp !== null &&
    timestamp >= Math.floor(now.getTime() / 60_000) * 60_000
  );
}
export function serviceAmountCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000
    ? cents
    : null;
}
const validLength = (value: string, min: number, max: number) =>
  value.trim().length >= min && value.trim().length <= max;
export function serviceRequestDraftKey(providerName?: string): string {
  return providerName &&
    providers.some((provider) => provider.name === providerName)
    ? `provider:${providerName}`
    : "general";
}
export function serviceRequestDraft(
  state: ServiceRequestState,
  role: Role,
  providerName?: string,
): ServiceRequestDraft {
  const selected = providers.find((provider) => provider.name === providerName);
  const stored = isServiceCustomer(role)
    ? state.drafts[role][serviceRequestDraftKey(providerName)]
    : undefined;
  return (
    stored ?? {
      propertyId: serviceProperties(role)[0]?.id.toString() ?? "",
      category: selected?.type ?? "",
      providerName: selected?.name ?? "",
      title: "",
      description: "",
      preferredDate: "",
      preferredTime: "",
    }
  );
}
export function updateServiceRequestDraft(
  state: ServiceRequestState,
  role: Role,
  patch: Partial<ServiceRequestDraft>,
  providerName?: string,
): ServiceRequestState {
  if (
    !isServiceCustomer(role) ||
    (providerName &&
      !providers.some((provider) => provider.name === providerName))
  )
    return state;
  const draft = serviceRequestDraft(state, role, providerName);
  const next = { ...draft };
  let changed = false;
  for (const name of Object.keys(draft) as Array<keyof ServiceRequestDraft>) {
    const value = patch[name];
    if (typeof value !== "string" || value === draft[name]) continue;
    next[name] = value;
    changed = true;
  }
  if (!changed) return state;
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [role]: {
        ...state.drafts[role],
        [serviceRequestDraftKey(providerName)]: next,
      },
    },
  };
}
export function validateServiceRequest(
  draft: ServiceRequestDraft,
  role: Role,
  now = new Date(),
): ServiceRequestErrors {
  const errors: ServiceRequestErrors = {};
  if (
    !isServiceCustomer(role) ||
    !/^\d+$/.test(draft.propertyId) ||
    !serviceProperties(role).some(
      (property) => property.id === Number(draft.propertyId),
    )
  )
    errors.propertyId = "property";
  if (!serviceCategories.includes(draft.category as ServiceCategory))
    errors.category = "category";
  if (
    !serviceProvidersForCategory(draft.category).some(
      (provider) => provider.name === draft.providerName,
    )
  )
    errors.providerName = "provider";
  if (!validLength(draft.title, 3, 120)) errors.title = "title";
  if (!validLength(draft.description, 20, 3000))
    errors.description = "description";
  if (
    !dateIsValid(draft.preferredDate) ||
    draft.preferredDate < serviceDateValue(now)
  )
    errors.preferredDate = "date";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.preferredTime) ||
    (!errors.preferredDate &&
      !serviceAppointmentIsCurrent(
        draft.preferredDate,
        draft.preferredTime,
        now,
      ))
  )
    errors.preferredTime = "time";
  return errors;
}
export function saveServiceRequest(
  state: ServiceRequestState,
  role: Role,
  providerName?: string,
  now = new Date(),
): {
  state: ServiceRequestState;
  requestId: string | null;
  errors: ServiceRequestErrors;
} {
  const draft = serviceRequestDraft(state, role, providerName);
  const errors = validateServiceRequest(draft, role, now);
  if (
    !isServiceCustomer(role) ||
    (providerName &&
      !providers.some((provider) => provider.name === providerName)) ||
    Object.keys(errors).length
  )
    return { state, requestId: null, errors };
  const id = `service-${state.nextId}`;
  const at = now.toISOString();
  const record: ServiceRequestRecord = {
    id,
    source: "local",
    customerRole: role,
    customerName: customerName(role),
    propertyId: Number(draft.propertyId),
    category: draft.category as ServiceCategory,
    providerName: draft.providerName,
    title: draft.title.trim(),
    description: draft.description.trim(),
    preferredDate: draft.preferredDate,
    preferredTime: draft.preferredTime,
    status: "Requested",
    quotes: [],
    history: [
      {
        id: `${id}-event-1`,
        at,
        actor: customerName(role),
        action: "requested",
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
  const drafts = { ...state.drafts[role] };
  delete drafts[serviceRequestDraftKey(providerName)];
  return {
    state: updateServiceRequestView(
      {
        ...state,
        records: [record, ...state.records],
        drafts: { ...state.drafts, [role]: drafts },
        nextId: state.nextId + 1,
      },
      role,
      { query: "", filter: "active", selectedId: id },
    ),
    requestId: id,
    errors: {},
  };
}
function customerOwnsRequest(
  record: ServiceRequestRecord,
  role: Role,
): boolean {
  return (
    isServiceCustomer(role) &&
    record.customerRole === role &&
    record.customerName === customerName(role) &&
    serviceProperties(role).some(
      (property) => property.id === record.propertyId,
    )
  );
}
function providerOwnsRequest(
  record: ServiceRequestRecord,
  role: Role,
): boolean {
  return (
    role === "provider" &&
    record.providerName === workspaceServiceProvider &&
    providers.some(
      (provider) =>
        provider.name === record.providerName &&
        provider.type === record.category,
    )
  );
}
export function visibleServiceRequests(
  state: ServiceRequestState,
  role: Role,
): ServiceRequestRecord[] {
  return state.records.filter(
    (record) =>
      customerOwnsRequest(record, role) || providerOwnsRequest(record, role),
  );
}
function defaultServiceRequestView(): ServiceRequestView {
  return { query: "", filter: "active", selectedId: null };
}
function isServiceRequestWorkspace(
  role: Role,
): role is ServiceRequestWorkspaceRole {
  return isServiceCustomer(role) || role === "provider";
}
function isServiceRequestFilter(value: unknown): value is ServiceRequestFilter {
  return value === "active" || value === "history" || value === "all";
}
export function serviceRequestView(
  state: ServiceRequestState,
  role: Role,
): ServiceRequestView {
  if (!isServiceRequestWorkspace(role)) return defaultServiceRequestView();
  const view = state.views[role];
  return {
    query: view.query,
    filter: view.filter,
    selectedId: visibleServiceRequests(state, role).some(
      (record) => record.id === view.selectedId,
    )
      ? view.selectedId
      : null,
  };
}
export function updateServiceRequestView(
  state: ServiceRequestState,
  role: Role,
  patch: Partial<ServiceRequestView>,
): ServiceRequestState {
  if (!isServiceRequestWorkspace(role) || !patch || typeof patch !== "object")
    return state;
  const current = serviceRequestView(state, role);
  const next = { ...current };
  if (typeof patch.query === "string") next.query = patch.query.slice(0, 200);
  if (isServiceRequestFilter(patch.filter)) next.filter = patch.filter;
  if (
    patch.selectedId === null ||
    (typeof patch.selectedId === "string" &&
      visibleServiceRequests(state, role).some(
        (record) => record.id === patch.selectedId,
      ))
  )
    next.selectedId = patch.selectedId;
  if (
    next.query === current.query &&
    next.filter === current.filter &&
    next.selectedId === current.selectedId
  )
    return state;
  return { ...state, views: { ...state.views, [role]: next } };
}
export function selectServiceRequest(
  state: ServiceRequestState,
  role: Role,
  id: string,
): ServiceRequestState {
  if (!isServiceRequestWorkspace(role)) return state;
  const record = visibleServiceRequests(state, role).find(
    (item) => item.id === id,
  );
  if (!record) return state;
  const current = serviceRequestView(state, role);
  return updateServiceRequestView(state, role, {
    query: "",
    filter:
      current.filter === "all"
        ? "all"
        : isTerminalServiceRequest(record.status)
          ? "history"
          : "active",
    selectedId: record.id,
  });
}
export function isTerminalServiceRequest(
  status: ServiceRequestStatus,
): boolean {
  return ["Cancelled", "Completed", "Provider declined"].includes(status);
}
export function serviceRequestCounts(state: ServiceRequestState, role: Role) {
  const records = visibleServiceRequests(state, role);
  return {
    total: records.length,
    active: records.filter((record) => !isTerminalServiceRequest(record.status))
      .length,
    requested: records.filter((record) => record.status === "Requested").length,
    quoted: records.filter((record) => record.status === "Quoted").length,
    accepted: records.filter((record) => record.status === "Accepted").length,
    inProgress: records.filter((record) => record.status === "In progress")
      .length,
    completed: records.filter((record) => record.status === "Completed").length,
    cancelled: records.filter((record) => record.status === "Cancelled").length,
    providerDeclined: records.filter(
      (record) => record.status === "Provider declined",
    ).length,
  };
}
export function latestServiceQuote(
  record: ServiceRequestRecord,
): ServiceQuote | undefined {
  return record.quotes.at(-1);
}
export function canQuoteServiceRequest(
  record: ServiceRequestRecord,
  role: Role,
): boolean {
  return (
    providerOwnsRequest(record, role) &&
    ["Requested", "Quoted", "Declined"].includes(record.status)
  );
}

/** Retained private work can be inspected or discarded after quoting closes. */
export function hasServiceQuoteDraft(
  state: ServiceRequestState,
  role: Role,
  id: string,
): boolean {
  const record = state.records.find((item) => item.id === id);
  return Boolean(
    record &&
    providerOwnsRequest(record, role) &&
    Object.hasOwn(state.quoteDrafts, id),
  );
}

export function discardServiceQuoteDraft(
  state: ServiceRequestState,
  role: Role,
  id: string,
): ServiceRequestState {
  if (!hasServiceQuoteDraft(state, role, id)) return state;
  const quoteDrafts = { ...state.quoteDrafts };
  delete quoteDrafts[id];
  return { ...state, quoteDrafts };
}

export function serviceQuoteDraft(
  state: ServiceRequestState,
  role: Role,
  id: string,
): ServiceQuoteDraft {
  const record = visibleServiceRequests(state, role).find(
    (item) => item.id === id,
  );
  if (!record || !providerOwnsRequest(record, role))
    return { amount: "", scope: "", date: "", time: "", validUntil: "" };
  const retained = state.quoteDrafts[id];
  if (retained) return { ...retained };
  const quote = latestServiceQuote(record);
  return {
    amount: quote ? (quote.amountCents / 100).toFixed(2) : "",
    scope: quote?.scope ?? "",
    date: quote?.date ?? record.preferredDate,
    time: quote?.time ?? record.preferredTime,
    validUntil: quote?.validUntil ?? "",
  };
}
export function updateServiceQuoteDraft(
  state: ServiceRequestState,
  role: Role,
  id: string,
  patch: Partial<ServiceQuoteDraft>,
): ServiceRequestState {
  const record = state.records.find((item) => item.id === id);
  if (!record || !canQuoteServiceRequest(record, role)) return state;
  const draft = serviceQuoteDraft(state, role, id);
  const next = { ...draft };
  let changed = false;
  for (const name of Object.keys(draft) as Array<keyof ServiceQuoteDraft>) {
    const value = patch[name];
    if (typeof value === "string" && value !== draft[name]) {
      next[name] = value;
      changed = true;
    }
  }
  return changed
    ? { ...state, quoteDrafts: { ...state.quoteDrafts, [id]: next } }
    : state;
}
export function validateServiceQuote(
  draft: ServiceQuoteDraft,
  now = new Date(),
): ServiceQuoteErrors {
  const errors: ServiceQuoteErrors = {};
  if (serviceAmountCents(draft.amount) === null) errors.amount = "amount";
  if (!validLength(draft.scope, 20, 3000)) errors.scope = "scope";
  if (!dateIsValid(draft.date) || draft.date < serviceDateValue(now))
    errors.date = "date";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time) ||
    (!errors.date && !serviceAppointmentIsCurrent(draft.date, draft.time, now))
  )
    errors.time = "time";
  if (
    !dateIsValid(draft.validUntil) ||
    draft.validUntil < serviceDateValue(now) ||
    (!errors.date && draft.validUntil > draft.date)
  )
    errors.validUntil = "validUntil";
  return errors;
}
function replaceServiceRequest(
  state: ServiceRequestState,
  record: ServiceRequestRecord,
): ServiceRequestState {
  return {
    ...state,
    records: state.records.map((item) =>
      item.id === record.id ? record : item,
    ),
  };
}
function withHistory(
  record: ServiceRequestRecord,
  action: ServiceRequestHistory["action"],
  actor: string,
  now: Date,
  note?: string,
  quoteId?: string,
): ServiceRequestRecord {
  const at = now.toISOString();
  return {
    ...record,
    updatedAt: at,
    history: [
      ...record.history,
      {
        id: `${record.id}-event-${record.history.length + 1}`,
        at,
        actor,
        action,
        ...(note ? { note: note.trim() } : {}),
        ...(quoteId ? { quoteId } : {}),
      },
    ],
  };
}
export function saveServiceQuote(
  state: ServiceRequestState,
  role: Role,
  id: string,
  now = new Date(),
): {
  state: ServiceRequestState;
  errors: ServiceQuoteErrors;
  issue?: ServiceIssue;
} {
  const record = state.records.find((item) => item.id === id);
  if (!record || !canQuoteServiceRequest(record, role))
    return { state, errors: {}, issue: "unavailable" };
  const draft = serviceQuoteDraft(state, role, id);
  const errors = validateServiceQuote(draft, now);
  if (Object.keys(errors).length) return { state, errors };
  const version = record.quotes.length + 1;
  const quote: ServiceQuote = {
    id: `${id}-quote-${version}`,
    version,
    amountCents: serviceAmountCents(draft.amount)!,
    scope: draft.scope.trim(),
    date: draft.date,
    time: draft.time,
    validUntil: draft.validUntil,
    recordedAt: now.toISOString(),
    decision: "Pending",
  };
  const quotes = record.quotes.map((previous) =>
    previous.decision === "Pending"
      ? { ...previous, decision: "Superseded" as const }
      : previous,
  );
  const updated = {
    ...withHistory(
      record,
      "quoted",
      workspaceServiceProvider,
      now,
      undefined,
      quote.id,
    ),
    status: "Quoted" as const,
    quotes: [...quotes, quote],
  };
  return {
    state: discardServiceQuoteDraft(
      replaceServiceRequest(state, updated),
      role,
      id,
    ),
    errors: {},
  };
}
export function serviceRequestActionIssue(
  state: ServiceRequestState,
  role: Role,
  id: string,
  action: ServiceRequestAction,
  now = new Date(),
): ServiceIssue | null {
  const record = state.records.find((item) => item.id === id);
  if (!record) return "unavailable";
  if (action.type === "decline-request") {
    if (!providerOwnsRequest(record, role)) return "unavailable";
    if (record.status !== "Requested") return "status";
    return validLength(action.note, 3, 2000) ? null : "note";
  }
  if (action.type === "start" || action.type === "complete") {
    if (!providerOwnsRequest(record, role)) return "unavailable";
    if (action.type === "start")
      return record.status === "Accepted" ? null : "status";
    if (record.status !== "In progress") return "status";
    return validLength(action.note, 3, 2000) ? null : "note";
  }
  if (!customerOwnsRequest(record, role)) return "unavailable";
  if (action.type === "cancel") {
    if (
      !["Requested", "Quoted", "Accepted", "Declined"].includes(record.status)
    )
      return "status";
    return validLength(action.note, 3, 2000) ? null : "note";
  }
  if (record.status !== "Quoted") return "status";
  const quote = latestServiceQuote(record);
  if (!quote || quote.id !== action.quoteId || quote.decision !== "Pending")
    return "staleQuote";
  if (action.type === "decline")
    return validLength(action.note, 3, 2000) ? null : "note";
  if (quote.validUntil < serviceDateValue(now)) return "expired";
  if (!serviceAppointmentIsCurrent(quote.date, quote.time, now))
    return "visitPast";
  return null;
}
export function actOnServiceRequest(
  state: ServiceRequestState,
  role: Role,
  id: string,
  action: ServiceRequestAction,
  now = new Date(),
): ServiceRequestState {
  if (serviceRequestActionIssue(state, role, id, action, now)) return state;
  const record = state.records.find((item) => item.id === id)!;
  const actor =
    role === "provider"
      ? workspaceServiceProvider
      : customerName(role as ServiceCustomerRole);
  const statuses: Record<ServiceRequestAction["type"], ServiceRequestStatus> = {
    accept: "Accepted",
    decline: "Declined",
    "decline-request": "Provider declined",
    cancel: "Cancelled",
    start: "In progress",
    complete: "Completed",
  };
  const actions: Record<
    ServiceRequestAction["type"],
    ServiceRequestHistory["action"]
  > = {
    accept: "accepted",
    decline: "declined",
    "decline-request": "provider-declined",
    cancel: "cancelled",
    start: "started",
    complete: "completed",
  };
  const note = "note" in action ? action.note : undefined;
  const quoteId = "quoteId" in action ? action.quoteId : undefined;
  const updated = {
    ...withHistory(record, actions[action.type], actor, now, note, quoteId),
    status: statuses[action.type],
  };
  if (action.type === "accept" || action.type === "decline")
    updated.quotes = record.quotes.map((quote) =>
      quote.id === action.quoteId
        ? {
            ...quote,
            decision: action.type === "accept" ? "Accepted" : "Declined",
            decidedAt: now.toISOString(),
            ...(note ? { decisionNote: note.trim() } : {}),
          }
        : quote,
    );
  const next: ServiceRequestState = {
    ...replaceServiceRequest(state, updated),
    actionNotes: {
      ...state.actionNotes,
      [role]: { ...state.actionNotes[role], [id]: "" },
    },
  };
  return isTerminalServiceRequest(updated.status)
    ? updateServiceRequestView(next, role, {
        query: "",
        filter: "history",
        selectedId: id,
      })
    : next;
}
export function updateServiceActionNote(
  state: ServiceRequestState,
  role: Role,
  id: string,
  note: string,
): ServiceRequestState {
  const record = visibleServiceRequests(state, role).find(
    (item) => item.id === id,
  );
  if (
    !record ||
    isTerminalServiceRequest(record.status) ||
    typeof note !== "string" ||
    note.length > 2000 ||
    state.actionNotes[role][id] === note
  )
    return state;
  return {
    ...state,
    actionNotes: {
      ...state.actionNotes,
      [role]: { ...state.actionNotes[role], [id]: note },
    },
  };
}
export function createInitialServiceRequestState(
  now = new Date(),
): ServiceRequestState {
  let state: ServiceRequestState = {
    records: [],
    drafts: { tenant: {}, landlord: {} },
    quoteDrafts: {},
    actionNotes: {
      tenant: {},
      landlord: {},
      provider: {},
      spaceOperator: {},
      admin: {},
    },
    views: {
      tenant: defaultServiceRequestView(),
      landlord: defaultServiceRequestView(),
      provider: defaultServiceRequestView(),
    },
    nextId: 1,
  };
  const appointment = new Date(now);
  appointment.setDate(appointment.getDate() + 3);
  const preferredDate = serviceDateValue(appointment);
  const examples: Array<{
    role: ServiceCustomerRole;
    providerName: string;
    title: string;
    description: string;
  }> = [
    {
      role: "tenant",
      providerName: workspaceServiceProvider,
      title: "Check the kitchen outlets",
      description:
        "One kitchen outlet is loose. Please inspect the outlet and explain the repair needed before starting work.",
    },
    {
      role: "tenant",
      providerName: "Casa Clara",
      title: "Deep cleaning request",
      description:
        "A one-off deep clean of the kitchen and bathroom. Please include products and the expected visit length in the quote.",
    },
    {
      role: "landlord",
      providerName: workspaceServiceProvider,
      title: "Inspect the hallway light",
      description:
        "The hallway light flickers. Please inspect the fitting and include labour and any proposed materials in the quote.",
    },
  ];
  for (const example of examples) {
    state = updateServiceRequestDraft(
      state,
      example.role,
      {
        title: example.title,
        description: example.description,
        preferredDate,
        preferredTime: "10:00",
      },
      example.providerName,
    );
    state = saveServiceRequest(
      state,
      example.role,
      example.providerName,
      now,
    ).state;
  }
  return {
    ...state,
    records: state.records.map((record) => ({
      ...record,
      source: "sample",
    })),
    views: {
      tenant: defaultServiceRequestView(),
      landlord: defaultServiceRequestView(),
      provider: defaultServiceRequestView(),
    },
  };
}
