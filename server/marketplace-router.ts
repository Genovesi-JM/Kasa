import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import {
  localListingInputSchema,
  localListingIntentSchema,
  localListingTypeSchema,
  localListingPetsSchema,
  localListingStatusSchema,
  maxListingMinor,
} from "../src/platform/localMarketplaceContracts.ts";
import type { PublicAccount } from "./account-store.ts";
import type { MarketplaceStore } from "./marketplace-store.ts";
import { WorkspaceError } from "./workspace-store.ts";

const uuid = z.uuid().transform((value) => value.toLowerCase());
const version = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER - 1);
const queryNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^(?:0|[1-9]\d*)$/)
    .max(16)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const paginationShape = {
  offset: queryNumber(0, 1000000).default(0),
  limit: queryNumber(1, 50).default(24),
};
const pagination = z.strictObject(paginationShape);
const listingQuery = z
  .strictObject({
    ...paginationShape,
    q: z.string().trim().max(120).optional(),
    city: z.string().trim().max(80).optional(),
    intent: localListingIntentSchema.optional(),
    type: localListingTypeSchema.optional(),
    pets: localListingPetsSchema.optional(),
    minPriceMinor: queryNumber(0, maxListingMinor).optional(),
    maxPriceMinor: queryNumber(1, maxListingMinor).optional(),
    sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
  })
  .refine(
    (input) =>
      input.minPriceMinor === undefined ||
      input.maxPriceMinor === undefined ||
      input.minPriceMinor <= input.maxPriceMinor,
    { message: "The minimum price cannot exceed the maximum." },
  );
const messageBody = z.strictObject({
  mutationId: uuid,
  body: z.string().trim().min(1).max(2000),
});

/** All routes remain behind the local account session, Origin and CSRF guards. */
export function createMarketplaceRouter(
  store: MarketplaceStore,
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
    "/listings",
    handle(false, (actor, request, response) => {
      response.json(
        store.list(actor, listingQuery.parse(request.query), false),
      );
    }),
  );
  router.get(
    "/my-listings",
    handle(false, (actor, request, response) => {
      response.json(store.list(actor, pagination.parse(request.query), true));
    }),
  );
  router.get(
    "/listings/:id",
    handle(false, (actor, request, response) => {
      response.json({
        listing: store.get(actor, uuid.parse(request.params.id)),
      });
    }),
  );
  router.post(
    "/listings",
    handle(true, (actor, request, response) => {
      const result = store.create(
        actor,
        z
          .strictObject({
            mutationId: uuid,
            propertyId: uuid,
            ...localListingInputSchema.shape,
          })
          .parse(request.body),
      );
      response.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  router.patch(
    "/listings/:id",
    handle(true, (actor, request, response) => {
      response.json(
        store.update(
          actor,
          uuid.parse(request.params.id),
          z
            .strictObject({
              mutationId: uuid,
              version,
              ...localListingInputSchema.shape,
              status: localListingStatusSchema,
            })
            .parse(request.body),
        ),
      );
    }),
  );
  router.post(
    "/listings/:id/enquiries",
    handle(true, (actor, request, response) => {
      const result = store.enquire(
        actor,
        uuid.parse(request.params.id),
        messageBody.parse(request.body),
      );
      response.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  router.get(
    "/conversations",
    handle(false, (actor, request, response) => {
      response.json(
        store.conversations(actor, pagination.parse(request.query)),
      );
    }),
  );
  router.get(
    "/conversations/:id/messages",
    handle(false, (actor, request, response) => {
      const query = z
        .strictObject({
          before: queryNumber(1, Number.MAX_SAFE_INTEGER).optional(),
        })
        .parse(request.query);
      response.json(
        store.messages(actor, uuid.parse(request.params.id), query.before),
      );
    }),
  );
  router.post(
    "/conversations/:id/messages",
    handle(true, (actor, request, response) => {
      const result = store.send(
        actor,
        uuid.parse(request.params.id),
        messageBody.parse(request.body),
      );
      response.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  router.post(
    "/conversations/:id/read",
    handle(true, (actor, request, response) => {
      const input = z
        .strictObject({
          throughSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        })
        .parse(request.body);
      response.json(
        store.read(actor, uuid.parse(request.params.id), input.throughSequence),
      );
    }),
  );
  router.patch(
    "/conversations/:id/block",
    handle(true, (actor, request, response) => {
      response.json(
        store.block(
          actor,
          uuid.parse(request.params.id),
          z
            .strictObject({ mutationId: uuid, version, blocked: z.boolean() })
            .parse(request.body),
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
              ? "Check the supplied listing or conversation details."
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
