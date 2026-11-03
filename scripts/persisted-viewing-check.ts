import { strict as assert } from "node:assert";
import {
  conversationViewingsCopy,
  conversationViewingsTranslations,
} from "../src/components/conversationViewingsCopy";
import {
  savedViewingCreateInputSchema,
  savedViewingActionInputSchema,
  savedViewingSchema,
  savedViewingDetailSchema,
  savedViewingPageSchema,
  viewingLocalToUtc,
  viewingUtcToLocal,
  isActiveSavedViewing,
} from "../src/platform/persistedViewingContracts";

const id = "f362213a-9154-4789-a14f-616920eac6de";
const start = "2030-03-01T23:00:00.000Z";
const end = "2030-03-02T00:00:00.000Z";
const input = {
  mutationId: id,
  startsAt: start,
  durationMinutes: 60,
  note: " Test ",
};
assert.equal(savedViewingCreateInputSchema.parse(input).note, "Test");
assert.equal(
  savedViewingCreateInputSchema.parse({
    ...input,
    startsAt: "2030-03-01T23:00:00Z",
  }).startsAt,
  start,
);
for (const startsAt of [
  "2030-02-30T23:00:00.000Z",
  "2030-03-01T23:00:01.000Z",
  "2030-03-01T23:00:00.001Z",
  "2030-03-01T23:00:00.0000001Z",
  "2030-03-01T23:00:00+01:00",
  "not-a-date",
])
  assert.equal(
    savedViewingCreateInputSchema.safeParse({ ...input, startsAt }).success,
    false,
  );
for (const durationMinutes of [0, 14, 16, 181, 15.5])
  assert.equal(
    savedViewingCreateInputSchema.safeParse({ ...input, durationMinutes })
      .success,
    false,
  );
assert.equal(
  savedViewingCreateInputSchema.safeParse({ ...input, note: "x".repeat(1001) })
    .success,
  false,
);
for (const key of [
  "ownerId",
  "propertyId",
  "isListingOwner",
  "status",
  "timeZone",
])
  assert.equal(
    savedViewingCreateInputSchema.safeParse({ ...input, [key]: "forged" })
      .success,
    false,
  );
for (const action of ["confirm", "accept", "decline", "cancel"] as const) {
  const value = { mutationId: id, version: 1, action, note: "" };
  assert.ok(savedViewingActionInputSchema.safeParse(value).success);
  assert.equal(
    savedViewingActionInputSchema.safeParse({ ...value, startsAt: start })
      .success,
    false,
  );
}
assert.ok(
  savedViewingActionInputSchema.safeParse({
    ...input,
    version: 1,
    action: "propose",
  }).success,
);
assert.equal(
  savedViewingActionInputSchema.safeParse({
    mutationId: id,
    version: 1,
    action: "propose",
  }).success,
  false,
);
assert.equal(
  savedViewingActionInputSchema.safeParse({
    ...input,
    version: 1,
    action: "complete",
  }).success,
  false,
);
const viewing = savedViewingSchema.parse({
  id,
  conversationId: id,
  listingId: id,
  listingTitle: "Local test listing",
  status: "requested",
  startsAt: start,
  endsAt: end,
  durationMinutes: 60,
  isListingOwner: false,
  timeZone: "Africa/Luanda",
  note: "Test",
  version: 1,
  createdAt: start,
  updatedAt: start,
});
for (const key of [
  "propertyId",
  "ownerId",
  "requesterId",
  "email",
  "address",
  "phone",
])
  assert.equal(
    savedViewingSchema.safeParse({ ...viewing, [key]: "private" }).success,
    false,
  );
assert.equal(
  savedViewingSchema.safeParse({ ...viewing, endsAt: start }).success,
  false,
);
assert.equal(
  savedViewingSchema.safeParse({ ...viewing, timeZone: "Europe/Madrid" })
    .success,
  false,
);
const snapshot = {
  status: viewing.status,
  startsAt: start,
  endsAt: end,
  durationMinutes: 60,
};
const history = [
  {
    id,
    sequence: 1,
    action: "request",
    actorRole: "requester",
    mine: true,
    note: "Test",
    before: null,
    after: snapshot,
    createdAt: start,
  },
];
assert.ok(savedViewingDetailSchema.safeParse({ viewing, history }).success);
assert.equal(
  savedViewingDetailSchema.safeParse({ viewing, history: [] }).success,
  false,
);
assert.equal(
  savedViewingDetailSchema.safeParse({
    viewing,
    history: [...history, { ...history[0], email: "secret" }],
  }).success,
  false,
);
assert.equal(
  savedViewingPageSchema.safeParse({
    viewings: Array(51).fill(viewing),
    total: 51,
    nextOffset: null,
  }).success,
  false,
);
assert.equal(viewingLocalToUtc("2030-03-02T00:00"), start);
assert.equal(viewingUtcToLocal(start), "2030-03-02T00:00");
assert.equal(viewingLocalToUtc("2030-02-30T09:00"), null);
assert.equal(viewingLocalToUtc("2030-03-01T24:00"), null);
assert.equal(viewingLocalToUtc("2030-03-01T09:60"), null);
assert.equal(viewingLocalToUtc("2030-03-01T09:00Z"), null);
assert.equal(viewingUtcToLocal("invalid"), "");
assert.ok(isActiveSavedViewing(viewing, Date.parse(end) + 1));
assert.ok(
  isActiveSavedViewing({ ...viewing, status: "proposed" }, Date.parse(end) + 1),
);
assert.ok(
  isActiveSavedViewing(
    { ...viewing, status: "confirmed" },
    Date.parse(end) - 1,
  ),
);
assert.equal(
  isActiveSavedViewing({ ...viewing, status: "confirmed" }, Date.parse(end)),
  false,
);
assert.equal(
  isActiveSavedViewing({ ...viewing, status: "cancelled" }, Date.parse(start)),
  false,
);
assert.equal(
  isActiveSavedViewing({ ...viewing, status: "declined" }, Date.parse(start)),
  false,
);
const locales = ["pt", "en", "es", "fr", "ar", "zh"] as const;
assert.deepEqual(
  Object.keys(conversationViewingsTranslations).sort(),
  [...locales].sort(),
);
const expectedKeys = Object.keys(conversationViewingsCopy("en")).sort();
for (const locale of locales) {
  const copy = conversationViewingsCopy(locale);
  assert.deepEqual(Object.keys(copy).sort(), expectedKeys);
  for (const value of Object.values(copy)) {
    assert.ok(value.trim().length > 0);
    if (locale === "ar" || locale === "zh") {
      assert.match(value, /\([A-Za-z][\s\S]*\)$/);
      assert.match(
        value,
        locale === "ar" ? /\p{Script=Arabic}/u : /\p{Script=Han}/u,
      );
    }
  }
}
console.log(
  "Saved viewing contracts passed: strict private DTOs, action fields, exact Luanda civil time, bounded history, active-state semantics and six-language copy.",
);
