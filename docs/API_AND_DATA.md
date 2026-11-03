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

## Persisted local accounts — development milestone

The **My Kasa** saved workspace is integrated into the main application shell while
remaining separate from the simulator's sample identities and data. It supports
registration, sign-in, session restoration, editing a display name and
preferred language, and server-side sign-out. This area also persists private
property workspaces, explicitly accepted tenant access, maintenance records,
private test documents, direct-transfer rent records and in-app activity notifications.
The simulator's rent, chat, public listings and bookings remain separate synthetic workflows.
Selecting `?role=admin` never grants account permissions. New accounts have no
workspace memberships or professional privileges.

### Saved navigation and preview boundaries

The canonical destinations are navigation choices, not authorization claims:

| Frontend query         | Saved destination                                     |
| ---------------------- | ----------------------------------------------------- |
| `?saved=profile`       | Account profile, language and session controls        |
| `?saved=properties`    | Membership-scoped private property workspaces         |
| `?saved=maintenance`   | Saved maintenance requests for an accessible property |
| `?saved=documents`     | Private documents and explicit sharing                |
| `?saved=rent`          | Direct-transfer rent records and owner reconciliation |
| `?saved=notifications` | Saved in-app notifications and unread state           |
| `?saved=listings`      | Owner listings and authenticated local test catalogue |
| `?saved=messages`      | Participant-only saved listing conversations          |

The legacy `?account=1` link opens this same shell and is canonicalized to
`?saved=profile`. Unsupported or duplicate `saved` values do not select a saved
section. An invalid explicit `saved` value does not fall back to the legacy account
flag. Changing `role`, `view` or `saved` never creates a session or grants a workspace
relationship; the API checks the authenticated account and current membership.

Entering a saved section preserves the previous exploration route, Rent/Buy intent,
base path and device context. Leaving it and using browser Back/Forward preserves
that separation rather than converting demo records into saved records. The account
workspace remains mounted during ordinary in-app exploration, retaining unsaved
drafts in the current tab. Drafts are not automatically persisted and should not be
expected to survive a reload, sign-out or account change. Switching the authenticated
identity clears the previous account's private client state; URL roles never select
another account's data.

Saved sections can also open in the iOS/Android simulator. Both frames use the same
browser session cookies, not separate tenant and owner logins; the interface states
this explicitly in all six languages. Test separate users with isolated browser
profiles or an explicit sign-out/sign-in, not by changing a simulator role.

The shell labels catalogue and sample workflows as **Interactive preview**. Their
example notifications, chats, listings, service/work actions and bookings remain
synthetic and separate from My Kasa. A unified interface does not connect those
workflows to persisted customer accounts or authorize a production launch. The
saved routes still require the deliberately local-only configuration below.

The adapter uses SQLite on the local machine without a cloud service. It is not the
production PostgreSQL migration or a public identity-provider decision. Use invented
test details only. Email ownership is **not verified**; recovery, MFA, email changes,
production invitation delivery, consent/deletion lifecycle and production security review
remain outstanding. No email/SMS/social-login provider is contacted; no payments or
market-launch capabilities are enabled.

Local setup:

1. Use Node 24 or newer; bind the API to `127.0.0.1` or `::1`.
2. Set server-only `KASA_API_LOCAL_ACCOUNTS=true`.
3. Set `KASA_API_ACCOUNT_DB` to an absolute `.sqlite` path in a dedicated private
   local directory **outside this repository**, for example
   `/absolute/private-local-directory/kasa/accounts.sqlite`. Do not use a cloud-synced
   or web-served directory. Keep the same path across restarts.
4. Set `KASA_API_ALLOWED_ORIGINS` to exact loopback origins with explicit ports,
   e.g. `http://127.0.0.1:5174`. Point `VITE_KASA_API_URL` at the API; use the same
   hostname for web and API so the strict session cookie stays same-site.
5. Start the API/web app and open `?saved=profile` or **My Kasa** in the main navigation.
   Existing `?account=1` links remain supported in the same application shell.

