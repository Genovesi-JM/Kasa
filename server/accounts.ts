import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { createAccountStore, type PublicAccount } from "./account-store.ts";
import { createWorkspaceRouter } from "./workspaces.ts";
import { createPrivateDataRouter } from "./private-data.ts";
import { createRentRouter } from "./rent.ts";
import { createMarketplaceRouter } from "./marketplace-router.ts";
import { createViewingRouter } from "./viewing-router.ts";

const COOKIE_NAME = "kasa_account_session";
const COOKIE_PATH = "/api/v1/account";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const localeSchema = z.enum(["pt", "en", "es", "fr", "ar", "zh"]);
const displayNameSchema = z.string().trim().min(1).max(100);
const emailSchema = z.string().trim().toLowerCase().max(254).email();
const passwordSchema = z.string().min(12).max(128);
const registrationSchema = z.strictObject({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema,
});
const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
const profileSchema = z.strictObject({
  displayName: displayNameSchema,
  locale: localeSchema,
  version: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 1),
});

function apiError(
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

function parseInput<T>(
  schema: z.ZodType<T>,
  request: Request,
  response: Response,
): T | null {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    // No submitted values, passwords, SQL diagnostics or stack traces are echoed.
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? "form");
      (fields[name] ??= []).push(issue.message);
    }
    apiError(
      response,
      422,
      "VALIDATION_ERROR",
      "Check the supplied account details.",
      fields,
    );
    return null;
  }
  return parsed.data;
}

