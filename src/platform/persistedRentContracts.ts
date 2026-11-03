import { z } from "zod";

export const maxRentMinor = 100000000000;
const minor = z.number().int().min(1).max(maxRentMinor);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const periodPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
const boundedDate = z.iso
  .date()
  .refine((value) => /^(19|20|21)\d{2}-/.test(value));
export function validRentReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 100 &&
    !Array.from(trimmed).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}
export const persistedRentStatusSchema = z.enum([
  "awaiting_transfer",
  "awaiting_confirmation",
  "needs_correction",
  "confirmed",
  "voided",
]);
export const persistedRentTransferSchema = z.object({
  amountMinor: minor,
  transferredOn: boundedDate,
  reference: z.string().min(1).max(100).refine(validRentReference),
  note: z.string().max(1000),
  evidenceDocumentId: z.uuid().nullable(),
});
const snapshotFields = {
  amountDueMinor: minor,
  dueOn: boundedDate,
  status: persistedRentStatusSchema,
  transfer: persistedRentTransferSchema.nullable(),
  correctionReason: z.string().min(1).max(500).nullable(),
  voidReason: z.string().min(1).max(500).nullable(),
  confirmedAt: z.iso.datetime().nullable(),
};
function validSnapshot(
  item: z.infer<z.ZodObject<typeof snapshotFields>>,
): boolean {
  if (item.status === "awaiting_transfer" && item.transfer !== null)
    return false;
  if (
    ["awaiting_confirmation", "needs_correction", "confirmed"].includes(
      item.status,
    ) &&
    item.transfer === null
  )
    return false;
  if (item.status === "confirmed") {
    if (
      item.confirmedAt === null ||
      item.transfer?.amountMinor !== item.amountDueMinor
    )
      return false;
  } else if (item.confirmedAt !== null) return false;
  if (item.status === "needs_correction" && !item.correctionReason)
    return false;
  if (item.status === "voided" && !item.voidReason) return false;
  return true;
}
export const persistedRentSnapshotSchema = z
  .object(snapshotFields)
  .refine(validSnapshot);
const summaryFields = {
  ...snapshotFields,
  id: z.uuid(),
  propertyId: z.uuid(),
  tenantAccountId: z.uuid(),
  tenantName: z.string().min(1).max(100),
  period: z.string().regex(periodPattern),
  currency: z.literal("AOA"),
  tenantAccessActive: z.boolean(),
  version,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};
export const persistedRentSummarySchema = z
  .object(summaryFields)
  .refine((item) => item.dueOn.startsWith(`${item.period}-`))
  .refine(validSnapshot);
export const persistedRentHistorySchema = z.object({
  id: z.uuid(),
  actorId: z.uuid(),
  actorName: z.string().min(1).max(100),
  kind: z.enum([
    "created",
    "terms_updated",
    "transfer_reported",
    "correction_requested",
    "confirmed",
    "voided",
  ]),
  version,
  before: persistedRentSnapshotSchema.nullable(),
  after: persistedRentSnapshotSchema,
  createdAt: z.iso.datetime(),
});
export const persistedRentRecordSchema = z
  .object({
    ...summaryFields,
    history: z.array(persistedRentHistorySchema).min(1).max(100),
  })
  .refine((item) => item.dueOn.startsWith(`${item.period}-`))
  .refine(validSnapshot);
export const persistedRentListSchema = z.object({
  records: z.array(persistedRentSummarySchema).max(20),
  nextCursor: z.string().min(1).max(120).nullable(),
});
export const persistedRentDetailSchema = z.object({
  record: persistedRentRecordSchema,
});
export const persistedRentMutationSchema = z.object({
  record: persistedRentRecordSchema,
  replayed: z.boolean(),
});
export type PersistedRentRecord = z.infer<typeof persistedRentRecordSchema>;
export type PersistedRentSummary = z.infer<typeof persistedRentSummarySchema>;
export type PersistedRentSnapshot = z.infer<typeof persistedRentSnapshotSchema>;
export type PersistedRentStatus = z.infer<typeof persistedRentStatusSchema>;

/** Parse decimal input without rounding or floating-point currency arithmetic. */
export function parsePersistedRentAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed) || trimmed.length > 20)
    return null;
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return amount > 0n && amount <= BigInt(maxRentMinor) ? Number(amount) : null;
}
export function persistedRentAmountInput(amountMinor: number): string {
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`;
}
export function rentTodayInLuanda(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validRentDueDate(period: string, dueOn: string): boolean {
  return (
    periodPattern.test(period) &&
    dueOn.startsWith(`${period}-`) &&
    boundedDate.safeParse(dueOn).success
  );
}
export function validRentTransferDate(
  value: string,
  now = new Date(),
): boolean {
  return (
    boundedDate.safeParse(value).success && value <= rentTodayInLuanda(now)
  );
}
