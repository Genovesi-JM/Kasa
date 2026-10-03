import { applications, properties } from "../data";
import type { Application, Property, Role } from "../types";
import { ownsProperty } from "../propertyScope";
import {
  documentFileDescriptor,
  documentFileIssue,
  type DocumentKind,
} from "./documentState";
import {
  futureLocalDate,
  validateRentalApplication,
  type RentalApplicationDraft,
  type RequestErrors,
} from "./propertyRequestState";

const tenantIdentity = { id: "tenant-ines", name: "Inês Duarte", avatar: "ID" };

export interface ApplicationDocument {
  id: string;
  name: string;
  status: "Supplied" | "Missing" | "Requested";
  summary: string;
}

export const MAX_APPLICATION_EVIDENCE_BYTES = 50 * 1024 * 1024;
export const MAX_APPLICATION_EVIDENCE_FILES = 10;
export const MAX_APPLICATION_EVIDENCE_NOTE = 1000;

export interface ApplicationEvidenceFile {
  id: string;
  documentId: string;
  file: File;
  kind: DocumentKind;
  mimeType: string;
  addedAt: string;
}

export interface ApplicationEvidenceRequest {
  id: string;
  version: number;
  documentIds: readonly string[];
  note: string;
  createdAt: string;
}

export interface ApplicationEvidenceResponse {
  id: string;
  version: number;
  requestId: string | null;
  note: string;
  files: readonly ApplicationEvidenceFile[];
  submittedAt: string;
}

export interface ApplicationEvidenceDraft {
  requestId: string | null;
  revision: number;
  note: string;
  files: ApplicationEvidenceFile[];
}

export interface ApplicationEvidenceIssue {
  code:
    | "unavailable"
    | "staleRequest"
    | "emptyResponse"
    | "noteTooLong"
    | "unknownDocument"
    | "empty"
    | "fileTooLarge"
    | "unsupportedFormat"
    | "alreadyAdded"
    | "evidenceFull"
    | "tooManyFiles";
  fileName?: string;
}

export interface ApplicationEvidenceSummary {
  phase: "none" | "requested" | "submitted" | "reviewed";
  latestRequest: ApplicationEvidenceRequest | null;
  latestResponse: ApplicationEvidenceResponse | null;
  requestOpen: boolean;
  outstandingDocumentIds: string[];
  unreviewedResponseIds: string[];
}

export interface ApplicationActivityEvent {
  id: string;
  label: string;
  at: string;
  source: "sample" | "local";
  actor: "tenant" | "landlord" | null;
  action:
    | "sample"
    | "application-submitted"
    | "application-reviewed"
    | "application-approved"
    | "evidence-requested"
    | "evidence-response-saved"
    | "evidence-acknowledged"
    | "evidence-request-closed";
  requestId?: string | null;
  responseId?: string;
}

export interface ApplicationRecord extends Omit<
  Application,
  "score" | "submitted"
> {
  propertyId?: number;
  tenantId?: string;
  submission?: RentalApplicationDraft;
  submittedAt: string;
  profileFields: Array<{ label: string; present: boolean }>;
  documents: ApplicationDocument[];
  reviewed: boolean;
  documentRequest: string;
  evidenceRequests?: readonly ApplicationEvidenceRequest[];
  evidenceResponses?: readonly ApplicationEvidenceResponse[];
  evidenceReviews?: readonly { responseId: string; at: string }[];
  evidenceClosures?: readonly { requestId: string; at: string }[];
  activity: ApplicationActivityEvent[];
}

export interface ApplicationState {
  records: ApplicationRecord[];
  views?: Record<"tenant" | "landlord", ApplicationView>;
  rentalDrafts?: Partial<Record<number, RentalApplicationComposerDraft>>;
  evidenceDrafts?: Record<number, ApplicationEvidenceDraft>;
  evidenceRevision?: number;
  nextEvidenceId?: number;
}

export interface ApplicationView {
  query: string;
  status: "All" | "Review" | "Documents" | "Approved" | "Draft";
  property: string;
  completeness: "Any completeness" | "80" | "100";
  sort:
    | "Newest submitted"
    | "Oldest submitted"
    | "Most complete"
    | "Action required first";
}

