import { z } from "zod";

export const localListingIntentSchema = z.enum(["Rent", "Buy"]);
export const localListingTypeSchema = z.enum([
  "apartment",
  "house",
  "room",
  "land",
  "commercial",
]);
export const localListingStatusSchema = z.enum(["draft", "visible", "paused"]);
export const localListingPetsSchema = z.enum(["allowed", "not_allowed", "ask"]);
export const maxListingMinor = 10000000000000;
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const localListingInputSchema = z.strictObject({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().min(1).max(100),
  intent: localListingIntentSchema,
  propertyType: localListingTypeSchema,
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  areaSqm: z.number().int().min(1).max(1000000),
  priceMinor: z.number().int().min(1).max(maxListingMinor),
  currency: z.literal("AOA"),
  furnished: z.boolean(),
  pets: localListingPetsSchema,
});
export const localListingSchema = z
  .strictObject({
    ...localListingInputSchema.shape,
    id: z.uuid(),
    propertyId: z.uuid().optional(),
    ownerName: z.string().min(1).max(100),
    isOwner: z.boolean(),
    status: localListingStatusSchema,
    version,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((item) => item.isOwner === (item.propertyId !== undefined))
  .refine((item) => item.isOwner || item.status === "visible");
export const localListingPageSchema = z.strictObject({
  listings: z.array(localListingSchema).max(50),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export const localListingDetailSchema = z.strictObject({
  listing: localListingSchema,
});
export const localListingMutationSchema = z.strictObject({
  listing: localListingSchema,
  replayed: z.boolean(),
});
export const privateConversationSchema = z.strictObject({
  id: z.uuid(),
  listingId: z.uuid(),
  listingTitle: z.string().min(5).max(120),
  listingIntent: localListingIntentSchema,
  listingStatus: localListingStatusSchema,
  counterpartName: z.string().min(1).max(100),
  isListingOwner: z.boolean(),
  blockedByMe: z.boolean(),
  blockedByOther: z.boolean(),
  version,
  updatedAt: z.iso.datetime(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: z
    .strictObject({
      body: z.string().min(1).max(2000),
      mine: z.boolean(),
      createdAt: z.iso.datetime(),
    })
    .nullable(),
});
export const privateMessageSchema = z.strictObject({
  id: z.uuid(),
  sequence: z.number().int().positive(),
  mine: z.boolean(),
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime(),
});
export const privateConversationPageSchema = z.strictObject({
  conversations: z.array(privateConversationSchema).max(50),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export const privateMessagesPageSchema = z
  .strictObject({
    conversation: privateConversationSchema,
    messages: z.array(privateMessageSchema).max(50),
    nextBefore: z.number().int().positive().nullable(),
    latestSequence: z.number().int().nonnegative(),
  })
  .refine((page) =>
    page.messages.every(
      (message, index) =>
        message.sequence <= page.latestSequence &&
        (index === 0 || message.sequence > page.messages[index - 1].sequence),
    ),
  );
export const privateMessageMutationSchema = z.strictObject({
  conversation: privateConversationSchema,
  message: privateMessageSchema,
  replayed: z.boolean(),
});
export const privateConversationMutationSchema = z.strictObject({
  conversation: privateConversationSchema,
  replayed: z.boolean(),
});
export const privateConversationReadSchema = z.strictObject({
  conversation: privateConversationSchema,
});
export type LocalListing = z.infer<typeof localListingSchema>;
export type LocalListingInput = z.infer<typeof localListingInputSchema>;
export type PrivateConversation = z.infer<typeof privateConversationSchema>;
export type PrivateMessage = z.infer<typeof privateMessageSchema>;

export function parseListingAmount(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text) || text.length > 20) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return amount > 0n && amount <= BigInt(maxListingMinor)
    ? Number(amount)
    : null;
}
export function listingAmountInput(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
