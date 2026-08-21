import type { Application, MaintenanceRequest, Property } from './types'

export const properties: Property[] = [
  {
    id: 1,
    title: 'Sunlit Eixample home',
    address: 'Carrer de Mallorca, 214',
    city: 'Barcelona',
    price: 1850,
    beds: 2,
    baths: 2,
    sqm: 92,
    image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85',
    tag: 'Great match',
    available: 'Available now',
    furnished: true,
    landlord: 'Olivia Martín',
    match: 96,
  },
  {
    id: 2,
    title: 'Quiet Gràcia loft',
    address: 'Carrer de Verdi, 88',
    city: 'Barcelona',
    price: 1420,
    beds: 1,
    baths: 1,
    sqm: 64,
    image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85',
    tag: 'New',
    available: 'Available 1 Sep',
    furnished: true,
    landlord: 'Nuno Silva',
    match: 91,
  },
  {
    id: 3,
    title: 'Poblenou terrace studio',
    address: 'Carrer de Pujades, 121',
    city: 'Barcelona',
    price: 1280,
    beds: 1,
    baths: 1,
    sqm: 51,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85',
    available: 'Available 15 Sep',
    furnished: false,
    landlord: 'Sofia Costa',
    match: 87,
  },
  {
    id: 4,
    title: 'Sant Antoni family flat',
    address: 'Carrer del Parlament, 42',
    city: 'Barcelona',
    price: 2100,
    beds: 3,
    baths: 2,
    sqm: 118,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
    tag: 'Promoted',
    available: 'Available 1 Oct',
    furnished: false,
    landlord: 'Mateo Ruiz',
    match: 82,
  },
]

export const applications: Application[] = [
  { id: 1, applicant: 'Amira Hassan', property: 'Sunlit Eixample home', submitted: 'Today, 09:42', status: 'Review', score: 92, avatar: 'AH' },
  { id: 2, applicant: 'Leo Bernard', property: 'Quiet Gràcia loft', submitted: 'Yesterday', status: 'Documents', score: 88, avatar: 'LB' },
  { id: 3, applicant: 'Inês Duarte', property: 'Sunlit Eixample home', submitted: '18 Aug', status: 'Approved', score: 95, avatar: 'ID' },
  { id: 4, applicant: 'Maya Chen', property: 'Poblenou terrace studio', submitted: '16 Aug', status: 'Draft', score: 81, avatar: 'MC' },
]

export const maintenance: MaintenanceRequest[] = [
  { id: 1, title: 'Kitchen tap leaking', property: 'Sunlit Eixample home', tenant: 'Inês Duarte', status: 'New', priority: 'Medium', date: 'Today' },
  { id: 2, title: 'Air conditioning service', property: 'Quiet Gràcia loft', tenant: 'Leo Bernard', status: 'Scheduled', priority: 'Low', date: '22 Aug', provider: 'Clima BCN' },
  { id: 3, title: 'Power outlet not working', property: 'Poblenou terrace studio', tenant: 'Maya Chen', status: 'In progress', priority: 'Urgent', date: '19 Aug', provider: 'Volt & Co.' },
  { id: 4, title: 'Bedroom blind repair', property: 'Sunlit Eixample home', tenant: 'Inês Duarte', status: 'Resolved', priority: 'Low', date: '12 Aug', provider: 'Fixly' },
]

export const providers = [
  { name: 'Volt & Co.', type: 'Electrician', rating: 4.9, jobs: 128, response: '~1 hour', initials: 'V', tone: 'sun' },
  { name: 'Clima BCN', type: 'HVAC specialist', rating: 4.8, jobs: 96, response: '~2 hours', initials: 'C', tone: 'mint' },
  { name: 'Fixly', type: 'General repairs', rating: 4.9, jobs: 213, response: '~45 min', initials: 'F', tone: 'lilac' },
  { name: 'Aigua Pro', type: 'Plumber', rating: 4.7, jobs: 174, response: '~1 hour', initials: 'A', tone: 'blue' },
]

export const conversations = [
  { name: 'Inês Duarte', property: 'Sunlit Eixample home', preview: 'I’ve uploaded the transfer receipt.', time: '09:42', unread: 2, initials: 'ID' },
  { name: 'Leo Bernard', property: 'Quiet Gràcia loft', preview: 'Thursday afternoon works for me.', time: 'Yesterday', unread: 0, initials: 'LB' },
  { name: 'Clima BCN', property: 'Maintenance · #1028', preview: 'Your visit is confirmed for 22 Aug.', time: 'Yesterday', unread: 0, initials: 'CB' },
]
