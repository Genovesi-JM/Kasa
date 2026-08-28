# Kasa visual system

This file is the canonical visual source of truth for the Kasa simulator. It governs visual treatment only. Product scope, terminology and business behaviour remain governed by [BUSINESS_RULES.md](./BUSINESS_RULES.md).

## Character

Kasa should feel warm, premium, calm, trustworthy, modern, residential, spacious and editorial. It should not resemble a generic fintech dashboard, a neon marketplace or a dense enterprise admin template.

## Core palette

- Primary forest: `#173F37`
- Hero petrol green: `#245F52`
- Warm cream canvas: `#F5F2E9`
- Soft white card: `#FCFBF7`
- Deep green text: `#153A33`
- Selective gold action: `#E7B94F`
- Muted supporting tones: sage, dusty blue, lilac and pale amber

Gold is reserved for the logo mark, selected category icons and occasional priority accents. It is not a general-purpose primary button colour or a global mobile action.

## Components

- Cards use moderate 12–18px corner radii, fine warm green-grey borders and subtle low-elevation shadows.
- Large editorial hero cards use deep green, concise copy, one clear primary action, a restrained KPI or progress visual and subtle architectural or circular geometry.
- Primary actions use forest green. Secondary actions use the soft-card surface with a fine green-grey border.
- Typography uses a humanist sans-serif with readable compact headings. KPI values stay proportional and should never dominate a page like a banking balance.
- Icons are clean outlines. Active states use muted tinted containers rather than saturated blocks.
- Photography is warm, realistic and residential, with natural light and uncluttered interiors.
- Desktop dashboards should normally show no more than four headline KPIs and one primary chart at a time.
- The customer mobile dock is a calm white navigation surface. Search, Kasa Chat, Notifications and Profile remain visually stable; one named destination changes with the active area. Creation belongs inside explicit workflows, never in an ambiguous raised “+” action.

## Role expression

- Tenant surfaces are home-centred. Rent is an important task, not the whole identity of the experience.
- Landlord surfaces are operational and calm, with clear property, application, rent-record and maintenance workflows.
- Agency and larger-portfolio views may be denser but must use the same design language.
- Kasa Services uses the same identity, human provider photography, named verification checks and muted gold accents.
- Provider and admin workspaces inherit the same components rather than introducing separate visual systems.

## Responsive contract

- The reference simulator viewports are iPhone 15 at `393 × 852` and Pixel 8 at `412 × 915`. Each uses its own proportion; device chrome must not reduce the declared application viewport.
- `720px` is the main mobile composition breakpoint and `980px` is the tablet/navigation breakpoint. Content must remain usable down to `320px` without page-level horizontal overflow.
- iOS and Android safe areas are reserved around the top sensor area, home indicator or system navigation. The fixed mobile dock must never cover a composer, confirmation action or drawn-map result.
- Dense tables and calendars may use intentional horizontal rails on mobile. The page itself must not scroll horizontally, and rail scrollbars stay visually quiet while touch scrolling remains available.
- Mobile modals use dynamic viewport height, remain internally scrollable and keep their primary action reachable. Escape and a labelled close control must both work.
- On mobile, conversation lists and active chats are separate states rather than two vertically stacked desktop panes.

## Kasa Spaces · Phase 2

Kasa Spaces is now an approved Phase 2 vertical. It inherits the same forest, cream, soft-white and selective-gold system. Sports imagery should feel energetic but natural; event and work-space imagery should remain warm and editorial. Live availability, slot selection, operator calendars and booking states may be denser than residential discovery, but must remain calm and highly readable. No neon sports-app styling or accommodation imagery belongs in this vertical.

## Locked experience principles

- Properties + Property Operations + Kasa Services remain the core platform, with Kasa Spaces approved as a connected Phase 2 vertical.
- Discovery is available before login and begins with intent and location.
- Navigation adapts to the user role.
- Property parties communicate and transact directly.
- Rent moves tenant to landlord; Kasa only records, reconciles and confirms status.
- Property journeys use listing, viewing, application and direct-message language—never short-stay booking language.
- Kasa does not present itself as broker, negotiator, rent custodian or default property manager.