Accounts are disabled by default. Startup refuses production mode, public binds,
foreign origins and a database inside the web project. Database files must not be
committed or bundled. `/ready` reports `local_accounts_and_property_workspaces` and
`local_property_membership_and_maintenance` when enabled, while explicitly marking
other workflows synthetic and retaining `productionReady: false`.
The enabled response also reports `documents: local_private_files` and
`notifications: local_in_app`; neither indicates production file safety or external delivery.
`rentRecords: local_direct_transfer_records` identifies the persisted, manual rent-record
workflow. It does not indicate a payment connection or bank verification.

| Method/path under `/api/v1/account` | Behaviour                                                      |
| ----------------------------------- | -------------------------------------------------------------- |
| `GET /session`                      | Current account and CSRF token, or anonymous session           |
| `POST /register`                    | Validate details and create an isolated account                |
| `POST /login`                       | Check credentials and issue an opaque HTTP-only session cookie |
| `PATCH /profile`                    | Update own name/language with version conflict protection      |
| `POST /logout`                      | Revoke current session server-side and clear its cookie        |

Writes require an approved Origin and JSON; authenticated writes additionally need
`X-CSRF-Token`. Never put credentials or tokens in URLs or browser storage. Account
responses are non-cacheable; errors use nested `error.code`/`error.message` rather
than the catalogue's top-level message. The UI translates errors, retains failed
drafts and offers explicit refresh after version conflicts. API failure never
becomes a successful local save. `npm run test:accounts` verifies dummy-account
isolation, persistence/reopening, revocation, origin/CSRF protection and stale edits.

### Connected property workflow — local test accounts only

1. Create two invented accounts. The tenant shares their **account ID**, not an email
   address, from the account screen. Email ownership is not verified, so an email
   alone must not grant property access.
2. The owner creates a workspace and a private property (name and address). This is
   not a published listing, proof of ownership or a property-management mandate.
3. The owner creates an invitation addressed to that existing account ID and shares
   the one-time code manually. No email or notification is sent. The code expires in
   24 hours and is stored only as a hash; only its target account can accept it.
4. After acceptance, the tenant sees only their assigned properties. They can submit
   a maintenance request and add comments. The owner can comment, move the request
   between open/in progress/resolved, or reopen it. Changes have a version guard and
   append a dated history entry. Other tenants cannot read one another's requests.
5. Both parties can refresh to read the saved changes. This is not real-time chat.
   Reloading the browser or restarting the API preserves the records. Owners can
   edit property details, revoke pending invitations and remove tenant access.
   Removal preserves the owner's maintenance history but denies the former tenant
   further API access; it does not remotely erase information already viewed.