function sessionToken(request: Request): string | null {
  const cookies = (request.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (cookies.length !== 1) return null;
  const token = cookies[0].slice(COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function csrfToken(token: string) {
  return createHmac("sha256", token)
    .update("kasa-account-csrf-v1")
    .digest("base64url");
}

function equalText(first: string, second: string) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

/** Mount only in explicitly enabled, loopback-only local development. */
export function createAccountRouter(options: {
  databasePath: string;
  allowedOrigins: string[];
  secureCookies?: boolean;
}) {
  const store = createAccountStore(options.databasePath);
  const router = express.Router();
  const origins = new Set(options.allowedOrigins);
  const cookieOptions = {
    httpOnly: true,
    secure: options.secureCookies ?? false,
    sameSite: "strict" as const,
    path: COOKIE_PATH,
  };
  const dummySalt = randomBytes(32).toString("hex");
  let pendingPasswordOperations = 0;

  router.use((_request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "X-Kasa-Data-Mode": "local-persisted",
    });
    next();
  });
  router.use((request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }
    const origin = request.get("origin");
    if (!origin || !origins.has(origin) || origin === "null") {
      apiError(
        response,
        403,
        "ORIGIN_DENIED",
        "This request origin is not permitted.",
      );
      return;
    }
    if (!request.is("application/json")) {
      apiError(
        response,
        422,
        "VALIDATION_ERROR",
        "Send an application/json request.",
      );
      return;
    }
    next();
  });

  const authenticationLimit = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_request, response) => {
      apiError(
        response,
        429,
        "RATE_LIMITED",
        "Too many failed attempts. Try again later.",
      );
    },
  });
  const registrationLimit = rateLimit({
    windowMs: 60 * 60 * 1_000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      apiError(
        response,
        429,
        "RATE_LIMITED",
        "Too many account creation attempts. Try again later.",
      );
    },
  });
  const operationLimit = rateLimit({
    windowMs: 60 * 1_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      apiError(
        response,
        429,
        "RATE_LIMITED",
        "Too many account requests. Try again later.",
      );
    },
  });
  router.use(operationLimit);
  const smallBody = express.json({ limit: "16kb", strict: true });
  const uploadBody = express.json({
    limit: "1450kb",
    strict: true,
    inflate: false,
  });
  router.use((request, response, next) => {
    if (
      request.method === "POST" &&
      /^\/properties\/[^/]+\/documents\/?$/i.test(request.path)
    ) {
      if (!authenticated(request, response)) return;
      uploadBody(request, response, next);
      return;
    }
    smallBody(request, response, next);
  });

  async function withPasswordCapacity(
    response: Response,
    operation: () => Promise<void>,
  ) {
    if (pendingPasswordOperations >= 2) {
      apiError(
        response,
        429,
        "RATE_LIMITED",
        "Account verification is busy. Try again shortly.",
      );
      return;
    }
    pendingPasswordOperations += 1;
    try {
      await operation();
    } finally {
      pendingPasswordOperations -= 1;
    }
  }

  function authenticated(
    request: Request,
    response: Response,
    requireCsrf = true,
  ) {
    const token = sessionToken(request);
    const account = token ? store.accountForSession(tokenHash(token)) : null;
    if (!token || !account) {
      response.clearCookie(COOKIE_NAME, cookieOptions);
      apiError(response, 401, "AUTH_REQUIRED", "Sign in to continue.");
      return null;
    }
    const expectedAccount = request.get("x-kasa-account-id");
    if (expectedAccount !== undefined && expectedAccount !== account.id) {
      apiError(
        response,
        401,
        "ACCOUNT_CHANGED",
        "The active account changed. Refresh before continuing.",
      );
      return null;
    }
    if (
      requireCsrf &&
      !equalText(request.get("x-csrf-token") ?? "", csrfToken(token))
    ) {
      apiError(
        response,
        403,
        "CSRF_DENIED",
        "Refresh your account session and try again.",
      );
      return null;
    }
    return { token, account };
  }

  function signedIn(
    response: Response,
    account: PublicAccount,
    token: string,
    status = 200,
  ) {
    response.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: SESSION_LIFETIME_MS,
    });
    response.status(status).json({ account, csrfToken: csrfToken(token) });
  }

  router.get("/session", (request, response) => {
    const token = sessionToken(request);
    const account = token ? store.accountForSession(tokenHash(token)) : null;
    if (!account || !token) {
      if (request.get("cookie"))
        response.clearCookie(COOKIE_NAME, cookieOptions);
      response.json({ account: null, csrfToken: null });
      return;
    }
    response.json({ account, csrfToken: csrfToken(token) });
  });

  router.post("/register", registrationLimit, async (request, response) => {
    const input = parseInput(registrationSchema, request, response);
    if (!input) return;
    await withPasswordCapacity(response, async () => {
      const passwordSalt = randomBytes(32).toString("hex");
      const passwordHash = (
        await derivePassword(input.password, passwordSalt)
      ).toString("hex");
      const token = randomBytes(32).toString("base64url");
      const previousToken = sessionToken(request);
      const account = store.createAccount(
        { ...input, passwordSalt, passwordHash },
        tokenHash(token),
        Date.now() + SESSION_LIFETIME_MS,
        previousToken ? tokenHash(previousToken) : undefined,
      );
      if (!account) {
        apiError(
          response,
          409,
          "ACCOUNT_EXISTS",
          "An account already uses this email address.",
        );
        return;
      }
      signedIn(response, account, token, 201);
    });
  });

  router.post("/login", authenticationLimit, async (request, response) => {
    const input = parseInput(loginSchema, request, response);
    if (!input) return;
    await withPasswordCapacity(response, async () => {
      const credential = store.credentialForEmail(input.email);
      const hash = await derivePassword(
        input.password,
        credential?.passwordSalt ?? dummySalt,
      );
      const expected = credential
        ? Buffer.from(credential.passwordHash, "hex")
        : Buffer.alloc(64);
      const correct =
        hash.length === expected.length && timingSafeEqual(hash, expected);
      if (!credential || !correct) {
        apiError(
          response,
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
        );
        return;
      }
      const token = randomBytes(32).toString("base64url");
      const previousToken = sessionToken(request);
      const account = store.createSession(
        credential.id,
        tokenHash(token),
        Date.now() + SESSION_LIFETIME_MS,
        previousToken ? tokenHash(previousToken) : undefined,
      );
      signedIn(response, account, token);
    });
  });

  router.patch("/profile", (request, response) => {
    const session = authenticated(request, response);
    if (!session) return;
    const input = parseInput(profileSchema, request, response);
    if (!input) return;
    const account = store.updateProfile(session.account.id, input);
    if (!account) {
      apiError(
        response,
        409,
        "VERSION_CONFLICT",
        "This profile changed elsewhere. Reload it before saving.",
      );
      return;
    }
    response.json({ account, csrfToken: csrfToken(session.token) });
  });

  router.post("/logout", (request, response) => {
    const session = authenticated(request, response);
    if (!session) return;
    if (!parseInput(z.strictObject({}), request, response)) return;
    store.revokeSession(tokenHash(session.token));
    response.clearCookie(COOKIE_NAME, cookieOptions);
    response.json({ account: null, csrfToken: null });
  });

  router.use(createWorkspaceRouter(store.workspaces, authenticated));
  router.use(createPrivateDataRouter(store.privateData, authenticated));
  router.use(createRentRouter(store.rent, authenticated));
  router.use(
    "/market",
    createMarketplaceRouter(store.marketplace, authenticated),
  );

  router.use("/market", createViewingRouter(store.viewings, authenticated));
  router.use((_request, response) => {
    apiError(
      response,
      404,
      "NOT_FOUND",
      "This account endpoint does not exist.",
    );
  });
  router.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      if (response.headersSent) {
        next(error);
        return;
      }
      const parseError = error as { type?: string };
      if (
        parseError?.type === "entity.parse.failed" ||
        parseError?.type === "entity.too.large" ||
        parseError?.type === "encoding.unsupported"
      ) {
        apiError(
          response,
          422,
          "VALIDATION_ERROR",
          "Send a valid account request.",
        );
        return;
      }
      apiError(
        response,
        500,
        "ACCOUNT_UNAVAILABLE",
        "Account storage is temporarily unavailable. Try again later.",
      );
    },
  );

  return { router, close: () => store.close() };
}
