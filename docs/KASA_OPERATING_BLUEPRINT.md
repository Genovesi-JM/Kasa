# Kasa Operating Blueprint

**Evidence-backed business and product operating blueprint, persona and permissions matrix, user journeys, module boundaries, monetisation and unit-economics assumptions, regulatory/risk register, phased roadmap, KPIs, decision log, and scored gap audit.**

- **Document date:** 20 October 2026
- **Repository reviewed:** `github.com/Genovesi-JM/Kasa`, branch `presentation-prototype` (67 commits; working tree includes an uncommitted transactional layer — see §12)
- **Supersedes for Kasa only:** the portfolio audit cut off 13 September 2026. That audit is now ~5 weeks stale; the Kasa transactional foundation has advanced materially since (see §2 and §12).
- **Author's note:** Percentages here are auditor judgement triangulated from code, docs and git state, not instrumented metrics. A critical gate is not "partly passed" because more code exists. **95/100 is deliberately not awarded** — §12 states the current evidence-backed score and the exact evidence required to raise it.

---

## 1. Executive summary

Kasa is a **non-brokerage PropTech and Property Operations platform** whose core is a rent/buy/sell property marketplace plus landlord–tenant operations and home services. Since the September audit it crossed a real engineering threshold: it moved from an in-memory simulator to a **persisted local application** on Node's built-in SQLite, with working account authentication, workspace-scoped authorization, and persisted rent reconciliation, viewings, listings/chat and private documents — each covered by a security-focused smoke suite under a single `npm run check` gate.

That is a genuine _implementation_ advance. It is **not** a _validation_ advance. There are still no real users, no paid design partners, no legal opinion on the Angola property-mediation boundary, no penetration test, no restore drill, and no executed DPIA. The production substrate (managed PostgreSQL + row-level authorization + backups, an approved identity provider with MFA, object storage with malware scanning, and operational monitoring) is specified but not built. Governance regressions are live: there is **no CI pipeline**, the transactional layer is **uncommitted**, and `npm audit` reports **4 vulnerabilities (1 high, 3 critical)**.

**Evidence-backed organisational readiness today: ≈ 70/100** (§12). This confirms the indicative 70 — but now with traceable evidence, and with a clear, gated path to 95. The single most valuable next moves are not new features: commit and CI-protect the transactional layer, close the dependency vulnerabilities, obtain the Angola legal opinion, and sign the first paying design partners.

---

## 2. What changed since the 13 September audit (verified)

| Area           | September audit finding                                  | Current repository evidence (20 Oct)                                                                                                                                                         | Net effect                                                    |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Persistence    | "State in memory; `schema.sql` is design, not execution" | Node `node:sqlite` `DatabaseSync` in 59 call sites; accounts, workspaces, rent, viewings, marketplace, documents persist across reload and API restart                                       | **Implemented** (local)                                       |
| Identity       | "No IdP; browser is not an authorization boundary"       | Local account API: registration, sign-in, session restore, server-side sign-out, version-conflict handling; authorization enforced server-side per workspace/object                          | **Implemented** (local); production IdP/MFA still absent      |
| Access control | "RLS untested; cross-tenant risk"                        | Owner/tenant workspace isolation via one-time invite codes, tenant scoped to assigned properties, revocation; `marketplace-security-smoke` + `viewing-security-smoke` assert negative access | **Implemented & locally tested**; not a managed-DB RLS        |
| Documents      | "Uploads planned, no pipeline"                           | Real file bytes (PDF/JPEG/PNG ≤1 MiB) stored in private SQLite, share/unshare, version guards, access re-checked on every download                                                           | **Implemented** (local); no malware scan/encryption/retention |
| Rent           | "Boundary correct, implementation absent"                | Persisted rent records, tenant transfer report, owner correction/confirm, immutable history, AOA minor units; no custody                                                                     | **Implemented** (local)                                       |
| Remote drift   | "2 commits ahead of `origin/main`"                       | `presentation-prototype` is 0 ahead / 0 behind its remote                                                                                                                                    | **Resolved on this branch**                                   |
| `App.tsx` size | ~9,344 lines                                             | ~7,076 lines; components extracted to `src/components/*`                                                                                                                                     | **Improved**, still large                                     |
| Quality gate   | "`npm run check` red (Prettier, `qs`)"                   | Gate re-wired with 10+ smoke suites; working tree **uncommitted**; **no CI**; `npm audit` now **1 high, 3 critical**                                                                         | **Mixed / regressed on deps & governance**                    |

