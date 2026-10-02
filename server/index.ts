import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
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
  configQuerySchema,
  positiveDecimalIdSchema,
  propertyQuerySchema,
  rentProofSchema,
  reservationSchema,
  spaceQuerySchema,
} from "./schemas.ts";

const app = express();
const idempotentResponses = new Map<
  string,
  { fingerprint: string; body: unknown }
>();
const webRoot = resolve("dist");
const webEntry = resolve(webRoot, "index.html");

app.disable("x-powered-by");
app.set("query parser", "simple");
app.use((request, response, next) => {
  const requestId =
    request.header("x-request-id")?.slice(0, 100) || randomUUID();
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-kasa-data-mode", "synthetic-demo");
  response.locals.requestId = requestId;
  next();
});

function sendApiError(
  response: Response,
  status: number,
  message: string,
  details: Record<string, unknown> = {},
) {
  response
    .status(status)
    .type("application/json")
    .json({
      ...details,
      message,
      requestId: response.locals.requestId,
    });
}

class OriginNotAllowedError extends Error {}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        // The synthetic catalogue uses HTTPS photos and configurable map tiles.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || apiConfig.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(
        new OriginNotAllowedError("Origin is not allowed by the Kasa API."),
      );
    },
  }),
);
app.use(express.json({ limit: "250kb", strict: true }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) =>
      sendApiError(
        response,
        429,
        "Too many API requests. Please try again later.",
      ),
    // Platform probes and static assets must not exhaust the API's user quota.
    skip: (request) =>
      ["/api/v1/health", "/api/v1/ready"].includes(
        request.originalUrl.split("?")[0],
      ),
  }),
);
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
    sendApiError(
      response,
      503,
      "Writes are disabled. Configure an authenticated persistence service before production use.",
    );
    return;
  }
  if (!safeKeyEquals(request.header("x-kasa-demo-key"), apiConfig.demoKey)) {
    sendApiError(response, 401, "A valid demo API key is required.");
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
    sendApiError(
      response,
      400,
      "A 16–200 character Idempotency-Key header is required.",
    );
    return null;
  }
  return key;
}

function validatedFingerprint(payload: Record<string, unknown>): string {
  // Both write schemas produce normalized objects in schema-defined key order.
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function replayIdempotentResponse(
  response: Response,
  cacheKey: string,
  fingerprint: string,
): boolean {
  const cached = idempotentResponses.get(cacheKey);
  if (!cached) return false;
  if (cached.fingerprint !== fingerprint) {
    sendApiError(
      response,
      409,
      "This Idempotency-Key was already used with a different request.",
    );
  } else {
    response.status(200).json(cached.body);
  }
  return true;
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

app.get("/api/v1/ready", (_request, response) => {
  const ready = !apiConfig.serveWeb || existsSync(webEntry);
  response.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "unavailable",
    mode: apiConfig.publicPilot ? "read_only_demo" : "local_demo",
    data: "synthetic",
    persistence: "not_configured",
    productionReady: false,
    web: apiConfig.serveWeb ? (ready ? "available" : "missing") : "not_served",
  });
});

