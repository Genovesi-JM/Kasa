import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bath,
  BedDouble,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Heart,
  Home,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Upload,
  Users,
  WalletCards,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { applications, conversations, maintenance, properties, providers } from './data'
import type { Application, MaintenanceRequest, Property, Role, View } from './types'

const formatEuro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

const viewTitles: Record<View, { title: string; eyebrow: string }> = {
  overview: { title: 'Good morning, Olivia', eyebrow: 'Tuesday, 21 August' },
  discover: { title: 'Find a place that feels right', eyebrow: 'DISCOVER' },
  portfolio: { title: 'Your homes, in one place', eyebrow: 'PORTFOLIO' },
  applications: { title: 'Applications', eyebrow: 'WORKFLOW' },
  messages: { title: 'Messages', eyebrow: 'INBOX' },
  rent: { title: 'Rent records', eyebrow: 'RECONCILIATION' },
  maintenance: { title: 'Maintenance', eyebrow: 'COORDINATION' },
  documents: { title: 'Documents', eyebrow: 'RECORDS' },
  services: { title: 'Trusted local help', eyebrow: 'SERVICE DIRECTORY' },
  insights: { title: 'Portfolio insights', eyebrow: 'ANALYTICS' },
  plan: { title: 'Plan & visibility', eyebrow: 'SUBSCRIPTION' },
}

interface NavItem {
  id: View
  label: string
  icon: LucideIcon
  badge?: string
  landlordOnly?: boolean
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'discover', label: 'Discover homes', icon: Search },
  { id: 'portfolio', label: 'My properties', icon: Building2 },
  { id: 'applications', label: 'Applications', icon: FileCheck2, badge: '3' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, badge: '2' },
  { id: 'rent', label: 'Rent records', icon: WalletCards },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, badge: '1' },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'services', label: 'Service providers', icon: Store },
  { id: 'insights', label: 'Insights', icon: BarChart3, landlordOnly: true },
  { id: 'plan', label: 'Plan & visibility', icon: Sparkles, landlordOnly: true },
]

function Avatar({ initials, small = false }: { initials: string; small?: boolean }) {
  return <span className={`avatar ${small ? 'avatar-small' : ''}`}>{initials}</span>
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

function ActionButton({ children, icon: Icon, secondary = false, onClick }: { children: React.ReactNode; icon?: LucideIcon; secondary?: boolean; onClick?: () => void }) {
  return (
    <button className={`button ${secondary ? 'button-secondary' : ''}`} onClick={onClick}>
      {Icon && <Icon size={17} />}
      {children}
    </button>
  )
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={15} /></button>}
    </div>
  )
}

function Metric({ label, value, note, icon: Icon, tone = 'green' }: { label: string; value: string; note: string; icon: LucideIcon; tone?: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}><Icon size={20} /></div>
      <div className="metric-label">{label}</div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  )
}

function PropertyCard({ property, favourite, onFavourite, onOpen }: { property: Property; favourite: boolean; onFavourite: () => void; onOpen: () => void }) {
  return (
    <article className="property-card">
      <div className="property-image-wrap">
        <img src={property.image} alt={property.title} className="property-image" />
        {property.tag && <StatusPill tone={property.tag === 'Promoted' ? 'amber' : 'mint'}>{property.tag}</StatusPill>}
        <button className={`heart-button ${favourite ? 'is-active' : ''}`} onClick={onFavourite} aria-label={favourite ? 'Remove from saved' : 'Save property'}>
          <Heart size={19} fill={favourite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="property-body" onClick={onOpen}>
        <div className="property-price">{formatEuro(property.price)} <span>/ month</span></div>
        <h3>{property.title}</h3>
        <div className="muted property-address"><MapPin size={14} /> {property.address}</div>
        <div className="property-facts">
          <span><BedDouble size={16} /> {property.beds} bed</span>
          <span><Bath size={16} /> {property.baths} bath</span>
          <span>{property.sqm} m²</span>
        </div>
        <div className="property-footer">
          <span>{property.available}</span>
          <strong>{property.match}% match</strong>
        </div>
      </button>
    </article>
  )
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}%</strong><span>{label}</span></div>
    </div>
  )
}

