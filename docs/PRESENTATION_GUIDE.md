# Presenting Kasa

**[Open the interactive prototype](https://genovesi-jm.github.io/Kasa/?present=1)**

Anyone can open the GitHub Pages link in a browser. No account or sign-in is required.

The prototype opens on a navigator. Start the product tour for a short introduction, or choose a journey and explore the app freely. It works on a phone, tablet or computer. The presentation guide is in English; the existing app's language selector remains available inside each workspace.

## A seven-minute walkthrough

1. **Personal home:** introduce the connected areas: homes, services, work and spaces.
2. **Property discovery:** filter rental homes, inspect a listing, explore its gallery and request a viewing or start an application. The parties communicate directly.
3. **Resident rent records:** show direct-to-landlord instructions and the sample proof workflow. Kasa never collects the rent.
4. **Property operations:** show the owner overview and rent reconciliation. Open the navigator for publishing, applications, maintenance, documents and analytics.
5. **Services:** find a provider and explore a request. Switch to the provider workspace to show jobs, quotes and availability.
6. **Work:** explore opportunities and the hiring interface. Businesses and candidates make their own decisions.
7. **Spaces:** demonstrate sports or event-space discovery and the operator calendar. This is a Phase 2 concept.
8. **Platform:** finish with moderation and verification queues. The Platform journey also shows the integration-readiness matrix.

Use **Next** to move to the next prepared scene. You can also use the app normally within any scene. **Navigator** returns to all journeys. Expand **Jump to a screen** to open a specific feature. **Reset scene** restarts the current screen with its initial sample data. **Copy link** shares the selected journey and stop, not the transient form values or actions within it. Browser Back and Forward work between presentation stops.

## What can be demonstrated

| Journey                       | Navigation and interactions                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Find your next home           | Universal home, Rent/Buy discovery, filters, maps, detail, gallery, shortlist, viewing and application forms, illustrative purchase estimates |
| Life in your home             | Resident dashboard, direct rent instructions, proof workflow, maintenance and documents                                                       |
| Run a property portfolio      | Owner overview, publishing, applications, reconciliation, maintenance, documents, analytics and commercial model                              |
| Find local help               | Provider discovery and filtering, provider profiles, quote/booking requests and request tracking                                              |
| Offer professional services   | Provider jobs, quote actions, availability, earnings, team activity and sample chat                                                           |
| Find work                     | Opportunity discovery, filters, sample applications and direct conversations                                                                  |
| Hire for your business        | Hiring workspace and sample opportunity form                                                                                                  |
| Reserve a space               | Sports/event venue discovery, space/time selection, reservation flow and sample booking records                                               |
| Operate a venue               | Venue publishing, availability/calendar, reservation actions, messages and plan concepts                                                      |
| Your Kasa account             | Welcome/onboarding, profile, workspace switching, notifications and sample conversations                                                      |
| Trust and platform operations | Moderation, verification queues, feature controls and honest integration status                                                               |

## Prototype boundaries

This is a navigable product prototype, not a production service. Records, names, amounts and verification badges are synthetic. Messages are not delivered to real people. Authentication, persistence, private file storage, notification delivery, verification and payments still require production integrations. Some existing actions demonstrate feedback or a proposed workflow rather than performing a server-side operation.

Each prepared scene starts independently. Submitted forms and workflow changes are held in component memory and may reset on navigation, reload, Next or Reset scene. Do not upload private documents or use real personal data. Maps and property photography require internet access.

Kasa is non-brokerage; property parties act directly. Rent goes directly to the landlord. Spaces is limited to sports and event spaces, with no overnight accommodation. Work's launch depends on the selected country's approvals.

## Running and checking the prototype

Run `npm ci` and `npm run dev` to open the navigator locally. `?app=1` opens the original app experience, while existing `role`, `view`, `device` and `simulator` entry links remain supported.

Run `npm run test:prototype`, `npm run lint` and `npm run build` to check the navigation catalogue, deep-link parsing, invalid URL handling and production compilation. The original API checks remain available through `npm run check`.
