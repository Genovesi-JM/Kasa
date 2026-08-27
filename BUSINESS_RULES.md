# Kasa business rules

This file records the product and business decisions already agreed in the Kasa planning conversation. It is the guardrail for product copy, UX and implementation. Kasa Spaces is approved as a Phase 2 vertical.

## Locked decisions

### Positioning

- Kasa is a **non-brokerage PropTech and Property Operations Platform**.
- The product has three connected pillars: **Properties + Property Operations + Kasa Services**.
- Kasa provides technology, records, communication and workflows. It does not act as an estate agent or accept a regulated property-management mandate by default.

### Property transactions

- Properties and reservable spaces share one asset-discovery and publishing entry: **Advertise property or space**. The user first chooses the asset use, then Kasa opens the appropriate workflow.
- The supported publishing choices are property for long-term rent, property for sale, and sports/event space for hourly, session or day use. Overnight accommodation remains excluded.
- Owners or authorised listing parties publish and control their own listings.
- Seekers browse, save, message, request a viewing and apply.
- The parties communicate, decide, negotiate and contract directly.
- Kasa does not represent a buyer, tenant, owner or landlord.
- Kasa does not negotiate rent, sale price or other property terms.
- Kasa does not sign, close or accept offers for either party.
- Kasa does not earn a success commission, a percentage of rent or sale price, or a one-month-rent placement fee.
- Property discovery is for genuine residential/longer-term rent and property-sale advertisements—not nightly stays or tourist accommodation.
- Property language uses **request viewing**, **apply** and **message listing party**. Accommodation terms such as **book now**, **check-in** and **check-out** do not belong in the property journey.
- Public property and listing-party profiles do not display an email address or phone number.
- Contact begins in a private Kasa Chat. A profile may show a first name or business name, role and genuine verification results, while personal contact details remain hidden.
- A tenant and listing party may voluntarily exchange contact details later, but Kasa does not require public disclosure and does not enter the conversation as a negotiator or representative.

### Rent and deposits

- Rent moves **tenant → landlord bank account**.
- Kasa does not receive, hold, safeguard or forward rent or deposits initially.
- Kasa may show landlord-supplied bank instructions, send reminders, accept proof, reconcile records and store landlord confirmation.
- A Kasa rent status is an operational record; it is not proof that Kasa processed the money.

### Mortgage estimates — locked safest launch model

- Kasa may provide an on-screen mortgage calculator for sale listings using price, user-entered down payment, term, interest rate and estimated purchase costs.
- Results are illustrative planning estimates, not lending decisions, personalised financial advice, rate forecasts, credit offers or guarantees of approval.
- Kasa does not provide credit, assess affordability or eligibility, negotiate with lenders, submit mortgage applications, collect financial documents for lenders or describe a user as pre-approved.
- Purchase taxes and costs remain user-configurable because they vary by country, property and transaction. Country defaults require legal and tax validation before activation.
- Kasa does not match users to particular banks, transmit calculator data to lenders or receive lender commissions in the approved MVP.
- Any future lender comparison, referral, commission or mortgage-intermediation feature requires a separate regulatory and commercial decision, licensed/authorised delivery structure and explicit approval before implementation.

### Property operations

- Kasa supports tenant and landlord dashboards, applications, documents, rent records, expenses, maintenance, communication, alerts and analytics.
- The preferred term is **Property Operations**, not unqualified **Property Management**.
- Owners and landlords remain responsible for decisions and for anyone they appoint to act on their behalf.

### Private messaging and personal data

- **Private Kasa Chat** means private from the public and other users; it must not be described as end-to-end encrypted unless that architecture is actually implemented and independently confirmed.
- Messages, attachments and reports are role-restricted and protected with appropriate access controls, retention rules and audit records.
- Users can report or block another user. Any staff access for safety, support, fraud review or a lawful request must be authorised, limited and auditable.
- Country configuration controls consent, retention, user-rights handling, notification channels, storage location and any international transfer requirements.

### Account and role architecture

