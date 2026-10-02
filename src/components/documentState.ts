import type { Role } from "../types";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_WORKSPACE_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv";

export const documentCategories = [
  "Lease & property",
  "Rent & maintenance",
  "Personal records",
  "Service records",
  "Venue records",
  "Platform records",
  "Other",
] as const;
export type DocumentCategory = (typeof documentCategories)[number];
export type DocumentKind = "pdf" | "image" | "text";

interface DocumentMetadata {
  id: string;
  role: Role;
  name: string;
  category: DocumentCategory;
  addedAt: string;
}

export type WorkspaceDocument = DocumentMetadata &
  (
    | { source: "sample"; kind: "text"; content: string }
    | { source: "local"; kind: DocumentKind; mimeType: string; file: File }
  );

export interface DocumentState {
  records: WorkspaceDocument[];
  removed: Partial<Record<Role, WorkspaceDocument>>;
  nextId: number;
}

const formats: Record<
  string,
  { kind: DocumentKind; mimeType: string; acceptedTypes: string[] }
> = {
  pdf: {
    kind: "pdf",
    mimeType: "application/pdf",
    acceptedTypes: ["application/pdf"],
  },
  png: { kind: "image", mimeType: "image/png", acceptedTypes: ["image/png"] },
  jpg: { kind: "image", mimeType: "image/jpeg", acceptedTypes: ["image/jpeg"] },
  jpeg: {
    kind: "image",
    mimeType: "image/jpeg",
    acceptedTypes: ["image/jpeg"],
  },
  gif: { kind: "image", mimeType: "image/gif", acceptedTypes: ["image/gif"] },
  webp: {
    kind: "image",
    mimeType: "image/webp",
    acceptedTypes: ["image/webp"],
  },
  txt: { kind: "text", mimeType: "text/plain", acceptedTypes: ["text/plain"] },
  md: {
    kind: "text",
    mimeType: "text/plain",
    acceptedTypes: ["text/plain", "text/markdown"],
  },
  csv: {
    kind: "text",
    mimeType: "text/plain",
    acceptedTypes: ["text/plain", "text/csv"],
  },
};

export function categoriesForRole(role: Role): DocumentCategory[] {
  if (role === "tenant")
    return [
      "Lease & property",
      "Rent & maintenance",
      "Personal records",
      "Other",
    ];
  if (role === "landlord")
    return ["Lease & property", "Rent & maintenance", "Other"];
  if (role === "provider") return ["Service records", "Other"];
  if (role === "spaceOperator") return ["Venue records", "Other"];
  return ["Platform records", "Other"];
}

export function createInitialDocumentState(): DocumentState {
  const seeds: Record<
    Role,
    Array<{ name: string; category: DocumentCategory; text: string }>
  > = {
    tenant: [
      {
        name: "Example lease notes",
        category: "Lease & property",
        text: "A lease record can keep the property, start date, parties and agreed terms together.\n\nThis example is an explanatory note, not a lease contract. No signature or agreement is recorded.",
      },
      {
        name: "Move-in checklist example",
        category: "Lease & property",
        text: "Example checklist\n\n• Review the condition of each room.\n• Note which keys and access devices were provided.\n• Agree how maintenance issues should be reported.\n\nThese are example headings. No property inspection has been completed.",
      },
      {
        name: "Rent record guide",
        category: "Rent & maintenance",
        text: "Kasa's rent records describe direct tenant-to-landlord transfers.\n\nA receipt may be added to a record in a connected production service. This sample contains no bank details or payment receipt, and no payment has been confirmed.",
      },
    ],
    landlord: [
      {
        name: "Property document checklist",
        category: "Lease & property",
        text: "Example checklist\n\n• Property description and relevant certificates\n• Agreed lease and handover records\n• Maintenance history\n\nThis example does not certify that any document exists or has been checked.",
      },
      {
        name: "Maintenance handover example",
        category: "Rent & maintenance",
        text: "Example service record\n\nIssue: describe the reported problem.\nVisit: record the agreed time.\nOutcome: note work completed and any follow-up.\n\nNo service visit or completed repair is represented by this sample.",
      },
    ],
    provider: [
      {
        name: "Service visit checklist",
        category: "Service records",
        text: "Example checklist\n\n• Review the customer's description.\n• Agree the visit and scope directly.\n• Record observations and agreed follow-up.\n\nThis sample is not a completed or certified service report.",
      },
    ],
    spaceOperator: [
      {
        name: "Venue handover checklist",
        category: "Venue records",
        text: "Example checklist\n\n• Confirm the reserved space and access arrangements.\n• Review equipment and venue rules.\n• Record any agreed follow-up.\n\nThis sample does not confirm a reservation, payment or inspection.",
      },
    ],
    admin: [
      {
        name: "Document handling notes",
        category: "Platform records",
        text: "Sample operational notes\n\nProduction document handling needs access controls, retention rules and a secure storage service.\n\nThe current local library does not upload, verify, sign or deliver files. This sample contains no user document or verification decision.",
      },
    ],
  };
  return {
    nextId: 1,
    removed: {},
    records: Object.entries(seeds).flatMap(([role, items]) =>
      items.map((item, index): WorkspaceDocument => ({
        id: `sample-${role}-${index + 1}`,
        role: role as Role,
        name: item.name,
        category: item.category,
        addedAt: "2026-10-02T09:00:00.000Z",
        source: "sample",
        kind: "text",
        content: `KASA — SAMPLE PREVIEW\n${item.name}\n\n${item.text}`,
      })),
    ),
  };
}