| Method/path under `/api/v1/account`                 | Behaviour                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /workspaces`                                   | Membership-scoped workspaces and private properties                  |
| `POST /workspaces`                                  | Create an owner workspace for the current account                    |
| `POST /workspaces/:workspaceId/properties`          | Owner creates a private property                                     |
| `PATCH /properties/:propertyId`                     | Owner edits name/address with version protection                     |
| `GET /properties/:propertyId/access`                | Owner reads tenant membership and invitation status; no emails/codes |
| `POST /properties/:propertyId/invitations`          | Owner creates a targeted, expiring invitation                        |
| `DELETE /invitations/:invitationId`                 | Owner revokes an invitation                                          |
| `POST /invitations/accept`                          | Intended tenant explicitly accepts the one-time code                 |
| `DELETE /properties/:propertyId/tenants/:accountId` | Owner removes access and pending invitations for that pair           |
| `GET /properties/:propertyId/maintenance`           | Owner reads property requests; tenant reads only their own           |
| `POST /properties/:propertyId/maintenance`          | Authorized member creates a request                                  |
| `PATCH /maintenance/:requestId`                     | Append a comment; owner may also change status, guarded by version   |

Every object is authorized server-side using the session account and persisted
relationship, never a URL role. There is no public account directory or automatic
invitation acceptance. The SQLite migration upgrades existing account databases
in place. Run `npm run test:workspaces` for membership, invitation, cross-account
isolation, stale updates, revocation and migration/restart regressions.

The browser sends `X-Kasa-Account-Id` on workspace requests as a stale-tab guard.
It never grants access: if supplied, it must match the authenticated session or the
server returns `401 ACCOUNT_CHANGED`. GET requests do not need a CSRF token; every
mutation does. Knowing a workspace/property/request UUID is not authorization.

This deliberately small workflow has no maintenance attachments, scheduling, provider
dispatch, email delivery, full tenancy contracts, property deletion or ownership verification.
Use invented data only; it does not clear any production or legal launch gate.

To keep synchronous local reads bounded, this test adapter explicitly limits each
account to 10 owned workspaces, each workspace to 20 properties, each property to
25 maintenance requests and each request to 50 history events (a status-plus-comment
update consumes two events). It also limits tenant membership to 100 properties per
account, 100 tenants per property and 500 invitation records per property. Reaching
a cap returns `409 LIMIT_REACHED`, not a silently shortened result or a retry-later
message. These are development safeguards, not commercial plan limits. Pagination,
separate history loading, archiving/retention and production-scale load tests remain
required before expanding this adapter.

### Private documents and notifications — local test accounts only

The property workspace now stores actual test-file bytes in the same guarded local
SQLite database, separate from the simulator's in-memory document library. Files
are **private to the uploader by default**, even when the uploader is a tenant.
An owner can explicitly share with one active tenant assigned to that property;
a tenant can explicitly share with the property's owner. Other tenants are excluded.
Only the uploader may rename, change sharing, archive or restore a document. These
metadata changes require the current version and never overwrite the file bytes.

The API checks current membership and document access on every list, download and
update. Downloads are authenticated, non-cacheable attachments, not public links
or inline previews. Removing tenant access revokes sharing for that owner–tenant
pair; accepting a new invitation does not silently restore old sharing. No revocation
can erase a copy already downloaded. Archiving is reversible, not permanent deletion,
and archived bytes still count toward storage limits. Archiving clears sharing;
restoring keeps the file private until a separate explicit sharing action.

Supported files are PDF, JPEG and PNG, at most **1 MiB each**. The server validates
base64, declared type, signature, size and filename independently of browser checks.
It authenticates the account and checks CSRF before parsing the larger upload body;
other account requests keep their 16 KiB limit. The adapter allows at most 25 files
per property and 128 MiB of file content across the local database, including archives.
Limits return an explicit `409 LIMIT_REACHED`; they are development safeguards, not
commercial plans. An interrupted upload has an unknown outcome: refresh the list
before retrying rather than assuming it failed or creating automatic duplicates.

**Use invented, harmless test files only.** Signature checks are not malware scanning,
document verification, full format validation or encryption at rest. Database bytes
are protected by local file permissions, not application-level encryption. Scanning,
production storage/encryption, backups, consent, retention/deletion and a security
review are still required before accepting customer documents. These safeguards follow
the layered approach described in the [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
not a claim of full compliance or certification. No cloud file service
or territory decision has been made by this implementation.

| Method/path under `/api/v1/account`      | Behaviour                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /properties/:propertyId/documents`  | List own files and files currently shared with this account; no bytes         |
| `POST /properties/:propertyId/documents` | Upload validated test bytes with explicit sharing                             |
| `PATCH /documents/:documentId`           | Uploader changes metadata, sharing or archive state with a version guard      |
| `GET /documents/:documentId/content`     | Download after a fresh access check, forced as an attachment                  |
| `GET /notifications?before=<cursor>`     | Up to 50 accessible events plus next cursor and total accessible unread count |
| `PATCH /notifications/:notificationId`   | Mark one own, accessible notification read                                    |
| `POST /notifications/read-all`           | Mark all own, accessible notifications read, including older pages            |

Maintenance creation/updates notify the other participating account, not unrelated
tenants and not the actor. Explicit document sharing notifies its recipient. Events
are saved in the same transaction as the underlying change. Notification payloads
contain only an event kind, resource/property IDs, actor display name and timestamps;
they do not repeat filenames, document bytes, request descriptions, comments or emails.
Listing and marking notifications rechecks current resource access. Inaccessible
events are hidden and excluded from the unread count, without deleting the source
history. Pagination uses a server-supplied cursor with stable timestamp/ID ordering.

Read state survives reload and restart. The inbox refreshes in the app; there is no
email, SMS, mobile push or background delivery. Opening an event navigates to the
specific accessible record rather than a generic static screen. Draft changes need
an explicit decision before navigating away. Run `npm run test:private-files` for the
file-access and notification regressions, and `npm run test:accounts-integration`
for the compiled API upload/download and restart test.

