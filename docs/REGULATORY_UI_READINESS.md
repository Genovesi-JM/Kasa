# Kasa regulatory and trustworthy-UI readiness

**Status:** product guardrails and engineering checklist, updated 27 August 2026. This is not legal advice and does not select a launch country. Country counsel, the chosen payment provider and the relevant authorities must confirm the final operating model before public launch.

## Product boundary that remains locked

- Kasa is a non-brokerage technology platform. Property owners/listing parties and prospective tenants or buyers communicate and decide directly.
- Residential rent and deposits move directly between tenant and landlord. Kasa records instructions, proof, reconciliation and confirmation only.
- The mortgage tool is educational. Kasa does not assess eligibility, recommend lenders, collect credit documents, submit applications or receive lender-referral commission in the approved MVP.
- Spaces launches only for sports and events. The venue remains the merchant and receives customer payment through its own supported regulated provider. Kasa does not receive, pool or redistribute the gross booking amount.
- Services payment processing, if enabled, must follow the same country-gated, provider-led design and must remain separate from rent.

## Market-entry gates

No country can be enabled merely by translating the interface. The country flag stays off until the following have named owners, written evidence and an approval date:

1. Legal classification of property advertising, messaging, applications, operational records, services and Spaces.
2. Company, tax, invoicing and consumer-contract setup.
3. Privacy notice, lawful bases/consents, retention schedule, user-rights workflow, processor contracts, incident response and international-transfer analysis.
4. Listing-party, service-provider and venue-operator verification standard, including the distinction between a private person and a professional trader.
5. Local property-advertising content requirements and prohibited/discriminatory listing rules.
6. Payment-provider confirmation covering merchant onboarding, settlement recipient, refunds, cancellations, disputes, chargebacks, local currency and Kasa fees.
7. Marketplace reporting, blocking, content moderation, decision notices, evidence retention and appeals.
8. Terms for users, listing parties, providers and venue operators, plus clear pre-contract information.
9. Security, accessibility, backup/restore and operational-support sign-off.

## European Union / Spain readiness

These requirements apply only where their legal scope is met; micro/small-enterprise exceptions and national implementation must be checked by counsel.

- **Privacy:** build with data minimisation and data protection by design/default. Public property profiles do not expose personal email or telephone numbers; access to private chat, applications, documents and proofs is role-scoped. See GDPR Article 25 in the [official EUR-Lex text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679).
- **Online marketplace duties:** when consumers can conclude distance contracts with professional providers/operators, collect the trader information required by the Digital Services Act where applicable, make best efforts to assess it, distinguish professional traders from private parties, support notice/reporting and keep promoted content clearly labelled. See DSA Articles 25 and 30 in [Regulation (EU) 2022/2065](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065).
- **Consumer information:** before a paid Services or Spaces commitment, show the provider/operator identity and status, total price and mandatory charges, the service/space, date and duration, cancellation/refund terms, payment recipient and a clear final action label. Do not preselect paid extras. See the European Commission's [Consumer Rights Directive overview](https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en).
- **Reviews and ranking:** disclose promoted placement, do not imply that unverified reviews are verified purchases, and document the main ranking parameters. Never use false urgency, fabricated discounts or forced gamification.
- **Mortgage boundary:** mortgage-credit intermediaries operating across Spain or more than one autonomous community require registration and other controls under Law 5/2019. Kasa therefore remains an educational calculator unless a separately approved authorised structure exists. See the [Banco de España register process](https://sedeelectronica.bde.es/sede/es/tramites/registro-intermediarios-credito-inmobiliario-p218.html).

## Angola readiness

- **Personal data:** the current baseline is Law 22/11 on Personal Data Protection. The 2025 revision consultation means the framework must be rechecked immediately before launch. Use purpose limitation, minimum fields, controlled access, rights handling and an approved international-transfer/storage position. Sources: [official-law PDF hosted by the Angolan data-protection authority](https://apd.ao/fotos/frontend_1/editor2/110617_lei_22-11_de_17_junho-proteccao_dados_pessoais.pdf) and the government's [2025 revision consultation](https://www.consultapublica.gov.ao/consulta/100021).
- **Payments:** Law 40/20 places payment systems and payment-service providers under Banco Nacional de Angola oversight; providers cannot generally begin regulated activity without the required authorisation/registration. Kasa must not act as the payment-service provider or hold customer/merchant funds. Sources: [BNA legislation index](https://www.bna.ao/anexos/) and [Law 40/20 text](https://lex.ao/docs/assembleia-nacional/2020/lei-n-o-40-20-de-16-de-dezembro/).
- **Launch evidence:** obtain written confirmation from the acquiring/payment partner and Angolan counsel that the selected direct-to-merchant flow, refunds, Kasa subscription/invoice model and records do not make Kasa an unlicensed payment provider.

## UI requirements derived from these guardrails

- Use **Message listing party**, **Request viewing** and **Apply** for residential property; never “Book now”, “check-in” or “Kasa agent”.
- Show **Private listing party** or **Professional listing party** and the actual verification claims. “Verified” must never mean title, licence, quality or legal-compliance guarantee unless each claim was checked and remains current.
- Services and Spaces show the professional/private status, verification scope, payment recipient, all mandatory fees and cancellation terms before commitment.
- Any operator-proposed time or price change requires explicit customer acceptance.
- Promoted cards are labelled **Promoted** and ranking help explains the main factors.
- Provide report, block, moderation-result and appeal routes. Do not claim end-to-end encryption unless independently implemented and verified.
- Use clear language and reversible actions; no false scarcity, countdown pressure, hidden fees or pre-ticked paid extras.

## Accessibility and navigation baseline

- Target WCAG 2.2 AA, including visible keyboard focus, consistent navigation, language metadata, error identification and pointer targets of at least 24 × 24 CSS px (larger for primary mobile actions). See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Mobile bottom navigation contains stable top-level destinations, never creation or payment actions. Apple likewise describes tab bars as navigation rather than action controls in its [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
- Each role gets a short, stable mobile set; secondary records and creation actions stay inside the relevant destination.
- Portuguese is the primary language. English, Spanish, French, Arabic and Simplified Chinese must have complete shell/navigation coverage. Arabic is RTL; Arabic and Chinese show English clarification where the product specification requires it.

## Required launch artefacts still missing

- Signed legal classification memo for the selected country and each enabled vertical.
- Data map, records-of-processing inventory, retention schedule and processor/subprocessor register.
- User/privacy/marketplace/venue/provider terms and cancellation/refund policy reviewed for the launch country.
- Verification policy defining each badge, evidence, expiry and re-check process.
- Moderation policy, user appeal workflow and law-enforcement request procedure.
- Payment-provider contract and written direct-settlement confirmation.
- Threat model, independent security test, restore test and incident exercise.
- Accessibility audit with keyboard, screen-reader, zoom, RTL and mobile evidence.
