import { randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { properties, spaceVenues } from "../src/data.ts";
import { apiConfig } from "./config.ts";
import {
  propertyQuerySchema,
  rentProofSchema,
  reservationSchema,
  spaceQuerySchema,
} from "./schemas.ts";

const app = express();
const idempotentResponses = new Map<string, unknown>();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || apiConfig.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by the Kasa API."));
    },
  }),
);
app.use(express.json({ limit: "250kb", strict: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use((request, response, next) => {
  const requestId =
    request.header("x-request-id")?.slice(0, 100) || randomUUID();
  response.setHeader("x-request-id", requestId);
  response.locals.requestId = requestId;
  next();
});

function safeKeyEquals(
  received: string | undefined,
  expected: string,
): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function requireDemoWrite(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!apiConfig.demoWrites || !apiConfig.demoKey) {
    response.status(503).json({
      message:
        "Writes are disabled. Configure an authenticated persistence service before production use.",
      requestId: response.locals.requestId,
    });
    return;
  }
  if (!safeKeyEquals(request.header("x-kasa-demo-key"), apiConfig.demoKey)) {
    response.status(401).json({
      message: "A valid demo API key is required.",
      requestId: response.locals.requestId,
    });
    return;
  }
  next();
}

function requireIdempotency(
  request: Request,
  response: Response,
): string | null {
  const key = request.header("idempotency-key")?.trim();
  if (!key || key.length < 16 || key.length > 200) {
    response.status(400).json({
      message: "A 16–200 character Idempotency-Key header is required.",
      requestId: response.locals.requestId,
    });
    return null;
  }
  return key;
}

app.get("/api/v1", (_request, response) => {
  response.json({
    name: "Kasa API",
    version: "v1",
    documentation: "/api/v1/openapi.yaml",
  });
});

app.get("/api/v1/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "kasa-api",
    version: "0.1.0",
    time: new Date().toISOString(),
    demoWrites: apiConfig.demoWrites,
  });
});

app.get("/api/v1/config", (request, response) => {
  const country = String(
    request.query.country || apiConfig.country,
  ).toLowerCase();
  response.json({
    country,
    currency: country === "ao" ? "AOA" : "EUR",
    features: {
      propertyDiscovery: true,
      propertyOperations: true,
      services: true,
      spacesSports: true,
      spacesEvents: true,
      overnightSpaces: false,
      rentCustody: false,
      mortgageIntermediation: false,
      externalVenuePayments: false,
    },
    readiness: country === "demo" ? "demo" : "requires_market_approval",
  });
});

app.get("/api/v1/properties", (request, response) => {
  const parsed = propertyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid property filters.",
      issues: parsed.error.issues,
    });
    return;
  }
  const filters = parsed.data;
  const filtered = properties.filter((property) => {
    const haystack =
      `${property.title} ${property.address} ${property.city} ${property.neighbourhood}`.toLowerCase();
    return (
      (!filters.q || haystack.includes(filters.q.toLowerCase())) &&
      (!filters.intent ||
        property.listingType.toLowerCase() === filters.intent) &&
      (!filters.propertyType ||
        property.propertyType === filters.propertyType) &&
      (filters.minPrice === undefined || property.price >= filters.minPrice) &&
      (filters.maxPrice === undefined || property.price <= filters.maxPrice) &&
      (filters.minBeds === undefined || property.beds >= filters.minBeds) &&
      (filters.minBaths === undefined || property.baths >= filters.minBaths) &&
      (filters.verified === undefined || property.verified === filters.verified)
    );
  });
  const items = filtered.slice(filters.offset, filters.offset + filters.limit);
  response.json({
    items,
    total: filtered.length,
    nextOffset:
      filters.offset + items.length < filtered.length
        ? filters.offset + items.length
        : null,
  });
});

app.get("/api/v1/properties/:id", (request, response) => {
  const property = properties.find(
    (item) => item.id === Number(request.params.id),
  );
  if (!property) {
    response.status(404).json({ message: "Property not found." });
    return;
  }
  response.json(property);
});

