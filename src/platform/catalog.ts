import { z } from "zod";
import type { Property, SpaceVenue } from "../types";
import { apiRequest } from "./api";
import { appConfig } from "./config";

const propertySchema: z.ZodType<Property> = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  address: z.string(),
  city: z.string(),
  price: z.number().nonnegative(),
  beds: z.number().int().nonnegative(),
  baths: z.number().int().nonnegative(),
  sqm: z.number().nonnegative(),
  image: z.url(),
  tag: z.string().optional(),
  available: z.string(),
  furnished: z.boolean(),
  landlord: z.string(),
  match: z.number().min(0).max(100),
  listingType: z.enum(["Rent", "Buy"]),
  propertyType: z.enum(["Apartment", "House", "Studio", "Loft"]),
  verified: z.boolean(),
  neighbourhood: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  deposit: z.number().nonnegative(),
  description: z.string(),
  amenities: z.array(z.string()),
  gallery: z.array(z.url()),
});

const slotSchema = z.object({
  time: z.string(),
  status: z.enum(["Available", "Booked", "Peak"]),
  price: z.number().nonnegative(),
});

const spaceUnitSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  activity: z.string(),
  price: z.number().nonnegative(),
  peakPrice: z.number().nonnegative(),
  image: z.url(),
  capacity: z.number().int().nonnegative(),
  slots: z.array(slotSchema),
});

const spaceVenueSchema: z.ZodType<SpaceVenue> = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.enum(["Sports", "Events"]),
  address: z.string(),
  neighbourhood: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  distance: z.string(),
  priceFrom: z.number().nonnegative(),
  priceUnit: z.string(),
  rating: z.number().min(0).max(5),
  reviews: z.number().int().nonnegative(),
  image: z.url(),
  gallery: z.array(z.url()),
  availableToday: z.boolean(),
  verified: z.boolean(),
  bookingMode: z.enum(["Instant Book", "Request to Book"]),
  description: z.string(),
  amenities: z.array(z.string()),
  capacity: z.number().int().nonnegative().optional(),
  openingHours: z.string(),
  cleaningFee: z.number().nonnegative().optional(),
  deposit: z.number().nonnegative().optional(),
  spaces: z.array(spaceUnitSchema),
});

const propertyPageSchema = z.object({
  items: z.array(propertySchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
});

const spacePageSchema = z.object({
  items: z.array(spaceVenueSchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
});

let propertyRequest: Promise<Property[]> | null = null;
let spaceRequest: Promise<SpaceVenue[]> | null = null;

export function listProperties(): Promise<Property[]> {
  propertyRequest ??= apiRequest("properties?limit=100", propertyPageSchema)
    .then((page) => page.items)
    .catch((error: unknown) => {
      propertyRequest = null;
      throw error;
    });
  return propertyRequest;
}

export function listSpaces(): Promise<SpaceVenue[]> {
  spaceRequest ??= apiRequest("spaces?limit=100", spacePageSchema)
    .then((page) => page.items)
    .catch((error: unknown) => {
      spaceRequest = null;
      throw error;
    });
  return spaceRequest;
}

export const apiHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("kasa-api"),
  version: z.string(),
  time: z.iso.datetime(),
  demoWrites: z.boolean(),
});

export function getApiHealth() {
  return apiRequest("health", apiHealthSchema);
}

const featureFlagsSchema = z.object({
  propertyDiscovery: z.boolean(),
  propertyOperations: z.boolean(),
  services: z.boolean(),
  spacesSports: z.boolean(),
  spacesEvents: z.boolean(),
  overnightSpaces: z.boolean(),
  rentCustody: z.boolean(),
  mortgageIntermediation: z.boolean(),
  externalVenuePayments: z.boolean(),
});

const countryConfigSchema = z.object({
  country: z.string(),
  currency: z.string().length(3),
  features: featureFlagsSchema,
  readiness: z.enum(["demo", "requires_market_approval"]),
});

export function getCountryConfig(country = appConfig.country) {
  const params = new URLSearchParams({ country });
  return apiRequest(`config?${params.toString()}`, countryConfigSchema);
}
