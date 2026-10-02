import type { Role, View } from "../types";

export interface DemoTarget {
  role: Role;
  view: View;
  intent?: "Rent" | "Buy";
  service?: "discover" | "tasks" | "jobs" | "hire";
  welcome?: boolean;
}
export interface DemoScene {
  id: string;
  title: string;
  detail: string;
  tryIt: string;
  target: DemoTarget;
}
export interface DemoJourney {
  id: string;
  title: string;
  audience: "Personal" | "Professional" | "Platform";
  description: string;
  icon:
    | "home"
    | "key"
    | "building"
    | "service"
    | "work"
    | "calendar"
    | "shield"
    | "user";
  phase?: string;
  scenes: DemoScene[];
}
const scene = (
  id: string,
  title: string,
  detail: string,
  tryIt: string,
  role: Role,
  view: View,
  extra: Partial<DemoTarget> = {},
): DemoScene => ({
  id,
  title,
  detail,
  tryIt,
  target: { role, view, ...extra },
});

export const journeys: DemoJourney[] = [
  {
    id: "find-home",
    title: "Find your next home",
    audience: "Personal",
    icon: "home",
    description:
      "From a first search to a viewing, a conversation and an application.",
    scenes: [
      scene(
        "home",
        "One place to begin",
        "Choose between homes, work, local services and reservable spaces.",
        "Open the intent selector or choose a category to explore.",
        "tenant",
        "overview",
      ),
      scene(
        "rent-search",
        "Find a home to rent",
        "Search rental homes with filters, map pins and a saved shortlist.",
        "Change the filters, switch to the map, then open a property.",
        "tenant",
        "discover",
        { intent: "Rent" },
      ),
      scene(
        "home-detail",
        "Explore a property",
        "Review photos, amenities and listing details, then contact the listing party directly.",
        "Open the gallery, request a viewing or start an application.",
        "tenant",
        "property",
        { intent: "Rent" },
      ),
      scene(
        "shortlist",
        "Keep a shortlist",
        "Return to saved properties and compare your options.",
        "Open a saved home or remove it from your shortlist.",
        "tenant",
        "saved",
      ),
      scene(
        "buyer-search",
        "Explore homes for sale",
        "The same discovery experience supports buying, with an illustrative mortgage calculator.",
        "Open a sale listing and adjust the calculator's down payment or term.",
        "tenant",
        "discover",
        { intent: "Buy" },
      ),
      scene(
        "buyer-detail",
        "Estimate a purchase",
        "Explore a sale listing and see how financing assumptions change an estimate.",
        "Adjust the mortgage inputs. These are examples, not credit offers.",
        "tenant",
        "property",
        { intent: "Buy" },
      ),
      scene(
        "tenant-applications",
        "Follow an application",
        "Track an application and its supporting information.",
        "Open an application and review its status and documents.",
        "tenant",
        "applications",
      ),
    ],
  },
  {
    id: "my-home",
    title: "Life in your home",
    audience: "Personal",
    icon: "key",
    description:
      "Rent records, documents, maintenance and communication in one resident workspace.",
    scenes: [
      scene(
        "resident",
        "Your home at a glance",
        "See the tenancy, upcoming tasks and the people connected to your home.",
        "Follow a rent, maintenance or document shortcut.",
        "tenant",
        "portfolio",
      ),
      scene(
        "tenant-rent",
        "Pay the landlord directly",
        "View bank-transfer instructions, record proof and follow rent status. Kasa does not collect rent.",
        "Open the payment instructions and explore the proof-submission flow using sample data.",
        "tenant",
        "rent",
      ),
      scene(
        "tenant-maintenance",
        "Get a repair organised",
        "Report a problem and follow the request through scheduling and resolution.",
        "Create a sample maintenance request and open its details.",
        "tenant",
        "maintenance",
      ),
      scene(
        "tenant-documents",
        "Keep home records together",
        "Browse tenancy records and sample documents.",
        "Use the document filters and open a document preview.",
        "tenant",
        "documents",
      ),
    ],
  },
  {
    id: "property-business",
    title: "Run a property portfolio",
    audience: "Professional",
    icon: "building",
    description:
      "Publish properties, review applications and coordinate day-to-day operations.",
    scenes: [
      scene(
        "owner",
        "The owner's workspace",
        "See a portfolio overview, activity and operational priorities.",
        "Open a property or follow a task into its workflow.",
        "landlord",
        "overview",
      ),
      scene(
        "portfolio",
        "Publish and organise properties",
        "One publishing entry supports long-term rental, sale and reservable spaces.",
        "Choose Advertise property or space and walk through the listing form.",
        "landlord",
        "portfolio",
      ),
      scene(
        "owner-applications",
        "Review applications",
        "Inspect sample applications and manage the owner's review process.",
        "Open an applicant and explore the available review actions.",
        "landlord",
        "applications",
      ),
      scene(
        "owner-rent",
        "Reconcile rent records",
        "Review proof of a transfer and confirm a rent record. Funds move directly to the landlord.",
        "Open a pending record and inspect the reconciliation actions.",
        "landlord",
        "rent",
      ),
      scene(
        "owner-maintenance",
        "Coordinate maintenance",
        "Review requests, priorities and progress across properties.",
        "Filter the board and open a maintenance request.",
        "landlord",
        "maintenance",
      ),
      scene(
        "owner-documents",
        "Manage property documents",
        "Organise the records associated with each property and tenancy.",
        "Filter records and inspect a document.",
        "landlord",
        "documents",
      ),
      scene(
        "insights",
        "Understand portfolio performance",
        "Explore illustrative occupancy, income and portfolio analytics.",
        "Review the charts and portfolio comparisons.",
        "landlord",
        "insights",
      ),
      scene(
        "plans",
        "Explore the commercial model",
        "Review the proposed software and visibility model for property professionals.",
        "Explore the plan details. No purchase is made in this prototype.",
        "landlord",
        "plan",
      ),
    ],
  },
  {
    id: "book-service",
    title: "Find local help",
    audience: "Personal",
    icon: "service",
    description:
      "Discover home-service providers and follow a request from booking to completion.",
    scenes: [
      scene(
        "services",
        "Find the right professional",
        "Explore cleaning, plumbing, electrical, air-conditioning and handyman services.",
        "Filter a category, open a provider and start a booking or quote request.",
        "tenant",
        "services",
        { service: "discover" },
      ),
      scene(
        "service-requests",
        "Follow your requests",
        "See active service requests and completed work.",
        "Switch between active and completed requests and open their details.",
        "tenant",
        "services",
        { service: "tasks" },
      ),
    ],
  },
  {
    id: "service-business",
    title: "Offer professional services",
    audience: "Professional",
    icon: "service",
    description:
      "A provider workspace for requests, quotes, availability and team activity.",
    scenes: [
      scene(
        "provider",
        "Run a service business",
        "Review sample jobs, availability, quotes, earnings and team activity.",
        "Open a job, explore a quote and change the availability setting.",
        "provider",
        "provider",
      ),
      scene(
        "provider-chat",
        "Coordinate with a customer",
        "Keep a service conversation alongside the operational workflow.",
        "Select a conversation and send a sample message. It stays in this demo.",
        "provider",
        "messages",
      ),
    ],
  },
  {
    id: "find-work",
    title: "Find work",
    audience: "Personal",
    icon: "work",
    phase: "Country-dependent launch",
    description:
      "Explore jobs and freelance opportunities and apply directly to the business.",
    scenes: [
      scene(
        "jobs",
        "Discover an opportunity",
        "Filter jobs and freelance opportunities and review their details.",
        "Select an opportunity and walk through its sample application.",
        "tenant",
        "services",
        { service: "jobs" },
      ),
      scene(
        "candidate-chat",
        "Speak with the business",
        "Candidates and businesses communicate directly through Kasa Chat.",
        "Open a conversation and try the message composer.",
        "tenant",
        "messages",
      ),
    ],
  },
  {
    id: "hire",
    title: "Hire for your business",
    audience: "Professional",
    icon: "work",
    phase: "Country-dependent launch",
    description:
      "Publish an opportunity and explore the business hiring workspace.",
    scenes: [
      scene(
        "hiring",
        "Publish a work opportunity",
        "Businesses control their own posts and hiring decisions.",
        "Choose Hire staff and complete a sample opportunity form.",
        "landlord",
        "services",
        { service: "hire" },
      ),
    ],
  },
  {
    id: "reserve-space",
    title: "Reserve a space",
    audience: "Personal",
    icon: "calendar",
    phase: "Phase 2 concept",
    description:
      "Find a sports court or event venue, choose a time and follow the reservation.",
    scenes: [
      scene(
        "spaces",
        "Find a court or event venue",
        "Discover sports and event spaces, availability and operator-controlled booking options.",
        "Open a venue, select a space and time, then explore the reservation flow.",
        "tenant",
        "spaces",
      ),
      scene(
        "bookings",
        "Manage a reservation",
        "Review requests, booking details and sample confirmations.",
        "Open a booking and inspect its status and confirmation record.",
        "tenant",
        "spaceBookings",
      ),
    ],
  },
  {
    id: "venue-business",
    title: "Operate a venue",
    audience: "Professional",
    icon: "calendar",
    phase: "Phase 2 concept",
    description:
      "Publish sports and event spaces and coordinate calendars and reservation requests.",
    scenes: [
      scene(
        "venue-setup",
        "Set up a venue",
        "Walk through the operator's venue-publishing journey.",
        "Enter sample venue details and explore the setup steps.",
        "spaceOperator",
        "spaceOnboarding",
      ),
      scene(
        "venue-calendar",
        "Coordinate venue activity",
        "Manage sample availability, reservations and customer time requests.",
        "Choose a calendar item and explore reservation actions.",
        "spaceOperator",
        "spaceOperator",
      ),
      scene(
        "venue-messages",
        "Talk with customers",
        "Keep venue conversations in the operator's workspace.",
        "Select a conversation and send a sample reply.",
        "spaceOperator",
        "messages",
      ),
      scene(
        "venue-plans",
        "Explore venue business tools",
        "Review the proposed plans and growth tools for operators.",
        "Compare the plan features. No payment is collected.",
        "spaceOperator",
        "spacesPlan",
      ),
    ],
  },
  {
    id: "account",
    title: "Your Kasa account",
    audience: "Personal",
    icon: "user",
    description:
      "Welcome, profile, notifications and conversations across the experience.",
    scenes: [
      scene(
        "welcome",
        "The first-time experience",
        "Explore the intent-first welcome and sample onboarding screens.",
        "Choose a goal and explore the welcome flow. Use invented information only.",
        "tenant",
        "overview",
        { welcome: true },
      ),
      scene(
        "profile",
        "One account, different activities",
        "Explore profile settings and switch between sample workspaces.",
        "Open the workspace selector to see the separate professional roles.",
        "tenant",
        "profile",
      ),
      scene(
        "notifications",
        "Stay up to date",
        "Review example reminders and activity notifications.",
        "Open a notification and explore its available actions.",
        "tenant",
        "notifications",
      ),
      scene(
        "chat",
        "Keep conversations together",
        "Navigate a sample inbox and message composer.",
        "Select a conversation and send a message. Nothing is delivered to a real person.",
        "tenant",
        "messages",
      ),
    ],
  },
  {
    id: "platform",
    title: "Trust and platform operations",
    audience: "Platform",
    icon: "shield",
    description:
      "Explore moderation, verification queues, feature controls and integration readiness.",
    scenes: [
      scene(
        "moderation",
        "Review trust and safety queues",
        "Explore sample listing reviews, provider verification and platform controls.",
        "Filter the moderation queue and inspect an item. These are demonstration records.",
        "admin",
        "admin",
      ),
      scene(
        "readiness",
        "See what is ready and what is next",
        "Distinguish interactive prototype flows from live integrations and launch dependencies.",
        "Review the status matrix for authentication, data, messaging and payments.",
        "admin",
        "diagnostics",
      ),
    ],
  },
];

