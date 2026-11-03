import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import {
  savedViewingActionInputSchema,
  savedViewingCreateInputSchema,
} from "../src/platform/persistedViewingContracts.ts";
import type { PublicAccount } from "./account-store.ts";
import type { ViewingStore } from "./viewing-store.ts";
import { WorkspaceError } from "./workspace-store.ts";
const uuid = z.uuid().transform((value) => value.toLowerCase());
const queryNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^(?:0|[1-9]\d*)$/)
    .max(16)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const pagination = z.strictObject({
  offset: queryNumber(0, 1000000).default(0),
  limit: queryNumber(1, 50).default(20),
});
export function createViewingRouter(
  store: ViewingStore,
  authenticate: (
    request: Request,
    response: Response,
    requireCsrf: boolean,
  ) => { account: PublicAccount } | null,
) {
  const router = express.Router();
  function handle(
    write: boolean,
    operation: (actorId: string, request: Request, response: Response) => void,
  ) {
    return (request: Request, response: Response, next: NextFunction) => {
      const session = authenticate(request, response, write);
      if (!session) return;
      try {
        operation(session.account.id, request, response);
      } catch (error) {
        next(error);
      }
    };
  }
  router.get(
    "/conversations/:id/viewings",
    handle(false, (actorId, request, response) => {
      response.json(
        store.list(
          actorId,
          uuid.parse(request.params.id),
          pagination.parse(request.query),
        ),
      );
    }),
  );
  router.post(
    "/conversations/:id/viewings",
    handle(true, (actorId, request, response) => {
      const result = store.create(
        actorId,
        uuid.parse(request.params.id),
        savedViewingCreateInputSchema.parse(request.body),
      );
      response.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  router.get(
    "/viewings/:id",
    handle(false, (actorId, request, response) => {
      z.strictObject({}).parse(request.query);
      response.json(store.get(actorId, uuid.parse(request.params.id)));
    }),
  );
  router.post(
    "/viewings/:id/actions",
    handle(true, (actorId, request, response) => {
      response.json(
        store.act(
          actorId,
          uuid.parse(request.params.id),
          savedViewingActionInputSchema.parse(request.body),
        ),
      );
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
      if (error instanceof WorkspaceError || error instanceof z.ZodError) {
        const validation = error instanceof z.ZodError;
        response.status(validation ? 422 : error.status).json({
          error: {
            code: validation ? "VALIDATION_ERROR" : error.code,
            message: validation
              ? "Check the supplied viewing details."
              : error.message,
          },
          ...(typeof response.locals.requestId === "string"
            ? { requestId: response.locals.requestId }
            : {}),
        });
        return;
      }
      next(error);
    },
  );
  return router;
}