export interface RentalApplicationComposerDraft {
  moveInDate: string;
  householdSize: string;
  introduction: string;
}

export type ApplicationAction =
  | { type: "mark-reviewed" }
  | { type: "approve" }
  | { type: "request-documents"; documentIds: string[]; note: string }
  | { type: "acknowledge-evidence"; responseId: string }
  | { type: "close-evidence-request"; requestId: string };

export function createInitialApplicationState(): ApplicationState {
  const dates = [
    "2026-08-21T09:42:00Z",
    "2026-08-20T14:30:00Z",
    "2026-08-18T10:00:00Z",
    "2026-08-16T16:10:00Z",
  ];
  return {
    views: {
      tenant: createApplicationView(),
      landlord: createApplicationView(),
    },
    rentalDrafts: {},
    records: applications.map((application, index) => ({
      id: application.id,
      applicant: application.applicant,
      property: application.property,
      propertyId: properties.find(
        (property) => property.title === application.property,
      )?.id,
      tenantId:
        application.applicant === tenantIdentity.name
          ? tenantIdentity.id
          : undefined,
      status: application.status,
      avatar: application.avatar,
      submittedAt: dates[index],
      reviewed: application.status === "Approved",
      documentRequest:
        application.status === "Documents"
          ? "Please add the missing proof-of-income summary."
          : "",
      evidenceRequests:
        application.status === "Documents"
          ? [
              {
                id: `evidence-request-${application.id}-1`,
                version: 1,
                documentIds: ["income"],
                note: "Please add the missing proof-of-income summary.",
                createdAt: dates[index],
              },
            ]
          : [],
      profileFields: [
        { label: "Contact details", present: true },
        { label: "Household details", present: true },
        {
          label: "Preferred move-in date",
          present: application.status !== "Draft",
        },
        { label: "Rental preferences", present: true },
        {
          label: "Applicant introduction",
          present: !["Draft", "Documents"].includes(application.status),
        },
      ],
      documents: [
        {
          id: "identity",
          name: "Identity document",
          status: "Supplied",
          summary:
            "Sample identity-document record. No actual identity file is stored or verified.",
        },
        {
          id: "income",
          name: "Proof of income",
          status:
            application.status === "Documents"
              ? "Requested"
              : application.status === "Draft"
                ? "Missing"
                : "Supplied",
          summary:
            "Sample income-document summary. No income amounts or assessment are included.",
        },
        {
          id: "reference",
          name: "Rental reference",
          status: application.status === "Draft" ? "Missing" : "Supplied",
          summary:
            "Sample rental-reference record. Kasa has not contacted or checked a referee.",
        },
      ],
      activity: [
        {
          id: `initial-${application.id}`,
          source: "sample",
          actor: null,
          action: "sample",
          label:
            application.status === "Draft"
              ? "Sample draft created"
              : application.status === "Approved"
                ? "Sample application marked approved"
                : "Sample application added for review",
          at: dates[index],
        },
      ],
    })),
  };
}

export function applicationCompleteness(record: ApplicationRecord): number {
  if (!record.profileFields.length) return 0;
  return Math.round(
    (record.profileFields.filter((field) => field.present).length /
      record.profileFields.length) *
      100,
  );
}

export function visibleApplicationRecords(
  state: ApplicationState,
  role: Role,
): ApplicationRecord[] {
  if (role === "landlord")
    return state.records.filter(
      (record) =>
        record.propertyId !== undefined &&
        ownsProperty(role, record.propertyId),
    );
  if (role === "tenant") return state.records.filter(isTenantApplication);
  return [];
}

function createApplicationView(): ApplicationView {
  return {
    query: "",
    status: "All",
    property: "All properties",
    completeness: "Any completeness",
    sort: "Newest submitted",
  };
}

export function applicationView(
  state: ApplicationState,
  role: Role,
): ApplicationView {
  return role === "tenant" || role === "landlord"
    ? { ...(state.views?.[role] ?? createApplicationView()) }
    : createApplicationView();
}

