import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createWorkspaceStore,
  migrateWorkspaceStore,
} from "./workspace-store.ts";
import {
  createPrivateDataStore,
  migratePrivateDataStore,
} from "./private-data-store.ts";
import { createRentStore, migrateRentStore } from "./rent-store.ts";
import {
  createMarketplaceStore,
  migrateMarketplaceStore,
} from "./marketplace-store.ts";
import { createViewingStore, migrateViewingStore } from "./viewing-store.ts";

export type AccountLocale = "pt" | "en" | "es" | "fr" | "ar" | "zh";

export interface PublicAccount {
  id: string;
  displayName: string;
  email: string;
  locale: AccountLocale;
  version: number;
  emailVerified: false;
}

interface AccountRow {
  id: string;
  display_name: string;
  email: string;
  locale: AccountLocale;
  version: number;
  password_salt: string;
  password_hash: string;
}

export interface StoredCredential {
  id: string;
  passwordSalt: string;
  passwordHash: string;
}

function publicAccount(row: AccountRow): PublicAccount {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    locale: row.locale,
    version: row.version,
    emailVerified: false,
  };
}

function requirePrivatePath(path: string, directory = false) {
  const info = lstatSync(path);
  if (
    info.isSymbolicLink() ||
    (directory ? !info.isDirectory() : !info.isFile()) ||
    (!directory && info.nlink !== 1) ||
    (process.getuid && info.uid !== process.getuid()) ||
    (info.mode & 0o077) !== 0
  ) {
    throw new Error(
      "Account storage must use an owner-only directory and regular private files; symbolic links are not supported.",
    );
  }
}

/** Local-development adapter. This is not the production identity database. */
export function createAccountStore(databasePath: string) {
  if (!isAbsolute(databasePath) || resolve(databasePath) !== databasePath) {
    throw new Error("Account database path must be absolute and normalized.");
  }
  const parent = dirname(databasePath);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true, mode: 0o700 });
  requirePrivatePath(parent, true);
  if (!existsSync(databasePath)) {
    const descriptor = openSync(
      databasePath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    closeSync(descriptor);
  }
  requirePrivatePath(databasePath);
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (existsSync(`${databasePath}${suffix}`)) {
      requirePrivatePath(`${databasePath}${suffix}`);
    }
  }

  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
  try {
    database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    const version = database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (version.user_version > 6) {
      throw new Error("Account database was created by a newer application.");
    }
    if (version.user_version === 0) {
      database.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
          locale TEXT NOT NULL CHECK(locale IN ('pt','en','es','fr','ar','zh')),
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_scheme TEXT NOT NULL DEFAULT 'scrypt-n131072-r8-p1-v1'
            CHECK(password_scheme = 'scrypt-n131072-r8-p1-v1'),
          version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE account_sessions (
          token_hash TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        ) STRICT;
        CREATE INDEX account_sessions_owner ON account_sessions(account_id);
        CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
        PRAGMA user_version=1;
        COMMIT;
      `);
    }
    if (version.user_version < 2) migrateWorkspaceStore(database);
    if (version.user_version < 3) migratePrivateDataStore(database);
    if (version.user_version < 4) migrateRentStore(database);
    if (version.user_version < 5) migrateMarketplaceStore(database);
    if (version.user_version < 6) migrateViewingStore(database);
  } catch (error) {
    database.close();
    throw error;
  }

  function transaction<T>(operation: () => T): T {
    database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function addSession(accountId: string, tokenHash: string, expiresAt: number) {
    const now = Date.now();
    database
      .prepare("DELETE FROM account_sessions WHERE expires_at <= ?")
      .run(now);
    // A bounded set of sessions prevents unlimited persistent session growth.
    database
      .prepare(
        `DELETE FROM account_sessions WHERE token_hash IN (
        SELECT token_hash FROM account_sessions WHERE account_id = ?
        ORDER BY created_at DESC LIMIT -1 OFFSET 19
      )`,
      )
      .run(accountId);
    database
      .prepare(
        "INSERT INTO account_sessions(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)",
      )
      .run(tokenHash, accountId, expiresAt, now);
  }

  const privateData = createPrivateDataStore(database);
  return {
    workspaces: createWorkspaceStore(database, privateData),
    privateData,
    rent: createRentStore(database, privateData),
    marketplace: createMarketplaceStore(database),
    viewings: createViewingStore(database),
    createAccount(
      input: {
        email: string;
        displayName: string;
        locale: AccountLocale;
        passwordSalt: string;
        passwordHash: string;
      },
      tokenHash: string,
      expiresAt: number,
      previousTokenHash?: string,
    ): PublicAccount | null {
      return transaction(() => {
        const now = Date.now();
        const row = database
          .prepare(
            `INSERT INTO accounts (
            id,email,display_name,locale,password_salt,password_hash,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING *`,
          )
          .get(
            randomUUID(),
            input.email,
            input.displayName,
            input.locale,
            input.passwordSalt,
            input.passwordHash,
            now,
            now,
          ) as AccountRow | undefined;
        if (!row) return null;
        if (previousTokenHash) {
          database
            .prepare("DELETE FROM account_sessions WHERE token_hash = ?")
            .run(previousTokenHash);
        }
        addSession(row.id, tokenHash, expiresAt);
        return publicAccount(row);
      });
    },
    credentialForEmail(email: string): StoredCredential | null {
      const row = database
        .prepare(
          "SELECT id,password_salt,password_hash FROM accounts WHERE email = ?",
        )
        .get(email) as AccountRow | undefined;
      return row
        ? {
            id: row.id,
            passwordSalt: row.password_salt,
            passwordHash: row.password_hash,
          }
        : null;
    },
    createSession(
      accountId: string,
      tokenHash: string,
      expiresAt: number,
      previousTokenHash?: string,
    ): PublicAccount {
      return transaction(() => {
        if (previousTokenHash) {
          database
            .prepare("DELETE FROM account_sessions WHERE token_hash = ?")
            .run(previousTokenHash);
        }
        addSession(accountId, tokenHash, expiresAt);
        const row = database
          .prepare("SELECT * FROM accounts WHERE id = ?")
          .get(accountId) as AccountRow | undefined;
        if (!row) throw new Error("Account no longer exists.");
        return publicAccount(row);
      });
    },
    accountForSession(tokenHash: string): PublicAccount | null {
      const row = database
        .prepare(
          `SELECT accounts.* FROM accounts
          JOIN account_sessions ON account_sessions.account_id = accounts.id
          WHERE account_sessions.token_hash = ? AND account_sessions.expires_at > ?`,
        )
        .get(tokenHash, Date.now()) as AccountRow | undefined;
      return row ? publicAccount(row) : null;
    },
    updateProfile(
      accountId: string,
      input: { displayName: string; locale: AccountLocale; version: number },
    ): PublicAccount | null {
      const row = database
        .prepare(
          `UPDATE accounts SET display_name = ?, locale = ?, version = version + 1,
          updated_at = ? WHERE id = ? AND version = ? RETURNING *`,
        )
        .get(
          input.displayName,
          input.locale,
          Date.now(),
          accountId,
          input.version,
        ) as AccountRow | undefined;
      return row ? publicAccount(row) : null;
    },
    revokeSession(tokenHash: string) {
      database
        .prepare("DELETE FROM account_sessions WHERE token_hash = ?")
        .run(tokenHash);
    },
    close() {
      database.close();
    },
  };
}