app.get("/api/v1/config", (request, response) => {
  const parsed = configQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    sendApiError(response, 400, "Invalid country configuration query.", {
      issues: parsed.error.issues,
    });
    return;
  }
  const country = parsed.data.country ?? apiConfig.country;
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
    sendApiError(response, 400, "Invalid property filters.", {
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
  const parsed = positiveDecimalIdSchema.safeParse(request.params.id);
  if (!parsed.success) {
    sendApiError(response, 400, "Invalid property ID.", {
      issues: parsed.error.issues,
    });
    return;
  }
  const property = properties.find((item) => item.id === parsed.data);
  if (!property) {
    sendApiError(response, 404, "Property not found.");
    return;
  }
  response.json(property);
});

app.get("/api/v1/spaces", (request, response) => {
  const parsed = spaceQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    sendApiError(response, 400, "Invalid space filters.", {
      issues: parsed.error.issues,
    });
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
  const parsed = positiveDecimalIdSchema.safeParse(request.params.id);
  if (!parsed.success) {
    sendApiError(response, 400, "Invalid space venue ID.", {
      issues: parsed.error.issues,
    });
    return;
  }
  const venue = spaceVenues.find((item) => item.id === parsed.data);
  if (!venue) {
    sendApiError(response, 404, "Space venue not found.");
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
    const parsed = reservationSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(response, 400, "Invalid reservation request.", {
        issues: parsed.error.issues,
      });
      return;
    }
    const cacheKey = `space:${idempotencyKey}`;
    const fingerprint = validatedFingerprint(parsed.data);
    if (replayIdempotentResponse(response, cacheKey, fingerprint)) return;
    const venue = spaceVenues.find((item) => item.id === parsed.data.venueId);
    const space = venue?.spaces.find((item) => item.id === parsed.data.spaceId);
    if (!venue || !space) {
      sendApiError(response, 404, "Venue or schedulable space not found.");
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
    idempotentResponses.set(cacheKey, { fingerprint, body: reservation });
    response.status(201).json(reservation);
  },
);

app.post(
  "/api/v1/rent-records/proofs",
  requireDemoWrite,
  (request, response) => {
    const idempotencyKey = requireIdempotency(request, response);
    if (!idempotencyKey) return;
    const parsed = rentProofSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(response, 400, "Invalid rent proof record.", {
        issues: parsed.error.issues,
      });
      return;
    }
    const cacheKey = `rent:${idempotencyKey}`;
    const fingerprint = validatedFingerprint(parsed.data);
    if (replayIdempotentResponse(response, cacheKey, fingerprint)) return;
    const record = {
      id: randomUUID(),
      ...parsed.data,
      status: "recorded_metadata",
      linkage: { rentRecord: "unverified", document: "unverified" },
      moneyFlow: "tenant_to_landlord",
      kasaCustody: false,
      recordedAt: new Date().toISOString(),
    };
    idempotentResponses.set(cacheKey, { fingerprint, body: record });
    response.status(201).json(record);
  },
);

app.get("/api/v1/openapi.yaml", (_request, response) => {
  response.type("application/yaml").sendFile(resolve("docs/openapi.yaml"));
});

// Keep unknown API routes as JSON 404s, never the SPA's successful HTML page.
app.use("/api", (_request, response) => {
  sendApiError(response, 404, "API route not found.");
});

if (apiConfig.serveWeb) {
  app.use(express.static(webRoot, { index: false, dotfiles: "deny" }));
  app.get(["/", "/{*path}"], (request, response, next) => {
    if (
      !request.accepts("html") ||
      request.path.split("/").some((part) => part.includes("."))
    ) {
      next();
      return;
    }
    response.setHeader("cache-control", "no-store");
    response.sendFile(webEntry);
  });
}

app.use((_request, response) => {
  sendApiError(response, 404, "Not found.");
});

app.use(
  (
    error: Error & { type?: string },
    _request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (error instanceof OriginNotAllowedError) {
      sendApiError(response, 403, "Origin is not allowed by the Kasa API.");
      return;
    }
    if (error.type === "entity.parse.failed") {
      sendApiError(response, 400, "Request body must be valid JSON.");
      return;
    }
    if (error.type === "entity.too.large") {
      sendApiError(response, 413, "Request body exceeds the 250 KB limit.");
      return;
    }
    console.error(`[${response.locals.requestId}]`, error.message);
    sendApiError(
      response,
      500,
      "The Kasa API could not complete this request.",
    );
  },
);

const server = app.listen(apiConfig.port, apiConfig.host, () => {
  console.log(
    `Kasa API listening on http://${apiConfig.host}:${apiConfig.port}/api/v1`,
  );
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
