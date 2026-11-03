import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  localListingInputSchema,
  localListingSchema,
  localListingPageSchema,
  privateConversationSchema,
  privateMessagesPageSchema,
  privateMessageMutationSchema,
  parseListingAmount,
  listingAmountInput,
  maxListingMinor,
} from "../src/platform/localMarketplaceContracts";
import {
  localMarketplaceCopy,
  localMarketplaceTranslations,
} from "../src/components/localMarketplaceCopy";
import {
  privateMessagesCopy,
  privateMessagesTranslations,
} from "../src/components/privateMessagesCopy";

const input = {
  title: "Apartamento de teste T2",
  description: "Descrição fictícia para teste local da Kasa.",
  city: "Luanda",
  area: "Talatona",
  intent: "Rent",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 1,
  areaSqm: 90,
  priceMinor: 35000000,
  currency: "AOA",
  furnished: true,
  pets: "ask",
};
assert.ok(localListingInputSchema.safeParse(input).success);
for (const change of [
  { priceMinor: 1.5 },
  { priceMinor: 0 },
  { priceMinor: maxListingMinor + 1 },
  { currency: "EUR" },
  { title: "" },
  { description: "" },
  { bedrooms: -1 },
  { areaSqm: Infinity },
  { pets: "yes" },
  { status: "visible" },
  { email: "private@example.invalid" },
  { address: "private street" },
])
  assert.equal(
    localListingInputSchema.safeParse({ ...input, ...change }).success,
    false,
    JSON.stringify(change),
  );
const listing = {
  ...input,
  id: randomUUID(),
  ownerName: "Anunciante de teste",
  isOwner: false,
  status: "visible",
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
assert.ok(localListingSchema.safeParse(listing).success);
for (const change of [
  { propertyId: randomUUID() },
  { ownerId: randomUUID() },
  { email: "private@example.invalid" },
  { phone: "12345" },
  { status: "draft" },
  { status: "paused" },
  { isOwner: true },
])
  assert.equal(
    localListingSchema.safeParse({ ...listing, ...change }).success,
    false,
    JSON.stringify(change),
  );
assert.ok(
  localListingSchema.safeParse({
    ...listing,
    isOwner: true,
    propertyId: randomUUID(),
    status: "draft",
  }).success,
);
assert.ok(
  localListingPageSchema.safeParse({
    listings: [listing],
    total: 1,
    nextOffset: null,
  }).success,
);
assert.equal(
  localListingPageSchema.safeParse({
    listings: Array(51).fill(listing),
    total: 51,
    nextOffset: null,
  }).success,
  false,
);
for (const [value, expected] of [
  ["350000", 35000000],
  ["0.01", 1],
  [" 12,30 ", 1230],
  ["1.234", null],
  ["1e3", null],
  ["-2", null],
  ["0", null],
  ["NaN", null],
  ["1,000.20", null],
  ["100000000000.00", maxListingMinor],
  ["100000000000.01", null],
] as const)
  assert.equal(parseListingAmount(value), expected, value);
for (const minor of [1, 999, 35000000, maxListingMinor])
  assert.equal(parseListingAmount(listingAmountInput(minor)), minor);
const conversation = {
  id: randomUUID(),
  listingId: listing.id,
  listingTitle: listing.title,
  listingIntent: "Rent",
  listingStatus: "visible",
  counterpartName: "Pessoa de teste",
  isListingOwner: false,
  blockedByMe: false,
  blockedByOther: false,
  version: 1,
  updatedAt: listing.updatedAt,
  unreadCount: 0,
  lastMessage: null,
};
assert.ok(privateConversationSchema.safeParse(conversation).success);
assert.equal(
  privateConversationSchema.safeParse({
    ...conversation,
    counterpartEmail: "private@example.invalid",
  }).success,
  false,
);
const message = {
  id: randomUUID(),
  sequence: 1,
  mine: true,
  body: "Olá, gostaria de saber mais.",
  createdAt: listing.createdAt,
};
const page = {
  conversation,
  messages: [message],
  nextBefore: null,
  latestSequence: 1,
};
assert.ok(privateMessagesPageSchema.safeParse(page).success);
assert.equal(
  privateMessagesPageSchema.safeParse({ ...page, latestSequence: 0 }).success,
  false,
);
assert.equal(
  privateMessagesPageSchema.safeParse({ ...page, messages: [message, message] })
    .success,
  false,
);
assert.equal(
  privateMessagesPageSchema.safeParse({
    ...page,
    messages: [{ ...message, body: "x".repeat(2001) }],
  }).success,
  false,
);
assert.equal(
  privateMessagesPageSchema.safeParse({
    ...page,
    messages: [{ ...message, senderEmail: "secret@example.invalid" }],
  }).success,
  false,
);
assert.ok(
  privateMessageMutationSchema.safeParse({
    conversation,
    message,
    replayed: true,
  }).success,
);
for (const [translations, getCopy] of [
  [localMarketplaceTranslations, localMarketplaceCopy],
  [privateMessagesTranslations, privateMessagesCopy],
] as const) {
  const locales = ["pt", "en", "es", "fr", "ar", "zh"] as const;
  assert.deepEqual(Object.keys(translations).sort(), [...locales].sort());
  const expectedKeys = Object.keys(getCopy("en")).sort();
  for (const locale of locales) {
    const copy = getCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), expectedKeys);
    for (const value of Object.values(copy)) {
      assert.equal(typeof value, "string");
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
}
console.log(
  "Local marketplace contracts: strict privacy DTOs, exact money, bounded messages and six-language interfaces passed.",
);