/** Filter choices expose only canonical properties referenced by this workspace's records. */
export function applicationPropertyOptions(
  state: ApplicationState,
  role: Role,
): Array<{ id: number; title: string }> {
  const records = visibleApplicationRecords(state, role);
  return properties
    .filter((property) =>
      records.some((record) =>
        record.propertyId !== undefined
          ? record.propertyId === property.id
          : record.property === property.title,
      ),
    )
    .map((property) => ({ id: property.id, title: property.title }));
}

export function updateApplicationView(
  state: ApplicationState,
  role: Role,
  patch: Partial<ApplicationView>,
): ApplicationState {
  if (
    (role !== "tenant" && role !== "landlord") ||
    !patch ||
    typeof patch !== "object"
  )
    return state;
  const current = applicationView(state, role);
  const next = { ...current };
  if (typeof patch.query === "string") next.query = patch.query.slice(0, 200);
  if (
    typeof patch.status === "string" &&
    ["All", "Review", "Documents", "Approved", "Draft"].includes(patch.status)
  )
    next.status = patch.status;
  if (
    patch.property === "All properties" ||
    (typeof patch.property === "string" &&
      applicationPropertyOptions(state, role).some(
        (property) => String(property.id) === patch.property,
      ))
  )
    next.property = patch.property;
  if (
    patch.completeness === "Any completeness" ||
    patch.completeness === "80" ||
    patch.completeness === "100"
  )
    next.completeness = patch.completeness;
  if (
    typeof patch.sort === "string" &&
    [
      "Newest submitted",
      "Oldest submitted",
      "Most complete",
      "Action required first",
    ].includes(patch.sort)
  )
    next.sort = patch.sort;
  if (
    (Object.keys(current) as Array<keyof ApplicationView>).every(
      (field) => current[field] === next[field],
    )
  )
    return state;
  return {
    ...state,
    views: {
      tenant: state.views?.tenant ?? createApplicationView(),
      landlord: state.views?.landlord ?? createApplicationView(),
      [role]: next,
    },
  };
}

export function resetApplicationView(
  state: ApplicationState,
  role: Role,
): ApplicationState {
  return updateApplicationView(state, role, createApplicationView());
}

/** Purposeful record navigation clears hiding filters without changing sort or opening a dialog. */
export function revealApplication(
  state: ApplicationState,
  role: Role,
  applicationId: number,
): ApplicationState {
  if (
    !visibleApplicationRecords(state, role).some(
      (record) => record.id === applicationId,
    )
  )
    return state;
  return updateApplicationView(state, role, {
    query: "",
    status: "All",
    property: "All properties",
    completeness: "Any completeness",
  });
}

function isTenantApplication(record: ApplicationRecord): boolean {
  return record.tenantId !== undefined
    ? record.tenantId === tenantIdentity.id
    : record.applicant === tenantIdentity.name;
}

export function canReviewApplication(
  record: ApplicationRecord,
  role: Role,
): boolean {
  return (
    record.propertyId !== undefined &&
    ownsProperty(role, record.propertyId) &&
    record.status !== "Draft" &&
    record.status !== "Approved"
  );
}

export function canRequestApplicationEvidence(
  record: ApplicationRecord,
  role: Role,
): boolean {
  return (
    record.propertyId !== undefined &&
    ownsProperty(role, record.propertyId) &&
    record.status !== "Draft"
  );
}

export function applicationEvidenceSummary(
  record: ApplicationRecord,
): ApplicationEvidenceSummary {
  const latestRequest = record.evidenceRequests?.at(-1) ?? null;
  const latestResponse = record.evidenceResponses?.at(-1) ?? null;
  const requestOpen = Boolean(
    latestRequest &&
    !record.evidenceClosures?.some(
      (event) => event.requestId === latestRequest.id,
    ),
  );
  const unreviewedResponseIds = (record.evidenceResponses ?? [])
    .filter(
      (response) =>
        !record.evidenceReviews?.some(
          (event) => event.responseId === response.id,
        ),
    )
    .map((response) => response.id);
  const supplied = new Set(
    (record.evidenceResponses ?? [])
      .filter((response) => response.requestId === latestRequest?.id)
      .flatMap((response) => response.files.map((file) => file.documentId)),
  );
  const outstandingDocumentIds = requestOpen
    ? latestRequest!.documentIds.filter((id) => !supplied.has(id))
    : [];
  const hasCurrentResponse = latestRequest
    ? (record.evidenceResponses ?? []).some(
        (response) => response.requestId === latestRequest.id,
      )
    : Boolean(latestResponse);
  return {
    latestRequest,
    latestResponse,
    requestOpen,
    outstandingDocumentIds,
    unreviewedResponseIds,
    phase: unreviewedResponseIds.length
      ? "submitted"
      : requestOpen && !hasCurrentResponse
        ? "requested"
        : latestResponse
          ? "reviewed"
          : "none",
  };
}

