import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import {
  acceptedInvitationSchema,
  createdWorkspaceSchema,
  issuedInvitationSchema,
  maintenanceListSchema,
  maintenanceResponseSchema,
  propertyAccessSchema,
  propertyResponseSchema,
  removedTenantSchema,
  revokedInvitationSchema,
  workspacesResponseSchema,
} from "../src/platform/workspaceContracts";
import {
  propertyWorkspaceCopy,
  propertyWorkspaceTranslations,
} from "../src/components/propertyWorkspaceCopy";
import type { LanguageCode } from "../src/i18n";
import {
  privateRecordsCopy,
  privateRecordsTranslations,
} from "../src/components/privateRecordsCopy";
import {
  propertyRentCopy,
  propertyRentTranslations,
} from "../src/components/propertyRentCopy";
import {
  parsePersistedRentAmount,
  persistedRentAmountInput,
  persistedRentDetailSchema,
  persistedRentListSchema,
  persistedRentMutationSchema,
  rentTodayInLuanda,
  validRentDueDate,
  validRentTransferDate,
} from "../src/platform/persistedRentContracts";

const property = {
  id: randomUUID(),
  workspaceId: randomUUID(),
  name: "Invented local apartment",
  address: "Fictional test address",
  version: 1,
  tenantCount: 1,
};
const workspace = {
  id: property.workspaceId,
  name: "Local test portfolio",
  role: "owner",
  version: 1,
  properties: [property],
};
assert.deepEqual(createdWorkspaceSchema.parse({ workspace }), { workspace });
assert.deepEqual(workspacesResponseSchema.parse({ workspaces: [] }), {
  workspaces: [],
});
assert.equal(
  workspacesResponseSchema.safeParse({
    workspaces: [{ ...workspace, role: "admin" }],
  }).success,
  false,
);
assert.equal(
  workspacesResponseSchema.safeParse({
    workspaces: [{ ...workspace, properties: null }],
  }).success,
  false,
);
assert.equal(
  propertyResponseSchema.safeParse({ property: { ...property, version: 0 } })
    .success,
  false,
);
assert.equal(
  propertyResponseSchema.safeParse({
    property: { ...property, tenantCount: -1 },
  }).success,
  false,
);
assert.equal(
  propertyResponseSchema.safeParse({
    property: { ...property, id: "../../private" },
  }).success,
  false,
);
assert.deepEqual(
  propertyResponseSchema.parse({
    property: { ...property, email: "must-not-enter-ui@example.invalid" },
  }),
  { property },
);

const accountId = randomUUID();
const expiresAt = "2026-10-15T12:00:00.000Z";
const invitation = {
  id: randomUUID(),
  propertyId: property.id,
  accountId,
  code: "a".repeat(43),
  expiresAt,
};
assert.deepEqual(issuedInvitationSchema.parse({ invitation }), { invitation });
assert.equal(
  issuedInvitationSchema.safeParse({
    invitation: { ...invitation, code: "short" },
  }).success,
  false,
);
assert.equal(
  issuedInvitationSchema.safeParse({
    invitation: { ...invitation, expiresAt: "tomorrow" },
  }).success,
  false,
);
assert.deepEqual(
  acceptedInvitationSchema.parse({
    propertyId: property.id,
    workspaceId: workspace.id,
  }),
  { propertyId: property.id, workspaceId: workspace.id },
);
assert.equal(
  revokedInvitationSchema.safeParse({ revoked: false }).success,
  false,
);
assert.equal(removedTenantSchema.safeParse({ removed: "true" }).success, false);
const access = propertyAccessSchema.parse({
  tenants: [
    { accountId, displayName: "Test tenant", email: "private@example.invalid" },
  ],
  invitations: [
    {
      id: invitation.id,
      accountId,
      expiresAt,
      status: "pending",
      code: invitation.code,
    },
  ],
});
assert.equal("email" in access.tenants[0], false);
assert.equal("code" in access.invitations[0], false);
assert.equal(
  propertyAccessSchema.safeParse({
    tenants: [],
    invitations: [
      { id: invitation.id, accountId, expiresAt, status: "approved" },
    ],
  }).success,
  false,
);

