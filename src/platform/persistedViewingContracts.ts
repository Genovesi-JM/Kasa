import { z } from "zod";

export const viewingTimeZone = "Africa/Luanda" as const;
export const maxViewingAdvanceDays = 180;
export const viewingStatusSchema = z.enum([
  "requested",
  "proposed",
  "confirmed",
  "declined",
  "cancelled",
]);
export const viewingDurationSchema = z
  .number()
  .int()
  .min(15)
  .max(180)
  .multipleOf(15);
const instant = z.iso.datetime().refine((value) => {
  const date = new Date(value);
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00(?:\.0+)?)?Z$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}, "Use a whole-minute UTC date and time.");
const inputInstant = instant.transform((value) =>
  new Date(value).toISOString(),
);
const uuid = z.uuid().transform((value) => value.toLowerCase());
const version = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER - 1);
const note = z.string().trim().max(1000);

export const savedViewingCreateInputSchema = z.strictObject({
  mutationId: uuid,
  startsAt: inputInstant,
  durationMinutes: viewingDurationSchema,
  note: note.default(""),
});
const actionBase = { mutationId: uuid, version, note: note.default("") };
export const savedViewingActionInputSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...actionBase,
    action: z.literal("propose"),
    startsAt: inputInstant,
    durationMinutes: viewingDurationSchema,
  }),
  z.strictObject({ ...actionBase, action: z.literal("confirm") }),
  z.strictObject({ ...actionBase, action: z.literal("accept") }),
  z.strictObject({ ...actionBase, action: z.literal("decline") }),
  z.strictObject({ ...actionBase, action: z.literal("cancel") }),
]);
const snapshotShape = {
  status: viewingStatusSchema,
  startsAt: instant,
  endsAt: instant,
  durationMinutes: viewingDurationSchema,
};
const validDuration = (value: {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}) =>
  Date.parse(value.endsAt) - Date.parse(value.startsAt) ===
  value.durationMinutes * 60_000;
export const savedViewingSnapshotSchema = z
  .strictObject(snapshotShape)
  .refine(validDuration);
export const savedViewingSchema = z
  .strictObject({
    ...snapshotShape,
    id: z.uuid(),
    conversationId: z.uuid(),
    listingId: z.uuid(),
    listingTitle: z.string().min(5).max(120),
    isListingOwner: z.boolean(),
    timeZone: z.literal(viewingTimeZone),
    note,
    version,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(validDuration);
export const savedViewingEventSchema = z.strictObject({
  id: z.uuid(),
  sequence: z.number().int().min(1).max(50),
  action: z.enum([
    "request",
    "propose",
    "confirm",
    "accept",
    "decline",
    "cancel",
  ]),
  actorRole: z.enum(["owner", "requester"]),
  mine: z.boolean(),
  note,
  before: savedViewingSnapshotSchema.nullable(),
  after: savedViewingSnapshotSchema,
  createdAt: z.iso.datetime(),
});
export const savedViewingPageSchema = z.strictObject({
  viewings: z.array(savedViewingSchema).max(50),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
});
const detailShape = {
  viewing: savedViewingSchema,
  history: z.array(savedViewingEventSchema).min(1).max(50),
};
export const savedViewingDetailSchema = z.strictObject(detailShape);
export const savedViewingMutationSchema = z.strictObject({
  ...detailShape,
  replayed: z.boolean(),
});
export type SavedViewing = z.infer<typeof savedViewingSchema>;
export type SavedViewingEvent = z.infer<typeof savedViewingEventSchema>;
export type SavedViewingDetail = z.infer<typeof savedViewingDetailSchema>;
export type SavedViewingCreateInput = z.infer<
  typeof savedViewingCreateInputSchema
>;
export type SavedViewingActionInput = z.infer<
  typeof savedViewingActionInputSchema
>;

/** Explicit Luanda civil time. This local slice has no device-timezone inference. */
export function viewingLocalToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}:00+01:00`);
  if (!Number.isFinite(parsed)) return null;
  const canonical = new Date(parsed).toISOString();
  return viewingUtcToLocal(canonical) === value ? canonical : null;
}
export function viewingUtcToLocal(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed + 60 * 60_000).toISOString().slice(0, 16);
}
export function isActiveSavedViewing(
  value: SavedViewing,
  now = Date.now(),
): boolean {
  return (
    value.status === "requested" ||
    value.status === "proposed" ||
    (value.status === "confirmed" && Date.parse(value.endsAt) > now)
  );
}