app.get("/api/v1/spaces", (request, response) => {
  const parsed = spaceQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response
      .status(400)
      .json({ message: "Invalid space filters.", issues: parsed.error.issues });
    return;
  }
  const filters = parsed.data;
  const requestedAmenities = (filters.amenities || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const filtered = spaceVenues.filter((venue) => {
    const haystack =
      `${venue.name} ${venue.address} ${venue.neighbourhood} ${venue.description}`.toLowerCase();
    const capacity = Math.max(
      venue.capacity || 0,
      ...venue.spaces.map((space) => space.capacity),
    );
    return (
      (!filters.q || haystack.includes(filters.q.toLowerCase())) &&
      (!filters.category ||
        venue.category.toLowerCase() === filters.category) &&
      (filters.availableToday === undefined ||
        venue.availableToday === filters.availableToday) &&
      (!filters.bookingMode ||
        venue.bookingMode.toLowerCase().startsWith(filters.bookingMode)) &&
      (filters.maxPrice === undefined || venue.priceFrom <= filters.maxPrice) &&
      (filters.minCapacity === undefined || capacity >= filters.minCapacity) &&
      requestedAmenities.every((amenity) =>
        venue.amenities.some((item) => item.toLowerCase().includes(amenity)),
      )
    );
  });
  const items = filtered.slice(filters.offset, filters.offset + filters.limit);
  response.json({
    items,
    total: filtered.length,
    nextOffset:
      filters.offset + items.length < filtered.length
        ? filters.offset + items.length
        : null,
  });
});

app.get("/api/v1/spaces/:id", (request, response) => {
  const venue = spaceVenues.find(
    (item) => item.id === Number(request.params.id),
  );
  if (!venue) {
    response.status(404).json({ message: "Space venue not found." });
    return;
  }
  response.json(venue);
});

app.post(
  "/api/v1/space-reservations",
  requireDemoWrite,
  (request, response) => {
    const idempotencyKey = requireIdempotency(request, response);
    if (!idempotencyKey) return;
    const cached = idempotentResponses.get(`space:${idempotencyKey}`);
    if (cached) {
      response.status(200).json(cached);
      return;
    }
    const parsed = reservationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        message: "Invalid reservation request.",
        issues: parsed.error.issues,
      });
      return;
    }
    const venue = spaceVenues.find((item) => item.id === parsed.data.venueId);
    const space = venue?.spaces.find((item) => item.id === parsed.data.spaceId);
    if (!venue || !space) {
      response
        .status(404)
        .json({ message: "Venue or schedulable space not found." });
      return;
    }
    const reservation = {
      id: randomUUID(),
      ...parsed.data,
      status: "requested",
      version: 1,
      createdAt: new Date().toISOString(),
      payment: {
        recipient: "venue_operator",
        processor: "not_configured",
        kasaCustody: false,
      },
    };
    idempotentResponses.set(`space:${idempotencyKey}`, reservation);
    response.status(201).json(reservation);
  },
);

app.post(
  "/api/v1/rent-records/proofs",
  requireDemoWrite,
  (request, response) => {
    const idempotencyKey = requireIdempotency(request, response);
    if (!idempotencyKey) return;
    const cached = idempotentResponses.get(`rent:${idempotencyKey}`);
    if (cached) {
      response.status(200).json(cached);
      return;
    }
    const parsed = rentProofSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        message: "Invalid rent proof record.",
        issues: parsed.error.issues,
      });
      return;
    }
    const record = {
      id: randomUUID(),
      ...parsed.data,
      status: "awaiting_landlord_confirmation",
      moneyFlow: "tenant_to_landlord",
      kasaCustody: false,
      recordedAt: new Date().toISOString(),
    };
    idempotentResponses.set(`rent:${idempotencyKey}`, record);
    response.status(201).json(record);
  },
);

app.get("/api/v1/openapi.yaml", (_request, response) => {
  response.type("application/yaml").sendFile(resolve("docs/openapi.yaml"));
});

app.use(
  (
    error: Error,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    void _next;
    console.error(`[${response.locals.requestId}]`, error.message);
    response.status(500).json({
      message: "The Kasa API could not complete this request.",
      requestId: response.locals.requestId,
    });
  },
);

app.listen(apiConfig.port, apiConfig.host, () => {
  console.log(
    `Kasa API listening on http://${apiConfig.host}:${apiConfig.port}/api/v1`,
  );
});