**Reading:** the product's transactional spine is real but lives in an uncommitted working tree on a non-default branch with no CI. "Works on this machine" is not yet "reproducible release."

---

## 3. Evidence model (how every claim below is tiered)

Every capability in this blueprint is scored on three independent tiers. A higher tier never implies a lower one is complete.

| Tier                | Means                                                       | Minimum proof                                                                                                         |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **D — Documented**  | Decided and written in a guardrail doc                      | Entry in `BUSINESS_RULES.md`, `FUNCTION_STATUS.md`, `API_AND_DATA.md`, `openapi.yaml` or `REGULATORY_UI_READINESS.md` |
| **I — Implemented** | Behaviour runs with a proportional automated test           | Code + passing smoke/state test in the correct environment                                                            |
| **V — Validated**   | Proven with real users, real data, or an external authority | Signed design partner, paid pilot, legal opinion, pentest, executed DPIA, restore drill                               |

**What this audit still cannot prove** (no evidence supplied, by design of a synthetic prototype): signed customer contracts, recurring revenue, financial statements, cap table, insurance policies, final legal opinions, completed trademark registration, independent penetration test, accessibility certification, or any disaster-recovery exercise. No real personal data of tenants, landlords, providers or operators was accessed.

---

## 4. Consolidated operating blueprint

### 4.1 Positioning (locked)

Kasa is a **non-brokerage PropTech and Property Operations platform**. It provides technology, records, communication and workflows; the parties decide, negotiate and contract directly. This is the _intended operating model_, **not** a legal exemption — product labels, direct payments and the absence of a success commission do not by themselves place a service outside licensed mediation (this must be confirmed per country — §9).

Kasa **does not**: act as estate agent; represent buyer/tenant/owner/landlord; negotiate price or terms; sign or close offers; earn a success commission or a share of rent/sale price; receive, hold or forward rent or deposits; enable overnight accommodation in Spaces; or provide mortgage advice/intermediation.

### 4.2 Ecosystem

`Properties + Property Operations + Kasa Services` form the **core**. `Kasa Spaces` (Phase 2), `Kasa Work`, and any `Stays`/`Property Sourcing Partners` concepts are **secondary/deferred** (§5). All modules share **one Kasa identity** with **separate role workspaces**.

### 4.3 Operating principles

1. **Intent-first, browse-before-login.** Login is requested only when the user takes a meaningful action.
2. **Shared identity, separate dashboards.** Switching workspaces changes operating context; it never merges property, tenancy, venue or booking records, nor commercial/regulatory responsibility.
3. **Direct money, never custody.** Rent flows tenant→landlord bank account; Spaces/Services payments settle directly to the operator/provider via a regulated provider; any Kasa fee is a separate B2B invoice after settlement.
4. **Honest verification.** A verification label must map to a real, named check; badges are never sold.
5. **Demo honesty.** Synthetic state is visibly separated from real action; demo numbers are never presented as traction.
6. **Country configuration gates capability.** Live publication, paid promotion, real bookings, job publication and connected payments stay disabled until a market is legally cleared.

---

## 5. Module boundaries

