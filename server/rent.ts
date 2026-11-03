import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import type { PublicAccount } from "./account-store.ts";
import type { RentStore } from "./rent-store.ts";
import { WorkspaceError } from "./workspace-store.ts";

const uuid = z.uuid().transform((value) => value.toLowerCase());
const mutationId = uuid;
const version = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER - 1);
const amount = z.number().int().min(1).max(100000000000);
function validDate(value: string) {
  if (!/^(?:19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
const date = z
  .string()
  .refine(validDate, "Choose a real calendar date between 1900 and 2199.");
const period = z.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/);
function luandaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const createSchema = z
  .strictObject({
    mutationId,
    tenantAccountId: uuid,
    period,
    currency: z.literal("AOA"),
    amountDueMinor: amount,
    dueOn: date,
  })
  .refine((input) => input.dueOn.slice(0, 7) === input.period, {
    path: ["dueOn"],
    message: "The due date must be within the rent month.",
  });
const editSchema = z.strictObject({
  mutationId,
  version,
  amountDueMinor: amount,
  dueOn: date,
});
const transferSchema = z.strictObject({
  mutationId,
  version,
  amountMinor: amount,
  transferredOn: date.refine(
    (value) => value <= luandaToday(),
    "The transfer date cannot be in the future in Angola.",
  ),
  reference: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(
      (value) =>
        !Array.from(value).some((character) => {
          const point = character.codePointAt(0)!;
          return point < 32 || point === 127;
        }),
      "Use a single-line transfer reference.",
    ),
  note: z.string().trim().max(1000).default(""),
  evidenceDocumentId: uuid.nullable().default(null),
});
const reason = z.string().trim().min(1).max(500);
const reviewSchema = z.discriminatedUnion("decision", [
  z.strictObject({ mutationId, version, decision: z.literal("confirm") }),
  z.strictObject({
    mutationId,
    version,
    decision: z.literal("request_correction"),
    reason,
  }),
]);
const voidSchema = z.strictObject({ mutationId, version, reason });
const cursor = z
  .string()
  .max(80)
  .regex(/^\d{1,16}:[0-9a-f-]{36}$/i)
  .transform((value) => {
    const [time, id] = value.split(":");
    return { time: Number(time), id };
  })
  .pipe(
    z.strictObject({
      time: z.number().int().min(0).max(8640000000000000),
      id: uuid,
    }),
  );

/** Records direct transfers only. This module never initiates, receives or verifies a payment. */
export function createRentRouter(
  store: RentStore,
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
    "/properties/:propertyId/rent-records",
    handle(false, (account, request, response) => {
      const query = z
        .strictObject({ before: cursor.optional() })
        .parse(request.query);
      response.json(
        store.list(
          account.id,
          uuid.parse(request.params.propertyId),
          query.before,
        ),
      );
    }),
  );
  router.get(
    "/rent-records/:recordId",
    handle(false, (account, request, response) => {
      response.json({
        record: store.get(account.id, uuid.parse(request.params.recordId)),
      });
    }),
  );
  router.post(
    "/properties/:propertyId/rent-records",
    handle(true, (account, request, response) => {
      const result = store.create(
        account.id,
        uuid.parse(request.params.propertyId),
        createSchema.parse(request.body),
      );
      response.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  router.patch(
    "/rent-records/:recordId",
    handle(true, (account, request, response) => {
      response.json(
        store.update(
          account.id,
          uuid.parse(request.params.recordId),
          editSchema.parse(request.body),
        ),
      );
    }),
  );
  router.post(
    "/rent-records/:recordId/transfer",
    handle(true, (account, request, response) => {
      response.json(
        store.transfer(
          account.id,
          uuid.parse(request.params.recordId),
          transferSchema.parse(request.body),
        ),
      );
    }),
  );
  router.post(
    "/rent-records/:recordId/review",
    handle(true, (account, request, response) => {
      response.json(
        store.review(
          account.id,
          uuid.parse(request.params.recordId),
          reviewSchema.parse(request.body),
        ),
      );
    }),
  );
  router.post(
    "/rent-records/:recordId/void",
    handle(true, (account, request, response) => {
      response.json(
        store.void(
          account.id,
          uuid.parse(request.params.recordId),
          voidSchema.parse(request.body),
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
              ? "Check the supplied rent record details."
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
