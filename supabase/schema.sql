-- Audit Check — schéma Supabase. Colle had l-fichier f Supabase → SQL Editor → Run.

create type user_role as enum ('admin', 'supervisor', 'staff');
create type region as enum ('casablanca', 'rabat');

-- Les utilisateurs (mrbotin b auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role user_role not null default 'staff',
  region region,                     -- staff: kaychouf ghir region dyalo. null = ga3 les régions
  created_at timestamptz default now()
);

-- Les commandes li tsiftou f groupes Casablanca / Rabat
create table group_orders (
  id bigserial primary key,
  wa_message_id text unique not null,
  region region not null,
  posted_by text,
  posted_at timestamptz not null,
  raw_text text not null,
  client_name text,
  phone text,
  product text,
  quantity text,
  address text,
  city text,
  delivery_date date,
  delivery_time text,
  delivery_fee numeric,
  amount numeric,
  ai_notes text
);
create index on group_orders (region, delivery_date);
create index on group_orders (phone);

-- Les reçus de virement (groupe virements)
create table receipts (
  id bigserial primary key,
  wa_message_id text unique not null,
  posted_by text,
  posted_phone text,
  posted_at timestamptz not null,
  raw_text text,
  image_path text,                   -- f Storage bucket "receipts"
  amount numeric,
  transfer_date date,
  sender_name text,
  bank text,
  reference text,
  order_ref text,
  ai_notes text
);

-- Les opérations li dakhlin l-bank (mn screenshot)
create table bank_transactions (
  id bigserial primary key,
  tx_date date,
  amount numeric not null,
  label text not null,
  screenshot_path text,
  uploaded_by uuid references profiles,
  created_at timestamptz default now(),
  unique (tx_date, amount, label)
);

-- Validation manuelle (supervisor/admin kay-valider chi cas ⚠️)
create table resolutions (
  id bigserial primary key,
  kind text not null,                -- 'order' | 'receipt'
  item_key text not null,            -- id dyal l-élément
  status text not null,              -- 'ok' | 'problem'
  note text,
  resolved_by uuid references profiles,
  created_at timestamptz default now(),
  unique (kind, item_key)
);

-- ---------- Sécurité (RLS) ----------
alter table profiles enable row level security;
alter table group_orders enable row level security;
alter table receipts enable row level security;
alter table bank_transactions enable row level security;
alter table resolutions enable row level security;

create or replace function my_role() returns user_role language sql stable security definer set search_path = public as
  $$ select role from profiles where id = auth.uid() $$;
create or replace function my_region() returns region language sql stable security definer set search_path = public as
  $$ select region from profiles where id = auth.uid() $$;

create policy "self or admin read" on profiles for select using (id = auth.uid() or my_role() in ('admin','supervisor'));
create policy "admin write" on profiles for all using (my_role() = 'admin') with check (my_role() = 'admin');

create policy "orders by region" on group_orders for select
  using (my_role() in ('admin','supervisor') or my_region() is null or region = my_region());

-- Virements: ghir admin w supervisor
create policy "receipts read" on receipts for select using (my_role() in ('admin','supervisor'));
create policy "bank read" on bank_transactions for select using (my_role() in ('admin','supervisor'));
create policy "bank insert" on bank_transactions for insert with check (my_role() in ('admin','supervisor'));

create policy "resolutions read" on resolutions for select using (auth.uid() is not null);
create policy "resolutions write" on resolutions for all
  using (my_role() in ('admin','supervisor')) with check (my_role() in ('admin','supervisor'));

-- Storage: bucket privé l les tsawer
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy "receipts images read" on storage.objects for select
  using (bucket_id = 'receipts' and my_role() in ('admin','supervisor'));

-- Awwel admin: mn b3d ma tcreé compte dyalk f Authentication → Users, dir:
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'EMAIL_DYALK');
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