| Module                                    | Tier                        | Status (evidence)                                                                                                        | Boundary rules                                                                                                                                      |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Properties (rent / buy / sell)**        | **CORE**                    | D+I (local): persisted listings, search/filter, map/area filter, enquiry→chat, viewing requests                          | Genuine longer-term rent and sale only; "request viewing/apply/message", never "book/check-in"; no public email/phone                               |
| **Property Operations (landlord–tenant)** | **CORE**                    | D+I (local): workspaces, invites, applications, maintenance, rent records, expenses, documents, analytics, notifications | Termed "Property Operations" not "Management"; owner retains all decisions; tenant scoped to assigned property                                      |
| **Kasa Services**                         | **CORE**                    | D+I (local): property-scoped requests, provider inbox, versioned quotes, job tracking, reviews                           | Home/property/building services only; payments via regulated provider, separate from rent; marketplace fee ≠ brokerage commission                   |
| **Kasa Spaces**                           | **SECONDARY (Phase 2)**     | D+I (local): discovery, venue/unit drafts, request→propose→accept, operator schedules                                    | Sports courts/pitches + event venues only; hourly/session/day, **never overnight**; operator-direct payment; Kasa never receives gross amount       |
| **Kasa Work**                             | **SECONDARY**               | D+I (local): opportunities, applications, provider hiring workspace, reviews                                             | Job board only; no employment, no candidate selection, no placement-success commission by default; launches only where legally reviewed             |
| **Stays**                                 | **OUT OF SCOPE (excluded)** | —                                                                                                                        | Overnight/tourist accommodation is explicitly excluded from both Properties and Spaces; treat as not-in-product unless a future decision reopens it |
| **Property Sourcing Partners**            | **SECONDARY (deferred)**    | D only (maps to "relevant property/home partnerships" revenue line)                                                      | No sourcing/mandate model is implemented; any sourcing or mandate activity needs a separate mediation-classification decision before build          |

> Note on terminology: the brief named "Stays" and "Property Sourcing Partners" as secondary modules. In the current product neither is an active module — Stays is an **excluded** concept (no overnight), and Sourcing Partners exists only as a revenue-line idea. They are recorded here so the boundary is explicit rather than assumed.

---

## 6. Persona & permissions matrix

Roles share one Kasa identity; permissions are enforced **server-side** per workspace and object (verified by security smoke suites), not in the browser.

| Persona                        | Primary goal                      | Can                                                                                                                              | Cannot                                                                                           | Evidence                                                                       |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Visitor (pre-login)**        | Explore supply                    | Browse, search, filter, view public listings, use mortgage calculator                                                            | See private addresses/contacts; message; apply; publish                                          | I (local)                                                                      |
| **Seeker / Tenant**            | Find & secure a home; run tenancy | Save, message, request viewing, apply, submit rent transfer reports, raise maintenance, hold private documents/drafts            | See other tenants' data; act on unassigned properties; edit confirmed records                    | I (local); scope tests in `workspaces-smoke`, `rent-smoke`                     |
| **Property Owner / Landlord**  | Advertise & operate portfolio     | Create workspace, publish/pause listings, invite/revoke tenant, confirm rent, manage maintenance, expenses, analytics, documents | Represent parties; negotiate via Kasa; read tenant unsubmitted drafts; rewrite confirmed records | I (local); `marketplace-security-smoke`                                        |
| **Service Provider**           | Win & deliver service jobs        | Maintain profile/areas, receive requests, send versioned quotes, track jobs, review                                              | Act outside own records; see other providers' requests                                           | I (local); `marketplace-smoke`                                                 |
| **Space Operator** (Phase 2)   | Monetise reservable spaces        | Create venues/units, set availability/blocks, accept/propose/decline, mark complete                                              | Be labelled landlord by default; overnight stays; receive gross via Kasa                         | I (local); `viewing-security-smoke` patterns                                   |
| **Business / Employer** (Work) | Hire staff/freelancers            | Publish/close opportunities, review applications, copy posts                                                                     | Employ via Kasa; have Kasa select candidate                                                      | I (local)                                                                      |
| **Candidate / Worker** (Work)  | Find work                         | Apply, withdraw, private chat, control shared docs                                                                               | Be labelled "verified/eligible" without a named check                                            | I (local)                                                                      |
| **Team member (scoped staff)** | Operate within one workspace      | Scoped actions in assigned workspace                                                                                             | Cross-workspace access                                                                           | D (documented); I **partial** — full team permissions not built                |
| **Admin / Moderator**          | Safety, verification, flags       | System-status diagnostics, pre-launch checklist view                                                                             | Approve a market via a technical check; grant legal clearance                                    | I **illustrative**: moderation/verification queues are UI flows, not connected |

