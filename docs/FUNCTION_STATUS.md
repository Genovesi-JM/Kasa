# Kasa function status

This matrix prevents visual prototypes from being mistaken for production integrations. The live version is available inside the Admin workspace under **System status**.

Last engineering audit: 28 August 2026.

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

## Working as an interactive demo

These flows can be reviewed end to end in the UI, but their records are not yet persisted in production services:

- Property applications, landlord review and tenant status tracking.
- Direct tenant-to-landlord rent instructions, proof upload and reconciliation records.
- Private Kasa chat, maintenance, provider jobs, venue reservations and operator calendars.
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

Run the complete local quality gate:

```bash
npm run check
```

It checks formatting, lint, client and server TypeScript, the production build, API security headers, request validation, not-found behaviour, property/Spaces filters, OpenAPI availability, write authentication, idempotent reservations, direct-to-venue settlement metadata and direct tenant-to-landlord rent records.

The product boundaries remain locked: Kasa is non-brokerage, does not represent or negotiate for property parties, does not hold rent or deposits, does not enable overnight accommodation in Kasa Spaces, and does not provide mortgage advice or intermediation.
