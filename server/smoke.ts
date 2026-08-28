import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const demoKey = "kasa-smoke-key-123456789";
const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
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
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
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
  assert.equal(invalidPropertySearch.response.status, 400);
  const missingProperty = await json("/properties/999999");
  assert.equal(missingProperty.response.status, 404);
  passed("property validation and not-found responses");

  const spaceSearch = await json(
    "/spaces?category=sports&availableToday=true&maxPrice=30",
  );
  assert.equal(spaceSearch.response.status, 200);
  assert.ok(Number(spaceSearch.payload.total) >= 1);
  const invalidSpaceSearch = await json("/spaces?category=overnight");
  assert.equal(invalidSpaceSearch.response.status, 400);
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
  assert.equal(unauthorisedWrite.response.status, 401);
  passed("write routes reject missing demo authentication");

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

  const rentProof = await json("/rent-records/proofs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kasa-demo-key": demoKey,
      "idempotency-key": "smoke-rent-proof-0001",
    },
    body: JSON.stringify({
      rentRecordId: "11111111-1111-4111-8111-111111111111",
      amount: 1850,
      currency: "eur",
      transferReference: "KASA-TEST-SEP",
      documentReference: "private-upload/document-1",
      transferredAt: "2026-08-27T12:00:00Z",
    }),
  });
  assert.equal(rentProof.response.status, 201);
  assert.equal(rentProof.payload.moneyFlow, "tenant_to_landlord");
  assert.equal(rentProof.payload.kasaCustody, false);
  passed("rent proof records never imply Kasa custody");

  console.log(`\n${checks.length} API checks passed.`);
} finally {
  child.kill("SIGTERM");
}
