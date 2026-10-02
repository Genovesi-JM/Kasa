import { properties } from "../data";
import type { Role } from "../types";

export const rentStatuses = [
  "Awaiting transfer details",
  "Awaiting owner confirmation",
  "Needs correction",
  "Confirmed",
] as const;
export type RentStatus = (typeof rentStatuses)[number];

export interface RentTransferDraft {
  amount: string;
  transferredOn: string;
  reference: string;
  note: string;
}

export interface RentTransfer {
  amountCents: number;
  transferredOn: string;
  reference: string;
  note: string;
}

export interface RentRecord {
  id: string;
  period: string;
  tenantId: string;
  tenant: string;
  propertyId: number;
  property: string;
  owner: string;
  amountDueCents: number;
  dueOn: string;
  status: RentStatus;
  transfer?: RentTransfer;
  correctionNote: string;
  updatedAt: string;
  confirmedAt?: string;
  activity: Array<{ id: string; label: string; at: string }>;
}

export interface RentRecordState {
  records: RentRecord[];
}

export interface RentRecordFilters {
  status: "All statuses" | RentStatus;
  property: string;
  period: string;
  sort: "Most recently updated" | "Amount: high to low" | "Property name";
}

export const tenantRentIdentity = "tenant-ines";
export const landlordRentIdentity = "Olivia Martín";

export function createInitialRentRecordState(): RentRecordState {
  const homes = [
    { tenantId: tenantRentIdentity, tenant: "Inês Duarte", propertyId: 1 },
    { tenantId: "tenant-leo", tenant: "Leo Bernard", propertyId: 2 },
    { tenantId: "tenant-maya", tenant: "Maya Chen", propertyId: 3 },
    { tenantId: "tenant-noah", tenant: "Noah Vidal", propertyId: 4 },
  ].map((home) => {
    const property = properties.find((item) => item.id === home.propertyId)!;
    return {
      ...home,
      property: property.title,
      owner: property.landlord,
      amountDueCents: Math.round(property.price * 100),
    };
  });
  const confirmed: RentRecord[] = homes.map((home, index) => {
    const at = `2026-08-0${index + 2}T12:00:00Z`;
    return {
      ...home,
      id: `rent-2026-08-${home.tenantId}`,
      period: "2026-08",
      dueOn: "2026-08-01",
      status: "Confirmed",
      transfer: {
        amountCents: home.amountDueCents,
        transferredOn: `2026-08-0${index + 1}`,
        reference: `EXAMPLE-AUG-${home.propertyId}`,
        note: "Sample transfer record.",
      },
      correctionNote: "",
      updatedAt: at,
      confirmedAt: at,
      activity: [
        {
          id: `seed-${home.propertyId}`,
          label: "Sample record marked confirmed",
          at,
        },
      ],
    };
  });
  return {
    records: [
      ...confirmed,
      {
        ...homes[0],
        id: "rent-2026-10-tenant-ines",
        period: "2026-10",
        dueOn: "2026-10-01",
        status: "Awaiting transfer details",
        correctionNote: "",
        updatedAt: "2026-10-01T09:00:00Z",
        activity: [
          {
            id: "seed-oct-ines",
            label: "Sample rent record created",
            at: "2026-10-01T09:00:00Z",
          },
        ],
      },
      {
        ...homes[0],
        id: "rent-2026-09-tenant-ines",
        period: "2026-09",
        dueOn: "2026-09-01",
        status: "Awaiting owner confirmation",
        transfer: {
          amountCents: homes[0].amountDueCents,
          transferredOn: "2026-09-02",
          reference: "EXAMPLE-SEP-INES",
          note: "Sample transfer awaiting owner review.",
        },
        correctionNote: "",
        updatedAt: "2026-09-02T12:00:00Z",
        activity: [
          {
            id: "seed-sep-ines",
            label: "Sample transfer details added",
            at: "2026-09-02T12:00:00Z",
          },
        ],
      },
    ],
  };
}

export function visibleRentRecords(
  state: RentRecordState,
  role: Role,
): RentRecord[] {
  if (role === "landlord")
    return state.records.filter(
      (record) => record.owner === landlordRentIdentity,
    );
  if (role === "tenant")
    return state.records.filter(
      (record) => record.tenantId === tenantRentIdentity,
    );
  return [];
}

export function filterRentRecords(
  records: RentRecord[],
  filters: RentRecordFilters,
): RentRecord[] {
  return records
    .filter(
      (record) =>
        (filters.status === "All statuses" ||
          record.status === filters.status) &&
        (filters.property === "All properties" ||
          record.property === filters.property) &&
        (filters.period === "All periods" || record.period === filters.period),
    )
    .sort((a, b) =>
      filters.sort === "Amount: high to low"
        ? b.amountDueCents - a.amountDueCents || a.id.localeCompare(b.id)
        : filters.sort === "Property name"
          ? a.property.localeCompare(b.property) ||
            b.period.localeCompare(a.period)
          : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
}

export function rentToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function parseRentAmount(value: string): number | null {
  const amount = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000
    ? cents
    : null;
}

export type RentTransferErrors = Partial<
  Record<keyof RentTransferDraft, string>
>;

export function validateRentTransfer(
  draft: RentTransferDraft,
  now = new Date(),
): RentTransferErrors {
  const errors: RentTransferErrors = {};
  if (parseRentAmount(draft.amount) === null)
    errors.amount =
      "Enter an amount between €0.01 and €1,000,000, with up to two decimal places.";
  const [year, month, day] = draft.transferredOn.split("-").map(Number);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.transferredOn) ||
    rentToday(new Date(year, month - 1, day)) !== draft.transferredOn ||
    draft.transferredOn > rentToday(now)
  ) {
    errors.transferredOn =
      "Choose a valid transfer date that is today or earlier.";
  }
  if (
    !draft.reference.trim() ||
    draft.reference.trim().length > 100 ||
    /[\r\n]/.test(draft.reference)
  )
    errors.reference =
      "Enter a transfer reference of 1–100 characters on one line.";
  if (draft.note.trim().length > 1000)
    errors.note = "Use 1,000 characters or fewer.";
  return errors;
}