const request = {
  id: randomUUID(),
  propertyId: property.id,
  title: "Invented leak",
  description: "A local-only repair fixture.",
  priority: "normal",
  status: "open",
  version: 1,
  createdAt: "2026-10-14T12:00:00.000Z",
  updatedAt: "2026-10-14T12:00:00.000Z",
  createdBy: accountId,
  history: [
    {
      id: randomUUID(),
      actorId: accountId,
      actorName: "Test tenant",
      kind: "created",
      message: "",
      status: "open",
      createdAt: "2026-10-14T12:00:00.000Z",
    },
  ],
};
assert.deepEqual(maintenanceResponseSchema.parse({ request }), { request });
assert.deepEqual(maintenanceListSchema.parse({ requests: [] }), {
  requests: [],
});
for (const patch of [
  { status: "paid" },
  { priority: "critical" },
  { version: 1.5 },
  { createdAt: "invalid" },
  { history: null },
  { history: [{ ...request.history[0], kind: "deleted" }] },
]) {
  assert.equal(
    maintenanceResponseSchema.safeParse({ request: { ...request, ...patch } })
      .success,
    false,
  );
}
const rentSnapshot = {
  amountDueMinor: 35000000,
  dueOn: "2026-10-05",
  status: "awaiting_transfer",
  transfer: null,
  correctionReason: null,
  voidReason: null,
  confirmedAt: null,
};
const rent = {
  ...rentSnapshot,
  id: randomUUID(),
  propertyId: property.id,
  tenantAccountId: accountId,
  tenantName: "Invented tenant",
  period: "2026-10",
  currency: "AOA",
  tenantAccessActive: true,
  version: 1,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  history: [
    {
      id: randomUUID(),
      actorId: randomUUID(),
      actorName: "Invented owner",
      kind: "created",
      version: 1,
      before: null,
      after: rentSnapshot,
      createdAt: "2026-10-01T12:00:00.000Z",
    },
  ],
};
assert.deepEqual(persistedRentDetailSchema.parse({ record: rent }), {
  record: rent,
});
assert.deepEqual(
  persistedRentMutationSchema.parse({ record: rent, replayed: true }),
  { record: rent, replayed: true },
);
assert.equal(
  persistedRentMutationSchema.safeParse({ record: rent }).success,
  false,
);
assert.deepEqual(
  persistedRentListSchema.parse({ records: [], nextCursor: null }),
  { records: [], nextCursor: null },
);
assert.equal(
  persistedRentListSchema.safeParse({
    records: Array(21).fill(rent),
    nextCursor: null,
  }).success,
  false,
);
assert.equal(
  "email" in
    persistedRentDetailSchema.parse({
      record: { ...rent, email: "private@example.invalid" },
    }).record,
  false,
);
for (const patch of [
  { currency: "EUR" },
  { amountDueMinor: 0 },
  { amountDueMinor: 1.1 },
  { amountDueMinor: 100000000001 },
  { dueOn: "2026-09-05" },
  { dueOn: "2026-10-32" },
  { status: "bank_verified" },
  { status: "confirmed", confirmedAt: rent.createdAt },
  { status: "needs_correction", correctionReason: null },
  { tenantAccessActive: "true" },
  { history: [] },
  { history: Array(101).fill(rent.history[0]) },
]) {
  assert.equal(
    persistedRentDetailSchema.safeParse({ record: { ...rent, ...patch } })
      .success,
    false,
    JSON.stringify(patch),
  );
}
for (const [value, minor] of [
  ["0.01", 1],
  ["0,01", 1],
  ["350000", 35000000],
  [" 2500,50 ", 250050],
  ["1.1", 110],
  ["1000000000.00", 100000000000],
] as const) {
  assert.equal(parsePersistedRentAmount(value), minor);
  assert.equal(
    parsePersistedRentAmount(persistedRentAmountInput(minor)),
    minor,
  );
}
for (const value of [
  "",
  "0",
  "-1",
  "+1",
  "1e3",
  "1.001",
  "1,001",
  "1.000,00",
  "1 000",
  "NaN",
  "Infinity",
  "1000000000.01",
  "9".repeat(100),
]) {
  assert.equal(parsePersistedRentAmount(value), null, value);
}
assert.equal(validRentDueDate("2024-02", "2024-02-29"), true);
assert.equal(validRentDueDate("2025-02", "2025-02-29"), false);
assert.equal(validRentDueDate("2026-10", "2026-11-01"), false);
assert.equal(validRentDueDate("1800-01", "1800-01-01"), false);
assert.equal(validRentDueDate("2200-01", "2200-01-01"), false);
const luandaBoundary = new Date("2026-10-14T23:30:00.000Z");
assert.equal(rentTodayInLuanda(luandaBoundary), "2026-10-15");
assert.equal(validRentTransferDate("2026-10-15", luandaBoundary), true);
assert.equal(validRentTransferDate("2026-10-16", luandaBoundary), false);
assert.equal(validRentTransferDate("2026-02-29", luandaBoundary), false);

for (const language of [
  "pt",
  "en",
  "es",
  "fr",
  "ar",
  "zh",
] satisfies LanguageCode[]) {
  const translated = propertyWorkspaceTranslations[language];
  assert.deepEqual(
    Object.keys(translated).sort(),
    Object.keys(propertyWorkspaceTranslations.en).sort(),
  );
  for (const [key, text] of Object.entries(translated)) {
    assert.ok(text.trim(), `${language}.${key} must be translated`);
    if (language === "ar" || language === "zh") {
      assert.ok(
        propertyWorkspaceCopy(language)[
          key as keyof typeof translated
        ].includes(
          `(${propertyWorkspaceTranslations.en[key as keyof typeof translated]})`,
        ),
        `${language}.${key} needs its English parenthetical`,
      );
    }
  }
  const privateCopy = privateRecordsTranslations[language];
  assert.deepEqual(
    Object.keys(privateCopy).sort(),
    Object.keys(privateRecordsTranslations.en).sort(),
  );
  for (const [key, text] of Object.entries(privateCopy)) {
    assert.ok(
      text.trim(),
      `${language}.privateRecords.${key} must be translated`,
    );
    if (language === "ar" || language === "zh") {
      assert.ok(
        privateRecordsCopy(language)[key as keyof typeof privateCopy].includes(
          `(${privateRecordsTranslations.en[key as keyof typeof privateCopy]})`,
        ),
        `${language}.privateRecords.${key} needs its English parenthetical`,
      );
    }
  }
  const rentCopy = propertyRentTranslations[language];
  assert.deepEqual(
    Object.keys(rentCopy).sort(),
    Object.keys(propertyRentTranslations.en).sort(),
  );
  for (const [key, text] of Object.entries(rentCopy)) {
    assert.ok(
      text.trim(),
      `${language}.propertyRent.${key} must be translated`,
    );
    if (language === "ar" || language === "zh") {
      assert.ok(
        propertyRentCopy(language)[key as keyof typeof rentCopy].includes(
          `(${propertyRentTranslations.en[key as keyof typeof rentCopy]})`,
        ),
        `${language}.propertyRent.${key} needs its English parenthetical`,
      );
    }
  }
}
console.log(
  "✓ local property/rent response validation, exact money/date parsing, private-field stripping and six-language workspace, rent, document and notification copy",
);
