import { strict as assert } from "node:assert";
import {
  mkdtempSync,
  mkdirSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateLocalAccountConfig } from "./account-config.ts";

const options = {
  enabled: true,
  production: false,
  host: "127.0.0.1",
  allowedOrigins: ["http://127.0.0.1:5174"],
  databasePath: "/private/kasa-development/accounts.sqlite",
  projectRoot: "/workspace/kasa",
};
assert.equal(validateLocalAccountConfig(options), options.databasePath);
assert.equal(
  validateLocalAccountConfig({ ...options, enabled: false, production: true }),
  null,
);
assert.throws(
  () => validateLocalAccountConfig({ ...options, production: true }),
  /production/,
);
for (const host of ["0.0.0.0", "localhost", "::", "192.168.1.5"])
  assert.throws(
    () => validateLocalAccountConfig({ ...options, host }),
    /loopback/,
  );
for (const origin of [
  "*",
  "null",
  "https://example.org",
  "http://localhost",
  "http://127.0.0.1:5174/",
  "http://localhost:5174/path",
  "http://user@localhost:5174",
  "http://localhost.evil:5174",
])
  assert.throws(
    () => validateLocalAccountConfig({ ...options, allowedOrigins: [origin] }),
    /origins/,
  );
assert.throws(
  () => validateLocalAccountConfig({ ...options, allowedOrigins: [] }),
  /origins/,
);
for (const databasePath of [
  undefined,
  "",
  "./accounts.sqlite",
  "/private/kasa.db",
  "/workspace/kasa/accounts.sqlite",
  "/workspace/kasa/dist/accounts.sqlite",
  "/workspace/kasa/../kasa/private/accounts.sqlite",
])
  assert.throws(() => validateLocalAccountConfig({ ...options, databasePath }));
for (const origin of ["http://localhost:5174", "http://[::1]:5174"])
  assert.equal(
    validateLocalAccountConfig({
      ...options,
      host: "::1",
      allowedOrigins: [origin],
    }),
    options.databasePath,
  );
const directory = mkdtempSync(join(tmpdir(), "kasa-account-config-"));
const project = join(directory, "project");
const privateDirectory = join(directory, "private");
const alias = join(directory, "alias");
const exposed = join(project, "exposed");
mkdirSync(project);
mkdirSync(privateDirectory);
symlinkSync(project, alias);
symlinkSync(privateDirectory, exposed);
try {
  for (const databasePath of [
    join(alias, "accounts.sqlite"),
    join(exposed, "accounts.sqlite"),
  ])
    assert.throws(
      () =>
        validateLocalAccountConfig({
          ...options,
          projectRoot: project,
          databasePath,
        }),
      /outside the web project/,
    );
} finally {
  // Exact fixtures created above; never follow symlinks or recursively remove directories.
  unlinkSync(alias);
  unlinkSync(exposed);
  rmdirSync(project);
  rmdirSync(privateDirectory);
  rmdirSync(directory);
}
console.log(
  "✓ local account configuration: explicit opt-in, loopback only, no public origins, no web-root database, production refused",
);
