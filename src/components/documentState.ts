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

export type DocumentContent =
  | { source: "sample"; kind: "text"; content: string }
  | { source: "local"; kind: DocumentKind; mimeType: string; file: File };

export type WorkspaceDocument = DocumentMetadata & DocumentContent;

export interface DocumentView {
  query: string;
  category: "All categories" | DocumentCategory;
  source: "All documents" | "Local files" | "Sample previews";
  sort: "Recently added" | "Document name" | "Largest first";
  addCategory: DocumentCategory;
}

export interface DocumentState {
  records: WorkspaceDocument[];
  removed: Partial<Record<Role, WorkspaceDocument>>;
  nextId: number;
  views?: Partial<Record<Role, DocumentView>>;
}

export const documentIssueMessages = {
  empty: "The file is empty.",
  fileTooLarge: "The file exceeds the 10 MB limit.",
  unsupportedFormat: "Choose a PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV file.",
  unavailableCategory: "Choose a category available in this workspace.",
  alreadyAdded: "This file is already in this workspace.",
  workspaceFull: "This workspace has reached its 50 MB local-file limit.",
  nothingToRestore: "There is no document to restore.",
  restoreDuplicate: "That file is already in this workspace.",
  restoreFull:
    "Remove another local file to make space before restoring this one.",
} as const;

export interface DocumentIssue {
  code: keyof typeof documentIssueMessages;
  fileName?: string;
}

function englishDocumentIssue(issue: DocumentIssue): string {
  const message = documentIssueMessages[issue.code];
  return issue.fileName === undefined
    ? message
    : `${issue.fileName}: ${message}`;
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

function isDocumentRole(role: Role): boolean {
  return ["tenant", "landlord", "provider", "spaceOperator", "admin"].includes(
    role,
  );
}

function createDocumentView(): DocumentView {
  return {
    query: "",
    category: "All categories",
    source: "All documents",
    sort: "Recently added",
    addCategory: "Other",
  };
}

/** Library preferences belong to one workspace and never expose retained references. */
export function documentView(state: DocumentState, role: Role): DocumentView {
  return isDocumentRole(role)
    ? { ...(state.views?.[role] ?? createDocumentView()) }
    : createDocumentView();
}

export function updateDocumentView(
  state: DocumentState,
  role: Role,
  patch: Partial<DocumentView>,
): DocumentState {
  if (!isDocumentRole(role) || !patch || typeof patch !== "object")
    return state;
  const current = documentView(state, role);
  const next = { ...current };
  const categories = categoriesForRole(role);
  if (typeof patch.query === "string") next.query = patch.query.slice(0, 200);
  if (
    typeof patch.category === "string" &&
    (patch.category === "All categories" || categories.includes(patch.category))
  )
    next.category = patch.category;
  if (
    typeof patch.addCategory === "string" &&
    categories.includes(patch.addCategory)
  )
    next.addCategory = patch.addCategory;
  if (
    typeof patch.source === "string" &&
    ["All documents", "Local files", "Sample previews"].includes(patch.source)
  )
    next.source = patch.source;
  if (
    typeof patch.sort === "string" &&
    ["Recently added", "Document name", "Largest first"].includes(patch.sort)
  )
    next.sort = patch.sort;
  if (
    (Object.keys(current) as Array<keyof DocumentView>).every(
      (field) => current[field] === next[field],
    )
  )
    return state;
  return { ...state, views: { ...state.views, [role]: next } };
}

export function resetDocumentFilters(
  state: DocumentState,
  role: Role,
): DocumentState {
  return updateDocumentView(state, role, {
    query: "",
    category: "All categories",
    source: "All documents",
    sort: "Recently added",
  });
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
    views: {
      tenant: createDocumentView(),
      landlord: createDocumentView(),
      provider: createDocumentView(),
      spaceOperator: createDocumentView(),
      admin: createDocumentView(),
    },
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

export function documentBytes(record: DocumentContent): number {
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

export function documentFileIssue(
  file: Pick<File, "name" | "type" | "size">,
): DocumentIssue | null {
  if (!Number.isFinite(file.size) || file.size <= 0) return { code: "empty" };
  if (file.size > MAX_DOCUMENT_BYTES) return { code: "fileTooLarge" };
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const format = Object.hasOwn(formats, extension)
    ? formats[extension]
    : undefined;
  const mimeType = file.type.toLowerCase().split(";")[0].trim();
  if (!format || (mimeType && !format.acceptedTypes.includes(mimeType)))
    return { code: "unsupportedFormat" };
  return null;
}

/** Canonical preview metadata for files accepted by the shared document policy. */
export function documentFileDescriptor(
  file: Pick<File, "name" | "type" | "size">,
): { kind: DocumentKind; mimeType: string } | null {
  if (documentFileIssue(file)) return null;
  const format = formats[file.name.split(".").at(-1)!.toLowerCase()];
  return { kind: format.kind, mimeType: format.mimeType };
}

/** Preserve the existing English API for non-UI callers. */
export function validateDocumentFile(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  const issue = documentFileIssue(file);
  return issue ? englishDocumentIssue(issue) : null;
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
): {
  state: DocumentState;
  added: number;
  errors: string[];
  issues: DocumentIssue[];
} {
  if (!categoriesForRole(role).includes(category))
    return {
      state,
      added: 0,
      errors: [documentIssueMessages.unavailableCategory],
      issues: [{ code: "unavailableCategory" }],
    };
  const records = [...state.records];
  const issues: DocumentIssue[] = [];
  let nextId = state.nextId;
  let bytes = workspaceLocalBytes(state, role);
  for (const file of files) {
    let issue = documentFileIssue(file);
    if (
      !issue &&
      records.some(
        (record) => record.role === role && sameLocalFile(record, file),
      )
    )
      issue = { code: "alreadyAdded" };
    if (!issue && bytes + file.size > MAX_WORKSPACE_DOCUMENT_BYTES)
      issue = { code: "workspaceFull" };
    if (issue) {
      issues.push({ ...issue, fileName: file.name });
      continue;
    }
    const format = documentFileDescriptor(file)!;
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
    state: added
      ? resetDocumentFilters({ ...state, records, nextId }, role)
      : state,
    added,
    errors: issues.map(englishDocumentIssue),
    issues,
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

export function restoreDocumentIssue(
  state: DocumentState,
  role: Role,
): DocumentIssue | null {
  const removed = state.removed[role];
  if (!removed || removed.role !== role) return { code: "nothingToRestore" };
  if (removed.source === "local") {
    if (
      workspaceDocuments(state, role).some((record) =>
        sameLocalFile(record, removed.file),
      )
    )
      return { code: "restoreDuplicate" };
    if (
      workspaceLocalBytes(state, role) + removed.file.size >
      MAX_WORKSPACE_DOCUMENT_BYTES
    )
      return { code: "restoreFull" };
  }
  return null;
}

export function restoreDocumentError(
  state: DocumentState,
  role: Role,
): string | null {
  const issue = restoreDocumentIssue(state, role);
  return issue ? englishDocumentIssue(issue) : null;
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
