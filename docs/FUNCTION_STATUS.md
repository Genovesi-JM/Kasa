# Kasa function status

This matrix distinguishes working frontend behaviour from production integrations. **Admin → System status** shows runtime checks and integration status.

Frontend workflow update: 2 October 2026. Production-integration requirements remain unchanged.

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

Screen/property links preserve the GitHub Pages path and support browser Back/Forward navigation. Scoped search filters the sample home, service, work and Spaces catalogues. Rent and Buy retain separate discovery filters, map areas and sort choices while navigating.

## Working as an interactive demo

The following frontend workflows update shared state in the current open tab:

- Messages: conversation search, unread state, separate drafts, local composition and block/unblock controls. Composed messages are not delivered.
- Applications: record details, sample document summaries, owner-controlled local review/status changes and activity history. Tenants see only their sample records; no real approval or document request is issued.
- Notifications: header and full-page feed share per-workspace unread counts. Individual/read-all actions update both surfaces; opening an update marks it read and opens the relevant screen.
- Bookings: status filters, details, local acceptance of proposed times, keeping the original request and local cancellation reasons. No venue is contacted, reservation made or refund processed.
- Property details: accessible gallery navigation and shareable listing links.

These changes survive navigation within that app instance. Reloading or closing the tab, or resetting a presentation scene, restores sample data; separate tabs do not share the changes. No production database or authenticated account owns these records.

Other product areas remain illustrative UI flows, including:

- Direct tenant-to-landlord rent instructions, proof upload and reconciliation records.
- Maintenance, provider jobs and operator calendars.
- Kasa Work job and freelance discovery, private applications, hiring posts and candidate conversations.
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

Run the frontend state checks directly:

```bash
npm run test:ui-state
```

They cover URL routing and validation, scoped search, message state, application transitions, notification counts and workspace isolation, booking changes, and independent Rent/Buy discovery filters. These checks validate local behaviour, not production delivery or payment integrations.

The product boundaries remain locked: Kasa is non-brokerage, does not represent or negotiate for property parties, does not hold rent or deposits, does not enable overnight accommodation in Kasa Spaces, and does not provide mortgage advice or intermediation.
