import { z } from "zod";

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const propertyQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  intent: z.enum(["rent", "buy"]).optional(),
  propertyType: z.enum(["Apartment", "House", "Studio", "Loft"]).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minBeds: z.coerce.number().int().nonnegative().optional(),
  minBaths: z.coerce.number().int().nonnegative().optional(),
  verified: booleanQuery.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const spaceQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum(["sports", "events"]).optional(),
  availableToday: booleanQuery.optional(),
  bookingMode: z.enum(["instant", "request"]).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minCapacity: z.coerce.number().int().nonnegative().optional(),
  amenities: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const reservationSchema = z
  .object({
    venueId: z.number().int().positive(),
    spaceId: z.number().int().positive(),
    date: z.iso.date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    bookingMode: z.enum(["request", "instant"]).default("request"),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const rentProofSchema = z.object({
  rentRecordId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase()),
  transferReference: z.string().trim().min(3).max(120),
  documentReference: z.string().trim().min(3).max(240),
  transferredAt: z.iso.datetime(),
});
