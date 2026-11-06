-- Drops every Zeeto table so schema.sql can recreate them. DELETES ALL DATA. Only for test projects.
drop table if exists wa_messages, ai_runs, webhook_log, relay_log, pay_requests, orders, products, vendors, users cascade;
-- Tables from the very first draft of the schema, if you ran it:
drop table if exists wallets, vendor_members, inventory_events, order_items, payments, refunds, follows, posts, rewards, whatsapp_messages, prescriptions cascade;
drop function if exists nearby_vendors(double precision, double precision, int);
drop type if exists user_role, order_status, listing_kind, pay_plan, order_gate cascade;