export function canRecordRentTransfer(record: RentRecord, role: Role): boolean {
  return (
    role === "tenant" &&
    record.tenantId === tenantRentIdentity &&
    record.status !== "Confirmed"
  );
}

function replaceRentRecord(
  state: RentRecordState,
  record: RentRecord,
  label: string,
  now: Date,
): RentRecordState {
  const updated: RentRecord = {
    ...record,
    updatedAt: now.toISOString(),
    activity: [
      ...record.activity,
      {
        id: `${record.id}-${record.activity.length}`,
        label,
        at: now.toISOString(),
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

export function recordRentTransfer(
  state: RentRecordState,
  role: Role,
  id: string,
  draft: RentTransferDraft,
  now = new Date(),
): RentRecordState {
  const record = state.records.find((item) => item.id === id);
  if (
    !record ||
    !canRecordRentTransfer(record, role) ||
    Object.keys(validateRentTransfer(draft, now)).length
  )
    return state;
  const amountCents = parseRentAmount(draft.amount)!;
  return replaceRentRecord(
    state,
    {
      ...record,
      transfer: {
        amountCents,
        transferredOn: draft.transferredOn,
        reference: draft.reference.trim(),
        note: draft.note.trim(),
      },
      status: "Awaiting owner confirmation",
      correctionNote: "",
    },
    record.transfer
      ? "Tenant updated transfer details in this tab"
      : "Tenant recorded transfer details in this tab",
    now,
  );
}

export function canReviewRentRecord(record: RentRecord, role: Role): boolean {
  return (
    role === "landlord" &&
    record.owner === landlordRentIdentity &&
    record.status === "Awaiting owner confirmation" &&
    Boolean(record.transfer)
  );
}

export function canConfirmRentRecord(record: RentRecord, role: Role): boolean {
  return (
    canReviewRentRecord(record, role) &&
    record.transfer?.amountCents === record.amountDueCents
  );
}

export function confirmRentRecord(
  state: RentRecordState,
  role: Role,
  id: string,
  now = new Date(),
): RentRecordState {
  const record = state.records.find((item) => item.id === id);
  if (!record || !canConfirmRentRecord(record, role)) return state;
  return replaceRentRecord(
    state,
    {
      ...record,
      status: "Confirmed",
      confirmedAt: now.toISOString(),
      correctionNote: "",
    },
    "Owner confirmed this record in the sample workspace",
    now,
  );
}

export function requestRentCorrection(
  state: RentRecordState,
  role: Role,
  id: string,
  note: string,
  now = new Date(),
): RentRecordState {
  const record = state.records.find((item) => item.id === id);
  const correctionNote = note.trim();
  if (
    !record ||
    !canReviewRentRecord(record, role) ||
    !correctionNote ||
    correctionNote.length > 500
  )
    return state;
  return replaceRentRecord(
    state,
    { ...record, status: "Needs correction", correctionNote },
    "Owner recorded a correction request in this tab",
    now,
  );
}

export function rentRecordSummary(record: RentRecord): string {
  return [
    "Kasa sample rent record — not payment instructions or a bank receipt.",
    "No bank account is provided. Do not use this sample to make a payment.",
    `Record: ${record.id}`,
    `Period: ${record.period}`,
    `Property: ${record.property}`,
    `Tenant: ${record.tenant}`,
    `Listing owner: ${record.owner}`,
    `Amount due: EUR ${(record.amountDueCents / 100).toFixed(2)}`,
    `Status: ${record.status}`,
    ...(record.transfer
      ? [
          `Recorded transfer: EUR ${(record.transfer.amountCents / 100).toFixed(2)} on ${record.transfer.transferredOn}`,
          `Reference: ${record.transfer.reference}`,
        ]
      : []),
  ].join("\n");
}

function csvCell(value: string): string {
  const safe =
    /^[\t\r\n]/.test(value) || /^\s*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Export sample reconciliation data; neutralize spreadsheet formulas in user-entered cells. */
export function rentRecordsCsv(records: RentRecord[]): string {
  const rows = [
    [
      "Scope",
      "Record",
      "Period",
      "Tenant",
      "Property",
      "Amount due EUR",
      "Recorded amount EUR",
      "Transfer date",
      "Reference",
      "Status",
      "Correction note",
      "Note",
    ],
    ...records.map((record) => [
      "Sample session record; not bank confirmation",
      record.id,
      record.period,
      record.tenant,
      record.property,
      (record.amountDueCents / 100).toFixed(2),
      record.transfer ? (record.transfer.amountCents / 100).toFixed(2) : "",
      record.transfer?.transferredOn ?? "",
      record.transfer?.reference ?? "",
      record.status,
      record.correctionNote,
      record.transfer?.note ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
