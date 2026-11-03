import { z } from "zod";

const idSchema = z.uuid();
const versionSchema = z.number().int().positive();
export const workspacePropertySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  version: versionSchema,
  tenantCount: z.number().int().nonnegative(),
});
export const propertyWorkspaceSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  role: z.enum(["owner", "tenant"]),
  version: versionSchema,
  properties: z.array(workspacePropertySchema),
});
export const workspacesResponseSchema = z.object({
  workspaces: z.array(propertyWorkspaceSchema),
});
export const createdWorkspaceSchema = z.object({
  workspace: propertyWorkspaceSchema,
});
export const propertyResponseSchema = z.object({
  property: workspacePropertySchema,
});
export const issuedInvitationSchema = z.object({
  invitation: z.object({
    id: idSchema,
    propertyId: idSchema,
    accountId: idSchema,
    code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.iso.datetime(),
  }),
});
export const acceptedInvitationSchema = z.object({
  propertyId: idSchema,
  workspaceId: idSchema,
});
export const revokedInvitationSchema = z.object({ revoked: z.literal(true) });
export const removedTenantSchema = z.object({ removed: z.literal(true) });
export const propertyAccessSchema = z.object({
  tenants: z.array(
    z.object({ accountId: idSchema, displayName: z.string().min(1).max(100) }),
  ),
  invitations: z.array(
    z.object({
      id: idSchema,
      accountId: idSchema,
      expiresAt: z.iso.datetime(),
      status: z.enum(["pending", "accepted", "revoked", "expired"]),
    }),
  ),
});
export const maintenanceStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
]);
export const maintenanceRequestSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(4000),
  priority: z.enum(["normal", "urgent"]),
  status: maintenanceStatusSchema,
  version: versionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  createdBy: idSchema,
  history: z.array(
    z.object({
      id: idSchema,
      actorId: idSchema,
      actorName: z.string().min(1).max(100),
      kind: z.enum(["created", "status_changed", "comment"]),
      message: z.string(),
      status: maintenanceStatusSchema,
      createdAt: z.iso.datetime(),
    }),
  ),
});
export const maintenanceListSchema = z.object({
  requests: z.array(maintenanceRequestSchema),
});
export const maintenanceResponseSchema = z.object({
  request: maintenanceRequestSchema,
});
export type PropertyWorkspaceRecord = z.infer<typeof propertyWorkspaceSchema>;
export type WorkspaceProperty = z.infer<typeof workspacePropertySchema>;
export type MaintenanceRequestRecord = z.infer<typeof maintenanceRequestSchema>;
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;
export type PropertyAccess = z.infer<typeof propertyAccessSchema>;
export type IssuedInvitation = z.infer<
  typeof issuedInvitationSchema
>["invitation"];
