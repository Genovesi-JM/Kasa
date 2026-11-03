import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function physicalPath(path: string) {
  let ancestor = path;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  return resolve(realpathSync(ancestor), relative(ancestor, path));
}

type LocalAccountOptions = {
  enabled: boolean;
  production: boolean;
  host: string;
  allowedOrigins: string[];
  databasePath?: string;
  projectRoot: string;
};

/** This development adapter must never become an accidental public identity service. */
export function validateLocalAccountConfig(
  options: LocalAccountOptions,
): string | null {
  if (!options.enabled) return null;
  if (options.production)
    throw new Error("Local accounts are not available in production.");
  if (!["127.0.0.1", "::1"].includes(options.host))
    throw new Error("Local accounts require an explicit loopback API bind.");
  if (
    !options.allowedOrigins.length ||
    options.allowedOrigins.some((value) => {
      try {
        const url = new URL(value);
        return (
          url.origin !== value ||
          url.protocol !== "http:" ||
          !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
          !url.port ||
          Boolean(url.username || url.password)
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      "Local accounts require exact HTTP loopback origins with explicit ports.",
    );
  if (
    !options.databasePath ||
    !isAbsolute(options.databasePath) ||
    !/\.sqlite$/.test(options.databasePath)
  )
    throw new Error(
      "KASA_API_ACCOUNT_DB must be an absolute .sqlite file path.",
    );
  const lexicalPath = resolve(options.databasePath);
  const path = physicalPath(lexicalPath);
  const projectPaths = [
    relative(resolve(options.projectRoot), lexicalPath),
    relative(physicalPath(resolve(options.projectRoot)), path),
  ];
  if (
    projectPaths.some(
      (relativePath) =>
        !relativePath ||
        (!relativePath.startsWith("../") && !isAbsolute(relativePath)),
    )
  )
    throw new Error(
      "The account database must be outside the web project and its served files.",
    );
  return path;
}