export function workspaceDocuments(
  state: DocumentState,
  role: Role,
): WorkspaceDocument[] {
  return state.records.filter((record) => record.role === role);
}

export function documentBytes(record: WorkspaceDocument): number {
  return record.source === "local"
    ? record.file.size
    : new TextEncoder().encode(record.content).length;
}

export function workspaceLocalBytes(state: DocumentState, role: Role): number {
  return workspaceDocuments(state, role).reduce(
    (total, record) =>
      total + (record.source === "local" ? record.file.size : 0),
    0,
  );
}

export function validateDocumentFile(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "The file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES)
    return "The file exceeds the 10 MB limit.";
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const format = Object.hasOwn(formats, extension)
    ? formats[extension]
    : undefined;
  const mimeType = file.type.toLowerCase().split(";")[0].trim();
  if (!format || (mimeType && !format.acceptedTypes.includes(mimeType)))
    return "Choose a PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV file.";
  return null;
}

function sameLocalFile(record: WorkspaceDocument, file: File) {
  // Matching metadata does not prove equal content, especially across folders.
  return record.source === "local" && record.file === file;
}

export function addLocalDocuments(
  state: DocumentState,
  role: Role,
  files: readonly File[],
  category: DocumentCategory,
  now = new Date(),
): { state: DocumentState; added: number; errors: string[] } {
  if (!categoriesForRole(role).includes(category))
    return {
      state,
      added: 0,
      errors: ["Choose a category available in this workspace."],
    };
  const records = [...state.records];
  const errors: string[] = [];
  let nextId = state.nextId;
  let bytes = workspaceLocalBytes(state, role);
  for (const file of files) {
    let error = validateDocumentFile(file);
    if (
      !error &&
      records.some(
        (record) => record.role === role && sameLocalFile(record, file),
      )
    )
      error = "This file is already in this workspace.";
    if (!error && bytes + file.size > MAX_WORKSPACE_DOCUMENT_BYTES)
      error = "This workspace has reached its 50 MB local-file limit.";
    if (error) {
      errors.push(`${file.name}: ${error}`);
      continue;
    }
    const format = formats[file.name.split(".").at(-1)!.toLowerCase()];
    records.push({
      id: `local-document-${nextId}`,
      role,
      name: file.name,
      category,
      addedAt: now.toISOString(),
      source: "local",
      kind: format.kind,
      mimeType: format.mimeType,
      file,
    });
    nextId += 1;
    bytes += file.size;
  }
  const added = records.length - state.records.length;
  return {
    state: added ? { ...state, records, nextId } : state,
    added,
    errors,
  };
}

export function removeDocument(
  state: DocumentState,
  role: Role,
  id: string,
): DocumentState {
  const record = state.records.find(
    (item) => item.role === role && item.id === id,
  );
  if (!record) return state;
  return {
    ...state,
    records: state.records.filter((item) => item !== record),
    removed: { ...state.removed, [role]: record },
  };
}

export function restoreDocumentError(
  state: DocumentState,
  role: Role,
): string | null {
  const removed = state.removed[role];
  if (!removed || removed.role !== role)
    return "There is no document to restore.";
  if (removed.source === "local") {
    if (
      workspaceDocuments(state, role).some((record) =>
        sameLocalFile(record, removed.file),
      )
    )
      return "That file is already in this workspace.";
    if (
      workspaceLocalBytes(state, role) + removed.file.size >
      MAX_WORKSPACE_DOCUMENT_BYTES
    )
      return "Remove another local file to make space before restoring this one.";
  }
  return null;
}

export function restoreDocument(
  state: DocumentState,
  role: Role,
): DocumentState {
  if (restoreDocumentError(state, role)) return state;
  const record = state.removed[role]!;
  return {
    ...state,
    records: [...state.records, record],
    removed: { ...state.removed, [role]: undefined },
  };
}
