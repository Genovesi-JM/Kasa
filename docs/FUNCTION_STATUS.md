# Kasa function status

This matrix distinguishes working frontend behaviour from production integrations. **Admin → System status** shows runtime checks and integration status.

Frontend workflow update: 3 October 2026. Production-integration requirements remain unchanged.

The public [GitHub Pages URL](https://genovesi-jm.github.io/Kasa/) opens the software directly, without an account. The guided presentation is optional at [`?present=1`](https://genovesi-jm.github.io/Kasa/?present=1). GitHub Pages serves the frontend; it does not host the local API or provide authentication, message delivery or a database.

## Operational in the current local environment

| Function                                     | Verification                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Responsive web app and iOS/Android simulator | Production build plus route/role browser audit                                            |
| Property discovery                           | API catalogue reads, Rent/Buy search, filters, map pins and drawn-area filtering          |
| Kasa Spaces discovery                        | Sports and event-space catalogue reads, filters and venue views                           |
| Versioned API                                | Health, configuration, catalogue and OpenAPI endpoints                                    |
| Country feature flags                        | Automated guardrail checks for rent custody, overnight Spaces and mortgage intermediation |
| Mortgage calculator                          | Educational calculations in the browser; no lender matching or data transmission          |
| Portuguese-first localisation                | Portuguese, English, Spanish, French, Arabic RTL and Simplified Chinese                   |
| Safe fallback catalogue                      | The UI falls back to typed demo data if the local API is unavailable                      |

Screen/property links preserve the GitHub Pages path and support browser Back/Forward navigation. Scoped search filters the home, service and Spaces catalogues and the current open Work opportunities, including posts published locally in this tab. Each workspace retains separate Rent and Buy queries, discovery filters, map areas and sort choices while navigating. Browser history restores the query and matching filters together; malformed or unknown property links return to discovery. Spaces discovery retains its own filters, category, query, sort and drawn map area per workspace. Catalogue venue/unit links preserve the Pages path and support direct entry, sharing and browser Back/Forward; invalid venues return to discovery. New global searches clear conflicting filters, and category changes remove options that no longer apply.

## Working as an interactive demo

The following frontend workflows update shared state in the current open tab:

- Messages: separate inboxes for all five workspaces, matching contacts, conversation search, unread state, drafts, local composition and block/unblock controls. Composed messages are not delivered.
- Property dashboards: current-month rent totals, outstanding owner reviews, pending applications, open repairs, future visits and recent activity derive from visible records. Portfolio search and sorting persist across navigation; property details return to the originating portfolio or overview. Owners see only their own properties and cannot create a conversation with themselves.
- Owner analytics: recorded-period comparisons, confirmed/unconfirmed rent amounts, property breakdowns and outstanding evidence responses derive from scoped records. No occupancy, market valuation or bank-verified income is inferred. Month selection and role-specific rent filters persist across navigation; analytics opens the selected rent period and property details return to analytics.
- Property drafts: owners can enter rent/sale details, retain edits across steps and navigation, select local photos and a cover, review the actual values, mark a valid draft ready, resume it, or remove/restore it. Drafts are separate from the public catalogue and are never reported as published or submitted to moderation. The property portfolio keeps record counts, rent status and repair actions available on phones.
- Saved searches and homes: separate collections per workspace, exact search/filter snapshots, reopening, rename, delete and undo. Saved-home listing type and sort choices survive detail and sidebar navigation. Saved searches do not generate notifications.
- Applications: validated rental submissions retain move-in date, household size and introduction and prevent duplicate tenant/property records. Owners can request follow-up documents; tenant drafts privately retain actual local files and notes until explicit submission. Partial and note-only replies, safe previews, separate owner acknowledgment/closure, request revisions and response history preserve the application decision, including approved records. Scope follows applicant identity and property ownership. Files remain unverified and in memory; no real approval, external document request or upload is issued.
- Work: opportunity and business IDs connect discovery, private tenant application drafts and the provider’s hiring workspace. Post drafts retain all inputs, validate required fields and require review before explicit publication into the current tab’s catalogue. Submitted applications preserve the candidate’s introduction, actual availability date and the opportunity details at submission; duplicate submissions are blocked and withdrawal retains history. Volt & Co. sees only its own posts and their submitted applications, can record a review and close posts to new applications. Local posts appear in universal search; closed posts leave the open catalogue while existing records remain accessible. Filters and selections survive navigation. No CV upload, private candidate chat, external application delivery, moderation submission or employment decision is claimed.
- Notifications: header and full-page feed share per-workspace unread counts. Individual/read-all actions update both surfaces; opening an update marks it read and opens the relevant screen.
- Venue drafts: the operator workspace retains Sports/Event details, the declared relationship to the venue, stable individual spaces with capacities, optional prices and suggested hours, amenities, policies and local photos. Validated review produces a separate ready snapshot; editing returns the record to Draft. Selection, steps, filtering and removal/undo survive navigation. Direct setup links stay inside the operator workspace. These drafts do not enter the booking catalogue, and no verification, moderation or public publication is claimed.
- Spaces requests: customer forms retain the actual venue/unit, date, times, participant count and notes. The selected venue operator can review scoped requests and propose complete terms; customer acceptance is explicit. Original requests, proposal versions and decisions remain in history. Saved venues are isolated by workspace and can be filtered in discovery. No venue is contacted, real reservation guaranteed, payment collected or refund processed.
- Property details: accessible galleries, shareable links and direct access to the viewing inbox. Tenant viewing drafts retain dates, times and notes privately until saved. Owners see only requests for their properties and can accept, decline or propose a new time. Tenants explicitly accept or decline each proposal; original requests, proposal versions, agreed times and decisions remain in history. A pending reschedule preserves the existing appointment. Both home screens show future agreed visits and pending decisions; each workspace retains its inbox filter and selection. Cancellation permits a later request with a new record ID. Dates and times are validated, and all decisions remain local to the current tab; no external appointment or message is sent.
- Maintenance: validated issue reports, keyboard-accessible board/list/details, date/time/provider arrangements, explicit owner start/resolve/reopen actions and request history. Records and mutations are limited to the sample owner's properties and tenant's home. Sidebar counts reflect open records. Controls, validation, searchable categories and dates support all six languages. Saving an unchanged visit is a no-op; revised visits preserve work in progress.
- Services: property-scoped customer requests and retained drafts feed the selected sample provider inbox. Versioned exact-cent quotes require explicit customer acceptance before work can start, with refusal/cancellation reasons, completion notes and history. Customer roles and other providers remain isolated. Portuguese/English controls are available; no request, appointment or payment is delivered externally.
- Rent records: exact decimal amount/date/reference validation, tenant editing and correction handling, explicit owner confirmation, record history, clipboard fallback and scoped CSV export. Controls, validation, dates and export labels support all six languages. Ownership checks prevent reviewing unrelated properties. These actions record sample state and never execute or verify a bank transfer.
- Documents: workspace-isolated sample previews and local PDF, raster image and plain-text files, with type/size limits, filtering, download, removal and undo. Controls, errors, counts and dates support all six interface languages. Preview object URLs are released on close. Selected files remain in memory; no upload, signing or verification occurs.
- Settings and Help: real language/motion controls, device-local preference persistence with unavailable-storage fallback, workspace identity and links to software workflows. Settings/help content supports all six interface languages. Operational screens and their added translation dictionaries load when opened.

These changes survive navigation within that app instance. Reloading or closing the tab, or resetting a presentation scene, restores sample data; separate tabs do not share the changes. No production database or authenticated account owns these records.

Other product areas remain illustrative UI flows, including:

- External bank verification and persistent proof storage.
- Property/venue moderation, verification and public listing publication.
- Provider commercial analytics, team management and editable operator availability calendars.
- Connected Work publication, application delivery and private candidate conversations.
- Admin moderation, verification queues, feature switches and analytics.

## Production integrations still required

| Dependency      | Required before launch                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Database        | Managed PostgreSQL, migrations, backups, row-level authorisation and audit logs                                  |
| Authentication  | Approved identity provider, secure sessions, MFA options and role/organisation permissions                       |
| Private files   | Object storage, malware scanning, encryption, retention rules and signed access URLs                             |
| Messaging       | Persistent conversations, abuse controls, retention and real-time delivery                                       |
| Notifications   | Approved push, email and/or SMS providers with consent and preference management                                 |
| Verification    | Identity, company and document-verification providers selected per launch country                                |
| Spaces payments | Regulated provider with direct settlement to each venue operator; Kasa must not receive the gross booking amount |
| Maps            | Production geocoding and tile-provider contract, quotas and privacy configuration                                |
| Operations      | Error monitoring, structured logs, uptime monitoring, alerting and incident procedures                           |

## Repeatable engineering check

A single-image Azure pilot package now serves the existing web build and API
on one origin. Its production-mode startup refuses demo writes; `/api/v1/ready`
checks only the synthetic runtime and web build, explicitly returning
`productionReady: false`. This packaging does not change any production
integration status above. See [the container guide](./AZURE_PILOT_CONTAINER.md).

Run the complete local quality gate:

```bash
npm run check
```

It checks formatting, lint, client and server TypeScript, the production build, API security headers, request validation, not-found behaviour, property/Spaces filters, OpenAPI availability, write authentication, idempotent reservations, direct-to-venue settlement metadata and direct tenant-to-landlord rent records.

API regressions cover payload conflicts on reused request keys, normalized replays, traceable client errors, fractional-cent and future-transfer rejection, supported demo currencies, unverified metadata references, decimal-only positive catalogue IDs and normalized bounded country codes. The metadata adapter never fetches a supplied document reference or enters a real landlord-confirmation workflow.

Run the frontend state checks directly:

```bash
npm run test:ui-state
```

They cover URL routing and validation, scoped search, workspace-isolated messages, saved collections and documents, application submissions/transitions, viewing drafts, ownership, proposal decisions, agreed appointments and history, Work post review/publication, application snapshots, withdrawal and business scope, maintenance ownership, visit no-ops and status changes, service request/quote revisions and explicit decisions, rent validation/review and CSV escaping, live property summaries and date rollover, document translation coverage, notification counts, booking changes, operator venue draft validation/readiness, unit and photo integrity, venue/unit URLs, retained workspace-scoped Spaces filters and category normalization, workspace-isolated Rent/Buy discovery queries and filters, validated history snapshots, retained saved-home controls, and unavailable browser preference storage. These checks validate local behaviour, not production delivery or payment integrations.

The Pages staging check preserves prior content-hashed screens, rejects changed bytes under an existing asset name and validates the destination checkout and entry references before replacing the public index.

The product boundaries remain locked: Kasa is non-brokerage, does not represent or negotiate for property parties, does not hold rent or deposits, does not enable overnight accommodation in Kasa Spaces, and does not provide mortgage advice or intermediation.
