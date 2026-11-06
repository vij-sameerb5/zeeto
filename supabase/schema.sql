-- Zeeto database (Supabase Postgres). Run once: Supabase dashboard → SQL Editor → paste → Run.
-- Safe to re-run: it only creates what's missing. (If you ran an older version, run supabase/reset.sql first.)
--
-- Rule: the browser never touches these tables. Only the Zeeto API (apps/web/api, server side, with the
-- SUPABASE_SECRET_KEY) reads and writes. Row level security is ON with no policies, so the public key gets nothing.

create table if not exists users (
  privy_id   text primary key,                       -- did:privy:...
  address    text check (address ~ '^0x[0-9a-fA-F]{40}$'),
  label      text,                                   -- masked phone/email, shown to stalls
  phone      text,                                   -- E.164, for WhatsApp messages
  role       text not null default 'customer' check (role in ('customer', 'merchant', 'admin')),
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);

create table if not exists vendors (
  id         text primary key check (id ~ '^[a-z0-9-]{2,48}$'),
  owner_id   text not null references users(privy_id),
  wallet     text not null check (wallet ~ '^0x[0-9a-fA-F]{40}$'),   -- payouts; always the owner's own Privy wallet
  data       jsonb not null,                         -- name, category, location, hours, photos... (validated by the API)
  wa_phone   text,                                   -- stall's WhatsApp, for order alerts
  status     text not null default 'live' check (status in ('live', 'closed', 'suspended')),
  verified   boolean not null default false,
  api_key_hash   text unique,                        -- sha256 of the merchant's secret API key (the key itself is shown once)
  api_key_prefix text,
  webhook_url    text,
  webhook_secret text,                               -- HMAC secret for Zeeto-Signature; server only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vendors_one_per_owner on vendors (owner_id);
create unique index if not exists vendors_wa_phone on vendors (wa_phone) where wa_phone is not null;

create table if not exists products (
  id         text primary key,
  vendor_id  text not null references vendors(id) on delete cascade,
  data       jsonb not null,                         -- name, unit, image, local name...
  price_inr  int not null check (price_inr between 1 and 100000),
  stock      numeric not null default 0 check (stock between 0 and 10000),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists products_vendor on products (vendor_id);

create table if not exists orders (
  id            text primary key,
  vendor_id     text not null references vendors(id),
  customer_id   text not null references users(privy_id),
  customer      text not null,                       -- what the stall sees (masked)
  payer         text not null check (payer ~ '^0x[0-9a-fA-F]{40}$'),
  code          text not null,                       -- spoken pickup code, shown only to the customer and the stall
  lines         jsonb not null,
  inr           int not null check (inr between 1 and 20000),
  usd           numeric(12, 2) not null,
  amount        numeric(38, 0) not null check (amount > 0),   -- USDT base units (6 decimals)
  order_ref     text unique not null check (order_ref ~ '^0x[0-9a-f]{64}$'),  -- EIP-3009 nonce / transfer memo
  status        text not null default 'paying' check (status in ('paying', 'paid', 'accepted', 'ready', 'done', 'refunded', 'part-refunded', 'expired')),
  counter       boolean not null default false,
  request_id    text,
  cancel_asked  boolean not null default false,
  arrived_at    timestamptz,
  payment       jsonb,
  refunds       jsonb not null default '[]',
  tx_hash       text unique,                         -- one transaction can settle one order, never two
  gas_wei       numeric(38, 0),                      -- WBT gas the business's relayer paid for this payment
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_vendor on orders (vendor_id, created_at desc);
create index if not exists orders_customer on orders (customer_id, created_at desc);

create table if not exists pay_requests (
  id         text primary key,
  vendor_id  text not null references vendors(id),
  inr        int not null check (inr between 1 and 20000),
  lines      jsonb not null default '[]',
  made_by    text not null check (made_by in ('stall', 'customer', 'whatsapp', 'api')),
  reference  text,                                   -- the store's own order id (Checkout API)
  success_url text,
  cancel_url  text,
  status     text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  order_id   text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pay_requests_ref on pay_requests (vendor_id, reference);

-- Every transaction the relayer paid gas for: drives the daily limits and the "gas covered" line merchants see.
create table if not exists relay_log (
  id         bigserial primary key,
  kind       text not null check (kind in ('pay', 'refund')),
  order_id   text not null,
  user_id    text not null,
  vendor_id  text not null,
  tx_hash    text not null,
  gas_wei    numeric(38, 0) not null,
  at         timestamptz not null default now()
);
create index if not exists relay_log_at on relay_log (at desc);
create index if not exists relay_log_user on relay_log (user_id, at desc);
create index if not exists relay_log_vendor on relay_log (vendor_id, at desc);

create table if not exists webhook_log (
  id         bigserial primary key,
  vendor_id  text not null,
  event      text not null,
  status     int not null,
  body       text,
  at         timestamptz not null default now()
);

-- WhatsApp: every inbound message id once (Meta retries webhooks), plus what we did with it.
create table if not exists wa_messages (
  id         text primary key,
  from_phone text not null,
  body       text,
  reply      text,
  created_at timestamptz not null default now()
);

create table if not exists ai_runs (
  id         text primary key,
  kind       text not null,
  model      text not null,
  ms         int,
  ok         boolean not null,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