### Saved rent records — local test accounts only

Inside **My Kasa → My properties / Rent records**, a property owner records an expected
monthly rent amount for one active assigned tenant. This is bookkeeping for an
invented test property, not an executed lease, invoice, payment instruction or
verified debt. This slice uses AOA, with positive integer minor units on the API;
the browser accepts ordinary decimal amounts without floating-point rounding.

The tenant reports one direct-to-owner transfer: amount, calendar date, reference
and optional note. The current report can be corrected while unconfirmed, with
every prior revision preserved. This is **one current transfer report per rent
record**, not a multiple-instalment ledger or an automatically calculated bank balance.
The owner explicitly requests a correction with a reason or confirms an exact
match to the expected amount. The API never treats a tenant report, attached file
or successful request as bank verification. No funds enter Kasa.

Expected amount and due date can be edited only before any transfer is reported.
Period, tenant and currency cannot be silently reassigned. An unconfirmed mistaken
record can be voided with a reason and replaced; confirmed records are immutable.
There is at most one non-voided record per property, tenant and month. The due date
must belong to that month. Dates are limited to 1900–2199; transfer dates must be real calendar dates no later than
the current date in Africa/Luanda. None of these checks verifies bank activity.

An optional `evidenceDocumentId` must refer to an active, same-property document
uploaded by that tenant and **already explicitly shared** with the owner. The rent
action does not share the file itself. References do not provide a public URL or
override the document's current access checks. Unsharing, archiving and membership
removal still revoke access to bytes, including when an older history entry mentions
the document. Evidence remains unverified and test-only.

All mutations require an authenticated account, approved Origin, JSON, CSRF token,
and a fresh `mutationId` UUID for that logical action. Updates also require the
record version. The server derives the actor and membership; role query strings
confer no authority. Exact retries with the same mutation ID and normalized payload
return the **current authorized record** with `replayed: true`, without adding history
or notifications. Reusing a mutation ID for different input returns
`409 IDEMPOTENCY_CONFLICT`. Authorization is checked before replay. Do not generate
a different mutation ID merely because a response was lost.

Removing a tenant permanently revokes that accepted membership's old rent access.
A later invitation establishes new membership and does not restore old records or
alerts. Owners retain audit history, may void unconfirmed old records, and cannot
confirm a transfer after its tenant access was removed. No removal erases copies
already viewed or downloaded.

