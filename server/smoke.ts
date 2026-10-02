import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { rentProofSchema } from "./schemas.ts";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const demoKey = "kasa-smoke-key-123456789";
const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "test",
    KASA_API_ENV_FILE: ".env.test-unconfigured",
    KASA_API_HOST: "127.0.0.1",
    KASA_API_PORT: String(port),
    KASA_API_DEMO_WRITES: "true",
    KASA_API_DEMO_KEY: demoKey,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
child.stdout.on("data", (chunk) => {
  serverOutput += String(chunk);
});
child.stderr.on("data", (chunk) => {
  serverOutput += String(chunk);
});

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Kasa API exited before startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Kasa API did not start.\n${serverOutput}`);
}

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = (await response.json()) as Record<string, unknown>;
  return { response, payload };
}

function assertApiError(
  result: Awaited<ReturnType<typeof json>>,
  status: number,
  requestId?: string,
) {
  assert.equal(result.response.status, status);
  assert.match(
    result.response.headers.get("content-type") || "",
    /application\/json/,
  );
  const actualId = result.response.headers.get("x-request-id");
  assert.ok(actualId);
  assert.equal(result.payload.requestId, actualId);
  if (requestId) assert.equal(actualId, requestId);
  assert.equal(typeof result.payload.message, "string");
  assert.equal(result.payload.stack, undefined);
}

const checks: string[] = [];
function passed(label: string) {
  checks.push(label);
  console.log(`✓ ${label}`);
}

try {
  await waitForApi();

  const health = await json("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.status, "ok");
  assert.ok(health.response.headers.get("x-request-id"));
  assert.equal(
    health.response.headers.get("x-content-type-options"),
    "nosniff",
  );
  passed("health, request ID and security headers");

  const config = await json("/config?country=ao");
  assert.equal(config.payload.currency, "AOA");
  const features = config.payload.features as Record<string, boolean>;
  assert.equal(features.rentCustody, false);
  assert.equal(features.overnightSpaces, false);
  assert.equal(features.mortgageIntermediation, false);
  passed("country flags preserve regulated product boundaries");

  const propertySearch = await json(
    "/properties?intent=buy&verified=true&maxPrice=650000",
  );
  assert.equal(propertySearch.response.status, 200);
  assert.equal(propertySearch.payload.total, 1);
  passed("property search filters");

  const invalidPropertySearch = await json("/properties?maxPrice=-1");
  assertApiError(invalidPropertySearch, 400);
  const missingProperty = await json("/properties/999999");
  assertApiError(missingProperty, 404);
  passed("property validation and not-found responses");

  const spaceSearch = await json(
    "/spaces?category=sports&availableToday=true&maxPrice=30",
  );
  assert.equal(spaceSearch.response.status, 200);
  assert.ok(Number(spaceSearch.payload.total) >= 1);
  const invalidSpaceSearch = await json("/spaces?category=overnight");
  assertApiError(invalidSpaceSearch, 400);
  passed("Spaces filters reject out-of-scope accommodation");

  const openApi = await fetch(`${baseUrl}/openapi.yaml`);
  assert.equal(openApi.status, 200);
  assert.match(await openApi.text(), /^openapi: 3\.1\.0/m);
  passed("OpenAPI contract is served");

  const unauthorisedWrite = await json("/space-reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assertApiError(unauthorisedWrite, 401);
  passed("write routes reject missing demo authentication");

  for (const [body, expectedStatus, requestId] of [
    ["{", 400, "smoke-malformed-json"],
    ["42", 400, "smoke-json-primitive"],
    [JSON.stringify({ notes: "x".repeat(260_000) }), 413, "smoke-body-limit"],
  ] as const) {
    const result = await json("/space-reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body,
    });
    assertApiError(result, expectedStatus, requestId);
    assert.equal(
      result.response.headers.get("x-kasa-data-mode"),
      "synthetic-demo",
    );
  }
  const blockedOrigin = await json("/health", {
    headers: {
      origin: "https://unapproved.example",
      "x-request-id": "smoke-blocked-origin",
    },
  });
  assertApiError(blockedOrigin, 403, "smoke-blocked-origin");
  assert.equal(
    blockedOrigin.response.headers.get("access-control-allow-origin"),
    null,
  );
  assertApiError(await json("/missing"), 404);
  passed(
    "parser limits, blocked origins and unknown routes return traceable client errors",
  );

  const reservationBody = JSON.stringify({
    venueId: 1,
    spaceId: 11,
    date: "2026-09-01",
    startTime: "18:00",
    endTime: "19:30",
    bookingMode: "request",
  });
  const reservationHeaders = {
    "content-type": "application/json",
    "x-kasa-demo-key": demoKey,
    "idempotency-key": "smoke-reservation-0001",
  };
  const reservation = await json("/space-reservations", {
    method: "POST",
    headers: reservationHeaders,
    body: reservationBody,
  });
  const repeatedReservation = await json("/space-reservations", {
    method: "POST",
    headers: reservationHeaders,
    body: reservationBody,
  });
  assert.equal(reservation.response.status, 201);
  assert.equal(repeatedReservation.response.status, 200);
  assert.equal(reservation.payload.id, repeatedReservation.payload.id);
  const payment = reservation.payload.payment as Record<string, unknown>;
  assert.equal(payment.recipient, "venue_operator");
  assert.equal(payment.kasaCustody, false);
  passed("reservation idempotency and direct-to-venue payment boundary");

  const normalizedReservation = await json("/space-reservations", {
    method: "POST",
    headers: reservationHeaders,
    body: JSON.stringify({
      endTime: "19:30",
      startTime: "18:00",
      date: "2026-09-01",
      spaceId: 11,
      venueId: 1,
    }),
  });
  assert.equal(normalizedReservation.response.status, 200);
  assert.equal(normalizedReservation.payload.id, reservation.payload.id);
  for (const body of [
    { ...JSON.parse(reservationBody), endTime: "20:00" },
    { ...JSON.parse(reservationBody), venueId: 999, spaceId: 999 },
  ]) {
    assertApiError(
      await json("/space-reservations", {
        method: "POST",
        headers: reservationHeaders,
        body: JSON.stringify(body),
      }),
      409,
    );
  }
  assertApiError(
    await json("/space-reservations", {
      method: "POST",
      headers: reservationHeaders,
      body: JSON.stringify({ ...JSON.parse(reservationBody), date: "invalid" }),
    }),
    400,
  );
  const afterConflict = await json("/space-reservations", {
    method: "POST",
    headers: reservationHeaders,
    body: reservationBody,
  });
  assert.equal(afterConflict.payload.id, reservation.payload.id);
  passed(
    "reservation replay normalizes defaults/key order, rejects changed payloads and validates before replay",
  );

  // Idempotency keys remain scoped to the write route.
  const proofHeaders = { ...reservationHeaders };
  const proofBody = {
    rentRecordId: "11111111-1111-4111-8111-111111111111",
    amount: 1850,
    currency: "eur",
    transferReference: "KASA-TEST-SEP",
    documentReference: "private-upload/document-1",
    transferredAt: "2026-08-27T12:00:00Z",
  };
  for (const amount of [0.01, 0.29, 1.1, 1.23, 999_999.99, 1_000_000]) {
    assert.equal(
      rentProofSchema.safeParse({ ...proofBody, amount }).success,
      true,
      `Accept whole-cent amount ${amount}`,
    );
  }
  for (const amount of [
    0,
    -1,
    0.001,
    1.005,
    1.234,
    1_000_000.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.equal(
      rentProofSchema.safeParse({ ...proofBody, amount }).success,
      false,
      `Reject invalid amount ${amount}`,
    );
  }
  for (const currency of ["EUR", "eur", "AoA", "AOA"]) {
    const result = rentProofSchema.parse({ ...proofBody, currency });
    assert.equal(result.currency, currency.toUpperCase());
  }
  for (const currency of ["123", "USD", "", " EUR "]) {
    assert.equal(
      rentProofSchema.safeParse({ ...proofBody, currency }).success,
      false,
    );
  }
  const offsetProof = rentProofSchema.parse({
    ...proofBody,
    transferredAt: "2026-08-27T13:00:00+01:00",
  });
  assert.equal(offsetProof.transferredAt, "2026-08-27T12:00:00.000Z");
  for (const transferredAt of [
    "2026-02-30T12:00:00Z",
    "2099-01-01T12:00:00Z",
    "2099-01-01T13:00:00+01:00",
  ]) {
    assert.equal(
      rentProofSchema.safeParse({ ...proofBody, transferredAt }).success,
      false,
    );
  }
  passed(
    "rent proof schema enforces whole cents, supported currencies and real nonfuture dates",
  );
  const rentProof = await json("/rent-records/proofs", {
    method: "POST",
    headers: proofHeaders,
    body: JSON.stringify(proofBody),
  });
  assert.equal(rentProof.response.status, 201);
  assert.equal(rentProof.payload.moneyFlow, "tenant_to_landlord");
  assert.equal(rentProof.payload.kasaCustody, false);
  assert.equal(rentProof.payload.status, "recorded_metadata");
  assert.deepEqual(rentProof.payload.linkage, {
    rentRecord: "unverified",
    document: "unverified",
  });
  assert.notEqual(rentProof.payload.id, reservation.payload.id);
  passed("rent proof records never imply Kasa custody");

  const normalizedProof = await json("/rent-records/proofs", {
    method: "POST",
    headers: proofHeaders,
    body: JSON.stringify({
      ...proofBody,
      currency: "EUR",
      transferReference: "  KASA-TEST-SEP  ",
      transferredAt: "2026-08-27T13:00:00+01:00",
    }),
  });
  assert.equal(normalizedProof.response.status, 200);
  assert.equal(normalizedProof.payload.id, rentProof.payload.id);
  for (const changed of [
    { ...proofBody, amount: 1900 },
    { ...proofBody, rentRecordId: "22222222-2222-4222-8222-222222222222" },
  ]) {
    assertApiError(
      await json("/rent-records/proofs", {
        method: "POST",
        headers: proofHeaders,
        body: JSON.stringify(changed),
      }),
      409,
    );
  }
  assertApiError(
    await json("/rent-records/proofs", {
      method: "POST",
      headers: proofHeaders,
      body: JSON.stringify({ ...proofBody, amount: -1 }),
    }),
    400,
  );
  const afterProofConflict = await json("/rent-records/proofs", {
    method: "POST",
    headers: proofHeaders,
    body: JSON.stringify(proofBody),
  });
  assert.equal(afterProofConflict.response.status, 200);
  assert.equal(afterProofConflict.payload.id, rentProof.payload.id);
  passed(
    "rent proof replay compares validated normalized payloads and isolates routes",
  );

  for (const [index, invalid] of [
    { amount: 0.001 },
    { amount: 1.005 },
    { amount: 0 },
    { amount: 1_000_000.01 },
    { currency: "123" },
    { currency: "USD" },
    { transferredAt: "2099-01-01T12:00:00Z" },
    { transferredAt: "2099-01-01T13:00:00+01:00" },
  ].entries()) {
    assertApiError(
      await json("/rent-records/proofs", {
        method: "POST",
        headers: {
          ...proofHeaders,
          "idempotency-key": `smoke-invalid-proof-${index}`,
        },
        body: JSON.stringify({ ...proofBody, ...invalid }),
      }),
      400,
    );
  }
  for (const [index, boundary] of [
    { amount: 0.01, currency: "eUr" },
    { amount: 1_000_000, currency: "aOa" },
  ].entries()) {
    const result = await json("/rent-records/proofs", {
      method: "POST",
      headers: {
        ...proofHeaders,
        "idempotency-key": `smoke-proof-boundary-${index}`,
      },
      body: JSON.stringify({ ...proofBody, ...boundary }),
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.amount, boundary.amount);
    assert.equal(result.payload.currency, boundary.currency.toUpperCase());
  }
  let documentFetches = 0;
  const documentProbe = createServer((_request, response) => {
    documentFetches++;
    response.end("This must never be fetched by a metadata-only route.");
  });
  await new Promise<void>((resolve) =>
    documentProbe.listen(0, "127.0.0.1", resolve),
  );
  try {
    const address = documentProbe.address();
    assert.ok(address && typeof address !== "string");
    const documentReference = `http://127.0.0.1:${address.port}/not-a-document`;
    const unlinkedProof = await json("/rent-records/proofs", {
      method: "POST",
      headers: {
        ...proofHeaders,
        "idempotency-key": "smoke-unlinked-proof-0001",
      },
      body: JSON.stringify({
        ...proofBody,
        rentRecordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        documentReference: `  ${documentReference}  `,
      }),
    });
    assert.equal(unlinkedProof.response.status, 201);
    assert.equal(
      unlinkedProof.payload.rentRecordId,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    assert.equal(unlinkedProof.payload.documentReference, documentReference);
    assert.equal(unlinkedProof.payload.status, "recorded_metadata");
    assert.deepEqual(unlinkedProof.payload.linkage, {
      rentRecord: "unverified",
      document: "unverified",
    });
    assert.equal(
      documentFetches,
      0,
      "Document references must not trigger any URL fetch",
    );
  } finally {
    await new Promise<void>((resolve) => documentProbe.close(() => resolve()));
  }
  passed(
    "rent proof HTTP validation preserves boundary amounts and declares references unverified metadata",
  );

  let limited = false;
  for (let request = 0; request <= 300; request++) {
    const result = await json("/properties?limit=1", {
      headers: { "x-request-id": "smoke-rate-limit" },
    });
    if (result.response.status === 429) {
      assertApiError(result, 429, "smoke-rate-limit");
      assert.ok(result.response.headers.get("retry-after"));
      limited = true;
      break;
    }
    assert.equal(result.response.status, 200);
  }
  assert.ok(limited, "The API must enforce its request limit");
  assert.equal((await json("/health")).response.status, 200);
  assert.equal((await json("/ready")).response.status, 200);
  passed(
    "rate limiting returns JSON 429 with a trace ID while probes remain available",
  );

  console.log(`\n${checks.length} API checks passed.`);
} finally {
  child.kill("SIGTERM");
}