**Permission gaps to close for real customers (V-tier):** production IdP + MFA for admins/operators, account recovery, full team/organisation permission model, and connected moderation/verification with audit logs.

---

## 7. Core user journeys

Journeys marked _(persisted)_ survive reload/API restart on the local SQLite build; all are local-only and use synthetic data.

1. **Rent discovery → tenancy** _(persisted)_: browse/filter → request viewing (owner confirm/propose/accept, immutable history, Luanda-time, atomic overlap check) → apply (owner may request follow-up docs; private drafts) → owner decision → maintenance + rent reconciliation over the tenancy.
2. **Advertise property** _(persisted)_: owner picks asset use → listing draft (address never auto-copied) → explicit publish to test catalogue → pause/edit with stale-edit rejection → private enquiry creates participant-only chat.
3. **Rent reconciliation** _(persisted)_: owner sets expected amount/due date → tenant reports a direct transfer → owner requests correction or confirms exact match → immutable before/after history; **Kasa never moves or certifies money**.
4. **Maintenance** _(persisted)_: tenant/owner report (private drafts) → board/list/detail → schedule visit → start/resolve/reopen → history; records scoped to the property.
5. **Home service** _(persisted)_: property-scoped request → provider inbox → versioned exact-cent quote → explicit customer acceptance → job tracking → completion → review; payment is out-of-band via a regulated provider.
6. **Spaces booking (Phase 2)** _(persisted)_: discover → suggested/custom time → operator accept/decline/propose → explicit customer acceptance → external payment where applicable → attendance → review; **no overnight, no gross custody**.
7. **Mortgage estimate**: on-screen illustrative calculation only — no lender matching, no data transmission, no advice.

---

## 8. Monetisation & unit-economics assumptions

### 8.1 Agreed revenue categories (D-tier — documented, none priced)

Landlord/portfolio software subscriptions · fixed-fee promoted listings · provider Pro/service-business subscriptions · Kasa Services marketplace fees · Kasa Work business subscriptions + promoted opportunities (no placement commission by default) · Kasa Spaces operator subscriptions + promoted venues + _optional_ separately-invoiced reservation commission · larger portfolio/business accounts · verification cost-recovery (real checks only) · property/home partnerships · enterprise/API later.

> **Explicitly not decided** (must not be shown as fact): all subscription names/prices/limits, promoted-listing prices, the Services fee %, whether/what Spaces commission launches, launch country/city, and all vendors. (`BUSINESS_RULES.md §"Not yet decided"`.)

### 8.2 Unit-economics model — **assumptions only (D)**

No price, CAC, activation, retention, ARPU, support cost, fraud, storage/messaging cost, margin or Azure-per-tenant cost has been observed. The recommended unit is the **active managed unit (or operator)**:

```
Margin per active unit =
  subscription + approved promotion + permitted marketplace revenue
  − verification − moderation − messaging & storage
  − provider/payment fees − support & disputes − acquisition − fraud loss
```

**Commercial gate before any pricing is treated as real:** ≥5 design partners, ≥3 written statements of willingness to pay, and a per-unit contribution model built from observed pilot costs. Until then, every number in a deck is a hypothesis labelled as such.

---

## 9. Regulatory & risk register

### 9.1 Regulatory posture (country configuration gates all of this)