- **Separate roles and dashboards, shared Kasa identity** is a locked product rule.
- The separation is operational, not a split marketplace: properties and spaces are both physical assets in one Kasa account and one publishing entry. The listing type determines whether Kasa exposes tenancy/rent tools or availability/reservation tools.
- Property Owner / Landlord and Space Operator are distinct product roles with separate navigation, workflows, permissions, records and dashboards.
- A person or company that holds both roles uses one Kasa identity and can switch between its Property Owner and Space Operator workspaces without creating another login.
- A company account may contain both a property portfolio and a Spaces business, while access for staff and team members remains scoped to the relevant workspace.
- Switching workspaces changes the active operating context; it does not merge property, tenancy, venue or booking records.
- Public landlord/listing-party profiles and public venue/operator profiles remain separate. Venue profiles carry opening hours, live availability, space types, booking rules, amenities and venue reviews; property-side profiles and listings carry only the information relevant to the property journey.
- A Space Operator is not labelled as a landlord by default. Venue onboarding records the operator’s relationship to each venue—owner, operator, facility manager or authorised representative—and verifies its authority to publish where required.
- Venue ownership does not automatically activate the Property Owner workspace. A user who needs both roles activates both under the same Kasa identity and switches between their separate workspaces.
- Holding both roles under one account does not merge their commercial or regulatory responsibilities.

### Navigation and creation actions

- The primary mobile navigation is role-specific and uses named destinations. It does not use an unexplained global “+” whose meaning changes between roles.
- Creation actions such as Add property, Report maintenance, Add venue or Add schedulable space live inside the relevant workflow and use explicit labels.
- Supply uses one named action—**Advertise property or space**—with explicit branches for long-term rent, sale and reservable sports/event space. Users should never see space reservation without an equally clear route to advertise a space.

### Kasa Services

- Initial categories are cleaning, plumbing, electrical, air conditioning and handyman/general repair.
- The marketplace remains limited to home, property and building services.
- Providers can maintain profiles, service areas, availability, quotes, bookings, job tracking, chat, completion records and reviews.
- Home-service payments are separate from rent. Any processing must use supported regulated payment providers rather than Kasa safeguarding customer funds itself.
- Marketplace fees may apply to completed home-service jobs; they are not property brokerage commissions.

### Kasa Spaces · Phase 2

- Kasa Spaces is an approved marketplace and scheduling vertical for reservable physical spaces.
- The approved Kasa Spaces scope is limited to two categories for now: sports courts/pitches and event/party venues. Meeting rooms, coworking rooms, studios, fitness rooms and other space categories are deferred and must not appear in the launch product.
- The MVP journey is deliberately simple: discover → choose an operator-suggested time or request another time → operator accepts, declines or proposes a change → customer explicitly accepts any changed time → external payment where applicable → confirmation → attendance → review.
- Spaces are booked by hour, session, half-day or event. Kasa Spaces is not short-term accommodation and does not support overnight residential stays, tourist stays, lodging check-in or lodging check-out flows.
- Both **Instant Book** and **Request to Book** are supported according to operator settings.
- **Request to Reserve** is the safer default for venues that maintain their calendar manually. **Instant Reserve** is enabled only when the operator maintains sufficiently accurate availability.
- Kasa does not prescribe fixed opening hours, session lengths or mandatory time slots. Operators control their own availability and can publish suggested times, accept custom-time requests or block periods.
- An operator-proposed time modification does not alter a reservation until the customer explicitly accepts it. The request, proposal and acceptance are retained in the booking record.
- At launch, each venue operator contracts with its own supported regulated payment provider and receives the reservation payment directly into its own merchant or bank account.
- Kasa does not receive the gross reservation amount, pool venue money, deduct a commission before settlement, operate a wallet or redistribute venue funds.
- If Kasa charges a reservation-based commission, Kasa records completed reservations and invoices the operator separately after settlement. The operator pays the Kasa invoice as an ordinary business-to-business charge.
- Automated split settlement may be considered later only after the acquiring bank/payment provider formally supports the structure and Angolan payment and tax treatment has been confirmed in writing.
- Venue operators remain responsible for operating licences, safety, insurance, legal capacity and local compliance.
- Kasa provides discovery, marketplace, scheduling, live availability, booking records, communication and operator-software tools. It does not own or operate the facilities.
- Multi-space facilities can give every court, pitch or event hall its own schedule while retaining a unified operator calendar.
- Advanced dynamic pricing, memberships, waitlists, branch tooling and similar operator features remain optional later-stage capabilities, not requirements for the simple launch flow.
- Kasa Services may be suggested separately after a space booking, including event services and sports-related providers. These services remain optional and separately supplied.
- Agreed launch revenue categories are Spaces Pro and Spaces Business subscriptions, promoted venues and larger operator accounts. A separately invoiced commission based on completed reservations remains an optional commercial model, subject to legal, payment-provider and tax confirmation. Exact prices, limits and fee percentages remain open.

