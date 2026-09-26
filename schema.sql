-- FabLab — schéma complet (PostgreSQL / Supabase)
-- Coller ce fichier dans : Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('eleve', 'fabmanager');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.machine_status as enum ('disponible', 'panne', 'maintenance');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reservation_status as enum ('en_attente', 'confirmee', 'refusee', 'annulee');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role public.user_role not null default 'eleve',
  created_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  safety_rules text not null default '',
  status public.machine_status not null default 'disponible',
  level_required text not null default 'débutant',
  max_duration_minutes integer not null default 60 check (max_duration_minutes > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  machine_id uuid not null references public.machines (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.reservation_status not null default 'en_attente',
  goal text not null,
  refusal_reason text,
  created_at timestamptz not null default now(),
  constraint valid_interval check (end_time > start_time)
);

-- Empêche deux réservations actives qui se chevauchent sur la même machine
alter table public.reservations drop constraint if exists reservations_no_overlap;
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    machine_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status in ('en_attente', 'confirmee'));

create index if not exists reservations_machine_time_idx on public.reservations (machine_id, start_time);
create index if not exists reservations_user_idx on public.reservations (user_id);

-- ---------------------------------------------------------------------------
-- Profil automatique à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Prénom'),
    coalesce(new.raw_user_meta_data->>'last_name', 'Nom'),
    'eleve'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.reservations enable row level security;

create or replace function public.is_fabmanager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'fabmanager'
  );
$$;

-- profiles
drop policy if exists "profiles_select_own_or_manager" on public.profiles;
create policy "profiles_select_own_or_manager"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_fabmanager());

-- Pas de UPDATE profil côté client (le rôle ne se change que dans le dashboard SQL)

grant execute on function public.is_fabmanager() to authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;

-- machines : lecture publique, écriture FabManager
drop policy if exists "machines_select_all" on public.machines;
create policy "machines_select_all"
  on public.machines for select
  to anon, authenticated
  using (true);

drop policy if exists "machines_insert_manager" on public.machines;
create policy "machines_insert_manager"
  on public.machines for insert
  to authenticated
  with check (public.is_fabmanager());

drop policy if exists "machines_update_manager" on public.machines;
create policy "machines_update_manager"
  on public.machines for update
  to authenticated
  using (public.is_fabmanager())
  with check (public.is_fabmanager());

drop policy if exists "machines_delete_manager" on public.machines;
create policy "machines_delete_manager"
  on public.machines for delete
  to authenticated
  using (public.is_fabmanager());

-- reservations : chacun voit les siennes, FabManager voit tout
drop policy if exists "reservations_select" on public.reservations;
create policy "reservations_select"
  on public.reservations for select
  to authenticated
  using (user_id = auth.uid() or public.is_fabmanager());

-- Vue des créneaux occupés (sans user_id) pour le calendrier public
create or replace view public.reservation_slots
with (security_invoker = false)
as
select id, machine_id, start_time, end_time, status
from public.reservations
where status in ('en_attente', 'confirmee');

grant usage on schema public to anon, authenticated;
grant select on public.machines to anon, authenticated;
grant select, insert, update, delete on public.machines to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant select on public.profiles to authenticated;
grant select on public.reservation_slots to anon, authenticated;

drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own"
  on public.reservations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'en_attente'
  );

drop policy if exists "reservations_update_own_cancel" on public.reservations;
create policy "reservations_update_own_cancel"
  on public.reservations for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('en_attente', 'confirmee')
    and start_time > now()
  )
  with check (
    user_id = auth.uid()
    and status = 'annulee'
  );

drop policy if exists "reservations_update_manager" on public.reservations;
create policy "reservations_update_manager"
  on public.reservations for update
  to authenticated
  using (public.is_fabmanager())
  with check (public.is_fabmanager());

-- ---------------------------------------------------------------------------
-- Données initiales (machines du FabLab)
-- ---------------------------------------------------------------------------
insert into public.machines (name, category, description, safety_rules, status, level_required, max_duration_minutes)
select * from (values
  (
    'Imprimante 3D Prusa MK4',
    'Impression 3D',
    'Imprimante FDM pour prototypes PLA/PETG. Volume 250×210×220 mm. Idéale pour pièces mécaniques et maquettes.',
    'Lunettes de protection recommandées. Ne jamais ouvrir la tête en fonctionnement. Surveiller les 10 premières minutes. PLA uniquement sans validation FabManager.',
    'disponible'::public.machine_status,
    'débutant',
    180
  ),
  (
    'Découpeuse laser 40 W',
    'Découpe laser',
    'Découpe et gravure bois, carton, acrylique. Zone de travail 400×300 mm. Fichiers SVG/DXF.',
    'Portes fermées pendant la découpe. Extincteur à portée. Matériaux interdits : PVC, polycarbonate, métaux. Extraction allumée obligatoire.',
    'disponible'::public.machine_status,
    'intermédiaire',
    60
  ),
  (
    'CNC Desktop 3018',
    'Usinage',
    'Fraiseuse 3 axes pour bois, PCB et aluminium tendre. Courses 300×180×45 mm.',
    'Lunettes et blouse. Cheveux attachés. Jamais de gants près de la broche. Pièce solidement bridée. Arrêt d’urgence identifié.',
    'disponible'::public.machine_status,
    'avancé',
    90
  ),
  (
    'Poste soudure / électronique',
    'Électronique',
    'Station de soudure, alimentations, multimètres, composants de base pour protoboard.',
    'Aspirateur de fumées allumé. Fer jamais posé hors support. Vérifier les tensions avant mise sous tension d’un circuit.',
    'disponible'::public.machine_status,
    'débutant',
    60
  )
) as v(name, category, description, safety_rules, status, level_required, max_duration_minutes)
where not exists (select 1 from public.machines limit 1);