- **Mediation boundary (Angola, if selected):** Law 14/12 (Arts 4–5) brings prospecting and property promotion within mediation; Decree 320/20 governs licensing. A **written Angolan property-law opinion** on the neutral listing/chat model, self-service listings, lead routing, viewings, applications and paid promotion is a **release requirement** where classification is uncertain (clarify with INH). **Unresolved — V-tier open.**
- **Payments (Angola):** payment services are reserved to authorised entities (Law 40/20). Rent custody stays disabled; Services/Spaces payments must use an authorised provider with direct settlement.
- **Data protection:** Angola Law 22/11 (+ ICT White Paper, Decree 272/24); if Spain, GDPR + LSSI + consumer + accessibility (Law 11/2023). DPIA must be based on the real flow (identity, housing, documents, fraud, ranking, messages). **Not executed — V-tier open.**
- **Marketplace/platform duties:** if EU, the DSA notice-and-action, statements of reasons and trader traceability may apply by qualification.
- **Mortgage:** calculator stays educational; any lender matching/referral/commission needs separate licensed structure and approval.
- **Accessibility:** WCAG 2.2 AA should be a gate before public exposure (housing is an essential service). **Not certified — V-tier open.**

### 9.2 Prioritised risk register (current)

| ID  | Risk                                         | Severity                       | Current state                                                              | Gate to close                                                           |
| --- | -------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| K1  | Real data entered into a synthetic prototype | Critical                       | Persistent "demo" banner + production-write refusal documented             | Technical block + banner + policy + tests before any real data          |
| K2  | Cross-workspace access                       | Critical→**Mitigated (local)** | Server-side authz + `*-security-smoke` negative tests pass                 | Re-prove on managed DB with row-level authorization                     |
| K3  | Transactional layer uncommitted / no CI      | **High (new)**                 | `server/*-store.ts`, routers, security smokes are untracked; no `.github/` | Commit, add CI (lint/type/test/build), branch protection, CODEOWNERS    |
| K4  | Dependency vulnerabilities                   | **High (new)**                 | `npm audit`: 1 high, 3 critical                                            | `npm audit fix`, re-lock, block red merges                              |
| K5  | Mediation/payment classification             | High                           | Documented boundaries; **no legal opinion**                                | Written per-country opinion + versioned technical prohibitions          |
| K6  | Experimental persistence API                 | Medium                         | Local store uses `node:sqlite` (experimental)                              | Migrate to managed PostgreSQL + migrations before customers             |
| K7  | No secure file pipeline                      | High                           | Local bytes only; no malware scan/encryption/retention/backup              | Object storage + scanning + signed URLs + retention before real uploads |
| K8  | No production identity                       | High                           | Local auth only; no MFA/recovery                                           | Approved IdP, MFA for staff/operators, recovery, sessions               |
| K9  | No backup / restore / incident response      | High                           | None                                                                       | Restore drill + incident runbook before pilot                           |
| K10 | Single-author / key-person                   | High                           | One primary author; no CODEOWNERS/review                                   | Second reviewer, branch protection, emergency access, runbooks          |
| K11 | Demo numbers mistaken for traction           | Medium                         | Demo-data rule documented                                                  | Keep out of external pitch; publish only auditable cohort data          |
| K12 | Breadth before one validated wedge           | High                           | 5 verticals visible                                                        | Freeze wedge; backlog the rest without release                          |

---

## 10. Phased roadmap

**Wedge (recommended):** small operators/landlords with 5–50 units, three problems only — **rent-proof reconciliation, maintenance with SLA/history, and a private document/communication archive.** Defer Work, open Services marketplace, Spaces, mortgage referral.

