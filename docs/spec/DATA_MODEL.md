# STREETLAYER — Data Model

Source of truth for shapes: `packages/core/src/types.ts`. This file explains where each entity lives, who writes it and how it's queried.

## 1. Where data lives

| Entity | Store | Written by | Why there |
|---|---|---|---|
| Vendor | Postgres (PostGIS `geography(Point)`) | Vendor onboarding | Geo queries ("stalls within 1 km") |
| Product | Postgres | Vendor, AI (after vendor confirms) | Frequent price/stock edits; no need for chain |
| Announcement | Postgres (+ optional Arkiv, expiring entity) | Vendor / AI | Expires naturally → good Arkiv fit if we take that track |
| Follow | Postgres | Customer | Drives alert fan-out |
| Order | Postgres | Customer creates; API updates status | Status machine; links to tx |
| Payment | **Chain** (Whitechain / Unichain) + mirrored row in Postgres | Customer wallet → contract; API mirrors after verifying | Verifiable receipt |
| Refund | **Chain** + mirror | Vendor wallet → contract | Customer can verify |
| RewardEntry | Postgres ledger (append-only) | API only | Non-transferable points; not a token |
| AiRun | Postgres | API | Request IDs for 0G judging + debugging |
| Customer | Postgres + Privy user id | Sign-in | Wallet address from Privy |

Nothing personal goes onchain except wallet addresses and amounts.

## 2. Order status machine

```
pending ──pay──▶ paying ──verified──▶ paid ──packed──▶ ready ──code match──▶ completed
   │                 │                  │                │
   └─timeout─▶ cancelled                └──refund (full)─┴──▶ refunded
                                        └──refund (part)────▶ partially-refunded
```
- `paid` is set only by the API after reading the chain.
- `completed` requires the pickup code (`AB-123`) or QR match.
- Points are issued on `paid` (demo) → on `completed` (production, to avoid refund abuse).

## 3. Postgres schema (draft, written at hackathon)

```sql
create extension if not exists postgis;

create table vendors (
  id text primary key,
  name text not null,
  owner_name text not null,
  category text not null,
  tagline text,
  location geography(point, 4326) not null,
  landmark text, market text, hours text,
  wallet text not null,                -- 0x… receiving address
  accepts text[] not null,             -- {'streetpay-usdt','uniswap-usdc'}
  languages text[] default '{}',
  verified boolean default false,
  created_at timestamptz default now()
);
create index on vendors using gist (location);

create table products (
  id text primary key,
  vendor_id text references vendors(id),
  name text not null, name_local text,
  unit text not null, price_inr int not null check (price_inr > 0),
  stock int not null default 0,
  emoji text, fresh_until timestamptz,
  created_by text default 'vendor'      -- 'vendor' | 'ai'
);

create table follows (
  customer_id text, vendor_id text references vendors(id),
  notify_fresh boolean default true, created_at timestamptz default now(),
  primary key (customer_id, vendor_id)
);

create table orders (
  id text primary key,
  pickup_code text not null,
  customer_id text not null, vendor_id text references vendors(id),
  lines jsonb not null, total_inr int not null, total_usd numeric(12,2) not null,
  status text not null default 'pending',
  route text, chain_id int, tx_hash text unique, quote_id text,
  created_at timestamptz default now(), paid_at timestamptz
);
create index on orders (vendor_id, status);

create table refunds (
  id bigserial primary key, order_id text references orders(id),
  amount numeric(12,2), token text, reason text, tx_hash text unique, at timestamptz default now()
);

create table announcements (
  id text primary key, vendor_id text references vendors(id),
  title text, body text, translations jsonb, product_ids text[],
  source text, ai_request_id text, created_at timestamptz default now(), expires_at timestamptz
);

create table rewards (
  id bigserial primary key, customer_id text not null, vendor_id text,
  points int not null, reason text not null, label text, order_id text, at timestamptz default now()
);

create table ai_runs (
  id text primary key, kind text, model text, request_id text, latency_ms int, at timestamptz default now()
);
```

## 4. Key queries
- Stalls near me: `select … from vendors where st_dwithin(location, st_point($lng,$lat)::geography, 1500) order by location <-> st_point($lng,$lat)::geography`
- Feed: announcements where `vendor_id in (select vendor_id from follows where customer_id=$1) and expires_at > now()` order by `created_at desc`
- Vendor queue: orders where `vendor_id=$1 and status in ('paid','ready')`
- Points balance: `sum(points) from rewards where customer_id=$1`

## 5. Money rules
- Prices are stored in INR (what vendors think in). Settlement amounts are USD stablecoins at the order's locked FX rate (`total_usd`). Demo rate in `DEMO_FX` (84 INR/USD).
- Amounts onchain use token decimals (USDT/USDC 6). Convert at the API edge only.
- 1 point per ₹10 (`pointsForInr`).

## 6. Demo data
`packages/core/src/mock/data.ts`: 12 fictional vendors around Kalbadevi / Zaveri Bazaar, 31 products, 5 announcements, past orders and a vendor inbox. All names are invented. Replace with consenting pilot vendors after field visits.