| Method/path under `/api/v1/account`                        | Behaviour                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /properties/:propertyId/rent-records?before=<cursor>` | Authorized rent summaries, newest first, 20 per page; no full history |
| `POST /properties/:propertyId/rent-records`                | Owner creates expected monthly rent for an active tenant              |
| `GET /rent-records/:recordId`                              | Authorized current record and immutable history                       |
| `PATCH /rent-records/:recordId`                            | Owner corrects amount/due date before the first transfer report       |
| `POST /rent-records/:recordId/transfer`                    | Tenant records or revises their direct-transfer report                |
| `POST /rent-records/:recordId/review`                      | Owner requests correction or explicitly confirms a matching amount    |
| `POST /rent-records/:recordId/void`                        | Owner voids an unconfirmed record with a reason                       |

Saved rent notifications contain only event type, actor name, record/property IDs
and timestamps—not amounts, transfer references, notes or evidence contents. They
open the exact authorized record. Writes, history and notifications commit together.
Records, mutation receipts and read state survive API restart. Run
`npm run test:saved-rent` for privacy, state, retry, migration and persistence tests;
`npm run test:accounts-integration` also exercises the compiled API.

Lists use server cursors and 20 summaries per page. Each record permits at most
100 history events. Nonterminal edits stop at 99, reserving the last event for
confirmation or voiding so an unconfirmed record can still be closed. An action
that would exceed this local safeguard returns `409 LIMIT_REACHED` without a
partial update. These are development safety limits,
not subscription limits or permission for production-scale operation.

This remains local development with invented data only. Real bank connections,
payment processing, tax/fiscal documents, multi-currency production operation,
refunds, disputes and a public launch are not enabled.

### Saved test marketplace and private chat

Schema version 5 adds listing, conversation, participant, message and mutation-receipt
tables without replacing account/property/rent data. This shares the opt-in loopback-only
adapter, session cookie, origin/CSRF checks, stale-account guard and rate limits above.
No public market capability is activated. All details and messages must be invented.

Paths below are under `/api/v1/account/market` and require authentication. Writes need
the approved Origin and `X-CSRF-Token`; all requests send the current `X-Kasa-Account-Id`.

| Method/path                        | Behaviour                                                     |
| ---------------------------------- | ------------------------------------------------------------- |
| `GET /listings`                    | Visible local test catalogue, filtered and paginated          |
| `GET /my-listings`                 | Only the authenticated owner's drafts/visible/paused listings |
| `GET /listings/:id`                | Visible test listing, or any status for its owner             |
| `POST /listings`                   | Owner creates a draft linked to their private property        |
| `PATCH /listings/:id`              | Owner edits details/status with version and mutation ID       |
| `POST /listings/:id/enquiries`     | Enquiry plus conversation, recipient derived server-side      |
| `GET /conversations`               | Participant-only inbox and unread counts                      |
| `GET /conversations/:id/messages`  | Up to 50 ordered messages and an older-page cursor            |
| `POST /conversations/:id/messages` | Persist a participant's plain-text message                    |
| `POST /conversations/:id/read`     | Monotonically acknowledge a displayed message sequence        |
| `PATCH /conversations/:id/block`   | Change only the caller's block flag with version protection   |

Catalogue queries: `q`, `city`, `intent` (`Rent`/`Buy`), `type`, `pets`,
`minPriceMinor`, `maxPriceMinor`, `sort` (`recent`, `price_asc`, `price_desc`),
`offset` and `limit` (default 24, maximum 50). Owner/inbox lists accept only pagination.
Message paging uses the returned numeric `nextBefore`; display order is ascending.
`latestSequence` is not a read receipt: the client acknowledges only the highest
sequence it actually rendered. The cursor also marks all earlier history read, including
older unloaded pages, but never advances to an unseen newer sequence. There is no automatic polling,
WebSocket delivery, email, SMS or push connection.

Listing details are entered separately from the private property address; the response
includes the source property ID only for the owner. No participant email/phone is returned.
Only `visible` listings appear in the test catalogue. Pausing hides a listing from other
accounts and prevents new enquiries, but does not erase its participants' existing chat.
Owner self-enquiries are rejected. Both participants can inspect a blocked thread;
either party's block prevents all new sends until that party unblocks it.

Creates/edits/enquiries/messages/block changes carry `mutationId`. An uncertain request
must retry its captured payload and UUID, not generate a new action. Reusing an ID with
different data is rejected. Authorization is rechecked on replay. HTML in messages is
rendered as plain text, never executed. This is not encrypted production messaging or
an abuse-reporting/moderation service. Attachments are not supported.

### Saved viewing requests — local test accounts only

Schema version 6 adds private viewing records, immutable event history and persistent
mutation receipts without replacing existing accounts, listings, chats or property data.
Open **Private chats → select a conversation → Viewing requests**. The participants
are derived from the existing conversation; a URL or client role never grants access.

| Method/path under `/api/v1/account/market` | Behaviour                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /conversations/:id/viewings`          | Participant-only summaries, offset pagination (default 20, maximum 50) |
| `POST /conversations/:id/viewings`         | Interested participant requests a future viewing on a visible listing  |
| `GET /viewings/:id`                        | Current authorized record and complete event history                   |
| `POST /viewings/:id/actions`               | Versioned propose, confirm, accept, decline or cancel action           |

All writes use the existing session, approved Origin, CSRF and expected-account checks.
Creation takes `mutationId`, UTC `startsAt`, `durationMinutes` and optional `note`.
Actions take `mutationId`, `version`, `action` and optional `note`; only `propose`
accepts a replacement start and duration. UTC instants are normalized and must be whole
minutes. The interface explicitly uses **Africa/Luanda (UTC+1)**, independent of the
device timezone. Duration is 15–180 minutes in 15-minute steps; requested or agreed
starts must be in the future and no more than 180 days ahead when submitted.

