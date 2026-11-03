import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { PublicAccount } from "./account-store.ts";
import { WorkspaceError } from "./workspace-store.ts";
import type { PrivateDataStore } from "./private-data-store.ts";

const uuid = z.uuid();
const metadata = {
  title: z.string().trim().min(1).max(140),
  sharing: z.enum(["private", "shared"]),
  recipientAccountId: uuid.optional(),
};
const uploadSchema = z.strictObject({
  ...metadata,
  sharing: metadata.sharing.default("private"),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  contentBase64: z
    .string()
    .min(1)
    .max(4 * Math.ceil((1024 * 1024) / 3)),
});
const updateSchema = z.strictObject({
  ...metadata,
  version: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 1),
  archived: z.boolean(),
});
const cursorSchema = z
  .string()
  .regex(/^\d{1,13}:[0-9a-f-]{36}$/i)
  .refine((value) => {
    const [time, id] = value.split(":");
    return Number.isSafeInteger(Number(time)) && uuid.safeParse(id).success;
  });

function failure(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({
    error: { code, message },
    ...(typeof response.locals.requestId === "string"
      ? { requestId: response.locals.requestId }
      : {}),
  });
}

export function createPrivateDataRouter(
  store: PrivateDataStore,
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
      try {
        operation(session.account, request, response);
      } catch (error) {
        next(error);
      }
    };
  }
  router.get(
    "/properties/:propertyId/documents",
    handle(false, (account, request, response) => {
      response.json({
        documents: store.listDocuments(
          account.id,
          uuid.parse(request.params.propertyId),
        ),
      });
    }),
  );
  router.post(
    "/properties/:propertyId/documents",
    handle(true, (account, request, response) => {
      response.status(201).json({
        document: store.uploadDocument(
          account.id,
          uuid.parse(request.params.propertyId),
          uploadSchema.parse(request.body),
        ),
      });
    }),
  );
  router.patch(
    "/documents/:documentId",
    handle(true, (account, request, response) => {
      response.json({
        document: store.updateDocument(
          account.id,
          uuid.parse(request.params.documentId),
          updateSchema.parse(request.body),
        ),
      });
    }),
  );
  router.get(
    "/documents/:documentId/content",
    handle(false, (account, request, response) => {
      const { document, content } = store.documentContent(
        account.id,
        uuid.parse(request.params.documentId),
      );
      const ascii = document.filename.replace(/[^a-zA-Z0-9 ._()-]/g, "_");
      const encoded = encodeURIComponent(document.filename).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      response.set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
        "Content-Length": String(content.length),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store",
      });
      response.send(content);
    }),
  );
  router.get(
    "/notifications",
    handle(false, (account, request, response) => {
      const { before } = z
        .strictObject({ before: cursorSchema.optional() })
        .parse(request.query);
      const cursor = before?.split(":");
      response.json(
        store.listNotifications(
          account.id,
          cursor
            ? { time: Number(cursor[0]), id: cursor[1].toLowerCase() }
            : undefined,
        ),
      );
    }),
  );
  router.patch(
    "/notifications/:notificationId",
    handle(true, (account, request, response) => {
      z.strictObject({ read: z.literal(true) }).parse(request.body);
      response.json({
        notification: store.readNotification(
          account.id,
          uuid.parse(request.params.notificationId),
        ),
      });
    }),
  );
  router.post(
    "/notifications/read-all",
    handle(true, (account, request, response) => {
      z.strictObject({}).parse(request.body);
      response.json(store.readAllNotifications(account.id));
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
        const fileInvalid = error.issues.some((issue) =>
          ["filename", "mimeType", "contentBase64"].includes(
            String(issue.path[0]),
          ),
        );
        failure(
          response,
          422,
          fileInvalid ? "INVALID_FILE" : "VALIDATION_ERROR",
          "Check the supplied document or notification details.",
        );
        return;
      }
      next(error);
    },
  );
  return router;
}