function currentEvidenceRequestId(record: ApplicationRecord): string | null {
  const summary = applicationEvidenceSummary(record);
  return summary.requestOpen ? summary.latestRequest!.id : null;
}

export function canRespondApplicationEvidence(
  record: ApplicationRecord,
  role: Role,
): boolean {
  return (
    role === "tenant" &&
    isTenantApplication(record) &&
    (record.status === "Review" ||
      record.status === "Documents" ||
      (record.status === "Approved" &&
        applicationEvidenceSummary(record).requestOpen))
  );
}

/** Drafts are private to the applicant workspace; owners see explicit responses only. */
export function applicationEvidenceDraft(
  state: ApplicationState,
  role: Role,
  id: number,
): ApplicationEvidenceDraft | null {
  const record = state.records.find((item) => item.id === id);
  if (role !== "tenant" || !record || !isTenantApplication(record)) return null;
  return (
    state.evidenceDrafts?.[id] ?? {
      requestId: currentEvidenceRequestId(record),
      revision: state.evidenceRevision ?? 0,
      note: "",
      files: [],
    }
  );
}

function evidenceDraftIssue(
  state: ApplicationState,
  role: Role,
  id: number,
): ApplicationEvidenceIssue | null {
  const record = state.records.find((item) => item.id === id);
  if (!record || !canRespondApplicationEvidence(record, role))
    return { code: "unavailable" };
  const draft = applicationEvidenceDraft(state, role, id)!;
  return draft.requestId === currentEvidenceRequestId(record)
    ? null
    : { code: "staleRequest" };
}

function retainEvidenceDraft(
  state: ApplicationState,
  id: number,
  draft: ApplicationEvidenceDraft,
): ApplicationState {
  const revision = (state.evidenceRevision ?? 0) + 1;
  return {
    ...state,
    evidenceRevision: revision,
    evidenceDrafts: {
      ...state.evidenceDrafts,
      [id]: { ...draft, revision, files: [...draft.files] },
    },
  };
}

export function updateApplicationEvidenceNote(
  state: ApplicationState,
  role: Role,
  id: number,
  note: string,
): ApplicationState {
  if (evidenceDraftIssue(state, role, id)) return state;
  const draft = applicationEvidenceDraft(state, role, id)!;
  return note === draft.note
    ? state
    : retainEvidenceDraft(state, id, { ...draft, note });
}

/** Count retained File objects once, including immutable responses and current drafts. */
export function applicationEvidenceBytes(state: ApplicationState): number {
  const files = new Set<File>();
  for (const draft of Object.values(state.evidenceDrafts ?? {}))
    for (const attachment of draft.files) files.add(attachment.file);
  for (const record of state.records)
    for (const response of record.evidenceResponses ?? [])
      for (const attachment of response.files) files.add(attachment.file);
  return [...files].reduce((total, file) => total + file.size, 0);
}

