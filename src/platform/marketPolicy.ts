import { z } from "zod";

export const marketGateIds = [
  "propertyClassification",
  "privacyHosting",
  "paymentsTax",
  "trustSafety",
  "productionSystems",
] as const;

export type MarketGateId = (typeof marketGateIds)[number];

// This is the prototype's release policy, not an assessment of legal compliance.
// A healthy API or a selected country must never imply permission to go live.
export const countryConfigSchema = z.object({
  country: z.string().trim().min(2).max(12).toLowerCase(),
  currency: z.string().length(3),
  capabilityScope: z.literal("synthetic_demo"),
  features: z.object({
    propertyDiscovery: z.boolean(),
    propertyOperations: z.boolean(),
    services: z.boolean(),
    spacesSports: z.boolean(),
    spacesEvents: z.boolean(),
    overnightSpaces: z.literal(false),
    rentCustody: z.literal(false),
    depositCustody: z.literal(false),
    propertySuccessFees: z.literal(false),
    partyRepresentation: z.literal(false),
    mortgageIntermediation: z.literal(false),
    externalVenuePayments: z.literal(false),
  }),
  readiness: z.enum(["demo", "requires_market_approval"]),
  launch: z.object({
    status: z.literal("blocked"),
    productionReady: z.literal(false),
    liveCapabilities: z.object({
      propertyPublication: z.literal(false),
      paidPropertyPromotion: z.literal(false),
      liveSpaceBookings: z.literal(false),
      jobPublication: z.literal(false),
      connectedPayments: z.literal(false),
    }),
    gates: z.object({
      propertyClassification: z.literal("pending"),
      privacyHosting: z.literal("pending"),
      paymentsTax: z.literal("pending"),
      trustSafety: z.literal("pending"),
      productionSystems: z.literal("pending"),
    }),
  }),
});

export type CountryConfig = z.infer<typeof countryConfigSchema>;

export function buildCountryConfig(country: string): CountryConfig {
  const normalized = country.trim().toLowerCase();
  return countryConfigSchema.parse({
    country: normalized,
    currency: normalized === "ao" ? "AOA" : "EUR",
    capabilityScope: "synthetic_demo",
    features: {
      propertyDiscovery: true,
      propertyOperations: true,
      services: true,
      spacesSports: true,
      spacesEvents: true,
      overnightSpaces: false,
      rentCustody: false,
      depositCustody: false,
      propertySuccessFees: false,
      partyRepresentation: false,
      mortgageIntermediation: false,
      externalVenuePayments: false,
    },
    readiness: normalized === "demo" ? "demo" : "requires_market_approval",
    launch: {
      status: "blocked",
      productionReady: false,
      liveCapabilities: {
        propertyPublication: false,
        paidPropertyPromotion: false,
        liveSpaceBookings: false,
        jobPublication: false,
        connectedPayments: false,
      },
      gates: {
        propertyClassification: "pending",
        privacyHosting: "pending",
        paymentsTax: "pending",
        trustSafety: "pending",
        productionSystems: "pending",
      },
    },
  });
}
