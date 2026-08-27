-- Kasa vendor-neutral PostgreSQL starting schema.
-- Review identity claims, retention, encryption and country requirements before use.
create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  locale text not null default 'pt',
  status text not null default 'active' check (status in ('active', 'restricted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('tenant', 'landlord', 'service_provider', 'space_operator', 'admin')),
  country_code text not null,
  created_by uuid not null references accounts(id),
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null,
  permissions jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, account_id)
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  property_type text not null,
  address jsonb not null,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  bedrooms smallint,
  bathrooms numeric(4,1),
  area_m2 numeric(10,2),
  amenities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create table property_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  intent text not null check (intent in ('rent', 'buy')),
  title text not null,
  description text not null,
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null,
  furnishing text,
  pet_policy text check (pet_policy in ('allowed', 'not_allowed', 'case_by_case')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'paused', 'rejected', 'closed')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references property_listings(id),
  applicant_account_id uuid not null references accounts(id),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'reviewing', 'accepted', 'declined', 'withdrawn')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table tenancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  landlord_workspace_id uuid not null references workspaces(id),
  tenant_account_id uuid not null references accounts(id),
  starts_on date not null,
  ends_on date,
  rent_minor bigint not null check (rent_minor >= 0),
  currency char(3) not null,
  status text not null check (status in ('pending', 'active', 'ended'))
);

create table rent_records (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references tenancies(id),
  period_start date not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  transfer_reference text,
  proof_document_id uuid,
  tenant_recorded_at timestamptz,
  landlord_confirmed_at timestamptz,
  status text not null default 'due' check (status in ('due', 'proof_submitted', 'confirmed', 'disputed')),
  unique (tenancy_id, period_start)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('listing', 'application', 'tenancy', 'maintenance', 'service_job', 'space_reservation', 'support')),
  context_id uuid not null,
  created_at timestamptz not null default now()
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  joined_at timestamptz not null default now(),
  blocked_at timestamptz,
  primary key (conversation_id, account_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_account_id uuid not null references accounts(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  tenancy_id uuid references tenancies(id),
  opened_by uuid not null references accounts(id),
  title text not null,
  description text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'acknowledged', 'scheduled', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table service_providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id),
  business_name text not null,
  service_areas jsonb not null default '[]'::jsonb,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table service_offers (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references service_providers(id),
  category text not null check (category in ('cleaning', 'plumbing', 'electrical', 'air_conditioning', 'handyman')),
  title text not null,
  pricing_mode text not null check (pricing_mode in ('fixed', 'quote')),
  price_minor bigint,
  currency char(3),
  active boolean not null default true
);

create table service_jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references service_offers(id),
  customer_account_id uuid not null references accounts(id),
  property_id uuid references properties(id),
  status text not null default 'requested' check (status in ('requested', 'quoted', 'accepted', 'scheduled', 'in_progress', 'completed', 'cancelled', 'disputed')),
  agreed_amount_minor bigint,
  currency char(3),
  external_payment_provider text,
  external_merchant_reference text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  category text not null check (category in ('sports', 'events')),
  description text not null,
  address jsonb not null,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  amenities jsonb not null default '[]'::jsonb,
  booking_mode text not null default 'request' check (booking_mode in ('instant', 'request')),
  verification_status text not null default 'unverified',
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'paused', 'rejected')),
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create table venue_spaces (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  space_type text not null,
  capacity integer check (capacity > 0),
  minimum_minutes integer not null default 60 check (minimum_minutes > 0),
  version integer not null default 1,
  active boolean not null default true
);

create table venue_availability_rules (
  id uuid primary key default gen_random_uuid(),
  venue_space_id uuid not null references venue_spaces(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null,
  valid_from date,
  valid_until date,
  check (closes_at > opens_at)
);

create table venue_time_blocks (
  id uuid primary key default gen_random_uuid(),
  venue_space_id uuid not null references venue_spaces(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

create table space_reservations (
  id uuid primary key default gen_random_uuid(),
  venue_space_id uuid not null references venue_spaces(id),
  customer_account_id uuid not null references accounts(id),
  requested_starts_at timestamptz not null,
  requested_ends_at timestamptz not null,
  operator_proposed_starts_at timestamptz,
  operator_proposed_ends_at timestamptz,
  proposal_accepted_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'proposed_change', 'accepted', 'awaiting_external_payment', 'confirmed', 'completed', 'declined', 'cancelled', 'disputed')),
  amount_minor bigint,
  currency char(3),
  external_payment_provider text,
  external_merchant_reference text,
  external_payment_status text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  check (requested_ends_at > requested_starts_at)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references accounts(id),
  workspace_id uuid references workspaces(id),
  object_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 25000000),
  malware_status text not null default 'pending' check (malware_status in ('pending', 'clean', 'rejected')),
  created_at timestamptz not null default now()
);

alter table rent_records
  add constraint rent_records_proof_fk foreign key (proof_document_id) references documents(id);

create table verification_checks (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  check_type text not null,
  status text not null check (status in ('pending', 'verified', 'failed', 'expired')),
  provider_reference text,
  checked_at timestamptz,
  expires_at timestamptz
);

create table feature_flags (
  key text not null,
  country_code text not null,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  primary key (key, country_code)
);

create table audit_events (
  id bigint generated always as identity primary key,
  actor_account_id uuid references accounts(id),
  workspace_id uuid references workspaces(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index listings_search_idx on property_listings (intent, status, price_minor);
create index messages_conversation_idx on messages (conversation_id, created_at);
create index maintenance_property_idx on maintenance_requests (property_id, status);
create index reservation_schedule_idx on space_reservations (venue_space_id, requested_starts_at, requested_ends_at);
create index audit_workspace_idx on audit_events (workspace_id, created_at desc);

-- Example row-security baseline. The API must set app.account_id inside each transaction.
alter table workspace_members enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;

create policy workspace_members_self on workspace_members
  using (account_id = nullif(current_setting('app.account_id', true), '')::uuid);

create policy conversation_members_read_messages on messages
  using (exists (
    select 1 from conversation_members member
    where member.conversation_id = messages.conversation_id
      and member.account_id = nullif(current_setting('app.account_id', true), '')::uuid
      and member.blocked_at is null
  ));

create policy document_owner_read on documents
  using (owner_account_id = nullif(current_setting('app.account_id', true), '')::uuid);
