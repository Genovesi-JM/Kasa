import { z } from "zod";
import { appConfig } from "./config";
import { fetchConfiguredApi } from "./api-transport";

export const accountLocaleSchema = z.enum(["pt", "en", "es", "fr", "ar", "zh"]);

export const privateAccountSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(100),
  email: z.email(),
  locale: accountLocaleSchema,
  version: z.number().int().positive(),
  emailVerified: z.literal(false),
});

export const accountSessionSchema = z.union([
  z.object({ account: privateAccountSchema, csrfToken: z.string().min(16) }),
  z.object({ account: z.null(), csrfToken: z.null() }),
]);

export type PrivateAccount = z.infer<typeof privateAccountSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;

export class AccountClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    // Do not display or retain untrusted server text or submitted credentials.
    super("The account request could not be completed.");
    this.name = "AccountClientError";
  }
}

type AccountRequest = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  csrfToken?: string;
  signal?: AbortSignal;
};

/** Cookies remain HttpOnly; the short-lived CSRF token stays in component memory. */
export async function accountRequest(
  action: "session" | "register" | "login" | "profile" | "logout",
  options: AccountRequest = {},
): Promise<AccountSession> {
  if (!appConfig.apiUrl) {
    throw new AccountClientError(503, "accounts_disabled");
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);

  try {
    const response = await fetchConfiguredApi(
      appConfig.apiUrl,
      `account/${action}`,
      {
        method: options.method ?? "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.csrfToken ? { "X-CSRF-Token": options.csrfToken } : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      { origin: window.location.origin, development: import.meta.env.DEV },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = z
        .object({ error: z.object({ code: z.string().max(80) }) })
        .safeParse(payload);
      throw new AccountClientError(
        response.status,
        error.success ? error.data.error.code : "request_failed",
      );
    }
    const parsed = accountSessionSchema.safeParse(payload);
    if (!parsed.success) throw new AccountClientError(502, "invalid_response");
    if (
      (action === "logout" && parsed.data.account !== null) ||
      (["register", "login", "profile"].includes(action) &&
        parsed.data.account === null)
    ) {
      throw new AccountClientError(502, "invalid_response");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AccountClientError) throw error;
    if (options.signal?.aborted) throw error;
    throw new AccountClientError(0, timedOut ? "timeout" : "network_error");
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