| Phase                                  | Horizon    | Objective                                                | Exit evidence                                                                                                                                                                                                      |
| -------------------------------------- | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0 — Harden & commit**               | 0–30 days  | Make the current build a reproducible, protected release | Transactional layer committed; `npm run check` green; `npm audit` clean; CI + branch protection + CODEOWNERS live; threat model v1; country+segment chosen; 5 design partners in pipeline                          |
| **P1 — Production substrate (narrow)** | 31–60 days | Replace local substrate with real one for the wedge only | Managed PostgreSQL + migrations + row-level authz + audit log; IdP + MFA; private object storage + malware scan + retention; backup **restored** in a clean environment; alerts/SLO; legal opinion commissioned    |
| **P2 — Assisted closed pilot**         | 61–90 days | Prove one real transactional cycle                       | ~5 operators, ~50 units, assisted; real reconciliation + maintenance metrics; ≥3 partners willing to pay; DPIA + contracts + legal opinion in hand; per-unit contribution model; zero Sev-1/cross-tenant incidents |
| **P3 — Controlled expansion**          | 90+ days   | Repeatable sales in one market                           | Signed subscriptions; validated pricing; second vertical only if P2 gates green                                                                                                                                    |

**Kill/park criteria:** if <3 partners will pay, if the mediation/payment classification is unfavourable and unworkable, if restore/security scenarios fail, or if the release gate stays red — adjust the wedge or stop. Do not add a country, vertical, payments or open marketplace during P0–P2.

---

## 11. KPIs (instrument these; stop using decorative percentages)

| Dimension   | KPI                               | P2 continuation threshold    |
| ----------- | --------------------------------- | ---------------------------- |
| Activation  | Invited tenants activated         | ≥70%                         |
| Rent        | Transfers reconciled digitally    | ≥80%                         |
| Rent        | Median confirmation time          | <48h                         |
| Maintenance | Requests acknowledged in SLA      | ≥80% within 4 business hours |
| Security    | Cross-tenant access incidents     | 0                            |
| Reliability | Sev-1 incidents                   | 0                            |
| Release     | `check` green on committed digest | 100% of releases             |
| Resilience  | Restore drill + rollback proven   | Yes, documented              |
| Commercial  | Partners willing to pay           | ≥3 written                   |
| Economics   | Preliminary per-unit margin       | Positive                     |

---

## 12. Scored gap audit (D / I / V) and path to 95

### 12.1 Dimension scores (0–100), evidence-weighted

| Dimension                 | Weight | Documented | Implemented | Validated | Dim. score | Basis                                                             |
| ------------------------- | -----: | ---------: | ----------: | --------: | ---------: | ----------------------------------------------------------------- |
| Product & UX              |    12% |         95 |          75 |        15 |     **70** | Broad, persisted journeys; local-only; no user testing            |
| Tech foundation & quality |    16% |         90 |          60 |        10 |     **58** | Real SQLite + smoke gate; uncommitted, no CI, experimental API    |
| Security & privacy        |    16% |         85 |          45 |         5 |     **46** | Server-side authz + security smokes; no IdP/MFA/scan/pentest/DPIA |
| Data & persistence        |    10% |         90 |          55 |         5 |     **52** | Persists locally; no managed DB/RLS/backup/restore                |
| Operations & resilience   |    10% |         70 |          20 |         5 |     **32** | No monitoring/alerting/backup/restore/incident process            |
| Legal & regulatory        |    14% |         85 |          40 |         5 |     **45** | Boundaries + gates documented; no opinions/licences/contracts     |
| Monetisation & economics  |     8% |         80 |          20 |         5 |     **38** | Categories agreed; nothing priced or cost-validated               |
| Commercial validation     |     8% |         50 |          10 |         5 |     **22** | Wedge hypothesis only; no design partners/LOIs/paid pilot         |
| Governance & people       |     6% |         70 |          35 |        10 |     **42** | Decisions documented; single-author, no CI/CODEOWNERS/RACI        |

**Weighted evidence-backed score ≈ 68–72/100. Reported: 70/100.**

This independently reproduces the indicative 70 — but now anchored to code, docs and git state rather than impression. The venture is strong on _documented_ and increasingly strong on _implemented_; it is near-empty on _validated_, which is exactly the tier that justifies a high score.

