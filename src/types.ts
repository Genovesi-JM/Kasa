export type Role = 'landlord' | 'tenant'

export type View =
  | 'overview'
  | 'discover'
  | 'portfolio'
  | 'applications'
  | 'messages'
  | 'rent'
  | 'maintenance'
  | 'documents'
  | 'services'
  | 'insights'
  | 'plan'

export interface Property {
  id: number
  title: string
  address: string
  city: string
  price: number
  beds: number
  baths: number
  sqm: number
  image: string
  tag?: string
  available: string
  furnished: boolean
  landlord: string
  match: number
}

export interface Application {
  id: number
  applicant: string
  property: string
  submitted: string
  status: 'Review' | 'Documents' | 'Approved' | 'Draft'
  score: number
  avatar: string
}

export interface MaintenanceRequest {
  id: number
  title: string
  property: string
  tenant: string
  status: 'New' | 'Scheduled' | 'In progress' | 'Resolved'
  priority: 'Low' | 'Medium' | 'Urgent'
  date: string
  provider?: string
}
