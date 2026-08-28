export type Role =
  "landlord" | "tenant" | "provider" | "spaceOperator" | "admin";

export type View =
  | "overview"
  | "discover"
  | "saved"
  | "property"
  | "portfolio"
  | "applications"
  | "messages"
  | "notifications"
  | "profile"
  | "rent"
  | "maintenance"
  | "documents"
  | "services"
  | "spaces"
  | "spaceVenue"
  | "spaceBookings"
  | "spaceOperator"
  | "spaceOnboarding"
  | "spacesPlan"
  | "provider"
  | "admin"
  | "diagnostics"
  | "insights"
  | "plan";

export interface Property {
  id: number;
  title: string;
  address: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqm: number;
  image: string;
  tag?: string;
  available: string;
  furnished: boolean;
  landlord: string;
  match: number;
  listingType: "Rent" | "Buy";
  propertyType: "Apartment" | "House" | "Studio" | "Loft";
  verified: boolean;
  neighbourhood: string;
  lat: number;
  lng: number;
  deposit: number;
  description: string;
  amenities: string[];
  gallery: string[];
}

export interface Application {
  id: number;
  applicant: string;
  property: string;
  submitted: string;
  status: "Review" | "Documents" | "Approved" | "Draft";
  score: number;
  avatar: string;
}

export interface MaintenanceRequest {
  id: number;
  title: string;
  property: string;
  tenant: string;
  status: "New" | "Scheduled" | "In progress" | "Resolved";
  priority: "Low" | "Medium" | "Urgent";
  date: string;
  provider?: string;
}

export interface SpaceUnit {
  id: number;
  name: string;
  activity: string;
  price: number;
  peakPrice: number;
  image: string;
  capacity: number;
  slots: Array<{
    time: string;
    status: "Available" | "Booked" | "Peak";
    price: number;
  }>;
}

export interface SpaceVenue {
  id: number;
  name: string;
  category: "Sports" | "Events";
  address: string;
  neighbourhood: string;
  lat: number;
  lng: number;
  distance: string;
  priceFrom: number;
  priceUnit: string;
  rating: number;
  reviews: number;
  image: string;
  gallery: string[];
  availableToday: boolean;
  verified: boolean;
  bookingMode: "Instant Book" | "Request to Book";
  description: string;
  amenities: string[];
  capacity?: number;
  openingHours: string;
  cleaningFee?: number;
  deposit?: number;
  spaces: SpaceUnit[];
}

export interface SpaceBooking {
  id: string;
  venue: string;
  space: string;
  date: string;
  time: string;
  status: "Upcoming" | "Completed" | "Cancelled" | "Requested";
  price: number;
  image: string;
  code: string;
}