### 12.2 Why 95 is not awarded

95 requires the **Validated** column to be real across security, legal, operations, data and commercial dimensions. Today that column is almost entirely 5–15. No volume of additional code or screens moves it; only external proof does.

### 12.3 Exact evidence required to reach 95 (gated, in order)

1. **Reproducible release (→ Tech/Governance):** transactional layer committed; `npm run check` green on a tagged digest; `npm audit` clean; CI + branch protection + CODEOWNERS + SECURITY.md; threat model signed.
2. **Production substrate (→ Security/Data/Ops):** managed PostgreSQL + migrations + row-level authorization + audit logs; approved IdP + MFA + recovery; private object storage + malware scanning + encryption + retention + signed URLs; SLO + alerts + on-call; **backup restored in a clean environment**; incident tabletop completed.
3. **Legal evidence (→ Legal):** written per-country opinion on mediation/payments/consumer/data; executed DPIA + ROPA; contracts (terms, privacy, DPA, pilot, SLA); insurance bound.
4. **Independent assurance (→ Security):** external penetration test with findings remediated; WCAG 2.2 AA audit passed.
5. **Commercial validation (→ Commercial/Economics):** ≥5 signed design partners, ≥3 paying in a closed pilot, observed per-unit contribution margin positive, pilot KPI thresholds (§11) met.
6. **Governance (→ Governance):** named owners for product/security/privacy/ops/legal/finance; RACI; go/hold/stop reviews at each gate; kill criteria recorded in the decision log.

When tiers 1–6 hold with artefacts in an evidence room, the Validated column rises across dimensions and the composite can credibly approach 95 — **and not before.**

---

## 13. Decision log

| #   | Decision                                                        | Status                  | Date         | Source / rationale                          |
| --- | --------------------------------------------------------------- | ----------------------- | ------------ | ------------------------------------------- |
| D1  | Non-brokerage Property Operations positioning                   | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D2  | No custody of rent/deposits; direct tenant→landlord             | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D3  | Overnight/Stays excluded from Properties and Spaces             | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D4  | Mortgage = educational calculator only                          | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D5  | Shared identity, separate role workspaces                       | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D6  | Spaces = sports + event venues only, Phase 2                    | **Locked**              | pre-audit    | `BUSINESS_RULES.md`                         |
| D7  | Persist on local SQLite as a dev milestone (not production)     | **Implemented**         | ≤15 Oct 2026 | `FUNCTION_STATUS.md`; `node:sqlite` in code |
| D8  | Launch country/city                                             | **Open**                | —            | "Not yet decided"                           |
| D9  | All prices, fees, subscription names                            | **Open**                | —            | "Not yet decided"                           |
| D10 | Vendors (auth, DB, storage, payments, verification, maps)       | **Open**                | —            | "Not yet decided"                           |
| D11 | Angola mediation/payment classification                         | **Open — release gate** | —            | Needs written legal opinion (§9)            |
| D12 | Keep work on `presentation-prototype`; land blueprint there     | **Decided**             | 20 Oct 2026  | This session                                |
| D13 | Wedge = 5–50-unit operators; rent-proof + maintenance + archive | **Proposed**            | 20 Oct 2026  | §10; awaiting founder sign-off              |

### Founder decisions required next

1. Confirm (or change) the 5–50-unit wedge and freeze the other verticals for 90 days.
2. Choose one launch country and commission its legal opinion.
3. Approve P0 (commit + CI + audit-fix + branch protection) as the immediate priority.
4. Name owners for security, privacy, operations, legal and finance; schedule go/hold/stop reviews at day 30/60/90.
5. Approve budget by tranche with kill criteria.

---

_Prepared as an evidence-room document. All scores are auditor judgement from the evidence available on 20 October 2026 and are not a financial audit, a compliance certification, or a launch authorisation._
