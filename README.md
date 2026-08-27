# Kasa

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

- Property discovery with Rent/Buy intent, detailed filters, a live interactive map, price pins and draw-your-search-area filtering, saved homes/searches, detailed galleries, viewing requests, private Kasa Chat, and reusable tenant applications; public profiles never expose email or phone details
- One unified **Advertise property or space** entry branches into long-term rental, property sale, or hourly/session/day sports and event-space publishing; the selected use then opens the correct operational workflow
- Buy listings include an interactive mortgage estimate with editable down payment, term, interest and purchase-cost assumptions, total-cost breakdown and rate-sensitivity scenarios. It is an illustrative planning calculator only: Kasa does not provide, arrange or approve credit, match users to banks, request financial documents, transmit calculator data to lenders or earn lender-referral commissions in the approved MVP.
- Mobile-first welcome, account creation, phone verification, and landlord/tenant journey selection adapted from the supplied Kasa mock boards
- Tenant operations with a home dashboard, documents, maintenance, direct landlord bank instructions, proof submission, and confirmed rent history
- Landlord operations with portfolio analytics, applications, property records, rent reconciliation, and a maintenance board
- Three-step owner-controlled property creation flow with photos, listing details, review, and moderation submission
- Kasa Services with five launch categories, verified provider profiles, fixed-price/quote positioning, booking requests, tracking, and service records
- Kasa Spaces Phase 2, deliberately limited to sports courts/pitches and event venues, with location-first discovery, operator-suggested or customer-requested times, instant/request reservation modes, external-payment handoff, confirmations, QR booking records, reviews and related-service suggestions
- Direct-to-venue Spaces payments: each operator receives customer funds through its own regulated provider; Kasa never receives the gross amount, and any approved commission is invoiced to the operator separately after settlement
- Venue-operator workspace with a simple multi-space calendar, flexible availability, custom-time requests, explicit customer acceptance of operator-proposed changes, messages, reviews, onboarding and optional later-stage business tools
- One Kasa identity for users or companies that operate both property and Spaces businesses, with separate dashboards, permissions, records and public profiles for each role
- Provider workspace with availability, job inbox, quote actions, earnings, ratings, and team view
- Admin workspace with listing/provider moderation, fraud signals, verification coverage, country configuration, and feature flags
- Market-readiness guardrails for privacy, payments, property-mediation boundaries and Angola-specific pre-launch checks without presenting Angola as the selected launch market
- Responsive desktop and mobile navigation built from the same design system
- Interactive iOS and Android device lab that runs the real current Kasa screen at distinct reference sizes—iPhone 15 (393 × 852) and Pixel 8 (412 × 915)—including safe areas, maps and zone drawing

All payment copy and flows preserve the hard rule: rent moves directly from tenant to landlord. Kasa only records proof, reconciles, and stores confirmation status.

## Market research

The current Angola-first and Africa-wide competitor scan is documented in [COMPETITOR_RESEARCH.md](./COMPETITOR_RESEARCH.md).
