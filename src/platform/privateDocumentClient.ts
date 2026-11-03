import { appConfig } from "./config";
import { fetchConfiguredApi } from "./api-transport";
import { AccountClientError } from "./accountClient";
import type { PrivateDocument } from "./documentNotificationContracts";

export const privateFileLimit = 1024 * 1024;
export const privateFileTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export function readPrivateFile(
  file: File,
  signal: AbortSignal,
): Promise<string> {
  if (
    file.size < 1 ||
    file.size > privateFileLimit ||
    !privateFileTypes.some((type) => type === file.type)
  ) {
    return Promise.reject(new AccountClientError(422, "INVALID_FILE"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => {
      reader.abort();
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    const finish = () => signal.removeEventListener("abort", abort);
    reader.onerror = () => {
      finish();
      reject(new AccountClientError(422, "INVALID_FILE"));
    };
    reader.onabort = finish;
    reader.onload = () => {
      finish();
      const value =
        typeof reader.result === "string"
          ? reader.result.split(",")[1]
          : undefined;
      if (!value || signal.aborted)
        reject(new AccountClientError(422, "INVALID_FILE"));
      else resolve(value);
    };
    reader.readAsDataURL(file);
  });
}

/** Read private bytes only after the server rechecks current recipient membership. */
export async function fetchPrivateDocument(
  document: PrivateDocument,
  accountId: string,
  signal: AbortSignal,
): Promise<Blob> {
  if (!appConfig.apiUrl) throw new AccountClientError(503, "accounts_disabled");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, 15_000);
  try {
    const response = await fetchConfiguredApi(
      appConfig.apiUrl,
      `account/documents/${document.id}/content`,
      {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/octet-stream",
          "X-Kasa-Account-Id": accountId,
        },
      },
      { origin: window.location.origin, development: import.meta.env.DEV },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: unknown };
      } | null;
      throw new AccountClientError(
        response.status,
        typeof body?.error?.code === "string"
          ? body.error.code
          : "request_failed",
      );
    }
    if (
      response.headers.get("content-type")?.split(";")[0] !==
        "application/octet-stream" ||
      !response.body
    )
      throw new AccountClientError(502, "invalid_response");
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > privateFileLimit || signal.aborted) {
        await reader.cancel();
        throw new AccountClientError(502, "invalid_response");
      }
      chunks.push(new Uint8Array(chunk.value));
    }
    if (size !== document.byteSize)
      throw new AccountClientError(502, "invalid_response");
    return new Blob(chunks, { type: "application/octet-stream" });
  } catch (error) {
    if (error instanceof AccountClientError || signal.aborted) throw error;
    throw new AccountClientError(0, "network_error");
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
