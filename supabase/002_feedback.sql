-- Phase 2: Feedback clients (WhatsApp Business API). Run f SQL Editor mn b3d schema.sql.
create table feedback_requests (
  id bigserial primary key,
  region region not null,
  sheet_row_id text,
  client_name text,
  phone text not null,              -- format 2126XXXXXXXX
  product text,
  delivery_date date not null,
  status text not null default 'queued',   -- queued | sent | delivered | read | failed | replied
  error text,
  wa_message_id text unique,
  sent_at timestamptz,
  rating int check (rating between 1 and 5),
  comment text,
  sentiment text,                   -- positive | neutral | negative
  ai_summary text,
  needs_followup boolean default false,
  followup_done boolean default false,
  replied_at timestamptz,
  created_at timestamptz default now(),
  unique (phone, delivery_date)
);
create index on feedback_requests (status, delivery_date);

create table feedback_messages (
  id bigserial primary key,
  request_id bigint references feedback_requests on delete cascade,
  phone text not null,
  direction text not null,          -- in | out
  body text,
  wa_message_id text unique,
  created_at timestamptz default now()
);

alter table feedback_requests enable row level security;
alter table feedback_messages enable row level security;
create policy "feedback read" on feedback_requests for select
  using (my_role() in ('admin','supervisor') or my_region() is null or region = my_region());
create policy "feedback followup" on feedback_requests for update
  using (my_role() in ('admin','supervisor')) with check (my_role() in ('admin','supervisor'));
create policy "feedback msgs read" on feedback_messages for select
  using (exists (select 1 from feedback_requests r where r.id = request_id));
