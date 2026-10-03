import type { Property, Role } from "../types";
import { properties } from "../data";
import { ownsProperty } from "../propertyScope";

export interface ViewingRequestDraft {
  date: string;
  time: string;
  note: string;
}

export interface RentalApplicationDraft {
  moveInDate: string;
  householdSize: number;
  introduction: string;
}

export type RequestErrors = Partial<
  Record<"date" | "time" | "note" | "householdSize" | "introduction", string>
>;

export interface ViewingTerms {
  date: string;
  time: string;
}
export type ViewingStatus =
  "Pending" | "Proposed" | "Agreed" | "Declined" | "Cancelled";
export type ViewingFilter =
  "All" | "Pending" | "Proposed" | "Agreed" | "History";
export type ViewingActionDraft = ViewingRequestDraft;
export interface ViewingProposal {
  id: string;
  version: number;
  terms: ViewingTerms;
  note: string;
  status: "Pending" | "Accepted" | "Declined" | "Superseded" | "Withdrawn";
  createdAt: string;
  decidedAt?: string;
}
export interface ViewingHistoryEvent {
  id: string;
  action:
    | "requested"
    | "accepted"
    | "declined"
    | "proposed"
    | "proposal-accepted"
    | "proposal-declined"
    | "cancelled";
  actor: Role;
  at: string;
  note?: string;
  terms?: ViewingTerms;
  proposalId?: string;
}
export interface ViewingIssue {
  code:
    | "unavailable"
    | "invalidProperty"
    | "duplicate"
    | "invalidDate"
    | "invalidTime"
    | "pastTime"
    | "noteTooLong"
    | "noteRequired"
    | "staleProposal"
    | "noChanges";
  requestId?: string;
}
export type ViewingErrors = Partial<
  Record<"date" | "time" | "note", ViewingIssue["code"]>
>;
export type ViewingAction =
  | { type: "accept-request" }
  | { type: "decline-request" }
  | { type: "cancel" }
  | { type: "accept-proposal"; proposalId: string }
  | { type: "decline-proposal"; proposalId: string };

export interface ViewingRequest {
  id: string;
  propertyId: number;
  role: Role;
  date: string;
  time: string;
  note: string;
  status: ViewingStatus;
  tenantId: string;
  tenantName: string;
  requestedTerms: ViewingTerms;
  agreedTerms?: ViewingTerms;
  proposals: ViewingProposal[];
  history: ViewingHistoryEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRequestState {
  viewings: ViewingRequest[];
  drafts?: Record<number, ViewingRequestDraft>;
  actionDrafts?: Partial<Record<Role, Record<string, ViewingActionDraft>>>;
  views?: Partial<
    Record<Role, { filter: ViewingFilter; selectedId: string | null }>
  >;
  nextId?: number;
}

export function createInitialPropertyRequestState(): PropertyRequestState {
  return { viewings: [] };
}

export function localDateValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function futureLocalDate(days: number, now = new Date()): string {
  return localDateValue(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days),
  );
}

export function isCurrentOrFutureDate(
  value: string,
  now = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateValue(date) === value && value >= localDateValue(now);
}

export function validateViewingRequest(
  draft: ViewingRequestDraft,
  now = new Date(),
): RequestErrors {
  const errors: RequestErrors = {};
  if (!isCurrentOrFutureDate(draft.date, now))
    errors.date = "Choose today or a future date.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) {
    errors.time = "Choose a valid viewing time.";
  } else if (!errors.date) {
    const [year, month, day] = draft.date.split("-").map(Number);
    const [hour, minute] = draft.time.split(":").map(Number);
    const requested = new Date(year, month - 1, day, hour, minute);
    if (
      requested.getTime() <= now.getTime() ||
      requested.getHours() !== hour ||
      requested.getMinutes() !== minute
    ) {
      errors.time = "Choose a time that is still in the future.";
    }
  }
  if (draft.note.trim().length > 1000)
    errors.note = "Use 1,000 characters or fewer.";
  return errors;
}

