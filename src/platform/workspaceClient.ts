import { z } from "zod";
import { appConfig } from "./config";
import { fetchConfiguredApi } from "./api-transport";
import { AccountClientError } from "./accountClient";

export * from "./workspaceContracts";

/** Expected identity detects stale tabs; the server still authorises by its session. */
export async function workspaceRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    accountId: string;
    csrfToken: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  if (!appConfig.apiUrl) throw new AccountClientError(503, "accounts_disabled");
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
      `account/${path}`,
      {
        method: options.method ?? "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-Kasa-Account-Id": options.accountId,
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.method && options.method !== "GET"
            ? { "X-CSRF-Token": options.csrfToken }
            : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      { origin: window.location.origin, development: import.meta.env.DEV },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z
        .object({ error: z.object({ code: z.string().max(80) }) })
        .safeParse(payload);
      throw new AccountClientError(
        response.status,
        parsed.success ? parsed.data.error.code : "request_failed",
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new AccountClientError(502, "invalid_response");
    return parsed.data;
  } catch (error) {
    if (error instanceof AccountClientError || options.signal?.aborted)
      throw error;
    throw new AccountClientError(0, timedOut ? "timeout" : "network_error");
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