export const allScenes = journeys.flatMap((journey) => journey.scenes);
const tourIds = [
  "home",
  "rent-search",
  "home-detail",
  "tenant-rent",
  "owner",
  "owner-rent",
  "services",
  "provider",
  "jobs",
  "hiring",
  "spaces",
  "venue-calendar",
  "moderation",
];
export const overviewTour: DemoJourney = {
  id: "overview-tour",
  title: "The Kasa product tour",
  audience: "Personal",
  icon: "home",
  description: "A seven-minute introduction to the full Kasa experience.",
  scenes: tourIds.map((id) => allScenes.find((item) => item.id === id)!),
};
export const demoJourneys = [overviewTour, ...journeys];
export const roleLabels: Record<Role, string> = {
  tenant: "Personal · Inês Duarte",
  landlord: "Properties · Olivia Martín",
  provider: "Services · Volt & Co.",
  spaceOperator: "Spaces · Olivia Martín",
  admin: "Platform · Kasa Trust",
};

export function readPresentationLocation(search: string) {
  const params = new URLSearchParams(search);
  const journey = demoJourneys.find(
    (item) => item.id === params.get("journey"),
  );
  const rawStep = Number(params.get("step") ?? 0);
  const step = Number.isInteger(rawStep)
    ? Math.max(0, Math.min(rawStep, (journey?.scenes.length ?? 1) - 1))
    : 0;
  return {
    journey,
    step,
    finished: Boolean(journey) && params.get("finished") === "1",
  };
}

export function isPresentationEntry(search: string) {
  const params = new URLSearchParams(search);
  return (
    !params.has("app") &&
    !params.has("device") &&
    !params.has("simulator") &&
    (params.get("present") === "1" ||
      (!params.has("role") && !params.has("view")))
  );
}

export function presentationUrl(
  journey?: DemoJourney,
  step = 0,
  finished = false,
) {
  const params = new URLSearchParams({ present: "1" });
  if (journey) {
    params.set("journey", journey.id);
    params.set("step", String(step));
    if (finished) params.set("finished", "1");
  }
  return `?${params.toString()}`;
}