export function validateRentalApplication(
  draft: RentalApplicationDraft,
  now = new Date(),
): RequestErrors {
  const errors: RequestErrors = {};
  if (!isCurrentOrFutureDate(draft.moveInDate, now))
    errors.date = "Choose today or a future move-in date.";
  if (!Number.isSafeInteger(draft.householdSize) || draft.householdSize < 1)
    errors.householdSize =
      "Enter the number of people as a whole number of 1 or more.";
  if (draft.introduction.trim().length > 1000)
    errors.introduction = "Use 1,000 characters or fewer.";
  return errors;
}

export function viewingForProperty(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
  now = new Date(),
) {
  const records = scopedViewingRequests(state, role).filter(
    (request) => request.propertyId === propertyId,
  );
  return records.find((request) => isActiveViewing(request, now)) ?? records[0];
}

export function saveViewingRequest(
  state: PropertyRequestState,
  role: Role,
  property: Pick<Property, "id">,
  draft: ViewingRequestDraft,
  now = new Date(),
): PropertyRequestState {
  if (
    role !== "tenant" ||
    Object.keys(validateViewingRequest(draft, now)).length
  )
    return state;
  const updated = updateViewingDraft(state, role, property.id, draft);
  const result = createViewingRequest(updated, role, property.id, now);
  return result.requestId ? result.state : state;
}

export function cancelViewingRequest(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
  now = new Date(),
): PropertyRequestState {
  if (role !== "tenant") return state;
  const request = viewingForProperty(state, role, propertyId, now);
  if (!request) return state;
  return actOnViewingRequest(state, role, request.id, { type: "cancel" }, now);
}

const viewingTenant = { id: "tenant-ines", name: "Inês Duarte" };
const emptyViewingDraft = (): ViewingRequestDraft => ({
  date: "",
  time: "",
  note: "",
});
const canonicalProperty = (id: number) =>
  properties.find((property) => property.id === id);

function ownsViewing(request: ViewingRequest, role: Role): boolean {
  return (
    request.role === "tenant" &&
    Boolean(canonicalProperty(request.propertyId)) &&
    (role === "tenant"
      ? request.tenantId === viewingTenant.id
      : role === "landlord" && ownsProperty(role, request.propertyId))
  );
}

function viewingTime(terms: ViewingTerms): number {
  return new Date(`${terms.date}T${terms.time}:00`).getTime();
}

export function isActiveViewing(
  request: ViewingRequest,
  now = new Date(),
): boolean {
  return (
    request.status === "Pending" ||
    request.status === "Proposed" ||
    (request.status === "Agreed" &&
      Boolean(request.agreedTerms) &&
      viewingTime(request.agreedTerms!) > now.getTime())
  );
}

/** One active request per applicant/property; this is not a time-slot exclusivity rule. */
function competingActiveViewing(
  state: PropertyRequestState,
  request: ViewingRequest,
  now: Date,
): ViewingRequest | undefined {
  return state.viewings.find(
    (other) =>
      other.id !== request.id &&
      other.role === "tenant" &&
      other.tenantId === request.tenantId &&
      other.propertyId === request.propertyId &&
      isActiveViewing(other, now),
  );
}

export function pendingViewingProposal(
  request: ViewingRequest,
): ViewingProposal | null {
  const proposal = request.proposals.at(-1);
  return proposal?.status === "Pending" ? proposal : null;
}

export function viewingDraft(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
): ViewingRequestDraft | null {
  if (role !== "tenant" || !canonicalProperty(propertyId)) return null;
  return state.drafts?.[propertyId] ?? emptyViewingDraft();
}

export function viewingDrafts(
  state: PropertyRequestState,
  role: Role,
): { propertyId: number; draft: ViewingRequestDraft }[] {
  if (role !== "tenant") return [];
  return Object.entries(state.drafts ?? {}).flatMap(([id, draft]) =>
    canonicalProperty(Number(id)) ? [{ propertyId: Number(id), draft }] : [],
  );
}

export function updateViewingDraft(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
  patch: Partial<ViewingRequestDraft>,
): PropertyRequestState {
  const draft = viewingDraft(state, role, propertyId);
  if (!draft) return state;
  const updated = {
    date: patch.date ?? draft.date,
    time: patch.time ?? draft.time,
    note: patch.note ?? draft.note,
  };
  if (
    state.drafts?.[propertyId] &&
    updated.date === draft.date &&
    updated.time === draft.time &&
    updated.note === draft.note
  )
    return state;
  return { ...state, drafts: { ...state.drafts, [propertyId]: updated } };
}

