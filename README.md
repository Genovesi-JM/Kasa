# Kasa

## Interactive software prototype

**[Open Kasa](https://genovesi-jm.github.io/Kasa/)**

Hosted independently on GitHub Pages and accessible to anyone with the link. No account or sign-in is required. The root URL opens the software, with responsive navigation across the customer, property-owner, service-provider, venue-operator and platform workspaces.

The optional [guided tour](https://genovesi-jm.github.io/Kasa/?present=1) is available through `?present=1`; its [presentation guide](./docs/PRESENTATION_GUIDE.md) describes scene navigation and resets. `?app=1` also opens the software directly.

The prototype uses synthetic records. Messages, drafts, saved searches, viewing requests, application updates, rent records, maintenance requests, selected documents, notification read state, booking changes and discovery filters stay in the current open tab while navigating. Inboxes, documents and saved collections are separate for each workspace. Reloading the app or resetting a tour scene restores sample state; these changes are not shared between tabs or saved to a production database. Messages and requests are not delivered to other people, and sample status changes do not perform real approvals, reservations or payments.

Kasa is a non-brokerage property-operations platform for landlords and tenants. It helps people discover homes, manage applications and documents, communicate, reconcile direct rent payments, coordinate maintenance, and find service providers.

Kasa does **not** negotiate leases, represent either party, earn transaction commissions, hold deposits or rent, or operate properties under a management mandate.

The definitive product guardrails and the list of still-open decisions are recorded in [BUSINESS_RULES.md](./BUSINESS_RULES.md). The locked colours, component language and role-specific visual character are recorded in [VISUAL_SYSTEM.md](./VISUAL_SYSTEM.md). New screens and copy should be checked against both files before they are added.

## Run locally

```bash
npm install
cp .env.example .env.local
cp .env.api.example .env.api
npm run dev:all
```

The web app runs at `http://127.0.0.1:5173` and the versioned API at `http://127.0.0.1:8787/api/v1`. Public catalogue reads work immediately. Demo writes are deliberately disabled until `KASA_API_DEMO_WRITES=true` and a private `KASA_API_DEMO_KEY` of at least 16 characters are set in `.env.api`; never commit that file or use the demo key as production authentication.

API contract: [docs/openapi.yaml](./docs/openapi.yaml). Start only the API with `npm run dev:api`; verify it with `curl http://127.0.0.1:8787/api/v1/health`.

Run `npm run test:ui-state` for routing, search, messages, applications, notifications, bookings and discovery-state checks. Run the complete repeatable quality gate with `npm run check` for formatting, lint, client/server types, the production build and API guardrails. The operational/demo/pending matrix is documented in [docs/FUNCTION_STATUS.md](./docs/FUNCTION_STATUS.md); **Admin → System status** shows runtime checks and integration status.

For the bounded Azure pilot, [the container guide](./docs/AZURE_PILOT_CONTAINER.md)
packages the web app and API together. Public deployments remain read-only,
use synthetic catalogue data and explicitly do not claim production readiness.

## MVP architecture

- React + TypeScript + Vite
- Front-end demo session with shared-identity Property Owner / Space Operator workspace switching, plus separate tenant, service-provider and admin demo identities
- Typed mock domain data isolated in `src/data.ts`
- No payment custody: rent records are reconciled against proof of direct bank transfers
- Responsive app shell designed for desktop and mobile
- Portuguese-first internationalisation with English, Spanish, French, Arabic RTL and Simplified Chinese support; Arabic and Chinese include English clarification where needed
- Vendor-neutral runtime configuration and API client ready to connect to an approved backend without placing secrets in the browser

The current demo intentionally uses local data so the core product model and UX can be validated before selecting authentication, persistence, messaging, file-storage, verification, payment, and subscription providers. Names, prices, dates, statistics and the Barcelona setting are illustrative seed data, not agreed launch or commercial decisions.

Production data boundaries, the proposed PostgreSQL schema and the safe path from demo data to approved services are documented in [docs/API_AND_DATA.md](./docs/API_AND_DATA.md). Copy `.env.example` to `.env.local` only when an approved API exists; never place private keys in a `VITE_` variable.

The market-entry gates, trustworthy-interface requirements and EU/Spain and Angola pre-launch checks are documented in [docs/REGULATORY_UI_READINESS.md](./docs/REGULATORY_UI_READINESS.md). They are engineering guardrails, not a claim of legal compliance; country counsel and the selected regulated providers must approve the final launch model.

## Implemented product surface

The interface includes the product areas below. Connected production authentication, data storage, delivery and payment services remain separate launch work. Current frontend workflows include:

- Shareable screen/property URLs and browser Back/Forward navigation; scoped search across homes, work, services and spaces.
- Property dashboards derived from current rent, application and repair records, with upcoming visits and activity history. Owner portfolios follow property ownership, retain filters and return to the originating screen after opening a property.
- Editable owner listing drafts for rent or sale, with validated details, local photos, cover selection, accurate previews, resume and removal/undo. Ready drafts remain private to the current tab; they are not submitted to moderation or added to the public catalogue. The unified entry also opens the Spaces workflow.
- Independent Rent/Buy filters, sort order and map areas retained while navigating; keyboard-accessible property galleries and listing-link sharing.
- Saved search snapshots with reopening, rename, delete and undo; favourite homes and searches isolated by workspace.
- Separate workspace inboxes, conversation search, unread state, drafts, local message composition and local block/unblock controls.
- Viewing requests with validated dates/times, retained notes, editing and cancellation; rental applications that retain form answers and appear in the application list without duplicate submissions.
- Application details, document summaries, owner-controlled local review/status actions and activity history, with tenant access limited to the tenant's sample records.
- One notification feed shared by the header and full page, with workspace-specific unread counts, individual/read-all actions and links to relevant screens.
- Booking filters and details, local acceptance of proposed times, keeping an original request and local cancellation with a reason.
- Maintenance reports with validated details, accessible board/list views, request history, owner scheduling and explicit start/resolve/reopen actions. Tenant and owner access follows the sample tenancy and property ownership.
- Rent transfer records with amount/date/reference validation, tenant corrections, explicit owner review, history, copyable summaries and CSV export, with controls and feedback in all six languages. No bank account or payment execution is provided.
- Workspace document libraries with labelled examples, local PDF/image/text selection and preview, download, filtering, removal and undo, with controls and feedback in all six interface languages. Files stay in memory and are never uploaded or marked verified.
- Functional Settings and Help panels, persistent language/reduced-motion preferences, and deferred loading of operational screens.

The broader UI and product scope includes:

- Property discovery with Rent/Buy intent, detailed filters, a live interactive map, price pins and draw-your-search-area filtering, saved homes/searches, detailed galleries, viewing requests, private Kasa Chat, and reusable tenant applications; public profiles never expose email or phone details
- One unified **Advertise property or space** entry branches into long-term rental, property sale, or hourly/session/day sports and event-space publishing; the selected use then opens the correct operational workflow
- Buy listings include an interactive mortgage estimate with editable down payment, term, interest and purchase-cost assumptions, total-cost breakdown and rate-sensitivity scenarios. It is an illustrative planning calculator only: Kasa does not provide, arrange or approve credit, match users to banks, request financial documents, transmit calculator data to lenders or earn lender-referral commissions in the approved MVP.
- Mobile-first welcome, account creation, phone verification, and landlord/tenant journey selection adapted from the supplied Kasa mock boards
- Universal customer Home with one welcoming intent chooser, global scoped search across Properties, Work, Services and Spaces, and a simple mobile dock whose fifth destination follows the active area
- Tenant operations with a home dashboard, documents, maintenance, direct landlord bank instructions, proof submission, and confirmed rent history
- Landlord operations with portfolio analytics, applications, property records, rent reconciliation, and a maintenance board
- Owner-controlled property draft flow with photos, listing details and review; production moderation and catalogue publication remain unconnected
- Kasa Services with five launch categories, verified provider profiles, fixed-price/quote positioning, booking requests, tracking, and service records
- Kasa Work with direct job and freelance-opportunity discovery, private applications, business hiring posts and the four entry actions Get a job, Hire staff, Find a Pro and Offer services; Kasa is a neutral job-board technology provider, not the employer or recruitment representative
- Kasa Spaces Phase 2, deliberately limited to sports courts/pitches and event venues, with location-first discovery, operator-suggested or customer-requested times, instant/request reservation modes, external-payment handoff, confirmations, QR booking records, reviews and related-service suggestions
- Direct-to-venue Spaces payments: each operator receives customer funds through its own regulated provider; Kasa never receives the gross amount, and any approved commission is invoiced to the operator separately after settlement
- Venue-operator workspace with a simple multi-space calendar, flexible availability, custom-time requests, explicit customer acceptance of operator-proposed changes, messages, reviews, onboarding and optional later-stage business tools
- One Kasa identity for users or companies that operate both property and Spaces businesses, with separate dashboards, permissions, records and public profiles for each role
- Provider workspace with availability, job inbox, quote actions, earnings, ratings, and team view
- Admin workspace with listing/provider moderation, fraud signals, verification coverage, country configuration, and feature flags
- Market-readiness guardrails for privacy, payments, property-mediation boundaries and Angola-specific pre-launch checks without presenting Angola as the selected launch market
- Responsive desktop navigation plus a stable mobile foundation of Search, Kasa Chat, Notifications and Profile with one named contextual destination
- Interactive iOS and Android device lab that runs the real current Kasa screen at distinct reference sizes—iPhone 15 (393 × 852) and Pixel 8 (412 × 915)—including safe areas, maps and zone drawing

All payment copy and flows preserve the hard rule: rent moves directly from tenant to landlord. The current interface demonstrates proof records, reconciliation and confirmation status using sample data; it does not move money.

## Market research

The current Angola-first and Africa-wide competitor scan is documented in [COMPETITOR_RESEARCH.md](./COMPETITOR_RESEARCH.md).
