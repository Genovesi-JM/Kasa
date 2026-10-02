import { applications } from "../data";
import type { Application, Role } from "../types";

export interface ApplicationDocument {
  id: string;
  name: string;
  status: "Supplied" | "Missing" | "Requested";
  summary: string;
}

export interface ApplicationRecord extends Omit<
  Application,
  "score" | "submitted"
> {
  submittedAt: string;
  profileFields: Array<{ label: string; present: boolean }>;
  documents: ApplicationDocument[];
  reviewed: boolean;
  documentRequest: string;
  activity: Array<{ id: string; label: string; at: string }>;
}

export interface ApplicationState {
  records: ApplicationRecord[];
}

export type ApplicationAction =
  | { type: "mark-reviewed" }
  | { type: "approve" }
  | { type: "request-documents"; documentIds: string[]; note: string };

export function createInitialApplicationState(): ApplicationState {
  const dates = [
    "2026-08-21T09:42:00Z",
    "2026-08-20T14:30:00Z",
    "2026-08-18T10:00:00Z",
    "2026-08-16T16:10:00Z",
  ];
  return {
    records: applications.map((application, index) => ({
      id: application.id,
      applicant: application.applicant,
      property: application.property,
      status: application.status,
      avatar: application.avatar,
      submittedAt: dates[index],
      reviewed: application.status === "Approved",
      documentRequest:
        application.status === "Documents"
          ? "Please add the missing proof-of-income summary."
          : "",
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
  if (role === "landlord") return state.records;
  if (role === "tenant")
    return state.records.filter((record) => record.applicant === "Inês Duarte");
  return [];
}

/** Local workspace state only. Each transition requires an explicit owner action. */
export function updateApplication(
  state: ApplicationState,
  id: number,
  role: Role,
  action: ApplicationAction,
  now = new Date(),
): ApplicationState {
  if (role !== "landlord") return state;
  const record = state.records.find((item) => item.id === id);
  if (!record || record.status === "Draft" || record.status === "Approved")
    return state;

  let updated: ApplicationRecord;
  let label: string;
  if (action.type === "mark-reviewed") {
    if (record.reviewed) return state;
    updated = { ...record, reviewed: true };
    label = "Owner marked this application as reviewed in this workspace";
  } else if (action.type === "approve") {
    if (!record.reviewed) return state;
    updated = { ...record, status: "Approved" };
    label =
      "Owner explicitly marked this application approved in this workspace";
  } else {
    const documentIds = new Set(
      action.documentIds.filter((documentId) =>
        record.documents.some((document) => document.id === documentId),
      ),
    );
    if (!documentIds.size) return state;
    updated = {
      ...record,
      status: "Documents",
      reviewed: false,
      documentRequest: action.note.trim().slice(0, 1000),
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
      label,
      at: now.toISOString(),
    },
  ];
  return {
    ...state,
    records: state.records.map((item) => (item.id === id ? updated : item)),
  };
}