export function discardViewingDraft(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
): PropertyRequestState {
  if (!viewingDraft(state, role, propertyId) || !state.drafts?.[propertyId])
    return state;
  const drafts = { ...state.drafts };
  delete drafts[propertyId];
  return { ...state, drafts };
}

/** Coded viewing errors preserve the existing rental/date validation exports. */
export function viewingDraftErrors(
  draft: ViewingRequestDraft,
  now = new Date(),
): ViewingErrors {
  const errors: ViewingErrors = {};
  if (!isCurrentOrFutureDate(draft.date, now)) errors.date = "invalidDate";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
    errors.time = "invalidTime";
  else if (
    !errors.date &&
    validateViewingRequest({ ...draft, note: "" }, now).time
  )
    errors.time = "pastTime";
  if (draft.note.trim().length > 1000) errors.note = "noteTooLong";
  return errors;
}

export function createViewingRequest(
  state: PropertyRequestState,
  role: Role,
  propertyId: number,
  now = new Date(),
): {
  state: PropertyRequestState;
  requestId: string | null;
  errors: ViewingErrors;
  issue: ViewingIssue | null;
} {
  const failure = (issue: ViewingIssue | null, errors: ViewingErrors = {}) => ({
    state,
    requestId: null,
    errors,
    issue,
  });
  if (role !== "tenant") return failure({ code: "unavailable" });
  if (!canonicalProperty(propertyId))
    return failure({ code: "invalidProperty" });
  const draft = viewingDraft(state, role, propertyId)!;
  const errors = viewingDraftErrors(draft, now);
  if (Object.keys(errors).length) return failure(null, errors);
  const duplicate = scopedViewingRequests(state, role).find(
    (request) =>
      request.propertyId === propertyId && isActiveViewing(request, now),
  );
  if (duplicate) return failure({ code: "duplicate", requestId: duplicate.id });
  let nextId = state.nextId ?? 1;
  while (state.viewings.some((request) => request.id === `viewing-${nextId}`))
    nextId++;
  const id = `viewing-${nextId}`;
  const at = now.toISOString();
  const terms = { date: draft.date, time: draft.time };
  const request: ViewingRequest = {
    id,
    propertyId,
    role: "tenant",
    tenantId: viewingTenant.id,
    tenantName: viewingTenant.name,
    ...terms,
    note: draft.note.trim(),
    status: "Pending",
    requestedTerms: { ...terms },
    proposals: [],
    history: [
      {
        id: `${id}-event-1`,
        action: "requested",
        actor: role,
        at,
        note: draft.note.trim(),
        terms: { ...terms },
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
  const cleared = discardViewingDraft(state, role, propertyId);
  return {
    state: {
      ...cleared,
      nextId: nextId + 1,
      viewings: [...state.viewings, request],
      views: { ...state.views, tenant: { filter: "Pending", selectedId: id } },
    },
    requestId: id,
    errors: {},
    issue: null,
  };
}

export function scopedViewingRequests(
  state: PropertyRequestState,
  role: Role,
): ViewingRequest[] {
  return state.viewings
    .filter((request) => ownsViewing(request, role))
    .slice()
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function viewingView(
  state: PropertyRequestState,
  role: Role,
): { filter: ViewingFilter; selectedId: string | null } {
  return state.views?.[role] ?? { filter: "All", selectedId: null };
}

function viewingMatchesFilter(
  request: ViewingRequest,
  filter: ViewingFilter,
  now: Date,
): boolean {
  if (filter === "All") return true;
  if (filter === "Pending" || filter === "Proposed")
    return request.status === filter;
  if (filter === "Agreed")
    return (
      Boolean(request.agreedTerms) &&
      !["Cancelled", "Declined"].includes(request.status) &&
      viewingTime(request.agreedTerms!) > now.getTime()
    );
  return (
    request.status === "Cancelled" ||
    request.status === "Declined" ||
    (request.status === "Agreed" &&
      Boolean(request.agreedTerms) &&
      viewingTime(request.agreedTerms!) <= now.getTime())
  );
}

export function visibleViewingRequests(
  state: PropertyRequestState,
  role: Role,
  now = new Date(),
): ViewingRequest[] {
  return scopedViewingRequests(state, role).filter((request) =>
    viewingMatchesFilter(request, viewingView(state, role).filter, now),
  );
}

export function selectedViewingRequest(
  state: PropertyRequestState,
  role: Role,
  now = new Date(),
): ViewingRequest | undefined {
  const records = visibleViewingRequests(state, role, now);
  return (
    records.find(
      (request) => request.id === viewingView(state, role).selectedId,
    ) ?? records[0]
  );
}

export function setViewingFilter(
  state: PropertyRequestState,
  role: Role,
  filter: ViewingFilter,
): PropertyRequestState {
  if (
    !["tenant", "landlord"].includes(role) ||
    !["All", "Pending", "Proposed", "Agreed", "History"].includes(filter)
  )
    return state;
  return {
    ...state,
    views: { ...state.views, [role]: { ...viewingView(state, role), filter } },
  };
}

export function selectViewingRequest(
  state: PropertyRequestState,
  role: Role,
  id: string,
): PropertyRequestState {
  const request = state.viewings.find((record) => record.id === id);
  if (!request || !ownsViewing(request, role)) return state;
  return {
    ...state,
    views: { ...state.views, [role]: { filter: "All", selectedId: id } },
  };
}

/** Ordinary row selection stays inside the current workspace and list filter. */
export function selectVisibleViewingRequest(
  state: PropertyRequestState,
  role: Role,
  id: string,
  now = new Date(),
): PropertyRequestState {
  if (
    !visibleViewingRequests(state, role, now).some(
      (request) => request.id === id,
    )
  )
    return state;
  const view = viewingView(state, role);
  if (view.selectedId === id) return state;
  return {
    ...state,
    views: { ...state.views, [role]: { ...view, selectedId: id } },
  };
}

export function viewingCounts(
  state: PropertyRequestState,
  role: Role,
  now = new Date(),
) {
  const records = scopedViewingRequests(state, role);
  return {
    total: records.length,
    pending: records.filter((request) => request.status === "Pending").length,
    proposed: records.filter((request) => request.status === "Proposed").length,
    agreed: records.filter((request) =>
      viewingMatchesFilter(request, "Agreed", now),
    ).length,
    history: records.filter((request) =>
      viewingMatchesFilter(request, "History", now),
    ).length,
    drafts: viewingDrafts(state, role).length,
  };
}

export function upcomingAgreedViewings(
  state: PropertyRequestState,
  role: Role,
  now = new Date(),
): ViewingRequest[] {
  return scopedViewingRequests(state, role)
    .filter((request) => viewingMatchesFilter(request, "Agreed", now))
    .sort((a, b) => viewingTime(a.agreedTerms!) - viewingTime(b.agreedTerms!));
}

export function viewingActionDraft(
  state: PropertyRequestState,
  role: Role,
  id: string,
): ViewingActionDraft | null {
  const request = state.viewings.find((record) => record.id === id);
  if (!request || !ownsViewing(request, role)) return null;
  const terms =
    pendingViewingProposal(request)?.terms ??
    request.agreedTerms ??
    request.requestedTerms;
  const retained = state.actionDrafts?.[role]?.[id];
  return retained ? { ...retained } : { ...terms, note: "" };
}

export function hasViewingActionDraft(
  state: PropertyRequestState,
  role: Role,
  id: string,
): boolean {
  const request = state.viewings.find((record) => record.id === id);
  return Boolean(
    request &&
    ownsViewing(request, role) &&
    Object.hasOwn(state.actionDrafts?.[role] ?? {}, id),
  );
}

export function updateViewingActionDraft(
  state: PropertyRequestState,
  role: Role,
  id: string,
  patch: Partial<ViewingActionDraft>,
): PropertyRequestState {
  const request = state.viewings.find((record) => record.id === id);
  if (
    !request ||
    ["Cancelled", "Declined"].includes(request.status) ||
    !patch ||
    typeof patch !== "object"
  )
    return state;
  const draft = viewingActionDraft(state, role, id);
  if (!draft) return state;
  const next = { ...draft };
  let recognized = false;
  for (const field of ["date", "time", "note"] as const) {
    if (
      (field === "note" || role === "landlord") &&
      Object.hasOwn(patch, field) &&
      typeof patch[field] === "string"
    ) {
      next[field] = patch[field];
      recognized = true;
    }
  }
  if (
    !recognized ||
    (hasViewingActionDraft(state, role, id) &&
      next.date === draft.date &&
      next.time === draft.time &&
      next.note === draft.note)
  )
    return state;
  return {
    ...state,
    actionDrafts: {
      ...state.actionDrafts,
      [role]: {
        ...state.actionDrafts?.[role],
        [id]: next,
      },
    },
  };
}

/** Private responses remain disposable after either party closes the request. */
export function discardViewingActionDraft(
  state: PropertyRequestState,
  role: Role,
  id: string,
): PropertyRequestState {
  if (!hasViewingActionDraft(state, role, id)) return state;
  const drafts = { ...state.actionDrafts?.[role] };
  delete drafts[id];
  return { ...state, actionDrafts: { ...state.actionDrafts, [role]: drafts } };
}

function canProposeViewing(request: ViewingRequest, role: Role): boolean {
  return (
    role === "landlord" &&
    ownsViewing(request, role) &&
    ["Pending", "Proposed", "Agreed"].includes(request.status)
  );
}

export function validateViewingProposal(
  state: PropertyRequestState,
  role: Role,
  id: string,
  now = new Date(),
): ViewingErrors {
  const request = state.viewings.find((record) => record.id === id);
  if (!request || !canProposeViewing(request, role))
    return { note: "unavailable" };
  if (competingActiveViewing(state, request, now)) return { note: "duplicate" };
  const draft = viewingActionDraft(state, role, id)!;
  const errors = viewingDraftErrors(draft, now);
  if (draft.note.trim().length < 3) errors.note = "noteRequired";
  const unchanged = (terms: ViewingTerms) =>
    draft.date === terms.date && draft.time === terms.time;
  if (
    !errors.date &&
    !errors.time &&
    (unchanged(request.agreedTerms ?? request.requestedTerms) ||
      (pendingViewingProposal(request) &&
        unchanged(pendingViewingProposal(request)!.terms)))
  )
    errors.time = "noChanges";
  return errors;
}

function replaceViewing(
  state: PropertyRequestState,
  updated: ViewingRequest,
): PropertyRequestState {
  return {
    ...state,
    viewings: state.viewings.map((request) =>
      request.id === updated.id ? updated : request,
    ),
  };
}

export function saveViewingProposal(
  state: PropertyRequestState,
  role: Role,
  id: string,
  now = new Date(),
): {
  state: PropertyRequestState;
  proposalId: string | null;
  errors: ViewingErrors;
  issue: ViewingIssue | null;
} {
  const request = state.viewings.find((record) => record.id === id);
  if (!request || !canProposeViewing(request, role))
    return {
      state,
      proposalId: null,
      errors: {},
      issue: { code: "unavailable" },
    };
  const competing = competingActiveViewing(state, request, now);
  if (competing)
    return {
      state,
      proposalId: null,
      errors: {},
      issue: { code: "duplicate", requestId: competing.id },
    };
  const errors = validateViewingProposal(state, role, id, now);
  if (Object.keys(errors).length)
    return { state, proposalId: null, errors, issue: null };
  const draft = viewingActionDraft(state, role, id)!;
  const version = (request.proposals.at(-1)?.version ?? 0) + 1;
  const at = now.toISOString();
  const proposal: ViewingProposal = {
    id: `${id}-proposal-${version}`,
    version,
    terms: { date: draft.date, time: draft.time },
    note: draft.note.trim(),
    status: "Pending",
    createdAt: at,
  };
  const updated: ViewingRequest = {
    ...request,
    status: "Proposed",
    updatedAt: at,
    proposals: [
      ...request.proposals.map((item): ViewingProposal =>
        item.status === "Pending"
          ? { ...item, status: "Superseded", decidedAt: at }
          : item,
      ),
      proposal,
    ],
    history: [
      ...request.history,
      {
        id: `${id}-event-${request.history.length + 1}`,
        action: "proposed",
        actor: role,
        at,
        note: proposal.note,
        terms: { ...proposal.terms },
        proposalId: proposal.id,
      },
    ],
  };
  return {
    state: discardViewingActionDraft(replaceViewing(state, updated), role, id),
    proposalId: proposal.id,
    errors: {},
    issue: null,
  };
}

export function viewingActionIssue(
  state: PropertyRequestState,
  role: Role,
  id: string,
  action: ViewingAction,
  now = new Date(),
): ViewingIssue | null {
  const request = state.viewings.find((record) => record.id === id);
  if (
    !request ||
    !ownsViewing(request, role) ||
    ["Cancelled", "Declined"].includes(request.status)
  )
    return { code: "unavailable" };
  const draft = viewingActionDraft(state, role, id)!;
  if (action.type === "accept-request" || action.type === "accept-proposal") {
    const competing = competingActiveViewing(state, request, now);
    if (competing) return { code: "duplicate", requestId: competing.id };
  }
  if (action.type === "accept-request") {
    if (
      role !== "landlord" ||
      request.status !== "Pending" ||
      request.agreedTerms ||
      pendingViewingProposal(request)
    )
      return { code: "unavailable" };
    const errors = viewingDraftErrors(
      { ...request.requestedTerms, note: "" },
      now,
    );
    const code = errors.date ?? errors.time;
    return code ? { code } : null;
  }
  if (action.type === "decline-request") {
    if (
      role !== "landlord" ||
      request.agreedTerms ||
      !["Pending", "Proposed"].includes(request.status)
    )
      return { code: "unavailable" };
    if (draft.note.trim().length < 3) return { code: "noteRequired" };
    return draft.note.trim().length > 1000 ? { code: "noteTooLong" } : null;
  }
  if (action.type === "cancel") {
    if (role === "landlord" && draft.note.trim().length < 3)
      return { code: "noteRequired" };
    return draft.note.trim().length > 1000 ? { code: "noteTooLong" } : null;
  }
  if (role !== "tenant") return { code: "unavailable" };
  const proposal = pendingViewingProposal(request);
  if (!proposal || proposal.id !== action.proposalId)
    return { code: "staleProposal" };
  if (action.type === "accept-proposal") {
    const errors = viewingDraftErrors({ ...proposal.terms, note: "" }, now);
    const code = errors.date ?? errors.time;
    return code ? { code } : null;
  }
  return null;
}

export function actOnViewingRequest(
  state: PropertyRequestState,
  role: Role,
  id: string,
  action: ViewingAction,
  now = new Date(),
): PropertyRequestState {
  if (viewingActionIssue(state, role, id, action, now)) return state;
  const request = state.viewings.find((record) => record.id === id)!;
  const draft = viewingActionDraft(state, role, id)!;
  const at = now.toISOString();
  const event: ViewingHistoryEvent = {
    id: `${id}-event-${request.history.length + 1}`,
    action: "accepted",
    actor: role,
    at,
  };
  let updated: ViewingRequest = { ...request, updatedAt: at };
  if (action.type === "accept-request") {
    updated = {
      ...updated,
      ...request.requestedTerms,
      agreedTerms: { ...request.requestedTerms },
      status: "Agreed",
    };
    event.terms = { ...request.requestedTerms };
  } else if (action.type === "cancel" || action.type === "decline-request") {
    updated.status = action.type === "cancel" ? "Cancelled" : "Declined";
    event.action = action.type === "cancel" ? "cancelled" : "declined";
    event.note = draft.note.trim();
    updated.proposals = request.proposals.map((proposal) =>
      proposal.status === "Pending"
        ? { ...proposal, status: "Withdrawn", decidedAt: at }
        : proposal,
    );
  } else {
    const proposal = pendingViewingProposal(request)!;
    const accepted = action.type === "accept-proposal";
    updated.proposals = request.proposals.map((item) =>
      item.id === proposal.id
        ? { ...item, status: accepted ? "Accepted" : "Declined", decidedAt: at }
        : item,
    );
    if (accepted)
      updated = {
        ...updated,
        ...proposal.terms,
        agreedTerms: { ...proposal.terms },
        status: "Agreed",
      };
    else updated.status = request.agreedTerms ? "Agreed" : "Pending";
    event.action = accepted ? "proposal-accepted" : "proposal-declined";
    event.terms = { ...proposal.terms };
    event.proposalId = proposal.id;
  }
  updated.history = [...request.history, event];
  const next = replaceViewing(state, updated);
  return action.type === "cancel" || action.type === "decline-request"
    ? discardViewingActionDraft(next, role, id)
    : next;
}
