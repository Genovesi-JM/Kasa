import { z } from "zod";
import { appConfig } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  if (!appConfig.apiUrl) {
    throw new ApiError("The remote API is not enabled in this demo.", 503);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000,
  );

  try {
    const response = await fetch(new URL(path, appConfig.apiUrl), {
      ...options,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      signal: controller.signal,
    });

    const requestId = response.headers.get("x-request-id") || undefined;
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new ApiError(
        payload?.message || "Kasa could not complete this request.",
        response.status,
        requestId,
      );
    }

    return responseSchema.parse(await response.json());
  } finally {
    window.clearTimeout(timeout);
  }
}
