# Kasa

Kasa is a non-brokerage property-operations platform for landlords and tenants. It helps people discover homes, manage applications and documents, communicate, reconcile direct rent payments, coordinate maintenance, and find service providers.

Kasa does **not** negotiate leases, represent either party, earn transaction commissions, hold deposits or rent, or operate properties under a management mandate.

## Run locally

```bash
npm install
npm run dev
```

## MVP architecture

- React + TypeScript + Vite
- Front-end demo session with landlord/tenant role switching
- Typed mock domain data isolated in `src/data.ts`
- No payment custody: rent records are reconciled against proof of direct bank transfers
- Responsive app shell designed for desktop and mobile

The current demo intentionally uses local data so the core product model and UX can be validated before selecting authentication, persistence, messaging, file-storage, and subscription providers.