export function addApplicationEvidenceFiles(
  state: ApplicationState,
  role: Role,
  id: number,
  documentId: string,
  files: readonly File[],
  now = new Date(),
): {
  state: ApplicationState;
  added: number;
  issues: ApplicationEvidenceIssue[];
} {
  const issue = evidenceDraftIssue(state, role, id);
  if (issue) return { state, added: 0, issues: [issue] };
  const record = state.records.find((item) => item.id === id)!;
  if (!record.documents.some((document) => document.id === documentId))
    return { state, added: 0, issues: [{ code: "unknownDocument" }] };
  const draft = applicationEvidenceDraft(state, role, id)!;
  const retainedFiles = new Set<File>();
  for (const saved of Object.values(state.evidenceDrafts ?? {}))
    for (const attachment of saved.files) retainedFiles.add(attachment.file);
  for (const saved of state.records)
    for (const response of saved.evidenceResponses ?? [])
      for (const attachment of response.files)
        retainedFiles.add(attachment.file);
  let bytes = applicationEvidenceBytes(state);
  let nextId = state.nextEvidenceId ?? 1;
  const attachments = [...draft.files];
  const issues: ApplicationEvidenceIssue[] = [];
  for (const file of files) {
    const fileIssue = documentFileIssue(file);
    let code: ApplicationEvidenceIssue["code"] | undefined = fileIssue?.code as
      "empty" | "fileTooLarge" | "unsupportedFormat" | undefined;
    if (
      !code &&
      attachments.some(
        (item) => item.documentId === documentId && item.file === file,
      )
    )
      code = "alreadyAdded";
    if (!code && attachments.length >= MAX_APPLICATION_EVIDENCE_FILES)
      code = "tooManyFiles";
    if (
      !code &&
      !retainedFiles.has(file) &&
      bytes + file.size > MAX_APPLICATION_EVIDENCE_BYTES
    )
      code = "evidenceFull";
    if (code) {
      issues.push({ code, fileName: file.name });
      continue;
    }
    const descriptor = documentFileDescriptor(file)!;
    attachments.push({
      id: `application-evidence-file-${nextId++}`,
      documentId,
      file,
      ...descriptor,
      addedAt: now.toISOString(),
    });
    if (!retainedFiles.has(file)) bytes += file.size;
    retainedFiles.add(file);
  }
  const added = attachments.length - draft.files.length;
  return {
    state: added
      ? {
          ...retainEvidenceDraft(state, id, { ...draft, files: attachments }),
          nextEvidenceId: nextId,
        }
      : state,
    added,
    issues,
  };
}

export function removeApplicationEvidenceFile(
  state: ApplicationState,
  role: Role,
  id: number,
  fileId: string,
): ApplicationState {
  const draft = applicationEvidenceDraft(state, role, id);
  if (!draft || !draft.files.some((file) => file.id === fileId)) return state;
  return retainEvidenceDraft(state, id, {
    ...draft,
    files: draft.files.filter((file) => file.id !== fileId),
  });
}

export function discardApplicationEvidenceDraft(
  state: ApplicationState,
  role: Role,
  id: number,
): ApplicationState {
  if (!applicationEvidenceDraft(state, role, id) || !state.evidenceDrafts?.[id])
    return state;
  const drafts = { ...state.evidenceDrafts };
  delete drafts[id];
  return {
    ...state,
    evidenceDrafts: drafts,
    evidenceRevision: (state.evidenceRevision ?? 0) + 1,
  };
}

