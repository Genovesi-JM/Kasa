# Kasa production data and API foundation

The simulator intentionally starts with local seed data. This document defines the safe production boundary without selecting a vendor that the business has not approved.

## Architecture

The browser talks only to a Kasa API over HTTPS. It never receives database credentials, payment-provider private keys, storage signing secrets or verification-provider secrets. The API authenticates the user, resolves the active workspace and applies authorisation to every record before returning data.

The proposed deployment has six replaceable boundaries:

1. **Identity** — one Kasa identity can belong to separate tenant, landlord, provider and Spaces-operator workspaces.
2. **PostgreSQL-compatible data store** — relational records, workspace permissions, feature flags and audit history.
3. **Object storage** — private documents and chat attachments accessed through short-lived signed links after an authorisation check.
4. **Realtime/notifications** — chat, booking changes, maintenance and rent-record status updates. Delivery adapters may include in-app, email, SMS or push according to country consent.
5. **External regulated payments** — venue/service merchants receive customer money into their own provider account. Kasa stores only the provider name, external reference, amount, currency and status required to reconcile the booking. Rent remains tenant-to-landlord outside Kasa.
6. **Maps and geocoding** — the browser receives public map tiles and approved display coordinates only. Address geocoding, abuse controls and any provider-private credentials belong behind the Kasa API.

The browser foundation is in `src/platform/config.ts` and `src/platform/api.ts`. Runtime responses are validated before entering the interface. `.env.example` contains only public configuration; every variable prefixed with `VITE_` is visible to the browser and must never contain a private key.

## Maps and drawn-area search

The demo uses Leaflet with OpenStreetMap tiles, visible attribution, price pins and a customer-drawn polygon. The polygon is applied to both property and Spaces results. In production, send the polygon to the search API and perform the authoritative point-in-polygon query server-side; browser filtering is only a demo and usability layer.

The public OpenStreetMap tile endpoint has no application SLA and must not be assumed to support production traffic. Before launch, select an approved tile/geocoding provider, retain its required attribution, configure `VITE_KASA_MAP_TILE_URL`, and apply the provider's caching, rate and usage rules. Any credential placed in a `VITE_` value is public; secret geocoding or account keys must remain on the API.

## Required API behavior

- Use secure, HTTP-only, SameSite cookies or an equivalently reviewed session mechanism.
- Authorise every object by account, workspace, role and relationship; knowing a record UUID is never enough.
- Require idempotency keys for reservation acceptance, service-job confirmation and any external-payment creation request.
- Use optimistic concurrency/version fields for availability and booking changes to prevent two customers taking the same slot.
- Keep request, operator-proposed modification and customer acceptance as separate timestamped events.
- Scan uploads, validate MIME type and size, strip unsafe metadata where appropriate and keep private files private by default.
- Rate-limit authentication, chat, search, verification and booking endpoints; retain auditable abuse and moderation events.
- Return a request ID with every error and avoid leaking internal stack traces or provider secrets.
- Keep country feature flags server-enforced. A hidden button is not a compliance control.

## Payment boundaries

There are no Kasa wallet, pooled-funds or venue-payout tables in the proposed schema. A Spaces or Services reservation can carry an external merchant reference, but the venue/provider remains the payee. Any approved Kasa commission is invoiced to the operator separately after a completed reservation; it is not silently deducted from customer money by the Kasa application.

Do not activate a payment integration until the chosen provider confirms merchant onboarding, refunds, disputes, settlement, marketplace/platform-fee handling, local currency and Angolan regulatory availability in writing. Rent processing must remain a separate, disabled capability.

## Migration sequence

1. Approve launch country, hosting region and identity/database/storage vendors.
2. Apply `database/schema.sql` in an isolated non-production environment and replace the example row-security context with the approved identity claims.
3. Implement read-only discovery endpoints first, then authenticated workspace reads.
4. Add write workflows with audit events and idempotency tests.
5. Add private chat and document storage with access-control and retention tests.
6. Integrate one regulated payment provider in sandbox mode for Services/Spaces only.
7. Complete security, privacy, backup/restore, moderation and accessibility reviews before public production data is accepted.

The schema is a reviewed starting model, not a production migration. Legal retention periods, identity claims, encryption/key management and country-specific payment fields must be finalised before launch.
