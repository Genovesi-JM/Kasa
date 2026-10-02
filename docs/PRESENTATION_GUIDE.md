# Presenting Kasa

**[Open the interactive prototype](https://genovesi-jm.github.io/Kasa/?present=1)**

Anyone can open the GitHub Pages link in a browser. No account or sign-in is required.

The prototype opens on a navigator. Start the product tour for a short introduction, or choose a journey and explore the app freely. It works on a phone, tablet or computer. The presentation guide is in English; the existing app's language selector remains available inside each workspace.

## A seven-minute walkthrough

1. **Personal home:** introduce the connected areas: homes, services, work and spaces.
2. **Property discovery:** filter rental homes, inspect a listing, explore its gallery and request a viewing or start an application. The parties communicate directly.
3. **Resident rent records:** show direct-to-landlord instructions and the sample proof workflow. Kasa never collects the rent.
4. **Property operations:** show the owner overview and rent reconciliation. Open the navigator for publishing, applications, maintenance, documents and analytics.
5. **Services:** create a local request for the sample provider Volt & Co. Switch to the provider workspace to propose a quote, then return to the original customer workspace to accept or refuse it. An accepted quote can be started and completed explicitly by the provider, with shared history.
6. **Work:** explore opportunities and the hiring interface. Businesses and candidates make their own decisions.
7. **Spaces:** create a local request for a court at Poblenou MultiSport Club. Switch to the venue operator workspace to review it and accept priced original terms or propose a date, time and price. Return to the original customer workspace to accept or refuse the proposal and inspect the history. Other venues remain browsable, but this sample operator manages only Poblenou. Spaces remains a Phase 2 product area.
8. **Platform:** finish with moderation and verification queues. The Platform journey also shows the integration-readiness matrix.

Use **Next** to move to the next prepared scene. You can also use the app normally within any scene. **Navigator** returns to all journeys. Expand **Jump to a screen** to open a specific feature. **Reset scene** restarts the current screen with its initial sample data. **Copy link** shares the selected journey and stop, not the transient form values or actions within it. Browser Back and Forward work between presentation stops.

For linked customer/provider or customer/operator demonstrations, stay in the same scene and change workspace through the app's workspace selector. Moving to another prepared scene starts a separate sample session.

## What can be demonstrated

| Journey                       | Navigation and interactions                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Find your next home           | Universal home, Rent/Buy discovery, filters, maps, detail, gallery, shortlist, viewing and application forms, illustrative purchase estimates |
| Life in your home             | Resident dashboard, direct rent instructions, proof workflow, maintenance and documents                                                       |
| Run a property portfolio      | Owner overview, publishing, applications, reconciliation, maintenance, documents, analytics and commercial model                              |
| Find local help               | Sample provider discovery and filtering, retained request drafts, quote acceptance/refusal, cancellation and history                          |
| Offer professional services   | Scoped request inbox, quote revisions, customer decision tracking, explicit start/completion and history                                      |
| Find work                     | Opportunity discovery, filters, sample applications and direct conversations                                                                  |
| Hire for your business        | Hiring workspace and sample opportunity form                                                                                                  |
| Reserve a space               | Sports/event venue discovery, workspace-specific saved venues, dated requests, proposal decisions, cancellation and history                   |
| Operate a venue               | Poblenou request inbox, original-term review, priced proposals, explicit agreement decisions and history                                      |
| Your Kasa account             | Welcome/onboarding, profile, workspace switching, notifications and sample conversations                                                      |
| Trust and platform operations | Moderation, verification queues, feature controls and honest integration status                                                               |

## Prototype boundaries

This is a navigable product prototype, not a production service. Records, names, amounts and verification badges are synthetic. Messages are not delivered to real people. Authentication, persistence, private file storage, notification delivery, verification and payments still require production integrations. Some existing actions demonstrate feedback or a proposed workflow rather than performing a server-side operation.

Current operational records and retained drafts stay in memory across normal app navigation and workspace changes within the same tab. Each prepared scene starts independently; reload, Next or Reset scene resets those local changes. A shared link does not include them. Do not upload private documents or use real personal data. Maps and property photography require internet access.

Services availability calendars, earnings and team management remain future work. Spaces publishing, editable availability calendars, connected reservations, payment execution, QR records and public reviews are also not implemented operational workflows. Current sample catalogue prices and availability do not guarantee a real service or venue reservation.

Kasa is non-brokerage; property parties act directly. Rent goes directly to the landlord. Spaces is limited to sports and event spaces, with no overnight accommodation. Work's launch depends on the selected country's approvals.

## Running and checking the prototype

Run `npm ci` and `npm run dev` to open the app locally. Add `?present=1` for the presentation navigator. `?app=1` also opens the app experience, while existing `role`, `view`, `device` and `simulator` entry links remain supported.

Run `npm run test:prototype`, `npm run lint` and `npm run build` to check the navigation catalogue, deep-link parsing, invalid URL handling and production compilation. The original API checks remain available through `npm run check`.