### Trust, data and global configuration

- Verification labels must correspond to a real, named check; they are not badges sold without verification.
- Listings, accounts and providers have distinct verification states.
- Documents and data are role-restricted.
- Kasa should not monetise by selling personal user data.
- Country configuration and feature flags control market-specific capabilities, payment rails and compliance requirements.
- The experience is intent/location first and allows browsing before login; login is introduced when the user takes a meaningful action.

### Language and localisation

- Portuguese is Kasa's main and default product language.
- English, Spanish and French are supported product languages.
- Arabic uses a right-to-left interface and shows the English wording in parentheses where a translated Kasa label could otherwise be ambiguous.
- Simplified Chinese shows the English wording in parentheses where a translated Kasa label could otherwise be ambiguous.
- Translation must preserve Kasa's legal and product meaning. In particular, localisation must not turn a viewing request into a property booking, describe Kasa as an agent, or imply that Kasa receives rent or venue funds.
- Country, language, currency, date/time formatting and regulatory feature availability are separate settings. Changing the interface language does not change the active legal country configuration.

### Angola pre-launch compliance gates

These are readiness requirements **if Angola is selected as a launch market**; they do not mean the definitive launch country has been chosen.

- Obtain Angolan legal confirmation of Kasa's information-society-provider classification and any registration or authorisation required for the intended services.
- Complete the required personal-data assessment, notifications or authorisations with the competent data-protection authority, including hosting, chat, identity checks and international data transfers.
- Obtain a written Angolan property-law opinion on the neutral listing and chat model, the boundary with licensed mediation, and each proposed monetisation method.
- Review any payment flow under the applicable payment-services framework. Rent custody remains disabled, and supported service or Spaces payments use an appropriately authorised provider.
- Before public launch, operate reporting, blocking, moderation, evidence retention, appeals, listing authenticity and clear promoted-content labelling appropriate to the market.
- Property owners, listing parties, service providers and venue operators remain responsible for their own licences, authority, safety, insurance, capacity and local compliance.

### Agreed revenue categories

- Landlord and portfolio software subscriptions.
- Fixed-fee promoted listings and advertising visibility.
- Provider Pro and service-business subscriptions.
- Kasa Services marketplace fees.
- Kasa Spaces operator subscriptions, promoted venues and—only if approved—a separately invoiced commission based on completed reservations.
- Larger portfolio/business accounts.
- Optional verification cost recovery where it represents a real check.
- Relevant property/home partnerships.
- Enterprise and API products later.

## Not yet decided

These must not be presented as approved product facts:

- exact landlord/provider subscription names and all subscription prices, currencies, limits or final entitlements; Kasa Spaces Free/Pro/Business labels are currently approved UX concepts rather than launched commercial offers;
- exact promoted-listing prices or bundles;
- exact home-service marketplace fee percentage;
- whether a separately invoiced Kasa Spaces commission will be enabled at launch and, if so, its exact percentage;
- the definitive launch country or city;
- authentication, banking, verification, storage or payment vendors;
- any mortgage lender, mortgage-referral model, lender commission, financial-advice service or credit-intermediation workflow;
- automatic bank reconciliation partners and launch availability;
- dark mode timing;
- condominium/building administration as an MVP requirement;
- premium photography or drone media as a core launch service;
- any Kasa guarantee, insurance promise or service-quality guarantee.

## Demo-data rule

Names, addresses, dates, rents, provider prices, ratings, response times, earnings, percentages, verification results and market locations shown in the simulator are illustrative seed data. They demonstrate workflows and are not commercial forecasts, live inventory or approved launch decisions.
