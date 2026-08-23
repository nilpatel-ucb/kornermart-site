-- KornerMart hiring inbox
-- Applied to the KornerMart Supabase project. apply.html uses the public anon key.

create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'New',

  positions text[] not null default '{}',
  availability text[] not null default '{}',
  other_position text,
  location_code text,
  location_name text,
  location_address text,
  preferred_location text generated always as (
    case
      when location_name is null then null
      when location_address is null then location_name
      else location_name || ' — ' || location_address
    end
  ) stored,

  last_name text not null,
  first_name text not null,
  middle_name text,
  full_name text generated always as (
    trim(both ' ' from first_name || ' ' || coalesce(middle_name || ' ', '') || last_name)
  ) stored,

  phone text not null,
  email text not null,

  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,

  transportation text,
  over_21 text,
  work_authorization text,
  drug_test text,
  essential_functions text,
  essential_functions_notes text,

  convicted text,
  conviction_notes text,

  education text,
  extra_skills text,
  extra_skills_notes text,

  currently_employed text,
  employment_details text,
  contact_employer text,
  contact_employer_details text,

  resume_path text,
  resume_filename text,

  terms_accepted boolean not null default false,
  marketing_opt_in boolean not null default false
);

alter table public.applications
  add column if not exists marketing_opt_in boolean not null default false;

alter table public.applications
  add column if not exists availability text[] not null default '{}';

create table if not exists public.locations (
  code text primary key,
  name text not null,
  address text not null,
  sort_order int not null
);

alter table public.locations enable row level security;

drop policy if exists "Public can read locations" on public.locations;
create policy "Public can read locations"
  on public.locations
  for select
  to anon, authenticated
  using (true);

grant select on table public.locations to anon, authenticated;

insert into public.locations (code, name, address, sort_order) values
  ('KM 01', 'Hurricane Chevron', '687 W State St, Hurricane, UT 84737', 1),
  ('KM 02', 'Green Valley Sinclair', '567 S Valley View Dr #15, St. George, UT 84770', 2),
  ('KM 03', 'Sunset Chevron', '929 W Sunset Blvd, St. George, UT 84770', 3),
  ('KM 04', 'Sunset Texaco', '851 W Sunset Blvd, St. George, UT 84770', 4),
  ('KM 05', 'Riverside Texaco', '1572 S Convention Center Dr, St. George, UT 84790', 5),
  ('KM 06', 'Riverside Chevron', '125 E Riverside Dr, St. George, UT 84790', 6),
  ('KM 07', '700 Store', '795 E 700 S, St. George, UT 84770', 7),
  ('KM 08', 'Cedar City', '1355 S Main St, Cedar City, UT 84720', 8),
  ('KM 09', 'Coral Canyon', '82 N Coral Canyon Blvd, Hurricane, UT 84737', 9),
  ('KM 10', 'Last Chance Helper', '156 N Main St, Helper, UT 84526', 10),
  ('KM 11', 'St. Blvd', '994 E St. George Blvd, St. George, UT 84770', 11),
  ('KM 12', 'Apple Valley', '1354 State St, Apple Valley, UT 84737', 12)
on conflict (code) do update set
  name = excluded.name,
  address = excluded.address,
  sort_order = excluded.sort_order;

alter table public.applications
  drop constraint if exists applications_location_code_fkey;

alter table public.applications
  add constraint applications_location_code_fkey
  foreign key (location_code) references public.locations(code);

create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_location_code_idx on public.applications (location_code);

alter table public.applications enable row level security;

drop policy if exists "Public can submit applications" on public.applications;
create policy "Public can submit applications"
  on public.applications
  for insert
  to anon
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.applications to anon;
grant select, update on table public.applications to authenticated;

drop policy if exists "Staff can read applications" on public.applications;
create policy "Staff can read applications"
  on public.applications for select to authenticated using (true);

drop policy if exists "Staff can update applications" on public.applications;
create policy "Staff can update applications"
  on public.applications for update to authenticated using (true) with check (true);

-- No SELECT/UPDATE/DELETE for anon — review rows in the Table Editor while logged in.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload resumes" on storage.objects;
create policy "Public can upload resumes"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'resumes');

drop policy if exists "Staff can read resumes" on storage.objects;
create policy "Staff can read resumes"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'resumes');

-- Optional: email yourself on each application
-- Database → Webhooks → Insert on public.applications