The owner may confirm the requested time, propose an alternative or decline a pending
request. Only the interested participant accepts an alternative. Both may cancel an
active record, including an elapsed one. A confirmed visit is not silently rescheduled:
cancel it and create a new request. Passing the end time never certifies attendance or
completion. A new request is allowed after a confirmed visit ends; elapsed unconfirmed
requests remain pending until explicitly cancelled or declined.

There is one active request per conversation. Only confirmations reserve an interval in
this local system. Within one atomic transaction, the API refuses overlapping confirmed
visits for the same private property (including Rent and Buy listings) or the same
interested participant. Adjacent intervals are allowed. This is not a live availability
feed and cannot detect appointments arranged outside Kasa.

Pausing a listing prevents new requests, not responses to existing ones. Blocking by
either participant prevents new requests, proposals and confirmations, while history,
cancellation and decline remain accessible. Responses contain no private property
address, email, phone or account ID. Free-text notes are not automatically redacted;
use invented data only.

Exact retries return the current authorized record without duplicating events, even
after the appointment time passes. A changed payload with the same mutation ID or a
stale version fails explicitly. The local limits are 50 records per conversation and
50 events per record; the final event is reserved for a cancellation or decline.
No real visit is arranged, no tenancy is created, and no external notification or
calendar integration is connected by this development-only milestone.

## Usable local API

The repository now includes a versioned Express API in `server/` and an OpenAPI 3.1 contract in `docs/openapi.yaml`. Run `cp .env.example .env.local`, `cp .env.api.example .env.api`, then `npm run dev:all`. The frontend loads property and Spaces catalogues from the API when `VITE_KASA_API_URL` is set and falls back to local seed data if the API is unavailable.

Available endpoints:

- `GET /api/v1/health`
- `GET /api/v1/config?country=demo`
- `GET /api/v1/properties` and `GET /api/v1/properties/:id`
- `GET /api/v1/spaces` and `GET /api/v1/spaces/:id`
- `POST /api/v1/space-reservations` for a demo reservation record
- `POST /api/v1/rent-records/proofs` for proof metadata only
- `GET /api/v1/openapi.yaml`

Catalogue detail IDs must be positive decimal digits within the JavaScript safe-integer range; hexadecimal, exponent, signed, fractional and whitespace forms return 400. Leading zeroes are accepted; valid missing IDs return 404. The configuration country query is trimmed, lowercased and limited to 2–12 characters; duplicate or empty values return 400. Unknown country codes keep the conservative market-approval fallback. The server validates its default country at startup.

The two write routes are in-memory development adapters, disabled by default, protected by a local demo key and an `Idempotency-Key` header. They are not production storage or authentication. Replace them with reviewed identity, PostgreSQL transactions, object storage and audit logging before accepting real personal data, documents or reservations.

Each write validates and normalizes its payload before checking the idempotency cache. Repeating an identical valid request returns the original result with status 200; a different payload with the same operation/key returns 409. The cache lasts only for the current server process. Every response carries an `x-request-id`; JSON errors include that same identifier, including malformed JSON (400), rejected origins (403), oversized request bodies (413), and API rate limits (429). Unexpected errors return a sanitized 500.

The rent metadata adapter accepts positive amounts up to 1,000,000 with at most two decimal places, EUR or AOA, and transfer timestamps no later than server time. These are input checks, not bank verification. `rentRecordId` and `documentReference` are unlinked metadata, never fetched or treated as authorization. Responses use `status: recorded_metadata` and explicitly mark both references `unverified`; the adapter does not enter a real landlord-confirmation workflow. Production must bind each reference to a record the authenticated workspace may access.

## Prototype release policy

The country configuration response distinguishes `capabilityScope: synthetic_demo` from live availability. `launch.status` is `blocked`, `productionReady` is false, and all live-publication, paid-promotion, real-booking and payment capabilities are false. Five named readiness gates remain pending. The API and browser share a validated contract; missing release information or enabled custody, property success fees, party representation, mortgage intermediation or live payments are rejected by the browser's configuration check. These are product restrictions, not a legal-compliance determination. Current production write protection remains enforced by the server; adding a future live endpoint requires server-side authorisation and release enforcement, not merely hiding its button.

The admin checklist describes these unresolved requirements without editable approval switches. The simulator still permits synthetic local workflows. API availability and passing technical tests do not approve an operating market.

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
