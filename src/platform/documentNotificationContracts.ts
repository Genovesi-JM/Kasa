import { z } from "zod";

export const privateDocumentSchema = z
  .object({
    id: z.uuid(),
    propertyId: z.uuid(),
    title: z.string().min(1).max(140),
    filename: z.string().min(1).max(255),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(1024 * 1024),
    sharing: z.enum(["private", "shared"]),
    recipientAccountId: z.uuid().nullable(),
    uploadedBy: z.uuid(),
    uploadedByName: z.string().min(1).max(100),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    archived: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((item) =>
    item.sharing === "shared"
      ? item.recipientAccountId !== null
      : item.recipientAccountId === null,
  )
  .refine((item) => !item.archived || item.sharing === "private");
export const privateDocumentListSchema = z.object({
  documents: z.array(privateDocumentSchema).max(25),
});
export const privateDocumentResponseSchema = z.object({
  document: privateDocumentSchema,
});
export const savedNotificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum([
    "maintenance_created",
    "maintenance_updated",
    "document_shared",
    "rent_created",
    "rent_terms_updated",
    "rent_transfer_reported",
    "rent_correction_requested",
    "rent_confirmed",
    "rent_voided",
  ]),
  propertyId: z.uuid(),
  resourceId: z.uuid(),
  actorName: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export const savedNotificationsSchema = z.object({
  notifications: z.array(savedNotificationSchema).max(50),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).max(120).nullable(),
});
export const savedNotificationResponseSchema = z.object({
  notification: savedNotificationSchema,
});
export const readAllNotificationsSchema = z.object({
  updated: z.number().int().nonnegative(),
});
export type PrivateDocument = z.infer<typeof privateDocumentSchema>;
export type SavedNotification = z.infer<typeof savedNotificationSchema>;
export type WorkspaceNotificationTarget = {
  notificationId: string;
  propertyId: string;
  resourceId: string;
  kind: SavedNotification["kind"];
};
export type NotificationOpenOutcome =
  "opened" | "unavailable" | "cancelled" | "failed";
export type NotificationNavigation = {
  requestId: string;
  accountId: string;
  target: WorkspaceNotificationTarget;
};
