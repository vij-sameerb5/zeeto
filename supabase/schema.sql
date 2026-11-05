-- Zeeto database (Supabase Postgres). Run once in Supabase → SQL Editor.
-- Rule: the browser never writes here directly. The Zeeto API uses the service key;
-- row level security is ON for every table with no public policies, so the publishable key can't read or write.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create type user_role as enum ('customer', 'merchant', 'admin');
create type order_status as enum ('paying', 'paid', 'accepted', 'ready', 'done', 'refunded', 'part_refunded', 'expired', 'cancelled');
create type listing_kind as enum ('item', 'menu', 'slot', 'service', 'preorder');
create type pay_plan as enum ('full', 'advance_balance', 'deposit_rest');
create type order_gate as enum ('none', 'prescription', 'quote');

create table users (
  id uuid primary key default gen_random_uuid(),
  privy_did text unique not null,
  role user_role not null default 'customer',
  phone text, email text, name text,
  created_at timestamptz not null default now()
);

create table wallets (
  user_id uuid not null references users(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  chain_id int not null default 1874,
  provider text not null default 'privy',
  primary key (user_id, chain_id)
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 2 and 40),
  category text not null,
  tagline text, bio text,
  location geography(point, 4326) not null,
  landmark text, hours text,
  languages text[] not null default '{}',
  wa_phone text,
  payout_address text not null check (payout_address ~ '^0x[0-9a-fA-F]{40}$'),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'suspended')),
  verified boolean not null default false,
  arkiv_entity_key text, arkiv_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index vendors_location_gix on vendors using gist (location);

create table vendor_members (
  vendor_id uuid not null references vendors(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  primary key (vendor_id, user_id)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  kind listing_kind not null default 'item',
  name text not null check (length(name) between 2 and 60),
  local_name text, unit text not null,
  price_inr int not null check (price_inr between 1 and 100000),
  stock numeric not null default 0 check (stock between 0 and 10000),
  needs_prescription boolean not null default false,
  image_url text, by_ai boolean not null default false, active boolean not null default true,
  arkiv_entity_key text,
  updated_at timestamptz not null default now()
);

create table inventory_events (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  delta numeric not null, source text not null check (source in ('app', 'whatsapp', 'ai', 'order')),
  actor uuid references users(id), at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,                       -- short human code, e.g. 1024
  customer_id uuid references users(id),
  vendor_id uuid not null references vendors(id),
  status order_status not null default 'paying',
  plan pay_plan not null default 'full',
  gate order_gate not null default 'none',
  gate_passed_at timestamptz, gate_by uuid references users(id),   -- pharmacist / quote approval
  total_inr int not null check (total_inr between 1 and 20000000),
  fx_inr_per_usd numeric not null,
  pickup_code_hash text,                    -- never store the code itself
  pickup_tries int not null default 0,
  counter boolean not null default false,   -- paid at the counter by QR
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_vendor_idx on orders (vendor_id, created_at desc);

create table order_items (
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null, unit text not null, qty numeric not null check (qty > 0), price_inr int not null
);

-- One row per payment in a plan (advance, balance, ...). order_ref is what the contract sees.
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  part text not null default 'full' check (part in ('full', 'advance', 'balance', 'deposit', 'rest')),
  order_ref text unique not null check (order_ref ~ '^0x[0-9a-f]{64}$'),
  chain_id int not null default 1874,
  token text not null,
  payer text, merchant text not null,
  amount numeric(38, 0) not null check (amount > 0),   -- USDT base units (6 decimals)
  intent_expires_at timestamptz not null,
  tx_hash text unique,
  block_number bigint,
  status text not null default 'intent' check (status in ('intent', 'submitted', 'verified', 'failed', 'expired')),
  verified_at timestamptz
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  amount numeric(38, 0) not null check (amount > 0),
  reason text, tx_hash text unique, status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Counter QR requests (stall rings up, customer scans)
create table pay_requests (
  id text primary key,
  vendor_id uuid not null references vendors(id),
  amount_inr int not null check (amount_inr between 1 and 20000),
  lines jsonb not null default '[]',
  made_by text not null check (made_by in ('stall', 'customer')),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled', 'expired')),
  order_id uuid references orders(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table follows (user_id uuid references users(id) on delete cascade, vendor_id uuid references vendors(id) on delete cascade, primary key (user_id, vendor_id));
create table posts (id uuid primary key default gen_random_uuid(), vendor_id uuid not null references vendors(id) on delete cascade, kind text not null default 'post', body text, media text[] not null default '{}', translations jsonb, ai_run_id uuid, arkiv_entity_key text, created_at timestamptz not null default now());
create table rewards (id bigserial primary key, user_id uuid not null references users(id), order_id uuid references orders(id), points int not null, kind text not null check (kind in ('earn', 'redeem')), at timestamptz not null default now());
create table ai_runs (id uuid primary key default gen_random_uuid(), provider text not null, model text not null, request_id text, input_ref text, output jsonb, latency_ms int, simulated boolean not null default false, created_at timestamptz not null default now());
create table whatsapp_messages (wa_message_id text primary key, from_phone text not null, vendor_id uuid references vendors(id), type text, body text, media_id text, status text not null default 'received', command jsonb, created_at timestamptz not null default now());
-- Prescriptions: private bucket path only, auto-deleted after 30 days by a scheduled job. Never sent to AI or Arkiv.
create table prescriptions (id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade, storage_path text not null, reviewed_by uuid references users(id), decision text check (decision in ('approved', 'rejected')), created_at timestamptz not null default now(), delete_after timestamptz not null default now() + interval '30 days');

-- Nearby stalls for the map
create or replace function nearby_vendors(lat double precision, lng double precision, radius_m int default 1500)
returns setof vendors language sql stable as $$
  select * from vendors
  where status = 'live' and st_dwithin(location, st_makepoint(lng, lat)::geography, radius_m)
  order by location <-> st_makepoint(lng, lat)::geography
$$;

-- Lock everything down: only the API (service key) reads and writes.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
