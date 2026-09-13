export type ApiEnvironment = {
  origin: string;
  development: boolean;
};

function invalidTarget(): never {
  throw new Error("Kasa rejected an invalid API destination.");
}

function hasUnsafeCharacters(value: string): boolean {
  return (
    value.includes("\\") ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    })
  );
}

function isLoopback(url: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/** Restrict requests to the deliberately configured API, including its prefix. */
export function resolveApiTarget(
  base: string,
  path: string,
  environment: ApiEnvironment,
): URL {
  if (
    !base ||
    !path ||
    hasUnsafeCharacters(base) ||
    hasUnsafeCharacters(path) ||
    base.includes("?") ||
    base.includes("#") ||
    path.includes("#")
  ) {
    return invalidTarget();
  }

  let origin: URL;
  let directory: URL;
  try {
    origin = new URL(environment.origin);
    directory = new URL(base, origin);
  } catch {
    return invalidTarget();
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    directory.username ||
    directory.password
  ) {
    return invalidTarget();
  }
  const localHttp =
    directory.protocol === "http:" &&
    origin.protocol === "http:" &&
    isLoopback(origin) &&
    isLoopback(directory) &&
    (directory.origin === origin.origin || environment.development === true);
  if (directory.protocol !== "https:" && !localHttp) {
    return invalidTarget();
  }

  const pathname = path.split("?", 1)[0];
  if (
    !pathname ||
    pathname.includes("%") ||
    pathname.includes(":") ||
    pathname.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return invalidTarget();
  }
  if (!directory.pathname.endsWith("/")) directory.pathname += "/";
  const target = new URL(path, directory);
  if (
    target.origin !== directory.origin ||
    !target.pathname.startsWith(directory.pathname)
  ) {
    return invalidTarget();
  }
  return target;
}

export function fetchConfiguredApi(
  base: string,
  path: string,
  init: RequestInit,
  environment: ApiEnvironment,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  return fetcher(resolveApiTarget(base, path, environment), {
    ...init,
    credentials: "include",
    redirect: "error",
  });
}