export function submitApplicationEvidence(
  state: ApplicationState,
  role: Role,
  id: number,
  expectedDraftRevision: number,
  expectedRequestId: string | null,
  now = new Date(),
): {
  state: ApplicationState;
  responseId: string | null;
  issue: ApplicationEvidenceIssue | null;
} {
  const issue = evidenceDraftIssue(state, role, id);
  if (issue) return { state, responseId: null, issue };
  const record = state.records.find((item) => item.id === id)!;
  const draft = applicationEvidenceDraft(state, role, id)!;
  if (
    draft.revision !== expectedDraftRevision ||
    draft.requestId !== expectedRequestId
  )
    return { state, responseId: null, issue: { code: "staleRequest" } };
  if (draft.note.trim().length > MAX_APPLICATION_EVIDENCE_NOTE)
    return { state, responseId: null, issue: { code: "noteTooLong" } };
  if (!draft.files.length && draft.note.trim().length < 3)
    return { state, responseId: null, issue: { code: "emptyResponse" } };
  if (draft.files.length > MAX_APPLICATION_EVIDENCE_FILES)
    return { state, responseId: null, issue: { code: "tooManyFiles" } };
  if (applicationEvidenceBytes(state) > MAX_APPLICATION_EVIDENCE_BYTES)
    return { state, responseId: null, issue: { code: "evidenceFull" } };
  for (const attachment of draft.files) {
    if (
      !record.documents.some(
        (document) => document.id === attachment.documentId,
      )
    )
      return { state, responseId: null, issue: { code: "unknownDocument" } };
    const descriptor = documentFileDescriptor(attachment.file);
    if (
      !descriptor ||
      descriptor.kind !== attachment.kind ||
      descriptor.mimeType !== attachment.mimeType
    )
      return {
        state,
        responseId: null,
        issue: { code: "unsupportedFormat", fileName: attachment.file.name },
      };
  }
  const version = (record.evidenceResponses?.at(-1)?.version ?? 0) + 1;
  const response: ApplicationEvidenceResponse = {
    id: `application-evidence-response-${id}-${version}`,
    version,
    requestId: draft.requestId,
    note: draft.note.trim(),
    files: draft.files.map((file) => ({ ...file })),
    submittedAt: now.toISOString(),
  };
  const suppliedIds = new Set(response.files.map((file) => file.documentId));
  const updated: ApplicationRecord = {
    ...record,
    evidenceResponses: [...(record.evidenceResponses ?? []), response],
    documents: record.documents.map((document) =>
      suppliedIds.has(document.id)
        ? {
            ...document,
            status: "Supplied",
            summary:
              "File supplied in this tab for owner inspection. It has not been verified or sent outside this tab.",
          }
        : document,
    ),
    activity: [
      ...record.activity,
      {
        id: response.id,
        source: "local",
        actor: "tenant",
        action: "evidence-response-saved",
        responseId: response.id,
        requestId: response.requestId,
        label: `Applicant saved evidence response ${version} in this tab; no files were verified or sent`,
        at: response.submittedAt,
      },
    ],
  };
  const cleared = discardApplicationEvidenceDraft(state, role, id);
  return {
    state: {
      ...cleared,
      records: cleared.records.map((item) => (item.id === id ? updated : item)),
    },
    responseId: response.id,
    issue: null,
  };
}

export function tenantApplicationForProperty(
  state: ApplicationState,
  property: Pick<Property, "id" | "title">,
) {
  return state.records.find(
    (record) =>
      isTenantApplication(record) &&
      (record.propertyId !== undefined
        ? record.propertyId === property.id
        : record.property === property.title),
  );
}

function canonicalRentalProperty(role: Role, propertyId: number) {
  return role === "tenant"
    ? properties.find(
        (property) =>
          property.id === propertyId && property.listingType === "Rent",
      )
    : undefined;
}

/** Unsubmitted answers belong only to the tenant and never appear in shared application records. */
export function rentalApplicationDraft(
  state: ApplicationState,
  role: Role,
  propertyId: number,
  now = new Date(),
): RentalApplicationComposerDraft | null {
  if (!canonicalRentalProperty(role, propertyId)) return null;
  const saved = state.rentalDrafts?.[propertyId];
  return saved
    ? {
        moveInDate: saved.moveInDate,
        householdSize: saved.householdSize,
        introduction: saved.introduction,
      }
    : {
        moveInDate: futureLocalDate(14, now),
        householdSize: "1",
        introduction: "",
      };
}

export function hasRentalApplicationDraft(
  state: ApplicationState,
  role: Role,
  propertyId: number,
): boolean {
  return Boolean(
    canonicalRentalProperty(role, propertyId) &&
    state.rentalDrafts?.[propertyId],
  );
}

export function updateRentalApplicationDraft(
  state: ApplicationState,
  role: Role,
  propertyId: number,
  patch: Partial<RentalApplicationComposerDraft>,
  now = new Date(),
): ApplicationState {
  if (!patch || typeof patch !== "object") return state;
  const current = rentalApplicationDraft(state, role, propertyId, now);
  if (!current) return state;
  const next = { ...current };
  let recognized = false;
  let changed = false;
  for (const field of Object.keys(current) as Array<
    keyof RentalApplicationComposerDraft
  >) {
    const value = patch[field];
    if (typeof value !== "string") continue;
    recognized = true;
    if (value === current[field]) continue;
    next[field] = value;
    changed = true;
  }
  // Explicit input/submission may retain valid defaults; reading them alone never does.
  return recognized &&
    (changed || !hasRentalApplicationDraft(state, role, propertyId))
    ? { ...state, rentalDrafts: { ...state.rentalDrafts, [propertyId]: next } }
    : state;
}

