import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { PublicAccount } from "./account-store.ts";
import { WorkspaceError, type WorkspaceStore } from "./workspace-store.ts";

const name = z.string().trim().min(1).max(100);
const address = z.string().trim().min(1).max(300);
const version = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER - 1);
const uuid = z.uuid();
const propertySchema = z.strictObject({ name, address });
const profileSchema = z.strictObject({ name, address, version });
const maintenanceSchema = z.strictObject({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(["normal", "urgent"]),
});
const updateSchema = z
  .strictObject({
    version,
    status: z.enum(["open", "in_progress", "resolved"]).optional(),
    message: z.string().trim().min(1).max(2000).optional(),
  })
  .refine(
    (input) => input.status !== undefined || input.message !== undefined,
    { message: "Add a message or a status change." },
  );

function failure(
  response: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  response.status(status).json({
    error: { code, message, ...(fields ? { fields } : {}) },
    ...(typeof response.locals.requestId === "string"
      ? { requestId: response.locals.requestId }
      : {}),
  });
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

/** Auth and CSRF are supplied by the existing account router; URL roles have no authority. */
export function createWorkspaceRouter(
  store: WorkspaceStore,
  authenticate: (
    request: Request,
    response: Response,
    requireCsrf: boolean,
  ) => { account: PublicAccount } | null,
) {
  const router = express.Router();
  function handle(
    write: boolean,
    operation: (
      account: PublicAccount,
      request: Request,
      response: Response,
    ) => void,
  ) {
    return (request: Request, response: Response, next: NextFunction) => {
      const session = authenticate(request, response, write);
      if (!session) return;
      const expectedAccount = request.get("x-kasa-account-id");
      if (
        expectedAccount !== undefined &&
        expectedAccount !== session.account.id
      ) {
        failure(
          response,
          401,
          "ACCOUNT_CHANGED",
          "The active account changed. Refresh before continuing.",
        );
        return;
      }
      try {
        operation(session.account, request, response);
      } catch (error) {
        next(error);
      }
    };
  }

  router.get(
    "/workspaces",
    handle(false, (account, _request, response) => {
      response.json({ workspaces: store.listWorkspaces(account.id) });
    }),
  );
  router.post(
    "/workspaces",
    handle(true, (account, request, response) => {
      const input = parse(z.strictObject({ name }), request.body);
      response
        .status(201)
        .json({ workspace: store.createWorkspace(account.id, input.name) });
    }),
  );
  router.post(
    "/workspaces/:workspaceId/properties",
    handle(true, (account, request, response) => {
      response.status(201).json({
        property: store.createProperty(
          account.id,
          parse(uuid, request.params.workspaceId),
          parse(propertySchema, request.body),
        ),
      });
    }),
  );
  router.patch(
    "/properties/:propertyId",
    handle(true, (account, request, response) => {
      response.json({
        property: store.updateProperty(
          account.id,
          parse(uuid, request.params.propertyId),
          parse(profileSchema, request.body),
        ),
      });
    }),
  );
  router.get(
    "/properties/:propertyId/access",
    handle(false, (account, request, response) => {
      response.json(
        store.propertyAccess(
          account.id,
          parse(uuid, request.params.propertyId),
        ),
      );
    }),
  );
  router.delete(
    "/properties/:propertyId/tenants/:accountId",
    handle(true, (account, request, response) => {
      parse(z.strictObject({}), request.body);
      response.json(
        store.removeTenant(
          account.id,
          parse(uuid, request.params.propertyId),
          parse(uuid, request.params.accountId),
        ),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/invitations",
    handle(true, (account, request, response) => {
      const input = parse(z.strictObject({ accountId: uuid }), request.body);
      response.status(201).json({
        invitation: store.createInvitation(
          account.id,
          parse(uuid, request.params.propertyId),
          input.accountId,
        ),
      });
    }),
  );
  router.delete(
    "/invitations/:invitationId",
    handle(true, (account, request, response) => {
      parse(z.strictObject({}), request.body);
      response.json(
        store.revokeInvitation(
          account.id,
          parse(uuid, request.params.invitationId),
        ),
      );
    }),
  );
  router.post(
    "/invitations/accept",
    handle(true, (account, request, response) => {
      const input = parse(
        z.strictObject({
          code: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9_-]{43}$/),
        }),
        request.body,
      );
      response.json(store.acceptInvitation(account.id, input.code));
    }),
  );
  router.get(
    "/properties/:propertyId/maintenance",
    handle(false, (account, request, response) => {
      response.json({
        requests: store.listMaintenance(
          account.id,
          parse(uuid, request.params.propertyId),
        ),
      });
    }),
  );
  router.post(
    "/properties/:propertyId/maintenance",
    handle(true, (account, request, response) => {
      response.status(201).json({
        request: store.createMaintenance(
          account.id,
          parse(uuid, request.params.propertyId),
          parse(maintenanceSchema, request.body),
        ),
      });
    }),
  );
  router.patch(
    "/maintenance/:requestId",
    handle(true, (account, request, response) => {
      response.json({
        request: store.updateMaintenance(
          account.id,
          parse(uuid, request.params.requestId),
          parse(updateSchema, request.body),
        ),
      });
    }),
  );
  router.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      if (response.headersSent) return next(error);
      if (error instanceof WorkspaceError) {
        failure(response, error.status, error.code, error.message);
        return;
      }
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const key = String(issue.path[0] ?? "form");
          (fields[key] ??= []).push(issue.message);
        }
        failure(
          response,
          422,
          "VALIDATION_ERROR",
          "Check the supplied workspace details.",
          fields,
        );
        return;
      }
      next(error);
    },
  );
  return router;
}
