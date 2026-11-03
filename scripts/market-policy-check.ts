import assert from "node:assert/strict";
import {
  buildCountryConfig,
  countryConfigSchema,
  marketGateIds,
} from "../src/platform/marketPolicy";
import {
  marketReadinessCopy,
  marketReadinessTranslations,
} from "../src/components/marketReadinessCopy";
import type { LanguageCode } from "../src/i18n";

for (const country of ["demo", "ao", " AO ", "es", "zz"]) {
  const config = buildCountryConfig(country);
  assert.equal(config.country, country.trim().toLowerCase());
  assert.equal(config.capabilityScope, "synthetic_demo");
  assert.equal(config.launch.status, "blocked");
  assert.equal(config.launch.productionReady, false);
  assert.ok(
    Object.values(config.launch.liveCapabilities).every(
      (value) => value === false,
    ),
  );
  assert.deepEqual(Object.keys(config.launch.gates), [...marketGateIds]);
  assert.ok(
    Object.values(config.launch.gates).every((value) => value === "pending"),
  );
}

const policy = buildCountryConfig("ao");
for (const key of [
  "rentCustody",
  "depositCustody",
  "propertySuccessFees",
  "partyRepresentation",
  "overnightSpaces",
  "mortgageIntermediation",
  "externalVenuePayments",
] as const) {
  const invalid = structuredClone(policy);
  Object.assign(invalid.features, { [key]: true });
  assert.equal(
    countryConfigSchema.safeParse(invalid).success,
    false,
    `${key} must fail closed`,
  );
}
for (const key of Object.keys(policy.launch.liveCapabilities)) {
  const invalid = structuredClone(policy);
  Object.assign(invalid.launch.liveCapabilities, { [key]: true });
  assert.equal(countryConfigSchema.safeParse(invalid).success, false);
}
for (const key of marketGateIds) {
  for (const status of ["approved", "complete", undefined]) {
    const invalid = structuredClone(policy);
    Object.assign(invalid.launch.gates, { [key]: status });
    assert.equal(countryConfigSchema.safeParse(invalid).success, false);
  }
}
for (const launch of [
  undefined,
  { ...policy.launch, status: "approved" },
  { ...policy.launch, productionReady: true },
]) {
  assert.equal(
    countryConfigSchema.safeParse({ ...policy, launch }).success,
    false,
  );
}
assert.equal(
  countryConfigSchema.safeParse({ ...policy, capabilityScope: "production" })
    .success,
  false,
);
// Callers receive separate objects; mutating a response cannot approve a later market.
Object.assign(policy.launch, { productionReady: true });
assert.equal(buildCountryConfig("ao").launch.productionReady, false);

const languages: LanguageCode[] = ["pt", "en", "es", "fr", "ar", "zh"];
for (const language of languages) {
  const raw = marketReadinessTranslations[language];
  const copy = marketReadinessCopy(language);
  assert.deepEqual(
    Object.keys(raw).sort(),
    Object.keys(marketReadinessTranslations.en).sort(),
  );
  for (const [key, value] of Object.entries(raw)) {
    assert.ok(value.trim());
    if (language === "ar" || language === "zh") {
      assert.equal(
        copy[key as keyof typeof copy],
        `${value} (${marketReadinessTranslations.en[key as keyof typeof copy]})`,
      );
    }
  }
  for (const gate of marketGateIds)
    assert.ok(copy[gate] && copy[`${gate}Note`]);
}
console.log(
  "Market policy checks passed: demo/live separation, locked boundaries, missing/altered approvals, country isolation and six-language readiness copy.",
);