export function discardRentalApplicationDraft(
  state: ApplicationState,
  role: Role,
  propertyId: number,
): ApplicationState {
  if (!hasRentalApplicationDraft(state, role, propertyId)) return state;
  const rentalDrafts = { ...state.rentalDrafts };
  delete rentalDrafts[propertyId];
  return { ...state, rentalDrafts };
}

export function submitRentalApplicationDraft(
  state: ApplicationState,
  role: Role,
  propertyId: number,
  now = new Date(),
): {
  state: ApplicationState;
  applicationId: number | null;
  errors: RequestErrors;
  issue: "unavailable" | "duplicate" | "noDraft" | null;
} {
  const property = canonicalRentalProperty(role, propertyId);
  if (!property)
    return { state, applicationId: null, errors: {}, issue: "unavailable" };
  if (tenantApplicationForProperty(state, property))
    return { state, applicationId: null, errors: {}, issue: "duplicate" };
  const retained = state.rentalDrafts?.[propertyId];
  if (!retained)
    return { state, applicationId: null, errors: {}, issue: "noDraft" };
  const household = retained.householdSize.trim();
  const draft: RentalApplicationDraft = {
    moveInDate: retained.moveInDate,
    householdSize: /^\d+$/.test(household) ? Number(household) : NaN,
    introduction: retained.introduction,
  };
  const errors = validateRentalApplication(draft, now);
  if (Object.keys(errors).length)
    return { state, applicationId: null, errors, issue: null };
  const next = submitRentalApplication(state, role, property, draft, now);
  const created = tenantApplicationForProperty(next, property);
  if (next === state || !created)
    return { state, applicationId: null, errors: {}, issue: "unavailable" };
  return {
    state: discardRentalApplicationDraft(next, role, propertyId),
    applicationId: created.id,
    errors: {},
    issue: null,
  };
}

/** Record a tenant's local request; it does not deliver or approve an application. */
export function submitRentalApplication(
  state: ApplicationState,
  role: Role,
  property: Pick<Property, "id" | "title" | "listingType">,
  draft: RentalApplicationDraft,
  now = new Date(),
): ApplicationState {
  const canonical = canonicalRentalProperty(role, property.id);
  if (!canonical || Object.keys(validateRentalApplication(draft, now)).length)
    return state;
  if (tenantApplicationForProperty(state, canonical)) return state;
  const id = Math.max(0, ...state.records.map((record) => record.id)) + 1;
  const introduction = draft.introduction.trim();
  const record: ApplicationRecord = {
    id,
    tenantId: tenantIdentity.id,
    applicant: tenantIdentity.name,
    avatar: tenantIdentity.avatar,
    propertyId: canonical.id,
    property: canonical.title,
    status: "Review",
    submittedAt: now.toISOString(),
    submission: {
      moveInDate: draft.moveInDate,
      householdSize: draft.householdSize,
      introduction,
    },
    profileFields: [
      { label: "Preferred move-in date", present: true },
      { label: "Household size", present: true },
      ...(introduction
        ? [{ label: "Applicant introduction", present: true }]
        : []),
    ],
    documents: [
      {
        id: "identity",
        name: "Identity document",
        status: "Missing",
        summary:
          "No identity file was collected or verified by this local application.",
      },
      {
        id: "income",
        name: "Proof of income",
        status: "Missing",
        summary:
          "No financial details or files were collected by this local application.",
      },
      {
        id: "reference",
        name: "Rental reference",
        status: "Missing",
        summary:
          "No reference was provided or contacted by this local application.",
      },
    ],
    reviewed: false,
    documentRequest: "",
    activity: [
      {
        id: `local-submission-${id}`,
        source: "local",
        actor: "tenant",
        action: "application-submitted",
        label:
          "Rental application saved in this tab; not sent to the listing party",
        at: now.toISOString(),
      },
    ],
  };
  return { ...state, records: [...state.records, record] };
}