function LandlordOverview({ go, notify }: { go: (view: View) => void; notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="hero-panel landlord-hero">
        <div>
          <span className="eyebrow light">YOUR PORTFOLIO, AT A GLANCE</span>
          <h2>Everything is moving smoothly.</h2>
          <p>Three homes are occupied, one is welcoming applications, and every August rent record is accounted for.</p>
          <button className="button button-cream" onClick={() => go('portfolio')}>View properties <ArrowRight size={17} /></button>
        </div>
        <div className="hero-orbit">
          <ProgressRing value={96} label="occupancy" />
          <span className="orbit-tag orbit-one"><Check size={14} /> Rent checked</span>
          <span className="orbit-tag orbit-two"><Users size={14} /> 4 homes</span>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric label="Monthly rent" value="€6,730" note="Recorded this month" icon={CircleDollarSign} />
        <Metric label="Occupancy" value="96%" note="Up 4% from July" icon={Home} tone="blue" />
        <Metric label="Open applications" value="3" note="2 ready for review" icon={Users} tone="lilac" />
        <Metric label="Maintenance" value="1" note="New request today" icon={Wrench} tone="sun" />
      </section>

      <div className="two-column wide-left">
        <section className="card padded">
          <SectionHeading title="Applications to review" action="View all" onAction={() => go('applications')} />
          <div className="list-stack">
            {applications.slice(0, 3).map((application) => (
              <button className="application-row" key={application.id} onClick={() => go('applications')}>
                <Avatar initials={application.avatar} />
                <span className="row-copy"><strong>{application.applicant}</strong><small>{application.property}</small></span>
                <span className="match-score">{application.score}%</span>
                <StatusPill tone={application.status === 'Approved' ? 'mint' : application.status === 'Documents' ? 'amber' : 'blue'}>{application.status}</StatusPill>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="card padded schedule-card">
          <SectionHeading title="Coming up" />
          <div className="timeline">
            <div className="timeline-item active"><span>22</span><div><strong>AC service visit</strong><small>Quiet Gràcia loft · 14:30</small></div></div>
            <div className="timeline-item"><span>25</span><div><strong>Lease documents due</strong><small>Sunlit Eixample home</small></div></div>
            <div className="timeline-item"><span>01</span><div><strong>September reminders</strong><small>Scheduled automatically</small></div></div>
          </div>
          <button className="soft-button" onClick={() => notify('Calendar view is ready for the connected-calendar phase.')}><CalendarDays size={16} /> Open calendar</button>
        </section>
      </div>

      <section className="card padded">
        <SectionHeading title="Rent reconciliation" action="Open records" onAction={() => go('rent')} />
        <div className="rent-summary">
          <div className="rent-progress-copy"><strong>August</strong><span>4 of 4 direct transfers recorded</span></div>
          <div className="long-progress"><i style={{ width: '100%' }} /></div>
          <strong className="rent-total">€6,730 <CheckCircle2 size={18} /></strong>
        </div>
        <div className="scope-note"><ShieldCheck size={17} /><span>Kasa records proof of direct tenant-to-landlord transfers. Kasa never holds rent or deposits.</span></div>
      </section>
    </div>
  )
}

function TenantOverview({ go, notify }: { go: (view: View) => void; notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="hero-panel tenant-hero">
        <div>
          <span className="eyebrow light">YOUR HOME</span>
          <h2>Morning, Inês. You’re all caught up.</h2>
          <p>Your August transfer is confirmed and the tap repair request has been received.</p>
          <button className="button button-cream" onClick={() => go('rent')}>View rent record <ArrowRight size={17} /></button>
        </div>
        <img src={properties[0].image} alt="Sunlit Eixample home" className="tenant-home-image" />
      </section>
      <section className="metrics-grid tenant-metrics">
        <Metric label="Next rent" value="€1,850" note="Due 1 September" icon={CalendarDays} />
        <Metric label="Application" value="Approved" note="Lease documents ready" icon={FileCheck2} tone="blue" />
        <Metric label="Maintenance" value="Received" note="Kitchen tap · Today" icon={Wrench} tone="sun" />
      </section>
      <div className="two-column">
        <section className="card padded home-card">
          <SectionHeading title="Your home" action="Property details" onAction={() => notify('Property record opened.')} />
          <img src={properties[0].image} alt="Sunlit Eixample home" />
          <div className="home-card-copy"><div><h3>{properties[0].title}</h3><p>{properties[0].address}</p></div><StatusPill tone="mint">Active lease</StatusPill></div>
          <div className="lease-facts"><span><small>Lease started</small><strong>1 July 2026</strong></span><span><small>Renews</small><strong>30 June 2027</strong></span><span><small>Landlord</small><strong>Olivia Martín</strong></span></div>
        </section>
        <section className="card padded next-steps">
          <SectionHeading title="Next steps" />
          <button onClick={() => go('documents')}><span className="check-circle done"><Check size={16} /></span><span><strong>Identity documents</strong><small>Verified 18 June</small></span><ChevronRight size={17} /></button>
          <button onClick={() => go('documents')}><span className="check-circle done"><Check size={16} /></span><span><strong>Lease signed</strong><small>Completed 24 June</small></span><ChevronRight size={17} /></button>
          <button onClick={() => go('maintenance')}><span className="check-circle"><Wrench size={16} /></span><span><strong>Follow tap repair</strong><small>Awaiting provider match</small></span><ChevronRight size={17} /></button>
          <button onClick={() => go('rent')}><span className="check-circle"><CalendarDays size={16} /></span><span><strong>September rent</strong><small>Due in 11 days</small></span><ChevronRight size={17} /></button>
        </section>
      </div>
      <section className="card padded recommendation-strip">
        <div className="recommendation-icon"><Sparkles size={23} /></div><div><strong>Thinking about your next home?</strong><p>Kasa has found 8 homes that match your saved preferences.</p></div><ActionButton secondary onClick={() => go('discover')}>Browse matches</ActionButton>
      </section>
    </div>
  )
}

function Discover({ favourites, toggleFavourite, notify }: { favourites: number[]; toggleFavourite: (id: number) => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState('Any price')
  const filtered = properties.filter((property) => {
    const matchQuery = `${property.title} ${property.address} ${property.city}`.toLowerCase().includes(query.toLowerCase())
    const limit = maxPrice === 'Any price' ? Infinity : Number(maxPrice)
    return matchQuery && property.price <= limit
  })
  return (
    <div className="page-stack">
      <section className="search-panel">
        <div className="search-main"><Search size={20} /><input aria-label="Search by area or address" placeholder="Neighbourhood, city or address" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select aria-label="Maximum rent" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option>Any price</option><option value="1500">Up to €1,500</option><option value="2000">Up to €2,000</option><option value="2500">Up to €2,500</option></select>
        <button className="filter-button" onClick={() => notify('All essential filters are already visible in this MVP.')}><Filter size={18} /> Filters</button>
      </section>
      <div className="results-line"><div><strong>{filtered.length} homes</strong><span> in Barcelona</span></div><button className="sort-button">Best match <ChevronDown size={15} /></button></div>
      <section className="property-grid">
        {filtered.map((property) => <PropertyCard key={property.id} property={property} favourite={favourites.includes(property.id)} onFavourite={() => toggleFavourite(property.id)} onOpen={() => notify(`${property.title} details opened.`)} />)}
      </section>
      {filtered.length === 0 && <div className="empty-state"><Search size={28} /><h3>No homes match those filters</h3><p>Try another area or a higher maximum rent.</p></div>}
    </div>
  )
}

function Portfolio({ notify, go }: { notify: (message: string) => void; go: (view: View) => void }) {
  return (
    <div className="page-stack">
      <div className="page-actions"><div className="segment"><button className="active">All homes <span>4</span></button><button>Occupied <span>3</span></button><button>Available <span>1</span></button></div><ActionButton icon={Plus} onClick={() => notify('New listing workflow opened — owners enter and publish their own property details.')}>Add property</ActionButton></div>
      <section className="portfolio-list">
        {properties.map((property, index) => (
          <article className="portfolio-row" key={property.id}>
            <img src={property.image} alt={property.title} />
            <div className="portfolio-main"><div><h3>{property.title}</h3><p>{property.address}</p></div><div className="occupancy-line"><span>{index === 3 ? 'Available' : 'Occupied'}</span><small>{index === 3 ? 'Accepting applications' : `Tenant · ${['Inês Duarte', 'Leo Bernard', 'Maya Chen'][index]}`}</small></div></div>
            <div className="portfolio-stat"><small>Monthly rent</small><strong>{formatEuro(property.price)}</strong></div>
            <div className="portfolio-stat"><small>Next action</small><strong>{index === 3 ? 'Review listing' : index === 0 ? 'Repair request' : 'All clear'}</strong></div>
            <StatusPill tone={index === 3 ? 'amber' : 'mint'}>{index === 3 ? 'Published' : 'Rent checked'}</StatusPill>
            <button className="icon-button" onClick={() => go(index === 3 ? 'applications' : 'rent')}><ChevronRight size={19} /></button>
          </article>
        ))}
      </section>
    </div>
  )
}

function Applications({ role, notify }: { role: Role; notify: (message: string) => void }) {
  const [tab, setTab] = useState('All')
  const visible = applications.filter((item) => tab === 'All' || item.status === tab)
  return (
    <div className="page-stack">
      <div className="page-actions"><div className="segment compact">{['All', 'Review', 'Documents', 'Approved'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>{role === 'tenant' && <ActionButton icon={Plus} onClick={() => notify('Select a property first to start an application.')}>New application</ActionButton>}</div>
      <section className="card applications-table">
        <div className="table-head"><span>{role === 'landlord' ? 'Applicant' : 'Application'}</span><span>Property</span><span>Submitted</span><span>Profile</span><span>Status</span><span /></div>
        {visible.map((application: Application) => (
          <button className="table-row" key={application.id} onClick={() => notify(`${application.applicant}'s application record opened.`)}>
            <span className="applicant-cell"><Avatar initials={application.avatar} /><strong>{role === 'landlord' ? application.applicant : `Application #10${application.id}`}</strong></span>
            <span>{application.property}</span><span>{application.submitted}</span><span><b className="score-inline">{application.score}%</b> complete</span><span><StatusPill tone={application.status === 'Approved' ? 'mint' : application.status === 'Documents' ? 'amber' : application.status === 'Draft' ? 'neutral' : 'blue'}>{application.status}</StatusPill></span><ChevronRight size={17} />
          </button>
        ))}
      </section>
      <div className="scope-note"><ShieldCheck size={17} /><span>Kasa organizes applications and documents. Landlords and tenants communicate and decide directly; Kasa does not represent or negotiate for either party.</span></div>
    </div>
  )
}

function Messages({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState(0)
  const [draft, setDraft] = useState('')
  const send = () => {
    if (!draft.trim()) return
    notify('Message added to the demo conversation.')
    setDraft('')
  }
  return (
    <section className="messages-layout card">
      <aside className="conversation-list">
        <div className="conversation-search"><Search size={17} /><input placeholder="Search messages" aria-label="Search messages" /></div>
        {conversations.map((conversation, index) => <button key={conversation.name} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><Avatar initials={conversation.initials} /><span><strong>{conversation.name}</strong><small>{conversation.property}</small><p>{conversation.preview}</p></span><time>{conversation.time}</time>{conversation.unread > 0 && <i>{conversation.unread}</i>}</button>)}
      </aside>
      <div className="chat-panel">
        <header><Avatar initials={conversations[selected].initials} /><div><strong>{conversations[selected].name}</strong><small>{conversations[selected].property}</small></div><button className="icon-button"><MoreHorizontal size={20} /></button></header>
        <div className="chat-body">
          <span className="date-divider">Today</span>
          <div className="message received"><p>Hi Olivia, I made the rent transfer directly to your account this morning.</p><time>09:36</time></div>
          <div className="message received attachment"><FileText size={19} /><div><strong>August-transfer.pdf</strong><small>184 KB · PDF</small></div><Download size={17} /></div>
          <div className="message sent"><p>Thanks Inês — I can see the receipt. I’ve marked the August record as confirmed.</p><time>09:41 <CheckCheck /></time></div>
        </div>
        <div className="message-compose"><button className="icon-button" onClick={() => notify('Document picker opened.')}><Paperclip size={20} /></button><input placeholder="Write a message…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} /><button className="send-button" onClick={send} aria-label="Send message"><Send size={18} /></button></div>
      </div>
    </section>
  )
}

function CheckCheck() { return <span className="double-check">✓✓</span> }

function Rent({ role, notify }: { role: Role; notify: (message: string) => void }) {
  const records = [
    { month: 'August 2026', tenant: 'Inês Duarte', property: 'Sunlit Eixample home', amount: 1850, date: '1 Aug', status: 'Confirmed' },
    { month: 'August 2026', tenant: 'Leo Bernard', property: 'Quiet Gràcia loft', amount: 1420, date: '2 Aug', status: 'Confirmed' },
    { month: 'August 2026', tenant: 'Maya Chen', property: 'Poblenou terrace studio', amount: 1280, date: '1 Aug', status: 'Confirmed' },
    { month: 'August 2026', tenant: 'Noah Vidal', property: 'Sant Antoni family flat', amount: 2180, date: '3 Aug', status: 'Confirmed' },
  ]
  return (
    <div className="page-stack">
      <section className="rent-banner"><div className="rent-banner-icon"><ShieldCheck /></div><div><strong>Direct payments, clear records</strong><p>Tenants pay landlords directly. Kasa sends reminders and keeps proof and reconciliation together — it never receives or forwards funds.</p></div>{role === 'tenant' && <ActionButton icon={Upload} onClick={() => notify('Proof-of-transfer upload opened.')}>Upload proof</ActionButton>}</section>
      <section className="metrics-grid tenant-metrics">
        <Metric label={role === 'landlord' ? 'Recorded in August' : 'August rent'} value={role === 'landlord' ? '€6,730' : '€1,850'} note="All direct transfers checked" icon={CheckCircle2} />
        <Metric label="Next reminder" value="28 Aug" note="For September rent" icon={Bell} tone="blue" />
        <Metric label="Missing proof" value="0" note="Nothing needs attention" icon={FileCheck2} tone="lilac" />
      </section>
      <section className="card rent-table-card">
        <div className="table-card-title"><div><h2>Payment records</h2><p>Proof matched to direct bank transfers</p></div><button className="soft-button" onClick={() => notify('Rent records exported as a reconciliation report.')}><Download size={16} /> Export</button></div>
        <div className="rent-record-head"><span>Period</span>{role === 'landlord' && <span>Tenant</span>}<span>Property</span><span>Amount</span><span>Transferred</span><span>Status</span></div>
        {records.slice(0, role === 'tenant' ? 1 : records.length).map((record, index) => <div className="rent-record" key={record.tenant}><span><strong>{record.month}</strong><small>Receipt #AUG-{1024 + index}</small></span>{role === 'landlord' && <span>{record.tenant}</span>}<span>{record.property}</span><strong>{formatEuro(record.amount)}</strong><span>{record.date}</span><StatusPill tone="mint"><Check size={13} /> {record.status}</StatusPill></div>)}
      </section>
    </div>
  )
}

function Maintenance({ role, notify }: { role: Role; notify: (message: string) => void }) {
  const columns: MaintenanceRequest['status'][] = ['New', 'Scheduled', 'In progress', 'Resolved']
  return (
    <div className="page-stack">
      <div className="page-actions"><div className="segment compact"><button className="active">Board</button><button>List</button></div><ActionButton icon={Plus} onClick={() => notify(role === 'tenant' ? 'New maintenance request opened.' : 'Maintenance record opened.')}>{role === 'tenant' ? 'Report an issue' : 'Add request'}</ActionButton></div>
      <section className="maintenance-board">
        {columns.map((column) => <div className="maintenance-column" key={column}><header><span>{column}</span><i>{maintenance.filter((item) => item.status === column).length}</i></header>{maintenance.filter((item) => item.status === column).map((request) => <article className="maintenance-ticket" key={request.id} onClick={() => notify(`${request.title} opened.`)}><div className="ticket-top"><StatusPill tone={request.priority === 'Urgent' ? 'red' : request.priority === 'Medium' ? 'amber' : 'neutral'}>{request.priority}</StatusPill><button className="icon-button"><MoreHorizontal size={17} /></button></div><h3>{request.title}</h3><p>{request.property}</p><div className="ticket-meta"><span><CalendarDays size={14} /> {request.date}</span><span><Avatar initials={request.tenant.split(' ').map((part) => part[0]).join('')} small /> {request.tenant}</span></div>{request.provider && <div className="provider-assigned"><Wrench size={14} /> {request.provider}</div>}</article>)}</div>)}
      </section>
      <div className="scope-note"><LifeBuoy size={17} /><span>Kasa helps people log, communicate and coordinate repairs. Service providers are selected and engaged directly by users.</span></div>
    </div>
  )
}

function Documents({ role, notify }: { role: Role; notify: (message: string) => void }) {
  const groups = [
    { title: 'Lease & property', files: [{ name: 'Residential lease agreement', type: 'PDF · 2.4 MB', date: 'Signed 24 Jun', status: 'Signed' }, { name: 'Move-in condition report', type: 'PDF · 8.1 MB', date: 'Added 1 Jul', status: 'Complete' }] },
    { title: role === 'landlord' ? 'Tenant records' : 'My records', files: [{ name: 'Identity verification', type: 'Verified record', date: 'Checked 18 Jun', status: 'Verified' }, { name: 'Income documentation', type: 'PDF · 920 KB', date: 'Added 18 Jun', status: 'Private' }] },
    { title: 'Rent & maintenance', files: [{ name: 'August transfer receipt', type: 'PDF · 184 KB', date: 'Added 1 Aug', status: 'Confirmed' }, { name: 'AC service report', type: 'PDF · 612 KB', date: 'Due 22 Aug', status: 'Pending' }] },
  ]
  return (
    <div className="page-stack">
      <div className="page-actions"><div className="document-summary"><div><FileCheck2 size={18} /><span><strong>8 verified</strong><small>Up to date</small></span></div><div><Clock3 size={18} /><span><strong>1 pending</strong><small>Service report</small></span></div></div><ActionButton icon={Upload} onClick={() => notify('Secure document upload opened.')}>Upload document</ActionButton></div>
      {groups.map((group) => <section className="card document-group" key={group.title}><SectionHeading title={group.title} />{group.files.map((file) => <button className="document-row" key={file.name} onClick={() => notify(`${file.name} opened.`)}><span className="document-icon"><FileText size={20} /></span><span className="row-copy"><strong>{file.name}</strong><small>{file.type}</small></span><span className="document-date">{file.date}</span><StatusPill tone={file.status === 'Pending' ? 'amber' : file.status === 'Private' ? 'neutral' : 'mint'}>{file.status}</StatusPill><Download size={17} /></button>)}</section>)}
      <div className="scope-note"><ShieldCheck size={17} /><span>Demo assumption: files will use encrypted object storage and role-based access. Identity and income documents remain private to authorized participants.</span></div>
    </div>
  )
}

function Services({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="service-search"><div><Search size={20} /><input placeholder="What do you need help with?" aria-label="Search service providers" /></div><select aria-label="Service location"><option>Barcelona</option></select><ActionButton onClick={() => notify('Matching trusted providers…')}>Search</ActionButton></section>
      <div className="category-row">{[['Zap', Zap], ['Plumbing', Wrench], ['General repairs', Settings], ['Cleaning', Sparkles]].map(([label, Icon]) => { const C = Icon as LucideIcon; return <button key={label as string} onClick={() => notify(`${label} providers filtered.`)}><C size={19} /> {label as string}</button> })}</div>
      <SectionHeading title="Top-rated near your properties" />
      <section className="provider-grid">{providers.map((provider) => <article className="provider-card" key={provider.name}><div className={`provider-logo ${provider.tone}`}>{provider.initials}</div><div><StatusPill tone="mint">Verified profile</StatusPill><h3>{provider.name}</h3><p>{provider.type}</p></div><div className="provider-rating"><Star size={16} fill="currentColor" /> <strong>{provider.rating}</strong><span>({provider.jobs} jobs)</span></div><div className="provider-response"><Clock3 size={15} /> Usually responds {provider.response}</div><ActionButton secondary onClick={() => notify(`Quote request to ${provider.name} opened. You remain in control of the engagement.`)}>Request a quote</ActionButton></article>)}</section>
      <div className="scope-note"><Store size={17} /><span>Kasa is a directory and coordination layer. Providers set their own prices and users contract with them directly.</span></div>
    </div>
  )
}

function Insights() {
  const bars = [72, 84, 78, 90, 92, 96, 96, 96]
  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <Metric label="Portfolio value tracked" value="€1.42m" note="4 property records" icon={Building2} />
        <Metric label="Gross monthly rent" value="€6,730" note="Across occupied homes" icon={CircleDollarSign} tone="blue" />
        <Metric label="Average occupancy" value="96%" note="Last 12 months" icon={Users} tone="lilac" />
        <Metric label="Response time" value="2.1h" note="Maintenance average" icon={Clock3} tone="sun" />
      </section>
      <div className="two-column wide-left">
        <section className="card padded chart-card"><div className="chart-title"><div><h2>Occupancy trend</h2><p>Across all property records</p></div><select><option>Last 8 months</option></select></div><div className="bar-chart"><div className="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="bars">{bars.map((bar, index) => <div className="bar-column" key={index}><i style={{ height: `${bar}%` }}><b>{bar}%</b></i><span>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][index]}</span></div>)}</div></div></section>
        <section className="card padded health-card"><SectionHeading title="Portfolio health" /><div className="health-score"><ProgressRing value={92} label="healthy" /></div><div className="health-item"><CheckCircle2 size={17} /><span><strong>Rent records</strong><small>100% reconciled</small></span></div><div className="health-item"><CheckCircle2 size={17} /><span><strong>Documents</strong><small>All required files present</small></span></div><div className="health-item warning"><Clock3 size={17} /><span><strong>Maintenance</strong><small>1 new request</small></span></div></section>
      </div>
      <section className="card padded"><SectionHeading title="Property performance" /><div className="performance-table"><div><span>Property</span><span>Occupancy</span><span>Monthly rent</span><span>Open items</span></div>{properties.map((property, index) => <div key={property.id}><span><img src={property.image} alt="" /><strong>{property.title}</strong></span><span>{index === 3 ? '87%' : '100%'}</span><span>{formatEuro(property.price)}</span><span>{index === 0 ? '1 maintenance' : index === 3 ? '3 applications' : 'All clear'}</span></div>)}</div></section>
    </div>
  )
}

function Plan({ notify }: { notify: (message: string) => void }) {
  return (
    <div className="page-stack">
      <section className="plan-hero"><div><span className="eyebrow light">KASA GROW</span><h2>Clear tools. Predictable price.</h2><p>Operate up to 10 homes, add team access, and give selected listings extra visibility. No transaction commissions.</p><div className="plan-price"><strong>€29</strong><span>/ month<br />billed monthly</span></div><ActionButton onClick={() => notify('Subscription checkout is intentionally a future integration; no payment data was collected.')}>Choose Grow</ActionButton></div><div className="plan-list"><h3>Everything in Core, plus</h3>{['Up to 10 property records', 'Unlimited applications and messages', 'Advanced portfolio analytics', 'Automated rent reminders', 'Two promoted-listing credits monthly', 'Priority support'].map((item) => <span key={item}><Check size={16} /> {item}</span>)}</div></section>
      <div className="two-column">
        <section className="card padded"><SectionHeading title="Current plan" /><div className="current-plan"><span className="plan-badge">CORE</span><div><strong>€0 / month</strong><p>2 property records · Essential workflows</p></div><StatusPill tone="mint">Active</StatusPill></div><div className="usage"><div><span>Property records</span><strong>2 of 2</strong></div><div className="long-progress"><i style={{ width: '100%' }} /></div></div></section>
        <section className="card padded visibility-card"><div className="visibility-icon"><Sparkles size={22} /></div><div><h3>Promoted visibility</h3><p>Flat-fee placement that increases listing discovery. It never depends on a lease closing.</p></div><button className="soft-button" onClick={() => notify('Promotion setup opened for an owner-published listing.')}>Promote a listing <ArrowRight size={15} /></button></section>
      </div>
      <div className="scope-note"><ShieldCheck size={17} /><span>Kasa subscriptions and promoted placements are fixed-price software services — never brokerage or success-based commissions.</span></div>
    </div>
  )
}

function App() {
  const [role, setRole] = useState<Role>('landlord')
  const [view, setView] = useState<View>('overview')
  const [favourites, setFavourites] = useState<number[]>([2])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState('')

  const visibleNav = useMemo(() => navItems.filter((item) => role === 'landlord' || !item.landlordOnly), [role])
  const titles = viewTitles[view]

  const go = (next: View) => {
    setView(next)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }
  const switchRole = () => {
    setRole((current) => current === 'landlord' ? 'tenant' : 'landlord')
    if (view === 'insights' || view === 'plan') setView('overview')
    notify(`Switched to ${role === 'landlord' ? 'tenant' : 'landlord'} demo.`)
  }
  const toggleFavourite = (id: number) => {
    setFavourites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const renderView = () => {
    switch (view) {
      case 'overview': return role === 'landlord' ? <LandlordOverview go={go} notify={notify} /> : <TenantOverview go={go} notify={notify} />
      case 'discover': return <Discover favourites={favourites} toggleFavourite={toggleFavourite} notify={notify} />
      case 'portfolio': return <Portfolio notify={notify} go={go} />
      case 'applications': return <Applications role={role} notify={notify} />
      case 'messages': return <Messages notify={notify} />
      case 'rent': return <Rent role={role} notify={notify} />
      case 'maintenance': return <Maintenance role={role} notify={notify} />
      case 'documents': return <Documents role={role} notify={notify} />
      case 'services': return <Services notify={notify} />
      case 'insights': return <Insights />
      case 'plan': return <Plan notify={notify} />
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="brand" onClick={() => go('overview')}><span className="brand-mark"><Home size={20} /></span><strong>Kasa</strong></div>
        <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button>
        <button className="workspace-switcher" onClick={switchRole}><Avatar initials={role === 'landlord' ? 'OM' : 'ID'} /><span><small>Demo workspace</small><strong>{role === 'landlord' ? 'Olivia · Landlord' : 'Inês · Tenant'}</strong></span><ChevronDown size={16} /></button>
        <nav>
          <span className="nav-label">WORKSPACE</span>
          {visibleNav.slice(0, 9).map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon size={18} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}</button> })}
          {role === 'landlord' && <><span className="nav-label nav-label-spaced">GROW</span>{visibleNav.slice(9).map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon size={18} /><span>{item.label}</span></button> })}</>}
        </nav>
        <div className="sidebar-footer"><button onClick={() => notify('Help centre opened.')}><LifeBuoy size={18} /> Help & support</button><button onClick={() => notify('Settings opened.')}><Settings size={18} /> Settings</button><div className="scope-chip"><ShieldCheck size={15} /> Non-brokerage platform</div></div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="page-title"><span className="eyebrow">{view === 'overview' ? (role === 'landlord' ? titles.eyebrow : 'YOUR KASA') : titles.eyebrow}</span><h1>{view === 'overview' && role === 'tenant' ? 'Good morning, Inês' : titles.title}</h1></div>
          <div className="topbar-actions"><button className="top-search" onClick={() => go('discover')}><Search size={17} /><span>Search</span><kbd>⌘ K</kbd></button><button className="notification-button" onClick={() => notify('You have 2 unread updates.')}><Bell size={20} /><i /></button><button className="profile-button" onClick={switchRole}><Avatar initials={role === 'landlord' ? 'OM' : 'ID'} /><span><strong>{role === 'landlord' ? 'Olivia Martín' : 'Inês Duarte'}</strong><small>{role === 'landlord' ? 'Landlord workspace' : 'Tenant workspace'}</small></span><ChevronDown size={16} /></button></div>
        </header>
        <div className="content">{renderView()}</div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

export default App