/** Local workspace state only. Each transition requires an explicit owner action. */
export function updateApplication(
  state: ApplicationState,
  id: number,
  role: Role,
  action: ApplicationAction,
  now = new Date(),
): ApplicationState {
  const record = state.records.find((item) => item.id === id);
  const isEvidenceAction =
    action.type === "request-documents" ||
    action.type === "acknowledge-evidence" ||
    action.type === "close-evidence-request";
  if (
    !record ||
    !(isEvidenceAction
      ? canRequestApplicationEvidence(record, role)
      : canReviewApplication(record, role))
  )
    return state;

  let updated: ApplicationRecord;
  let label: string;
  let activityAction: ApplicationActivityEvent["action"];
  let requestId: string | undefined;
  let responseId: string | undefined;
  if (action.type === "mark-reviewed") {
    if (record.reviewed) return state;
    updated = { ...record, reviewed: true };
    activityAction = "application-reviewed";
    label = "Owner marked this application as reviewed in this workspace";
  } else if (action.type === "approve") {
    if (!record.reviewed) return state;
    updated = { ...record, status: "Approved" };
    activityAction = "application-approved";
    label =
      "Owner explicitly marked this application approved in this workspace";
  } else if (action.type === "acknowledge-evidence") {
    if (
      !record.evidenceResponses?.some(
        (response) => response.id === action.responseId,
      ) ||
      record.evidenceReviews?.some(
        (event) => event.responseId === action.responseId,
      )
    )
      return state;
    activityAction = "evidence-acknowledged";
    responseId = action.responseId;
    updated = {
      ...record,
      evidenceReviews: [
        ...(record.evidenceReviews ?? []),
        {
          responseId: action.responseId,
          at: now.toISOString(),
        },
      ],
    };
    label =
      "Owner acknowledged an evidence response in this tab; no attachment was verified";
  } else if (action.type === "close-evidence-request") {
    const summary = applicationEvidenceSummary(record);
    if (!summary.requestOpen || summary.latestRequest!.id !== action.requestId)
      return state;
    activityAction = "evidence-request-closed";
    requestId = action.requestId;
    updated = {
      ...record,
      documentRequest: "",
      evidenceClosures: [
        ...(record.evidenceClosures ?? []),
        {
          requestId: action.requestId,
          at: now.toISOString(),
        },
      ],
    };
    label =
      "Owner explicitly closed the evidence request in this tab; application decision unchanged";
  } else {
    const documentIds = new Set(
      action.documentIds.filter((documentId) =>
        record.documents.some((document) => document.id === documentId),
      ),
    );
    if (
      !documentIds.size ||
      action.note.trim().length > MAX_APPLICATION_EVIDENCE_NOTE
    )
      return state;
    const summary = applicationEvidenceSummary(record);
    const currentRequest = summary.latestRequest;
    if (
      summary.requestOpen &&
      currentRequest &&
      currentRequest.note === action.note.trim() &&
      currentRequest.documentIds.length === documentIds.size &&
      currentRequest.documentIds.every((documentId) =>
        documentIds.has(documentId),
      ) &&
      !record.evidenceResponses?.some(
        (response) => response.requestId === currentRequest.id,
      )
    )
      return state;
    const version = (currentRequest?.version ?? 0) + 1;
    const request: ApplicationEvidenceRequest = {
      id: `evidence-request-${id}-${version}`,
      version,
      documentIds: [...documentIds],
      note: action.note.trim(),
      createdAt: now.toISOString(),
    };
    activityAction = "evidence-requested";
    requestId = request.id;
    updated = {
      ...record,
      status: record.status === "Approved" ? "Approved" : "Documents",
      reviewed: record.status === "Approved" ? record.reviewed : false,
      documentRequest: request.note,
      evidenceRequests: [...(record.evidenceRequests ?? []), request],
      documents: record.documents.map((document) =>
        documentIds.has(document.id)
          ? { ...document, status: "Requested" }
          : document,
      ),
    };
    label = `Owner recorded a request for ${documentIds.size} document${documentIds.size === 1 ? "" : "s"} in this workspace`;
  }

  updated.activity = [
    ...record.activity,
    {
      id: `${record.id}-${now.getTime()}-${record.activity.length}`,
      source: "local",
      actor: "landlord",
      action: activityAction,
      ...(requestId !== undefined ? { requestId } : {}),
      ...(responseId !== undefined ? { responseId } : {}),
      label,
      at: now.toISOString(),
    },
  ];
  return {
    ...state,
    records: state.records.map((item) => (item.id === id ? updated : item)),
  };
}
